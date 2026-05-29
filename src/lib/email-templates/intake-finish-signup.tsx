import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, APP_BASE_URL, main, container, header, h1, text, button, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; resumeToken?: string }

const Email = ({ name, resumeToken }: Props) => {
  const link = resumeToken
    ? `${APP_BASE_URL}/onboarding/create-account?resume=${resumeToken}`
    : `${APP_BASE_URL}/get-started`;
  return (
    <Html lang="en"><Head /><Preview>Finish setting up your account</Preview>
      <Body style={main}><Container style={container}>
        <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
        <Heading style={h1}>{name ? `Hey ${name} — let's finish setting up your account` : "Let's finish setting up your account"}</Heading>
        <Text style={text}>
          Great job knocking out your intake session! Your payment is locked in — the
          last little thing is creating the account you'll log into.
        </Text>
        <Text style={text}>
          Click below to set a password and you're in. From there I'll get your plan
          and times set up so you can hit the ground running.
        </Text>
        <Button href={link} style={button}>Finish creating my account</Button>
        <Text style={footer}>— Jon</Text>
      </Container></Body></Html>
  );
};

export const template = {
  component: Email,
  subject: "Finish setting up your Pilates with Jon account",
  displayName: "Intake — finish signup",
  previewData: { name: "Sam", resumeToken: "00000000-0000-0000-0000-000000000000" },
} satisfies TemplateEntry;
