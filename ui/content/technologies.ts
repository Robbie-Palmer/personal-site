import type { TechnologyContent } from "@/lib/domain/technology/technology";
export const technologies: TechnologyContent[] = [
  {
    name: "React",
    description: "Component-based UI development for JS/TS",
    website: "https://react.dev",
  },
  {
    name: "Next.js",
    description: "Full-stack web development built on React",
    website: "https://nextjs.org",
  },
  {
    name: "TypeScript",
    description: "TypeScript is JavaScript with syntax for types",
    website: "https://www.typescriptlang.org",
    type: "language",
  },
  {
    name: "Tailwind CSS",
    description: "A utility-first CSS framework",
    website: "https://tailwindcss.com",
  },
  {
    name: "AWS",
    description: "Amazon Web Services - Cloud computing platform",
    website: "https://aws.amazon.com",
    type: "platform",
  },
  {
    name: "Java",
    description:
      "A statically typed, object-oriented language running on the JVM",
    website: "https://www.java.com",
    type: "language",
  },
  {
    name: "Python",
    description:
      "A dynamically typed language widely used for ML, data, and automation",
    website: "https://www.python.org",
    type: "language",
  },
  {
    name: "pnpm",
    description: "Fast, disk space efficient package manager",
    website: "https://pnpm.io",
  },
  {
    name: "Vitest",
    description: "Modern unit testing for JS/TS with a familiar Jest-style API",
    website: "https://vitest.dev",
  },
  {
    name: "shadcn/ui",
    description:
      "Beautifully designed components built with Radix UI and Tailwind CSS",
    website: "https://ui.shadcn.com",
  },
  {
    name: "GitHub",
    description: "Development platform for version control and collaboration",
    website: "https://github.com",
    type: "platform",
  },
  {
    name: "GitHub Actions",
    description:
      "A workflow automation platform integrated with GitHub repositories",
    website: "https://github.com/features/actions",
    type: "platform",
  },
  {
    name: "Terraform",
    description:
      "Infrastructure as code for building, changing, and versioning cloud resources",
    website: "https://www.terraform.io",
  },
  {
    name: "Cloudflare Pages",
    description: "JAMstack platform for frontend developers",
    website: "https://pages.cloudflare.com",
    type: "platform",
  },
  {
    name: "MDX",
    description: "Markdown for the component era",
    website: "https://mdxjs.com",
  },
  {
    name: "Shiki",
    description: "A beautiful and powerful code syntax highlighter",
    website: "https://shiki.style",
  },
  {
    name: "Fuse.js",
    description: "Lightweight, client-side, fuzzy-search library",
    website: "https://www.fusejs.io",
  },
  {
    name: "Zod",
    description: "TypeScript-first schema validation",
    website: "https://zod.dev",
    type: "library",
  },
  {
    name: "Neo4j",
    description: "Graph database management system",
    website: "https://neo4j.com",
    type: "platform",
  },
  {
    name: "Embla Carousel",
    description: "A lightweight carousel library with fluid motion",
    website: "https://www.embla-carousel.com",
  },
  {
    name: "Claude Code",
    description: "AI-powered coding assistant",
    website: "https://claude.ai",
  },
  {
    name: "Mise",
    description:
      "Tool version management, env var automation, and task execution for projects",
    website: "https://mise.jdx.dev",
  },
  {
    name: "C#",
    description: "A statically typed, object-oriented language running on .NET",
    website: "https://docs.microsoft.com/en-us/dotnet/csharp/",
    type: "language",
  },
  {
    name: "Weaviate",
    description: "Open-source vector database",
    website: "https://weaviate.io",
    type: "platform",
  },
  {
    name: "Doppler",
    description: "SecretOps platform for managing environment variables",
    website: "https://www.doppler.com",
    type: "platform",
  },
  {
    name: "Recharts",
    description: "A composable charting library built on React components",
    website: "https://recharts.org",
  },
  {
    name: "Mermaid",
    description: "JavaScript based diagramming and charting tool",
    website: "https://mermaid.js.org",
  },
  {
    name: "Lucide React",
    description: "Beautiful & consistent icon toolkit",
    website: "https://lucide.dev",
    iconSlug: "lucide",
  },
  {
    name: "Renovate",
    description: "Automated dependency updates",
    website: "https://docs.renovatebot.com",
  },
  {
    name: "CodeRabbit",
    description: "AI-powered code review assistant",
    website: "https://coderabbit.ai",
  },
  {
    name: "CLA Assistant",
    description: "Contributor License Agreement automation for GitHub",
    website: "https://cla-assistant.io",
  },
  {
    name: "Dependabot",
    description: "Automated dependency updates for GitHub",
    website: "https://github.com/dependabot",
  },
  {
    name: "CodeQL",
    description: "Semantic code analysis engine",
    website: "https://codeql.github.com",
  },
  {
    name: "Husky",
    description: "Git hooks made easy",
    website: "https://typicode.github.io/husky",
  },
  {
    name: "Turbopack",
    description: "Incremental bundler optimized for JavaScript and TypeScript",
    website: "https://turbo.build/pack",
  },
  {
    name: "CCPM",
    description: "Claude Code Project Management",
    website: "https://github.com/automazeio/ccpm/",
  },
  {
    name: "Shortcut",
    description: "Project management platform",
    website: "https://shortcut.com",
    type: "platform",
  },
  {
    name: "GitHub Secrets",
    description: "Encrypted environment variables for GitHub Actions",
    website:
      "https://docs.github.com/en/actions/security-guides/encrypted-secrets",
    iconSlug: "github",
  },
  {
    name: "Cloudflare Terraform Provider",
    website:
      "https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs",
    iconSlug: "cloudflare",
  },
  {
    name: "Cloudflare DNS",
    website: "https://www.cloudflare.com/dns",
    iconSlug: "cloudflare",
    type: "platform",
  },
  {
    name: "Cloudflare Rulesets",
    description: "Rules for transforming and routing HTTP requests at the edge",
    website: "https://developers.cloudflare.com/ruleset-engine/",
    iconSlug: "cloudflare",
    type: "platform",
  },
  {
    name: "Cloudflare Images",
    description: "Image optimization and delivery service",
    website: "https://www.cloudflare.com/products/images",
    iconSlug: "cloudflare",
    type: "platform",
  },
  {
    name: "Terraform Cloud",
    description:
      "A SaaS platform for running Terraform and managing infrastructure state",
    website: "https://www.hashicorp.com/products/terraform",
    iconSlug: "terraform",
    type: "platform",
  },
  {
    name: "Tailwind CSS Typography",
    description: "Beautiful typographic defaults for HTML you don't control",
    website: "https://github.com/tailwindlabs/tailwindcss-typography",
    iconSlug: "tailwindcss",
  },
  { name: ".NET", website: "https://dotnet.microsoft.com", type: "platform" },
  {
    name: "Ansible",
    description:
      "A tool for automating configuration, deployment, and orchestration",
    website: "https://www.ansible.com",
  },
  {
    name: "Kafka",
    description: "Distributed event streaming platform",
    website: "https://kafka.apache.org",
    iconSlug: "apachekafka",
    type: "platform",
  },
  {
    name: "Arduino",
    description:
      "Microcontroller boards and tools for building interactive electronic projects",
    website: "https://www.arduino.cc",
  },
  {
    name: "Bitbucket Pipelines",
    description: "CI/CD service built into Bitbucket",
    website: "https://bitbucket.org/product/features/pipelines",
    type: "platform",
  },
  { name: "C++", website: "https://isocpp.org", type: "language" },
  {
    name: "Cloudflare Workers",
    description: "Serverless execution environment",
    website: "https://workers.cloudflare.com",
    type: "platform",
  },
  {
    name: "DVC",
    description: "Data Version Control for machine learning projects",
    website: "https://dvc.org",
  },
  {
    name: "Docker",
    description:
      "A platform for packaging, distributing, and running applications in containers",
    website: "https://www.docker.com",
  },
  {
    name: "FastAPI",
    description: "Modern, fast web framework for building APIs with Python",
    website: "https://fastapi.tiangolo.com",
  },
  {
    name: "Fastify",
    description: "Fast and low overhead web framework for Node.js",
    website: "https://www.fastify.io",
  },
  {
    name: "Flink",
    description:
      "A distributed system for stateful, high-throughput, low-latency data processing",
    website: "https://flink.apache.org",
    iconSlug: "apacheflink",
    type: "platform",
  },
  {
    name: "GeoPandas",
    description: "Python library for working with geospatial data",
    website: "https://geopandas.org",
  },
  {
    name: "Go",
    description:
      "A statically typed, compiled language designed for simplicity and concurrency",
    website: "https://go.dev",
    type: "language",
  },
  {
    name: "Google BigQuery",
    description: "Serverless, highly scalable data warehouse",
    website: "https://cloud.google.com/bigquery",
    type: "platform",
  },
  {
    name: "Google Gemini",
    description: "A cloud-based multimodal large language model",
    website: "https://deepmind.google/technologies/gemini/",
    type: "platform",
  },
  {
    name: "Grafana",
    description: "Open source analytics and monitoring platform",
    website: "https://grafana.com",
    type: "platform",
  },
  {
    name: "Hugging Face",
    description: "AI community and model hub",
    website: "https://huggingface.co",
    type: "platform",
  },
  {
    name: "Jenkins",
    description:
      "A CI/CD platform for automating software development workflows",
    website: "https://www.jenkins.io",
    type: "platform",
  },
  {
    name: "Keras",
    description: "A Python library for designing and training neural networks",
    website: "https://keras.io",
  },
  {
    name: "Kotlin",
    description:
      "A modern JVM language blending OOP and functional programming",
    website: "https://kotlinlang.org",
    type: "language",
  },
  {
    name: "Leaflet",
    description: "A JavaScript library for interactive maps on the web",
    website: "https://leafletjs.com",
  },
  {
    name: "Node.js",
    description: "JavaScript runtime built on Chrome's V8 engine",
    website: "https://nodejs.org",
    type: "platform",
  },
  { name: "OpenAI", website: "https://openai.com", type: "platform" },
  {
    name: "OpenCV",
    description: "Open source computer vision library",
    website: "https://opencv.org",
  },
  {
    name: "OpenRouter",
    description: "Unified API for LLM inference",
    website: "https://openrouter.ai",
    type: "platform",
  },
  {
    name: "Plotly",
    description:
      "A Python (and JS) library for building interactive charts and dashboards",
    website: "https://plotly.com",
  },
  {
    name: "PostgreSQL",
    description:
      "A relational database optimized for extensibility and advanced data management",
    website: "https://www.postgresql.org",
    type: "platform",
  },
  {
    name: "Prisma",
    description: "A TypeScript and Node.js ORM",
    website: "https://www.prisma.io",
  },
  {
    name: "Prometheus",
    description: "A time-series database for collecting and querying metrics",
    website: "https://prometheus.io",
    type: "platform",
  },
  {
    name: "Pulumi",
    description: "Infrastructure as code using general-purpose languages",
    website: "https://www.pulumi.com",
  },
  {
    name: "PyTorch",
    description:
      "A Python library for designing, training, and running neural networks",
    website: "https://pytorch.org",
  },
  {
    name: "RabbitMQ",
    description: "A broker for asynchronous messaging and task distribution",
    website: "https://www.rabbitmq.com",
    type: "platform",
  },
  {
    name: "SQL",
    description: "Domain-specific language for managing relational databases",
    website: "https://en.wikipedia.org/wiki/SQL",
    type: "language",
  },
  {
    name: "SemaphoreCI",
    description:
      "A cloud-based CI/CD platform for automating software development workflows",
    website: "https://semaphoreci.com",
    iconSlug: "semaphore",
    type: "platform",
  },
  {
    name: "Stanford NLP",
    description: "Natural language processing toolkit",
    website: "https://nlp.stanford.edu/software/",
  },
  {
    name: "Swift",
    description:
      "A compiled, type-safe language for developing applications across Apple platforms",
    website: "https://www.swift.org",
    type: "language",
  },
  {
    name: "T-SQL",
    description: "Microsoft's extension of SQL",
    website: "https://docs.microsoft.com/en-us/sql/t-sql/",
    type: "language",
  },
  {
    name: "TensorRT",
    description: "SDK for high-performance deep learning inference",
    website: "https://developer.nvidia.com/tensorrt",
  },
  {
    name: "ksqlDB",
    description: "Database purpose-built for stream processing",
    website: "https://ksqldb.io",
    type: "platform",
  },
  {
    name: "spaCy",
    description: "Industrial-strength natural language processing",
    website: "https://spacy.io",
  },
  {
    name: "Shapely",
    description: "An SDK for embedded geospatial operations",
    website: "https://shapely.readthedocs.io/en/latest/",
  },
  {
    name: "OpenSlide",
    description: "An SDK for reading pathology image formats",
    website: "https://github.com/openslide/openslide-python",
  },
  {
    name: "R",
    website: "https://www.r-project.org/",
    type: "language",
  },
  {
    name: "Shiny",
    website: "https://shiny.posit.co/",
  },
  {
    name: "AWS Textract",
    description:
      "Machine learning service that automatically extracts text, handwriting, and data from scanned documents",
    website: "https://aws.amazon.com/textract/",
    type: "platform",
  },
  {
    name: "PyPika",
    description: "A Python SQL query builder",
    website: "https://github.com/kayak/pypika",
  },
];
