/**
 * Public API for the domain layer
 *
 * UI code should ONLY import from this file or specific domain folders
 * NEVER import directly from domain models (Technology.ts, Project.ts, etc.)
 */

// Views and queries - the public API
export * from "./technology";
export * from "./project";
export * from "./blog";
export * from "./adr";
export * from "./role";

// Repository interface and loading function
export { loadDomainRepository, type DomainRepository } from "./repository";
