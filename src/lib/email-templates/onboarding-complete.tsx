import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, APP_BASE_URL, main, container, header, h1, text, button, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; isLiveSession?: boolean; }

const Email = ({ name, isLiveSession }: Props) => (
  <Html lang="en"><Head /><Preview>Look at you! You're all set up and ready to go.</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `Look at you, ${name}!` : "Look at you!"}</Heading>
      <Text style={text}>You're all set up and ready to go. Your intake form is done, your waiver is signed, and you're officially part of the crew.</Text>
      {isLiveSession && <Text style={text}>I'll be reaching out soon to get you set up in your recurring slot.</Text>}
      <Text style={text}>In the meantime, poke around the app and get comfortable. I got you!</Text>
      <Button href={`${APP_BASE_URL}/portal`} style={button}>Open my account</Button>
      <Text style={footer}>— Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Look at you!",
  displayName: "Onboarding complete",
  previewData: { name: "Sam", isLiveSession: true },
} satisfies TemplateEntry;
