import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";

interface Props { name?: string; subject?: string; body?: string; }

const Email = ({ name, subject, body }: Props) => (
  <Html lang="en"><Head /><Preview>{subject ?? `A note from ${SITE_NAME}`}</Preview>
    <Body style={main}><Container style={container}>
      <Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{subject ?? "A note from the studio"}</Heading>
      {name && <Text style={text}>Hi {name},</Text>}
      {(body ?? "").split("\n\n").map((para, i) => (
        <Text key={i} style={text}>{para}</Text>
      ))}
      <Text style={footer}>— The {SITE_NAME} team</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => (typeof data?.subject === "string" && data.subject) || `A note from ${SITE_NAME}`,
  displayName: "Admin broadcast",
  previewData: { name: "Sam", subject: "Studio update", body: "Hi everyone — we'll be closed Memorial Day weekend.\n\nSee you all next Tuesday!" },
} satisfies TemplateEntry;
