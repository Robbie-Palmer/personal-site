"use client";

import { useState } from "react";

const depthOptions = [
  {
    label: "Routine",
    reviewers: 1,
    summary: "One fast pass over the changed files.",
  },
  {
    label: "Material",
    reviewers: 2,
    summary: "Two independent passes, then one reconciled review.",
  },
  {
    label: "Sensitive",
    reviewers: 3,
    summary: "Security, correctness, and repository-policy passes.",
  },
] as const;

export function ReviewDepthDemo() {
  const [selected, setSelected] = useState(1);
  const option = depthOptions[selected] ?? depthOptions[0];

  return (
    <div className="review-depth-demo">
      <fieldset className="review-depth-demo__options">
        <legend className="sr-only">Review depth</legend>
        {depthOptions.map((item, index) => (
          <button
            key={item.label}
            type="button"
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
          >
            {item.label}
          </button>
        ))}
      </fieldset>
      <p className="review-depth-demo__count">
        <strong>{option.reviewers}</strong>
        <span>{option.reviewers === 1 ? "reviewer" : "reviewers"}</span>
      </p>
      <p>{option.summary}</p>
    </div>
  );
}
