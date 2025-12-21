export interface Experience {
  company: string;
  company_url: string;
  logo_path: string;
  title: string;
  location: string;
  startDate: string; // YYYY-MM format
  endDate?: string; // YYYY-MM format, undefined for current role
  description: string;
  responsibilities: string[];
  technologies: string[];
}

import { normalizeSlug } from "@/lib/slugs";

export function getExperienceSlug(experience: Experience): string {
  return normalizeSlug(experience.company);
}

function parseDateString(dateStr: string): Date {
  const [yearStr, monthStr] = dateStr.split("-");
  if (!yearStr || !monthStr) {
    throw new Error(
      `Invalid date format: ${dateStr}. Expected YYYY-MM format.`,
    );
  }
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  return new Date(Date.UTC(year, month - 1, 1));
}

export function formatExperienceDateRange(
  startDate: string,
  endDate?: string,
): string {
  const start = parseDateString(startDate);
  const end = endDate ? parseDateString(endDate) : new Date();
  const startFormatted = start.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const endFormatted = endDate
    ? end.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "Present";
  return `${startFormatted} - ${endFormatted}`;
}

export function getExperienceDuration(
  startDate: string,
  endDate?: string,
): string {
  const start = parseDateString(startDate);
  const end = endDate ? parseDateString(endDate) : new Date();
  return formatDuration(start, end);
}

/**
 * @deprecated Use formatExperienceDateRange and getExperienceDuration separately
 */
export function formatDateRange(startDate: string, endDate?: string): string {
  const range = formatExperienceDateRange(startDate, endDate);
  const duration = getExperienceDuration(startDate, endDate);
  return `${range} (${duration})`;
}

function formatDuration(start: Date, end: Date): string {
  // Add 1 to make the calculation inclusive of both start and end months
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) {
    return `${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`;
  }
  if (remainingMonths === 0) {
    return `${years} ${years === 1 ? "year" : "years"}`;
  }
  return `${years} ${years === 1 ? "year" : "years"}, ${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`;
}

