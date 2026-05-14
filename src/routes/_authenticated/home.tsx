import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/PagePrimitives";

export const Route = createFileRoute("/_authenticated/home")({
  component: () => (
    <>
      <PageHeader title="Welcome back" subtitle="Your home for movement, mindfulness, and progress." />
      <ComingSoon label="Your dashboard, today's session, and 10 Minute Mornings will appear here." />
    </>
  ),
});
