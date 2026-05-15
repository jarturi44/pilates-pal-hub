import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer, card } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; planName?: string; price?: number; commitmentEnd?: string; }

const Email = ({ name, planName, price, commitmentEnd }: Props) => (
  <Html lang="en"><Head /><Preview>Welcome to {SITE_NAME} — your subscription is confirmed</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `Welcome, ${name}!` : "Welcome!"}</Heading>
      <Text style={text}>Your subscription is confirmed. We're so glad you're here.</Text>
      <div style={card}>
        <Text style={{ ...text, margin: 0 }}><strong>Plan:</strong> {planName ?? "—"}</Text>
        {price !== undefined && <Text style={{ ...text, margin: 0 }}><strong>Price:</strong> ${price}/month</Text>}
        {commitmentEnd && <Text style={{ ...text, margin: 0 }}><strong>3-month commitment ends:</strong> {commitmentEnd}</Text>}
      </div>
      <Text style={text}>Next, we'll walk you through a quick intake form and waiver, and you'll be ready to start moving.</Text>
      <Text style={footer}>— The {SITE_NAME} team</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Your subscription is confirmed",
  displayName: "Subscription confirmed",
  previewData: { name: "Sam", planName: "Semi-Private 2x/week", price: 320, commitmentEnd: "August 15, 2026" },
} satisfies TemplateEntry;
