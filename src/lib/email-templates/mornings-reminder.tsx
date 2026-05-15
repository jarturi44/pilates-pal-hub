import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, APP_BASE_URL, main, container, header, h1, text, button, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; appUrl?: string; }

const Email = ({ name, appUrl }: Props) => {
  const url = appUrl || `${APP_BASE_URL}/my-program`;
  return (
    <Html lang="en"><Head /><Preview>Psssst! It's time for your 10 minutes.</Preview>
      <Body style={main}><Container style={container}>
        <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
        <Heading style={h1}>{name ? `Psssst, ${name}!` : "Psssst!"}</Heading>
        <Text style={text}>It's time for your 10 minutes. I know life is busy but you've got this — 10 minutes, 10 exercises, and you'll feel better for the rest of your day.</Text>
        <Text style={text}>Little by little you're getting stronger and flexier. Let's go!</Text>
        <Button href={url} style={button}>Open 10 Minute Mornings →</Button>
        <Text style={footer}>— Jon</Text>
      </Container></Body></Html>
  );
};

export const template = {
  component: Email,
  subject: "Psssst! It's time for your 10 minutes.",
  displayName: "10 Minute Mornings reminder",
  previewData: { name: "Sam" },
} satisfies TemplateEntry;
