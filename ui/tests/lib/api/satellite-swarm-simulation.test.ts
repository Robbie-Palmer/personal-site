import { describe, expect, it } from "vitest";
import {
  describeSatelliteSwarmEvent,
  parseSatelliteSwarmSimulation,
} from "@/lib/api/satellite-swarm-simulation";

const validRecord = {
  schemaVersion: 3,
  traceVersion: 3,
  scenario: "test",
  source: "portable C++ SimulationTrace",
  sourceRevision: "0123456789abcdef0123456789abcdef01234567",
  positionModel: "scripted",
  objective: { longitudeDegrees: 0, latitudeDegrees: -90 },
  frames: [
    {
      timeMs: 0,
      nodes: [
        {
          id: 0,
          bootEpoch: 1,
          state: "leading",
          position: { longitudeDegrees: 0, latitudeDegrees: 10 },
          orbitalRadiusMetres: 6_750_000,
          candidacyScore: 81,
          missionKey: { bootEpoch: 1, originNode: 0, sequence: 1 },
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
        sender: 0,
        target: 1,
        missionKey: { bootEpoch: 1, originNode: 0, sequence: 1 },
        score: 81,
      },
    },
  ],
} as const;

describe("satellite swarm simulation records", () => {
  it("accepts the versioned portable trace contract", () => {
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
      parseSatelliteSwarmSimulation({ ...validRecord, schemaVersion: 1 }),
    ).toThrow();
    expect(() =>
      parseSatelliteSwarmSimulation({
        ...validRecord,
        objective: { longitudeDegrees: 0, latitudeDegrees: -91 },
      }),
    ).toThrow();
  });

  it("describes deterministic network fault evidence", () => {
    const record = parseSatelliteSwarmSimulation({
      ...validRecord,
      events: [
        {
          message: {
            missionKey: { bootEpoch: 1, originNode: 0, sequence: 1 },
            score: 0,
            sender: 0,
            target: 1,
            type: "mission-assignment",
          },
          nodeId: 0,
          reason: "scripted-drop",
          recipientNode: 1,
          timeMs: 100,
          type: "message-dropped",
        },
      ],
    });
    const [event] = record.events;
    if (!event) throw new Error("Expected one simulation event");

    expect(describeSatelliteSwarmEvent(event)).toBe(
      "Node 0's mission-assignment to node 1 was dropped by the fault schedule.",
    );
  });

  it("describes every replay event variant", () => {
    const message = {
      missionKey: { bootEpoch: 1, originNode: 0, sequence: 1 },
      score: 0,
      sender: 0,
      target: 1,
      type: "mission-assignment",
    } as const;
    const record = parseSatelliteSwarmSimulation({
      ...validRecord,
      events: [
        {
          accepted: false,
          nodeId: 0,
          objective: validRecord.objective,
          timeMs: 0,
          type: "mission-command",
        },
        {
          currentState: "idle",
          nodeId: 1,
          previousState: "safe-disabled",
          timeMs: 10,
          type: "node-reset",
        },
        {
          connected: false,
          nodeId: 0,
          recipientNode: 1,
          timeMs: 20,
          type: "link-changed",
        },
        {
          connected: true,
          nodeId: 0,
          recipientNode: 1,
          timeMs: 30,
          type: "link-changed",
        },
        {
          message,
          nodeId: 0,
          reason: "link-unavailable",
          recipientNode: 1,
          timeMs: 40,
          type: "message-dropped",
        },
        {
          deliverAtMs: 60,
          message,
          nodeId: 0,
          recipientNode: 1,
          timeMs: 50,
          type: "message-delayed",
        },
        {
          message,
          nodeId: 0,
          recipientNode: 1,
          timeMs: 60,
          type: "message-duplicated",
        },
        {
          message,
          nodeId: 0,
          recipientNode: 1,
          timeMs: 70,
          type: "delayed-message-delivered",
        },
        {
          currentState: "active",
          nodeId: 1,
          previousState: "awaiting assignment",
          timeMs: 80,
          type: "state-changed",
        },
        {
          message: {
            ...message,
            sender: 1,
            score: 72,
            target: 0,
            type: "candidacy",
          },
          nodeId: 1,
          timeMs: 90,
          type: "message-sent",
        },
        {
          message: { ...message, type: "acknowledgement" },
          nodeId: 0,
          timeMs: 100,
          type: "message-sent",
        },
        {
          message,
          nodeId: 0,
          timeMs: 110,
          type: "message-sent",
        },
        {
          message: { ...message, target: null, type: "mission-request" },
          nodeId: 0,
          timeMs: 120,
          type: "message-sent",
        },
      ],
    });

    expect(
      record.events.map((event) => describeSatelliteSwarmEvent(event)),
    ).toEqual([
      "Node 0 rejected the mission command.",
      "Node 1 reset from safe-disabled to idle.",
      "Link 0 to node 1 disconnected.",
      "Link 0 to node 1 connected.",
      "Node 0's mission-assignment to node 1 was dropped because the link was unavailable.",
      "Node 0's mission-assignment to node 1 was delayed until 60 ms.",
      "Node 0's mission-assignment was delivered twice to node 1.",
      "Node 0's delayed mission-assignment reached node 1.",
      "Node 1 changed from awaiting assignment to active.",
      "Node 1 sent score 72 to node 0.",
      "Node 0 acknowledged node 1.",
      "Node 0 assigned mission 0:1:1 to node 1.",
      "Node 0 broadcast mission 0:1:1.",
    ]);
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
