export interface PostHogApplicationLink {
  readonly href: string;
  readonly label: string;
  readonly external?: boolean;
}

export interface PostHogApplicationEvidence {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly links: readonly PostHogApplicationLink[];
}

export const posthogApplication = {
  title: "I want to help products drive themselves",
  description:
    "A speculative application to PostHog from Robbie Palmer, backed by working product infrastructure, public decisions, and shipped code.",
  thesis: [
    "I was building pieces of a self-driving product long before I knew PostHog used that phrase. Across pathology, logistics, personal finance, recipes, and developer tooling, the pattern is the same: observe the real system, build a useful model of it, then shorten the distance between learning and action.",
    "You are assembling the context and tools that let products do that for themselves. I keep attacking the same problem through data architecture, applied ML, digital twins, adaptive planning, and product engineering. That overlap is why I am applying to PostHog.",
  ],
  loop: [
    {
      step: "01",
      title: "Observe",
      detail: "Events, replays, logs, traces, user feedback",
    },
    {
      step: "02",
      title: "Decide",
      detail: "Outcomes, dependencies, priority, human judgment",
    },
    {
      step: "03",
      title: "Build",
      detail: "Bounded agent work with explicit access and authority",
    },
    {
      step: "04",
      title: "Verify",
      detail: "Tests, review, experiments, and product impact",
    },
  ],
  weirdness: {
    quote:
      "I am the sort of person who builds a recipe platform, an autonomic satellite-swarm simulation, cancer-research software, a Kubernetes-based homelab, and a Jira replacement at the same time.",
    attribution: "One review of this repository",
    intro:
      "Correct. That is the point. I like building things that do not fit neatly on one roadmap. The subjects jump. The underlying questions do not.",
    threads: [
      "Data architecture",
      "Machine learning",
      "Digital twins",
      "Adaptive planning",
      "Networks and infrastructure",
      "A shared go-to-market stack",
    ],
    conclusion:
      "The domains change. The work repeats: model a real system, connect its data, make it adaptive, then build whatever infrastructure is missing. I see things that should exist and keep going until they do. I do not want the project list to look normal.",
    posthogParallel:
      "DeskHog is a developer toy built for joy. I recognise the instinct. Curiosity is allowed to become infrastructure.",
    posthogParallelHref: "https://posthog.com/deskhog",
    posthogParallelImage:
      "https://res.cloudinary.com/dmukukwp6/image/upload/deskhog_smiling_36bb2647ff",
    posthogParallelImageAlt:
      "PostHog's turquoise DeskHog developer toy smiling beneath a shower of confetti",
    personality: {
      heading: "The repository is only the organised part.",
      intro:
        "None of this is personal branding. It is what I do when nobody has assigned me a ticket. If pineapple-on-pizza telemetry belongs on a company page, this belongs on an application.",
      items: [
        {
          eyebrow: "Light reading · 6,907 words",
          title:
            "I connected the philosophy of mathematics to data science and data mesh.",
          description:
            "The essay asks what data scientists mean by knowledge, then brings in Gödel, Popper, Kuhn, postmodernism, and organisational architecture.",
          href: "/blog/2022-03-02-the-philosophy-of-data-science",
          linkLabel: "Read the whole thing",
        },
        {
          eyebrow: "Live performance",
          title: "I perform solo jazz dancing.",
          description:
            "A different kind of improvisation: rhythm, vocabulary, nerve, and no rollback button.",
          image:
            "https://ugc.production.linktr.ee/4f88d739-d63c-434e-9683-0ca5142a4358_FF-CIRCULAR-DOUBLE-OUTLINE-SALMON-OUTER.png?io=true&size=avatar-v3_0",
          imageAlt:
            "Flying Feet Jazz Dance Collective logo showing two dancers",
          href: "https://linktr.ee/flyingfeetjazzdancecollective",
          linkLabel: "Meet Flying Feet",
          external: true,
        },
        {
          eyebrow: "Normal evening plans · 20 min to 1.5 hours",
          title: "I watch Marxist analyses of Shrek for fun.",
          description:
            "The Shrek essay is a brisk 20 minutes. The Barbie deconstructionist essay runs for an hour and a half. I watched both for fun.",
          links: [
            {
              label: "Watch the Shrek analysis",
              href: "https://youtu.be/V9NlA628lRw",
            },
            {
              label: "Watch the Barbie essay",
              href: "https://youtu.be/DqIYPCemZ38",
            },
          ],
        },
      ],
    },
    projects: [
      { label: "Recipe platform", href: "/projects/recipe-site" },
      {
        label: "Satellite swarm",
        href: "/projects/autonomic-satellite-swarm",
      },
      { label: "Cancer research", href: "/experience" },
      { label: "Kubernetes homelab", href: "/projects/homelab" },
      { label: "Jira replacement", href: "/projects/work-graph" },
    ],
    artefacts: [
      {
        number: "01",
        shortTitle: "Pathology",
        title: "Whole-slide pathology viewer",
        meta: "Leaflet · gigapixel tissue",
        description:
          "A browser interface for navigating proprietary whole-slide images and inspecting model output in context.",
        image: "/images/home/pathology-viewer.jpg",
        imageWidth: 1790,
        imageHeight: 1008,
        imageFit: "cover",
        alt: "A whole-slide pathology viewer showing a colorectal tissue section",
        href: "/projects/pathology-viewer",
        accent: "#f05b52",
      },
      {
        number: "02",
        shortTitle: "Satellites",
        title: "Autonomic satellite swarm",
        meta: "CesiumJS · C++ · WebAssembly",
        description:
          "A deterministic mission replay where satellites negotiate leadership and assignment over a simulated network.",
        image: "/images/home/satellite-swarm.jpg",
        imageWidth: 1550,
        imageHeight: 1024,
        imageFit: "contain",
        alt: "A CesiumJS globe showing three cooperating satellite nodes",
        href: "/satellite-swarm",
        accent: "#1490e8",
      },
      {
        number: "03",
        shortTitle: "Knowledge graph",
        title: "The site as a knowledge graph",
        meta: "Cosmos.gl · 436 pages · connected data",
        description:
          "Projects, ideas, decisions, roles, and technologies stored as a graph that people and agents can query.",
        image: "/images/posthog/knowledge-graph.png",
        imageWidth: 1151,
        imageHeight: 679,
        imageFit: "contain",
        alt: "The site's knowledge graph with hundreds of coloured connected nodes",
        href: "/projects/personal-knowledge-graph",
        accent: "#4e9b75",
      },
      {
        number: "04",
        shortTitle: "Finance twin",
        title: "A financial twin",
        meta: "Recharts · event ledger · projections",
        description:
          "Accounts, assets, debts, transfers, and forecasts combined into a working model of household finances.",
        image: "/images/home/asset-tracker-chart.jpg",
        imageWidth: 1874,
        imageHeight: 972,
        imageFit: "cover",
        alt: "A personal finance chart plotting net worth and account balances over time",
        href: "/assettracker",
        accent: "#f5c842",
      },
      {
        number: "05",
        shortTitle: "Yard automation",
        title: "A yard that sees what is moving",
        meta: "Computer vision · Kafka · digital twin",
        description:
          "At Terminal, I helped turn camera detections into a live record across gates and yards. My work covered the event plane, cross-camera fusion, cloud infrastructure, observability, analytics, and technical leadership.",
        image: "https://a.storyblok.com/f/337048/2882x1574/cb9f2cde65/y.webp",
        imageWidth: 2882,
        imageHeight: 1574,
        imageFit: "cover",
        alt: "Terminal Industries computer vision identifying a truck and its lane in a logistics yard",
        href: "/projects/real-time-multi-camera-video-analytics",
        accent: "#f05b52",
        credit: "Public product footage · Terminal Industries",
        sourceHref:
          "https://terminal-industries.com/terminal-ai-computer-vision",
      },
      {
        number: "06",
        shortTitle: "Home lab",
        title: "The home lab that runs my projects",
        meta: "K3s · Ansible · NixOS · Tailscale",
        description:
          "Switch between the hardware topology and the Mac mini service graph: DNS, photo backup, coding agents, monitoring, media, storage, and a VPN-gated automation stack that supervises its own download pipeline.",
        chartTitle: "01 · Physical topology",
        chart: `flowchart LR
Phone["Phone or laptop"] -->|"Tailscale"| Mini["Mac mini<br/>Home hub"]
Router["Home router"] -->|"Primary DNS"| Mini
Router -->|"Fallback DNS"| Pi["Raspberry Pi<br/>Fallback host"]
Pi -->|"Metrics"| Mini
Mini --> Drive[("10TB HDD")]
Mini --> TV["Fire TV Stick"]
Mini --> Slack["Slack alerts"]
Mini --> VPN["VPN egress"]
VPN --> Internet["Internet"]
Pi --> Printer["Canon printer"]

classDef hub fill:#f5c842,color:#1d1f1f,stroke:#1d1f1f,stroke-width:3px
classDef fallback fill:#f05b52,color:#1d1f1f,stroke:#1d1f1f,stroke-width:3px
classDef access fill:#1490e8,color:#fffdf8,stroke:#1d1f1f,stroke-width:2px
classDef device fill:#fffdf8,color:#1d1f1f,stroke:#1d1f1f,stroke-width:2px
classDef data fill:#4e9b75,color:#fffdf8,stroke:#1d1f1f,stroke-width:2px
class Mini hub
class Pi fallback
class Phone,VPN access
class Drive data
class Router,TV,Slack,Internet,Printer device
linkStyle default stroke:#1d1f1f,stroke-width:2px`,
        alt: "Home lab topology connecting a phone and router to a Mac mini, Raspberry Pi, storage, media, printer, alerts, VPN, and internet",
        detailChartTitle: "02 · Inside the Mac mini",
        detailChart: `flowchart TB
subgraph mini["Mac mini"]
DNS["AdGuard Home<br/>Primary DNS"]
VPN["Hotspot Shield<br/>Outbound traffic"]
Dev["t3-code<br/>Coding agents"]
Backup["Ente sync<br/>Photo backup"]
Monitor["Netdata<br/>Monitoring"]
KeepAlive["keep-running agent<br/>Stack supervisor"]
Media["Jellyfin<br/>Media server"]
Storage[("10TB HDD")]

subgraph media["Media automation · Docker Compose"]
Prowlarr["Prowlarr<br/>Indexer proxy"]
Sonarr["Sonarr<br/>TV"]
Radarr["Radarr<br/>Movies"]
QBit["qBittorrent<br/>Downloads"]
Recyclarr["Recyclarr<br/>Quality profiles"]
end
end

Trakt["Trakt<br/>Watchlist and tracking"]
FireTV["Fire TV Stick"]
Internet["Internet"]

KeepAlive -.->|"Starts only while<br/>VPN is up"| media
Backup --> Storage
Media --> Storage
Media --> FireTV
Trakt -->|"Watchlist"| Sonarr
Trakt -->|"Watchlist"| Radarr
Media -->|"Scrobbles"| Trakt
Prowlarr -->|"Indexers"| Sonarr
Prowlarr -->|"Indexers"| Radarr
Recyclarr -->|"Profiles"| Sonarr
Recyclarr -->|"Profiles"| Radarr
Sonarr -->|"Releases"| QBit
Radarr -->|"Releases"| QBit
QBit -->|"Completed"| Storage
DNS -->|"Quad9 DNS"| VPN
Dev -->|"Code and agent APIs"| VPN
Backup -->|"Ente sync"| VPN
Monitor -->|"Slack alerts"| VPN
VPN --> Internet

classDef service fill:#1490e8,color:#fffdf8,stroke:#1d1f1f,stroke-width:2px
classDef mediaService fill:#f05b52,color:#1d1f1f,stroke:#1d1f1f,stroke-width:2px
classDef supervisor fill:#f5c842,color:#1d1f1f,stroke:#1d1f1f,stroke-width:3px
classDef data fill:#4e9b75,color:#fffdf8,stroke:#1d1f1f,stroke-width:2px
classDef external fill:#fffdf8,color:#1d1f1f,stroke:#1d1f1f,stroke-width:2px
class DNS,VPN,Dev,Backup,Monitor service
class Media,Prowlarr,Sonarr,Radarr,QBit,Recyclarr mediaService
class KeepAlive supervisor
class Storage data
class Trakt,FireTV,Internet external
linkStyle default stroke:#1d1f1f,stroke-width:2px`,
        detailAlt:
          "Mac mini container topology showing DNS, VPN, coding agents, photo backup, monitoring, Jellyfin, storage, and a five-service media automation pipeline",
        href: "/projects/homelab",
        accent: "#4e9b75",
      },
    ],
  },
  evidence: [
    {
      eyebrow: "The signals",
      title: "PostHog as operating data",
      description:
        "Recipe Site sends product events, traces, and correlated application logs to PostHog. Terraform owns its dashboards, insights, and log alerts. A user action can be followed from the browser through Workers and a durable workflow, then tied back to a replay and product outcome.",
      links: [
        {
          label: "Read the tracing decision",
          href: "/projects/recipe-site/adrs/062-direct-otlp-export-to-posthog",
        },
        {
          label: "Open the live product",
          href: "/recipes",
        },
      ],
    },
    {
      eyebrow: "The plan",
      title: "Work that agents can share",
      description:
        "Work Graph is a deployed API and installable CLI backed by PostgreSQL. It derives ready work from dependencies, prevents concurrent owners with fenced leases, and records human decisions so people and agents can coordinate without a central dispatcher. I used it to coordinate the work on this page.",
      links: [
        {
          label: "Inspect the Work Graph",
          href: "/projects/work-graph",
        },
        {
          label: "Inspect the source",
          href: "https://github.com/Robbie-Palmer/hq/tree/main/packages/work-graph-cli",
          external: true,
        },
      ],
    },
    {
      eyebrow: "The check",
      title: "Review that learns",
      description:
        "A live GitHub App runs independent model scouts, reconciles structured findings, and keeps each finding's lifecycle. It records outcomes, latency, token use, and cost so the system can optimise for useful defects found per pound without turning comment volume into the goal.",
      links: [
        {
          label: "Read the product thesis",
          href: "/projects/agentic-code-review",
        },
        {
          label: "Inspect the source",
          href: "https://github.com/Robbie-Palmer/hq/tree/main/ai-review",
          external: true,
        },
      ],
    },
  ] satisfies readonly PostHogApplicationEvidence[],
  agentPlatform: {
    eyebrow: "The overlap gets ridiculous",
    heading: "I was already building the machine around the coding agent.",
    intro:
      "PostHog Desktop combines a multiplayer product editor, parallel agents, multiple models, and cloud sandboxes. I arrived at the same shape from the infrastructure side, then kept going into shared planning, writing, and GPU services.",
    posthogLink: {
      label: "See the PostHog Desktop parallel",
      href: "https://posthog.com/desktop",
    },
    workspace: {
      number: "01",
      eyebrow: "The place",
      title: "Persistent K3s workspaces",
      detail:
        "Each person gets a private namespace, durable home directory, provider identities, and resource limits. They can leave from a phone or laptop without stopping the work.",
      status: "Pilot infrastructure defined",
      href: "/projects/agent-friendly-remote-development",
      linkLabel: "Inspect the remote development project",
    },
    hub: {
      number: "02",
      eyebrow: "The control room",
      title: "t3-code runs the room",
      detail:
        "Repos, worktrees, terminals, browser tools, and agent sessions stay together while several coding harnesses work in parallel.",
      href: "/projects/homelab/adrs/006-t3-code",
      linkLabel: "Read the t3-code decision",
    },
    harnesses: [
      {
        name: "Claude Code",
        iconName: "Claude Code",
        iconSlug: "claudecode",
        detail: "Subscription",
      },
      {
        name: "Codex × 2",
        iconName: "Codex",
        iconSlug: "codex",
        detail: "Two accounts",
      },
      {
        name: "OpenCode",
        iconName: "opencode",
        iconSlug: "opencode",
        detail: "GLM 5.3 Flash",
      },
      {
        name: "Grok Build",
        iconName: "Grok Build",
        iconSlug: "x",
        detail: "Subscription",
      },
    ],
    shared: {
      number: "03",
      eyebrow: "The shared brain",
      title: "One plan, many workers",
      detail:
        "The agents should share priorities, dependencies, accepted knowledge, and expensive compute instead of rediscovering everything inside each session.",
      services: [
        {
          name: "Work Graph",
          detail:
            "Ready work, dependencies, leases, and requests for attention",
          href: "/projects/work-graph",
        },
        {
          name: "Agent-first Writing Editor",
          detail: "Plans and prose refined through shared GPU-backed models",
          href: "/projects/agent-first-writing",
        },
        {
          name: "Knowledge graph",
          detail: "Decisions and accepted context available to every workspace",
          href: "/projects/personal-knowledge-graph",
        },
      ],
    },
    writingPrinciple:
      "Clear prose is an execution tool. If an agent cannot state the plan cleanly, I do not want it rushing into the code.",
    routingPrinciple:
      "The harness and model are routing choices, not the architecture. Use subscription capacity first, then move work when quality, limits, or cost change. Keep an escape hatch across providers.",
  },
  experience: [
    {
      title: "Applied ML",
      detail:
        "Computer vision in pathology and logistics, semantic search, document intelligence, and production ML pipelines.",
    },
    {
      title: "Product engineering",
      detail:
        "TypeScript and React frontends, Python and Go services, streaming systems, infrastructure, and observability.",
    },
    {
      title: "Users and outcomes",
      detail:
        "Customer discovery, technical consulting, rapid prototypes, product ownership, and measuring what changed after shipping.",
    },
    {
      title: "Technical leadership",
      detail:
        "Currently a Principal Software Engineer and Engineering Manager, still writing code while setting direction and unblocking teams.",
    },
  ],
  fit: [
    "I can imagine being especially useful around Self-Driving, AI Observability, Workflows, MCP and developer experience, or on another small team turning product context into action.",
    "I do my best work between disciplines: talking to users, building applied ML systems, shipping full-stack products, and helping a small team make good technical decisions. I still want to write code.",
    "Belfast is home. I have bought a house here, built a social life I care about, and have a wedding here next year. There is also a cat who would object to the move. I work on UK time and am looking for a remote role, with travel when being together matters.",
  ],
  ask: "I do not see one advertised role that cleanly spans this mix. That is the point of the speculative application. If a team has a need close to it, I would rather be routed there than bend my experience around the nearest title.",
  links: {
    posthogThesis: "https://posthog.com/",
    experience: "/experience",
    initiative: "/initiatives/semi-autonomous-software-development",
    projects: "/projects",
    productDemo: "/recipes",
    technicalDemo: "/satellite-swarm",
    github: "https://github.com/Robbie-Palmer",
    linkedin: "https://www.linkedin.com/in/robertjohnpalmer/",
  },
} as const;

