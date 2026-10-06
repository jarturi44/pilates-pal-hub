import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; }

const Email = ({ name }: Props) => (
  <Html lang="en"><Head />
    <Preview>Today's 10 Minute Mornings video is live in the portal now</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>Today's 10 Minute Mornings video is up now</Heading>
      <Text style={text}>Hi {name ?? "there"},</Text>
      <Text style={text}>Quick heads-up — today's 10 Minute Mornings video went up a little later than usual this morning. It's live in the portal now, so you can squeeze it in whenever works today.</Text>
      <Text style={text}>One question for you: right now reminders go out on Tuesday and Thursday mornings at a set time. <strong>Would you prefer a custom time for your reminder</strong> — like 6:00 AM, right at lunch, or the evening before? Just reply to this email with the time that works best and I'll set it up for you.</Text>
      <Text style={text}>Thanks for rolling with it,</Text>
      <Text style={footer}>Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Today's 10 Minute Mornings video is up now",
  displayName: "Late video notice",
  previewData: { name: "Sam" },
} satisfies TemplateEntry;
