# Supabase Edge Functions Patterns

> Practical implementation patterns for Supabase Edge Functions: Deno runtime, webhooks, cron jobs, and best practices.
> Sources: supabase.com/docs/guides/functions, supabase.com/docs/guides/functions/quickstart, community guides.

---

## Overview

Supabase Edge Functions are server-side TypeScript functions distributed globally at the edge. They run on a Deno-compatible runtime with TypeScript-first support.

**Key characteristics:**
- Runtime: Supabase Edge Runtime (Deno compatible)
- Cold starts: ~120ms
- Functions are `.ts` files exporting a handler
- Globally distributed for low-latency
- Secrets managed via project secrets (env vars)

**When to use Edge Functions:**
- Authenticated or public HTTP endpoints needing low latency
- Webhook receivers (Stripe, GitHub, etc.)
- On-demand image or Open Graph generation
- Small AI inference tasks or LLM API orchestration
- Sending transactional emails
- Building messaging bots (Slack, Discord, Telegram)

**When NOT to use:**
- Heavy long-running jobs (use background workers instead)
- Operations requiring persistent database connections
- CPU-intensive tasks that may exceed timeout limits

---

## 1. Basic Edge Function Setup

### Create and Deploy

```bash
# Initialize project
supabase init

# Create a new function
supabase functions new hello-world

# Test locally (requires Docker)
supabase start
supabase functions serve hello-world

# Deploy to production
supabase functions deploy hello-world
```

### Function Structure

```typescript
// supabase/functions/hello-world/index.ts

export default {
  fetch: withSupabase({ auth: ['publishable', 'secret'] }, async (req, ctx) => {
    const { name } = await req.json()

    return Response.json({ message: `Hello ${name}!` })
  }),
}
```

### Invoke from Client

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const { data, error } = await supabase.functions.invoke('hello-world', {
  body: { name: 'World' },
})
```

---

## 2. Authenticated Functions

### JWT Validation Pattern

```typescript
// supabase/functions/protected-endpoint/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export default {
  fetch: withSupabase({ auth: ['publishable', 'secret'] }, async (req, ctx) => {
    // ctx.user is automatically populated from the JWT
    const user = ctx.user

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Use the user's JWT to query their data
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${user.token}` } } }
    )

    const { data, error } = await supabase
      .from('user_data')
      .select('*')
      .eq('user_id', user.id)

    return Response.json({ data })
  }),
}
```

### Custom Auth Middleware

```typescript
// supabase/functions/_shared/auth.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function getUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  return user
}
```

---

## 3. Webhook Patterns

### Stripe Webhook Handler

```typescript
// supabase/functions/stripe-webhook/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')!

    // Verify webhook signature (important for security)
    const stripe = await import('https://esm.sh/stripe@14')
    const stripeClient = new stripe.default(Deno.env.get('STRIPE_SECRET_KEY')!)
    const event = stripeClient.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    )

    // Handle specific events
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        )

        // Update user subscription in database
        await supabase.from('subscriptions').upsert({
          user_id: session.metadata.user_id,
          stripe_customer_id: session.customer,
          subscription_id: session.subscription,
          status: 'active',
        })
        break
      }
      case 'invoice.payment_failed': {
        // Handle failed payment
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
}
```

---

## 4. Cron / Scheduled Functions

### Database-Triggered Cron

```sql
-- Enable the pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule a function to run every day at midnight
SELECT cron.schedule(
  'daily-cleanup',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.edge_function_url') || '/cleanup-expired',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Cleanup Function

```typescript
// supabase/functions/cleanup-expired/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export default {
  fetch: withSupabase({ auth: ['secret'] }, async (req, ctx) => {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Delete expired sessions
    const { data, error } = await supabase
      .from('sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())

    // Delete expired temporary files
    const { data: files } = await supabase.storage
      .from('temp')
      .list('expired', { limit: 100 })

    if (files) {
      for (const file of files) {
        await supabase.storage.from('temp').remove([`expired/${file.name}`])
      }
    }

    return Response.json({
      deleted_sessions: data?.length || 0,
      cleaned_files: files?.length || 0,
    })
  }),
}
```

---

## 5. AI / LLM Integration Pattern

### OpenAI Proxy Function

```typescript
// supabase/functions/openai-proxy/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export default {
  fetch: withSupabase({ auth: ['publishable', 'secret'] }, async (req, ctx) => {
    const user = ctx.user
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { prompt, model = 'gpt-4' } = await req.json()

    // Rate limit check
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: usage } = await supabase
      .from('ai_usage')
      .select('count')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single()

    if (usage && usage.count >= 100) {
      return new Response(JSON.stringify({ error: 'Daily limit reached' }), { status: 429 })
    }

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()

    // Log usage
    await supabase.from('ai_usage').insert({
      user_id: user.id,
      model,
      tokens: data.usage?.total_tokens || 0,
    })

    return Response.json(data)
  }),
}
```

---

## 6. Environment Variables and Secrets

### Managing Secrets

```bash
# Set secrets via CLI
supabase secrets set OPENAI_API_KEY=sk-xxx
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx

