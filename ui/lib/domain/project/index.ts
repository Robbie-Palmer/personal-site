// Export ONLY views and queries - NOT the domain model

// Export type enums that are part of the public API
export type { ProjectStatus } from "./Project";
export * from "./projectQueries";
export * from "./projectViews";

// Domain model is internal - only repository should import it
