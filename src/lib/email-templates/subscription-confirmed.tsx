import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer, card } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; planName?: string; price?: number; commitmentEnd?: string; }

const Email = ({ name, planName, price, commitmentEnd }: Props) => (
  <Html lang="en"><Head /><Preview>You're in! Welcome to the family.</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `You're in, ${name}!` : "You're in!"}</Heading>
      <Text style={text}>Welcome to the family. Your {planName ?? "subscription"} is active and you're officially on your way to stronger and more flexible.</Text>
      <div style={card}>
        <Text style={{ ...text, margin: 0 }}><strong>Plan:</strong> {planName ?? "—"}</Text>
        {price !== undefined && <Text style={{ ...text, margin: 0 }}><strong>Price:</strong> ${price}/month</Text>}
        {commitmentEnd && <Text style={{ ...text, margin: 0 }}><strong>Commitment runs through:</strong> {commitmentEnd}</Text>}
      </div>
      <Text style={text}>Plenty of time to feel the difference. Let's get to work.</Text>
      <Text style={footer}>See you soon! — Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "You're in!",
  displayName: "Subscription confirmed",
  previewData: { name: "Sam", planName: "Semi-Private 2x/week", price: 320, commitmentEnd: "August 15, 2026" },
} satisfies TemplateEntry;
