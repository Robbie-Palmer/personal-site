import type { ReactNode } from "react";

interface InstructionStepProps {
  text: string;
  index: number;
  highlightWords?: string[];
  highlightClass?: string;
}

function highlightText(
  text: string,
  words: string[],
  className: string,
): ReactNode {
  if (words.length === 0) return text;

  const lowerWords = new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean));
  const tokens = text.split(/(\s+)/);

  return tokens.map((token, i) => {
    const cleaned = token.replace(/[.,;:!?'"()]/g, "").toLowerCase();
    if (lowerWords.has(cleaned)) {
      return (
        <mark key={i} className={className}>
          {token}
        </mark>
      );
    }
    return token;
  });
}

export function InstructionStep({
  text,
  index,
  highlightWords,
  highlightClass = "bg-red-200 text-red-900 rounded px-0.5",
}: InstructionStepProps) {
  return (
    <li className="text-sm leading-relaxed pl-1">
      <span className="text-gray-400 mr-1.5">{index + 1}.</span>
      {highlightWords && highlightWords.length > 0
        ? highlightText(text, highlightWords, highlightClass)
        : text}
    </li>
  );
}
