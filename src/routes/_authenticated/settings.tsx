import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/PagePrimitives";

export const Route = createFileRoute("/_authenticated/settings")({
  component: () => (
    <>
      <PageHeader title="Settings" subtitle="Studio configuration." />
      <ComingSoon label="Plans, pricing, and integrations will appear here." />
    </>
  ),
});
