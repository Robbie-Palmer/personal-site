// Export ONLY views and queries - NOT the domain model

export * from "./roleQueries";
export * from "./roleViews";

// Domain model is internal - only repository should import it
