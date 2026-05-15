import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";

export type NotifyArgs = {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  email?: {
    to: string;
    templateName: string;
    idempotencyKey: string;
    templateData?: Record<string, any>;
  };
};

/**
 * Insert an in-app notification and (optionally) send a transactional email.
 * Email failures are logged but never block the in-app notification.
 */
export async function notify(args: NotifyArgs) {
  const { error } = await supabase.from("notifications").insert({
    user_id: args.userId,
    type: args.type,
    title: args.title,
    message: args.message,
    link: args.link ?? null,
  });
  if (error) console.error("notify: insert failed", error);

  if (args.email) {
    try {
      await sendTransactionalEmail({
        templateName: args.email.templateName,
        recipientEmail: args.email.to,
        idempotencyKey: args.email.idempotencyKey,
        templateData: args.email.templateData,
      });
    } catch (e) {
      console.error("notify: email send failed", e);
    }
  }
}
