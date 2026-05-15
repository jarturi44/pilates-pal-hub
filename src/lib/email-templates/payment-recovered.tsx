import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; }

const Email = ({ name }: Props) => (
  <Html lang="en"><Head /><Preview>You're all good!</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `You're all good, ${name}!` : "You're all good!"}</Heading>
      <Text style={text}>Your payment went through and your access is fully restored. Nothing to worry about — just show up and keep going.</Text>
      <Text style={footer}>See you soon! — Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "You're all good!",
  displayName: "Payment recovered",
  previewData: { name: "Sam" },
} satisfies TemplateEntry;
