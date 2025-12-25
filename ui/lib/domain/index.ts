/**
 * Domain Models and Repository Layer
 *
 * This module provides the canonical source of truth for all content types
 * in the system. It includes:
 * - TypeScript types for each domain model
 * - Zod schemas for validation
 * - Repository functions for loading and validating content
 * - Referential integrity validation
 */

// Export all domain models and types
export type {
  Technology,
  BlogPost,
  ADR,
  Project,
  JobRole,
  TechnologySlug,
  BlogSlug,
  ADRSlug,
  ProjectSlug,
  RoleSlug,
  ADRStatus,
  ProjectStatus,
  ValidationResult,
  ReferentialIntegrityError,
  DomainValidationResult,
} from "./models";

export {
  TechnologySchema,
  BlogPostSchema,
  ADRSchema,
  ProjectSchema,
  JobRoleSchema,
  TechnologySlugSchema,
  BlogSlugSchema,
  ADRSlugSchema,
  ProjectSlugSchema,
  RoleSlugSchema,
  ADRStatusSchema,
  ProjectStatusSchema,
} from "./models";

// Export repository functions
export type { DomainRepository } from "./repository";

export {
  loadTechnologies,
  validateTechnology,
  loadBlogPosts,
  validateBlogPost,
  loadProjects,
  validateProject,
  loadADRs,
  validateADR,
  loadJobRoles,
  validateJobRole,
  validateReferentialIntegrity,
  buildTechnologyRelations,
  loadDomainRepository,
} from "./repository";
