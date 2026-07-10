import { createDb, schema } from "../src/db";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const groupKeys = {
  alcohol: "alcohol",
  chilli: "chilli",
  dairy: "dairy",
  egg: "egg",
  fish: "fish",
  garlic: "garlic",
  gluten: "gluten",
  legumes: "legumes",
  meat: "meat",
  nuts: "nuts",
  onion: "onion",
  peanut: "peanut",
  poultry: "poultry",
  shellfish: "shellfish",
  soy: "soy",
  wheat: "wheat",
} as const;

const presetKeys = {
  dairyFree: "dairy-free",
  glutenFree: "gluten-free",
  lowFodmap: "low-fodmap",
  pescatarian: "pescatarian",
  vegan: "vegan",
  vegetarian: "vegetarian",
} as const;

const ingredientGroups = [
  { key: groupKeys.meat, label: "Meat", description: "beef, pork, lamb" },
  { key: groupKeys.poultry, label: "Poultry", description: "chicken, turkey" },
  { key: groupKeys.fish, label: "Fish", description: "salmon, tuna" },
  {
    key: groupKeys.shellfish,
    label: "Shellfish",
    description: "prawns, mussels",
  },
  { key: groupKeys.dairy, label: "Dairy", description: "milk, cheese" },
  { key: groupKeys.egg, label: "Egg", description: "egg and egg yolk" },
  { key: groupKeys.gluten, label: "Gluten", description: "wheat, barley, rye" },
  { key: groupKeys.wheat, label: "Wheat", description: "wheat flour, pasta" },
  { key: groupKeys.legumes, label: "Legumes", description: "beans, lentils" },
  { key: groupKeys.nuts, label: "Tree nuts", description: "almond, cashew" },
  { key: groupKeys.peanut, label: "Peanut", description: "peanut products" },
  { key: groupKeys.soy, label: "Soy", description: "soy sauce, tofu" },
  { key: groupKeys.onion, label: "Onion", description: "onions, shallots" },
  { key: groupKeys.garlic, label: "Garlic", description: "garlic, granules" },
  { key: groupKeys.chilli, label: "Chilli", description: "fresh or dried" },
  {
    key: groupKeys.alcohol,
    label: "Alcohol",
    description: "wine, beer, spirits",
  },
] as const;

const dietPresets = [
  {
    key: presetKeys.vegetarian,
    label: "Vegetarian",
    description: "no meat or fish",
    excludedGroupKeys: [
      groupKeys.meat,
      groupKeys.poultry,
      groupKeys.fish,
      groupKeys.shellfish,
    ],
  },
  {
    key: presetKeys.vegan,
    label: "Vegan",
    description: "no animal products",
    excludedGroupKeys: [
      groupKeys.meat,
      groupKeys.poultry,
      groupKeys.fish,
      groupKeys.shellfish,
      groupKeys.dairy,
      groupKeys.egg,
    ],
  },
  {
    key: presetKeys.pescatarian,
    label: "Pescatarian",
    description: "no meat, fish ok",
    excludedGroupKeys: [groupKeys.meat, groupKeys.poultry],
  },
  {
    key: presetKeys.dairyFree,
    label: "Dairy-free",
    description: "no milk or cheese",
    excludedGroupKeys: [groupKeys.dairy],
  },
  {
    key: presetKeys.glutenFree,
    label: "Gluten-free",
    description: "no wheat or gluten",
    excludedGroupKeys: [groupKeys.gluten],
  },
  {
    key: presetKeys.lowFodmap,
    label: "Low-FODMAP review",
    description: "flag common triggers",
    excludedGroupKeys: [
      groupKeys.onion,
      groupKeys.garlic,
      groupKeys.wheat,
      groupKeys.legumes,
    ],
  },
] as const;

const databaseURL = requiredEnv("DATABASE_URL");
const { db, client } = createDb(databaseURL);

try {
  for (const group of ingredientGroups) {
    await db
      .insert(schema.ingredientGroup)
      .values(group)
      .onConflictDoUpdate({
        target: schema.ingredientGroup.key,
        set: {
          label: group.label,
          description: group.description,
          updatedAt: new Date(),
        },
      });
  }

  for (const {
    excludedGroupKeys: _excludedGroupKeys,
    ...preset
  } of dietPresets) {
    await db
      .insert(schema.dietPreset)
      .values(preset)
      .onConflictDoUpdate({
        target: schema.dietPreset.key,
        set: {
          label: preset.label,
          description: preset.description,
          updatedAt: new Date(),
        },
      });
  }

  await db
    .insert(schema.dietPresetExcludedGroup)
    .values(
      dietPresets.flatMap((preset) =>
        preset.excludedGroupKeys.map((groupKey) => ({
          presetKey: preset.key,
          groupKey,
        })),
      ),
    )
    .onConflictDoNothing({
      target: [
        schema.dietPresetExcludedGroup.presetKey,
        schema.dietPresetExcludedGroup.groupKey,
      ],
    });

  console.log("Seeded diet catalog.");
} finally {
  await client.end({ timeout: 5 });
}
