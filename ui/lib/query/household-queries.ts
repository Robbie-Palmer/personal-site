import { queryOptions } from "@tanstack/react-query";
import {
  getHouseholdInvitations,
  getHouseholdMembers,
  getHouseholds,
  getIncomingHouseholdInvitations,
  type Household,
  type HouseholdInvitation,
  type HouseholdMember,
  type IncomingHouseholdInvitation,
} from "@/lib/api/households";
import { errorMessage } from "@/lib/generic/errors";
import { recipeQueryKeys } from "@/lib/query/recipe-query-keys";

export type HouseholdSettingsData = {
  household: Household | null;
  members: HouseholdMember[];
  invitations: HouseholdInvitation[];
  incoming: IncomingHouseholdInvitation[];
  detailError: string | null;
};

function fulfilledValue<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

async function fetchHouseholdSettings(
  signal?: AbortSignal,
): Promise<HouseholdSettingsData> {
  const households = await getHouseholds(signal);
  const household = households[0] ?? null;
  const [incomingResult, membersResult, invitationsResult] =
    await Promise.allSettled([
      getIncomingHouseholdInvitations(signal),
      household
        ? getHouseholdMembers(household.id, signal)
        : Promise.resolve([]),
      household?.membership.role === "owner"
        ? getHouseholdInvitations(household.id, signal)
        : Promise.resolve([]),
    ]);
  const failedResult = [incomingResult, membersResult, invitationsResult].find(
    (result) => result.status === "rejected",
  );

  return {
    household,
    incoming: fulfilledValue(incomingResult, []),
    members: fulfilledValue(membersResult, []),
    invitations: fulfilledValue(invitationsResult, []),
    detailError:
      failedResult?.status === "rejected"
        ? errorMessage(
            failedResult.reason,
            "Some household details couldn't be loaded.",
          )
        : null,
  };
}

export const householdSettingsQuery = (userId: string) =>
  queryOptions({
    queryKey: recipeQueryKeys.householdSettings(userId),
    queryFn: ({ signal }) => fetchHouseholdSettings(signal),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
