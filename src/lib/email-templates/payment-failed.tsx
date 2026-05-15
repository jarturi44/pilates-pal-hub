import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, button, footer } from "./_styles";

interface Props { name?: string; portalUrl?: string; }

const Email = ({ name, portalUrl }: Props) => (
  <Html lang="en"><Head /><Preview>We couldn't process your latest payment</Preview>
    <Body style={main}><Container style={container}>
      <Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `${name}, we hit a small snag` : "We hit a small snag"}</Heading>
      <Text style={text}>Your latest payment didn't go through. No worries — most often this is a card update on file.</Text>
      <Text style={text}>To keep your access uninterrupted, please update your payment method within the next few days.</Text>
      {portalUrl && <Button href={portalUrl} style={button}>Update payment method</Button>}
      <Text style={footer}>— The {SITE_NAME} team</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Action needed: update your payment method",
  displayName: "Payment failed",
  previewData: { name: "Sam", portalUrl: "https://billing.stripe.com/p/session/example" },
} satisfies TemplateEntry;
