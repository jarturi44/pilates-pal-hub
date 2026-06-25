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
    <Preview>Your new Pilates with Jon portal is ready — set up your account</Preview>
    <Body style={main}>
      <Container style={container}>
        <EmailHeader />
        <Text style={header}>{SITE_NAME}</Text>
        <Heading style={h1}>
          {name ? `Hey ${name} — your new portal is ready` : "Your new portal is ready"}
        </Heading>
        <Text style={text}>
          I've rebuilt the Pilates with Jon site from the ground up — a cleaner portal,
          a better-organized video library, and an easier home for everything 10 Minute
          Mornings. Same workouts you already know, in a much nicer space.
        </Text>
        <Text style={text}>
          Because it's a new system, you just need to set up your account once. It takes
          about a minute — your name and email are already filled in for you.
        </Text>
        <Button href={inviteUrl} style={button}>Set up my account</Button>
        <Text style={text}>
          Your 10 Minute Mornings pricing stays exactly the same, and you won't be
          charged any setup fees. Once you're in, you'll see all the latest morning
          videos waiting for you.
        </Text>
        <Text style={text}>
          If you have any trouble setting up, just reply to this email and I'll sort
          it out for you.
        </Text>
        <Text style={footer}>— Jon</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: "Your new Pilates with Jon portal is ready",
  displayName: "Welcome back — migration invite",
  previewData: {
    name: "Sam",
    inviteUrl: "https://pilateswithjon.com/welcome-back?name=Sam&email=sam@example.com",
  },
} satisfies TemplateEntry;
