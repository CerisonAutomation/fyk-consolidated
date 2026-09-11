# PostgreSQL Indexing Best Practices

> Compiled from official PostgreSQL docs, Percona, DevPages, and community guides (2024-2026).

## Table of Contents

- [Index Types Overview](#index-types-overview)
- [B-Tree Indexes](#b-tree-indexes)
- [Composite Index Design](#composite-index-design)
- [Partial Indexes](#partial-indexes)
- [Expression Indexes](#expression-indexes)
- [GIN Indexes](#gin-indexes)
- [GiST Indexes](#gist-indexes)
- [BRIN Indexes](#brin-indexes)
- [Hash Indexes](#hash-indexes)
- [JSONB Indexing](#jsonb-indexing)
- [Full-Text Search Indexing](#full-text-search-indexing)
- [Index Maintenance](#index-maintenance)
- [Finding Missing Indexes](#finding-missing-indexes)
- [Common Mistakes](#common-mistakes)

---

## Index Types Overview

| Type | Use Case | Size | Write Impact | When to Use |
|------|----------|------|--------------|-------------|
| **B-Tree** | Equality, range, sorting | Medium | Medium | Default choice for most queries |
| **GIN** | JSONB, FTS, arrays | Large | High | Containment, text search |
| **GiST** | Geometric, range, nearest | Medium | Medium | Spatial, range types |
| **BRIN** | Append-only, naturally ordered | Tiny | Low | Time-series, logs |
| **Hash** | Equality only | Medium | Medium | Simple equality lookups |
| **SP-GiST** | Non-balanced partitions | Medium | Medium | Points, ranges, text |

**Rule of thumb**: Start with B-Tree. Only use specialized types when you have a proven need.

---

## B-Tree Indexes

### Basic B-Tree

```sql
-- Single column equality/range
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);

-- Descending order
CREATE INDEX CONCURRENTLY idx_orders_created ON orders(created_at DESC);
```

### Covering Index (PG 11+)

```sql
-- INCLUDE columns to avoid heap access (index-only scan)
CREATE INDEX CONCURRENTLY idx_orders_covering
    ON orders(customer_id, order_date)
    INCLUDE (total_amount, status, shipping_address);

-- Query can be satisfied entirely from the index
SELECT customer_id, order_date, total_amount, status, shipping_address
FROM orders
WHERE customer_id = 12345
ORDER BY order_date DESC;
```

### Unique B-Tree

```sql
-- Enforces uniqueness + enables fast lookups
CREATE UNIQUE INDEX CONCURRENTLY idx_users_email_unique ON users(email);
```

---

## Composite Index Design

### Column Order Rules

**Rule 1: Equality before range**

```sql
-- BAD: range first, second column not usefully sorted
CREATE INDEX idx_bad ON orders(created_at, user_id);

-- GOOD: equality first, then range
CREATE INDEX idx_good ON orders(user_id, created_at DESC);
```

**Rule 2: Most selective first** (when selectivity is known)

```sql
-- If status has 5 values but user_id has millions:
CREATE INDEX idx_good ON orders(status, user_id, created_at);
```

**Rule 3: Leading subset serves narrower queries**

```sql
-- This index serves ALL of these queries:
CREATE INDEX idx_composite ON orders(user_id, status, created_at);

-- Query 1: WHERE user_id = ?                   ✓ uses full index
-- Query 2: WHERE user_id = ? AND status = ?    ✓ uses full index
-- Query 3: WHERE user_id = ? AND created_at > ? ✓ uses first + third columns

-- But NOT this:
-- Query 4: WHERE status = ? AND created_at > ?  ✗ can't skip first column
```

### DESC Ordering

```sql
-- For queries that sort DESC
CREATE INDEX idx_orders_user_date_desc
    ON orders(user_id, created_at DESC);

-- For bidirectional sorting (PG 8.3+)
CREATE INDEX idx_orders_user_date_both
    ON orders(user_id, created_at DESC NULLS FIRST);
```

---

## Partial Indexes

### When to Use

Use partial indexes when a query **always** filters on a specific condition:

```sql
-- BAD: indexes every row
CREATE INDEX idx_users_email ON users(email);

-- GOOD: only indexes active users (if most queries filter on is_active)
CREATE INDEX idx_active_users_email ON users(email)
    WHERE is_active = true;

-- The filtered subset is small = smaller index = faster writes + better cache
```

### Common Partial Index Patterns

```sql
-- Pending orders (most common query pattern)
CREATE INDEX CONCURRENTLY idx_orders_pending
    ON orders(created_at)
    WHERE status = 'pending' AND payment_status = 'unpaid';

-- Recent events (only last 90 days)
CREATE INDEX CONCURRENTLY idx_events_recent
    ON events(user_id, created_at)
    WHERE created_at > NOW() - INTERVAL '90 days';

-- Active products
CREATE INDEX CONCURRENTLY idx_products_active
    ON products(category_id, price)
    WHERE is_active = true AND stock > 0;

-- Unresolved tickets
CREATE INDEX CONCURRENTLY idx_tickets_open
    ON tickets(assignee_id, created_at)
    WHERE resolved_at IS NULL;
```

### Limitation

The planner only uses a partial index when it can prove the query's WHERE clause **implies** the index predicate. A query without `is_active = true` won't use the index.

---

## Expression Indexes

### When a Function Call Defeats a Plain Index

```sql
-- BAD: can't use index on email
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';

-- GOOD: expression index matches the query
CREATE INDEX CONCURRENTLY idx_users_email_lower
    ON users(LOWER(email));
```

### Common Expression Index Patterns

```sql
-- Date extraction
CREATE INDEX CONCURRENTLY idx_orders_year_month
    ON orders(
        (EXTRACT(YEAR FROM order_date)),
        (EXTRACT(MONTH FROM order_date))
    );

-- JSONB path
CREATE INDEX CONCURRENTLY idx_events_tags
    ON events USING GIN ((metadata -> 'tags'));

-- Case-insensitive search (or use citext type)
CREATE INDEX CONCURRENTLY idx_users_name_ci
    ON users(UPPER(last_name), UPPER(first_name));
```

**Important**: The expression in the index must match the query's expression exactly.

---

## GIN Indexes

### JSONB Containment

```sql
-- jsonb_path_ops: smaller, faster for @> queries
CREATE INDEX CONCURRENTLY idx_products_metadata
    ON products USING GIN(metadata jsonb_path_ops);

-- Query: find products with "urgent" tag
SELECT * FROM products WHERE metadata @> '{"tags": ["urgent"]}';

-- jsonb_ops: supports ?, ?|, ?& operators too
CREATE INDEX CONCURRENTLY idx_events_metadata
    ON events USING GIN(metadata);
```

### GIN vs GiST for JSONB

| Feature | GIN | GiST |
|---------|-----|------|
| Lookup speed | Faster | Slower |
| Write speed | Slower | Faster |
| Index size | Larger | Smaller |
| Containment (@>) | Yes | Yes |
| Key-existence (?, ?\|, ?&) | jsonb_ops only | Yes |

**Read-heavy**: GIN. **Write-heavy**: GiST.

### Array Contains

```sql
CREATE INDEX CONCURRENTLY idx_articles_tags
    ON articles USING GIN(tags);

SELECT * FROM articles WHERE tags @> ARRAY['postgresql', 'optimization'];
```

---

## GiST Indexes

### Geometric/Spatial

```sql
-- PostGIS spatial index
CREATE INDEX idx_locations_gist ON locations USING GIST(coordinates);

-- Range types (tsrange, int4range, etc.)
CREATE INDEX CONCURRENTLY idx_events_daterange
    ON events USING GIST(during);
```

### Nearest Neighbor

```sql
-- GiST supports KNN with <-> operator
CREATE INDEX idx_points_gist ON points USING GIST(location);

SELECT * FROM points
ORDER BY location <-> ST_SetSRID(ST_MakePoint(0, 0), 4326)
LIMIT 10;
```

---

## BRIN Indexes

### The Most Under-Used Index

BRIN (Block Range Index) is tiny but excellent for tables with **natural physical ordering**.

```sql
-- Perfect for append-only time-series
CREATE INDEX CONCURRENTLY idx_logs_timestamp
    ON logs USING BRIN(timestamp)
    WITH (pages_per_range = 128);

-- B-tree equivalent would be 100x larger
-- BRIN index size: ~few KB for millions of rows
```

### When BRIN Works

- Append-only tables (logs, events, sensor data)
- Data arrives in timestamp order
- Range queries on the indexed column

### When BRIN Fails

- Random insertion order
- Updates that change indexed values
- Small tables (B-tree is better)

### Tuning `pages_per_range`

```sql
-- Default is 128; lower = more accurate but larger
-- Higher = less accurate but smaller
CREATE INDEX idx_logs_brin
    ON logs USING BRIN(timestamp)
    WITH (pages_per_range = 32);  -- More accurate
```

---

## Hash Indexes

### Equality Only

```sql
-- Hash index for simple equality lookups
CREATE INDEX CONCURRENTLY idx_users_email_hash
    ON users USING HASH(email);

-- Only supports: WHERE email = 'user@example.com'
-- Does NOT support: WHERE email LIKE 'user%'
```

Hash indexes are smaller than B-tree for equality-only workloads, but B-tree is more versatile.

---

## JSONB Indexing Patterns

### Containment Queries

```sql
-- For @> operator (most common JSONB query)
CREATE INDEX CONCURRENTLY idx_metadata_jsonb_path
    ON documents USING GIN(metadata jsonb_path_ops);

-- For ?, ?|, ?& operators
CREATE INDEX CONCURRENTLY idx_metadata_jsonb_ops
    ON documents USING GIN(metadata);
```

### Specific Key Index

```sql
-- Index a specific JSONB key for equality/range
CREATE INDEX CONCURRENTLY idx_events_type
    ON events USING BTREE ((metadata ->> 'event_type'));

-- Query can use the index
SELECT * FROM events WHERE metadata ->> 'event_type' = 'click';
```

### Composite JSONB Index

```sql
-- Index multiple JSONB keys together
CREATE INDEX CONCURRENTLY idx_events_type_page
    ON events USING BTREE (
        (metadata ->> 'event_type'),
        (metadata ->> 'page')
    );
```

---

## Full-Text Search Indexing

### GIN Index for tsvector

```sql
-- Create tsvector column and index
ALTER TABLE articles ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
    ) STORED;

CREATE INDEX CONCURRENTLY idx_articles_search
    ON articles USING GIN(search_vector);

-- Query
SELECT * FROM articles
WHERE search_vector @@ plainto_tsquery('postgresql', 'database optimization');
```

### Separate tsvector Column (Manual Control)

```sql
-- More control over weights and configuration
ALTER TABLE articles ADD COLUMN search_vector tsvector;

UPDATE articles SET search_vector =
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(body, '')), 'B');

CREATE INDEX CONCURRENTLY idx_articles_search
    ON articles USING GIN(search_vector);

-- Weighted search
SELECT *, ts_rank(search_vector, query) AS rank
FROM articles, plainto_tsquery('postgresql', 'database optimization') query
WHERE search_vector @@ query
ORDER BY rank DESC;
```

---

## Index Maintenance

### Find Unused Indexes

```sql
SELECT
    schemaname, tablename, indexname,
    idx_scan,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelid NOT IN (
      SELECT conindid FROM pg_constraint WHERE contype IN ('p', 'u')
  )
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Safely Drop Unused Indexes

```sql
-- Always use CONCURRENTLY in production
DROP INDEX CONCURRENTLY idx_unused_name;
```

### Monitor Index Usage

```sql
-- Index scan rates
SELECT
    schemaname, tablename, indexname,
    idx_scan AS scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Reindex Bloated Indexes

```sql
-- Reindex without locking (PG 12+)
REINDEX INDEX CONCURRENTLY idx_orders_customer_date;

-- Reindex all indexes on a table
REINDEX TABLE CONCURRENTLY orders;
```

### Check Index Bloat

```sql
SELECT
    indexrelname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'orders'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## Finding Missing Indexes

### Sequential Scan Detection

```sql
-- Tables with high seq scan rates
SELECT
    schemaname, tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    seq_tup_read / GREATEST(seq_scan, 1) AS avg_tuples_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 1000
  AND seq_tup_read > 100000
  AND schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY seq_tup_read DESC;
```

### Correlate with Slow Queries

```sql
-- Join with pg_stat_statements to find the worst offenders
SELECT
    s.query,
    s.calls,
    s.mean_exec_time,
    t.seq_scan,
    t.seq_tup_read
FROM pg_stat_statements s
JOIN pg_stat_user_tables t ON s.query ILIKE '%' || t.tablename || '%'
WHERE t.seq_scan > 1000
ORDER BY s.mean_exec_time DESC
LIMIT 10;
```

### EXPLAIN ANALYZE to Confirm

```sql
-- After suspecting a missing index, confirm with EXPLAIN
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders
WHERE user_id = 12345 AND status = 'completed';

-- Look for:
-- "Seq Scan on orders" → missing index
-- "Rows Removed by Filter: 8234567" → reading too many rows
```

---

## Common Mistakes

### 1. Indexing Everything

Every index is a tax on writes. Only add indexes that are used by real queries:

```sql
-- Find indexes that are never scanned
SELECT indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND schemaname = 'public';
```

### 2. Wrong Column Order in Composite Index

```sql
-- BAD: range before equality
CREATE INDEX idx_bad ON orders(created_at, user_id);

-- GOOD: equality before range
CREATE INDEX idx_good ON orders(user_id, created_at DESC);
```

### 3. Forgetting CONCURRENTLY

```sql
-- BAD: locks table for writes during index creation
CREATE INDEX idx_slow ON big_table(column);

-- GOOD: no lock, allows concurrent writes
CREATE INDEX CONCURRENTLY idx_fast ON big_table(column);
```

### 4. Using LIKE with Leading Wildcard

```sql
-- Can't use B-tree index
SELECT * FROM users WHERE email LIKE '%@gmail.com';

-- Can use B-tree index
SELECT * FROM users WHERE email LIKE 'user%';

-- For trailing wildcard, use GIN with pg_trgm
CREATE INDEX CONCURRENTLY idx_users_email_trgm
    ON users USING GIN(email gin_trgm_ops);

SELECT * FROM users WHERE email LIKE '%gmail%';
```

### 5. Not Running ANALYZE After Bulk Operations

```sql
-- After large inserts/updates, statistics may be stale
ANALYZE orders;

-- Or for specific columns
ALTER TABLE orders ALTER COLUMN user_id SET STATISTICS 1000;
ANALYZE orders;
```

### 6. Ignoring Partial Index Opportunities

```sql
-- If 90% of queries filter on status = 'active'
-- Partial index is 10x smaller and faster
CREATE INDEX CONCURRENTLY idx_orders_active
    ON orders(user_id, created_at)
    WHERE status = 'active';
```

### 7. Not Monitoring Index Size

```sql
-- Check if indexes are growing unreasonably
SELECT
    indexrelname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## Decision Flowchart

```
Need an index?
  |
  +-- Is it for equality on a scalar? → B-Tree
  |
  +-- Is it for range + equality? → B-Tree composite (equality first)
  |
  +-- Always filtering on a condition? → Partial Index (B-Tree)
  |
  +-- Query uses a function on column? → Expression Index
  |
  +-- JSONB containment (@>)? → GIN (jsonb_path_ops)
  |
  +-- Full-text search? → GIN (tsvector)
  |
  +-- Array contains (@>)? → GIN
  |
  +-- Spatial/geometric? → GiST (or SP-GiST for points)
  |
  +-- Append-only time-series? → BRIN
  |
  +-- Simple equality, small table? → Hash
```

---

## Sources

- PostgreSQL Official Docs: https://www.postgresql.org/docs/current/indexes.html
- DevPages: PostgreSQL Performance Optimization: 15 Essential Techniques
- Percona: PostgreSQL Performance Tuning Guide
- PostgreSQL Wiki: Index Maintenance
