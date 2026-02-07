"use client";

import { Mermaid } from "@/components/mermaid";

export function MermaidDemo() {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium mb-3">Flowchart</h3>
        <p className="text-sm text-muted-foreground mb-4">
          A simple decision flow showing branching logic:
        </p>
        <Mermaid
          chart={`
flowchart LR
A[Start]:::blue --> B{Is it working?}:::purple
B -->|Yes| C[Great!]:::green
B -->|No| D[Debug]:::amber
D --> E{Found the bug?}:::purple
E -->|Yes| F[Fix it]:::amber
E -->|No| D
F --> B
C --> G[Ship it! 🚀]:::green
`}
        />
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">Sequence Diagram</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Interaction between a user, frontend, and API:
        </p>
        <Mermaid
          chart={`
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
`}
        />
      </div>

      <div>
        <h3 className="text-lg font-medium mb-3">State Diagram</h3>
        <p className="text-sm text-muted-foreground mb-4">
          A document lifecycle with state transitions:
        </p>
        <Mermaid
          chart={`
stateDiagram-v2
direction LR
[*] --> Draft
Draft --> Review: Submit
Review --> Draft: Request changes
Review --> Approved: Approve
Approved --> Published: Publish
Published --> Archived: Archive
Archived --> [*]
`}
        />
      </div>
    </div>
  );
}
