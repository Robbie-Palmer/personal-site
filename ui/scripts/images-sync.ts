#!/usr/bin/env tsx

import { format, isValid, parse } from "date-fns";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { listImages, uploadImage } from "./lib/cloudflare";
import { env } from "./lib/env";
export function validateDate(dateStr: string): boolean {
	const parsed = parse(dateStr, "yyyy-MM-dd", new Date());
	if (!isValid(parsed)) {
		return false;
	}
	// Ensure no normalization occurred (e.g., "2025-02-30" → "2025-03-02")
	return format(parsed, "yyyy-MM-dd") === dateStr;
}

export interface ImageParts {
	rootName: string;
	date: string;
	ext: string;
}

export function parseCalVerImageFilename(
	filename: string,
	validExtensions: string,
): ImageParts | null {
	const pattern = new RegExp(
		`^(.+)-(\\d{4}-\\d{2}-\\d{2})\\.(${validExtensions})$`,
	);
	const match = filename.match(pattern);
	if (!match || !match[1] || !match[2] || !match[3]) {
		return null;
	}
	return {
		rootName: match[1],
		date: match[2],
		ext: match[3],
	};
}

async function main() {
	console.log("Starting image sync to Cloudflare Images...");
	console.log("");

	const sourceDir = "source-images/blog";
	try {
		statSync(sourceDir);
	} catch {
		console.log("⚠️  No source-images/blog directory found");
		console.log(
			"   Create it and add your images with CalVer naming: {name}-YYYY-MM-DD.{ext}",
		);
		process.exit(0);
	}

	let uploaded = 0;
	let skipped = 0;
	let failed = 0;
	let validationErrors = 0;

	console.log("1️⃣  Validating local image naming...");
	const rootNames = new Map<string, string>();
	const imageDates = new Map<string, string>();
	const files = readdirSync(sourceDir);
	for (const filename of files) {
		const filepath = join(sourceDir, filename);
		if (!statSync(filepath).isFile()) {
			continue;
		}
		const parts = parseCalVerImageFilename(filename, env.VALID_IMAGE_EXTENSIONS);
		if (!parts) {
			console.log(`   ❌ Invalid filename format: ${filename}`);
			console.log(
				"      Expected: {name}-YYYY-MM-DD.{ext} (e.g., hero-image-2025-11-27.jpg)",
			);
			validationErrors++;
			continue;
		}

		const { rootName, date: dateStr, ext: _ext } = parts;
		if (!validateDate(dateStr)) {
			console.log(`   ❌ Invalid date in filename: ${filename} (date: ${dateStr})`);
			validationErrors++;
			continue;
		}
		if (rootNames.has(rootName)) {
			console.log("   ❌ Duplicate root name found:");
			console.log(`      - ${rootNames.get(rootName)}`);
			console.log(`      - ${filename}`);
			console.log("      Only keep the latest version in source-images/");
			validationErrors++;
			continue;
		}
		rootNames.set(rootName, filename);
		imageDates.set(rootName, dateStr);
	}

	if (validationErrors > 0) {
		console.log("");
		console.log(
			`❌ Found ${validationErrors} validation error(s). Fix them before uploading.`,
		);
		process.exit(1);
	}

	console.log("   ✅ All local images have valid CalVer naming");
	console.log("");

	console.log("2️⃣  Fetching existing images from Cloudflare...");
	const images = await listImages();
	const existingIds = new Set(images.map((img) => img.id || ""));
	console.log(`   Found ${existingIds.size} existing images in Cloudflare`);
	console.log("");

	console.log("3️⃣  Uploading new images...");
	for (const filename of files) {
		const filepath = join(sourceDir, filename);
		if (!statSync(filepath).isFile()) {
			continue;
		}
		const parts = parseCalVerImageFilename(filename, env.VALID_IMAGE_EXTENSIONS);
		if (!parts) {
			continue;
		}
		const { rootName, date: dateStr } = parts;
		const imageId = `blog/${rootName}-${dateStr}`;
		console.log("");
		console.log(`Processing: ${filename}`);
		console.log(`   Image ID: ${imageId}`);
		if (existingIds.has(imageId)) {
			console.log("   ⏭️  Skipped (already exists in Cloudflare Images)");
			skipped++;
			continue;
		}
		const existingVersions = Array.from(existingIds).filter((id) =>
			id.startsWith(`blog/${rootName}-`),
		);
		if (existingVersions.length > 0) {
			const latestExisting = existingVersions
				.map((id) => {
				// Extract full YYYY-MM-DD from the end of the ID
				const match = id.match(/(\d{4}-\d{2}-\d{2})$/);
				return match ? match[1] : "";
			})
			.filter((date) => date !== "")
				.sort()
				.reverse()[0];
			if (latestExisting && dateStr <= latestExisting) {
				console.log("   ❌ Version validation failed:");
				console.log(`      Latest existing version: ${latestExisting}`);
				console.log(`      New version: ${dateStr}`);
				console.log("      New version must be later than existing versions");
				failed++;
				continue;
			}
			console.log(`   Newer version detected (latest existing: ${latestExisting})`);
		}

		const uploadResponse = await uploadImage(filepath, imageId);
		if (uploadResponse.success) {
			console.log("   ✅ Successfully uploaded");
			uploaded++;
		} else {
			console.log(`   ❌ Failed to upload (HTTP ${uploadResponse.statusCode})`);
			if (uploadResponse.message) {
				console.log(`   Error: ${uploadResponse.message}`);
			}
			failed++;
		}
	}

	console.log("");
	console.log("Summary:");
	console.log(`   ✅ Uploaded: ${uploaded}`);
	console.log(`   ⏭️  Skipped: ${skipped}`);
	console.log(`   ❌ Failed: ${failed}`);
	if (failed > 0) {
		console.log("");
		console.log("⚠️  Some images failed to upload. Check the logs above.");
		process.exit(1);
	}
	console.log("");
	console.log("Image sync completed successfully!");
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
