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

export function formatDateRange(startDate: string, endDate?: string): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const startFormatted = start.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
  });
  const endFormatted = endDate
    ? end.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      })
    : "Present";
  const duration = formatDuration(start, end);
  return `${startFormatted} - ${endFormatted} (${duration})`;
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
        "I am building real-time computer vision products for detecting identifiers in complex real-world scenarios across multiple video streams and images. I develop web services, ML pipelines and infrastructure as code, implementing comprehensive observability with Grafana Cloud (Prometheus, Tempo, Loki). I have built benchmarking tools with data version control, document analysis solutions leveraging LLMs, and internal tools in TypeScript and React. I contribute to API servers in Go and have project managed teams, driving planning and development practices.",
      responsibilities: [
        "Built real-time computer vision products for multi-stream video and image analysis, for identifier identification in complex environments",
        "Engineered ML pipelines with data version control, benchmarking infrastructure, and end-to-end observability powered by Grafana Cloud",
        "Developed web services, Terraform managed infrastructure, and LLM-powered document analysis solutions",
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
        "CLoudflare Workers",
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
        'I led our ML strategy in this pre-product-market-fit, seed-stage start-up. I built ML pipelines for training and evaluating models, experimented with 3rd party services to evaluate "build vs buy", and built PoCs to discover our desired UX. I built web services in both Python and TypeScript and contributed to iOS development. I built CI/CD pipelines and infrastructure as code.',
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
        "I designed, architected and engineered machine learning driven data streaming solutions, wearing multiple hats as software engineer, product owner, project manager and technical consultant.",
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
        "As Sonrai's ninth employee, I was central to establishing its engineering practices. I acted as the technical lead for our Data Science team, making many of our foundational architectural decisions and training our team of junior engineers. I developed computer vision models for semantic segmentation, multiple instance learning and object localisation. I engineered full machine learning pipelines, managing the scope of algorithms, data sampling, modelling, versioning and iteration.",
      responsibilities: [
        "Acted as technical lead for the Data Science team, making foundational architectural decisions and mentoring junior engineers",
        "Developed computer vision models for semantic segmentation, multiple instance learning and object localisation",
        "Engineered full machine learning pipelines, managing algorithms, data sampling, modelling, versioning and iteration",
        "Drove best practices site-wide, setting direction for MLOps, DevOps, process management and hiring practices",
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
        "I led our development of production-grade computer vision solutions, including algorithm conception, data collection and engineering, deep learning model development, developing a scalable runtime environment and integration with web applications.",
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
        "I worked on the SPAAACE project (Self-Properties Autonomic / Apoptotic / Autonomous Computing Environment), using Arduinos to create a prototype of Cubesats implementing university research on self-managing systems.",
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
        "I primarily designed, developed and tested C# code which improved auto-suggest across all platforms. I optimised large portions of the stack, carried out in-depth big data analysis on logs, and developed interactive dashboards.",
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
        "I developed a system which took the results of NLP analysis of web-pages, and generated a graph database to hold semantically related information to the web-page contents.",
      responsibilities: [
        "Developed a system integrating NLP analysis with graph database storage",
        "Built semantic relationship mapping for web-page content analysis",
        "Designed and implemented graph database schema for semantic information",
      ],
      technologies: ["Java", "Stanford NLP", "Neo4j"],
    },
  ];
}
