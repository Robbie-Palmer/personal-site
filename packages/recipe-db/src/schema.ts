import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  primaryKey,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull(),
  image: text(),
  role: text().default("user"),
  banned: boolean(),
  banReason: text(),
  banExpires: timestamp({ withTimezone: true }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Better Auth keeps one canonical address on `user`. This table records every
// verified address owned by that account so app features can resolve aliases
// captured from linked identity providers without treating an email as the
// user ID.
export const userEmail = pgTable(
  "user_email",
  {
    email: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    verified: boolean().notNull().default(false),
    isPrimary: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("user_email_user_id_idx").on(table.userId)],
);

export const session = pgTable(
  "session",
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text(),
    userAgent: text(),
    impersonatedBy: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text().primaryKey(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const visibilityEnum = pgEnum("visibility", [
  "public",
  "private",
  "household",
]);

export const dietRecipeMatchModeEnum = pgEnum("diet_recipe_match_mode", [
  "hide",
  "warn",
]);

export const organization = pgTable("organization", {
  id: text().primaryKey(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  logo: text(),
  metadata: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const member = pgTable(
  "member",
  {
    id: text().primaryKey(),
    organizationId: text()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text().notNull().default("member"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("member_organization_id_idx").on(table.organizationId),
    index("member_user_id_idx").on(table.userId),
    uniqueIndex("member_user_unique").on(table.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text().primaryKey(),
    organizationId: text()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role: text().notNull().default("member"),
    status: text().notNull().default("pending"),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    inviterId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("invitation_organization_id_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
    index("invitation_status_idx").on(table.status),
  ],
);

export const recipe = pgTable(
  "recipe",
  {
    id: uuid().primaryKey().defaultRandom(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    description: text(),
    body: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    visibility: visibilityEnum().notNull().default("private"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("recipe_user_id_idx").on(table.userId),
    index("recipe_public_feed_idx").on(
      table.visibility,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("recipe_household_feed_idx").on(
      table.userId,
      table.visibility,
      table.createdAt.desc(),
      table.id.desc(),
    ),
  ],
);

export const ingredient = pgTable("ingredient", {
  slug: text().primaryKey(),
  name: text().notNull(),
  category: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const ingredientGroup = pgTable("ingredient_group", {
  key: text().primaryKey(),
  label: text().notNull(),
  description: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const ingredientGroupMember = pgTable(
  "ingredient_group_member",
  {
    groupKey: text()
      .notNull()
      .references(() => ingredientGroup.key, { onDelete: "cascade" }),
    ingredientSlug: text()
      .notNull()
      .references(() => ingredient.slug, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.groupKey, table.ingredientSlug],
      name: "ingredient_group_member_pk",
    }),
    index("ingredient_group_member_ingredient_slug_idx").on(table.ingredientSlug),
  ],
);

export const dietPreset = pgTable("diet_preset", {
  key: text().primaryKey(),
  label: text().notNull(),
  description: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const dietPresetExcludedGroup = pgTable(
  "diet_preset_excluded_group",
  {
    presetKey: text()
      .notNull()
      .references(() => dietPreset.key, { onDelete: "cascade" }),
    groupKey: text()
      .notNull()
      .references(() => ingredientGroup.key, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.presetKey, table.groupKey],
      name: "diet_preset_excluded_group_pk",
    }),
    index("diet_preset_excluded_group_group_key_idx").on(table.groupKey),
  ],
);

export const dietPresetExcludedIngredient = pgTable(
  "diet_preset_excluded_ingredient",
  {
    presetKey: text()
      .notNull()
      .references(() => dietPreset.key, { onDelete: "cascade" }),
    ingredientSlug: text()
      .notNull()
      .references(() => ingredient.slug, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.presetKey, table.ingredientSlug],
      name: "diet_preset_excluded_ingredient_pk",
    }),
    index("diet_preset_excluded_ingredient_slug_idx").on(table.ingredientSlug),
  ],
);

export const userDietProfile = pgTable(
  "user_diet_profile",
  {
    userId: text()
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    recipeMatchMode: dietRecipeMatchModeEnum().notNull().default("hide"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
);

export const userDietPreset = pgTable(
  "user_diet_preset",
  {
    userId: text()
      .notNull()
      .references(() => userDietProfile.userId, { onDelete: "cascade" }),
    presetKey: text()
      .notNull()
      .references(() => dietPreset.key, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.presetKey],
      name: "user_diet_preset_pk",
    }),
    index("user_diet_preset_preset_key_idx").on(table.presetKey),
  ],
);

export const userDietExcludedGroup = pgTable(
  "user_diet_excluded_group",
  {
    userId: text()
      .notNull()
      .references(() => userDietProfile.userId, { onDelete: "cascade" }),
    groupKey: text()
      .notNull()
      .references(() => ingredientGroup.key, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.groupKey],
      name: "user_diet_excluded_group_pk",
    }),
    index("user_diet_excluded_group_group_key_idx").on(table.groupKey),
  ],
);

export const userDietExcludedIngredient = pgTable(
  "user_diet_excluded_ingredient",
  {
    userId: text()
      .notNull()
      .references(() => userDietProfile.userId, { onDelete: "cascade" }),
    ingredientSlug: text()
      .notNull()
      .references(() => ingredient.slug, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.ingredientSlug],
      name: "user_diet_excluded_ingredient_pk",
    }),
    index("user_diet_excluded_ingredient_slug_idx").on(table.ingredientSlug),
  ],
);

/**
 * The static recipes a user has chosen for their personal recipe box. The
 * recipe content remains in the versioned Cooklang catalog; this table only
 * stores the user's selection so the same recipe can be used by many people.
 */
export const userRecipeBox = pgTable("user_recipe_box", {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  completedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const userRecipeBoxItem = pgTable(
  "user_recipe_box_item",
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipeSlug: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.recipeSlug] })],
);

export const appRateLimit = pgTable("app_rate_limit", {
  key: text().primaryKey(),
  count: integer().notNull().default(0),
  windowStart: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

// Postgres is the source of truth for recipe import job state;
// R2 holds the immutable source images and stage artifact snapshots.

export const recipeImportStatusEnum = pgEnum("recipe_import_status", [
  "queued",
  "running",
  "succeeded",
  "failed",
]);

export const recipeImportStageEnum = pgEnum("recipe_import_stage", [
  "extract",
  "normalize",
  "canonicalize",
  "finalize",
]);

export const recipeImportJob = pgTable(
  "recipe_import_job",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: recipeImportStatusEnum().notNull().default("queued"),
    currentStage: recipeImportStageEnum(),
    progressLabel: text(),
    errorType: text(),
    errorMessage: text(),
    workflowInstanceId: text(),
    imageCount: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("recipe_import_job_user_id_idx").on(table.userId),
    index("recipe_import_job_user_status_idx").on(table.userId, table.status),
    index("recipe_import_job_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export const recipeImportArtifact = pgTable(
  "recipe_import_artifact",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => recipeImportJob.id, { onDelete: "cascade" }),
    stage: recipeImportStageEnum().notNull(),
    kind: text().notNull(),
    r2Key: text().notNull(),
    checksum: text().notNull(),
    schemaVersion: integer().notNull().default(1),
    model: text(),
    provider: text(),
    preview: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("recipe_import_artifact_job_id_idx").on(table.jobId),
    // Workflow step retries upsert on this key so a replay cannot duplicate manifests.
    uniqueIndex("recipe_import_artifact_job_stage_kind_unique").on(
      table.jobId,
      table.stage,
      table.kind,
    ),
  ],
);

export const recipeImportAttempt = pgTable(
  "recipe_import_attempt",
  {
    id: uuid().primaryKey().defaultRandom(),
    jobId: uuid()
      .notNull()
      .references(() => recipeImportJob.id, { onDelete: "cascade" }),
    stage: recipeImportStageEnum().notNull(),
    attempt: integer().notNull(),
    succeeded: boolean().notNull(),
    retryable: boolean(),
    providerRequestId: text(),
    errorType: text(),
    errorMessage: text(),
    durationMs: integer(),
    model: text(),
    promptTokens: integer(),
    completionTokens: integer(),
    totalTokens: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("recipe_import_attempt_job_id_idx").on(table.jobId),
    uniqueIndex("recipe_import_attempt_job_stage_attempt_unique").on(
      table.jobId,
      table.stage,
      table.attempt,
    ),
  ],
);
