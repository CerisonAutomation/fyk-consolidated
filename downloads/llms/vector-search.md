# pgvector Similarity Search Patterns

> Practical implementation patterns for vector similarity search using pgvector with PostgreSQL/Supabase.

## Overview

pgvector adds vector similarity search to PostgreSQL, enabling semantic search, recommendation systems, and RAG (Retrieval-Augmented Generation) directly in your database.

**Extension:** `vector`
**Docs:** https://supabase.com/docs/guides/ai/vector-columns

---

## Setup

### Enable pgvector Extension

```sql
-- Via SQL
create extension vector with schema extensions;

-- Verify installation
SELECT * FROM pg_extension WHERE extname = 'vector';
```

Via Supabase Dashboard: Navigate to Database > Extensions, search "vector", and enable.

---

## Core Patterns

### 1. Create Table with Vector Column

```sql
create table documents (
  id serial primary key,
  title text not null,
  body text not null,
  embedding extensions.vector(384)  -- Match your embedding model dimensions
);

-- Common embedding dimensions:
-- 384: all-MiniLM-L6-v2
-- 768: all-mpnet-base-v2
-- 1024: text-embedding-ada-002, text-embedding-3-small
-- 1536: text-embedding-3-large
```

**Note:** Embeddings with fewer dimensions perform best. Choose the smallest model that meets your accuracy requirements.

### 2. Store Embeddings

```javascript
import { pipeline } from '@huggingface/transformers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Generate embedding using Transformers.js
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

async function storeDocument(title, body) {
  const output = await extractor(body, { pooling: 'mean', normalize: true });
  const embedding = Array.from(output.data);

  const { data, error } = await supabase.from('documents').insert({
    title,
    body,
    embedding,
  });

  if (error) throw error;
  return data;
}
```

### 3. Similarity Search Function

Since PostgREST lacks direct pgvector operator support, wrap the query in a PostgreSQL function:

```sql
create or replace function match_documents (
  query_embedding extensions.vector(384),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  title text,
  body text,
  similarity float
)
language sql stable
as $$
  select
    id,
    title,
    body,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by (documents.embedding <=> query_embedding) asc
  limit match_count;
$$;
```

### 4. Execute Search via RPC

```javascript
async function searchDocuments(query, matchCount = 10, threshold = 0.5) {
  const output = await extractor(query, { pooling: 'mean', normalize: true });
  const queryEmbedding = Array.from(output.data);

  const { data: documents, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: matchCount,
  });

  if (error) throw error;
  return documents;
}

// Usage
const results = await searchDocuments('How to build a recommendation system');
```

---

## Distance Operators

pgvector supports three distance metrics. Choose based on your use case:

| Operator | Metric | Use Case |
|----------|--------|----------|
| `<->` | Euclidean (L2) | General purpose |
| `<=>` | Cosine distance | Text similarity (normalized vectors) |
| `<#>` | Negative inner product | Fast similarity with normalized vectors |

```sql
-- Cosine distance (most common for text embeddings)
select 1 - (embedding <=> query_embedding) as similarity;

-- Euclidean distance
select embedding <-> query_embedding as distance;

-- Inner product (for normalized vectors)
select embedding <#> query_embedding as neg_distance;
```

---

## Indexing

### HNSW Index (Recommended)

Hierarchical Navigable Small World - better for query performance:

```sql
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);
```

### IVFFlat Index

Inverted File with Flat compression - good for large datasets:

```sql
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Choosing `lists`:** A good rule of thumb is `sqrt(number_of_rows)`. For 1M rows, use ~1000 lists.

### Index Operator Classes

Match the index operator to your query operator:

| Distance Metric | Operator | Operator Class |
|----------------|----------|----------------|
| Euclidean | `<->` | `vector_l2_ops` |
| Cosine | `<=>` | `vector_cosine_ops` |
| Inner Product | `<#>` | `vector_ip_ops` |

### Version Limits (pgvector 0.7.0+)

Maximum indexed dimensions:
- `vector`: 2,000 dimensions
- `halfvec`: 4,000 dimensions
- `bit`: 64,000 dimensions

---

## Advanced Patterns

### 1. Hybrid Search (Text + Vector)

Combine full-text search with vector similarity:

```sql
create or replace function hybrid_search (
  query_text text,
  query_embedding extensions.vector(384),
  match_threshold float,
  match_count int,
  text_weight float default 0.5
)
returns table (
  id bigint,
  title text,
  body text,
  similarity float,
  text_rank float
)
language sql stable
as $$
  with text_search as (
    select
      id,
      title,
      body,
      ts_rank_cd(to_tsvector('english', body), plainto_tsquery('english', query_text)) as text_rank
    from documents
    where to_tsvector('english', body) @@ plainto_tsquery('english', query_text)
  ),
  vector_search as (
    select
      id,
      title,
      body,
      1 - (embedding <=> query_embedding) as vector_score
    from documents
    where 1 - (embedding <=> query_embedding) > match_threshold
  )
  select
    coalesce(ts.id, vs.id) as id,
    coalesce(ts.title, vs.title) as title,
    coalesce(ts.body, vs.body) as body,
    coalesce(vs.vector_score, 0) as similarity,
    coalesce(ts.text_rank, 0) as text_rank
  from text_search ts
  full outer join vector_search vs on ts.id = vs.id
  order by (text_weight * coalesce(ts.text_rank, 0) + (1 - text_weight) * coalesce(vs.vector_score, 0)) desc
  limit match_count;
$$;
```

