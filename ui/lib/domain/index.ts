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
  ADR,
  ADRSlug,
  ADRStatus,
  BlogPost,
  BlogSlug,
  DomainValidationResult,
  JobRole,
  Project,
  ProjectSlug,
  ProjectStatus,
  ReferentialIntegrityError,
  RoleSlug,
  Technology,
  TechnologySlug,
  ValidationResult,
} from "./models";

export {
  ADRSchema,
  ADRSlugSchema,
  ADRStatusSchema,
  BlogPostSchema,
  BlogSlugSchema,
  JobRoleSchema,
  ProjectSchema,
  ProjectSlugSchema,
  ProjectStatusSchema,
  RoleSlugSchema,
  TechnologySchema,
  TechnologySlugSchema,
} from "./models";

// Export repository functions
export type { DomainRepository } from "./repository";

export {
  buildTechnologyRelations,
  loadADRs,
  loadBlogPosts,
  loadDomainRepository,
  loadJobRoles,
  loadProjects,
  loadTechnologies,
  validateADR,
  validateBlogPost,
  validateJobRole,
  validateProject,
  validateReferentialIntegrity,
  validateTechnology,
} from "./repository";
