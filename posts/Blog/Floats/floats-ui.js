/* floats-ui.js - interactive panels. Depends on floats-core.js (window.FloatCore). */
(function () {
  'use strict';
  const FC = window.FloatCore, F = FC.FORMATS;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function num(x) {
    if (!isFinite(x)) return String(x);
    if (x === 0) return Object.is(x, -0) ? '-0' : '0';
    const s = String(x);
    return s.length <= 22 ? s : x.toExponential(12);
  }
  const pct = r => (r * 100).toPrecision(3) + '%';
  function parse(t) {
    t = t.trim().toLowerCase();
    if (t === 'inf' || t === '+inf') return Infinity;
    if (t === '-inf') return -Infinity;
    if (t === 'nan') return NaN;
    return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/.test(t) ? Number(t) : undefined;
  }
  function segmented(el, items, value, onPick) {
    el.innerHTML = items.map(([k, label]) => `<button type="button" data-k="${k}" class="${k === value ? 'on' : ''}">${label}</button>`).join('');
    el.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      [...el.children].forEach(c => c.classList.toggle('on', c === b)); onPick(b.dataset.k);
    };
  }
  function presets(el, list, onPick) {
    el.innerHTML = list.map((p, i) => `<button type="button" class="chip" data-i="${i}">${esc(p.label)}</button> `).join('');
    el.onclick = e => { const b = e.target.closest('button'); if (b) onPick(list[+b.dataset.i]); };
  }

  function bitBoxes(enc, f, clickable) {
    const bf = FC.bitFields(enc, f);
    const grp = (cls, str, off) => `<span class="grp ${cls}">` + [...str].map((c, i) => {
      const tag = clickable ? 'button type="button"' : 'span', end = clickable ? 'button' : 'span';
      return `<${tag} class="bit ${cls}${c === '1' ? ' on' : ''}"${clickable ? ` data-idx="${off + i}" title="click to flip this ${cls} bit"` : ''}>${c}</${end}>`;
    }).join('') + '</span>';
    return `<div class="bits">${grp('sign', bf.sign, 0)}${grp('exp', bf.exp, 1)}${grp('man', bf.mant, 1 + f.e)}</div>` +
      `<div class="legend"><span class="c-sign">sign (1)</span> · <span class="c-exp">exponent (${f.e})</span> · <span class="c-man">mantissa (${f.m})</span></div>`;
  }
  function flipBit(enc, f, idx) {
    const r = { sign: enc.sign, exp: enc.exp, mant: enc.mant };
    if (idx === 0) r.sign ^= 1;
    else if (idx <= f.e) r.exp ^= (1 << (f.e - idx));
    else r.mant = (enc.mant ^ (1 << (f.m - 1 - (idx - 1 - f.e)))) >>> 0;
    return r;
  }
  // Steps are collapsed by default; clicking the title expands one. Open state survives re-renders.
  const step = (n, title, body) => `<details class="step s${n}" data-n="${n}"><summary>Step ${n} · ${title}</summary><div>${body}</div></details>`;
  const openSteps = el => new Set([...el.querySelectorAll('details.step[open]')].map(d => d.dataset.n));
  const restoreSteps = (el, open) => el.querySelectorAll('details.step').forEach(d => { if (open.has(d.dataset.n)) d.open = true; });
  const setAll = (el, open) => el.querySelectorAll('details.step').forEach(d => { d.open = open; });
  const binStr = (n, max) => { const s = Math.floor(n).toString(2); return s.length > max ? s.slice(0, max) + '…' : s; };


  /* Step-2 helper: binary expansion shown as place values (…4, 2, 1 . 1/2, 1/4, 1/8 …). */
  function binaryExpansion(text, a, e) {
    if (e < -10 || e > 40) return `|x| = ${num(a)} is too ${e > 40 ? 'large' : 'small'} to expand by hand; the next step does the same job with exact arithmetic.`;
    const NF = 16, t = text.trim().replace(/^[-+]/, ''), m = /^(\d*)\.?(\d*)$/.exec(t);
    let ipBig, fracBits = [], fracText, exact = false;
    if (m && (m[1] || m[2])) {                       // exact expansion of the typed decimal
      exact = true; ipBig = BigInt(m[1] || '0');
      const den = 10n ** BigInt(m[2].length); let n = BigInt(m[2] || '0');
      fracText = m[2] ? '0.' + m[2] : '0';
      for (let i = 0; i < NF; i++) { n *= 2n; if (n >= den) { fracBits.push(1); n -= den; } else fracBits.push(0); }
    } else {                                         // e.g. 1e-3 or a flipped value: use the stored double
      ipBig = BigInt(Math.floor(a)); fracText = num(+(a - Math.floor(a)).toPrecision(12));
      fracBits = FC.fractionBits(a - Math.floor(a), NF).map(p => p.bit);
    }
    const ipStr = ipBig.toString(2).slice(0, 24), shown = ipBig.toString(2).length > 24;
    const iw = [...ipStr].map((_, i) => '2<sup>' + (ipStr.length - 1 - i) + '</sup>=' + Math.pow(2, ipStr.length - 1 - i));
    const intTable = shown ? `<code>${ipStr}…</code>` : `<div class="pv"><table><tr><th>place value</th>${iw.map(w => `<td>${w}</td>`).join('')}</tr>
      <tr><th>bit</th>${[...ipStr].map(c => `<td><b>${c}</b></td>`).join('')}</tr>
      <tr><th>adds</th>${[...ipStr].map((c, i) => `<td>${c === '1' ? Math.pow(2, ipStr.length - 1 - i) : 0}</td>`).join('')}</tr></table></div>`;
    let run = 0;
    const cells = fracBits.map((b, i) => { const w = Math.pow(2, -(i + 1)); if (b) run += w; return { w, b, run }; });
    const fracTable = `<div class="pv"><table><tr><th>place value</th>${cells.map((c, i) => `<td>1/${Math.pow(2, i + 1)}</td>`).join('')}</tr>
      <tr><th>bit</th>${cells.map(c => `<td><b>${c.b}</b></td>`).join('')}</tr>
      <tr><th>adds</th>${cells.map(c => `<td>${c.b ? +c.w.toPrecision(6) : 0}</td>`).join('')}</tr>
      <tr><th>running sum</th>${cells.map(c => `<td>${+c.run.toPrecision(7)}</td>`).join('')}</tr></table></div>`;
    const detail = `<details><summary>how the bits are found: multiply by 2, take the integer bit</summary><div class="mono">` +
      (exact ? (() => { const den = 10n ** BigInt((m[2] || '').length); let n = BigInt(m[2] || '0'), out = []; for (let i = 0; i < 12; i++) { n *= 2n; const b = n >= den ? 1 : 0; if (b) n -= den; out.push(`×2 → ${num(+(Number(n + (b ? den : 0n)) / Number(den)).toPrecision(10))} → bit ${b}`); } return out.join('<br>'); })()
        : FC.fractionBits(a - Math.floor(a), 12).map(p => `×2 → ${num(+p.value.toPrecision(10))} → bit ${p.bit}`).join('<br>')) + '</div></details>';
    return `<b>Integer part ${ipBig}</b>: which powers of two add up to it?${intTable}
      <b>Fractional part ${fracText}</b>: which of 1/2, 1/4, 1/8, … add up to it? Each bit switches one place value on (1) or off (0), and the sum creeps toward ${fracText}.${fracTable}${detail}
      So |x| = <code>${ipStr}${shown ? '…' : ''}.${fracBits.join('')}…</code>${exact ? '' : ' <span class="note">(expanded from the stored double, since the input is not a plain decimal)</span>'}
      ${exact && /^\d*\.\d*$/.test(t) && fracBits.slice(-8).join('') !== '00000000' ? '<div class="note">Many decimals (like 0.1) never terminate in binary, so they repeat forever and must be cut: this is where rounding error is born.</div>' : ''}`;
  }

  /* ---------------- Panel 1: converter ---------------- */
  const S1 = { fmt: 'bf16' };
  function renderConv() {
    const f = F[S1.fmt], x = parse($('#c-x').value), out = $('#c-out'), wasOpen = openSteps(out);
    if (x === undefined) { out.innerHTML = '<p class="warn">Enter a number like 4.1, -1.375, 1e-3, inf or nan.</p>'; return; }
    const enc = FC.encode(x, f), val = FC.decode(enc, f), M = f.m, b = FC.bias(f);
    let h = `<h4>${f.name}: 1 sign · ${f.e} exponent · ${M} mantissa bits (bias ${b})</h4>`;
    if (enc.kind === 'normal' || enc.kind === 'subnormal') {
      const a = Math.abs(x), e = enc.eTrue, normal = enc.kind === 'normal' || !enc.subnormalInput;
      h += step(1, 'Sign bit', `x is ${x < 0 ? 'negative' : 'positive'}, so the sign bit is <b class="c-sign">${enc.sign}</b>. Everything below uses |x| = ${num(a)}.`);
      h += step(2, 'Write |x| in binary (place values)', binaryExpansion($('#c-x').value, a, e));
      if (normal) {
        const m = a / Math.pow(2, e), fr = FC.fractionBits(m - 1, M + 10).map(p => p.bit).join('');
        h += step(3, 'Normalise to 1.xxx × 2<sup>e</sup>', `Move the binary point until exactly one 1 is on its left: |x| = <code>1.<span class="c-man">${fr.slice(0, M)}</span><span class="cut">|</span><span class="dim">${fr.slice(M)}…</span></code> × 2<sup>${e}</sup>.
          The leading 1 is <i>implicit</i> (never stored). The <span class="cut">|</span> marks where this format cuts: only ${M} bits fit.`);
        h += step(4, 'Exponent field', `stored exponent = e + bias = ${e} + ${b} = <b class="c-exp">${e + b}</b> = <code>${FC.bits(e + b, f.e)}</code>${enc.carried ? ' (rounding in the next step carries into the exponent, so the final field is ' + enc.exp + ')' : ''}.`);
        const kept = FC.bits(enc.q - Math.pow(2, M), M);
        const verdict = enc.rem === 0 ? 'exactly representable: nothing is discarded' : enc.rem > 0.5 ? 'more than half a tick: round <b>up</b>' : enc.rem < 0.5 ? 'less than half a tick: round <b>down</b>' : 'exactly half a tick: round to the <b>even</b> neighbour';
        h += step(5, 'Mantissa and rounding', `Keep ${M} bits: <code>${kept}</code>. The discarded bits equal ${enc.rem.toPrecision(4)} of one tick (tick = 2<sup>${e - M}</sup> = ${num(enc.ulp)}), so: ${verdict}. Stored mantissa: <b class="c-man">${FC.bits(enc.mant, M)}</b>.`);
      } else {
        h += step(3, 'Subnormal range', `|x| is below the smallest normal number 2<sup>${FC.emin(f)}</sup>, so ${f.name} stores it as a <b>subnormal</b>: exponent field = 0, no implicit 1, mantissa = round(|x| / ${num(enc.ulp)}) = <b>${enc.mant}</b>. Precision shrinks gradually toward zero.`);
      }
    } else if (enc.kind === 'zero') {
      h += `<p>Zero is the all-zero exponent and mantissa. The sign bit still exists, so −0 and +0 are distinct bit patterns.</p>`;
    } else if (enc.kind === 'inf') {
      h += `<p>${enc.overflow ? `|x| is larger than ${f.name}'s largest finite number, so it overflows to ∞.` : '∞'} Infinity is the all-ones exponent with a zero mantissa.</p>`;
    } else { h += `<p>NaN (not a number) is the all-ones exponent with a non-zero mantissa.</p>`; }

    h += `<div class="result"><b>Result</b>${bitBoxes(enc, f, true)}`;
    if (isFinite(val) && enc.kind !== 'zero') {
      const eexp = enc.exp === 0 ? FC.emin(f) : enc.exp - b, sig = enc.exp === 0 ? 0 : 1;
      h += `<div>decode: (−1)<sup>${enc.sign}</sup> × (${sig} + ${enc.mant}/${Math.pow(2, M)}) × 2<sup>${eexp}</sup> = <b>${num(val)}</b></div>`;
      if (isFinite(x) && x !== 0) h += `<div>stored value differs from your input by ${num(+(val - x).toPrecision(6))} (relative ${pct(Math.abs((val - x) / x))}); max possible relative error for ${f.name} is 2<sup>−${M + 1}</sup> = ${pct(Math.pow(2, -(M + 1)))}.</div>`;
    }
    h += '</div>';
    if (enc.kind === 'normal' && enc.exp > 1 && enc.exp < FC.expAllOnes(f) - 1) h += impactTable(enc, f, val);
    out.innerHTML = h; restoreSteps(out, wasOpen);
    out.dataset.enc = JSON.stringify({ sign: enc.sign, exp: enc.exp, mant: enc.mant });
  }
  function impactTable(enc, f, val) {
    const mk = (o) => FC.decode(Object.assign({}, enc, o), f);
    const rows = [
      ['flip the <span class="c-sign">sign</span> bit', mk({ sign: enc.sign ^ 1 }), 'only the side of zero changes'],
      ['<span class="c-exp">exponent</span> + 1', mk({ exp: enc.exp + 1 }), 'doubles the magnitude'],
      ['<span class="c-exp">exponent</span> − 1', mk({ exp: enc.exp - 1 }), 'halves the magnitude'],
      ['flip the most significant <span class="c-man">mantissa</span> bit', mk({ mant: (enc.mant ^ Math.pow(2, f.m - 1)) }), 'moves the value by up to 50%'],
      ['flip the least significant <span class="c-man">mantissa</span> bit', mk({ mant: (enc.mant ^ 1) }), `moves it by one tick (relative ≈ 2<sup>−${f.m}</sup>)`],
    ];
    return `<h4>What each field controls (flip one bit of the result above)</h4><table><tr><th>change</th><th>new value</th><th>effect</th></tr>` +
      rows.map(r => `<tr><td>${r[0]}</td><td>${num(r[1])}</td><td>${r[2]} (${+(r[1] / val).toPrecision(4)}× original)</td></tr>`).join('') + '</table>';
  }

  /* ---------------- Panel 2: multiplication ---------------- */
  const S2 = { fmt: 'bf16', out: 'same' };
  function renderMul() {
    const f = F[S2.fmt], of = S2.out === 'fp32' ? F.fp32 : f, el = $('#m-res'), wasOpen = openSteps(el);
    const a = parse($('#m-a').value), b = parse($('#m-b').value);
    if (a === undefined || b === undefined) { el.innerHTML = '<p class="warn">Enter two numbers.</p>'; return; }
    const r = FC.multiply(a, b, f, of), bias = FC.bias(f), M = f.m;
    const side = (name, enc, v, inp) => `<div><b>${name}</b> = ${num(inp)} → stored in ${f.name} as <b>${num(v)}</b>${inp !== v && isFinite(inp) ? ` <span class="note">(input rounding error ${pct(Math.abs((v - inp) / inp))})</span>` : ''}${bitBoxes(enc, f, false)}</div>`;
    let h = `<div class="cols">${side('a', r.ea, r.A, a)}${side('b', r.eb, r.B, b)}</div>`;
    if (r.special) {
      h += `<p class="note">At least one input is zero, subnormal, infinite or NaN, so the normal-number recipe below does not apply; the result is simply <b>${num(r.value)}</b> (exact product of the stored values rounded to ${of.name}).</p>`;
    } else {
      const total = r.pBits.length, shifted = r.normShift === 1;
      h += step(1, 'Sign: XOR', `sign(a) = <span class="c-sign">${r.ea.sign}</span>, sign(b) = <span class="c-sign">${r.eb.sign}</span> → ${r.ea.sign} XOR ${r.eb.sign} = <b class="c-sign">${r.signOut}</b>. Costs nothing and never introduces error.`);
      h += step(2, 'Exponents: add', `unbiased exponents: ${r.uA} + ${r.uB} = <b class="c-exp">${r.expSum}</b>. In stored form (bias ${bias} must be subtracted once): ${r.ea.exp} + ${r.eb.exp} − ${bias} = <b class="c-exp">${r.storedSum}</b>. Exact, unless it leaves the range.`);
      h += step(3, 'Significands: multiply as integers', `With the implicit 1 restored each significand has ${M + 1} bits: <code>${r.sigA.toString(2)}</code> (= ${r.sigA}) and <code>${r.sigB.toString(2)}</code> (= ${r.sigB}).
        Integer product: ${r.sigA} × ${r.sigB} = <b class="c-man">${r.P}</b> = <code>${r.pBits}</code> (${total} bits, from a ${M + 1}×${M + 1}-bit multiplier).`);
      const q = r.P, ratio = Number(q) / Math.pow(2, 2 * M);
      h += step(4, 'Normalise', `The product represents ${num(+ratio.toPrecision(12))} (always in [1, 4)). ${shifted ? `It is ≥ 2, so shift the point one place and add 1 to the exponent: exponent = ${r.expSum} + 1 = <b class="c-exp">${r.expSum + 1}</b>.` : 'It is already in [1, 2): no shift needed.'}`);
      const o = r.out;
      let rnd;
      if (o.kind === 'inf') rnd = `The final exponent exceeds ${of.name}'s maximum (${FC.emax(of)}), so the result <b class="warn">overflows to ${r.signOut ? '−' : '+'}∞</b>.`;
      else if (o.rem === 0) rnd = `All significant bits fit in ${of.m} mantissa bits: <b>no rounding at all</b>${S2.out === 'fp32' && S2.fmt !== 'fp32' ? ` (the product has at most ${2 * M + 2} bits and fp32 has room for 24)` : ''}.`;
      else rnd = `Only ${of.m} mantissa bits fit, so the extra bits are rounded off (discarded part = ${o.rem.toPrecision(4)} of a tick → ${o.rem > 0.5 ? 'round up' : o.rem < 0.5 ? 'round down' : 'tie: round to even'}). This is the <b>only</b> step that creates error.`;
      h += step(5, `Round to ${of.name}`, rnd);
    }
    const ex = r.exactInputs, rin = r.exactRounded, v = r.value;
    const relIn = ex !== 0 && isFinite(ex) ? Math.abs((rin - ex) / ex) : NaN, relOut = rin !== 0 && isFinite(rin) && isFinite(v) ? Math.abs((v - rin) / rin) : NaN;
    h += `<div class="result"><b>Result in ${of.name}</b>${bitBoxes(r.out, of, false)}<div>value = <b>${num(v)}</b></div></div>`;
    h += `<table><tr><th>quantity</th><th>value</th><th>relative error vs true a×b</th></tr>
      <tr><td>true a × b (exact, your typed numbers)</td><td>${num(ex)}</td><td>—</td></tr>
      <tr><td>product of the <i>rounded</i> inputs (exact)</td><td>${num(rin)}</td><td>${isNaN(relIn) ? '—' : pct(relIn)} <span class="note">from rounding the inputs</span></td></tr>
      <tr><td>result after ${of.name} rounding</td><td>${num(v)}</td><td>${isFinite(v) && isFinite(ex) && ex !== 0 ? pct(Math.abs((v - ex) / ex)) : '—'} <span class="note">total${isNaN(relOut) ? '' : '; the product rounding alone adds ' + pct(relOut)}</span></td></tr></table>
      <p class="note"><b>Impact:</b> the sign only decides the sign; the exponent adds exactly and only fails on overflow/underflow; every bit of error comes from the mantissa — once per input and once on the result. Per rounding the error is at most 2<sup>−${M + 1}</sup> = ${pct(Math.pow(2, -(M + 1)))} in ${f.name}.</p>`;
    el.innerHTML = h; restoreSteps(el, wasOpen);
  }

  /* ---------------- Panel 3: number line ---------------- */
  function renderLine() {
    const x = Math.abs(parse($('#n-x').value) || 1) || 1, z = +$('#n-zoom').value, w = Math.pow(10, -z);
    const lo = x * (1 - w), hi = x * (1 + w);
    $('#n-win').textContent = `window ${num(+lo.toPrecision(10))} … ${num(+hi.toPrecision(10))}`;
    const cv = $('#n-canvas'), dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = 260;
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
    g.clearRect(0, 0, W, H); g.font = '13px system-ui,sans-serif'; g.textBaseline = 'middle';
    const lanes = [['bf16', css('--sign')], ['tf32', css('--acc')], ['fp32', css('--man')]], padL = 70, padR = 14, X = v => padL + (v - lo) / (hi - lo) * (W - padL - padR);
    const info = [];
    lanes.forEach(([k, col], i) => {
      const f = F[k], y = 40 + i * 62, t = FC.ticksIn(lo, hi, f, 600);
      g.fillStyle = css('--fg'); g.textAlign = 'right'; g.fillText(f.name, padL - 8, y);
      g.strokeStyle = css('--line'); g.beginPath(); g.moveTo(padL, y + 20); g.lineTo(W - padR, y + 20); g.stroke();
      if (t.truncated) { g.fillStyle = col; g.globalAlpha = .28; g.fillRect(padL, y - 16, W - padL - padR, 32); g.globalAlpha = 1; g.textAlign = 'center'; g.fillStyle = css('--fg'); g.fillText('too dense to draw', (W + padL) / 2, y); }
      else { g.strokeStyle = col; g.lineWidth = 2; t.ticks.forEach(v => { const px = X(v); g.beginPath(); g.moveTo(px, y - 16); g.lineTo(px, y + 16); g.stroke(); }); g.lineWidth = 1; }
      info.push(`${f.name}: ${t.count.toLocaleString()} ticks in window`);
    });
    const bounds = [];                                  // powers of two inside the window: tick gaps double here
    for (let k = Math.floor(Math.log2(lo)); k <= Math.ceil(Math.log2(hi)); k++) { const v = Math.pow(2, k); if (v > lo && v < hi) bounds.push([k, v]); }
    bounds.forEach(([k, v]) => { const bx = X(v); g.setLineDash([2, 3]); g.strokeStyle = css('--warn'); g.beginPath(); g.moveTo(bx, 22); g.lineTo(bx, 214); g.stroke(); g.setLineDash([]);
      g.fillStyle = css('--warn'); g.textAlign = 'center'; g.fillText('2^' + k + ' = ' + num(v) + ': gaps double', bx, 12); });
    const px = X(x); g.setLineDash([4, 4]); g.strokeStyle = css('--fg'); g.beginPath(); g.moveTo(px, 8); g.lineTo(px, 218); g.stroke(); g.setLineDash([]);
    g.textAlign = 'center'; g.fillStyle = css('--fg'); g.fillText('x', px, 230);
    g.textAlign = 'left'; g.fillText(num(+lo.toPrecision(8)), padL, 248); g.textAlign = 'right'; g.fillText(num(+hi.toPrecision(8)), W - padR, 248);
    const raw = parse($('#n-x').value), mirror = raw !== undefined && raw < 0 ? ' <span class="warn">(negative numbers mirror the positive side, so |x| is shown)</span>' : '';
    const why = bounds.length ? `<br><b>Why the right side is sparser:</b> every format has the same number of ticks between consecutive powers of two (bf16: 2<sup>7</sup> = 128, TF32: 1024, fp32: ~8.4 million). The interval [2<sup>${bounds[0][0] - 1}</sup>, 2<sup>${bounds[0][0]}</sup>) is half as wide as [2<sup>${bounds[0][0]}</sup>, 2<sup>${bounds[0][0] + 1}</sup>), so its ticks sit twice as close. Gap just below ${num(bounds[0][1])} → just above: ` + lanes.map(([k]) => `${F[k].name} ${num(FC.ulpAt(bounds[0][1] * 0.999, F[k]))} → ${num(FC.ulpAt(bounds[0][1], F[k]))}`).join(' · ') : '';
    $('#n-info').innerHTML = mirror + (mirror ? '<br>' : '') + info.join(' · ') + `<br>x = ${num(x)} is stored as: ` + lanes.map(([k]) => `${F[k].name} ${num(FC.round(x, F[k]))}`).join(' · ') + why;
  }

  /* ---------------- Panel 4: accumulation ---------------- */
  function lineChart(cv, series, o) {
    const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = +cv.getAttribute('height'); cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext('2d'); g.scale(dpr, dpr); g.clearRect(0, 0, W, H); g.font = '12px system-ui,sans-serif';
    const L = 62, R = 12, T = 12, B = 34, tx = o.logx ? Math.log10 : (v => v), ty = o.logy ? Math.log10 : (v => v);
    const pts = series.flatMap(s => s.pts), xs = pts.map(p => tx(p[0])), ys = pts.map(p => ty(p[1])).filter(isFinite);
    const x0 = Math.min(...xs), x1 = Math.max(...xs); let y0 = Math.min(...ys), y1 = Math.max(...ys); if (!o.logy) y0 = Math.min(0, y0); if (y0 === y1) y1 = y0 + 1;
    const X = v => L + (tx(v) - x0) / (x1 - x0 || 1) * (W - L - R), Y = v => H - B - (ty(v) - y0) / (y1 - y0) * (H - B - T);
    g.strokeStyle = css('--line'); g.fillStyle = css('--mut'); g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) { const yv = y0 + (y1 - y0) * i / 4, py = H - B - (H - B - T) * i / 4; g.beginPath(); g.moveTo(L, py); g.lineTo(W - R, py); g.stroke(); g.fillText(o.logy ? '1e' + yv.toFixed(0) : (+yv.toPrecision(3)).toString(), L - 6, py); }
    g.textAlign = 'center'; g.fillText(o.xlabel, (L + W - R) / 2, H - 6);
    series.forEach((s, i) => { g.strokeStyle = s.color; g.lineWidth = 2; g.beginPath(); s.pts.forEach((p, j) => { const px = X(p[0]), py = Y(p[1]); if (!isFinite(py)) return; j ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke();
      g.fillStyle = s.color; g.textAlign = 'left'; g.fillText(s.name, L + 8 + (o.legendX ? o.legendX * i : i * 190), T + 10); });
  }
  function runAccum() {
    const v = parse($('#a-v').value), N = Math.max(10, Math.min(200000, +$('#a-n').value | 0)); if (!(v > 0)) return;
    const bf = F.bf16, vq = FC.round(v, bf); let accB = 0, accF = 0, stall = null; const every = Math.ceil(N / 300), pb = [[0, 0]], pf = [[0, 0]], pe = [[0, 0]];
    for (let i = 1; i <= N; i++) {
      const nb = FC.round(accB + vq, bf); if (stall === null && nb === accB) stall = [i, accB]; accB = nb; accF = Math.fround(accF + vq);
      if (i % every === 0 || i === N) { pb.push([i, accB]); pf.push([i, accF]); pe.push([i, i * vq]); }
    }
    $('#a-kpi').innerHTML = `<div>input v = ${num(v)} → bf16 <b>${num(vq)}</b></div><div>exact sum of N values<b>${num(+(N * vq).toPrecision(9))}</b></div>
      <div>fp32 accumulator<b>${num(+accF.toPrecision(9))}</b></div><div>bf16 accumulator<b>${num(accB)}</b></div>` +
      (stall ? `<div>bf16 accumulator froze at step<b>${stall[0].toLocaleString()} (sum = ${num(stall[1])})</b></div>` : '');
    lineChart($('#a-c1'), [{ name: 'exact', color: css('--mut'), pts: pe }, { name: 'fp32 accumulator', color: css('--man'), pts: pf }, { name: 'bf16 accumulator', color: css('--sign'), pts: pb }], { xlabel: 'number of additions' });
  }
  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function runDot() {
    const bf = F.bf16, rnd = mulberry(7), sizes = [16, 64, 256, 1024, 4096, 16384, 65536], eB = [], eF = [];
    $('#d-note').textContent = 'running…';
    setTimeout(() => {
      sizes.forEach(n => {
        let ref = 0, accB = 0, accF = 0;
        for (let i = 0; i < n; i++) {
          const p = FC.round(rnd(), bf) * FC.round(rnd(), bf); ref += p;
          accB = FC.round(accB + FC.round(p, bf), bf); accF = Math.fround(accF + p);
        }
        eB.push([n, Math.max(Math.abs(accB - ref) / ref, 1e-9)]); eF.push([n, Math.max(Math.abs(accF - ref) / ref, 1e-9)]);
      });
      lineChart($('#a-c2'), [{ name: 'bf16 accumulator', color: css('--sign'), pts: eB }, { name: 'fp32 accumulator', color: css('--man'), pts: eF }], { logx: true, logy: true, xlabel: 'dot-product length n (y axis: relative error vs float64, log10)', legendX: 170 });
      $('#d-note').textContent = `n = 65,536: bf16 accumulator error ${pct(eB[6][1])}, fp32 accumulator error ${pct(eF[6][1])}. Products are exact in both; only the accumulator differs.`;
    }, 20);
  }

  /* ---------------- wiring ---------------- */
  const fmtItems = [['fp32', 'fp32'], ['tf32', 'TF32'], ['bf16', 'bf16'], ['fp16', 'fp16']];
  segmented($('#c-fmt'), fmtItems, S1.fmt, k => { S1.fmt = k; renderConv(); });
  presets($('#c-presets'), [{ v: '4.1', label: '4.1' }, { v: '0.1', label: '0.1' }, { v: '3.14159265', label: 'π' }, { v: '-1.375', label: '−1.375' }, { v: '1000.7', label: '1000.7' }, { v: '65520', label: '65520 (fp16 overflow)' }, { v: '1e-40', label: '1e-40' }], p => { $('#c-x').value = p.v; renderConv(); });
  $('#c-expand').onclick = () => setAll($('#c-out'), true); $('#c-collapse').onclick = () => setAll($('#c-out'), false);
  $('#m-expand').onclick = () => setAll($('#m-res'), true); $('#m-collapse').onclick = () => setAll($('#m-res'), false);
  $('#c-x').addEventListener('input', renderConv);
  $('#c-out').addEventListener('click', e => {
    const b = e.target.closest('button.bit'); if (!b) return;
    const f = F[S1.fmt], enc = JSON.parse($('#c-out').dataset.enc), nv = FC.decode(flipBit(enc, f, +b.dataset.idx), f);
    $('#c-x').value = Object.is(nv, -0) ? '-0' : isNaN(nv) ? 'nan' : String(nv); renderConv();
  });
  segmented($('#m-fmt'), fmtItems, S2.fmt, k => { S2.fmt = k; renderMul(); });
  segmented($('#m-out'), [['same', 'same format'], ['fp32', 'fp32 (tensor-core style)']], S2.out, k => { S2.out = k; renderMul(); });
  presets($('#m-presets'), [{ a: '3.14159265', b: '0.15625', label: 'π × 0.15625' }, { a: '0.1', b: '0.2', label: '0.1 × 0.2' }, { a: '1.00390625', b: '1.00390625', label: 'tie in the mantissa' }, { a: '300', b: '300', label: '300 × 300 (overflow in fp16)' }, { a: '1e-20', b: '1e-20', label: '1e-20 × 1e-20 (underflow)' }, { a: '-2.5', b: '4', label: '−2.5 × 4' }], p => { $('#m-a').value = p.a; $('#m-b').value = p.b; renderMul(); });
  ['#m-a', '#m-b'].forEach(s => $(s).addEventListener('input', renderMul));
  ['#n-x', '#n-zoom'].forEach(s => $(s).addEventListener('input', renderLine));
  $('#a-run').onclick = runAccum; $('#d-run').onclick = runDot;
  window.addEventListener('resize', () => { renderLine(); });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { renderLine(); runAccum(); });
  renderConv(); renderMul(); renderLine(); runAccum();
})();
