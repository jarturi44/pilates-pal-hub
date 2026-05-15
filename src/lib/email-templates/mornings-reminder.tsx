import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Pilates with Jon'

interface Props {
  name?: string
  appUrl?: string
}

const MorningsReminderEmail = ({ name, appUrl }: Props) => {
  const url = appUrl || 'https://pilateswithjon.com/my-program'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Your 10 minutes are waiting — a tiny session, big payoff</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {name ? `${name}, ten minutes is all it takes` : 'Ten minutes is all it takes'}
          </Heading>
          <Text style={text}>
            A short, focused session today keeps your body open, your spine
            mobile, and your week on track. Pick any workout from the
            library — beginner or advanced, mat or bands — and press play.
          </Text>
          <Button href={url} style={button}>Open my library</Button>
          <Text style={footer}>See you on the mat — {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: MorningsReminderEmail,
  subject: 'Your 10 Minute Mornings — ready when you are',
  displayName: '10 Minute Mornings reminder',
  previewData: { name: 'Sam', appUrl: 'https://pilateswithjon.com/my-program' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 600, color: '#0f172a', margin: '0 0 18px', fontFamily: 'Cormorant Garamond, Georgia, serif' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 22px' }
const button = { backgroundColor: '#0f172a', color: '#ffffff', padding: '12px 22px', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 500, display: 'inline-block' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '32px 0 0' }
