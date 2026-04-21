export function scoreColor(score: number): string {
  if (score >= 0.85) return "text-green-700 bg-green-100";
  if (score >= 0.7) return "text-amber-700 bg-amber-100";
  return "text-red-700 bg-red-100";
}

export function scoreBorderColor(score: number): string {
  if (score >= 0.85) return "border-green-300";
  if (score >= 0.7) return "border-amber-300";
  return "border-red-300";
}

export function scoreBarColor(score: number): string {
  if (score >= 0.85) return "bg-green-500";
  if (score >= 0.7) return "bg-amber-500";
  return "bg-red-500";
}

export function formatPercent(score: number): string {
  return `${Math.round(score * 100)}%`;
}

export function formatScore(score: number): string {
  return score.toFixed(2);
}
