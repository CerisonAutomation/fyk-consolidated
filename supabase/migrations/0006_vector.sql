-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Profile embeddings for AI-powered discovery
CREATE TABLE IF NOT EXISTS public.profile_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  embedding vector(384),  -- 384-dim for all-MiniLM-L6-v2
  model text NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, model)
);

-- Message embeddings for semantic search
CREATE TABLE IF NOT EXISTS public.message_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  embedding vector(384),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id)
);

-- Interest/tag embeddings for matching
CREATE TABLE IF NOT EXISTS public.tag_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text NOT NULL UNIQUE,
  kind text NOT NULL, -- 'tribe', 'interest', 'looking_for', 'kink', 'lifestyle'
  embedding vector(384),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Vector similarity search indexes
CREATE INDEX IF NOT EXISTS profile_embeddings_idx ON public.profile_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS message_embeddings_idx ON public.message_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);

-- Similar profiles function
CREATE OR REPLACE FUNCTION public.find_similar_profiles(
  query_embedding vector(384),
  match_count int DEFAULT 20,
  match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  profile_id uuid,
  similarity float,
  display_name text,
  avatar_url text,
  age int,
  city text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    pe.profile_id,
    1 - (pe.embedding <=> query_embedding) AS similarity,
    u.pseudo AS display_name,
    u.photos->>0 AS avatar_url,
    u.age,
    u.city
  FROM public.profile_embeddings pe
  JOIN public.users u ON u.id = pe.profile_id
  WHERE 1 - (pe.embedding <=> query_embedding) > match_threshold
    AND u.id != auth.uid()
    AND NOT u.hidden
    AND NOT u.incognito
  ORDER BY pe.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Similar messages function (for semantic chat search)
CREATE OR REPLACE FUNCTION public.find_similar_messages(
  query_embedding vector(384),
  conv_id uuid,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  message_id uuid,
  similarity float,
  content text,
  sender_id uuid,
  created_at timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT
    me.message_id,
    1 - (me.embedding <=> query_embedding) AS similarity,
    m.content,
    m.sender_id,
    m.created_at
  FROM public.message_embeddings me
  JOIN public.messages m ON m.id = me.message_id
  WHERE m.conversation_id = conv_id
  ORDER BY me.embedding <=> query_embedding
  LIMIT match_count;
$$;
