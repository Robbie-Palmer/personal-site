import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		CF_ACCOUNT_ID: z.string().min(1),
		CF_API_TOKEN: z.string().min(1),
		NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH: z.string().min(1),
		VALID_IMAGE_EXTENSIONS: z.string().default("jpg|jpeg|png|gif|webp"),
	},
	runtimeEnv: process.env,
});
