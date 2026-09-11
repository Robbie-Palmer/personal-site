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

const stateChangedEventSchema = z.object({
  currentState: controllerStateSchema,
  nodeId: z.number().int().min(0).max(15),
  previousState: controllerStateSchema,
  timeMs: z.number().int().nonnegative(),
  type: z.literal("state-changed"),
});

const simulationSchema = z.object({
  events: z.array(
    z.discriminatedUnion("type", [
      missionCommandEventSchema,
      messageSentEventSchema,
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
  schemaVersion: z.literal(1),
  source: z.literal("portable C++ SimulationTrace"),
  traceVersion: z.literal(1),
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
  if (event.type === "mission-command") {
    return `Node ${event.nodeId} ${event.accepted ? "accepted" : "rejected"} the mission command.`;
  }
  if (event.type === "state-changed") {
    return `Node ${event.nodeId} changed from ${event.previousState} to ${event.currentState}.`;
  }

  const { message } = event;
  if (message.type === "mission-request") {
    return `Node ${event.nodeId} broadcast mission ${message.missionId}.`;
  }
  if (message.type === "candidacy") {
    return `Node ${event.nodeId} sent score ${message.score} to node ${message.target}.`;
  }
  if (message.type === "acknowledgement") {
    return `Node ${event.nodeId} acknowledged node ${message.target}.`;
  }
  return `Node ${event.nodeId} assigned mission ${message.missionId} to node ${message.target}.`;
}
