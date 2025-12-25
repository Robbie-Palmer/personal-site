# Domain Models & Repository Layer

This directory contains the **canonical source of truth** for all content types in the personal site system.

## 🎯 Purpose

The domain models provide:

1. **Type Safety**: TypeScript types for all content entities
2. **Validation**: Zod schemas to ensure data correctness
3. **Referential Integrity**: Automatic validation of relationships between entities
4. **Single Source of Truth**: All content structure defined in one place

## 📦 Domain Models

### Technology

Represents a technology/tool/framework used across projects, blog posts, and job roles.

```typescript
type Technology = {
  slug: string
  name: string
  description?: string
  website?: string
  brandColor?: string  // Hex color (e.g., "#61DAFB")
  iconSlug?: string

  relations: {
    blogs: BlogSlug[]      // Blog posts using this tech
    adrs: ADRSlug[]        // ADRs mentioning this tech
    projects: ProjectSlug[] // Projects using this tech
    roles: RoleSlug[]      // Job roles using this tech
  }
}
```

### BlogPost

Represents a blog post article.

```typescript
type BlogPost = {
  slug: string
  title: string
  description: string
  date: string           // YYYY-MM-DD format
  updated?: string       // YYYY-MM-DD format
  tags: string[]
  canonicalUrl?: string  // Original URL if republished
  content: string        // MDX content
  readingTime: string    // e.g., "5 min read"
  image: string          // Cloudflare Images ID
  imageAlt: string

  relations: {
    technologies: TechnologySlug[]
  }
}
```

### Project

Represents a software project with ADRs.

```typescript
type Project = {
  slug: string
  title: string
  description: string
  date: string          // YYYY-MM-DD format
  updated?: string      // YYYY-MM-DD format
  status: "idea" | "in_progress" | "live" | "archived"
  repoUrl?: string
  demoUrl?: string
  content: string       // MDX content

  relations: {
    technologies: TechnologySlug[]  // Min 1 required
    adrs: ADRSlug[]
  }
}
```

### ADR (Architecture Decision Record)

Represents an architectural decision for a project.

```typescript
type ADR = {
  slug: string
  title: string
  date: string          // YYYY-MM-DD format
  status: "Accepted" | "Rejected" | "Deprecated" | "Proposed"
  supersededBy?: string // Reference to another ADR slug
  content: string       // MDX content
  readingTime: string

  relations: {
    project: ProjectSlug
    technologies: TechnologySlug[]
  }
}
```

### JobRole

Represents a job/role in professional experience.

```typescript
type JobRole = {
  slug: string
  company: string
  companyUrl: string
  logoPath: string
  title: string
  location: string
  startDate: string     // YYYY-MM format
  endDate?: string      // YYYY-MM format (undefined = current)
  description: string
  responsibilities: string[]

  relations: {
    technologies: TechnologySlug[]
  }
}
```

## 🔧 Repository Functions

### Loading Content

```typescript
import { loadDomainRepository } from '@/lib/domain';

// Load all content and validate referential integrity
const repo = loadDomainRepository();

// Access domain entities
const tech = repo.technologies.get('react');
const blog = repo.blogs.get('my-blog-post');
const project = repo.projects.get('personal-site');
const adr = repo.adrs.get('003-next-js');
const role = repo.roles.get('microsoft-0');

// Check for errors
if (repo.referentialIntegrityErrors.length > 0) {
  console.error('Integrity errors found!');
}
```

### Individual Loaders

```typescript
import {
  loadTechnologies,
  loadBlogPosts,
  loadProjects,
  loadADRs,
  loadJobRoles,
} from '@/lib/domain';

// Load individual entity types
const technologies = loadTechnologies();
const blogs = loadBlogPosts();
const projects = loadProjects();
const adrs = loadADRs();
const roles = loadJobRoles();
```

### Validation

```typescript
import {
  validateTechnology,
  validateBlogPost,
  validateProject,
  validateADR,
  validateJobRole,
} from '@/lib/domain';

const result = validateBlogPost(data);

if (result.success) {
  console.log('Valid blog post:', result.data);
} else {
  if (result.schemaErrors) {
    console.error('Schema errors:', result.schemaErrors);
  }
  if (result.referentialErrors) {
    console.error('Referential errors:', result.referentialErrors);
  }
}
```

