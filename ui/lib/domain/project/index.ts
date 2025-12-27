// Export ONLY views and queries - NOT the domain model
export * from "./projectViews";
export * from "./projectQueries";

// Export type enums that are part of the public API
export type { ProjectStatus } from "./Project";

// Domain model is internal - only repository should import it
