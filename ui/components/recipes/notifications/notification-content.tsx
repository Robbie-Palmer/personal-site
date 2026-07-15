import { Bell, House } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@/components/ui/button";
import type {
  HouseholdNotification,
  InAppNotification,
} from "@/lib/api/notifications";

type RendererProps<T extends InAppNotification = InAppNotification> = Readonly<{
  item: T;
  acting: boolean;
  onAction: (actionKey: string) => void;
}>;

function copyForHousehold(item: HouseholdNotification) {
  const actor = item.actor?.name ?? "Someone";
  const household = item.detail.household.name;
  switch (item.kind) {
    case "household_invited":
      if (item.detail.invitationStatus === "accepted") {
        return `You accepted ${actor}'s invitation to join ${household}.`;
      }
      if (item.detail.invitationStatus === "declined") {
        return `You declined ${actor}'s invitation to join ${household}.`;
      }
      if (item.detail.invitationStatus === "expired") {
        return `${actor}'s invitation to join ${household} expired.`;
      }
      if (item.detail.invitationStatus === "unavailable") {
        return `${actor}'s invitation to join ${household} is no longer available.`;
      }
      return `${actor} invited you to join ${household}.`;
    case "household_removed":
      return `${actor} removed you from ${household}.`;
    case "household_deleted":
      return `${actor} deleted ${household}.`;
    case "household_invite_accepted":
      return `${actor} accepted your invitation to ${household}.`;
    case "household_invite_declined":
      return `${actor} declined your invitation to ${household}.`;
    case "household_member_left":
      return `${actor} left ${household}.`;
  }
}

function HouseholdNotificationContent({
  item,
  acting,
  onAction,
}: RendererProps<HouseholdNotification>) {
  const status =
    item.kind === "household_invited" ? item.detail.invitationStatus : null;
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--ink)] bg-[var(--sage)] text-white">
        <House className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="rt-body text-[0.95rem] text-[var(--ink-2)]">
          {copyForHousehold(item)}
        </p>
        {item.actions.length > 0 && (
          <div className="mt-2 flex gap-2">
            {item.actions.map((actionKey) => (
              <Button
                key={actionKey}
                size="sm"
                variant={actionKey === "accept" ? "default" : "outline"}
                disabled={acting}
                onClick={() => onAction(actionKey)}
              >
                {actionKey === "accept" ? "Accept" : "Decline"}
              </Button>
            ))}
          </div>
        )}
        {status && status !== "pending" && (
          <p className="rt-mono mt-2 capitalize text-[var(--ink-3)]">
            {status === "unavailable" ? "No longer available" : status}
          </p>
        )}
      </div>
    </>
  );
}

function UnsupportedNotificationContent({ item }: RendererProps) {
  return (
    <>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--ink)] bg-[var(--paper-warm)] text-[var(--ink-2)]">
        <Bell className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="rt-body text-[0.95rem] text-[var(--ink-2)]">
          New activity ({item.kind.replaceAll("_", " ")}).
        </p>
      </div>
    </>
  );
}

const renderers: Record<
  NonNullable<InAppNotification["detail"]>["type"],
  ComponentType<RendererProps<HouseholdNotification>>
> = {
  household: HouseholdNotificationContent,
};

export function NotificationContent(props: RendererProps) {
  if (!props.item.detail) return <UnsupportedNotificationContent {...props} />;
  const Renderer = renderers[props.item.detail.type];
  return (
    <Renderer
      item={props.item as HouseholdNotification}
      acting={props.acting}
      onAction={props.onAction}
    />
  );
}
