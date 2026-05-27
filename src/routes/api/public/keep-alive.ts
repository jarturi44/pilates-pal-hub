import { createFileRoute } from '@tanstack/react-router'
import { supabaseAdmin } from '@/integrations/supabase/client.server'

export const Route = createFileRoute('/api/public/keep-alive')({
  server: {
    handlers: {
      GET: async () => {
        try {
          // Lightweight query to keep the database active
          const { error } = await supabaseAdmin
            .from('users')
            .select('id', { count: 'exact', head: true })
            .limit(1)

          if (error) {
            return new Response(
              JSON.stringify({ ok: false, error: error.message }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            )
          }

          return new Response(
            JSON.stringify({ ok: true, timestamp: new Date().toISOString() }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        } catch (err) {
          return new Response(
            JSON.stringify({ ok: false, error: String(err) }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          )
        }
      },
    },
  },
})
