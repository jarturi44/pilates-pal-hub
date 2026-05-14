import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/PagePrimitives";

export const Route = createFileRoute("/_authenticated/my-program")({
  component: () => (
    <>
      <PageHeader title="My Program" subtitle="Your weekly slots, plan, and equipment." />
      <ComingSoon label="Your assigned slots and program details will appear here." />
    </>
  ),
});
