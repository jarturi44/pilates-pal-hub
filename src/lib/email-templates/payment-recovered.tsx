import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; }

const Email = ({ name }: Props) => (
  <Html lang="en"><Head /><Preview>You're back in — payment recovered</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `Thanks, ${name} — you're back in` : "You're back in"}</Heading>
      <Text style={text}>Your payment went through and your access has been fully restored. Thank you for taking care of it.</Text>
      <Text style={footer}>— The {SITE_NAME} team</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Payment recovered — access restored",
  displayName: "Payment recovered",
  previewData: { name: "Sam" },
} satisfies TemplateEntry;
