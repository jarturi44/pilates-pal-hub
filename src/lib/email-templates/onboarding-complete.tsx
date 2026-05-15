import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, APP_BASE_URL, main, container, header, h1, text, button, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; }

const Email = ({ name }: Props) => (
  <Html lang="en"><Head /><Preview>You're all set — welcome to the studio</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `You're all set, ${name}` : "You're all set"}</Heading>
      <Text style={text}>Your intake form and waiver are complete — thank you. You now have full access to your member area.</Text>
      <Text style={text}>If you're on a live session plan, we'll be in touch shortly to assign your recurring slot.</Text>
      <Button href={`${APP_BASE_URL}/home`} style={button}>Open my account</Button>
      <Text style={footer}>— The {SITE_NAME} team</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "You're all set",
  displayName: "Onboarding complete",
  previewData: { name: "Sam" },
} satisfies TemplateEntry;
