import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PagePrimitives";
import { ProgressDashboard } from "@/components/ProgressDashboard";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/progress")({
  component: ProgressPage,
});

function ProgressPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title="Progress" subtitle="Your consistency, streaks, and milestones." />
      {user?.id ? <ProgressDashboard userId={user.id} /> : null}
    </>
  );
}
