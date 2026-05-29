import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer, card } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; day?: string; time?: string; sessionType?: string; }

const Email = ({ name, day, time, sessionType }: Props) => (
  <Html lang="en"><Head /><Preview>See you tomorrow!</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{name ? `See you tomorrow, ${name}!` : "See you tomorrow!"}</Heading>
      <Text style={text}>Just a reminder that tomorrow is <strong>{day ?? "your session day"}</strong> at <strong>{time ?? "your usual time"}</strong>. Your session is waiting for you.</Text>
      <div style={card}>
        <Text style={{ ...text, margin: 0 }}><strong>{day}</strong> at <strong>{time}</strong></Text>
        {sessionType && <Text style={{ ...text, margin: 0 }}>{sessionType}</Text>}
      </div>
      <Text style={text}>Show up, do the work, feel great after. You can do this.</Text>
      <Text style={footer}>See you tomorrow! — Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "See you tomorrow!",
  displayName: "Session reminder (24h)",
  previewData: { name: "Sam", day: "Monday", time: "9:00 AM", sessionType: "One-On-One" },
} satisfies TemplateEntry;
