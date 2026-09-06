export type ImportStage =
  | "extract"
  | "normalize"
  | "canonicalize"
  | "finalize";

export function importJobPrefix(jobId: string): string {
  return `imports/${jobId}/`;
}

export function sourcePrefix(jobId: string): string {
  return `${importJobPrefix(jobId)}source/`;
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
  return `${importJobPrefix(jobId)}${stage}/${filename}`;
}
