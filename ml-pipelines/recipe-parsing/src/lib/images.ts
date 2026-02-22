import { readFile } from "node:fs/promises";
import sharp from "sharp";

export async function imagePathToDataUrl(
  path: string,
  maxDimension: number,
  jpegQuality: number,
): Promise<string> {
  const input = await readFile(path);
  const transformed = await sharp(input)
    .rotate()
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: jpegQuality, mozjpeg: true })
    .toBuffer();
  return `data:image/jpeg;base64,${transformed.toString("base64")}`;
}
