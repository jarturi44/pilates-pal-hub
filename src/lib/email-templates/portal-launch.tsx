import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, APP_BASE_URL, main, container, header, h1, text, button, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; appUrl?: string; }

const Email = ({ name, appUrl }: Props) => {
  const url = appUrl || `${APP_BASE_URL}/portal`;
  return (
    <Html lang="en"><Head /><Preview>Your new portal is live — let's get moving this morning.</Preview>
      <Body style={main}><Container style={container}>
        <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
        <Heading style={h1}>{name ? `Welcome to the new home, ${name}!` : "Welcome to the new home of 10 Minute Mornings!"}</Heading>
        <Text style={text}>The new portal is up and running at <strong>pilateswithjon.com</strong>, and this morning is the perfect time to break it in. Same 10 minutes, same exercises, brand new home — cleaner layout, faster videos, and easier to find what you need.</Text>
        <Text style={text}>If you haven't set up your account yet, the link in your welcome email will get you in. Already in? Just sign in and hit play.</Text>
        <Button href={url} style={button}>Open the new portal →</Button>
        <Text style={footer}>See you on the mat,<br />— Jon</Text>
      </Container></Body></Html>
  );
};

export const template = {
  component: Email,
  subject: "Your new portal is live — let's get moving this morning",
  displayName: "Portal launch announcement",
  previewData: { name: "Sam" },
} satisfies TemplateEntry;
