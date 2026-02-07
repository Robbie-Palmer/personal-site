"use client";

import { Mermaid } from "@/components/mermaid";

const DIAGRAMS = [
  {
    title: "Flowchart",
    description: "A simple decision flow showing branching logic:",
    chart: `
flowchart LR
A[Start]:::blue --> B{Is it working?}:::purple
B -->|Yes| C[Great!]:::green
B -->|No| D[Debug]:::amber
D --> E{Found the bug?}:::purple
E -->|Yes| F[Fix it]:::amber
E -->|No| D
F --> B
C --> G[Ship it! 🚀]:::green
`,
  },
  {
    title: "Sequence Diagram",
    description: "Interaction between a user, frontend, and API:",
    chart: `
sequenceDiagram
participant U as User
participant F as Frontend
participant A as API
participant D as Database

U->>F: Click submit
F->>A: POST /api/data
A->>D: INSERT record
D-->>A: Success
A-->>F: 201 Created
F-->>U: Show confirmation
`,
  },
  {
    title: "State Diagram",
    description: "A document lifecycle with state transitions:",
    chart: `
stateDiagram-v2
direction LR
[*] --> Draft
Draft --> Review: Submit
Review --> Draft: Request changes
Review --> Approved: Approve
Approved --> Published: Publish
Published --> Archived: Archive
Archived --> [*]
`,
  },
];

export function MermaidDemo() {
  return (
    <div className="space-y-8">
      {DIAGRAMS.map((diagram) => (
        <div key={diagram.title}>
          <h3 className="text-lg font-medium mb-3">{diagram.title}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {diagram.description}
          </p>
          <Mermaid chart={diagram.chart} />
        </div>
      ))}
    </div>
  );
}
