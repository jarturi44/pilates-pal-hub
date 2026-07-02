import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, APP_BASE_URL, main, container, header, h1, text, button, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string }

const Email = ({ name }: Props) => (
  <Html lang="en"><Head /><Preview>Finish your onboarding to get your time slot</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `Hey ${name}, just a nudge` : "Just a nudge"}</Heading>
      <Text style={text}>You're almost there! Remember to finish your onboarding so we can sign you up for a time slot and get you moving.</Text>
      <Text style={text}>All that's left is a shipping address for your equipment and a waiver!</Text>
      <Button href={`${APP_BASE_URL}/onboarding?step=welcome`} style={button}>Finish my onboarding</Button>
      <Text style={footer}>— Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Finish your onboarding to get your time slot",
  displayName: "Onboarding reminder",
  previewData: { name: "Sam" },
} satisfies TemplateEntry;
