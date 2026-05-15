import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; subject?: string; body?: string; }

const Email = ({ name, subject, body }: Props) => (
  <Html lang="en"><Head /><Preview>{subject ?? `A note from Jon`}</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>{subject ?? "Hey everyone!"}</Heading>
      {name && <Text style={text}>Hey {name}!</Text>}
      {(body ?? "").split("\n\n").map((para, i) => (
        <Text key={i} style={text}>{para}</Text>
      ))}
      <Text style={text}>As always, I got you.</Text>
      <Text style={footer}>See you soon! — Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => (typeof data?.subject === "string" && data.subject) || `A note from Jon`,
  displayName: "Admin broadcast",
  previewData: { name: "Sam", subject: "Studio update", body: "Just wanted to let you all know we'll be closed Memorial Day weekend.\n\nBack to it Tuesday — see you on the mat!" },
} satisfies TemplateEntry;
