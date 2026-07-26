export type SharePlatform = "x" | "linkedin" | "hackernews";

export interface ShareTarget {
  url: string;
  title: string;
}

export function getShareUrl(
  platform: SharePlatform,
  { url, title }: ShareTarget,
): string {
  switch (platform) {
    // `intent/tweet` rather than `intent/post`: despite the rebrand, only
    // `tweet` is documented, and `post` bounces between the X app and the
    // in-app browser on iOS and Android instead of opening the composer.
    case "x":
      return `https://x.com/intent/tweet?${new URLSearchParams({
        url,
        text: title,
      }).toString()}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams(
        { url },
      ).toString()}`;
    case "hackernews":
      return `https://news.ycombinator.com/submitlink?${new URLSearchParams({
        u: url,
        t: title,
      }).toString()}`;
  }
}
