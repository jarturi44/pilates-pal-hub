import { Body, Button, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, button, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props {
  name?: string;
  inviteUrl: string;
}

const Email = ({ name, inviteUrl }: Props) => (
  <Html lang="en">
    <Head />
    <Preview>You're all set to start — skip the intake and pick your plan</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailHeader />
        <Text style={header}>{SITE_NAME}</Text>
        <Heading style={h1}>
          {name ? `Hey ${name} — let's get you moving` : "Let's get you moving"}
        </Heading>
        <Text style={text}>
          Since we've done Pilates together before, I've set things up so you can
          skip the $60 intake session and go straight to picking your plan.
        </Text>
        <Text style={text}>
          Setting up takes about a minute — your name and email are already filled
          in. Just create your account, choose the plan that's right for you and your
          goals, and sign a quick waiver. Then you're in and we can get started.
        </Text>
        <Button href={inviteUrl} style={button}>Set up my account &amp; pick my plan</Button>
        <Text style={text}>
          Not sure which plan is right for you? Just reply to this email and I'll help
          you figure it out.
        </Text>
        <Text style={footer}>— Jon</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "You're all set to start — skip the intake",
  displayName: "Welcome — new client (skip intake, pick plan)",
  previewData: {
    name: "Sam",
    inviteUrl: "https://pilateswithjon.com/welcome-back?name=Sam&email=sam@example.com",
  },
} satisfies TemplateEntry;
