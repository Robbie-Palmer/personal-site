import { z } from "zod";

const coordinateSchema = z.object({
  latitudeDegrees: z.number().min(-90).max(90),
  longitudeDegrees: z.number().min(-180).max(180),
});

const controllerStateSchema = z.enum([
  "idle",
  "leading",
  "awaiting acknowledgement",
  "awaiting assignment",
  "active",
  "quiescent",
  "safe-disabled",
]);

const nodeSchema = z.object({
  assignedNode: z.number().int().min(0).max(15).nullable(),
  candidacyScore: z.number().int().min(0).max(100),
  id: z.number().int().min(0).max(15),
  missionId: z.number().int().min(0).max(65_535),
  orbitalRadiusMetres: z.number().positive(),
  position: coordinateSchema,
  state: controllerStateSchema,
});

const missionCommandEventSchema = z.object({
  accepted: z.boolean(),
  nodeId: z.number().int().min(0).max(15),
  objective: coordinateSchema,
  timeMs: z.number().int().nonnegative(),
  type: z.literal("mission-command"),
});

const messageFields = {
  missionId: z.number().int().min(0).max(65_535),
  origin: z.number().int().min(0).max(15),
  score: z.number().int().min(0).max(100),
};

const messageSchema = z.discriminatedUnion("type", [
  z.object({
    ...messageFields,
    target: z.null(),
    type: z.literal("mission-request"),
  }),
  z.object({
    ...messageFields,
    target: z.number().int().min(0).max(15),
    type: z.literal("candidacy"),
  }),
  z.object({
    ...messageFields,
    target: z.number().int().min(0).max(15),
    type: z.literal("acknowledgement"),
  }),
  z.object({
    ...messageFields,
    target: z.number().int().min(0).max(15),
    type: z.literal("mission-assignment"),
  }),
]);

const messageSentEventSchema = z.object({
  message: messageSchema,
  nodeId: z.number().int().min(0).max(15),
  timeMs: z.number().int().nonnegative(),
  type: z.literal("message-sent"),
});

const deliveryEventFields = {
  message: messageSchema,
  nodeId: z.number().int().min(0).max(15),
  recipientNode: z.number().int().min(0).max(15),
  timeMs: z.number().int().nonnegative(),
};

const messageDroppedEventSchema = z.object({
  ...deliveryEventFields,
  reason: z.enum(["link-unavailable", "scripted-drop"]),
  type: z.literal("message-dropped"),
});

const messageDelayedEventSchema = z.object({
  ...deliveryEventFields,
  deliverAtMs: z.number().int().nonnegative(),
  type: z.literal("message-delayed"),
});

const messageDuplicatedEventSchema = z.object({
  ...deliveryEventFields,
  type: z.literal("message-duplicated"),
});

const delayedMessageDeliveredEventSchema = z.object({
  ...deliveryEventFields,
  type: z.literal("delayed-message-delivered"),
});

const linkChangedEventSchema = z.object({
  connected: z.boolean(),
  nodeId: z.number().int().min(0).max(15),
  recipientNode: z.number().int().min(0).max(15),
  timeMs: z.number().int().nonnegative(),
  type: z.literal("link-changed"),
});

const stateChangedEventSchema = z.object({
  currentState: controllerStateSchema,
  nodeId: z.number().int().min(0).max(15),
  previousState: controllerStateSchema,
  timeMs: z.number().int().nonnegative(),
  type: z.literal("state-changed"),
});

const nodeResetEventSchema = z.object({
  currentState: controllerStateSchema,
  nodeId: z.number().int().min(0).max(15),
  previousState: controllerStateSchema,
  timeMs: z.number().int().nonnegative(),
  type: z.literal("node-reset"),
});

const simulationSchema = z.object({
  events: z.array(
    z.discriminatedUnion("type", [
      missionCommandEventSchema,
      messageSentEventSchema,
      messageDroppedEventSchema,
      messageDelayedEventSchema,
      messageDuplicatedEventSchema,
      delayedMessageDeliveredEventSchema,
      linkChangedEventSchema,
      nodeResetEventSchema,
      stateChangedEventSchema,
    ]),
  ),
  frames: z
    .array(
      z.object({
        nodes: z.array(nodeSchema).min(1).max(16),
        timeMs: z.number().int().nonnegative(),
      }),
    )
    .min(1),
  objective: coordinateSchema,
  positionModel: z.string().min(1),
  scenario: z.string().min(1),
  schemaVersion: z.literal(2),
  source: z.literal("portable C++ SimulationTrace"),
  traceVersion: z.literal(2),
});

export type SatelliteSwarmSimulation = z.infer<typeof simulationSchema>;
export type SatelliteSwarmFrame = SatelliteSwarmSimulation["frames"][number];
export type SatelliteSwarmEvent = SatelliteSwarmSimulation["events"][number];

export function parseSatelliteSwarmSimulation(
  input: unknown,
): SatelliteSwarmSimulation {
  return simulationSchema.parse(input);
}

export function describeSatelliteSwarmEvent(
  event: SatelliteSwarmEvent,
): string {
  switch (event.type) {
    case "mission-command":
      return `Node ${event.nodeId} ${event.accepted ? "accepted" : "rejected"} the mission command.`;
    case "state-changed":
      return `Node ${event.nodeId} changed from ${event.previousState} to ${event.currentState}.`;
    case "node-reset":
      return `Node ${event.nodeId} reset from ${event.previousState} to ${event.currentState}.`;
    case "link-changed":
      return `Link ${event.nodeId} to node ${event.recipientNode} ${event.connected ? "connected" : "disconnected"}.`;
    case "message-dropped": {
      const reason =
        event.reason === "link-unavailable"
          ? "because the link was unavailable"
          : "by the fault schedule";
      return `Node ${event.nodeId}'s ${event.message.type} to node ${event.recipientNode} was dropped ${reason}.`;
    }
    case "message-delayed":
      return `Node ${event.nodeId}'s ${event.message.type} to node ${event.recipientNode} was delayed until ${event.deliverAtMs} ms.`;
    case "message-duplicated":
      return `Node ${event.nodeId}'s ${event.message.type} was delivered twice to node ${event.recipientNode}.`;
    case "delayed-message-delivered":
      return `Node ${event.nodeId}'s delayed ${event.message.type} reached node ${event.recipientNode}.`;
    case "message-sent":
      return describeMessageSentEvent(event);
  }
}

function describeMessageSentEvent(
  event: Extract<SatelliteSwarmEvent, { type: "message-sent" }>,
): string {
  switch (event.message.type) {
    case "mission-request":
      return `Node ${event.nodeId} broadcast mission ${event.message.missionId}.`;
    case "candidacy":
      return `Node ${event.nodeId} sent score ${event.message.score} to node ${event.message.target}.`;
    case "acknowledgement":
      return `Node ${event.nodeId} acknowledged node ${event.message.target}.`;
    case "mission-assignment":
      return `Node ${event.nodeId} assigned mission ${event.message.missionId} to node ${event.message.target}.`;
  }
}
