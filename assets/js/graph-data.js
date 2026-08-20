/* Data for the "Explore My Research" force-directed graph. */

var researchGraphData = {
	nodes: [
		{ id: "me", label: "Caglar Demir", category: "center",
			description: "Staff R&D Engineer (Synopsys), Group Lead Researcher (Paderborn University), former Co-founder & CTO (Tentris GmbH).",
			links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/caglar-demir" }] },

		{ id: "kge", label: "Knowledge Graph Embeddings", category: "topic",
			description: "Learning continuous representations for knowledge graphs — the subject of my PhD thesis and ongoing research.",
			links: [{ label: "PhD Thesis", url: "https://digital.ub.uni-paderborn.de/hs/content/titleinfo/7207119" }] },

		{ id: "nsym", label: "Neuro-Symbolic AI & Class Expression Learning", category: "topic",
			description: "Combining neural learning with description logics to synthesize explainable OWL class expressions.",
			links: [{ label: "IJCAI 2023 paper", url: "https://www.ijcai.org/proceedings/2023/0403.pdf" }] },

		{ id: "agentic", label: "Agentic AI & RAG", category: "topic",
			description: "Multi-agent orchestration, agentic code generation, and retrieval-augmented generation over structured and visual data.",
			links: [] },

		{ id: "synopsys", label: "Synopsys Inc", category: "employer",
			description: "Staff R&D Engineer, GenAI (06.2025 – current). Semantic memory knowledge bases and agentic code generation for hardware verification.",
			links: [] },

		{ id: "paderborn", label: "Paderborn University", category: "employer",
			description: "Group Lead Researcher (09.2023 – current). Leads an ML research group on knowledge graphs and neuro-symbolic reasoning.",
			links: [{ label: "University site", url: "https://cs.uni-paderborn.de/" }] },

		{ id: "tentris", label: "Tentris GmbH", category: "employer",
			description: "Co-founder & CTO (04.2024 – 06.2025). Edge large language models within a database; secured over €1.1M in BMWK seed capital.",
			links: [{ label: "tentris.io", url: "https://tentris.io" }] },

		{ id: "sap", label: "SAP SE", category: "employer",
			description: "Visiting Applied Researcher (11.2023 – 04.2024). Multimodal retrieval-augmented generation for SAP Concur Business.",
			links: [] },

		{ id: "dicee", label: "Dice-Embeddings", category: "project",
			description: "Hardware-agnostic framework for large-scale knowledge graph embeddings.",
			links: [{ label: "PyPI", url: "https://pypi.org/project/dicee/" }, { label: "GitHub", url: "https://github.com/dice-group/dice-embeddings" }] },

		{ id: "ontolearn", label: "Ontolearn", category: "project",
			description: "OWL class expression learning in Python.",
			links: [{ label: "GitHub", url: "https://github.com/dice-group/Ontolearn" }, { label: "PyPI", url: "https://pypi.org/project/ontolearn/" }] },

		{ id: "owlapy", label: "OWLAPY", category: "project",
			description: "OWL engineering & reasoning in Python.",
			links: [{ label: "PyPI", url: "https://pypi.org/project/owlapy/" }, { label: "GitHub", url: "https://github.com/dice-group/owlapy" }] },

		{ id: "scholar", label: "Publications", category: "project",
			description: "35+ peer-reviewed papers at venues including IJCAI, ECML PKDD, WWW/TheWebConf, ISWC, ESWC, and ACML.",
			links: [{ label: "Google Scholar", url: "https://scholar.google.com/citations?user=PAZsbbEAAAAJ&hl=en" }] }
	],
	edges: [
		{ source: "me", target: "kge" },
		{ source: "me", target: "nsym" },
		{ source: "me", target: "agentic" },
		{ source: "me", target: "synopsys" },
		{ source: "me", target: "paderborn" },
		{ source: "me", target: "tentris" },
		{ source: "me", target: "sap" },

		{ source: "agentic", target: "synopsys" },
		{ source: "kge", target: "tentris" },
		{ source: "agentic", target: "sap" },
		{ source: "kge", target: "paderborn" },
		{ source: "nsym", target: "paderborn" },

		{ source: "kge", target: "dicee" },
		{ source: "nsym", target: "ontolearn" },
		{ source: "nsym", target: "owlapy" },
		{ source: "ontolearn", target: "owlapy" },
		{ source: "paderborn", target: "dicee" },
		{ source: "paderborn", target: "ontolearn" },

		{ source: "kge", target: "scholar" },
		{ source: "nsym", target: "scholar" }
	]
};
