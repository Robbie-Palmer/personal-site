export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    // Content dates are calendar dates rather than instants. Date parses an
    // ISO date-only string at UTC midnight, so formatting in the visitor's
    // timezone can move it to the previous day and make hydration differ from
    // the server-rendered HTML.
    timeZone: "UTC",
  });
}
