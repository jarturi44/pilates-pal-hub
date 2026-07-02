import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/waiver")({
  component: WaiverPage,
  head: () => ({
    meta: [
      { title: "Liability Waiver" },
      { name: "description", content: "Sign the liability waiver." },
    ],
  }),
});

function WaiverPage() {
  return (
    <iframe
      src="https://docs.google.com/forms/d/e/1FAIpQLScjEUm-QpanbVqUNJJQYWnEHfW9MNzRYNxk6URTeAxT1fP0wg/viewform?embedded=true"
      title="Liability Waiver"
      className="fixed inset-0 w-screen h-screen border-0 block"
      frameBorder={0}
      marginHeight={0}
      marginWidth={0}
    >
      Loading…
    </iframe>
  );
}
