import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer, button } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; loginUrl?: string }

const Email = ({ name, loginUrl = "https://pilateswithjon.com/login" }: Props) => (
  <Html lang="en"><Head /><Preview>Your plan is ready to pick — log back in to finish setup.</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `Great session, ${name}!` : "Great session!"}</Heading>
      <Text style={text}>
        Thanks for a great intake. Based on what we discussed, you're ready to
        pick your plan and finish getting set up on the site.
      </Text>
      <Text style={text}>
        Just log back in and you'll be taken straight to the plan picker,
        shipping details, and waiver.
      </Text>
      <Button href={loginUrl} style={buttonPrimary}>Finish setting up my account</Button>
      <Text style={footer}>— Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Your plan is ready — finish setting up your account",
  displayName: "Client — intake complete / pick plan",
  previewData: { name: "Sam", loginUrl: "https://pilateswithjon.com/login" },
} satisfies TemplateEntry;
