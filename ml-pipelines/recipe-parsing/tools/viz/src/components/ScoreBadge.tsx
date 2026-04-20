import { scoreColor, formatPercent } from "../lib/scores";

interface ScoreBadgeProps {
  score: number;
  label?: string;
}

export function ScoreBadge({ score, label }: ScoreBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${scoreColor(score)}`}
    >
      {label && <span>{label}</span>}
      <span>{formatPercent(score)}</span>
    </span>
  );
}
