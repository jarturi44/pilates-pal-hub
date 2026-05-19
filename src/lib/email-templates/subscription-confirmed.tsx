import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer, card } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; planName?: string; price?: number; commitmentEnd?: string; }

const Email = ({ name, planName, price, commitmentEnd }: Props) => (
  <Html lang="en"><Head /><Preview>You're in! Welcome to the family.</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `You're in, ${name}!` : "You're in!"}</Heading>
      <Text style={text}>Welcome to the family. Your {planName ?? "subscription"} is active and you're officially on your way to stronger and more flexible.</Text>
      <div style={card}>
        <Text style={{ ...text, margin: 0 }}><strong>Plan:</strong> {planName ?? "—"}</Text>
        {price !== undefined && <Text style={{ ...text, margin: 0 }}><strong>Price:</strong> ${price}/month</Text>}
        {commitmentEnd && <Text style={{ ...text, margin: 0 }}><strong>Commitment runs through:</strong> {commitmentEnd}</Text>}
      </div>

      <Heading as="h2" style={{ ...h1, fontSize: "20px", marginTop: "32px" }}>Before your first session</Heading>
      <Text style={text}>
        Since we'll be working together online, I need to be able to see your whole body during our sessions.
        That's how I give you corrections, modify exercises for your body, and track your progress over time.
      </Text>
      <Text style={text}>Here's what you'll want to have ready:</Text>
      <ul style={{ paddingLeft: "20px", margin: "0 0 16px", color: "#444", fontSize: "15px", lineHeight: "1.6" }}>
        <li>A camera that can show your full body from head to toe</li>
        <li>Enough space to lay down a mat and move freely</li>
        <li>Decent lighting so I can actually see you</li>
        <li>A stable camera position — a propped-up phone, laptop, or webcam all work great</li>
      </ul>
      <Text style={text}>If you've got that covered, you're all set. See you soon! 💪</Text>

      <Text style={footer}>— Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "You're in! Here's how to get set up",
  displayName: "Subscription confirmed",
  previewData: { name: "Sam", planName: "Semi-Private 2x/week", price: 320, commitmentEnd: "August 15, 2026" },
} satisfies TemplateEntry;
