import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; commitmentEnd?: string; }

const Email = ({ name, commitmentEnd }: Props) => (
  <Html lang="en"><Head /><Preview>Quick heads up on your membership</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `Quick heads up, ${name}` : "Quick heads up"}</Heading>
      <Text style={text}>Your 3-month commitment period wraps up {commitmentEnd ? `on ${commitmentEnd}` : "soon"}. After that you'll just continue month to month, no action needed.</Text>
      <Text style={text}>I just wanted you to know where things stand. Keep going — you're doing great and the best results are still ahead of you!</Text>
      <Text style={footer}>— Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Quick heads up on your membership",
  displayName: "Commitment ending",
  previewData: { name: "Sam", commitmentEnd: "August 15, 2026" },
} satisfies TemplateEntry;
