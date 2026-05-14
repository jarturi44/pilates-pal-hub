import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/PagePrimitives";

export const Route = createFileRoute("/_authenticated/progress")({
  component: () => (
    <>
      <PageHeader title="Progress" subtitle="Attendance and completed sessions." />
      <ComingSoon label="Attendance history and milestones will appear here." />
    </>
  ),
});
