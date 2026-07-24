import rawCanonicalEquipment from "../data/canonical-equipment.json" with { type: "json" };
import {
  CanonicalEquipmentDataSchema,
  type CanonicalEquipmentData,
} from "../schemas/canonical-equipment.js";

export const canonicalEquipment: CanonicalEquipmentData =
  CanonicalEquipmentDataSchema.parse(rawCanonicalEquipment);
