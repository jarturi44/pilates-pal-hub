import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Pilates with Jon'

interface EquipmentShippedProps {
  name?: string
}

const EquipmentShippedEmail = ({ name }: EquipmentShippedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} equipment is on the way</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `${name}, your equipment is on the way!` : 'Your equipment is on the way!'}
        </Heading>
        <Text style={text}>
          Great news — we've shipped your {SITE_NAME} starter kit. You'll receive
          tracking and delivery details from the courier shortly.
        </Text>
        <Text style={text}>
          Once it arrives, you're all set to start training. Reach out any time
          if you need help getting set up.
        </Text>
        <Text style={footer}>— The {SITE_NAME} team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EquipmentShippedEmail,
  subject: 'Your equipment is on the way',
  displayName: 'Equipment shipped',
  previewData: { name: 'Sam' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 600, color: '#0f172a', margin: '0 0 20px', fontFamily: 'Cormorant Garamond, Georgia, serif' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 18px' }
const footer = { fontSize: '13px', color: '#94a3b8', margin: '32px 0 0' }
