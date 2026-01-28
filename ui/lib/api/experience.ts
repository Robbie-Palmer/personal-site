import { experiences } from "@/content/experience";
import type { JobRoleContent } from "@/lib/domain/role/jobRole";
import { normalizeSlug } from "@/lib/generic/slugs";

export type Experience = JobRoleContent;

export function getExperienceSlug(experience: Experience): string {
  return normalizeSlug(experience.company);
}

function parseDateString(dateStr: string): Date {
  const [yearStr, monthStr] = dateStr.split("-");
  if (!yearStr || !monthStr) {
    throw new Error(
      `Invalid date format: ${dateStr}. Expected YYYY-MM format.`,
    );
  }
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  return new Date(Date.UTC(year, month - 1, 1));
}

export function formatExperienceDateRange(
  startDate: string,
  endDate?: string,
): string {
  const start = parseDateString(startDate);
  const end = endDate ? parseDateString(endDate) : new Date();
  const startFormatted = start.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  const endFormatted = endDate
    ? end.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    : "Present";
  return `${startFormatted} - ${endFormatted}`;
}

export function getExperienceDuration(
  startDate: string,
  endDate?: string,
): string {
  const start = parseDateString(startDate);
  const end = endDate ? parseDateString(endDate) : new Date();
  return formatDuration(start, end);
}

/**
 * @deprecated Use formatExperienceDateRange and getExperienceDuration separately
 */
export function formatDateRange(startDate: string, endDate?: string): string {
  const range = formatExperienceDateRange(startDate, endDate);
  const duration = getExperienceDuration(startDate, endDate);
  return `${range} (${duration})`;
}

function formatDuration(start: Date, end: Date): string {
  // Add 1 to make the calculation inclusive of both start and end months
  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) {
    return `${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`;
  }
  if (remainingMonths === 0) {
    return `${years} ${years === 1 ? "year" : "years"}`;
  }
  return `${years} ${years === 1 ? "year" : "years"}, ${remainingMonths} ${remainingMonths === 1 ? "month" : "months"}`;
}

export function getAllExperience(): Experience[] {
  return experiences;
}