## 🔗 Referential Integrity

The repository layer automatically validates:

1. **Technology References**: All technology slugs referenced by blogs, projects, ADRs, and roles must exist
2. **Project References**: All projects referenced by ADRs must exist
3. **ADR References**: All ADRs referenced by projects must exist
4. **Superseded By**: All ADR supersession references must be valid

### Error Types

```typescript
type ReferentialIntegrityError = {
  type: "missing_reference" | "invalid_reference" | "circular_reference"
  entity: string        // e.g., "BlogPost[my-post]"
  field: string         // e.g., "technologies"
  value: string         // e.g., "react"
  message: string       // Human-readable error
}
```

## 📁 File Structure

```text
ui/lib/domain/
├── models.ts          # TypeScript types and Zod schemas
├── repository.ts      # Loading and validation logic
├── index.ts           # Public API exports
└── README.md          # This file
```

## 🚀 Usage in Next.js

### Server Components

```typescript
import { loadDomainRepository } from '@/lib/domain';

export default async function ProjectsPage() {
  const repo = loadDomainRepository();
  const projects = Array.from(repo.projects.values());

  return (
    <div>
      {projects.map(project => (
        <ProjectCard key={project.slug} project={project} />
      ))}
    </div>
  );
}
```

### API Routes

```typescript
import { loadDomainRepository } from '@/lib/domain';
import { NextResponse } from 'next/server';

export async function GET() {
  const repo = loadDomainRepository();

  return NextResponse.json({
    technologies: Array.from(repo.technologies.values()),
    projects: Array.from(repo.projects.values()),
  });
}
```

## 🎨 Benefits

### Before (Current Code)

- Types scattered across multiple files
- Inconsistent validation approaches
- No referential integrity checks
- Relationships maintained manually
- Tech stack duplicated in multiple places

### After (Domain Models)

✅ **Single Source of Truth**: All types in one place
✅ **Automatic Validation**: Zod ensures correctness
✅ **Referential Integrity**: Catches broken references
✅ **Bidirectional Relations**: Technologies know what uses them
✅ **Type Safety**: Full TypeScript coverage
✅ **Maintainable**: Easy to extend and modify

## 🔄 Migration Path

The domain models are designed to coexist with existing code. You can:

1. **Keep existing code**: Continue using `lib/blog.ts`, `lib/projects.ts`, etc.
2. **Gradually migrate**: Move components to use domain models one at a time
3. **Use both**: Domain models for new features, existing code for legacy

### Example Migration

```typescript
// Old way
import { getAllPosts } from '@/lib/blog';
const posts = await getAllPosts();

// New way
import { loadDomainRepository } from '@/lib/domain';
const repo = loadDomainRepository();
const posts = Array.from(repo.blogs.values());
```

## 📝 Extending the Domain

### Adding a New Entity Type

1. Define the type and Zod schema in `models.ts`
2. Add loader and validator functions in `repository.ts`
3. Update referential integrity validation
4. Export from `index.ts`

### Adding a New Field

1. Update the Zod schema in `models.ts`
2. Update the loader in `repository.ts`
3. TypeScript will catch all places that need updates

## 🧪 Testing

The domain models make testing easier:

```typescript
import { validateProject, ProjectSchema } from '@/lib/domain';

test('validates project with missing title', () => {
  const result = validateProject({
    slug: 'test',
    // missing title
  });

  expect(result.success).toBe(false);
  expect(result.schemaErrors).toBeDefined();
});
```

## 🔒 Type Safety

All slug types are branded for maximum type safety:

```typescript
type TechnologySlug = string;  // Can't mix with BlogSlug
type BlogSlug = string;
type ProjectSlug = string;
// etc.
```

This prevents accidental misuse:

```typescript
const tech: TechnologySlug = 'react';
const blog: BlogSlug = tech;  // ❌ Type error!
```

## 📚 Further Reading

- [Zod Documentation](https://zod.dev)
- [Domain-Driven Design](https://martinfowler.com/tags/domain%20driven%20design.html)
- [Repository Pattern](https://martinfowler.com/eaaCatalog/repository.html)
