import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string }

const Email = ({ name }: Props) => (
  <Html lang="en"><Head /><Preview>Your intake session request is in — thanks!</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `Thanks, ${name} — your intake is booked!` : "Thanks — your intake is booked!"}</Heading>
      <Text style={text}>
        I just got your intake session request and payment. I'll reach out shortly
        (usually within a day) to lock in a time for your 45‑minute assessment.
      </Text>
      <Text style={text}>
        In the meantime, keep an eye on your inbox — you'll see a separate email
        with a link to finish setting up your account (choosing a password, plan,
        and shipping details for your equipment).
      </Text>
      <Text style={text}>
        Excited to get started with you.
      </Text>
      <Text style={footer}>— Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Your intake session is booked",
  displayName: "Client — intake confirmation",
  previewData: { name: "Sam" },
} satisfies TemplateEntry;