function markdownLink(link: PostHogApplicationLink): string {
  return "[" + link.label + "](" + link.href + ")";
}

export function posthogApplicationMarkdown(): string {
  const lines = [
    "## The overlap",
    "",
    ...posthogApplication.thesis.flatMap((paragraph) => [paragraph, ""]),
    "PostHog's current thesis: [Make your product self-driving](" +
      posthogApplication.links.posthogThesis +
      ")",
    "",
    "## The loop",
    "",
    ...posthogApplication.loop.map(
      (stage) => "- **" + stage.title + ":** " + stage.detail,
    ),
    "",
    "The loop appears in different forms across clinical software, logistics yards, consumer products, and developer tooling.",
    "",
    "## The specific weirdness",
    "",
    "> " + posthogApplication.weirdness.quote,
    ">",
    "> " + posthogApplication.weirdness.attribution,
    "",
    posthogApplication.weirdness.intro,
    "",
    ...posthogApplication.weirdness.threads.map((thread) => "- " + thread),
    "",
    posthogApplication.weirdness.conclusion,
    "",
    "![" +
      posthogApplication.weirdness.posthogParallelImageAlt +
      "](" +
      posthogApplication.weirdness.posthogParallelImage +
      ")",
    "",
    "[" +
      posthogApplication.weirdness.posthogParallel +
      "](" +
      posthogApplication.weirdness.posthogParallelHref +
      ")",
    "",
    ...posthogApplication.weirdness.projects.map(
      (project) => "- [" + project.label + "](" + project.href + ")",
    ),
    "",
    "### Outside the repository",
    "",
    posthogApplication.weirdness.personality.heading,
    "",
    posthogApplication.weirdness.personality.intro,
    "",
    ...posthogApplication.weirdness.personality.items.flatMap((item) => [
      "#### " +
        ("href" in item
          ? "[" + item.title + "](" + item.href + ")"
          : item.title),
      "",
      ...("image" in item
        ? ["![" + item.imageAlt + "](" + item.image + ")", ""]
        : []),
      item.description,
      "",
      ...("links" in item
        ? item.links.flatMap((link) => [
            "- [" + link.label + "](" + link.href + ")",
          ])
        : []),
      ...("links" in item ? [""] : []),
    ]),
    "### What the weirdness looks like",
    "",
    ...posthogApplication.weirdness.artefacts.flatMap((artefact) => [
      "#### [" + artefact.title + "](" + artefact.href + ")",
      "",
      ...("chart" in artefact
        ? [
            "**" + artefact.chartTitle + "**",
            "",
            "```mermaid",
            artefact.chart,
            "```",
            ...("detailChart" in artefact
              ? [
                  "",
                  "**" + artefact.detailChartTitle + "**",
                  "",
                  "```mermaid",
                  artefact.detailChart,
                  "```",
                ]
              : []),
          ]
        : [
            "![" +
              artefact.alt +
              "](" +
              (artefact.image.startsWith("http")
                ? artefact.image
                : "https://robbiepalmer.me" + artefact.image) +
              ")",
          ]),
      "",
      artefact.description,
      "",
      ...("sourceHref" in artefact
        ? ["[" + artefact.credit + "](" + artefact.sourceHref + ")", ""]
        : []),
    ]),
    "## Direct evidence",
    "",
    ...posthogApplication.evidence.flatMap((item) => [
      "### " + item.title,
      "",
      item.description,
      "",
      ...item.links.map((link) => "- " + markdownLink(link)),
      "",
    ]),
    "## " + posthogApplication.agentPlatform.heading,
    "",
    posthogApplication.agentPlatform.intro,
    "",
    "[" +
      posthogApplication.agentPlatform.posthogLink.label +
      "](" +
      posthogApplication.agentPlatform.posthogLink.href +
      ")",
    "",
    ...[
      posthogApplication.agentPlatform.workspace,
      posthogApplication.agentPlatform.hub,
      posthogApplication.agentPlatform.shared,
    ].flatMap((stage) => [
      "### " + stage.number + " · " + stage.title,
      "",
      stage.detail,
      "",
    ]),
    "### Coding harnesses",
    "",
    ...posthogApplication.agentPlatform.harnesses.map(
      (harness) => "- **" + harness.name + ":** " + harness.detail,
    ),
    "",
    ...posthogApplication.agentPlatform.shared.services.flatMap((service) => [
      "- [" + service.name + "](" + service.href + "): " + service.detail,
    ]),
    "",
    posthogApplication.agentPlatform.writingPrinciple,
    "",
    posthogApplication.agentPlatform.routingPrinciple,
    "",
    "## What I bring",
    "",
    ...posthogApplication.experience.map(
      (item) => "- **" + item.title + ":** " + item.detail,
    ),
    "",
    "[Read the full career history](/experience).",
    "",
    "## Where I might fit",
    "",
    ...posthogApplication.fit.flatMap((paragraph) => [paragraph, ""]),
    "## The ask",
    "",
    posthogApplication.ask,
    "",
    "- [Read my initiatives](" + posthogApplication.links.initiative + ")",
    "- [Inspect my projects](" + posthogApplication.links.projects + ")",
    "- [Try Recipe Site](" + posthogApplication.links.productDemo + ")",
    "- [Run the satellite swarm](" +
      posthogApplication.links.technicalDemo +
      ")",
    "- [Read my resume and experience](" +
      posthogApplication.links.experience +
      ")",
    "- [View GitHub](" + posthogApplication.links.github + ")",
    "- [Connect on LinkedIn](" + posthogApplication.links.linkedin + ")",
  ];

  return lines.join("\n").trim();
}
