import { and, eq } from "drizzle-orm";
import { createDb, schema } from "recipe-db";
import { SavedRecipePayloadSchema } from "recipe-domain";
import { canonicalizeSavedRecipeCookware } from "./canonicalize-cookware-recipe";

// Existing recipes predate the canonical equipment registry, so their equipment
// filters carry the wording each recipe happened to use — "fork" and "forks",
// "baking dish" and "baking tin" and "baking tray". This backfill resolves each
// recipe's cookware the same way the ingest pipeline now does, moving the
// structured equipment list to the canonical name while keeping the authored
// wording in the prose. Runs read-only by default; pass --apply to write.

const APPLY = process.argv.includes("--apply");

function requiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} is required`);
	return value;
}

const { db, client } = createDb(requiredEnv("DATABASE_URL"));

let scanned = 0;
let skipped = 0;
let changed = 0;
let conflicts = 0;

try {
	const recipes = await db
		.select({
			id: schema.recipe.id,
			slug: schema.recipe.slug,
			body: schema.recipe.body,
		})
		.from(schema.recipe);

	for (const record of recipes) {
		scanned += 1;
		if (!record.body) continue;

		let json: unknown;
		try {
			json = JSON.parse(record.body);
		} catch {
			skipped += 1;
			console.warn(`skip ${record.slug}: body is not valid JSON`);
			continue;
		}

		const parsed = SavedRecipePayloadSchema.safeParse(json);
		if (!parsed.success) {
			skipped += 1;
			console.warn(`skip ${record.slug}: body is not a valid saved recipe`);
			continue;
		}

		const result = canonicalizeSavedRecipeCookware(parsed.data);
		if (!result.changed) continue;

		changed += 1;
		console.log(`\n${record.slug}`);
		console.log(
			`  equipment: [${result.cookwareBefore.join(", ")}] -> [${result.cookwareAfter.join(", ")}]`,
		);
		for (const [authored, canonical] of result.replacements) {
			console.log(`  token: #${authored} -> #${canonical}|${authored}`);
		}

		if (!APPLY) continue;

		// Guard against a recipe edited between the scan and this write: match the
		// body we transformed, so a concurrent edit is reported rather than
		// silently overwritten with our stale copy.
		const written = await db
			.update(schema.recipe)
			.set({ body: JSON.stringify(result.payload) })
			.where(
				and(
					eq(schema.recipe.id, record.id),
					eq(schema.recipe.body, record.body),
				),
			)
			.returning({ id: schema.recipe.id });
		if (written.length === 0) {
			conflicts += 1;
			changed -= 1;
			console.warn(
				`  conflict: ${record.slug} changed since the scan; skipped`,
			);
		}
	}

	console.log(
		`\n${APPLY ? "Updated" : "Would update"} ${changed} of ${scanned} recipes (${skipped} skipped${conflicts > 0 ? `, ${conflicts} conflicts` : ""}).`,
	);
	if (!APPLY && changed > 0) {
		console.log("Re-run with --apply to write these changes.");
	}
} finally {
	await client.end({ timeout: 5 });
}
