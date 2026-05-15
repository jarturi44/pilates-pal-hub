import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, button, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; portalUrl?: string; }

const Email = ({ name, portalUrl }: Props) => (
  <Html lang="en"><Head /><Preview>Hey — quick heads up</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `Hey ${name} — quick heads up` : "Hey — quick heads up"}</Heading>
      <Text style={text}>Just a heads up that your payment didn't go through. No stress, it happens!</Text>
      <Text style={text}>Just update your payment info and we'll get you sorted. I don't want anything getting in the way of your practice.</Text>
      {portalUrl && <Button href={portalUrl} style={button}>Update payment method →</Button>}
      <Text style={footer}>— Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Hey — quick heads up",
  displayName: "Payment failed",
  previewData: { name: "Sam", portalUrl: "https://billing.stripe.com/p/session/example" },
} satisfies TemplateEntry;
