import Cloudflare, { APIError } from "cloudflare";
import type { Image } from "cloudflare/resources/images/v1/v1";
import { readFileSync } from "node:fs";
import { toFile } from "cloudflare/uploads";
import { env } from "./env";

const client = new Cloudflare({ apiToken: env.CF_API_TOKEN });

export async function listImages(): Promise<Image[]> {
	const response = await client.images.v1.list({
		account_id: env.CF_ACCOUNT_ID,
	});
	// @ts-expect-error SDK types don't match actual response structure
	return response.body?.result?.images || [];
}

export async function uploadImage(
	filepath: string,
	imageId: string,
): Promise<{ success: boolean; statusCode: number; message?: string }> {
	try {
		const fileBuffer = readFileSync(filepath);
		const fileName = filepath.split("/").pop() || "image";

		await client.images.v1.create({
			account_id: env.CF_ACCOUNT_ID,
			id: imageId,
			file: await toFile(fileBuffer, fileName),
		});

		return {
			success: true,
			statusCode: 200,
		};
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";
		// Extract HTTP status code from Cloudflare APIError (e.g., 409 for duplicate, 401 for auth failure)
		// Connection errors have status undefined, so default to 500
		const statusCode =
			error instanceof APIError && typeof error.status === "number"
				? error.status
				: 500;
		return {
			success: false,
			statusCode,
			message: errorMessage,
		};
	}
}
