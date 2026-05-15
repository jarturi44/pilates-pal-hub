import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";

interface Props { name?: string; accessEnd?: string; }

const Email = ({ name, accessEnd }: Props) => (
  <Html lang="en"><Head /><Preview>Your subscription has been canceled</Preview>
    <Body style={main}><Container style={container}>
      <Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `${name}, your subscription has been canceled` : "Your subscription has been canceled"}</Heading>
      <Text style={text}>We're sorry to see you go. Your access will continue {accessEnd ? `until ${accessEnd}` : "until the end of your current billing period"}.</Text>
      <Text style={text}>If this was a mistake, just reply to this email and we'll get you sorted.</Text>
      <Text style={footer}>— The {SITE_NAME} team</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Your subscription has been canceled",
  displayName: "Subscription canceled",
  previewData: { name: "Sam", accessEnd: "August 15, 2026" },
} satisfies TemplateEntry;
