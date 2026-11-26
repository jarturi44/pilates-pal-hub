import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { SITE_NAME, main, container, header, h1, text, footer } from "./_styles";
import { EmailHeader } from "./_header";

interface Props { name?: string; }

const Email = ({ name }: Props) => (
  <Html lang="en"><Head />
    <Preview>Happy Thanksgiving! (Take the day off)</Preview>
    <Body style={main}><Container style={container}>
      <EmailHeader /><Text style={header}>{SITE_NAME}</Text>
      <Heading style={h1}>Happy Thanksgiving!</Heading>
      <Text style={text}>Hi {name ?? "everyone"},</Text>
      <Text style={text}>I just wanted to send a quick note to wish you and your families a very happy Thanksgiving.</Text>
      <Text style={text}>A heads-up: there won't be a new 10 Minute Mornings video today. I'm taking the day off, and I want you to take it off too. No workout on Thanksgiving. Enjoy your people, enjoy the food, and don't think twice about it.</Text>
      <Text style={text}>Once you're no longer full of food (no rush), come back to the mat on Friday or Saturday. A little Pilates is a great way to get things moving again and feel like yourself after a big holiday meal.</Text>
      <Text style={text}>Most of all, I want to say thank you. I'm truly grateful for each of you. You show up, you work hard, and you make this business something I love doing every day. Teaching you is one of the things I'm most thankful for this year.</Text>
      <Text style={text}>Happy Thanksgiving!</Text>
      <Text style={footer}>Jon<br />Pilates with Jon</Text>
    </Container></Body></Html>
);

export const template = {
  component: Email,
  subject: "Happy Thanksgiving! (Take the day off)",
  displayName: "Thanksgiving notice",
  previewData: { name: "Sam" },
} satisfies TemplateEntry;
