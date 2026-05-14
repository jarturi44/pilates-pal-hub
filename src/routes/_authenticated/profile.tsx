import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, ComingSoon } from "@/components/PagePrimitives";

export const Route = createFileRoute("/_authenticated/profile")({
  component: () => (
    <>
      <PageHeader title="Profile" subtitle="Your account, waiver, intake form, and shipping details." />
      <ComingSoon label="Profile, waiver, intake form, and shipping address will appear here." />
    </>
  ),
});
