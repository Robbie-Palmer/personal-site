import { scoreBarColor } from "../lib/scores";

interface ScoreBarProps {
  scores: { label: string; value: number }[];
}

export function ScoreBar({ scores }: ScoreBarProps) {
  return (
    <div className="flex gap-1 h-2 rounded overflow-hidden bg-gray-200">
      {scores.map((s) => (
        <div
          key={s.label}
          className={`${scoreBarColor(s.value)} transition-all`}
          style={{ width: `${s.value * 100}%` }}
          title={`${s.label}: ${Math.round(s.value * 100)}%`}
        />
      ))}
    </div>
  );
}
