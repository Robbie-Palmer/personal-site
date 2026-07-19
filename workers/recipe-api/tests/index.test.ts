import { beforeEach, describe, it, expect, vi } from "vitest";
import postgres from "postgres";

const authzMock = vi.hoisted(() => ({
  session: null as unknown,
}));

const dbMock = vi.hoisted(() => {
  const date = new Date("2026-01-01T00:00:00.000Z");
  type UserRow = {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    role: string | null;
    banned: boolean | null;
    banReason: string | null;
    banExpires: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  type OrganizationRow = {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    metadata: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  type UserEmailRow = {
    email: string;
    userId: string;
    verified: boolean;
    isPrimary: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  type MemberRow = {
    id: string;
    organizationId: string;
    userId: string;
    role: string;
    createdAt: Date;
  };
  type InvitationRow = {
    id: string;
    organizationId: string;
    email: string;
    role: string;
    status: string;
    expiresAt: Date;
    inviterId: string;
    createdAt: Date;
  };
  type RecipeRow = {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    body: string | null;
    userId: string;
    visibility: "public" | "private" | "household";
    createdAt: Date;
    updatedAt: Date;
  };
  type NotificationEventRow = {
    id: string;
    kind: string;
    actorUserId: string | null;
    actorNameSnapshot: string | null;
    occurredAt: Date;
  };
  type DietProfileRow = {
    userId: string;
    recipeMatchMode: "hide" | "warn";
    createdAt: Date;
    updatedAt: Date;
  };
  type DietPresetRow = {
    key: string;
    label: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  type IngredientGroupRow = {
    key: string;
    label: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  type IngredientRow = {
    slug: string;
    name: string;
    category: string | null;
    createdAt: Date;
    updatedAt: Date;
  };

  const state = {
    users: [] as UserRow[],
    userEmails: [] as UserEmailRow[],
    organizations: [] as OrganizationRow[],
    members: [] as MemberRow[],
    invitations: [] as InvitationRow[],
    notificationEvents: [] as NotificationEventRow[],
    notificationDeliveries: [] as {
      id: string;
      eventId: string;
      recipientUserId: string;
      readAt: Date | null;
      dismissedAt: Date | null;
    }[],
    notificationHouseholdEvents: [] as {
      eventId: string;
      householdId: string | null;
      householdNameSnapshot: string;
    }[],
    notificationHouseholdInvitationEvents: [] as {
      eventId: string;
      invitationId: string | null;
    }[],
    recipes: [] as RecipeRow[],
    dietProfiles: [] as DietProfileRow[],
    dietPresets: [] as DietPresetRow[],
    ingredientGroups: [] as IngredientGroupRow[],
    ingredients: [] as IngredientRow[],
    ingredientGroupMembers: [] as {
      groupKey: string;
      ingredientSlug: string;
    }[],
    dietPresetExcludedGroups: [] as { presetKey: string; groupKey: string }[],
    dietPresetExcludedIngredients: [] as {
      presetKey: string;
      ingredientSlug: string;
    }[],
    userDietPresets: [] as { userId: string; presetKey: string }[],
    userDietExcludedIngredients: [] as {
      userId: string;
      ingredientSlug: string;
    }[],
    userDietExcludedGroups: [] as { userId: string; groupKey: string }[],
    recipeBoxes: [] as { userId: string; completedAt: Date; updatedAt: Date }[],
    recipeBoxItems: [] as { userId: string; recipeSlug: string }[],
    rateLimitCounts: new Map<string, number>(),
    rateLimitSweeps: 0,
    expireInvitationOnUpdate: false,
  };

  const organizationRow = (organization: OrganizationRow) => [
    organization.id,
    organization.name,
    organization.slug,
    organization.logo,
    organization.metadata,
    organization.createdAt,
    organization.updatedAt,
  ];
  const memberRow = (member: MemberRow) => [
    member.id,
    member.organizationId,
    member.userId,
    member.role,
    member.createdAt,
  ];
  const invitationRow = (invitation: InvitationRow) => [
    invitation.id,
    invitation.organizationId,
    invitation.email,
    invitation.role,
    invitation.status,
    invitation.expiresAt,
    invitation.inviterId,
    invitation.createdAt,
  ];
  const recipeRow = (recipe: RecipeRow) => [
    recipe.id,
    recipe.slug,
    recipe.title,
    recipe.description,
    recipe.body,
    recipe.userId,
    recipe.visibility,
    recipe.createdAt,
    recipe.updatedAt,
  ];
  // Emulates the paginated recipe list query: newest-first ordering, an
  // optional keyset cursor (three params), a limit param, and the trailing
  // created_at::text cursor column.
  const paginatedRecipeRows = (
    recipes: RecipeRow[],
    query: string,
    params: unknown[],
    cursorParamIndex: number,
  ) => {
    let page = [...recipes].sort(
      (first, second) =>
        second.createdAt.getTime() - first.createdAt.getTime() ||
        second.id.localeCompare(first.id),
    );
    let index = cursorParamIndex;
    if (query.includes("::timestamptz")) {
      const cursorCreatedAt = new Date(params[index] as string).getTime();
      const cursorId = params[index + 2] as string;
      index += 3;
      page = page.filter(
        (recipe) =>
          recipe.createdAt.getTime() < cursorCreatedAt ||
          (recipe.createdAt.getTime() === cursorCreatedAt &&
            recipe.id.localeCompare(cursorId) < 0),
      );
    }
    const limit = params[index];
    if (typeof limit === "number") page = page.slice(0, limit);
    return page.map((recipe) => [
      ...recipeRow(recipe),
      recipe.createdAt.toISOString(),
    ]);
  };

  const dietProfileRow = (profile: DietProfileRow) => [
    profile.userId,
    profile.recipeMatchMode,
    profile.createdAt,
    profile.updatedAt,
  ];

  function reset() {
    state.users = [];
    state.userEmails = [];
    state.organizations = [];
    state.members = [];
    state.invitations = [];
    state.notificationEvents = [];
    state.notificationDeliveries = [];
    state.notificationHouseholdEvents = [];
    state.notificationHouseholdInvitationEvents = [];
    state.recipes = [];
    state.dietProfiles = [];
    state.dietPresets = [];
    state.ingredientGroups = [];
    state.ingredients = [];
    state.ingredientGroupMembers = [];
    state.dietPresetExcludedGroups = [];
    state.dietPresetExcludedIngredients = [];
    state.userDietPresets = [];
    state.userDietExcludedIngredients = [];
    state.userDietExcludedGroups = [];
    state.recipeBoxes = [];
    state.recipeBoxItems = [];
    state.rateLimitCounts.clear();
    state.rateLimitSweeps = 0;
    state.expireInvitationOnUpdate = false;
  }

  function queryRows(query: string, params: unknown[] = []) {
    if (query.startsWith('insert into "app_rate_limit"')) {
      const key = params[0] as string;
      const count = (state.rateLimitCounts.get(key) ?? 0) + 1;
      state.rateLimitCounts.set(key, count);
      // [count, windowStart] — drizzle .returning() maps these by column order.
      return [[count, date]];
    }

    if (query.startsWith('insert into "organization"')) {
      const organization: OrganizationRow = {
        id: params[0] as string,
        name: params[1] as string,
        slug: params[2] as string,
        logo: null,
        metadata: null,
        createdAt: date,
        updatedAt: date,
      };
      state.organizations.push(organization);
      return [organizationRow(organization)];
    }

    if (query.startsWith('insert into "notification_event"')) {
      state.notificationEvents.push({
        id: params[0] as string,
        kind: params[1] as string,
        actorUserId: (params[2] as string | undefined) ?? null,
        actorNameSnapshot: (params[3] as string | undefined) ?? null,
        occurredAt: date,
      });
      return [];
    }

    if (query.startsWith('insert into "notification_household_event"')) {
      state.notificationHouseholdEvents.push({
        eventId: params[0] as string,
        householdId: (params[1] as string | undefined) ?? null,
        householdNameSnapshot: params[2] as string,
      });
      return [];
    }

    if (
      query.startsWith(
        'insert into "notification_household_invitation_event"',
      )
    ) {
      state.notificationHouseholdInvitationEvents.push({
        eventId: params[0] as string,
        invitationId: (params[1] as string | undefined) ?? null,
      });
      return [];
    }

    if (query.startsWith('insert into "notification_delivery"')) {
      for (let index = 0; index < params.length; index += 3) {
        state.notificationDeliveries.push({
          id: params[index] as string,
          eventId: params[index + 1] as string,
          recipientUserId: params[index + 2] as string,
          readAt: null,
          dismissedAt: null,
        });
      }
      return [];
    }

    if (query.startsWith('insert into "user_email"')) {
      const email = params[0] as string;
      if (state.userEmails.some((candidate) => candidate.email === email)) {
        return [];
      }
      state.userEmails.push({
        email,
        userId: params[1] as string,
        verified: params[2] as boolean,
        isPrimary: params[3] as boolean,
        createdAt: date,
        updatedAt: date,
      });
      return [];
    }

    if (query.startsWith('insert into "member"')) {
      const member: MemberRow = {
        id: params[0] as string,
        organizationId: params[1] as string,
        userId: params[2] as string,
        role: (params[3] as string | undefined) ?? "member",
        createdAt: date,
      };
      const exists = state.members.some(
        (existing) => existing.userId === member.userId,
      );
      if (exists) return [];
      state.members.push(member);
      return [memberRow(member)];
    }

    if (query.startsWith('insert into "invitation"')) {
      const invitation: InvitationRow = {
        id: params[0] as string,
        organizationId: params[1] as string,
        email: params[2] as string,
        role: params[3] as string,
        status: params[4] as string,
        expiresAt: new Date(params[5] as string | Date),
        inviterId: params[6] as string,
        createdAt: date,
      };
      state.invitations.push(invitation);
      return [invitationRow(invitation)];
    }

    if (query.startsWith('insert into "user_diet_profile"')) {
      const existing = state.dietProfiles.find(
        (candidate) => candidate.userId === params[0],
      );
      if (existing) {
        existing.recipeMatchMode = params[1] as DietProfileRow["recipeMatchMode"];
        existing.updatedAt = date;
        return [dietProfileRow(existing)];
      }
      const profile: DietProfileRow = {
        userId: params[0] as string,
        recipeMatchMode: params[1] as DietProfileRow["recipeMatchMode"],
        createdAt: date,
        updatedAt: date,
      };
      state.dietProfiles.push(profile);
      return [dietProfileRow(profile)];
    }

    if (query.startsWith('insert into "user_recipe_box"')) {
      const userId = params[0] as string;
      const existing = state.recipeBoxes.find((box) => box.userId === userId);
      if (existing) {
        existing.updatedAt = date;
      } else {
        state.recipeBoxes.push({ userId, completedAt: date, updatedAt: date });
      }
      return [];
    }

    if (query.startsWith('insert into "user_recipe_box_item"')) {
      for (let index = 0; index < params.length; index += 2) {
        state.recipeBoxItems.push({
          userId: params[index] as string,
          recipeSlug: params[index + 1] as string,
        });
      }
      return [];
    }

    if (query.startsWith('insert into "user_diet_preset"')) {
      for (let index = 0; index < params.length; index += 2) {
        state.userDietPresets.push({
          userId: params[index] as string,
          presetKey: params[index + 1] as string,
        });
      }
      return [];
    }

    if (query.startsWith('insert into "user_diet_excluded_ingredient"')) {
      for (let index = 0; index < params.length; index += 2) {
        state.userDietExcludedIngredients.push({
          userId: params[index] as string,
          ingredientSlug: params[index + 1] as string,
        });
      }
      return [];
    }

    if (query.startsWith('insert into "user_diet_excluded_group"')) {
      for (let index = 0; index < params.length; index += 2) {
        state.userDietExcludedGroups.push({
          userId: params[index] as string,
          groupKey: params[index + 1] as string,
        });
      }
      return [];
    }

    if (query.startsWith('update "invitation" set "status"')) {
      if (state.expireInvitationOnUpdate) {
        const invitationId = params[1] as string;
        const expiring = state.invitations.find(
          (candidate) => candidate.id === invitationId,
        );
        if (expiring) expiring.expiresAt = new Date(0);
        state.expireInvitationOnUpdate = false;
      }
      const status = params[0] as string;
      const invitationId = params[1] as string;
      const hasHouseholdFilter = query.includes(
        '"invitation"."organization_id"',
      );
      const householdId = hasHouseholdFilter
        ? (params[2] as string)
        : undefined;
      const pendingStatus = hasHouseholdFilter
        ? (params[3] as string | undefined)
        : (params[2] as string | undefined);
      const expiresAfter = query.includes('"invitation"."expires_at" >')
        ? new Date(params[3] as string)
        : undefined;
      const invitation = state.invitations.find(
        (candidate) =>
          candidate.id === invitationId &&
          (!householdId || candidate.organizationId === householdId) &&
          (!pendingStatus || candidate.status === pendingStatus) &&
          (!expiresAfter || candidate.expiresAt > expiresAfter),
      );
      if (!invitation) return [];
      invitation.status = status;
      return query.includes("returning") ? [invitationRow(invitation)] : [];
    }

    if (query.startsWith('update "notification_delivery"')) {
      const placeholderValue = (pattern: RegExp) => {
        const match = query.match(pattern);
        return match ? params[Number(match[1]) - 1] : undefined;
      };
      const readAt = placeholderValue(/set[\s\S]*?"read_at" = \$(\d+)/);
      const dismissedAt = placeholderValue(
        /set[\s\S]*?"dismissed_at" = \$(\d+)/,
      );
      const deliveryId = placeholderValue(
        /where[\s\S]*?"notification_delivery"\."id" = \$(\d+)/,
      ) as string | undefined;
      const recipientUserId = placeholderValue(
        /where[\s\S]*?"notification_delivery"\."recipient_user_id" = \$(\d+)/,
      ) as string | undefined;
      const eventPlaceholders =
        query
          .match(/"notification_delivery"\."event_id" in \(([^)]+)\)/)?.[1]
          ?.match(/\$(\d+)/g) ?? [];
      const eventIds = new Set(
        eventPlaceholders.map(
          (placeholder) => params[Number(placeholder.slice(1)) - 1] as string,
        ),
      );
      for (const delivery of state.notificationDeliveries) {
        if (
          (!deliveryId || delivery.id === deliveryId) &&
          (!recipientUserId || delivery.recipientUserId === recipientUserId) &&
          (eventIds.size === 0 || eventIds.has(delivery.eventId)) &&
          (!query.includes('"read_at" is null') || !delivery.readAt) &&
          (!query.includes('"dismissed_at" is null') || !delivery.dismissedAt)
        ) {
          if (readAt !== undefined) delivery.readAt = readAt as Date | null;
          if (dismissedAt !== undefined) {
            delivery.dismissedAt = dismissedAt as Date | null;
          }
        }
      }
      return [];
    }

    if (query.startsWith('update "user_email"')) {
      const setsPrimaryOnly = query.includes('set "is_primary" =');
      if (setsPrimaryOnly) {
        const userId = params.at(-2) as string;
        const excludedEmail = params.at(-1) as string;
        for (const candidate of state.userEmails) {
          if (candidate.userId === userId && candidate.email !== excludedEmail) {
            candidate.isPrimary = false;
          }
        }
        return [];
      }

      const email = params.at(-2) as string;
      const userId = params.at(-1) as string;
      const candidate = state.userEmails.find(
        (item) => item.email === email && item.userId === userId,
      );
      if (candidate) {
        candidate.verified = params[0] as boolean;
        candidate.isPrimary = params[1] as boolean;
        candidate.updatedAt = date;
      }
      return [];
    }

    if (query.startsWith('update "organization"')) {
      const householdId = params.at(-1) as string;
      const organization = state.organizations.find(
        (candidate) => candidate.id === householdId,
      );
      if (!organization) return [];
      organization.name = params[0] as string;
      organization.updatedAt = date;
      return query.includes("returning") ? [organizationRow(organization)] : [];
    }

    if (query.startsWith('delete from "app_rate_limit"')) {
      state.rateLimitSweeps += 1;
      return [];
    }

    if (query.startsWith('delete from "member"')) {
      const memberId = params[0] as string;
      state.members = state.members.filter((member) => member.id !== memberId);
      return [];
    }

    if (query.startsWith('delete from "organization"')) {
      const householdId = params[0] as string;
      state.organizations = state.organizations.filter(
        (organization) => organization.id !== householdId,
      );
      state.members = state.members.filter(
        (member) => member.organizationId !== householdId,
      );
      state.invitations = state.invitations.filter(
        (invitation) => invitation.organizationId !== householdId,
      );
      return [];
    }

    if (query.startsWith('delete from "user_diet_preset"')) {
      const userId = params[0] as string;
      state.userDietPresets = state.userDietPresets.filter(
        (selection) => selection.userId !== userId,
      );
      return [];
    }

    if (query.startsWith('delete from "user_diet_excluded_ingredient"')) {
      const userId = params[0] as string;
      state.userDietExcludedIngredients =
        state.userDietExcludedIngredients.filter(
          (selection) => selection.userId !== userId,
        );
      return [];
    }

    if (query.startsWith('delete from "user_diet_excluded_group"')) {
      const userId = params[0] as string;
      state.userDietExcludedGroups = state.userDietExcludedGroups.filter(
        (selection) => selection.userId !== userId,
      );
      return [];
    }

    if (query.startsWith('delete from "user_recipe_box_item"')) {
      const userId = params[0] as string;
      state.recipeBoxItems = state.recipeBoxItems.filter(
        (item) => item.userId !== userId,
      );
      return [];
    }

    if (query.startsWith('update "recipe"')) {
      if (
        query.includes('"recipe"."user_id"') &&
        query.includes('"recipe"."visibility"') &&
        !query.includes('"recipe"."id"')
      ) {
        const visibility = params[0] as RecipeRow["visibility"];
        const userId = params.at(-1) as string;
        for (const recipe of state.recipes) {
          if (recipe.visibility === "household" && recipe.userId === userId) {
            recipe.visibility = visibility;
            recipe.updatedAt = date;
          }
        }
        return [];
      }

      const recipeId = params.at(-2) as string;
      const userId = params.at(-1) as string;
      const recipe = state.recipes.find(
        (candidate) => candidate.id === recipeId && candidate.userId === userId,
      );
      if (!recipe) return [];
      recipe.visibility = params[0] as RecipeRow["visibility"];
      recipe.updatedAt = date;
      return [recipeRow(recipe)];
    }

    if (query.includes('from "organization"') && query.includes('"organization"."id"')) {
      const householdId = params[0] as string;
      return state.organizations
        .filter((organization) => organization.id === householdId)
        .map(organizationRow);
    }

    if (
      query.includes('count(*)') &&
      query.includes('from "notification_delivery"')
    ) {
      const recipientUserId = params[0] as string | undefined;
      return [
        [
          state.notificationDeliveries.filter(
            (delivery) =>
              (!recipientUserId ||
                delivery.recipientUserId === recipientUserId) &&
              !delivery.readAt &&
              !delivery.dismissedAt,
          ).length,
        ],
      ];
    }

    if (
      query.includes('from "notification_delivery"') &&
      query.includes('inner join "notification_event"')
    ) {
      const selectsBase = query.includes('"notification_event"."actor_user_id"');
      const notificationId = query.includes('"notification_delivery"."id" =')
        ? (params[0] as string)
        : undefined;
      const recipientUserId = (notificationId ? params[1] : params[0]) as
        | string
        | undefined;
      return state.notificationDeliveries
        .filter(
          (delivery) =>
            (!notificationId || delivery.id === notificationId) &&
            (!recipientUserId || delivery.recipientUserId === recipientUserId) &&
            !delivery.dismissedAt,
        )
        .map((delivery) => {
          const event = state.notificationEvents.find(
            (candidate) => candidate.id === delivery.eventId,
          )!;
          return selectsBase
            ? [
                delivery.id,
                event.id,
                event.kind,
                event.actorUserId,
                event.actorNameSnapshot,
                delivery.readAt,
                event.occurredAt,
              ]
            : [event.id, event.kind];
        });
    }

    if (
      query.includes('from "notification_household_invitation_event"') &&
      !query.includes('join')
    ) {
      if (query.includes('"invitation_id" =')) {
        const invitationId = params[0] as string;
        return state.notificationHouseholdInvitationEvents
          .filter((row) => row.invitationId === invitationId)
          .map((row) => [row.eventId]);
      }
      const eventId = params[0] as string;
      return state.notificationHouseholdInvitationEvents
        .filter((row) => row.eventId === eventId)
        .map((row) => [row.invitationId]);
    }

    if (
      query.includes('from "notification_household_event"') &&
      query.includes('left join "notification_household_invitation_event"')
    ) {
      const eventIds = new Set(params as string[]);
      return state.notificationHouseholdEvents
        .filter((row) => eventIds.has(row.eventId))
        .map((row) => {
          const invitationEvent =
            state.notificationHouseholdInvitationEvents.find(
              (candidate) => candidate.eventId === row.eventId,
            );
          const invitation = state.invitations.find(
            (candidate) => candidate.id === invitationEvent?.invitationId,
          );
          return [
            row.eventId,
            row.householdId,
            row.householdNameSnapshot,
            invitation?.status ?? null,
            invitation?.expiresAt ?? null,
          ];
        });
    }

    if (
      query.includes('from "user"') &&
      query.includes('"user"."email" =')
    ) {
      const email = params[0] as string;
      return state.users
        .filter((candidate) => candidate.email === email)
        .map((candidate) => [candidate.id]);
    }

    if (
      query.includes('from "user_email"') &&
      query.includes('"user_email"."email" =')
    ) {
      const email = params[0] as string;
      const verified = params[1] as boolean | undefined;
      return state.userEmails
        .filter(
          (candidate) =>
            candidate.email === email &&
            (verified === undefined || candidate.verified === verified),
        )
        .map((candidate) => [candidate.userId]);
    }

    if (query.includes('from "user_email"')) {
      const userId = params[0] as string;
      const verified = params[1] as boolean;
      return state.userEmails
        .filter(
          (candidate) =>
            candidate.userId === userId && candidate.verified === verified,
        )
        .map((candidate) => [candidate.email]);
    }

    if (
      query.includes('from "member"') &&
      query.includes('inner join "organization"')
    ) {
      const userId = params[0] as string;
      return state.members
        .filter((member) => member.userId === userId)
        .map((member) => {
          const organization = state.organizations.find(
            (candidate) => candidate.id === member.organizationId,
          )!;
          return [
            organization.id,
            organization.name,
            organization.slug,
            organization.logo,
            organization.createdAt,
            organization.updatedAt,
            member.id,
            member.role,
          ];
        });
    }

    if (query.includes('from "member"') && query.includes('inner join "user"')) {
      const householdId = params[0] as string;
      return state.members
        .filter((member) => member.organizationId === householdId)
        .map((member) => {
          const user = state.users.find((candidate) => candidate.id === member.userId)!;
          return [
            member.id,
            member.organizationId,
            member.userId,
            member.role,
            member.createdAt,
            user.id,
            user.email,
            user.name,
            user.image,
          ];
        });
    }

    if (
      query.includes('from "member"') &&
      query.includes('"member"."organization_id"') &&
      query.includes('"member"."role"')
    ) {
      const householdId = params[0] as string;
      const role = params[1] as string;
      return state.members
        .filter(
          (member) =>
            member.organizationId === householdId && member.role === role,
        )
        .map(memberRow);
    }

    if (
      query.includes('from "member"') &&
      query.includes('"member"."id"') &&
      query.includes('"member"."organization_id"')
    ) {
      const memberId = params[0] as string;
      const householdId = params[1] as string;
      return state.members
        .filter(
          (member) =>
            member.id === memberId && member.organizationId === householdId,
        )
        .map(memberRow);
    }

    if (
      query.includes('from "member"') &&
      query.includes('"member"."organization_id"') &&
      query.includes('"member"."user_id"') &&
      params.length > 1
    ) {
      const householdId = params[0] as string;
      const userId = params[1] as string;
      return state.members
        .filter(
          (member) =>
            member.organizationId === householdId && member.userId === userId,
        )
        .map((member) => (query.includes('"member"."id"') ? [member.id] : memberRow(member)));
    }

    if (
      query.includes('from "member"') &&
      query.includes('"member"."organization_id"') &&
      params.length === 1
    ) {
      const householdId = params[0] as string;
      return state.members
        .filter((member) => member.organizationId === householdId)
        .map((member) => [member.userId]);
    }

    if (
      query.includes('from "member"') &&
      query.includes('"member"."user_id"')
    ) {
      const userId = params[0] as string;
      return state.members
        .filter((member) => member.userId === userId)
        .map(memberRow);
    }

    if (
      query.includes('from "invitation"') &&
      query.includes('inner join "organization"')
    ) {
      const statusIndex = params.indexOf("pending");
      const emails = new Set(params.slice(0, statusIndex) as string[]);
      const status = params[statusIndex] as string;
      const expiresAfter = new Date(params[statusIndex + 1] as string);
      return state.invitations
        .filter(
          (invitation) =>
            emails.has(invitation.email) &&
            invitation.status === status &&
            invitation.expiresAt > expiresAfter,
        )
        .map((invitation) => {
          const organization = state.organizations.find(
            (candidate) => candidate.id === invitation.organizationId,
          );
          return [
            ...invitationRow(invitation),
            organization?.id,
            organization?.name,
          ];
        });
    }

    if (
      query.includes('from "invitation"') &&
      query.includes('"invitation"."organization_id"') &&
      query.includes('"invitation"."status"') &&
      !query.includes('"invitation"."email"')
    ) {
      const organizationId = params[0] as string;
      const status = params[1] as string;
      return state.invitations
        .filter(
          (invitation) =>
            invitation.organizationId === organizationId &&
            invitation.status === status,
        )
        .map(invitationRow);
    }

    if (query.includes('from "invitation"') && query.includes('"invitation"."id"')) {
      const invitationId = params[0] as string;
      return state.invitations
        .filter((invitation) => invitation.id === invitationId)
        .map(invitationRow);
    }

    if (
      query.includes('from "invitation"') &&
      query.includes('"invitation"."email"')
    ) {
      const organizationId = params[0] as string;
      const email = params[1] as string;
      const status = params[2] as string;
      const expiresAfterValue = params[3];
      const expiresAfter = expiresAfterValue
        ? new Date(expiresAfterValue as string)
        : undefined;
      return state.invitations
        .filter(
          (invitation) =>
            invitation.organizationId === organizationId &&
            invitation.email === email &&
            invitation.status === status &&
            (!expiresAfter || invitation.expiresAt > expiresAfter),
        )
        .map(invitationRow);
    }

    if (
      query.includes('from "recipe"') &&
      query.includes('inner join "user"') &&
      query.includes('group by')
    ) {
      const publicRecipes = state.recipes.filter(
        (recipe) => recipe.visibility === "public",
      );
      const grouped = new Map<string, RecipeRow[]>();
      for (const recipe of publicRecipes) {
        const recipes = grouped.get(recipe.userId) ?? [];
        recipes.push(recipe);
        grouped.set(recipe.userId, recipes);
      }
      return Array.from(grouped, ([userId, recipes]) => {
        const user = state.users.find((candidate) => candidate.id === userId)!;
        const latest = [...recipes].sort(
          (first, second) =>
            second.createdAt.getTime() - first.createdAt.getTime() ||
            second.id.localeCompare(first.id),
        )[0]!;
        return [user.id, user.name, user.image, recipes.length, latest.title];
      });
    }

    if (
      query.includes('from "recipe"') &&
      query.includes('inner join "user"') &&
      query.includes('"user"."id" =')
    ) {
      const cookId = params[1] as string;
      const user = state.users.find((candidate) => candidate.id === cookId);
      if (!user) return [];
      return state.recipes
        .filter(
          (recipe) =>
            recipe.userId === cookId && recipe.visibility === "public",
        )
        .sort(
          (first, second) =>
            second.createdAt.getTime() - first.createdAt.getTime() ||
            second.id.localeCompare(first.id),
        )
        .slice(0, 30)
        .map((recipe) => [
          ...recipeRow(recipe),
          user.id,
          user.name,
          user.image,
        ]);
    }

    if (
      query.includes('from "recipe"') &&
      query.includes('"recipe"."slug" =') &&
      query.includes('"recipe"."user_id" =')
    ) {
      const slug = params[0] as string;
      const userId = params[1] as string;
      return state.recipes
        .filter((recipe) => recipe.slug === slug && recipe.userId === userId)
        .map(recipeRow);
    }

    if (
      query.includes('from "recipe"') &&
      query.includes('"recipe"."user_id" =') &&
      !query.includes('"recipe"."visibility" =')
    ) {
      const userId = params[0] as string;
      return paginatedRecipeRows(
        state.recipes.filter((recipe) => recipe.userId === userId),
        query,
        params,
        1,
      );
    }

    if (
      query.includes('from "recipe"') &&
      query.includes('"recipe"."slug" =')
    ) {
      const slug = params[0] as string;
      return state.recipes
        .filter((recipe) => recipe.slug === slug)
        .map(recipeRow);
    }

    if (query.includes('from "recipe"')) {
      const trailingParams =
        (query.includes("::timestamptz") ? 3 : 0) +
        (query.includes("limit ") ? 1 : 0);
      const filterParams = params.slice(0, params.length - trailingParams);
      const publicVisibility = filterParams[0] as string | undefined;
      const ownerUserId = filterParams[1] as string | undefined;
      const householdVisibilityIndex = filterParams.indexOf("household");
      const householdUserIds =
        householdVisibilityIndex >= 0
          ? new Set(filterParams.slice(householdVisibilityIndex + 1))
          : new Set();

      return paginatedRecipeRows(
        state.recipes.filter(
          (recipe) =>
            recipe.visibility === publicVisibility ||
            recipe.userId === ownerUserId ||
            (recipe.visibility === "household" &&
              householdUserIds.has(recipe.userId)),
        ),
        query,
        params,
        filterParams.length,
      );
    }

    if (query.includes('from "diet_preset_excluded_group"')) {
      return state.dietPresetExcludedGroups.map((row) => [
        row.presetKey,
        row.groupKey,
      ]);
    }

    if (query.includes('from "diet_preset_excluded_ingredient"')) {
      return state.dietPresetExcludedIngredients.map((row) => [
        row.presetKey,
        row.ingredientSlug,
      ]);
    }

    if (query.includes('from "ingredient_group_member"')) {
      return state.ingredientGroupMembers.map((row) => [
        row.groupKey,
        row.ingredientSlug,
      ]);
    }

    if (query.includes('from "diet_preset"')) {
      if (params.length > 0) {
        const keys = new Set(params as string[]);
        return state.dietPresets
          .filter((preset) => keys.has(preset.key))
          .map((preset) => [preset.key]);
      }
      return state.dietPresets.map((preset) => [
        preset.key,
        preset.label,
        preset.description,
      ]);
    }

    if (query.includes('from "ingredient_group"')) {
      if (params.length > 0) {
        const keys = new Set(params as string[]);
        return state.ingredientGroups
          .filter((group) => keys.has(group.key))
          .map((group) => [group.key]);
      }
      return state.ingredientGroups.map((group) => [
        group.key,
        group.label,
        group.description,
      ]);
    }

    if (query.includes('from "ingredient"')) {
      if (params.length > 0) {
        const slugs = new Set(params as string[]);
        return state.ingredients
          .filter((ingredient) => slugs.has(ingredient.slug))
          .map((ingredient) => [ingredient.slug]);
      }
      return state.ingredients.map((ingredient) => [
        ingredient.slug,
        ingredient.name,
        ingredient.category,
      ]);
    }

    if (query.includes('from "user_diet_preset"')) {
      const userId = params[0] as string;
      return state.userDietPresets
        .filter((selection) => selection.userId === userId)
        .map((selection) => [selection.presetKey]);
    }

    if (query.includes('from "user_diet_excluded_ingredient"')) {
      const userId = params[0] as string;
      return state.userDietExcludedIngredients
        .filter((selection) => selection.userId === userId)
        .map((selection) => [selection.ingredientSlug]);
    }

    if (query.includes('from "user_diet_excluded_group"')) {
      const userId = params[0] as string;
      return state.userDietExcludedGroups
        .filter((selection) => selection.userId === userId)
        .map((selection) => [selection.groupKey]);
    }

    if (query.includes('from "user_diet_profile"')) {
      const userId = params[0] as string;
      return state.dietProfiles
        .filter((profile) => profile.userId === userId)
        .map(dietProfileRow);
    }

    if (query.includes('from "user_recipe_box_item"')) {
      const userId = params[0] as string;
      return state.recipeBoxItems
        .filter((item) => item.userId === userId)
        .map((item) => [item.recipeSlug]);
    }

    if (query.includes('from "user_recipe_box"')) {
      const userId = params[0] as string;
      return state.recipeBoxes
        .filter((box) => box.userId === userId)
        .map((box) => [box.completedAt]);
    }

    if (query.startsWith('insert into "verification"')) {
      return [params];
    }

    return [];
  }

  return { date, state, reset, queryRows };
});

vi.mock("../src/http/authorization", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/http/authorization")>();
  return {
    ...actual,
    loadBetterAuthSession: vi.fn(() => Promise.resolve(authzMock.session)),
  };
});

vi.mock("postgres", () => ({
  default: vi.fn(() => {
    // drizzle-orm/postgres-js/driver.js writes transparent parsers into
    // client.options.parsers / .serializers at construction time, so the mock
    // client must expose those empty objects. Queries go through:
    //   client.unsafe(sql, params).values() — SELECT (drizzle maps array-of-arrays)
    //   client.unsafe(sql, params)          — DML
    const queryResult = (rows: unknown[][] = []) =>
      Object.assign(Promise.resolve(rows), {
        values: () => Promise.resolve(rows),
      });
    const emptyResult = queryResult();
    const client = Object.assign(
      (_strings: TemplateStringsArray, ..._values: unknown[]) => emptyResult,
      {
        options: { parsers: {}, serializers: {} },
        unsafe: (query: string, params: unknown[] = []) => {
          const rows = dbMock.queryRows(query, params);
          return rows.length > 0 ? queryResult(rows) : emptyResult;
        },
        begin: <T>(transaction: (sql: unknown) => Promise<T>) =>
          transaction(client),
        end: (_options?: { timeout?: number }) => Promise.resolve(),
      },
    );
    return client;
  }),
}));

vi.mock("jose", () => ({
  createRemoteJWKSet: vi.fn(() => vi.fn()),
  jwtVerify: vi.fn(() => Promise.resolve({ payload: { sub: "tester" } })),
}));

import handler, { app } from "../src/index";

// Route ids are validated as UUIDs before any query runs, so seeded rows and
// request paths use fixed UUID ids.
const HOUSEHOLD_ID = "11111111-1111-4111-8111-111111111111";
const MISSING_HOUSEHOLD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_MEMBER_ID = "33333333-3333-4333-8333-333333333333";
const MEMBER_MEMBER_ID = "44444444-4444-4444-8444-444444444444";
const INVITATION_ID = "22222222-2222-4222-8222-222222222222";
const PENDING_INVITATION_ID = "55555555-5555-4555-8555-555555555555";
const ALIAS_INVITATION_ID = "66666666-6666-4666-8666-666666666666";
const EXPIRING_INVITATION_ID = "77777777-7777-4777-8777-777777777777";

function sessionFor(user: { id: string; email: string; name: string }) {
  const email = user.email.toLowerCase();
  if (!dbMock.state.userEmails.some((candidate) => candidate.email === email)) {
    dbMock.state.userEmails.push({
      email,
      userId: user.id,
      verified: true,
      isPrimary: true,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
  }
  return {
    user: {
      id: user.id,
      email,
      name: user.name,
      emailVerified: true,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
    session: {
      id: `session-${user.id}`,
      token: `token-${user.id}`,
      userId: user.id,
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
  };
}

function seedHousehold() {
  dbMock.state.users.push(
    {
      id: "owner-user",
      name: "Owner",
      email: "owner@example.test",
      emailVerified: true,
      image: null,
      role: "user",
      banned: null,
      banReason: null,
      banExpires: null,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
    {
      id: "member-user",
      name: "Member",
      email: "member@example.test",
      emailVerified: true,
      image: null,
      role: "user",
      banned: null,
      banReason: null,
      banExpires: null,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
    {
      id: "outsider-user",
      name: "Outsider",
      email: "outsider@example.test",
      emailVerified: true,
      image: null,
      role: "user",
      banned: null,
      banReason: null,
      banExpires: null,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
  );
  dbMock.state.organizations.push({
    id: HOUSEHOLD_ID,
    name: "Owner household",
    slug: "owner-household",
    logo: null,
    metadata: null,
    createdAt: dbMock.date,
    updatedAt: dbMock.date,
  });
  dbMock.state.userEmails.push(
    ...dbMock.state.users.map((user) => ({
      email: user.email,
      userId: user.id,
      verified: user.emailVerified,
      isPrimary: true,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    })),
  );
  dbMock.state.members.push(
    {
      id: OWNER_MEMBER_ID,
      organizationId: HOUSEHOLD_ID,
      userId: "owner-user",
      role: "owner",
      createdAt: dbMock.date,
    },
    {
      id: MEMBER_MEMBER_ID,
      organizationId: HOUSEHOLD_ID,
      userId: "member-user",
      role: "member",
      createdAt: dbMock.date,
    },
  );
}

function seedDietCatalog() {
  dbMock.state.dietPresets.push(
    {
      key: "vegetarian",
      label: "Vegetarian",
      description: "no meat or fish",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
    {
      key: "vegan",
      label: "Vegan",
      description: "no animal products",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
  );
  dbMock.state.ingredientGroups.push(
    {
      key: "shellfish",
      label: "Shellfish",
      description: "prawns, mussels",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
    {
      key: "gluten",
      label: "Gluten",
      description: "wheat, barley, rye",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
    {
      key: "dairy",
      label: "Dairy",
      description: "milk, cheese",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
  );
  dbMock.state.ingredients.push(
    {
      slug: "egg",
      name: "egg",
      category: "protein",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
    {
      slug: "honey",
      name: "honey",
      category: "sweetener",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
    {
      slug: "milk",
      name: "milk",
      category: "dairy",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    },
  );
  dbMock.state.dietPresetExcludedGroups.push(
    { presetKey: "vegetarian", groupKey: "shellfish" },
    { presetKey: "vegan", groupKey: "dairy" },
  );
  dbMock.state.dietPresetExcludedIngredients.push({
    presetKey: "vegan",
    ingredientSlug: "honey",
  });
  dbMock.state.ingredientGroupMembers.push({
    groupKey: "dairy",
    ingredientSlug: "milk",
  });
}

beforeEach(() => {
  authzMock.session = null;
  dbMock.reset();
});

const env = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-that-is-at-least-thirty-two-characters",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
};

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("GET /recipes", () => {
  it("returns recipes list", async () => {
    const res = await app.request("/recipes", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("returns 503 when no connection is configured", async () => {
    const res = await app.request("/recipes", {}, { DATABASE_URL: "" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "No database connection configured (HYPERDRIVE or DATABASE_URL required)",
    });
  });

  it("requires authentication for the owned scope", async () => {
    const res = await app.request("/recipes?scope=owned", {}, env);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("returns only recipes authored by the signed-in user", async () => {
    dbMock.state.recipes.push(
      {
        id: "recipe-owned",
        slug: "my-lentil-soup",
        title: "My Lentil Soup",
        description: null,
        body: null,
        userId: "owner-user",
        visibility: "private",
        createdAt: dbMock.date,
        updatedAt: dbMock.date,
      },
      {
        id: "recipe-public",
        slug: "someone-elses-soup",
        title: "Someone Else's Soup",
        description: null,
        body: null,
        userId: "other-user",
        visibility: "public",
        createdAt: dbMock.date,
        updatedAt: dbMock.date,
      },
    );
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request("/recipes?scope=owned", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      expect.objectContaining({
        slug: "my-lentil-soup",
        title: "My Lentil Soup",
      }),
    ]);
  });

  it.each([
    ["an unknown scope", "/recipes?scope=household", "Invalid recipe scope"],
    ["an invalid cursor", "/recipes?cursor=not-a-cursor", "Invalid recipe query"],
    ["an out-of-range limit", "/recipes?limit=0", "Invalid recipe query"],
  ])("rejects %s with a 400", async (_case, url, error) => {
    const res = await app.request(url, {}, env);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
  });

  it("pages newest-first through recipes when a limit is provided", async () => {
    const recipeIds = [
      "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b01",
      "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b02",
      "0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b03",
    ];
    dbMock.state.recipes.push(
      ...recipeIds.map((id, index) => ({
        id,
        slug: `soup-${index + 1}`,
        title: `Soup ${index + 1}`,
        description: null,
        body: null,
        userId: "other-user",
        visibility: "public" as const,
        createdAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`),
        updatedAt: dbMock.date,
      })),
    );

    const firstRes = await app.request("/recipes?limit=2", {}, env);
    expect(firstRes.status).toBe(200);
    const firstPage = (await firstRes.json()) as {
      items: { slug: string }[];
      nextCursor: string | null;
    };
    expect(firstPage.items.map((recipe) => recipe.slug)).toEqual([
      "soup-3",
      "soup-2",
    ]);
    expect(firstPage.nextCursor).toBeTruthy();

    const secondRes = await app.request(
      `/recipes?limit=2&cursor=${firstPage.nextCursor}`,
      {},
      env,
    );
    expect(secondRes.status).toBe(200);
    const secondPage = (await secondRes.json()) as {
      items: { slug: string }[];
      nextCursor: string | null;
    };
    expect(secondPage.items.map((recipe) => recipe.slug)).toEqual(["soup-1"]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("returns 502 when database query fails", async () => {
    vi.mocked(postgres).mockReturnValueOnce(
      Object.assign(
        () => {},
        {
          options: { parsers: {}, serializers: {} },
          unsafe: () => ({
            values: () => Promise.reject(new Error("connection refused")),
          }),
          end: () => Promise.resolve(),
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any,
    );

    const res = await app.request("/recipes", {}, env);
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Database query failed");
  });
});

describe("GET /recipes/cooks", () => {
  function seedCook() {
    dbMock.state.users.push({
      id: "cook-1",
      name: "Ada Cook",
      email: "ada@example.test",
      emailVerified: true,
      image: null,
      role: null,
      banned: null,
      banReason: null,
      banExpires: null,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    dbMock.state.recipes.push(
      {
        id: "recipe-1",
        slug: "ada-stew",
        title: "Ada's Stew",
        description: null,
        body: null,
        userId: "cook-1",
        visibility: "public",
        createdAt: dbMock.date,
        updatedAt: dbMock.date,
      },
      {
        id: "recipe-private",
        slug: "private-soup",
        title: "Private Soup",
        description: null,
        body: null,
        userId: "cook-1",
        visibility: "private",
        createdAt: dbMock.date,
        updatedAt: dbMock.date,
      },
    );
  }

  it("returns lightweight summaries of cooks with public recipes", async () => {
    seedCook();

    const res = await app.request("/recipes/cooks", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      cooks: [
        {
          id: "cook-1",
          name: "Ada Cook",
          image: null,
          activityCount: 1,
          latestRecipeTitle: "Ada's Stew",
        },
      ],
    });
  });

  it("returns recent public activity for one cook", async () => {
    seedCook();

    const res = await app.request("/recipes/cooks?cook=cook-1", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      cook: {
        id: "cook-1",
        name: "Ada Cook",
        image: null,
        activity: [
          expect.objectContaining({
            type: "recipe_added",
            recipe: expect.objectContaining({
              slug: "ada-stew",
              title: "Ada's Stew",
            }),
          }),
        ],
      },
    });
  });

  it("returns null for a cook without public activity", async () => {
    const res = await app.request("/recipes/cooks?cook=missing", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cook: null });
  });
});

describe("GET /recipes/:slug", () => {
  it("rejects malformed slugs before database access", async () => {
    const res = await app.request(
      "/recipes/Invalid%20Slug",
      {},
      { DATABASE_URL: "" },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Invalid recipe slug",
      details: [
        {
          path: ["slug"],
          message:
            "Slug must use lowercase letters, numbers, and single hyphens between words",
        },
      ],
    });
  });

  it("allows household members to read household-shared recipes", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "shared-soup",
      title: "Shared Soup",
      description: null,
      body: null,
      userId: "owner-user",
      visibility: "household",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request("/recipes/shared-soup", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      slug: "shared-soup",
      title: "Shared Soup",
      visibility: "household",
    });
  });

  it("returns 404 for anonymous household-shared recipe reads", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "shared-soup",
      title: "Shared Soup",
      description: null,
      body: null,
      userId: "owner-user",
      visibility: "household",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });

    const res = await app.request("/recipes/shared-soup", {}, env);

    expect(res.status).toBe(404);
  });

  it("returns 404 for non-member household-shared recipe reads", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "shared-soup",
      title: "Shared Soup",
      description: null,
      body: null,
      userId: "owner-user",
      visibility: "household",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request("/recipes/shared-soup", {}, env);

    expect(res.status).toBe(404);
  });

  it("returns 404 when a stale household share points at a non-member owner", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "stale-soup",
      title: "Stale Soup",
      description: null,
      body: null,
      userId: "outsider-user",
      visibility: "household",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request("/recipes/stale-soup", {}, env);

    expect(res.status).toBe(404);
  });
});

describe("POST /recipes", () => {
  it("requires authentication", async () => {
    const res = await app.request(
      "/recipes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          slug: "private-draft",
          title: "Private Draft",
        }),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("requires saved recipe content", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      "/recipes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          slug: "private-draft",
          title: "Private Draft",
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
  });

  it("rejects malformed saved recipe payloads", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      "/recipes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          slug: "private-draft",
          title: "Private Draft",
          body: JSON.stringify({ version: 1 }),
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: string;
      details: Array<{ path: string[]; message: string }>;
    };
    expect(body.error).toBe("Invalid request body");
    expect(body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["body", "source"] }),
        expect.objectContaining({ path: ["body", "recipe"] }),
      ]),
    );
  });
});

describe("POST /recipes/import-url", () => {
  it("requires authentication before fetching the page", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await app.request(
      "/recipes/import-url",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ url: "https://recipes.example.test/pasta" }),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns an editable Cooklang draft from schema.org Recipe data", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        `<script type="application/ld+json">${JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Recipe",
          name: "Tomato pasta",
          description: "A quick dinner.",
          recipeYield: "2 servings",
          prepTime: "PT5M",
          cookTime: "PT20M",
          recipeIngredient: ["200 g pasta", "400 g tomatoes"],
          recipeInstructions: [
            { "@type": "HowToStep", text: "Boil the pasta." },
            { "@type": "HowToStep", text: "Add the tomatoes." },
          ],
        })}</script>`,
        { headers: { "content-type": "text/html" } },
      ),
    );

    const res = await app.request(
      "/recipes/import-url",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ url: "https://recipes.example.test/pasta" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      title: "Tomato pasta",
      description: "A quick dinner.",
      servings: 2,
      prepTime: 5,
      cookTime: 20,
      url: "https://recipes.example.test/pasta",
      source:
        "@pasta{200%g}\n@tomatoes{400%g}\n\nBoil the pasta.\n\nAdd the tomatoes.",
    });
    fetchSpy.mockRestore();
  });

  it("reports pages without complete Recipe markup", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        '<script type="application/ld+json">{"@type":"Article"}</script>',
        { headers: { "content-type": "text/html" } },
      ),
    );

    const res = await app.request(
      "/recipes/import-url",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ url: "https://recipes.example.test/article" }),
      },
      env,
    );

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: expect.any(String) });
    fetchSpy.mockRestore();
  });
});

describe("profile diet preferences", () => {
  it("requires authentication before returning a diet profile", async () => {
    const res = await app.request("/api/profile/diet", {}, env);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("requires authentication before returning diet options", async () => {
    const res = await app.request("/api/profile/diet/options", {}, env);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("requires authentication before saving a diet profile", async () => {
    const res = await app.request(
      "/api/profile/diet",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          presetDietKeys: [],
          excludedIngredientSlugs: [],
          excludedGroupKeys: [],
          recipeMatchMode: "warn",
        }),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("returns an empty default diet profile when none has been saved", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request("/api/profile/diet", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      presetDietKeys: [],
      excludedIngredientSlugs: [],
      excludedGroupKeys: [],
      recipeMatchMode: "hide",
    });
  });

  it("returns empty diet options when the catalog has not been seeded", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request("/api/profile/diet/options", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      presets: [],
      groups: [],
      ingredients: [],
    });
  });

  it("returns seeded diet options from the catalog", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });
    seedDietCatalog();

    const res = await app.request("/api/profile/diet/options", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      presets: [
        {
          key: "vegan",
          label: "Vegan",
          sub: "no animal products",
          excludedGroupKeys: ["dairy"],
          excludedIngredientSlugs: ["honey"],
        },
        {
          key: "vegetarian",
          label: "Vegetarian",
          sub: "no meat or fish",
          excludedGroupKeys: ["shellfish"],
          excludedIngredientSlugs: [],
        },
      ],
      groups: [
        {
          key: "dairy",
          label: "Dairy",
          sub: "milk, cheese",
          ingredientSlugs: ["milk"],
        },
        {
          key: "gluten",
          label: "Gluten",
          sub: "wheat, barley, rye",
          ingredientSlugs: [],
        },
        {
          key: "shellfish",
          label: "Shellfish",
          sub: "prawns, mussels",
          ingredientSlugs: [],
        },
      ],
      ingredients: [
        { slug: "egg", name: "egg", category: "protein" },
        { slug: "honey", name: "honey", category: "sweetener" },
        { slug: "milk", name: "milk", category: "dairy" },
      ],
    });
  });

  it("creates and updates the signed-in user's diet profile", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });
    seedDietCatalog();

    const createRes = await app.request(
      "/api/profile/diet",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          presetDietKeys: ["vegetarian"],
          excludedIngredientSlugs: ["egg", "egg"],
          excludedGroupKeys: ["shellfish"],
          recipeMatchMode: "warn",
        }),
      },
      env,
    );

    expect(createRes.status).toBe(200);
    expect(await createRes.json()).toEqual({
      presetDietKeys: ["vegetarian"],
      excludedIngredientSlugs: ["egg"],
      excludedGroupKeys: ["shellfish"],
      recipeMatchMode: "warn",
    });

    const updateRes = await app.request(
      "/api/profile/diet",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          presetDietKeys: ["vegan"],
          excludedIngredientSlugs: ["honey"],
          excludedGroupKeys: ["gluten", "dairy"],
          recipeMatchMode: "hide",
        }),
      },
      env,
    );

    expect(updateRes.status).toBe(200);
    expect(await updateRes.json()).toEqual({
      presetDietKeys: ["vegan"],
      excludedIngredientSlugs: ["honey"],
      excludedGroupKeys: ["gluten", "dairy"],
      recipeMatchMode: "hide",
    });
    expect(dbMock.state.dietProfiles).toHaveLength(1);
    expect(dbMock.state.userDietPresets).toEqual([
      { userId: "owner-user", presetKey: "vegan" },
    ]);
    expect(dbMock.state.userDietExcludedIngredients).toEqual([
      { userId: "owner-user", ingredientSlug: "honey" },
    ]);
    expect(dbMock.state.userDietExcludedGroups).toEqual([
      { userId: "owner-user", groupKey: "gluten" },
      { userId: "owner-user", groupKey: "dairy" },
    ]);
  });

  it("rejects validly-shaped diet keys that are not in the catalog", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      "/api/profile/diet",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          presetDietKeys: ["vegetarian"],
          excludedIngredientSlugs: ["egg"],
          excludedGroupKeys: ["shellfish"],
          recipeMatchMode: "warn",
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "Unknown diet reference",
      details: expect.arrayContaining([
        expect.objectContaining({ path: ["presetDietKeys"] }),
        expect.objectContaining({ path: ["excludedIngredientSlugs"] }),
        expect.objectContaining({ path: ["excludedGroupKeys"] }),
      ]),
    });
  });

  it("returns structured validation errors for malformed diet profiles", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      "/api/profile/diet",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          excludedIngredientSlugs: ["Not a slug"],
          recipeMatchMode: "block",
        }),
      },
      env,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: "Invalid request body",
      details: expect.arrayContaining([
        expect.objectContaining({ path: ["excludedIngredientSlugs", 0] }),
        expect.objectContaining({ path: ["recipeMatchMode"] }),
      ]),
    });
  });
});

describe("profile recipe box", () => {
  it("requires authentication", async () => {
    const res = await app.request("/api/profile/recipe-box", {}, env);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("distinguishes an unfinished setup from an intentionally empty box", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const initial = await app.request("/api/profile/recipe-box", {}, env);
    expect(await initial.json()).toEqual({
      completed: false,
      staticRecipeSlugs: [],
    });

    const saved = await app.request(
      "/api/profile/recipe-box",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ staticRecipeSlugs: [] }),
      },
      env,
    );

    expect(saved.status).toBe(200);
    expect(await saved.json()).toEqual({
      completed: true,
      staticRecipeSlugs: [],
    });
  });

  it("deduplicates and replaces selected static recipes", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    await app.request(
      "/api/profile/recipe-box",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({
          staticRecipeSlugs: ["lentil-soup", "overnight-pizza", "lentil-soup"],
        }),
      },
      env,
    );
    const updated = await app.request(
      "/api/profile/recipe-box",
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ staticRecipeSlugs: ["breakfast-flatbreads"] }),
      },
      env,
    );

    expect(await updated.json()).toEqual({
      completed: true,
      staticRecipeSlugs: ["breakfast-flatbreads"],
    });
    expect(dbMock.state.recipeBoxItems).toEqual([
      { userId: "owner-user", recipeSlug: "breakfast-flatbreads" },
    ]);
  });
});

describe("household membership flows", () => {
  it("requires authentication before creating a household", async () => {
    const res = await app.request(
      "/households",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Dinner Club" }),
      },
      env,
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("creates a household with the creator as owner", async () => {
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      "/households",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Dinner Club" }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ name: "Dinner Club" });
    expect(dbMock.state.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "owner-user", role: "owner" }),
      ]),
    );
  });

  it("prevents a user from creating a second household", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      "/households",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Second Household" }),
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "User already belongs to a household",
    });
  });

  it("allows owners to rename their household", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Park Road kitchen" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: HOUSEHOLD_ID,
      name: "Park Road kitchen",
    });
  });

  it("returns pending invitations to household owners", async () => {
    seedHousehold();
    dbMock.state.invitations.push(
      {
        id: PENDING_INVITATION_ID,
        organizationId: HOUSEHOLD_ID,
        email: "new@example.test",
        role: "member",
        status: "pending",
        expiresAt: new Date("2099-01-03T00:00:00.000Z"),
        inviterId: "owner-user",
        createdAt: dbMock.date,
      },
      {
        id: "accepted-invitation",
        organizationId: HOUSEHOLD_ID,
        email: "old@example.test",
        role: "member",
        status: "accepted",
        expiresAt: new Date("2099-01-03T00:00:00.000Z"),
        inviterId: "owner-user",
        createdAt: dbMock.date,
      },
    );
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/invitations`,
      {},
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      expect.objectContaining({
        id: PENDING_INVITATION_ID,
        status: "pending",
      }),
    ]);
  });

  it("returns incoming invitations for the signed-in email", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: PENDING_INVITATION_ID,
      organizationId: HOUSEHOLD_ID,
      email: "invitee@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2099-01-03T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "invitee-user",
      email: "invitee@example.test",
      name: "Invitee",
    });

    const res = await app.request("/households/invitations", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      expect.objectContaining({
        id: PENDING_INVITATION_ID,
        household: { id: HOUSEHOLD_ID, name: "Owner household" },
      }),
    ]);
  });

  it("returns invitations sent to another verified email owned by the account", async () => {
    seedHousehold();
    dbMock.state.userEmails.push({
      email: "invitee.alias@example.test",
      userId: "invitee-user",
      verified: true,
      isPrimary: false,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    dbMock.state.invitations.push({
      id: ALIAS_INVITATION_ID,
      organizationId: HOUSEHOLD_ID,
      email: "invitee.alias@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2099-01-03T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "invitee-user",
      email: "invitee@example.test",
      name: "Invitee",
    });

    const res = await app.request("/households/invitations", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      expect.objectContaining({ id: ALIAS_INVITATION_ID }),
    ]);
  });

  it("allows owners to delete the household", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}`,
      {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(204);
    expect(dbMock.state.organizations).toHaveLength(0);
    expect(dbMock.state.members).toHaveLength(0);
    expect(dbMock.state.notificationEvents).toEqual([
      expect.objectContaining({ kind: "household_deleted" }),
    ]);
    expect(dbMock.state.notificationDeliveries).toEqual([
      expect.objectContaining({ recipientUserId: "member-user" }),
    ]);
  });

  it("lists household members for existing members", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(`/households/${HOUSEHOLD_ID}/members`, {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: OWNER_MEMBER_ID,
          role: "owner",
          user: expect.objectContaining({ email: "owner@example.test" }),
        }),
        expect.objectContaining({
          id: MEMBER_MEMBER_ID,
          role: "member",
          user: expect.objectContaining({ email: "member@example.test" }),
        }),
      ]),
    );
  });

  it("returns 403 when non-members list household members", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request(`/households/${HOUSEHOLD_ID}/members`, {}, env);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Authorization required" });
  });

  it("allows owners to invite household members", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/invitations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: "NewMember@Example.test" }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      householdId: HOUSEHOLD_ID,
      email: "newmember@example.test",
      role: "member",
      status: "pending",
    });
  });

  it("notifies the account that owns an invited verified email alias", async () => {
    seedHousehold();
    dbMock.state.userEmails.push({
      email: "outsider.alias@example.test",
      userId: "outsider-user",
      verified: true,
      isPrimary: false,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/invitations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: "Outsider.Alias@Example.test" }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(dbMock.state.notificationDeliveries).toEqual([
      expect.objectContaining({ recipientUserId: "outsider-user" }),
    ]);
  });

  it("does not notify an account for an invited unverified primary email", async () => {
    seedHousehold();
    const outsider = dbMock.state.users.find(
      (candidate) => candidate.id === "outsider-user",
    );
    const outsiderEmail = dbMock.state.userEmails.find(
      (candidate) => candidate.userId === "outsider-user" && candidate.isPrimary,
    );
    if (!outsider || !outsiderEmail) throw new Error("Missing seeded outsider");
    outsider.email = "unverified@example.test";
    outsider.emailVerified = false;
    outsiderEmail.email = outsider.email;
    outsiderEmail.verified = false;
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/invitations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: outsider.email }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(dbMock.state.notificationDeliveries).toHaveLength(0);
  });

  it("hydrates and accepts an invitation through its generic notification action", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });
    const inviteResponse = await app.request(
      `/households/${HOUSEHOLD_ID}/invitations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: "outsider@example.test" }),
      },
      env,
    );
    expect(inviteResponse.status).toBe(201);

    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });
    const archiveResponse = await app.request("/notifications", {}, env);
    expect(archiveResponse.status).toBe(200);
    const archive = (await archiveResponse.json()) as {
      items: Array<{
        id: string;
        kind: string;
        actions: string[];
        detail: { household: { name: string }; invitationStatus: string };
      }>;
    };
    expect(archive.items).toHaveLength(1);
    expect(archive.items[0]).toMatchObject({
      kind: "household_invited",
      actions: ["accept", "decline"],
      detail: {
        household: { name: "Owner household" },
        invitationStatus: "pending",
      },
    });
    expect(dbMock.state.invitations[0]).toMatchObject({
      status: "pending",
      email: "outsider@example.test",
    });
    expect(dbMock.state.invitations[0]?.expiresAt.getTime()).toBeGreaterThan(
      Date.now(),
    );

    const notificationId = archive.items[0]?.id;
    expect(notificationId).toBeTruthy();
    const actionResponse = await app.request(
      `/notifications/${notificationId}/actions/accept`,
      { method: "POST", headers: { origin: "http://localhost:3000" } },
      env,
    );

    const actionBody = await actionResponse.json();
    expect(actionResponse.status, JSON.stringify(actionBody)).toBe(200);
    expect(actionBody).toMatchObject({
      item: {
        id: notificationId,
        actions: [],
        detail: { invitationStatus: "accepted" },
      },
    });
    expect(dbMock.state.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "outsider-user" }),
      ]),
    );
  });

  it("returns an unread count for the complete notification archive", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });
    for (let index = 0; index < 101; index += 1) {
      dbMock.state.notificationEvents.push({
        id: `event-${index}`,
        kind: "future_activity",
        actorUserId: null,
        actorNameSnapshot: null,
        occurredAt: new Date(dbMock.date.getTime() - index),
      });
      dbMock.state.notificationDeliveries.push({
        id: `delivery-${index}`,
        eventId: `event-${index}`,
        recipientUserId: "owner-user",
        readAt: null,
        dismissedAt: null,
      });
    }

    const res = await app.request("/notifications", {}, env);
    const body = (await res.json()) as {
      items: unknown[];
      nextOffset: number | null;
      unreadCount: number;
    };

    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(100);
    expect(body.nextOffset).toBe(100);
    expect(body.unreadCount).toBe(101);
  });

  it("returns 429 once the owner exceeds the invite rate limit", async () => {
    seedHousehold();
    // Pre-fill the per-account window to its cap so the next invite trips it.
    dbMock.state.rateLimitCounts.set("household-invite:owner-user", 10);
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/invitations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: "newmember@example.test" }),
      },
      env,
    );

    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect(await res.json()).toMatchObject({ error: "Too many requests" });
    // The invitation is rejected before any row is written.
    expect(dbMock.state.invitations).toHaveLength(0);
  });

  it("returns 409 when a pending invitation already exists for the email", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: INVITATION_ID,
      organizationId: HOUSEHOLD_ID,
      email: "newmember@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2099-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/invitations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: "NewMember@Example.test" }),
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "A pending invitation already exists for this email",
    });
    expect(dbMock.state.invitations).toHaveLength(1);
  });

  it("allows a new invitation when the previous pending row has expired", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: "expired-invitation",
      organizationId: HOUSEHOLD_ID,
      email: "newmember@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2020-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/invitations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: "newmember@example.test" }),
      },
      env,
    );

    expect(res.status).toBe(201);
    expect(dbMock.state.invitations).toHaveLength(2);
    expect(dbMock.state.invitations.at(-1)).toMatchObject({
      email: "newmember@example.test",
      status: "pending",
    });
  });

  it("returns 403 when non-owners invite household members", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/invitations`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ email: "newmember@example.test" }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Authorization required" });
  });

  it("allows invited users to accept invitations", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: INVITATION_ID,
      organizationId: HOUSEHOLD_ID,
      email: "outsider@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request(
      `/households/invitations/${INVITATION_ID}/accept`,
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      invitation: { id: INVITATION_ID, status: "accepted" },
      membershipCreated: true,
    });
    expect(dbMock.state.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          organizationId: HOUSEHOLD_ID,
          userId: "outsider-user",
          role: "member",
        }),
      ]),
    );
  });

  it("allows users to accept invitations sent to a verified email alias", async () => {
    seedHousehold();
    dbMock.state.userEmails.push({
      email: "outsider.alias@example.test",
      userId: "outsider-user",
      verified: true,
      isPrimary: false,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    dbMock.state.invitations.push({
      id: ALIAS_INVITATION_ID,
      organizationId: HOUSEHOLD_ID,
      email: "outsider.alias@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2099-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request(
      `/households/invitations/${ALIAS_INVITATION_ID}/accept`,
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(dbMock.state.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "outsider-user" }),
      ]),
    );
  });

  it("does not accept an invitation that expires before its atomic update", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: EXPIRING_INVITATION_ID,
      organizationId: HOUSEHOLD_ID,
      email: "outsider@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2099-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    dbMock.state.expireInvitationOnUpdate = true;
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request(
      `/households/invitations/${EXPIRING_INVITATION_ID}/accept`,
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Invitation is not pending" });
    expect(dbMock.state.members).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "outsider-user" }),
      ]),
    );
  });

  it("does not accept invitations sent to an unverified email alias", async () => {
    seedHousehold();
    dbMock.state.userEmails.push({
      email: "outsider.alias@example.test",
      userId: "outsider-user",
      verified: false,
      isPrimary: false,
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    dbMock.state.invitations.push({
      id: ALIAS_INVITATION_ID,
      organizationId: HOUSEHOLD_ID,
      email: "outsider.alias@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2099-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request(
      `/households/invitations/${ALIAS_INVITATION_ID}/accept`,
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(dbMock.state.members).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "outsider-user" }),
      ]),
    );
  });

  it("returns 403 when a different user accepts an invitation", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: INVITATION_ID,
      organizationId: HOUSEHOLD_ID,
      email: "member@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request(
      `/households/invitations/${INVITATION_ID}/accept`,
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Authorization required" });
  });

  it("prevents a user from accepting an invite while already in a household", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: INVITATION_ID,
      organizationId: "other-household",
      email: "member@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      `/households/invitations/${INVITATION_ID}/accept`,
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "User already belongs to a household",
    });
  });

  it("allows invited users to decline invitations", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: INVITATION_ID,
      organizationId: HOUSEHOLD_ID,
      email: "member@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      `/households/invitations/${INVITATION_ID}/decline`,
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: INVITATION_ID,
      status: "rejected",
    });
  });

  it("prevents declining finalized invitations", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: INVITATION_ID,
      organizationId: HOUSEHOLD_ID,
      email: "member@example.test",
      role: "member",
      status: "accepted",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      `/households/invitations/${INVITATION_ID}/decline`,
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Invitation is not pending",
    });
  });

  it("allows owners to revoke pending invitations", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: INVITATION_ID,
      organizationId: HOUSEHOLD_ID,
      email: "outsider@example.test",
      role: "member",
      status: "pending",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/invitations/${INVITATION_ID}`,
      {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: INVITATION_ID,
      status: "canceled",
    });
  });

  it("prevents owners from revoking finalized invitations", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: INVITATION_ID,
      organizationId: HOUSEHOLD_ID,
      email: "outsider@example.test",
      role: "member",
      status: "accepted",
      expiresAt: new Date("2027-01-02T00:00:00.000Z"),
      inviterId: "owner-user",
      createdAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/invitations/${INVITATION_ID}`,
      {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "Invitation is not pending",
    });
  });

  it("allows owners to revoke members", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "member-soup",
      title: "Member Soup",
      description: null,
      body: null,
      userId: "member-user",
      visibility: "household",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/members/${MEMBER_MEMBER_ID}`,
      {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(204);
    expect(dbMock.state.members).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: MEMBER_MEMBER_ID })]),
    );
    expect(dbMock.state.recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "member-soup",
          visibility: "private",
        }),
      ]),
    );
  });

  it("allows members to leave voluntarily", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "member-soup",
      title: "Member Soup",
      description: null,
      body: null,
      userId: "member-user",
      visibility: "household",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/leave`,
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(204);
    expect(dbMock.state.members).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: MEMBER_MEMBER_ID })]),
    );
    expect(dbMock.state.recipes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "member-soup",
          visibility: "private",
        }),
      ]),
    );
  });

  it("returns 404 when leaving a missing household", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      `/households/${MISSING_HOUSEHOLD_ID}/leave`,
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(404);
  });
});

describe("route id validation", () => {
  it("rejects a malformed household id before any database access", async () => {
    const res = await app.request(
      "/households/not-a-uuid/members",
      {},
      { DATABASE_URL: "" },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid household ID" });
  });

  it("rejects a malformed invitation id", async () => {
    const res = await app.request(
      "/households/invitations/not-a-uuid/accept",
      { method: "POST", headers: { origin: "http://localhost:3000" } },
      env,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid invitation ID" });
  });

  it("rejects a malformed member id", async () => {
    const res = await app.request(
      `/households/${HOUSEHOLD_ID}/members/not-a-uuid`,
      { method: "DELETE", headers: { origin: "http://localhost:3000" } },
      env,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid member ID" });
  });

  it("rejects a malformed notification id", async () => {
    const res = await app.request(
      "/notifications/not-a-uuid",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ read: true }),
      },
      env,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid notification ID" });
  });
});

describe("household recipe sharing", () => {
  it("allows recipe owners to share and unshare with their household", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "private-soup",
      title: "Private Soup",
      description: null,
      body: null,
      userId: "owner-user",
      visibility: "private",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });

    const shareRes = await app.request(
      "/recipes/private-soup/household-share",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
      },
      env,
    );

    expect(shareRes.status).toBe(200);
    expect(await shareRes.json()).toMatchObject({
      slug: "private-soup",
      visibility: "household",
    });

    const unshareRes = await app.request(
      "/recipes/private-soup/household-share",
      {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(unshareRes.status).toBe(200);
    expect(await unshareRes.json()).toMatchObject({
      slug: "private-soup",
      visibility: "private",
    });
  });

  it("allows household members to share their own recipes", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "member-soup",
      title: "Member Soup",
      description: null,
      body: null,
      userId: "member-user",
      visibility: "private",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request(
      "/recipes/member-soup/household-share",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      slug: "member-soup",
      visibility: "household",
    });
  });

  it("returns 403 when a non-member shares to a household", async () => {
    seedHousehold();
    dbMock.state.recipes.push({
      id: "recipe-1",
      slug: "outsider-soup",
      title: "Outsider Soup",
      description: null,
      body: null,
      userId: "outsider-user",
      visibility: "private",
      createdAt: dbMock.date,
      updatedAt: dbMock.date,
    });
    authzMock.session = sessionFor({
      id: "outsider-user",
      email: "outsider@example.test",
      name: "Outsider",
    });

    const res = await app.request(
      "/recipes/outsider-soup/household-share",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Authorization required" });
  });
});

describe("PATCH /recipes/:slug", () => {
  it("rejects malformed slugs before authentication or database access", async () => {
    const res = await app.request(
      "/recipes/-invalid",
      { method: "PATCH" },
      { DATABASE_URL: "" },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Invalid recipe slug",
      details: [
        {
          path: ["slug"],
          message:
            "Slug must use lowercase letters, numbers, and single hyphens between words",
        },
      ],
    });
  });
});

describe("POST /api/auth/sign-in/social", () => {
  it.each(["google", "github"] as const)(
    "uses the public frontend callback for %s",
    async (provider) => {
      const res = await app.request(
        "/api/auth/sign-in/social",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
          },
          body: JSON.stringify({
            provider,
            callbackURL: "/recipes",
            disableRedirect: true,
          }),
        },
        env,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { url: string };
      const providerURL = new URL(body.url);
      expect(providerURL.searchParams.get("redirect_uri")).toBe(
        `http://localhost:3000/api/auth/callback/${provider}`,
      );
    },
  );

  it("returns 503 when the public auth URL is missing", async () => {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      },
      { ...env, BETTER_AUTH_URL: "" },
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Auth configuration is incomplete",
    });
  });

  it("returns 503 when the public auth URL is malformed", async () => {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      },
      { ...env, BETTER_AUTH_URL: "not-a-valid-url" },
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "Auth configuration is invalid",
    });
  });

  it("rejects unsafe browser mutations without a trusted CSRF signal", async () => {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "CSRF validation failed",
      details: [
        {
          path: [],
          message: "Unsafe browser mutations must come from a trusted origin",
        },
      ],
    });
  });

  it("rejects same-site fetch metadata without a trusted origin", async () => {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-site",
        },
        body: JSON.stringify({ provider: "google" }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "CSRF validation failed",
      details: [
        {
          path: [],
          message: "Unsafe browser mutations must come from a trusted origin",
        },
      ],
    });
  });

  it("rejects same-origin fetch metadata without a trusted origin", async () => {
    const res = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "same-origin",
        },
        body: JSON.stringify({ provider: "google" }),
      },
      env,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "CSRF validation failed",
      details: [
        {
          path: [],
          message: "Unsafe browser mutations must come from a trusted origin",
        },
      ],
    });
  });

  it("does not expose raw Better Auth organization endpoints", async () => {
    const res = await app.request(
      "/api/auth/organization/create",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ name: "Bypass", slug: "bypass" }),
      },
      env,
    );

    expect(res.status).toBe(404);
  });
});

