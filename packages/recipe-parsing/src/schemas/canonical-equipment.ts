import { z } from "zod";

export const EquipmentCategorySchema = z.enum([
  "cookware",
  "bakeware",
  "appliance",
  "utensil",
  "measuring",
  "vessel",
  "surface",
  "consumable",
]);

export type EquipmentCategory = z.infer<typeof EquipmentCategorySchema>;

export const CanonicalEquipmentSchema = z.object({
  slug: z.string().min(1),
  category: EquipmentCategorySchema,
});

export type CanonicalEquipment = z.infer<typeof CanonicalEquipmentSchema>;

export const CanonicalEquipmentDataSchema = z.object({
  equipment: z.array(CanonicalEquipmentSchema).min(1),
});

export type CanonicalEquipmentData = z.infer<typeof CanonicalEquipmentDataSchema>;
