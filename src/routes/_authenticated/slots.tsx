import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/PagePrimitives";

export const Route = createFileRoute("/_authenticated/slots")({
  component: () => (
    <>
      <PageHeader title="Slots" subtitle="Weekly recurring sessions." />
      <ComingSoon label="Create and manage semi-private and private slots." />
    </>
  ),
});
