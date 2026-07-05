import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer, card } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; time?: string; sessionType?: string; }

const Email = ({ name, time, sessionType }: Props) => (
  <Html lang="en"><Head /><Preview>Your session starts soon</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `Starting soon, ${name}!` : "Starting soon!"}</Heading>
      <Text style={text}>Your session starts at <strong>{time ?? "your usual time"}</strong> — about an hour from now. Grab some water and get your space ready.</Text>
      <div style={card}>
        <Text style={{ ...text, margin: 0 }}>Today at <strong>{time}</strong></Text>
        {sessionType && <Text style={{ ...text, margin: 0 }}>{sessionType}</Text>}
      </div>
      <Text style={text}>Log in to your portal a few minutes early to join.</Text>
      <Text style={footer}>See you soon! — Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Your session starts in about an hour",
  displayName: "Session reminder (1h)",
  previewData: { name: "Sam", time: "9:00 AM", sessionType: "One-On-One" },
} satisfies TemplateEntry;
