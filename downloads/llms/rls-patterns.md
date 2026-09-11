# Supabase Row Level Security (RLS) Patterns

> Practical implementation patterns for Supabase RLS: policies, multi-tenant, RBAC, and production security.
> Sources: supabase.com/docs/guides/database/postgres/row-level-security, community guides.

---

## Overview

Row Level Security (RLS) is a PostgreSQL feature that gives you granular authorization rules inside the database. A table without RLS is readable and writable by any role with a grant on it.

**Core principle:** Enable RLS on every table in an exposed schema. Always.

**Two checks before a client touches a table:**
1. **Grants** -- decide whether a role can run an operation at all
2. **Policies** -- decide which rows that operation applies to

---

## 1. How Policies Work

A policy is a WHERE clause that Postgres implicitly adds to every query:

```sql
-- This policy:
CREATE POLICY "Users can view their own todos"
ON todos FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

-- Translates to this implicit WHERE clause:
SELECT * FROM todos WHERE auth.uid() = todos.user_id;
```

**Key helper functions:**
- `auth.uid()` -- returns the ID of the current user
- `auth.jwt()` -- returns the full JWT claims

---

## 2. Setup Pattern for Every Table

### Complete Table Security Setup

```sql
-- Step 1: Create the table
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  username text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Step 2: Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Step 3: Revoke all grants from client roles
REVOKE ALL ON TABLE profiles FROM anon, authenticated;

-- Step 4: Grant only what's needed
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profiles TO authenticated;

-- Step 5: Create policies for each operation
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create their own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own profile"
ON profiles FOR DELETE
TO authenticated
USING ((select auth.uid()) = user_id);
```

---

## 3. Common RLS Patterns

### Pattern A: User-Owned Data

```sql
-- User can only access their own rows
CREATE POLICY "user_own_data"
ON documents FOR ALL
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);
```

### Pattern B: Public Read, Authenticated Write

```sql
-- Anyone can read, only authenticated users can write
CREATE POLICY "public_read"
ON posts FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "authenticated_write"
ON posts FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = author_id);
```

### Pattern C: Team/Organization Based

```sql
-- Users can access data belonging to their team
CREATE POLICY "team_member_access"
ON projects FOR ALL
TO authenticated
USING (
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  team_id IN (
    SELECT team_id FROM team_members
    WHERE user_id = auth.uid()
  )
);
```

### Pattern D: Role-Based Access Control (RBAC)

```sql
-- Add a role column to your table
ALTER TABLE documents ADD COLUMN role text DEFAULT 'viewer';

-- Admins can do everything
CREATE POLICY "admin_full_access"
ON documents FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Editors can update
CREATE POLICY "editor_can_update"
ON documents FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM document_permissions
    WHERE user_id = auth.uid() AND document_id = id AND permission = 'edit'
  )
);

-- Viewers can only read
CREATE POLICY "viewer_can_read"
ON documents FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM document_permissions
    WHERE user_id = auth.uid() AND document_id = id AND permission = 'view'
  )
);
```

### Pattern E: Multi-Tenant SaaS

```sql
-- Organization-based isolation
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
);

CREATE TABLE org_members (
  org_id uuid REFERENCES organizations(id),
  user_id uuid REFERENCES auth.users,
  role text DEFAULT 'member',
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE org_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id),
  data jsonb
);

ALTER TABLE org_data ENABLE ROW LEVEL SECURITY;

-- Members can only access their org's data
CREATE POLICY "org_member_access"
ON org_data FOR ALL
TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
  )
);
```

---

## 4. Advanced Patterns

### Pattern F: Time-Based Access

```sql
-- Content only visible during a specific window
CREATE POLICY "scheduled_content"
ON announcements FOR SELECT
TO authenticated
USING (
  publish_at <= now()
  AND (expires_at IS NULL OR expires_at > now())
);
```

### Pattern G: Hierarchical Access

```sql
-- Parent-child resource access
CREATE POLICY "project_cascade_access"
ON tasks FOR ALL
TO authenticated
USING (
  project_id IN (
    SELECT id FROM projects
    WHERE owner_id = auth.uid()
    OR id IN (
      SELECT project_id FROM project_members
      WHERE user_id = auth.uid()
    )
  )
);
```

### Pattern H: Soft Delete

```sql
-- Users can only see non-deleted records
CREATE POLICY "soft_delete_read"
ON items FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND (
    owner_id = auth.uid()
    OR is_public = true
  )
);

-- Users can soft-delete their own records
CREATE POLICY "soft_delete"
ON items FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());
```

---

## 5. USING vs WITH CHECK

```sql
-- USING: controls which rows a query can SEE/MODIFY
-- WITH CHECK: controls what the NEW/MODIFIED row must look like

-- UPDATE policy with both:
CREATE POLICY "update_own_profile"
ON profiles FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id)     -- Can only see your own row
WITH CHECK ((select auth.uid()) = user_id); -- New value must still be yours

-- INSERT policy (only WITH CHECK matters):
CREATE POLICY "insert_own_profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

-- SELECT policy (only USING matters):
CREATE POLICY "select_own_profile"
ON profiles FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

-- DELETE policy (only USING matters):
CREATE POLICY "delete_own_profile"
ON profiles FOR DELETE
TO authenticated
USING ((select auth.uid()) = user_id);
```

