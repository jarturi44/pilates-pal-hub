import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/keep-alive')({
  server: {
    handlers: {
      GET: async () => {
        return new Response('ok', { status: 200 })
      }
    }
  }
})