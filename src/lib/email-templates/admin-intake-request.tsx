import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; email?: string; amount?: string }

const Email = ({ name, email, amount }: Props) => (
  <Html lang="en"><Head /><Preview>New intake session requested</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>New intake session booked</Heading>
      <Text style={text}>
        {name ? <strong>{name}</strong> : "A new client"} just paid for an intake session.
      </Text>
      <Text style={text}>
        <strong>Name:</strong> {name || "—"}<br />
        <strong>Email:</strong> {email || "—"}<br />
        {amount ? <><strong>Amount:</strong> {amount}<br /></> : null}
      </Text>
      <Text style={text}>
        Reach out to schedule their assessment. They'll finish creating their account
        via the link on the payment success page.
      </Text>
      <Text style={footer}>— Pilates with Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "New intake session booked",
  displayName: "Admin — intake request",
  previewData: { name: "Sam Client", email: "sam@example.com", amount: "$60.00" },
} satisfies TemplateEntry;