# List all secrets
supabase secrets list
```

### Access Secrets in Functions

```typescript
// Access via Deno.env.get()
const openaiKey = Deno.env.get('OPENAI_API_KEY')
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')

// Built-in variables
const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
```

---

## 7. Error Handling and CORS

### Standard CORS Pattern

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ... your logic
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
}
```

### Error Response Pattern

```typescript
function createErrorResponse(message: string, status: number, details?: any) {
  return new Response(
    JSON.stringify({
      error: message,
      ...(details && { details }),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  )
}
```

---

## 8. Performance Best Practices

| Practice | Why |
|----------|-----|
| Keep functions short and idempotent | Avoid cold start overhead |
| Use connection pooling for Postgres | Edge functions are stateless |
| Cache responses when possible | Reduce redundant computation |
| Move heavy jobs to background workers | Edge functions have timeout limits |
| Use `withSupabase` wrapper | Automatic auth validation |
| Store secrets in project secrets | Never hardcode credentials |

### Connection Pooling for Postgres

```typescript
// Use the Supabase client which handles pooling automatically
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// For direct Postgres connections, use serverless-friendly drivers
import { neon } from 'https://esm.sh/@neondatabase/serverless'

const sql = neon(Deno.env.get('DATABASE_URL')!)
const result = await sql`SELECT * FROM users WHERE id = ${userId}`
```

---

## 9. Testing Edge Functions

### Local Testing

```bash
# Start local services
supabase start

# Serve a specific function
supabase functions serve my-function

# Test with curl
curl -i --location --request POST 'http://localhost:54321/functions/v1/my-function' \
  --header 'Authorization: Bearer <your-anon-key>' \
  --header 'Content-Type: application/json' \
  --data '{"key": "value"}'
```

### Automated Testing

```typescript
// supabase/functions/_tests/my-function.test.ts
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/assert_equals.ts'

Deno.test('my function returns correct response', async () => {
  const response = await fetch('http://localhost:54321/functions/v1/my-function', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: 'Test' }),
  })

  const data = await response.json()
  assertEquals(data.message, 'Hello Test!')
})
```

---

## 10. Deployment Checklist

1. Test locally with `supabase functions serve`
2. Set all required secrets via `supabase secrets set`
3. Deploy with `supabase functions deploy <function-name>`
4. Verify deployment at `https://<project>.supabase.co/functions/v1/<function-name>`
5. Set up monitoring/logging (Sentry integration available)
6. Configure webhooks to point to your deployed function URL
7. Set up cron jobs if using scheduled functions

---

*References:*
- https://supabase.com/docs/guides/functions
- https://supabase.com/docs/guides/functions/quickstart
- https://github.com/Supabase-Edge-Functions/
- https://deepwiki.com/supabase-community/kiro-powers/7.2-edge-functions
