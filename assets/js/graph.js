/* Renders researchGraphData (assets/js/graph-data.js) as an interactive D3 force graph. */

(function () {
	if (typeof d3 === "undefined" || typeof researchGraphData === "undefined") return;

	var container = document.getElementById("graph-container");
	var svgEl = document.getElementById("research-graph");
	if (!container || !svgEl) return;

	var colorByCategory = {
		center: "#282828",
		topic: "#62C370",
		employer: "#4F535F",
		project: "#8A93A6"
	};

	var nodes = researchGraphData.nodes.map(function (d) { return Object.assign({}, d); });
	var links = researchGraphData.edges.map(function (d) { return Object.assign({}, d); });

	var svg = d3.select("#research-graph");
	var zoomLayer = svg.append("g").attr("class", "zoom-layer");
	var linkLayer = zoomLayer.append("g").attr("class", "links");
	var nodeLayer = zoomLayer.append("g").attr("class", "nodes");

	var width, height;

	function measure() {
		var rect = container.getBoundingClientRect();
		width = rect.width;
		height = rect.height;
		svg.attr("viewBox", "0 0 " + width + " " + height);
	}
	measure();

	var simulation = d3.forceSimulation(nodes)
		.force("link", d3.forceLink(links).id(function (d) { return d.id; }).distance(95).strength(0.6))
		.force("charge", d3.forceManyBody().strength(-260))
		.force("center", d3.forceCenter(width / 2, height / 2))
		.force("collide", d3.forceCollide().radius(function (d) { return radiusFor(d) + 14; }));

	function radiusFor(d) {
		return d.category === "center" ? 26 : d.category === "topic" ? 18 : 12;
	}

	var linkSel = linkLayer.selectAll("line")
		.data(links)
		.enter()
		.append("line")
		.attr("class", "graph-link");

	var nodeSel = nodeLayer.selectAll("g.graph-node")
		.data(nodes)
		.enter()
		.append("g")
		.attr("class", "graph-node")
		.call(d3.drag()
			.on("start", dragStarted)
			.on("drag", dragged)
			.on("end", dragEnded));

	nodeSel.append("circle")
		.attr("r", radiusFor)
		.attr("fill", function (d) { return colorByCategory[d.category] || "#62C370"; });

	nodeSel.append("text")
		.attr("class", "graph-label")
		.attr("dy", function (d) { return radiusFor(d) + 14; })
		.attr("text-anchor", "middle")
		.text(function (d) { return d.label; });

	nodeSel.on("click", function (event, d) {
		event.stopPropagation();
		showInfo(d);
		highlight(d);
	});

	svg.on("click", function () {
		clearHighlight();
		hideInfo();
	});

	simulation.on("tick", function () {
		linkSel
			.attr("x1", function (d) { return d.source.x; })
			.attr("y1", function (d) { return d.source.y; })
			.attr("x2", function (d) { return d.target.x; })
			.attr("y2", function (d) { return d.target.y; });

		nodeSel.attr("transform", function (d) { return "translate(" + d.x + "," + d.y + ")"; });
	});

	function dragStarted(event, d) {
		if (!event.active) simulation.alphaTarget(0.3).restart();
		d.fx = d.x;
		d.fy = d.y;
	}
	function dragged(event, d) {
		d.fx = event.x;
		d.fy = event.y;
	}
	function dragEnded(event, d) {
		if (!event.active) simulation.alphaTarget(0);
		d.fx = null;
		d.fy = null;
	}

	var zoom = d3.zoom()
		.scaleExtent([0.4, 2.5])
		.on("zoom", function (event) {
			zoomLayer.attr("transform", event.transform);
		});
	svg.call(zoom);

	function connectedIds(d) {
		var ids = new Set([d.id]);
		links.forEach(function (l) {
			var s = l.source.id || l.source, t = l.target.id || l.target;
			if (s === d.id) ids.add(t);
			if (t === d.id) ids.add(s);
		});
		return ids;
	}

	function highlight(d) {
		var ids = connectedIds(d);
		nodeSel.classed("dim", function (n) { return !ids.has(n.id); });
		linkSel.classed("dim", function (l) {
			var s = l.source.id || l.source, t = l.target.id || l.target;
			return s !== d.id && t !== d.id;
		});
	}
	function clearHighlight() {
		nodeSel.classed("dim", false);
		linkSel.classed("dim", false);
	}

	var panel = document.getElementById("graph-info-panel");
	var titleEl = document.getElementById("graph-info-title");
	var descEl = document.getElementById("graph-info-desc");
	var linksEl = document.getElementById("graph-info-links");
	var closeBtn = document.getElementById("graph-info-close");

	function showInfo(d) {
		titleEl.textContent = d.label;
		descEl.textContent = d.description || "";
		linksEl.innerHTML = "";
		(d.links || []).forEach(function (l) {
			var a = document.createElement("a");
			a.href = l.url;
			a.target = "_blank";
			a.rel = "noopener";
			a.className = "graph-info-link";
			a.textContent = l.label + " ↗";
			linksEl.appendChild(a);
		});
		panel.classList.add("open");
	}
	function hideInfo() {
		panel.classList.remove("open");
	}
	if (closeBtn) {
		closeBtn.addEventListener("click", function (e) {
			e.stopPropagation();
			hideInfo();
			clearHighlight();
		});
	}

	var resizeTimer;
	window.addEventListener("resize", function () {
		clearTimeout(resizeTimer);
		resizeTimer = setTimeout(function () {
			measure();
			simulation.force("center", d3.forceCenter(width / 2, height / 2));
			simulation.alpha(0.3).restart();
		}, 200);
	});
})();