describe("preview authentication", () => {
  const previewEnv = {
    DATABASE_URL: env.DATABASE_URL,
    DEPLOYMENT_ENV: "preview",
    BETTER_AUTH_URL: "https://pr-42.personal-site-bu5.pages.dev",
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    PREVIEW_AUTH_PASSWORD: "a-long-random-preview-password",
    CF_ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
    CF_ACCESS_AUD: "preview-audience",
  };

  it("is unavailable outside preview deployments", async () => {
    const res = await app.request(
      "/api/auth/preview/scenarios",
      {},
      env,
    );
    expect(res.status).toBe(404);
  });

  it("does not expose fresh QA sign-up outside preview deployments", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-up",
      { method: "POST" },
      env,
    );
    expect(res.status).toBe(404);
  });

  it("requires complete preview configuration", async () => {
    const res = await app.request(
      "/api/auth/preview/scenarios",
      {},
      { ...previewEnv, CF_ACCESS_AUD: "" },
    );
    expect(res.status).toBe(503);
  });

  it("requires a valid Cloudflare Access assertion", async () => {
    const res = await app.request(
      "/api/auth/preview/scenarios",
      {},
      previewEnv,
    );
    expect(res.status).toBe(403);
  });

  it("protects fresh QA sign-up with Cloudflare Access", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-up",
      {
        method: "POST",
        headers: { origin: previewEnv.BETTER_AUTH_URL },
      },
      previewEnv,
    );
    expect(res.status).toBe(403);
  });

  it("rejects fresh QA sign-up without a trusted CSRF signal", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-up",
      {
        method: "POST",
        headers: { "cf-access-jwt-assertion": "test-assertion" },
      },
      previewEnv,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "CSRF validation failed",
      details: [
        {
          path: [],
          message: "Unsafe browser mutations must come from a trusted origin",
        },
      ],
    });
  });

  it("returns the allowlisted scenarios after Access authorization", async () => {
    const res = await app.request(
      "/api/auth/preview/scenarios",
      { headers: { "cf-access-jwt-assertion": "test-assertion" } },
      previewEnv,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "empty-user" }),
        expect.objectContaining({ id: "user-with-recipes" }),
        expect.objectContaining({ id: "admin-user" }),
      ]),
    );
  });

  it("rejects scenario identifiers that are not allowlisted", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-in",
      {
        method: "POST",
        headers: {
          "cf-access-jwt-assertion": "test-assertion",
          "content-type": "application/json",
          origin: previewEnv.BETTER_AUTH_URL,
        },
        body: JSON.stringify({ scenario: "arbitrary-user" }),
      },
      previewEnv,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Unknown preview scenario" });
  });

  it("returns structured validation errors for malformed preview sign-in bodies", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-in",
      {
        method: "POST",
        headers: {
          "cf-access-jwt-assertion": "test-assertion",
          "content-type": "application/json",
          origin: previewEnv.BETTER_AUTH_URL,
        },
        body: JSON.stringify({ scenario: "" }),
      },
      previewEnv,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Invalid request body",
      details: [
        {
          path: ["scenario"],
          message: expect.any(String),
        },
      ],
    });
  });

  it("returns structured errors for invalid preview sign-in JSON", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-in",
      {
        method: "POST",
        headers: {
          "cf-access-jwt-assertion": "test-assertion",
          "content-type": "application/json",
          origin: previewEnv.BETTER_AUTH_URL,
        },
        body: "{not-json",
      },
      previewEnv,
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Invalid JSON",
      details: [
        {
          path: [],
          message: "Request body must be valid JSON",
        },
      ],
    });
  });

  it("returns unsupported media type for non-JSON preview sign-in bodies", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-in",
      {
        method: "POST",
        headers: {
          "cf-access-jwt-assertion": "test-assertion",
          "content-type": "text/plain",
          origin: previewEnv.BETTER_AUTH_URL,
        },
        body: "empty-user",
      },
      previewEnv,
    );

    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({
      error: "Unsupported media type",
      details: [
        {
          path: [],
          message: "Request body must use application/json",
        },
      ],
    });
  });

  it("rejects preview sign-in without a trusted CSRF signal", async () => {
    const res = await app.request(
      "/api/auth/preview/sign-in",
      {
        method: "POST",
        headers: {
          "cf-access-jwt-assertion": "test-assertion",
          "content-type": "application/json",
        },
        body: JSON.stringify({ scenario: "empty-user" }),
      },
      previewEnv,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "CSRF validation failed",
      details: [
        {
          path: [],
          message: "Unsafe browser mutations must come from a trusted origin",
        },
      ],
    });
  });

  it("does not expose Better Auth's raw password endpoints", async () => {
    for (const path of [
      "/api/auth/sign-in/email",
      "/api/auth/sign-in/email/",
      "/api/auth/sign-up/email",
      "/api/auth/sign-up/email/",
    ]) {
      const res = await app.request(path, { method: "POST" }, previewEnv);
      expect(res.status).toBe(404);
    }
  });
});

describe("unknown routes", () => {
  it("returns 404", async () => {
    const res = await app.request("/unknown", {}, env);
    expect(res.status).toBe(404);
  });
});

describe("scheduled rate-limit cleanup", () => {
  function runScheduled(bindings: typeof env) {
    const pending: Promise<unknown>[] = [];
    const ctx = {
      waitUntil: (p: Promise<unknown>) => pending.push(p),
    } as unknown as ExecutionContext;
    handler.scheduled?.({} as ScheduledController, bindings, ctx);
    return Promise.all(pending);
  }

  it("sweeps stale counters", async () => {
    await runScheduled(env);
    expect(dbMock.state.rateLimitSweeps).toBe(1);
  });

  it("no-ops without a database connection", async () => {
    await runScheduled({ ...env, DATABASE_URL: "" });
    expect(dbMock.state.rateLimitSweeps).toBe(0);
  });
});
