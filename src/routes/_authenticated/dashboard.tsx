import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/PagePrimitives";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: () => (
    <>
      <PageHeader title="Dashboard" subtitle="Studio overview." />
      <ComingSoon label="KPIs: active subscribers, today's sessions, and pending fulfillments." />
    </>
  ),
});
