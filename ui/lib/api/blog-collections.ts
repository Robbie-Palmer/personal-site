import type { BlogPost } from "./blog";
import { getAllPosts, getPostBySlug } from "./blog";

export type PostSource =
  | { type: "all" }
  | { type: "curated"; slugs: string[] }
  | { type: "tags"; tags: string[]; limit?: number }
  | { type: "query"; queryFn: () => BlogPost[] };

export interface BlogCollection {
  title: string;
  source: PostSource;
}

export interface BlogCollectionWithId extends BlogCollection {
  id: string;
}

export const blogCollections: Record<string, BlogCollection> = {
  all: {
    title: "All Posts",
    source: {
      type: "all",
    },
  },
  technology: {
    title: "Technology",
    source: {
      type: "tags",
      tags: ["software", "machine-learning", "data-science"],
    },
  },
  philosophy: {
    title: "Philosophy",
    source: {
      type: "tags",
      tags: ["philosophy"],
    },
  },
  finance: {
    title: "Finance",
    source: {
      type: "tags",
      tags: ["investing", "personal-finance"],
    },
  },
};

export function getCollectionsWithIds(): BlogCollectionWithId[] {
  return Object.entries(blogCollections).map(([id, collection]) => ({
    id,
    ...collection,
  }));
}

/**
 * Fetches posts for a collection based on its source configuration.
 * This runs at build time for SSG, so it's synchronous.
 *
 * @param collectionId - The ID of the collection to fetch posts for
 * @returns Array of BlogPost objects
 */
export function getCollectionPosts(collectionId: string): BlogPost[] {
  const collection = blogCollections[collectionId];
  if (!collection) {
    throw new Error(`Collection not found: ${collectionId}`);
  }

  const { source } = collection;
  const allPosts = getAllPosts();

  switch (source.type) {
    case "curated": {
      // Return posts in the order specified by slugs
      return source.slugs
        .map((slug) => {
          try {
            return getPostBySlug(slug);
          } catch (error) {
            console.warn(`Post not found for slug: ${slug}`, error);
            return null;
          }
        })
        .filter((p): p is BlogPost => p !== null);
    }
    case "tags": {
      const filtered = allPosts.filter((p) =>
        p.tags.some((tag) => source.tags.includes(tag)),
      );
      return source.limit ? filtered.slice(0, source.limit) : filtered;
    }
    case "all": {
      return allPosts;
    }
    case "query": {
      return source.queryFn();
    }
    default:
      return [];
  }
}
