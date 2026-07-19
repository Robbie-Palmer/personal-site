import { describe, expect, it } from "vitest";
import { hasExpectedImageSignature } from "../src/image-signature";

describe("hasExpectedImageSignature", () => {
  it.each([
    ["image/jpeg", [0xff, 0xd8, 0xff, 0xe0]],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    [
      "image/webp",
      [
        0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42,
        0x50,
      ],
    ],
  ])("accepts a valid %s signature", async (contentType, bytes) => {
    const file = new File([new Uint8Array(bytes)], "recipe", { type: contentType });

    await expect(
      hasExpectedImageSignature(file, contentType),
    ).resolves.toBe(true);
  });

  it("rejects content that does not match the declared type", async () => {
    const file = new File(["not an image"], "recipe.png", {
      type: "image/png",
    });

    await expect(
      hasExpectedImageSignature(file, file.type),
    ).resolves.toBe(false);
  });
});
