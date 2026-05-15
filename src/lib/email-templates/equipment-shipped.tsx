import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; }

const Email = ({ name }: Props) => (
  <Html lang="en"><Head /><Preview>Your gear is on the way!</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `${name}, your gear is on the way!` : "Your gear is on the way!"}</Heading>
      <Text style={text}>Your foam roller, Pilates ring, resistance bands, stretch strap, and door anchors are headed to you.</Text>
      <Text style={text}>Get excited — we're going to put all of it to good use.</Text>
      <Text style={footer}>See you soon! — Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Your gear is on the way!",
  displayName: "Equipment shipped",
  previewData: { name: "Sam" },
} satisfies TemplateEntry;
