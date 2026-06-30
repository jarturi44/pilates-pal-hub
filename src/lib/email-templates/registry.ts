import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

import { template as equipmentShipped } from './equipment-shipped'
import { template as morningsReminder } from './mornings-reminder'
import { template as subscriptionConfirmed } from './subscription-confirmed'
import { template as onboardingComplete } from './onboarding-complete'
import { template as onboardingReminder } from './onboarding-reminder'
import { template as slotAssigned } from './slot-assigned'
import { template as sessionReminder } from './session-reminder'
import { template as paymentFailed } from './payment-failed'
import { template as paymentRecovered } from './payment-recovered'
import { template as subscriptionCanceled } from './subscription-canceled'
import { template as commitmentEnding } from './commitment-ending'
import { template as adminBroadcast } from './admin-broadcast'
import { template as intakeFinishSignup } from './intake-finish-signup'
import { template as welcomeBackInvite } from './welcome-back-invite'
import { template as portalLaunch } from './portal-launch'



export const TEMPLATES: Record<string, TemplateEntry> = {
  'equipment-shipped': equipmentShipped,
  'mornings-reminder': morningsReminder,
  'subscription-confirmed': subscriptionConfirmed,
  'onboarding-complete': onboardingComplete,
  'onboarding-reminder': onboardingReminder,
  'slot-assigned': slotAssigned,
  'session-reminder': sessionReminder,
  'payment-failed': paymentFailed,
  'payment-recovered': paymentRecovered,
  'subscription-canceled': subscriptionCanceled,
  'commitment-ending': commitmentEnding,
  'admin-broadcast': adminBroadcast,
  'intake-finish-signup': intakeFinishSignup,
  'welcome-back-invite': welcomeBackInvite,
  'portal-launch': portalLaunch,
}

