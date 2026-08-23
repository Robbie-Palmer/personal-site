import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  gte,
  isNotNull,
  lt,
  lte,
  or,
} from "drizzle-orm";
import type { Db } from "recipe-db";
import * as schema from "recipe-db/schema";
import { z } from "zod";

export type CookingLogCursor = Readonly<{
  completedAt: string;
  id: string;
}>;

export type CookingLogQuery = Readonly<{
  from: Date;
  to: Date;
  limit: number;
  cursor?: CookingLogCursor;
}>;

const cookingLogCursorSchema = z
  .object({
    completedAt: z.iso.datetime({ offset: true }),
    id: z.uuid(),
  })
  .strict();

export function encodeCookingLogCursor(cursor: CookingLogCursor): string {
  let encoded = btoa(JSON.stringify(cursor))
    .replaceAll("+", "-")
    .replaceAll("/", "_");
  while (encoded.endsWith("=")) encoded = encoded.slice(0, -1);
  return encoded;
}

export function decodeCookingLogCursor(
  value: string | undefined,
): CookingLogCursor | undefined {
  if (!value) return undefined;
  try {
    let base64 = value.replaceAll("-", "+").replaceAll("_", "/");
    while (base64.length % 4 !== 0) base64 += "=";
    const parsed = cookingLogCursorSchema.safeParse(JSON.parse(atob(base64)));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export async function cookingInsightsResponse(db: Db, userId: string) {
  const [summaries, recent] = await Promise.all([
    db
      .select({
        cookModeStarts: count(),
        mealsCooked: count(schema.cookingSession.completedAt),
      })
      .from(schema.cookingSession)
      .where(eq(schema.cookingSession.userId, userId)),
    db
      .select({
        id: schema.cookingSession.id,
        recipeSlug: schema.cookingSession.recipeSlug,
        recipeTitle: schema.cookingSession.recipeTitle,
        servings: schema.cookingSession.servings,
        startedAt: schema.cookingSession.startedAt,
        completedAt: schema.cookingSession.completedAt,
      })
      .from(schema.cookingSession)
      .where(
        and(
          eq(schema.cookingSession.userId, userId),
          isNotNull(schema.cookingSession.completedAt),
        ),
      )
      .orderBy(desc(schema.cookingSession.completedAt))
      .limit(20),
  ]);
  const summary = summaries[0];

  // count(column) excludes NULL; distinct recipes need their own completed-only
  // query because the slug itself is present on incomplete starts too.
  const [completedDistinct] = await db
    .select({
      count: countDistinct(schema.cookingSession.recipeSlug),
    })
    .from(schema.cookingSession)
    .where(
      and(
        eq(schema.cookingSession.userId, userId),
        isNotNull(schema.cookingSession.completedAt),
      ),
    );

  return {
    cookModeStarts: summary?.cookModeStarts ?? 0,
    mealsCooked: summary?.mealsCooked ?? 0,
    distinctRecipesCooked: completedDistinct?.count ?? 0,
    recent,
  };
}

export async function cookingLogResponse(
  db: Db,
  userId: string,
  query: CookingLogQuery,
) {
  const cursorDate = query.cursor
    ? new Date(query.cursor.completedAt)
    : undefined;
  const cursorFilter =
    query.cursor && cursorDate
      ? or(
          lt(schema.cookingSession.completedAt, cursorDate),
          and(
            eq(schema.cookingSession.completedAt, cursorDate),
            lt(schema.cookingSession.id, query.cursor.id),
          ),
        )
      : undefined;

  const rows = await db
    .select({
      id: schema.cookingSession.id,
      recipeSlug: schema.cookingSession.recipeSlug,
      recipeTitle: schema.cookingSession.recipeTitle,
      servings: schema.cookingSession.servings,
      completedAt: schema.cookingSession.completedAt,
    })
    .from(schema.cookingSession)
    .where(
      and(
        eq(schema.cookingSession.userId, userId),
        isNotNull(schema.cookingSession.completedAt),
        gte(schema.cookingSession.completedAt, query.from),
        lte(schema.cookingSession.completedAt, query.to),
        cursorFilter,
      ),
    )
    .orderBy(
      desc(schema.cookingSession.completedAt),
      desc(schema.cookingSession.id),
    )
    .limit(query.limit + 1);

  const items = rows.slice(0, query.limit).map((row) => ({
    ...row,
    completedAt: row.completedAt as Date,
  }));
  const last = items.at(-1);

  return {
    items,
    nextCursor:
      rows.length > query.limit && last
        ? encodeCookingLogCursor({
            completedAt: last.completedAt.toISOString(),
            id: last.id,
          })
        : null,
  };
}
