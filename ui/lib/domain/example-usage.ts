/**
 * Example Usage of Domain Models and Repository Layer
 *
 * This file demonstrates how to use the domain models in various scenarios.
 * You can run this file to test the repository layer.
 */

import {
  loadADRs,
  loadBlogPosts,
  loadDomainRepository,
  loadJobRoles,
  loadProjects,
  loadTechnologies,
  type Technology,
  validateTechnology,
} from "./index";

// ============================================================================
// Example 1: Load All Content
// ============================================================================

export function example1_loadAllContent() {
  console.log("📦 Example 1: Loading all content...\n");

  const repo = loadDomainRepository();

  console.log(`✅ Loaded ${repo.technologies.size} technologies`);
  console.log(`✅ Loaded ${repo.blogs.size} blog posts`);
  console.log(`✅ Loaded ${repo.projects.size} projects`);
  console.log(`✅ Loaded ${repo.adrs.size} ADRs`);
  console.log(`✅ Loaded ${repo.roles.size} job roles`);

  if (repo.referentialIntegrityErrors.length === 0) {
    console.log("\n✨ All referential integrity checks passed!\n");
  } else {
    console.error("\n❌ Referential integrity errors found:");
    repo.referentialIntegrityErrors.forEach((err) => {
      console.error(`  - ${err.message}`);
    });
  }

  return repo;
}

// ============================================================================
// Example 2: Query Technologies
// ============================================================================

