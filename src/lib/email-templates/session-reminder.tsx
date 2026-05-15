import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer, card } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; day?: string; time?: string; sessionType?: string; }

const Email = ({ name, day, time, sessionType }: Props) => (
  <Html lang="en"><Head /><Preview>Reminder: your session is tomorrow</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `See you tomorrow, ${name}` : "See you tomorrow"}</Heading>
      <Text style={text}>This is a friendly reminder of your upcoming session.</Text>
      <div style={card}>
        <Text style={{ ...text, margin: 0 }}><strong>{day}</strong> at <strong>{time}</strong></Text>
        {sessionType && <Text style={{ ...text, margin: 0 }}>{sessionType}</Text>}
      </div>
      <Text style={text}>If you need to reschedule, please reach out as soon as possible.</Text>
      <Text style={footer}>— The {SITE_NAME} team</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Reminder: your session is tomorrow",
  displayName: "Session reminder (24h)",
  previewData: { name: "Sam", day: "Monday", time: "9:00 AM", sessionType: "Private" },
} satisfies TemplateEntry;
