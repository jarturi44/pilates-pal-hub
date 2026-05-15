export const CONTENT_CATEGORIES = [
  'Mat Work',
  'Stretching',
  'Foam Roller',
  'Resistance Bands',
  'Ring Work',
  'Strap Work',
] as const

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number]

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/** Convert YouTube/Vimeo url to embeddable iframe src. Returns null if unrecognized. */
export function toEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const id = u.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
      const m = u.pathname.match(/\/(embed|shorts)\/([\w-]+)/)
      if (m) return `https://www.youtube.com/embed/${m[2]}`
    }
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '')
      if (id) return `https://www.youtube.com/embed/${id}`
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean).pop()
      if (id) return `https://player.vimeo.com/video/${id}`
    }
    if (host === 'player.vimeo.com') return url
    return url
  } catch {
    return null
  }
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
