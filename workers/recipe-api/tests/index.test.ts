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
      const readAt = params[0] instanceof Date ? params[0] : date;
      const recipientUserId = params[1] as string | undefined;
      const eventIds = new Set(params.slice(2) as string[]);
      for (const delivery of state.notificationDeliveries) {
        if (
          (!recipientUserId || delivery.recipientUserId === recipientUserId) &&
          (eventIds.size === 0 || eventIds.has(delivery.eventId))
        ) {
          delivery.readAt = readAt;
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
      query.includes('"recipe"."user_id" =')
    ) {
      const userId = params[0] as string;
      return state.recipes
        .filter((recipe) => recipe.userId === userId)
        .map(recipeRow);
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
      const publicVisibility = params[0] as string | undefined;
      const ownerUserId = params[1] as string | undefined;
      const householdVisibilityIndex = params.indexOf("household");
      const householdUserIds =
        householdVisibilityIndex >= 0
          ? new Set(params.slice(householdVisibilityIndex + 1))
          : new Set();

      return state.recipes
        .filter(
          (recipe) =>
            recipe.visibility === publicVisibility ||
            recipe.userId === ownerUserId ||
            (recipe.visibility === "household" &&
              householdUserIds.has(recipe.userId)),
        )
        .map(recipeRow);
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
    id: "household-1",
    name: "Owner household",
    slug: "owner-household",
    logo: null,
    metadata: null,
    createdAt: dbMock.date,
    updatedAt: dbMock.date,
  });
  dbMock.state.members.push(
    {
      id: "owner-member",
      organizationId: "household-1",
      userId: "owner-user",
      role: "owner",
      createdAt: dbMock.date,
    },
    {
      id: "member-member",
      organizationId: "household-1",
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

  it("rejects an unknown recipe scope", async () => {
    const res = await app.request("/recipes?scope=household", {}, env);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid recipe scope" });
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
      "/households/household-1",
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
      id: "household-1",
      name: "Park Road kitchen",
    });
  });

  it("returns pending invitations to household owners", async () => {
    seedHousehold();
    dbMock.state.invitations.push(
      {
        id: "pending-invitation",
        organizationId: "household-1",
        email: "new@example.test",
        role: "member",
        status: "pending",
        expiresAt: new Date("2099-01-03T00:00:00.000Z"),
        inviterId: "owner-user",
        createdAt: dbMock.date,
      },
      {
        id: "accepted-invitation",
        organizationId: "household-1",
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
      "/households/household-1/invitations",
      {},
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      expect.objectContaining({
        id: "pending-invitation",
        status: "pending",
      }),
    ]);
  });

  it("returns incoming invitations for the signed-in email", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: "pending-invitation",
      organizationId: "household-1",
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
        id: "pending-invitation",
        household: { id: "household-1", name: "Owner household" },
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
      id: "alias-invitation",
      organizationId: "household-1",
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
      expect.objectContaining({ id: "alias-invitation" }),
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
      "/households/household-1",
      {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(204);
    expect(dbMock.state.organizations).toHaveLength(0);
    expect(dbMock.state.members).toHaveLength(0);
  });

  it("lists household members for existing members", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "member-user",
      email: "member@example.test",
      name: "Member",
    });

    const res = await app.request("/households/household-1/members", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "owner-member",
          role: "owner",
          user: expect.objectContaining({ email: "owner@example.test" }),
        }),
        expect.objectContaining({
          id: "member-member",
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

    const res = await app.request("/households/household-1/members", {}, env);

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
      "/households/household-1/invitations",
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
      householdId: "household-1",
      email: "newmember@example.test",
      role: "member",
      status: "pending",
    });
  });

  it("hydrates and accepts an invitation through its generic notification action", async () => {
    seedHousehold();
    authzMock.session = sessionFor({
      id: "owner-user",
      email: "owner@example.test",
      name: "Owner",
    });
    const inviteResponse = await app.request(
      "/households/household-1/invitations",
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
      "/households/household-1/invitations",
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
      id: "invitation-1",
      organizationId: "household-1",
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
      "/households/household-1/invitations",
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
      organizationId: "household-1",
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
      "/households/household-1/invitations",
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
      "/households/household-1/invitations",
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
      id: "invitation-1",
      organizationId: "household-1",
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
      "/households/invitations/invitation-1/accept",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      invitation: { id: "invitation-1", status: "accepted" },
      membershipCreated: true,
    });
    expect(dbMock.state.members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          organizationId: "household-1",
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
      id: "alias-invitation",
      organizationId: "household-1",
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
      "/households/invitations/alias-invitation/accept",
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
      id: "expiring-invitation",
      organizationId: "household-1",
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
      "/households/invitations/expiring-invitation/accept",
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
      id: "alias-invitation",
      organizationId: "household-1",
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
      "/households/invitations/alias-invitation/accept",
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
      id: "invitation-1",
      organizationId: "household-1",
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
      "/households/invitations/invitation-1/accept",
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
      id: "invitation-1",
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
      "/households/invitations/invitation-1/accept",
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
      id: "invitation-1",
      organizationId: "household-1",
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
      "/households/invitations/invitation-1/decline",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: "invitation-1",
      status: "rejected",
    });
  });

  it("prevents declining finalized invitations", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: "invitation-1",
      organizationId: "household-1",
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
      "/households/invitations/invitation-1/decline",
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
      id: "invitation-1",
      organizationId: "household-1",
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
      "/households/household-1/invitations/invitation-1",
      {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: "invitation-1",
      status: "canceled",
    });
  });

  it("prevents owners from revoking finalized invitations", async () => {
    seedHousehold();
    dbMock.state.invitations.push({
      id: "invitation-1",
      organizationId: "household-1",
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
      "/households/household-1/invitations/invitation-1",
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
      "/households/household-1/members/member-member",
      {
        method: "DELETE",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(204);
    expect(dbMock.state.members).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "member-member" })]),
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
      "/households/household-1/leave",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(204);
    expect(dbMock.state.members).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "member-member" })]),
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
      "/households/missing-household/leave",
      {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
      },
      env,
    );

    expect(res.status).toBe(404);
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
