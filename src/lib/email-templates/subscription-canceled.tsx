import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; accessEnd?: string; }

const Email = ({ name, accessEnd }: Props) => (
  <Html lang="en"><Head /><Preview>It's been a pleasure</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>It's been a pleasure</Heading>
      <Text style={text}>{name ? `${name}, it's been such a pleasure having you.` : "It's been such a pleasure having you."} Your subscription has been canceled and your access will continue {accessEnd ? `through ${accessEnd}` : "through the end of your current billing period"}.</Text>
      <Text style={text}>Whenever you're ready to come back, I'll be here.</Text>
      <Text style={footer}>Take care of yourself! — Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "It's been a pleasure",
  displayName: "Subscription canceled",
  previewData: { name: "Sam", accessEnd: "August 15, 2026" },
} satisfies TemplateEntry;
