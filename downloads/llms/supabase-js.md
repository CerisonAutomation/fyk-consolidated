# Supabase JS Client v2 - Documentation

**Package:** `@supabase/supabase-js` v2.112.3
**Docs:** https://supabase.com/docs/reference/javascript/introduction

## Installation

```bash
npm install @supabase/supabase-js
```

## Client Initialization

```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
)
```

### Client Options

```typescript
const supabase = createClient<Database>(url, key, {
  db: { schema: 'public' },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
  global: {
    headers: { 'x-custom-header': 'value' },
  },
})
```

## TypeScript Types

Generate types from your database:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_ID > database.types.ts
```

Generated types structure:

```typescript
export interface Database {
  public: {
    Tables: {
      movies: {
        Row: { id: number; name: string; data: Json | null }
        Insert: { id?: never; name: string; data?: Json | null }
        Update: { id?: never; name?: string; data?: Json | null }
      }
    }
  }
}
```

Helper types for convenience:

```typescript
import { Database, Tables, Enums } from './database.types'

let movie: Tables<'movies'> // instead of Database['public']['Tables']['movies']['Row']
```

Type override for individual responses:

```typescript
const { data } = await supabase
  .from('countries')
  .select()
  .overrideTypes<Array<{ id: string }>>()
```

## CRUD Operations

### SELECT

```typescript
// Basic select
const { data, error } = await supabase.from('characters').select()

// Select specific columns
const { data, error } = await supabase
  .from('characters')
  .select('id, name, email')

// Select with filters
const { data, error } = await supabase
  .from('characters')
  .select('*')
  .eq('id', 1)

// Select with ordering and pagination
const { data, error } = await supabase
  .from('characters')
  .select('*', { count: 'exact' })
  .order('created_at', { ascending: false })
  .range(0, 9) // first 10 rows
```

### INSERT

```typescript
// Insert single record
const { error } = await supabase
  .from('countries')
  .insert({ id: 1, name: 'Mordor' })

// Insert and return the data
const { data, error } = await supabase
  .from('countries')
  .insert({ name: 'New Zealand' })
  .select()

// Bulk insert
const { error } = await supabase
  .from('countries')
  .insert([
    { name: 'Country 1' },
    { name: 'Country 2' },
    { name: 'Country 3' },
  ])
```

### UPDATE

```typescript
// Always combine with filters
const { error } = await supabase
  .from('instruments')
  .update({ name: 'piano' })
  .eq('id', 1)

// Update and return
const { data, error } = await supabase
  .from('instruments')
  .update({ name: 'piano' })
  .eq('id', 1)
  .select()

// Update JSON data
const { error } = await supabase
  .from('instruments')
  .update({ metadata: { volume: 80, effects: ['reverb'] } })
  .eq('id', 1)
```

### UPSERT

```typescript
// Upsert based on unique column
const { data, error } = await supabase
  .from('users')
  .upsert({ username: 'supabot' }, { onConflict: 'username' })

// Bulk upsert
const { error } = await supabase
  .from('users')
  .upsert([
    { username: 'user1' },
    { username: 'user2' },
  ], { onConflict: 'username' })
```

### DELETE

```typescript
// Always combine with filters
const { error } = await supabase
  .from('countries')
  .delete()
  .eq('id', 1)

// Delete and return
const { data, error } = await supabase
  .from('countries')
  .delete()
  .eq('id', 1)
  .select()

// Delete multiple
const { error } = await supabase
  .from('countries')
  .delete()
  .in('id', [1, 2, 3])
```

## Filters

```typescript
// eq - equals
.eq('column', 'value')

// neq - not equals
.neq('column', 'value')

// gt, gte - greater than, greater than or equal
.gt('column', 10)
.gte('column', 10)

// lt, lte - less than, less than or equal
.lt('column', 10)
.lte('column', 10)

// like - pattern matching (case sensitive)
.like('name', '%John%')

// ilike - pattern matching (case insensitive)
.ilike('name', '%john%')

// is - check for null
.is('column', null)

// in - check if value is in array
.in('id', [1, 2, 3])

// contains - for JSONB arrays
.contains('metadata', ['tag1'])

// overlaps - check array overlap
.overlaps('tags', ['tag1', 'tag2'])

// Filter with multiple conditions
const { data, error } = await supabase
  .from('posts')
  .select('*')
  .eq('published', true)
  .gte('created_at', '2024-01-01')
  .order('created_at', { ascending: false })
```

## Referenced Tables (Joins)

```typescript
// Basic join
const { data, error } = await supabase
  .from('countries')
  .select(`
    id,
    name,
    cities (
      id,
      name
    )
  `)

// Join through a join table
const { data, error } = await supabase
  .from('actors')
  .select(`
    name,
    films_actors (
      films (
        name,
        year
      )
    )
  `)

// Type for joins
import { QueryResult, QueryData, QueryError } from '@supabase/supabase-js'

const countriesWithCitiesQuery = supabase
  .from('countries')
  .select(`id, name, cities ( id, name )`)

type CountriesWithCities = QueryData<typeof countriesWithCitiesQuery>
```

## RPC (Remote Procedure Calls)

```typescript
// Call without arguments
const { data, error } = await supabase.rpc('hello_world')

// Call with arguments
const { data, error } = await supabase.rpc('get_user_stats', {
  user_id: 123,
})

// Call with filters
const { data, error } = await supabase
  .rpc('search_countries', { search_term: 'New' })
  .select()

// Cross-schema functions
const { data } = await supabase
  .schema('schema_b')
  .rpc('function_a', {})
  .overrideTypes<{ id: string; user_id: string }[]>()
```

## Authentication

```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'securepassword',
})

// Sign in with email
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'securepassword',
})

// Sign in with OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'github',
  options: {
    redirectTo: 'http://localhost:3000/auth/callback',
  },
})

// Sign out
const { error } = await supabase.auth.signOut()

// Get current session
const { data: { session } } = await supabase.auth.getSession()

// Get current user
const { data: { user } } = await supabase.auth.getUser()
```

## Realtime Subscriptions

```typescript
// Subscribe to table changes
const channel = supabase
  .channel('changes')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'messages' },
    (payload) => {
      console.log('Change received:', payload)
    }
  )
  .subscribe()

// Subscribe to specific events
supabase
  .channel('messages')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'messages' },
    (payload) => console.log('New message:', payload)
  )
  .on(
    'postgres_changes',
    { event: 'DELETE', schema: 'public', table: 'messages' },
    (payload) => console.log('Deleted:', payload)
  )
  .subscribe()

// Unsubscribe
await supabase.removeChannel(channel)
```

## Error Handling Pattern

```typescript
async function fetchData() {
  const { data, error } = await supabase
    .from('movies')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) {
    console.error('Supabase error:', error.message, error.details)
    throw error
  }

  return data
}
```

## RLS (Row Level Security) Setup

```sql
-- Enable RLS
ALTER TABLE public.your_table ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT SELECT ON public.your_table TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.your_table TO authenticated;
GRANT ALL ON public.your_table TO service_role;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.your_function TO authenticated, service_role;
```

## Key Patterns

1. Always use TypeScript types via `createClient<Database>()`
2. Chain `.select()` after mutations to return data
3. Always combine `.delete()` and `.update()` with filters
4. Use `.single()`, `.maybeSingle()`, or `.limit(1)` when expecting one row
5. Handle errors with the `error` object, not exceptions
6. Use `count: 'exact'` in select options for pagination
