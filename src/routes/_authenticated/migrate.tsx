import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/PagePrimitives";
import { sendTransactionalEmail } from "@/lib/email/send";
import { toast } from "sonner";
import { Loader2, Copy, Send, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/migrate")({
  component: MigratePage,
});

const SITE_ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://pilateswithjon.com";

function buildInviteUrl(name: string, email: string) {
  const params = new URLSearchParams();
  if (name.trim()) params.set("name", name.trim());
  if (email.trim()) params.set("email", email.trim().toLowerCase());
  return `${SITE_ORIGIN}/welcome-back?${params.toString()}`;
}

function MigratePage() {
  const { role } = useAuth();
  if (role && role !== "admin") return <Navigate to="/portal" replace />;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<Array<{ name: string; email: string; at: string }>>([]);

  const inviteUrl = email.trim() ? buildInviteUrl(name, email) : "";

  async function copyLink() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied");
  }

  async function sendInvite() {
    if (!email.trim()) {
      toast.error("Email is required");
      return;
    }
    setSending(true);
    try {
      await sendTransactionalEmail({
        templateName: "welcome-back-invite",
        recipientEmail: email.trim().toLowerCase(),
        idempotencyKey: `welcome-back-${email.trim().toLowerCase()}-${Date.now()}`,
        templateData: { name: name.trim() || undefined, inviteUrl },
      });
      toast.success(`Invite sent to ${email.trim()}`);
      setSent((s) => [{ name, email, at: new Date().toLocaleString() }, ...s]);
      setName("");
      setEmail("");
    } catch (err) {
      toast.error((err as Error).message || "Failed to send invite");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Migrate existing clients"
        subtitle="Send personalized invite links to existing clients so they can set up an account on the new portal."
      />

      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Send an invite</h2>
        <p className="text-sm text-muted-foreground">
          Enter the client's name and email. They'll receive an email with a link
          that pre-fills both fields and skips the $60 intake fee.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Client name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            type="email"
            placeholder="client@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {inviteUrl && (
          <div className="rounded-md bg-muted px-3 py-2 text-xs font-mono break-all">
            {inviteUrl}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyLink}
            disabled={!inviteUrl}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent disabled:opacity-50"
          >
            <Copy className="h-4 w-4" /> Copy link
          </button>
          <button
            type="button"
            onClick={sendInvite}
            disabled={sending || !email.trim()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send invite email
          </button>
        </div>
      </div>

      {sent.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-2">
          <h2 className="text-lg font-semibold">Sent this session</h2>
          <ul className="text-sm space-y-1">
            {sent.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-foreground">{s.name || s.email}</span>
                <span>·</span>
                <span>{s.email}</span>
                <span>·</span>
                <span>{s.at}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
