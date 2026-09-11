import { describe, expect, it } from "vitest";
import {
  describeSatelliteSwarmEvent,
  parseSatelliteSwarmSimulation,
} from "@/lib/api/satellite-swarm-simulation";

const validRecord = {
  schemaVersion: 1,
  traceVersion: 1,
  scenario: "test",
  source: "native C++ SimulationTrace",
  positionModel: "scripted",
  objective: { longitudeDegrees: 0, latitudeDegrees: -55 },
  frames: [
    {
      timeMs: 0,
      nodes: [
        {
          id: 0,
          state: "leading",
          position: { longitudeDegrees: 0, latitudeDegrees: 10 },
          orbitalRadiusMetres: 6_750_000,
          candidacyScore: 81,
          missionId: 1,
          assignedNode: null,
        },
      ],
    },
  ],
  events: [
    {
      type: "message-sent",
      timeMs: 0,
      nodeId: 0,
      message: {
        type: "candidacy",
        origin: 0,
        target: 1,
        missionId: 1,
        score: 81,
      },
    },
  ],
} as const;

describe("satellite swarm simulation records", () => {
  it("accepts the versioned native trace contract", () => {
    const parsed = parseSatelliteSwarmSimulation(validRecord);
    const event = parsed.events[0];
    if (!event) throw new Error("Expected one simulation event");

    expect(parsed.frames[0]?.nodes[0]?.candidacyScore).toBe(81);
    expect(describeSatelliteSwarmEvent(event)).toBe(
      "Node 0 sent score 81 to node 1.",
    );
  });

  it("rejects unknown versions and invalid coordinates", () => {
    expect(() =>
      parseSatelliteSwarmSimulation({ ...validRecord, schemaVersion: 2 }),
    ).toThrow();
    expect(() =>
      parseSatelliteSwarmSimulation({
        ...validRecord,
        objective: { longitudeDegrees: 0, latitudeDegrees: -91 },
      }),
    ).toThrow();
  });

  it("accepts only mission requests as broadcasts", () => {
    const messageEvent = validRecord.events[0];

    expect(() =>
      parseSatelliteSwarmSimulation({
        ...validRecord,
        events: [
          {
            ...messageEvent,
            message: { ...messageEvent.message, target: null },
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      parseSatelliteSwarmSimulation({
        ...validRecord,
        events: [
          {
            ...messageEvent,
            message: {
              ...messageEvent.message,
              target: 1,
              type: "mission-request",
            },
          },
        ],
      }),
    ).toThrow();

    expect(
      parseSatelliteSwarmSimulation({
        ...validRecord,
        events: [
          {
            ...messageEvent,
            message: {
              ...messageEvent.message,
              target: null,
              type: "mission-request",
            },
          },
        ],
      }).events,
    ).toHaveLength(1);
  });
});
