# pgvector Similarity Search Patterns

> Compiled from official pgvector docs, datasops, ML Mastery, and community guides (2024-2026).

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Schema Design](#schema-design)
- [Generating and Storing Embeddings](#generating-and-storing-embeddings)
- [IVFFlat vs HNSW Indexes](#ivfflat-vs-hnsw-indexes)
- [Similarity Queries](#similarity-queries)
- [Filtered Search](#filtered-search)
- [Hybrid Search](#hybrid-search)
- [Batch Ingestion](#batch-ingestion)
- [RAG Pipeline](#rag-pipeline)
- [Performance Tuning](#performance-tuning)

---

## Overview

**pgvector** is an open-source PostgreSQL extension that adds:
- A `vector(N)` column type for storing N-dimensional vectors
- Approximate Nearest Neighbor (ANN) indexes: IVFFlat and HNSW
- Distance operators for cosine, L2, and inner product

### Why pgvector Over Dedicated Vector DBs

| Feature | pgvector | Dedicated Vector DBs |
|---------|----------|---------------------|
| Operational overhead | None (same Postgres) | Separate service |
| ACID transactions | Yes | Varies |
| SQL JOINs | Standard SQL | Custom query DSL |
| RLS / Security | Built-in PostgreSQL | Varies |
| Backup/Recovery | Existing Postgres setup | Separate pipeline |
| Scale ceiling | ~100M vectors | Unlimited |
| Metadata filtering | Full SQL expressions | Limited DSL |

### When to Use What

- **pgvector**: Up to ~100M vectors, need ACID + JOINs + RLS, already run Postgres
- **Dedicated DB** (Qdrant, Pinecone): >100M vectors, need sub-millisecond latency, specialized filtering

---

## Installation

```bash
# Ubuntu / Debian (PostgreSQL 16)
sudo apt install -y postgresql-16-pgvector

# macOS (Homebrew)
brew install pgvector

# Compile from source (any Postgres version)
git clone https://github.com/pgvector/pgvector.git
cd pgvector && make && sudo make install
```

```sql
-- Enable the extension in your database
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify
SELECT extversion FROM pg_extension WHERE extname = 'vector';
-- Returns: 0.8.0 (or current version)
```

**Managed services**: AWS RDS, Supabase, Neon, Timescale all support pgvector natively.

---

## Schema Design

### Documents Table with Embeddings

```sql
CREATE TABLE documents (
    id BIGSERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),  -- OpenAI text-embedding-3-small
    created_at TIMESTAMPTZ DEFAULT NOW(),
    tenant_id UUID NOT NULL  -- for multi-tenant RLS
);

-- Full-text search index (for hybrid search)
CREATE INDEX ON documents USING GIN(to_tsvector('english', content));

-- Metadata index for filtered queries
CREATE INDEX ON documents USING GIN(metadata jsonb_path_ops);
```

### Dimension Reference

| Model | Dimensions | Notes |
|-------|-----------|-------|
| OpenAI text-embedding-3-small | 1536 | Default choice |
| OpenAI text-embedding-3-large | 3072 (or truncated) | Higher accuracy |
| sentence-transformers all-MiniLM-L6-v2 | 384 | Open source, fast |
| Cohere embed-english-v3.0 | 1024 | Good quality |
| voyage-3 | 1024 | High quality |

### Chunking Strategy

For long documents, chunk before embedding:
- Target ~512 tokens per chunk (~2000 characters)
- Overlap 50-100 tokens between chunks for context continuity
- Store chunk metadata: `chunk_index`, `parent_document_id`, `start_offset`

```sql
CREATE TABLE document_chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT REFERENCES documents(id),
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    UNIQUE (document_id, chunk_index)
);
```

---

## Generating and Storing Embeddings

### Python with OpenAI + psycopg2

```python
import openai
import psycopg2
from psycopg2.extras import execute_values
from pgvector.psycopg2 import register_vector
import numpy as np

openai_client = openai.OpenAI()

def get_embeddings(texts: list[str], model: str = "text-embedding-3-small") -> list[list[float]]:
    """Batch embed up to 2048 texts per API call."""
    response = openai_client.embeddings.create(input=texts, model=model)
    return [item.embedding for item in response.data]

def upsert_documents(conn, docs: list[dict]) -> None:
    """Batch upsert documents with embeddings."""
    register_vector(conn)

    texts = [d["content"] for d in docs]
    vectors = get_embeddings(texts)

    rows = [
        (
            d["id"],
            d["content"],
            d.get("metadata", {}),
            np.array(v, dtype=np.float32),
            d["tenant_id"],
        )
        for d, v in zip(docs, vectors)
    ]

    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO documents (id, content, metadata, embedding, tenant_id)
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                content = EXCLUDED.content,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding
            """,
            rows,
            template="(%s, %s, %s, %s, %s)",
            page_size=500,
        )
    conn.commit()
```

### Batch Ingestion Pattern

```python
BATCH_SIZE = 500

with psycopg2.connect("postgresql://user:pass@localhost/mydb") as conn:
    for i in range(0, len(all_docs), BATCH_SIZE):
        batch = all_docs[i : i + BATCH_SIZE]
        upsert_documents(conn, batch)
        print(f"Upserted {min(i + BATCH_SIZE, len(all_docs))} / {len(all_docs)}")
```

---

## IVFFlat vs HNSW Indexes

This is the **most important performance decision** for pgvector.

### Comparison

| Property | IVFFlat | HNSW |
|----------|---------|------|
| Build time | Fast (minutes for 1M vectors) | Slow (hours for 1M at m=16) |
| Build memory | Low | High (graph in memory) |
| Query speed | Good (tune probes) | Excellent |
| Recall at k=10 | ~95% with probes=10 | ~99% with ef=64 |
| Incremental inserts | Degrades, needs REINDEX | Handles well |
| Memory footprint | Lower | Higher |
| **Best for** | Static corpora, RAM-constrained | **Production (recommended)** |

### HNSW Index (Recommended)

```sql
-- Create HNSW index
-- m: connections per node (default 16, range 8-48)
-- ef_construction: beam width during build (higher = better recall, slower build)
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Per-query: ef controls search beam width
SET hnsw.ef_search = 100;
```

### IVFFlat Index (Static/Low-Memory)

```sql
-- lists = sqrt(n_rows) is a good starting point
-- For 1M rows: lists = 1000
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 1000);

-- Per-query: probes controls how many lists to scan
SET ivfflat.probes = 10;
```

### Distance Operators

| Operator | Ops Class | Use For |
|----------|-----------|---------|
| `<=>` | vector_cosine_ops | Normalized embeddings (OpenAI, sentence-transformers) |
| `<->` | vector_l2_ops | Euclidean distance |
| `<#>` | vector_ip_ops | Inner product (CLIP, PaLM) |

```sql
-- Cosine distance (most common)
-- 1 - cosine_similarity = cosine_distance
SELECT 1 - (embedding <=> $query_vector::vector) AS cosine_similarity;

-- L2 distance
SELECT embedding <-> $query_vector::vector AS l2_distance;

-- Inner product
SELECT embedding <#> $query_vector::vector AS inner_product;
```

### Index Build Memory

```sql
-- Set high before building HNSW index
SET maintenance_work_mem = '8GB';

-- Then create index
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

---

## Similarity Queries

### Basic k-NN Query

```sql
-- Find 10 most similar documents
SELECT
    id, content, metadata,
    1 - (embedding <=> $query_vector::vector) AS cosine_similarity
FROM documents
ORDER BY embedding <=> $query_vector::vector
LIMIT 10;
```

### Filtered k-NN (Multi-Tenant)

```sql
-- Search within a specific tenant
SELECT id, content,
    1 - (embedding <=> $query_vector::vector) AS score
FROM documents
WHERE tenant_id = $tenant_uuid
ORDER BY embedding <=> $query_vector::vector
LIMIT 10;
```

### Distance Threshold

```sql
-- Only return results with similarity > 0.80
SELECT id, content,
    1 - (embedding <=> $query_vector::vector) AS score
FROM documents
WHERE 1 - (embedding <=> $query_vector::vector) > 0.80
ORDER BY embedding <=> $query_vector::vector
LIMIT 20;
```

### JOIN with Structured Data

```sql
-- Vector results joined with related tables
SELECT
    d.id, d.content,
    u.display_name AS author,
    p.name AS project_name,
    1 - (d.embedding <=> $query_vector::vector) AS score
FROM documents d
JOIN users u ON u.id = d.author_id
JOIN projects p ON p.id = d.project_id
WHERE p.workspace_id = $workspace_id
  AND d.created_at > NOW() - INTERVAL '90 days'
ORDER BY d.embedding <=> $query_vector::vector
LIMIT 10;
```

### Using SQL Functions in Application Code

```typescript
// TypeScript example with pg
const queryVector = embeddingToString(queryEmbedding);

const results = await db.query(`
    SELECT id, content, metadata,
           1 - (embedding <=> $1::vector) AS similarity
    FROM documents
    WHERE tenant_id = $2
    ORDER BY embedding <=> $1::vector
    LIMIT $3
`, [queryVector, tenantId, limit]);
```

---

## Filtered Search

### The Problem

When WHERE clauses are highly selective (<1% of rows), PostgreSQL may choose a sequential scan over the ANN index.

### Solutions

**1. Partial HNSW Index (per-tenant/workspace)**

```sql
-- Create index scoped to a specific tenant
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WHERE tenant_id = 'specific-tenant-uuid';

-- The planner will use this index for queries filtered on that tenant
SELECT id, content
FROM documents
WHERE tenant_id = 'specific-tenant-uuid'
ORDER BY embedding <=> $query_vector::vector
LIMIT 10;
```

**2. Force Index Usage (development only)**

```sql
SET enable_seqscan = off;
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM documents
WHERE tenant_id = $tenant_id
ORDER BY embedding <=> $query_vector::vector
LIMIT 10;
RESET enable_seqscan;
```

**3. Metadata-Scoped Indexes**

```sql
-- Index for specific metadata patterns
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
WHERE metadata @> '{"type": "technical"}';
```

---

## Hybrid Search

Combine vector similarity with BM25 full-text ranking using **Reciprocal Rank Fusion (RRF)**.

### Reciprocal Rank Fusion

```sql
-- Combine vector similarity with full-text search
WITH vector_results AS (
    SELECT id, content,
           ROW_NUMBER() OVER (ORDER BY embedding <=> $query_vector::vector) AS rank
    FROM documents
    ORDER BY embedding <=> $query_vector::vector
    LIMIT 20
),
text_results AS (
    SELECT id, content,
           ROW_NUMBER() OVER (
               ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('postgresql', $search_text)) DESC
           ) AS rank
    FROM documents
    WHERE to_tsvector('english', content) @@ plainto_tsquery('postgresql', $search_text)
    LIMIT 20
)
SELECT
    COALESCE(v.id, t.id) AS id,
    COALESCE(v.content, t.content) AS content,
    -- RRF score: higher is better
    1.0 / (60 + COALESCE(v.rank, 999)) AS vector_score,
    1.0 / (60 + COALESCE(t.rank, 999)) AS text_score,
    1.0 / (60 + COALESCE(v.rank, 999)) +
    1.0 / (60 + COALESCE(t.rank, 999)) AS rrf_score
FROM vector_results v
FULL OUTER JOIN text_results t ON v.id = t.id
ORDER BY rrf_score DESC
LIMIT 10;
```

### Weighted RRF

```sql
-- Adjust vector vs text weight
WITH combined AS (
    SELECT
        v.id,
        0.7 * (1.0 / (60 + v.rank)) + 0.3 * (1.0 / (60 + t.rank)) AS combined_score
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.id = t.id
)
SELECT * FROM combined ORDER BY combined_score DESC LIMIT 10;
```

---

## Batch Ingestion

### High-Throughput Pattern

```python
# Using execute_values for batch inserts
from psycopg2.extras import execute_values

def batch_upsert(conn, rows, page_size=500):
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO documents (id, content, metadata, embedding, tenant_id)
            VALUES %s
            ON CONFLICT (id) DO UPDATE SET
                content = EXCLUDED.content,
                metadata = EXCLUDED.metadata,
                embedding = EXCLUDED.embedding
            """,
            rows,
            template="(%s, %s, %s, %s::vector, %s)",
            page_size=page_size,
        )
    conn.commit()
```

### Async Ingestion with asyncpg

```python
import asyncpg
from pgvector.asyncpg import register_vector

async def async_upsert(pool, docs):
    async with pool.acquire() as conn:
        await register_vector(conn)
        records = [(d["id"], d["content"], d["embedding"], d["tenant_id"]) for d in docs]
        await conn.executemany(
            """
            INSERT INTO documents (id, content, embedding, tenant_id)
            VALUES ($1, $2, $3::vector, $4)
            ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding
            """,
            records
        )
```

---

## RAG Pipeline

### Complete Retrieval Pipeline

```python
def rag_retrieve(conn, query_text: str, tenant_id: str, top_k: int = 5, threshold: float = 0.7):
    """
    1. Embed the user query
    2. Retrieve top-k similar chunks
    3. Return chunks with similarity above threshold
    """
    # Step 1: Embed query
    query_embedding = get_embeddings([query_text])[0]
    query_vector = embedding_to_string(query_embedding)

    # Step 2: Retrieve
    results = conn.execute("""
        SELECT
            id, content, metadata,
            1 - (embedding <=> $1::vector) AS similarity
        FROM documents
        WHERE tenant_id = $2
          AND 1 - (embedding <=> $1::vector) > $3
        ORDER BY embedding <=> $1::vector
        LIMIT $4
    """, [query_vector, tenant_id, threshold, top_k]).fetchall()

    return [
        {
            "id": row["id"],
            "content": row["content"],
            "metadata": row["metadata"],
            "similarity": row["similarity"],
        }
        for row in results
    ]

# Usage
chunks = rag_retrieve(conn, "How do I reset my password?", tenant_id, top_k=5)
context = "\n\n".join([c["content"] for c in chunks])
```

### With Metadata Filtering

```python
def rag_retrieve_filtered(conn, query_text, tenant_id, doc_type=None, date_from=None):
    query_embedding = get_embeddings([query_text])[0]
    query_vector = embedding_to_string(query_embedding)

    where_clauses = ["tenant_id = $1"]
    params = [tenant_id, query_vector]
    param_idx = 2

    if doc_type:
        param_idx += 1
        where_clauses.append(f"metadata->>'type' = ${param_idx}")
        params.append(doc_type)

    if date_from:
        param_idx += 1
        where_clauses.append(f"created_at >= ${param_idx}")
        params.append(date_from)

    where_sql = " AND ".join(where_clauses)

    sql = f"""
        SELECT id, content, metadata,
               1 - (embedding <=> $2::vector) AS similarity
        FROM documents
        WHERE {where_sql}
        ORDER BY embedding <=> $2::vector
        LIMIT 10
    """
    return conn.execute(sql, params).fetchall()
```

---

## Performance Tuning

### Connection Pooling with PgBouncer

```ini
# pgbouncer.ini - transaction mode is required for pgvector
[pgbouncer]
pool_mode = transaction
max_client_conn = 2000
default_pool_size = 25
```

```python
# Per-transaction ANN parameters
conn.execute("SET LOCAL hnsw.ef_search = 100")
```

### HNSW Index Maintenance

```sql
-- Reindex concurrently (no locks)
REINDEX INDEX CONCURRENTLY idx_documents_embedding;

-- Tune autovacuum for vector tables
ALTER TABLE documents SET (
    autovacuum_vacuum_scale_factor = 0.05,
    autovacuum_analyze_scale_factor = 0.02
);
```

### Monitoring

```sql
-- Check index usage
SELECT indexrelname, idx_scan, idx_tup_read
FROM pg_stat_user_indexes
WHERE indexrelname LIKE '%embedding%';

-- Check table bloat
SELECT
    n_live_tup, n_dead_tup,
    ROUND(100.0 * n_dead_tup / GREATEST(n_live_tup, 1), 1) AS dead_pct
FROM pg_stat_user_tables
WHERE tablename = 'documents';
```

### Scaling Tips

1. **Chunk wisely**: 512 tokens per chunk, not 4000
2. **Batch inserts**: 500 rows per `execute_values` call
3. **Set `maintenance_work_mem = 8GB`** before building HNSW indexes
4. **Use partial HNSW indexes** for multi-tenant workloads
5. **Monitor `hnsw.ef_search`**: increase for better recall, decrease for speed
6. **Consider `hnsw.ef_construction = 128`** for critical indexes (slower build, better recall)

---

## Sources

- pgvector GitHub: https://github.com/pgvector/pgvector
- datasops: Vector Search with pgvector - Similarity Search, HNSW Indexing, and Production Patterns
- ML Mastery: Building Vector Similarity Search in PostgreSQL with pgvector
- DataAspirant: pgvector Tutorial 2026
- TheCodeForge: pgvector Vector Search and Embeddings
- DeepWiki: Vector Search with pgvector | Just Use Postgres