---

## 6. What Bypasses RLS

**Important:** The `service_role` key bypasses RLS entirely. Never expose it client-side.

```typescript
// Client-side (RLS enforced)
const supabase = createClient(url, anonKey) // RLS applies

// Server-side (RLS bypassed)
const supabase = createClient(url, serviceRoleKey) // RLS bypassed!
```

**Other bypasses:**
- Table owners (usually `postgres` role)
- `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`
- Views created by table owners (security definer)

---

## 7. Testing RLS Policies

### pgTAP Tests

```sql
-- supabase/tests/profiles_rls.test.sql
BEGIN;
SELECT plan(14);

-- Create test users
INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'other@example.com');

-- Test: anon cannot read profiles
SET LOCAL role anon;
SELECT throws_ok(
  $$select * from profiles$$,
  '42501', null,
  'anon cannot read profiles'
);

-- Test: owner can read their own profile
SET LOCAL role authenticated;
SELECT lives_ok(
  $$insert into profiles (id, user_id, avatar_url)
  values ('aaaa...', '11111111-1111-1111-1111-111111111111', 'me.jpg')$$,
  'owner can create profile'
);

SELECT results_eq(
  $$select avatar_url from profiles where user_id = '11111111-1111-1111-1111-111111111111'$$,
  ARRAY['me.jpg']::text[],
  'owner can read their own profile'
);

-- Test: other user cannot read owner's profile
SELECT is_empty(
  $$select * from profiles where user_id = '11111111-1111-1111-1111-111111111111'$$,
  'other user cannot read owner profile'
);

SELECT * FROM finish();
ROLLBACK;
```

### Run Tests

```bash
supabase test new profiles_rls.test
supabase test db
```

---

## 8. Common Mistakes

### Mistake 1: Not Enabling RLS

```sql
-- BAD: Table without RLS
CREATE TABLE users (id uuid, name text);

-- GOOD: Always enable RLS
CREATE TABLE users (id uuid, name text);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

### Mistake 2: Not Revoking Default Grants

```sql
-- BAD: Only creating policies
CREATE POLICY "read_own" ON users FOR SELECT USING (auth.uid() = id);
-- anon still has INSERT/UPDATE/DELETE grants!

-- GOOD: Revoke first, then grant what's needed
REVOKE ALL ON TABLE users FROM anon, authenticated;
GRANT SELECT ON TABLE users TO authenticated;
CREATE POLICY "read_own" ON users FOR SELECT USING (auth.uid() = id);
```

### Mistake 3: Using `for all` Instead of Separate Policies

```sql
-- BAD: Hides which operations are allowed
CREATE POLICY "all_own" ON users FOR ALL USING (auth.uid() = id);

-- GOOD: Explicit per-operation policies
CREATE POLICY "select_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "insert_own" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "update_own" ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "delete_own" ON users FOR DELETE USING (auth.uid() = id);
```

### Mistake 4: Exposing service_role Key

```typescript
// BAD: Never do this
const supabase = createClient(url, 'eyJ...service_role_key...')

// GOOD: Use anon key client-side, service_role server-side only
const supabase = createClient(url, 'eyJ...anon_key...')
```

---

## 9. Performance Considerations

### Index Your Policy Columns

```sql
-- Policy checks on user_id should be indexed
CREATE INDEX idx_profiles_user_id ON profiles(user_id);

-- For team-based policies, index the join table
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
```

### Use Subqueries in Policies

```sql
-- BAD: Correlated subquery (slower)
CREATE POLICY "team_access" ON projects FOR SELECT
USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);

-- GOOD: Use (select auth.uid()) to prevent re-evaluation
CREATE POLICY "team_access" ON projects FOR SELECT
USING (
  team_id IN (SELECT team_id FROM team_members WHERE user_id = (select auth.uid()))
);
```

---

## 10. Production Checklist

1. Enable RLS on every table in exposed schemas
2. Revoke default grants from `anon` and `authenticated`
3. Create separate policies for SELECT, INSERT, UPDATE, DELETE
4. Write tests for every policy using pgTAP
5. Index columns used in policy expressions
6. Never expose `service_role` key to clients
7. Audit policies regularly with `supabase test db`
8. Use `(select auth.uid())` in policies for performance
9. Document which roles can access which tables
10. Set up monitoring for 42501 (permission denied) errors

---

*References:*
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supaexplorer.com/dev-notes/10-real-world-rls-patterns-for-supabase-with-policy-snippets.html
- https://tahakanar.com/blog/supabase-rls-practical-guide
- https://www.agilesoftlabs.com/blog/2026/06/supabase-row-level-security-guide-2026
