import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; commitmentEnd?: string; }

const Email = ({ name, commitmentEnd }: Props) => (
  <Html lang="en"><Head /><Preview>Your 3-month commitment is almost complete</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `${name}, your commitment is almost complete` : "Your commitment is almost complete"}</Heading>
      <Text style={text}>Your initial 3-month commitment ends {commitmentEnd ? `on ${commitmentEnd}` : "soon"}. After that, your subscription continues month-to-month — and you can cancel anytime from your account.</Text>
      <Text style={text}>No action needed unless you'd like to make a change. Thank you for sticking with us through your first three months.</Text>
      <Text style={footer}>— The {SITE_NAME} team</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Your 3-month commitment is almost complete",
  displayName: "Commitment ending",
  previewData: { name: "Sam", commitmentEnd: "August 15, 2026" },
} satisfies TemplateEntry;
