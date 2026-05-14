import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/PagePrimitives";

export const Route = createFileRoute("/_authenticated/clients")({
  component: () => (
    <>
      <PageHeader title="Clients" subtitle="Manage clients, plans, and assigned slots." />
      <ComingSoon label="Client list and details will appear here." />
    </>
  ),
});
