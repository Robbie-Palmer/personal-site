#!/usr/bin/env tsx

import { listImages } from "./lib/cloudflare";
import { env } from "./lib/env";

async function main() {
	console.log("Running Cloudflare Images health check...");
	console.log("");

	console.log("1️⃣  Testing API connectivity...");
	try {
		const images = await listImages();

		console.log("   ✅ API connection successful");
		console.log(`   📊 Total images in account: ${images.length}`);
		if (images.length > 0) {
			const allIds = images.map((img) => img.id).sort();
			const featured = allIds.filter((id) => id?.includes("-featured-"));
			const embedded = allIds.filter((id) => !id?.includes("-featured-"));

			if (featured.length > 0) {
				console.log(`   📸 Featured images (${featured.length}):`);
				for (const id of featured) {
					console.log(`      - ${id}`);
				}
			}
			if (embedded.length > 0) {
				console.log(`   🖼️  Embedded images (${embedded.length}):`);
				for (const id of embedded) {
					console.log(`      - ${id}`);
				}
			}
		}
	} catch (error) {
		console.log("   ❌ API connection failed");
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.log(`   Error: ${errorMessage}`);
	}

	console.log("");
	console.log("2️⃣  Checking image variants...");
	try {
		const images = await listImages();

		if (images.length > 0 && images[0]?.variants) {
			const variantNames = images[0].variants.map((url) => {
				const parts = url.split("/");
				return parts[parts.length - 1];
			});

			const expectedVariants = [
				{ name: "og", description: "1200w for OpenGraph metadata" },
			];

			for (const variant of expectedVariants) {
				if (variantNames.includes(variant.name)) {
					console.log(
						`   ✅ ${variant.name} variant configured (${variant.description})`,
					);
				} else {
					console.log(`   ❌ ${variant.name} variant missing`);
				}
			}

			console.log("");
			console.log("   💡 Configure variants in Cloudflare Dashboard:");
			console.log(
				`      https://dash.cloudflare.com/${env.CF_ACCOUNT_ID}/images/variants`,
			);
		} else {
			console.log(
				"   ⚠️  No images found - upload images to verify variants",
			);
		}
	} catch (error) {
		console.log("   ❌ Failed to check variants");
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.log(`   Error: ${errorMessage}`);
	}
	console.log("");

	console.log("3️⃣  Testing image URL generation...");
	try {
		const images = await listImages();

		if (images.length > 0 && images[0]?.id) {
			const firstImageId = images[0].id;
			console.log(`   🧪 Test image ID: ${firstImageId}`);
			const testUrl = `https://imagedelivery.net/${env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH}/${firstImageId}/og`;
			console.log(`   🌐 Test URL: ${testUrl}`);
			console.log("   💡 Open this URL in browser to verify image loads");
		} else {
			console.log(
				"   ⚠️  No images found in account (upload some with 'mise run //ui:images:sync')",
			);
		}
	} catch (error) {
		console.log("   ⚠️  Could not generate test URL");
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		console.log(`   Error: ${errorMessage}`);
	}

	console.log("");
	console.log("🏁 Health check complete!");
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
