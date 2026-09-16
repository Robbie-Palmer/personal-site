import type { WorkGraphInput } from "../../src/index";

export interface PriorityFixture {
  readonly graph: WorkGraphInput;
  readonly name: string;
  readonly orderedIds: readonly string[];
}

export const priorityFixtures: readonly PriorityFixture[] = [
  {
    name: "keeps a decomposed launch ahead of routine maintenance",
    graph: {
      workItems: [
        { id: "maintenance", title: "Routine maintenance", priorityWeight: 5 },
        { id: "launch", title: "Launch", priorityWeight: 20 },
        {
          id: "launch-api",
          title: "Ship the API",
          parentId: "launch",
          rank: 1,
        },
        {
          id: "launch-ui",
          title: "Ship the UI",
          parentId: "launch",
          rank: 2,
        },
      ],
    },
    orderedIds: ["launch", "launch-api", "launch-ui", "maintenance"],
  },
  {
    name: "moves a blocker into its most urgent dependent's position",
    graph: {
      workItems: [
        { id: "release", title: "Release", priorityWeight: 20 },
        {
          id: "release-api",
          title: "Release API",
          parentId: "release",
          rank: 1,
        },
        {
          id: "release-ui",
          title: "Release UI",
          parentId: "release",
          rank: 2,
        },
        { id: "database", title: "Database migration" },
        { id: "chores", title: "Chores", priorityWeight: 5 },
      ],
      dependencies: [
        {
          dependentWorkItemId: "release-api",
          blockerWorkItemId: "database",
        },
      ],
    },
    orderedIds: [
      "release",
      "release-api",
      "database",
      "release-ui",
      "chores",
    ],
  },
  {
    name: "uses the highest urgency when a blocker feeds several branches",
    graph: {
      workItems: [
        { id: "urgent", title: "Urgent release", priorityWeight: 30 },
        { id: "normal", title: "Normal release", priorityWeight: 10 },
        { id: "shared", title: "Shared prerequisite", priorityWeight: -10 },
      ],
      dependencies: [
        { dependentWorkItemId: "normal", blockerWorkItemId: "shared" },
        { dependentWorkItemId: "urgent", blockerWorkItemId: "shared" },
      ],
    },
    orderedIds: ["urgent", "shared", "normal"],
  },
  {
    name: "falls back to stable IDs when every scheduling input ties",
    graph: {
      workItems: [
        { id: "zebra", title: "Zebra" },
        { id: "alpha", title: "Alpha" },
      ],
    },
    orderedIds: ["alpha", "zebra"],
  },
];
