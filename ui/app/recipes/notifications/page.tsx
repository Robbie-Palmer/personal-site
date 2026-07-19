import type { Metadata } from "next";
import { NotificationsView } from "@/components/recipes/notifications/notifications-view";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Household invitations and activity for your recipe account.",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return <NotificationsView />;
}
