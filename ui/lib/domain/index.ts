/**
 * Public API for the domain layer
 *
 * UI code should ONLY import from this file or specific domain folders
 * NEVER import directly from domain models (Technology.ts, Project.ts, etc.)
 */

export * from "./adr";
export * from "./blog";
export * from "./project";
// Repository interface and loading function
export { type DomainRepository, loadDomainRepository } from "./repository";
export * from "./role";
// Views and queries - the public API
export * from "./technology";
