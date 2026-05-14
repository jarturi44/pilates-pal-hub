import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/PagePrimitives";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: () => (
    <>
      <PageHeader title="Notifications" />
      <ComingSoon label="Studio updates and reminders will appear here." />
    </>
  ),
});
