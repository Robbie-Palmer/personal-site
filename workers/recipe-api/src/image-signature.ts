const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50];

function matchesAt(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

export async function hasExpectedImageSignature(
  file: Blob,
  contentType: string,
): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") return matchesAt(bytes, PNG_SIGNATURE);
  if (contentType === "image/webp") {
    return (
      matchesAt(bytes, RIFF_SIGNATURE) && matchesAt(bytes, WEBP_SIGNATURE, 8)
    );
  }
  return false;
}
