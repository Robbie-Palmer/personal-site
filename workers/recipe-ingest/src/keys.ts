export type ImportStage = "extract" | "normalize" | "canonicalize" | "finalize";

export function sourcePrefix(jobId: string): string {
  return `imports/${jobId}/source/`;
}

export function sourceImageKey(
  jobId: string,
  index: number,
  extension: string,
): string {
  return `${sourcePrefix(jobId)}${index}.${extension}`;
}

export function artifactKey(
  jobId: string,
  stage: ImportStage,
  filename: string,
): string {
  return `imports/${jobId}/${stage}/${filename}`;
}
