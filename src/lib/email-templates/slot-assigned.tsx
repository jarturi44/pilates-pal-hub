import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer, card } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; day?: string; time?: string; sessionType?: string; }

const Email = ({ name, day, time, sessionType }: Props) => (
  <Html lang="en"><Head /><Preview>You've got a spot!</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `${name}, you've got a spot!` : "You've got a spot!"}</Heading>
      <Text style={text}>Your recurring session is <strong>{day ?? "—"}</strong> at <strong>{time ?? "—"}</strong>{sessionType ? ` — ${sessionType}` : ""}. Same time, every week.</Text>
      <div style={card}>
        <Text style={{ ...text, margin: 0 }}><strong>Day:</strong> {day ?? "—"}</Text>
        <Text style={{ ...text, margin: 0 }}><strong>Time:</strong> {time ?? "—"}</Text>
        <Text style={{ ...text, margin: 0 }}><strong>Type:</strong> {sessionType ?? "—"}</Text>
      </div>
      <Text style={text}>Little by little, that consistency is going to add up to something big.</Text>
      <Text style={footer}>See you there! — Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "You've got a spot!",
  displayName: "Slot assigned",
  previewData: { name: "Sam", day: "Monday", time: "9:00 AM", sessionType: "One-On-One" },
} satisfies TemplateEntry;
