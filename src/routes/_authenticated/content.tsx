import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/PagePrimitives";

export const Route = createFileRoute("/_authenticated/content")({
  component: () => (
    <>
      <PageHeader title="Content" subtitle="10 Minute Mornings library." />
      <ComingSoon label="Upload and curate video content here." />
    </>
  ),
});
