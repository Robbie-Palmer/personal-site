import { eq } from "drizzle-orm";
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

		const parsed = SavedRecipePayloadSchema.safeParse(JSON.parse(record.body));
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

		await db
			.update(schema.recipe)
			.set({ body: JSON.stringify(result.payload) })
			.where(eq(schema.recipe.id, record.id));
	}

	console.log(
		`\n${APPLY ? "Updated" : "Would update"} ${changed} of ${scanned} recipes (${skipped} skipped).`,
	);
	if (!APPLY && changed > 0) {
		console.log("Re-run with --apply to write these changes.");
	}
} finally {
	await client.end({ timeout: 5 });
}
