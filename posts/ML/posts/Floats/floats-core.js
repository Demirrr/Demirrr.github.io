/* floats-core.js - exact IEEE-754-style encode/decode/multiply for small float formats.
 * Works in the browser (window.FloatCore) and in Node (module.exports) so it can be unit-tested.
 * Rounding is round-to-nearest, ties-to-even. Exactness: values are handled as JS doubles, which hold
 * every fp32/bf16/TF32/fp16 value and every product of two such values (<= 48 significand bits) exactly.
 */
(function (root) {
  'use strict';

  const FORMATS = {
    fp32: { key: 'fp32', name: 'fp32', e: 8, m: 23 },
    tf32: { key: 'tf32', name: 'TF32', e: 8, m: 10 },
    bf16: { key: 'bf16', name: 'bf16', e: 8, m: 7 },
    fp16: { key: 'fp16', name: 'fp16', e: 5, m: 10 },
  };

  const bias = f => (1 << (f.e - 1)) - 1;
  const emin = f => 1 - bias(f);            // smallest normal exponent
  const emax = f => bias(f);                // largest normal exponent
  const expAllOnes = f => (1 << f.e) - 1;

  function floorLog2(a) {                   // a > 0, finite
    let e = Math.floor(Math.log2(a));
    while (Math.pow(2, e) > a) e--;
    while (Math.pow(2, e + 1) <= a) e++;
    return e;
  }

  /** Encode a JS number into (sign, exp field, mantissa field) with round-to-nearest-even. */
  function encode(x, f) {
    const M = f.m, E = expAllOnes(f);
    const sign = (x < 0 || Object.is(x, -0)) ? 1 : 0;
    const base = { sign, input: x };
    if (Number.isNaN(x)) return { ...base, sign: 0, exp: E, mant: Math.pow(2, M - 1), kind: 'nan' };
    const a = Math.abs(x);
    if (a === Infinity) return { ...base, exp: E, mant: 0, kind: 'inf' };
    if (a === 0) return { ...base, exp: 0, mant: 0, kind: 'zero' };

    const eTrue = floorLog2(a);               // exponent of the input before any clamping
    const eUsed = Math.max(eTrue, emin(f));   // subnormals share the smallest exponent
    const ulp = Math.pow(2, eUsed - M);       // gap between neighbours at this magnitude
    const scaled = a / ulp;                   // exact: division by a power of two
    const q = Math.floor(scaled);             // kept significand (incl. implicit 1 for normals)
    const rem = scaled - q;                   // discarded part, as a fraction of one tick
    const up = rem > 0.5 || (rem === 0.5 && q % 2 === 1);
    let sig = q + (up ? 1 : 0), eOut = eUsed;
    const info = { eTrue, eUsed, ulp, q, rem, up, subnormalInput: eTrue < emin(f) };
    if (sig >= Math.pow(2, M + 1)) { sig = Math.pow(2, M); eOut = eUsed + 1; info.carried = true; }
    if (eTrue < emin(f) && sig < Math.pow(2, M)) return { ...base, ...info, exp: 0, mant: sig, kind: 'subnormal' };
    if (eOut > emax(f)) return { ...base, ...info, exp: E, mant: 0, kind: 'inf', overflow: true };
    return { ...base, ...info, exp: eOut + bias(f), mant: sig - Math.pow(2, M), kind: 'normal' };
  }

  /** Decode fields back to a JS number. */
  function decode(enc, f) {
    const M = f.m, s = enc.sign ? -1 : 1;
    if (enc.exp === expAllOnes(f)) return enc.mant ? NaN : s * Infinity;
    if (enc.exp === 0) return s * enc.mant * Math.pow(2, emin(f) - M);
    return s * (Math.pow(2, M) + enc.mant) * Math.pow(2, enc.exp - bias(f) - M);
  }

  const round = (x, f) => decode(encode(x, f), f);

  const bits = (n, w) => n.toString(2).padStart(w, '0');
  function bitFields(enc, f) {
    return { sign: String(enc.sign), exp: bits(enc.exp, f.e), mant: bits(enc.mant, f.m) };
  }

  /** First n bits of a fraction in [0,1) by repeated doubling (exact for doubles). */
  function fractionBits(frac, n) {
    const out = [];
    for (let i = 0; i < n; i++) { frac *= 2; const b = frac >= 1 ? 1 : 0; out.push({ bit: b, value: frac }); frac -= b; }
    return out;
  }

  /** Multiply two numbers in format f, returning every intermediate quantity. */
  function multiply(aIn, bIn, f, outFmt) {
    outFmt = outFmt || f;
    const ea = encode(aIn, f), eb = encode(bIn, f);
    const A = decode(ea, f), B = decode(eb, f);
    const res = { f, outFmt, ea, eb, A, B, aIn, bIn };
    res.exactInputs = aIn * bIn;            // double rounding noise here is far below any studied format
    res.exactRounded = A * B;               // exact: <= 48 significand bits
    const out = encode(res.exactRounded, outFmt);
    res.out = out; res.value = decode(out, outFmt);
    res.signOut = ea.sign ^ eb.sign;
    res.special = ![ea, eb].every(e => e.kind === 'normal');
    if (!res.special) {
      const M = f.m, b = bias(f);
      const sigA = Math.pow(2, M) + ea.mant, sigB = Math.pow(2, M) + eb.mant;
      const P = BigInt(sigA) * BigInt(sigB);
      const twoM = BigInt(2 * M);
      const ge2 = P >= (2n << twoM);        // product of two numbers in [1,2) lies in [1,4)
      Object.assign(res, {
        uA: ea.exp - b, uB: eb.exp - b, sigA, sigB, P,
        pBits: P.toString(2), expSum: ea.exp - b + eb.exp - b, storedSum: ea.exp + eb.exp - b,
        normShift: ge2 ? 1 : 0, widthIn: M + 1,
      });
    }
    return res;
  }

  /** Ulp (gap to the next representable number) for a positive value x in format f. */
  function ulpAt(x, f) { return Math.pow(2, Math.max(floorLog2(x), emin(f)) - f.m); }

  /** Representable numbers of f in [lo, hi] (positive, normal range), up to `max` of them. */
  function ticksIn(lo, hi, f, max) {
    const out = []; let count = 0;
    let u = ulpAt(lo, f); let v = Math.ceil(lo / u) * u;
    while (v <= hi) {
      if (count < max) out.push(v);
      count++;
      v += ulpAt(v, f);
      if (count > 5e7) break;
    }
    return { ticks: out, count, truncated: count > max };
  }

  const api = { FORMATS, bias, emin, emax, expAllOnes, floorLog2, encode, decode, round, bits, bitFields, fractionBits, multiply, ulpAt, ticksIn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FloatCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