### 2. Multi-Tenant Vector Search

```sql
create or replace function match_documents_by_tenant (
  query_embedding extensions.vector(384),
  tenant_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  title text,
  body text,
  similarity float
)
language sql stable
as $$
  select
    id,
    title,
    body,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where documents.tenant_id = match_documents_by_tenant.tenant_id
    and 1 - (documents.embedding <=> query_embedding) > match_threshold
  order by (documents.embedding <=> query_embedding) asc
  limit match_count;
$$;
```

### 3. Metadata Filtering

```sql
create or replace function match_documents_filtered (
  query_embedding extensions.vector(384),
  match_threshold float,
  match_count int,
  category_filter text default null,
  date_from timestamp default null
)
returns table (
  id bigint,
  title text,
  body text,
  category text,
  created_at timestamp,
  similarity float
)
language sql stable
as $$
  select
    id,
    title,
    body,
    category,
    created_at,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
    and (category_filter is null or category = category_filter)
    and (date_from is null or created_at >= date_from)
  order by (documents.embedding <=> query_embedding) asc
  limit match_count;
$$;
```

### 4. Incremental Index Updates

```sql
-- Add new document with embedding
insert into documents (title, body, embedding)
values ($1, $2, $3);

-- Update existing document
update documents
set embedding = $3
where id = $1;

-- Delete document
delete from documents where id = $1;

-- Rebuild index after large batch operations
reindex index documents_embedding_idx;
```

---

## Performance Tuning

### 1. Dimension Selection

```sql
-- Lower dimensions = faster search
-- 384 dimensions: fast, good for most use cases
-- 768 dimensions: better accuracy, slower
-- 1536 dimensions: best accuracy, slowest

-- Test with your data:
-- 1. Create table with target dimensions
-- 2. Insert representative dataset
-- 3. Benchmark query performance
-- 4. Compare accuracy vs speed trade-off
```

### 2. Index Tuning

```sql
-- HNSW parameters (pgvector 0.5.0+)
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WITH (
  m = 16,           -- Number of connections per layer (default: 16)
  ef_construction = 64  -- Size of dynamic candidate list (default: 64)
);

-- Higher m = better recall, more memory
-- Higher ef_construction = better index quality, slower build
```

### 3. Query Tuning

```sql
-- Adjust match_threshold based on your data
-- Lower threshold = more results, potentially less relevant
-- Higher threshold = fewer results, more relevant

-- Test different thresholds:
select * from match_documents(query_embedding, 0.3, 10);  -- Loose
select * from match_documents(query_embedding, 0.5, 10);  -- Balanced
select * from match_documents(query_embedding, 0.7, 10);  -- Strict
select * from match_documents(query_embedding, 0.9, 10);  -- Very strict
```

---

## Supabase Integration

### 1. Client-Side Search

```javascript
import { createClient } from '@supabase/supabase-js';
import { pipeline } from '@huggingface/transformers';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

async function search(query, options = {}) {
  const {
    matchCount = 10,
    threshold = 0.5,
    category = null,
  } = options;

  // Generate query embedding
  const output = await extractor(query, { pooling: 'mean', normalize: true });
  const queryEmbedding = Array.from(output.data);

  // Search
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: matchCount,
  });

  if (error) throw error;
  return data;
}
```

### 2. Server-Side Search (Edge Function)

```javascript
// supabase/functions/search/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { query, matchCount = 10, threshold = 0.5 } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  );

  // Generate embedding using OpenAI (or another model)
  const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: query,
    }),
  });

  const { data: [{ embedding }] } = await embeddingResponse.json();

  // Search
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: matchCount,
  });

  if (error) throw error;

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## Architecture Pattern

```
User Query
    |
    v
[Embedding Model]  <-- Transformers.js (client) or OpenAI (server)
    |
    v
[Query Vector]
    |
    v
[pgvector Search]  <-- PostgreSQL with pgvector extension
    |
    v
[Ranked Results]
    |
    v
[Response to UI]
```

---

## Common Pitfalls

1. **Dimension mismatch:** Ensure embedding dimensions match your vector column definition
2. **Missing index:** Always create an index for production use (sequential scan is slow)
3. **Operator mismatch:** Index operator class must match query operator
4. **Inconsistent embeddings:** Use the same embedding model for storage and search
5. **No threshold tuning:** Test different thresholds for your specific use case

---

## Quick Reference

```sql
-- Enable extension
create extension vector;

-- Create table
create table items (
  id serial primary key,
  content text,
  embedding vector(384)
);

-- Create index
create index on items using hnsw (embedding vector_cosine_ops);

-- Search function
create or replace function search_items(
  query_embedding vector(384),
  match_count int
)
returns table (id int, content text, similarity float)
language sql stable as $$
  select id, content,
    1 - (embedding <=> query_embedding) as similarity
  from items
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Query
select * from search_items('[0.1, 0.2, ...]'::vector, 10);
```
