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

export const TEMPLATES: Record<string, TemplateEntry> = {
  'equipment-shipped': equipmentShipped,
  'mornings-reminder': morningsReminder,
}
