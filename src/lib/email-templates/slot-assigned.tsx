import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer, card } from "./_styles";

interface Props { name?: string; day?: string; time?: string; sessionType?: string; }

const Email = ({ name, day, time, sessionType }: Props) => (
  <Html lang="en"><Head /><Preview>Your recurring session slot is set</Preview>
    <Body style={main}><Container style={container}>
      <Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `${name}, your slot is set` : "Your slot is set"}</Heading>
      <Text style={text}>You've been assigned a recurring session slot. We're looking forward to training with you.</Text>
      <div style={card}>
        <Text style={{ ...text, margin: 0 }}><strong>Day:</strong> {day ?? "—"}</Text>
        <Text style={{ ...text, margin: 0 }}><strong>Time:</strong> {time ?? "—"}</Text>
        <Text style={{ ...text, margin: 0 }}><strong>Type:</strong> {sessionType ?? "—"}</Text>
      </div>
      <Text style={text}>You'll receive a reminder 24 hours before each session.</Text>
      <Text style={footer}>— The {SITE_NAME} team</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Your recurring session slot is set",
  displayName: "Slot assigned",
  previewData: { name: "Sam", day: "Monday", time: "9:00 AM", sessionType: "Private" },
} satisfies TemplateEntry;