export function getAllExperience(): Experience[] {
  return [
    {
      company: "Terminal Industries",
      company_url: "https://terminal-industries.com/",
      logo_path: "/company-logos/terminal-industries.png",
      title: "Principal Software Engineer",
      location: "Belfast, UK",
      startDate: "2024-05",
      description:
        "Building real-time computer vision products and ML pipelines, while driving engineering practices for a startup transitioning from pre-product to production.",
      responsibilities: [
        "Built real-time computer vision products for multi-stream video and image analysis, for identifier identification in complex environments",
        "Engineered ML pipelines with data version control, benchmarking infrastructure, and end-to-end observability powered by Grafana Cloud (Prometheus, Loki, Tempo)",
        "Developed web services, Terraform managed infrastructure, and LLM-powered document analysis solutions",
        "Built internal tools in TypeScript and React, and contributed to API servers in Go",
        "Project managed cross-functional teams and drove agile development practices that accelerated time-to-market",
        "Was pivotal in transitioning from pre-product to production, delivering the MVP to market and establishing lean engineering practices for rapid iteration",
      ],
      technologies: [
        "Python",
        "Terraform",
        "Grafana",
        "Prometheus",
        "DVC",
        "Google Gemini",
        "TypeScript",
        "GitHub Actions",
        "TensorRT",
        "Go",
        "AWS",
        "OpenRouter",
        "Cloudflare Workers",
        "Leaflet",
      ],
    },
    {
      company: "Bestomer",
      company_url: "https://bestomer.com/",
      logo_path: "/company-logos/bestomer.png",
      title: "Machine Learning Lead",
      location: "Remote, UK",
      startDate: "2023-05",
      endDate: "2024-02",
      description:
        "Led ML strategy at a seed-stage startup, building pipelines, evaluating build-vs-buy decisions, and developing full-stack prototypes.",
      responsibilities: [
        "Led ML strategy and built end-to-end ML pipelines for training, evaluation, and deployment",
        "Optimized, evaluated, and integrated ML models powering semantic search, image similarity search, invoice extraction, product detection, and RAG-based chatbots",
        "Developed backend services in Python and TypeScript and contributed to iOS application development",
        "Assessed third-party services to inform build-vs-buy decisions through rapid experimentation",
        "Built CI/CD pipelines and implemented infrastructure as code to streamline deployment and operations",
      ],
      technologies: [
        "TypeScript",
        "Node.js",
        "Fastify",
        "Prisma",
        "Postgresql",
        "Weaviate",
        "Python",
        "FastAPI",
        "Pulumi",
        "AWS",
        "GitHub Actions",
        "DVC",
        "Swift",
        "Hugging Face",
        "OpenRouter",
        "Google Gemini",
        "OpenAI",
      ],
    },
    {
      company: "Confluent",
      company_url: "https://confluent.io/",
      logo_path: "/company-logos/confluent.png",
      title: "Customer Innovation Engineer II",
      location: "Belfast, UK",
      startDate: "2022-04",
      endDate: "2023-05",
      description:
        "Designed and built ML-driven data streaming solutions, wearing multiple hats across engineering, product, and customer-facing roles.",
      responsibilities: [
        "Designed and engineered machine-learning-driven data-streaming solutions",
        "Acted as software engineer, product owner, project manager and technical consultant",
        "Built high-performance stream-processing applications and extensions for ksqlDB and Kafka Connect",
        "Developed real-time PII-redaction capabilities using NLP for low-latency data streams",
        "Leveraged open-source software contributions to establish a strategic partnership with Microsoft",
        "Aided pre-sales and marketing momentum via customer discovery calls, blog posts, and conference booth representation",
      ],
      technologies: [
        "Apache Kafka",
        "Kotlin",
        "Python",
        "Google BigQuery",
        "spaCy",
        "SemaphoreCI",
        "DVC",
      ],
    },
    {
      company: "Sonrai Analytics",
      company_url: "https://sonraianalytics.com/",
      logo_path: "/company-logos/sonrai-analytics.png",
      title: "Senior Machine Learning Engineer",
      location: "Belfast, UK",
      startDate: "2020-03",
      endDate: "2022-04",
      description:
        "Technical lead for Data Science at an early-stage health-tech startup, shaping engineering practices and building computer vision pipelines for pathology.",
      responsibilities: [
        "Acted as technical lead for the Data Science team, making foundational architectural decisions and mentoring junior engineers",
        "Developed computer vision models for semantic segmentation, multiple instance learning and object localisation",
        "Engineered full machine learning pipelines, managing algorithms, data sampling, modelling, versioning and iteration",
        "As the 9th employee, drove best practices site-wide, setting direction for MLOps, DevOps, process management and hiring practices",
        "Developed libraries which massively accelerated development, reducing the development time of a new app from weeks to a day",
        "Led research and engineering for a microsatellite instability classification initiative that secured millions in NHS funding",
      ],
      technologies: [
        "Python",
        "PyTorch",
        "FastAPI",
        "Plotly",
        "Leaflet",
        "Docker",
        "AWS",
        "Bitbucket Pipelines",
        "DVC",
        "GeoPandas",
      ],
    },
    {
      company: "Philips",
      company_url:
        "https://www.philips.co.uk/healthcare/specialty/health-informatics",
      logo_path: "/company-logos/philips.png",
      title:
        "Graduate Software Engineer → Software Engineer → Senior Software Engineer",
      location: "Belfast, UK",
      startDate: "2017-07",
      endDate: "2020-03",
      description:
        "Led development of production-grade computer vision for computational pathology, from algorithm design through to scalable deployment.",
      responsibilities: [
        "Led development of production-grade computer vision solutions for computational pathology",
        "Drove algorithm conception, data collection and engineering, and deep learning model development",
        "Developed scalable runtime environments and integrated with web applications",
        "Advanced from Graduate Software Engineer (2017) to Senior Software Engineer (2019) through accelerated performance and impact",
      ],
      technologies: [
        "Python",
        "OpenCV",
        "Keras",
        "Docker",
        "Jenkins",
        "RabbitMQ",
        "Ansible",
      ],
    },
    {
      company: "Ulster University",
      company_url: "https://www.ulster.ac.uk/",
      logo_path: "/company-logos/ulster-university.png",
      title: "Research Assistant / Software Engineer Summer Intern",
      location: "Belfast, UK",
      startDate: "2016-07",
      endDate: "2016-09",
      description:
        "Built Arduino-based CubeSat prototypes implementing university research on self-managing autonomous systems.",
      responsibilities: [
        "Worked on SPAAACE project developing self-managing systems for CubeSats",
        "Built Arduino-based prototypes implementing autonomic computing principles",
        "Translated academic research into working embedded systems prototypes",
      ],
      technologies: ["Arduino", "C++"],
    },
    {
      company: "Microsoft",
      company_url: "https://www.microsoft.com/",
      logo_path: "/company-logos/microsoft.png",
      title: "Software Development Intern",
      location: "London, UK",
      startDate: "2015-07",
      endDate: "2016-06",
      description:
        "Improved Bing auto-suggest across all platforms through code optimization, big data analysis, and interactive dashboards.",
      responsibilities: [
        "Designed, developed and tested C# code improving auto-suggest across all platforms",
        "Optimised large portions of the Bing search stack for performance",
        "Carried out in-depth big data analysis on logs to inform optimization decisions",
        "Developed interactive dashboards for monitoring and analysis",
      ],
      technologies: ["C#", ".NET", "T-SQL"],
    },
    {
      company: "Infosys",
      company_url: "https://www.infosys.com/",
      logo_path: "/company-logos/infosys.png",
      title: "Software Development Intern",
      location: "Pune, India",
      startDate: "2014-06",
      endDate: "2014-09",
      description:
        "Built an NLP-powered system that generated graph databases from semantic analysis of web content.",
      responsibilities: [
        "Developed a system integrating NLP analysis with graph database storage",
        "Built semantic relationship mapping for web-page content analysis",
        "Designed and implemented graph database schema for semantic information",
      ],
      technologies: ["Java", "Stanford NLP", "Neo4j"],
    },
  ];
}