export function example2_queryTechnologies() {
  console.log("🔍 Example 2: Querying technologies...\n");

  const technologies = loadTechnologies();

  // Find React
  const react = technologies.get("react");
  if (react) {
    console.log("Found React:");
    console.log(`  Name: ${react.name}`);
    console.log(`  Website: ${react.website || "N/A"}`);
    console.log(`  Used in ${react.relations.projects.length} projects`);
    console.log(`  Used in ${react.relations.adrs.length} ADRs`);
    console.log(`  Used in ${react.relations.roles.length} job roles`);
    console.log(`  Mentioned in ${react.relations.blogs.length} blogs\n`);
  }

  // List all technologies
  console.log(`All technologies (${technologies.size} total):`);
  Array.from(technologies.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((tech) => {
      const usageCount =
        tech.relations.projects.length +
        tech.relations.adrs.length +
        tech.relations.roles.length +
        tech.relations.blogs.length;
      console.log(`  - ${tech.name} (used ${usageCount} times)`);
    });

  console.log();
}

// ============================================================================
// Example 3: Query Projects with ADRs
// ============================================================================

export function example3_queryProjects() {
  console.log("📁 Example 3: Querying projects...\n");

  const projects = loadProjects();
  const adrs = loadADRs();

  projects.forEach((project) => {
    console.log(`Project: ${project.title}`);
    console.log(`  Slug: ${project.slug}`);
    console.log(`  Status: ${project.status}`);
    console.log(`  Technologies: ${project.relations.technologies.join(", ")}`);
    console.log(`  ADRs (${project.relations.adrs.length}):`);

    project.relations.adrs.forEach((adrSlug) => {
      const adr = adrs.get(adrSlug);
      if (adr) {
        console.log(`    - ${adr.title} (${adr.status})`);
      }
    });

    console.log();
  });
}

// ============================================================================
// Example 4: Query Blog Posts
// ============================================================================

export function example4_queryBlogs() {
  console.log("📝 Example 4: Querying blog posts...\n");

  const blogs = loadBlogPosts();

  console.log(`Total blog posts: ${blogs.size}\n`);

  // Sort by date (newest first)
  const sortedBlogs = Array.from(blogs.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  sortedBlogs.forEach((blog) => {
    console.log(`${blog.date} - ${blog.title}`);
    console.log(`  Tags: ${blog.tags.join(", ")}`);
    console.log(`  Reading time: ${blog.readingTime}`);
    if (blog.canonicalUrl) {
      console.log(`  Originally published at: ${blog.canonicalUrl}`);
    }
    console.log();
  });
}

// ============================================================================
// Example 5: Query Job Roles
// ============================================================================

export function example5_queryJobRoles() {
  console.log("💼 Example 5: Querying job roles...\n");

  const roles = loadJobRoles();

  // Sort by start date (newest first)
  const sortedRoles = Array.from(roles.values()).sort((a, b) => {
    return b.startDate.localeCompare(a.startDate);
  });

  sortedRoles.forEach((role) => {
    const period = role.endDate
      ? `${role.startDate} to ${role.endDate}`
      : `${role.startDate} to Present`;

    console.log(`${role.company} - ${role.title}`);
    console.log(`  Period: ${period}`);
    console.log(`  Location: ${role.location}`);
    console.log(`  Technologies: ${role.relations.technologies.join(", ")}`);
    console.log();
  });
}

// ============================================================================
// Example 6: Validate Custom Data
// ============================================================================

export function example6_validateCustomData() {
  console.log("✅ Example 6: Validating custom data...\n");

  // Valid technology
  const validTech: Technology = {
    slug: "custom-tech",
    name: "Custom Technology",
    description: "A custom technology for testing",
    website: "https://example.com",
    brandColor: "#FF6B6B",
    iconSlug: "custom",
    relations: {
      blogs: [],
      adrs: [],
      projects: [],
      roles: [],
    },
  };

  const result = validateTechnology(validTech);
  if (result.success) {
    console.log("✅ Valid technology validated successfully");
  } else {
    console.error("❌ Validation failed:", result.schemaErrors);
  }

  // Invalid technology (bad color format)
  const invalidTech = {
    slug: "bad-tech",
    name: "Bad Technology",
    brandColor: "red", // Should be hex format
    relations: {
      blogs: [],
      adrs: [],
      projects: [],
      roles: [],
    },
  };

  const result2 = validateTechnology(invalidTech);
  if (!result2.success) {
    console.log(
      "\n✅ Invalid technology correctly rejected (bad brandColor format)",
    );
  }

  console.log();
}

// ============================================================================
// Example 7: Find Technology Usage
// ============================================================================

export function example7_findTechnologyUsage(techSlug: string) {
  console.log(`🔎 Example 7: Finding usage of '${techSlug}'...\n`);

  const repo = loadDomainRepository();
  const tech = repo.technologies.get(techSlug.toLowerCase());

  if (!tech) {
    console.log(`❌ Technology '${techSlug}' not found\n`);
    return;
  }

  console.log(`Technology: ${tech.name}`);
  if (tech.website) {
    console.log(`Website: ${tech.website}`);
  }
  console.log();

  // Projects using this tech
  if (tech.relations.projects.length > 0) {
    console.log(`Projects (${tech.relations.projects.length}):`);
    tech.relations.projects.forEach((projectSlug) => {
      const project = repo.projects.get(projectSlug);
      if (project) {
        console.log(`  - ${project.title} (${project.status})`);
      }
    });
    console.log();
  }

  // ADRs mentioning this tech
  if (tech.relations.adrs.length > 0) {
    console.log(`ADRs (${tech.relations.adrs.length}):`);
    tech.relations.adrs.forEach((adrSlug) => {
      const adr = repo.adrs.get(adrSlug);
      if (adr) {
        console.log(`  - ${adr.title} (${adr.status})`);
      }
    });
    console.log();
  }

  // Job roles using this tech
  if (tech.relations.roles.length > 0) {
    console.log(`Job Roles (${tech.relations.roles.length}):`);
    tech.relations.roles.forEach((roleSlug) => {
      const role = repo.roles.get(roleSlug);
      if (role) {
        console.log(`  - ${role.title} at ${role.company}`);
      }
    });
    console.log();
  }

  // Blog posts mentioning this tech
  if (tech.relations.blogs.length > 0) {
    console.log(`Blog Posts (${tech.relations.blogs.length}):`);
    tech.relations.blogs.forEach((blogSlug) => {
      const blog = repo.blogs.get(blogSlug);
      if (blog) {
        console.log(`  - ${blog.title}`);
      }
    });
    console.log();
  }

  const totalUsage =
    tech.relations.projects.length +
    tech.relations.adrs.length +
    tech.relations.roles.length +
    tech.relations.blogs.length;

  console.log(`📊 Total references: ${totalUsage}\n`);
}

// ============================================================================
// Example 8: Get Project with Full Details
// ============================================================================

export function example8_getProjectDetails(projectSlug: string) {
  console.log(`📦 Example 8: Getting details for '${projectSlug}'...\n`);

  const repo = loadDomainRepository();
  const project = repo.projects.get(projectSlug);

  if (!project) {
    console.log(`❌ Project '${projectSlug}' not found\n`);
    return;
  }

  console.log(`Project: ${project.title}`);
  console.log(`Description: ${project.description}`);
  console.log(`Status: ${project.status}`);
  console.log(`Date: ${project.date}`);
  if (project.updated) {
    console.log(`Updated: ${project.updated}`);
  }
  if (project.repoUrl) {
    console.log(`Repository: ${project.repoUrl}`);
  }
  if (project.demoUrl) {
    console.log(`Demo: ${project.demoUrl}`);
  }
  console.log();

  // Technologies
  console.log(`Technologies (${project.relations.technologies.length}):`);
  project.relations.technologies.forEach((techSlug) => {
    const tech = repo.technologies.get(techSlug);
    if (tech) {
      console.log(`  - ${tech.name}`);
      if (tech.website) {
        console.log(`    ${tech.website}`);
      }
    }
  });
  console.log();

  // ADRs
  console.log(
    `Architecture Decision Records (${project.relations.adrs.length}):`,
  );
  project.relations.adrs.forEach((adrSlug) => {
    const adr = repo.adrs.get(adrSlug);
    if (adr) {
      console.log(`  - ${adr.title}`);
      console.log(`    Status: ${adr.status}, Date: ${adr.date}`);
      if (adr.supersededBy) {
        console.log(`    Superseded by: ${adr.supersededBy}`);
      }
    }
  });
  console.log();
}

// ============================================================================
// Run All Examples
// ============================================================================

if (require.main === module) {
  console.log("🚀 Running Domain Models Examples\n");
  console.log("=".repeat(80));
  console.log();

  try {
    example1_loadAllContent();
    console.log("=".repeat(80));
    console.log();

    example2_queryTechnologies();
    console.log("=".repeat(80));
    console.log();

    example3_queryProjects();
    console.log("=".repeat(80));
    console.log();

    example4_queryBlogs();
    console.log("=".repeat(80));
    console.log();

    example5_queryJobRoles();
    console.log("=".repeat(80));
    console.log();

    example6_validateCustomData();
    console.log("=".repeat(80));
    console.log();

    example7_findTechnologyUsage("react");
    console.log("=".repeat(80));
    console.log();

    example8_getProjectDetails("personal-site");
    console.log("=".repeat(80));
    console.log();

    console.log("✨ All examples completed successfully!");
  } catch (error) {
    console.error("❌ Error running examples:", error);
    process.exit(1);
  }
}
