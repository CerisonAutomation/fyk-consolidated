# PostgreSQL Query Optimization Patterns

> Compiled from official PostgreSQL docs, Percona, DevPages, Simi Studio, and community guides (2024-2026).

## Table of Contents

- [EXPLAIN ANALYZE Mastery](#explain-analyze-mastery)
- [Reading Execution Plans](#reading-execution-plans)
- [Common Anti-Patterns](#common-anti-patterns)
- [JOIN Optimization](#join-optimization)
- [Subquery vs JOIN](#subquery-vs-join)
- [Window Functions](#window-functions)
- [Pagination Patterns](#pagination-patterns)
- [CTE Optimization](#cte-optimization)
- [Aggregation Optimization](#aggregation-optimization)
- [String and Pattern Matching](#string-and-pattern-matching)
- [Configuration Tuning](#configuration-tuning)

---

## EXPLAIN ANALYZE Mastery

### Basic Usage

```sql
-- Simple plan (no execution)
EXPLAIN SELECT * FROM orders WHERE user_id = 123;

-- Full analysis with actual execution
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = 123;

-- Comprehensive analysis
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, WAL, FORMAT TEXT)
SELECT * FROM orders WHERE user_id = 123;
```

### What Each Option Shows

| Option | What It Shows |
|--------|--------------|
| `ANALYZE` | Actual execution time and rows |
| `BUFFERS` | Blocks read from cache vs disk |
| `VERBOSE` | Output columns, subquery details |
| `SETTINGS` | Planner settings used |
| `WAL` | WAL records generated |
| `FORMAT` | TEXT, XML, JSON, YAML |

### Reading the Output

```
Index Scan using idx_orders_user_date on orders  (cost=0.43..8.45 rows=1 width=245)
                                                  (actual time=0.025..0.026 rows=1 loops=1)
  Index Cond: (user_id = 12345)
  Buffers: shared hit=4
Planning Time: 0.089 ms
Execution Time: 0.052 ms
```

**Key fields:**
- `cost=0.43..8.45` - Estimated cost (startup..total)
- `rows=1` - Estimated rows
- `actual time=0.025..0.026` - Actual time (startup..total)
- `rows=1 loops=1` - Actual rows, number of times node executed
- `Buffers: shared hit=4` - Cache hits (good) vs reads (bad)

---

## Reading Execution Plans

### Red Flags to Watch For

**1. Sequential Scan on Large Tables**
```
Seq Scan on orders  (cost=0.00..387429.50 rows=1234 width=245)
Rows Removed by Filter: 8234567
```
→ **Missing index**. The `Rows Removed by Filter` count is the clearest signal.

**2. Nested Loops with High Loop Count**
```
Nested Loop  (cost=0.43..8.45 rows=1) (actual time=0.025..0.026 rows=1 loops=10000)
```
→ **Correlated subquery** running per row. Rewrite as JOIN or window function.

**3. External Merge Sort**
```
Sort Method: external merge  Disk: 4096 kB
```
→ **work_mem too small**. Increase or optimize query.

**4. Hash Inequality**
```
Hash  (cost=1234.00..1234.00 rows=100000) (actual time=50.00..50.00 rows=100000 loops=1)
Batches: 1  Memory Usage: 36801kB
```
→ Hash table spilled to disk. Consider `work_mem` increase or query rewrite.

**5. High Buffers Read**
```
Buffers: shared read=15000
```
→ Cold data not in cache. Check `effective_cache_size` and query frequency.

### Useful Diagnostic Queries

```sql
-- Find queries with high cache miss rate
SELECT
    query,
    calls,
    shared_blks_hit,
    shared_blks_read,
    ROUND(
        100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0),
        2
    ) AS hit_ratio
FROM pg_stat_statements
WHERE shared_blks_hit + shared_blks_read > 10000
ORDER BY shared_blks_read DESC
LIMIT 10;
```

---

## Common Anti-Patterns

### 1. N+1 Queries

```javascript
// BAD: 101 round trips
const users = await db.query('SELECT * FROM users LIMIT 100');
for (const user of users.rows) {
    user.orders = await db.query(
        'SELECT * FROM orders WHERE user_id = $1', [user.id]
    );
}

// GOOD: 1 round trip
const result = await db.query(`
    SELECT u.id, u.name, u.email,
           json_agg(json_build_object(
               'id', o.id, 'total', o.total, 'status', o.status
           )) as orders
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    WHERE u.id = ANY($1)
    GROUP BY u.id, u.name, u.email
`, [userIds]);
```

**The cost is network round trips, not query execution.** A hundred 2ms queries with 3ms latency each is far worse than one 20ms query.

### 2. SELECT *

```sql
-- BAD: fetches all columns
SELECT * FROM orders WHERE user_id = 123;

-- GOOD: fetch only what you need
SELECT id, total, status, created_at FROM orders WHERE user_id = 123;

-- BEST: use covering index
-- Index on (user_id) INCLUDE (id, total, status, created_at)
```

### 3. OR Instead of IN/UNION ALL

```sql
-- BAD: may not use index efficiently
SELECT * FROM orders WHERE status = 'pending' OR status = 'processing';

-- GOOD: optimizer handles IN better
SELECT * FROM orders WHERE status IN ('pending', 'processing');

-- BETTER: if only two values, UNION ALL can be faster
SELECT * FROM orders WHERE status = 'pending'
UNION ALL
SELECT * FROM orders WHERE status = 'processing';
```

### 4. NOT IN with NULLs

```sql
-- DANGEROUS: returns no rows if subquery contains NULL
SELECT * FROM users WHERE id NOT IN (SELECT user_id FROM banned_users);

-- SAFE: use NOT EXISTS
SELECT * FROM users u
WHERE NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.user_id = u.id);

-- OR: use LEFT JOIN
SELECT u.* FROM users u
LEFT JOIN banned_users b ON u.id = b.user_id
WHERE b.user_id IS NULL;
```

### 5. Functions on Indexed Columns

```sql
-- BAD: defeats B-tree index
SELECT * FROM users WHERE LOWER(email) = 'user@example.com';
SELECT * FROM orders WHERE EXTRACT(YEAR FROM created_at) = 2024;

-- GOOD: expression index
CREATE INDEX idx_users_email_lower ON users(LOWER(email));
CREATE INDEX idx_orders_year ON orders(EXTRACT(YEAR FROM created_at));
```

---

## JOIN Optimization

### JOIN Order

PostgreSQL's optimizer handles JOIN order automatically, but explicit ordering can help:

```sql
-- Let optimizer choose (usually best)
SELECT * FROM orders o
JOIN customers c ON o.customer_id = c.id
JOIN products p ON o.product_id = p.id;

-- Force order when you know better (use sparingly)
SELECT * FROM orders o
JOIN LATERAL (
    SELECT * FROM customers c WHERE c.id = o.customer_id
) c ON true
JOIN LATERAL (
    SELECT * FROM products p WHERE p.id = o.product_id
) p ON true;
```

### JOIN Types

| Type | Use When |
|------|----------|
| INNER JOIN | You only want matching rows |
| LEFT JOIN | You want all rows from left table |
| RIGHT JOIN | Rarely needed; rewrite as LEFT JOIN |
| FULL JOIN | You want all rows from both tables |
| CROSS JOIN | You want the Cartesian product |
| LATERAL JOIN | Subquery depends on outer query |

### LATERAL JOIN for Top-N Per Group

```sql
-- Get top 3 orders per customer
SELECT c.id, c.name, o.*
FROM customers c
JOIN LATERAL (
    SELECT id, total, created_at
    FROM orders o
    WHERE o.customer_id = c.id
    ORDER BY created_at DESC
    LIMIT 3
) o ON true;
```

### Avoid笛卡尔积 (Cartesian Products)

```sql
-- BAD: forgot JOIN condition
SELECT * FROM orders, customers;

-- BAD: implicit cross join
SELECT * FROM orders CROSS JOIN customers;

-- GOOD: explicit JOIN with condition
SELECT * FROM orders o JOIN customers c ON o.customer_id = c.id;
```

---

## Subquery vs JOIN

### EXISTS vs COUNT

```sql
-- BAD: counts every matching row
SELECT u.id, u.name
FROM users u
WHERE (SELECT COUNT(*) FROM orders WHERE user_id = u.id) > 0;

-- GOOD: stops at first match
SELECT u.id, u.name
FROM users u
WHERE EXISTS (SELECT 1 FROM orders WHERE user_id = u.id);
```

### IN vs JOIN vs EXISTS

```sql
-- IN: good for small lists
SELECT * FROM orders WHERE customer_id IN (1, 2, 3);

-- JOIN: good when you need columns from the subquery
SELECT o.*, c.name
FROM orders o
JOIN customers c ON o.customer_id = c.id;

-- EXISTS: good for correlated subqueries
SELECT * FROM orders o
WHERE EXISTS (SELECT 1 FROM customers c WHERE c.id = o.customer_id AND c.active = true);
```

### Correlated Subquery Anti-Pattern

```sql
-- BAD: subquery runs once per row
SELECT u.id, u.name,
       (SELECT MAX(created_at) FROM orders WHERE user_id = u.id) AS last_order
FROM users u;

-- GOOD: JOIN or window function
SELECT u.id, u.name, MAX(o.created_at) AS last_order
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name;
```

---

## Window Functions

### Replace Correlated Subqueries

```sql
-- BAD: correlated subquery per row
SELECT u.id, u.name,
       (SELECT json_agg(o.*) FROM (
           SELECT * FROM orders WHERE user_id = u.id ORDER BY created_at DESC LIMIT 3
       ) o) as recent_orders
FROM users u;

-- GOOD: window function in single pass
WITH ranked_orders AS (
    SELECT o.*,
           ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
    FROM orders o
)
SELECT u.id, u.name,
       json_agg(ro.*) FILTER (WHERE ro.rn <= 3) as recent_orders
FROM users u
LEFT JOIN ranked_orders ro ON u.id = ro.user_id AND ro.rn <= 3
GROUP BY u.id, u.name;
```

### Common Window Functions

```sql
-- ROW_NUMBER: unique sequential number
ROW_NUMBER() OVER (PARTITION BY department ORDER BY salary DESC)

-- RANK: same rank for ties, gaps after
RANK() OVER (PARTITION BY department ORDER BY salary DESC)

-- DENSE_RANK: same rank for ties, no gaps
DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC)

-- LAG/LEAD: access previous/next rows
LAG(salary, 1) OVER (ORDER BY hire_date)
LEAD(salary, 1) OVER (ORDER BY hire_date)

-- Running totals
SUM(amount) OVER (ORDER BY created_at ROWS UNBOUNDED PRECEDING)

-- Moving average
AVG(amount) OVER (ORDER BY created_at ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)
```

---

## Pagination Patterns

### OFFSET/LIMIT (Bad for Large Offsets)

```sql
-- BAD: slow for large offsets (must scan all skipped rows)
SELECT * FROM orders ORDER BY id LIMIT 20 OFFSET 1000000;

-- Gets progressively slower as offset increases
```

### Keyset Pagination (Recommended)

```sql
-- GOOD: consistent performance regardless of page
SELECT * FROM orders
WHERE id > $last_seen_id
ORDER BY id
LIMIT 20;

-- For composite sort
SELECT * FROM orders
WHERE (created_at, id) > ($last_created_at, $last_id)
ORDER BY created_at, id
LIMIT 20;
```

### Cursor-Based Pagination

```sql
-- Encode the last seen value as a cursor
-- Application: base64_encode(last_id)
SELECT * FROM orders
WHERE id > $decoded_cursor
ORDER BY id
LIMIT 20;
```

### Keyset vs OFFSET

| Approach | Performance | Random Access | Works with ORDER BY |
|----------|------------|---------------|-------------------|
| OFFSET/LIMIT | Degrades with offset | Yes | Any |
| Keyset | Constant | No (forward only) | Must use indexed columns |

---

## CTE Optimization

### CTE Inlining (PG 12+)

```sql
-- CTEs are inlined by default in PG 12+
-- This is now as efficient as a subquery
WITH active_users AS (
    SELECT id, name FROM users WHERE is_active = true
)
SELECT u.name, COUNT(o.id) as order_count
FROM active_users u
JOIN orders o ON u.id = o.user_id
GROUP BY u.name;
```

### Materialized CTEs

```sql
-- Force materialization when CTE is expensive and referenced multiple times
WITH expensive_calc AS MATERIALIZED (
    SELECT user_id, SUM(total) as lifetime_value
    FROM orders
    GROUP BY user_id
)
SELECT u.name, e.lifetime_value
FROM users u
JOIN expensive_calc e ON u.id = e.user_id
WHERE e.lifetime_value > 1000;
```

### Recursive CTEs

```sql
-- Find all descendants in a tree
WITH RECURSIVE tree AS (
    -- Base case: root nodes
    SELECT id, parent_id, name, 1 as depth
    FROM categories
    WHERE parent_id IS NULL

    UNION ALL

    -- Recursive case: children
    SELECT c.id, c.parent_id, c.name, t.depth + 1
    FROM categories c
    JOIN tree t ON c.parent_id = t.id
    WHERE t.depth < 10  -- prevent infinite loops
)
SELECT * FROM tree ORDER BY depth, name;
```

---

## Aggregation Optimization

### GROUP BY Optimization

```sql
-- BAD: GROUP BY on non-indexed column
SELECT department, COUNT(*) FROM employees GROUP BY department;

-- GOOD: ensure index supports GROUP BY
CREATE INDEX idx_employees_department ON employees(department);
```

### FILTER Clause (PG 9.4+)

```sql
-- Conditional aggregation in single pass
SELECT
    COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed_count
FROM orders;
```

### Approximate Aggregation

```sql
-- HyperLogLog for distinct count (if extension available)
CREATE EXTENSION IF NOT EXISTS hyperloglog;
SELECT hll_add_agg(hll_hash_integer(user_id)) FROM orders;
SELECT hll_cardinality(hll_add_agg(hll_hash_integer(user_id))) FROM orders;
```

### Materialized Views for Heavy Aggregations

```sql
-- Pre-compute expensive aggregations
CREATE MATERIALIZED VIEW mv_order_summary AS
SELECT
    customer_id,
    COUNT(*) as order_count,
    SUM(total) as total_spent,
    AVG(total) as avg_order,
    MAX(created_at) as last_order
FROM orders
GROUP BY customer_id;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_order_summary;
```

---

## String and Pattern Matching

### LIKE Optimization

```sql
-- BAD: leading wildcard defeats index
SELECT * FROM users WHERE name LIKE '%smith%';

-- GOOD: trailing wildcard can use index
SELECT * FROM users WHERE name LIKE 'smith%';

-- For arbitrary substring search, use pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY idx_users_name_trgm
    ON users USING GIN(name gin_trgm_ops);

SELECT * FROM users WHERE name % 'smith';  -- similarity search
SELECT * FROM users WHERE name ILIKE '%smith%';  -- now uses trigram index
```

### Full-Text Search

```sql
-- BAD: LIKE for text search
SELECT * FROM articles WHERE content LIKE '%postgresql optimization%';

-- GOOD: full-text search with GIN index
CREATE INDEX CONCURRENTLY idx_articles_search
    ON articles USING GIN(to_tsvector('english', content));

SELECT * FROM articles
WHERE to_tsvector('english', content) @@ plainto_tsquery('postgresql optimization');
```

### Regular Expressions

```sql
-- BAD: regex on large tables (no index usage)
SELECT * FROM users WHERE email ~ '^[a-z]+@gmail\.com$';

-- GOOD: expression index for common patterns
CREATE INDEX CONCURRENTLY idx_users_email_domain
    ON users(LOWER(SPLIT_PART(email, '@', 2)));
```

---

## Configuration Tuning

### Planner Settings

```ini
# postgresql.conf

# Cost settings (affect index vs seq scan decisions)
random_page_cost = 1.1        # SSD: 1.1, HDD: 4.0
seq_page_cost = 1.0
cpu_tuple_cost = 0.01
cpu_index_tuple_cost = 0.005
cpu_operator_cost = 0.0025

# Memory for sorts and hash operations
work_mem = 256MB              # Per operation!

# Planner behavior
enable_hashjoin = on
enable_mergejoin = on
enable_nestloop = on          # Usually best for small result sets

# Parallel query
max_parallel_workers_per_gather = 4
parallel_tuple_cost = 0.01
parallel_setup_cost = 1000
```

### Statistics

```ini
# Increase for columns with complex distributions
default_statistics_target = 100

# Per-column statistics
ALTER TABLE orders ALTER COLUMN user_id SET STATISTICS 500;
ANALYZE orders;
```

### Work Mem Tuning

```sql
-- Set per-session for complex queries
SET work_mem = '1GB';

-- Run complex query
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;

-- Reset
RESET work_mem;
```

---

## Monitoring Queries

### pg_stat_statements

```sql
-- Top 10 by total time
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows / GREATEST(calls, 1) AS avg_rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Top 10 by calls (frequently executed)
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;
```

### Slow Query Log

```ini
# postgresql.conf
log_min_duration_statement = 1000  # Log queries > 1 second
log_statement = 'none'             # Don't log all statements
log_duration = off
```

### Real-Time Monitoring

```sql
-- Active queries running long
SELECT
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - pg_stat_activity.query_start > interval '5 minutes'
ORDER BY duration DESC;

-- Locks
SELECT
    l.pid,
    l.mode,
    l.granted,
    a.query
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE NOT l.granted;
```

---

## Quick Reference: Optimization Checklist

1. [ ] Run `EXPLAIN (ANALYZE, BUFFERS)` on slow queries
2. [ ] Check for `Seq Scan` on large tables
3. [ ] Check `Rows Removed by Filter` ratio
4. [ ] Verify indexes are being used
5. [ ] Replace N+1 queries with JOINs
6. [ ] Use EXISTS instead of COUNT for existence checks
7. [ ] Use keyset pagination instead of OFFSET
8. [ ] Add covering indexes for frequent queries
9. [ ] Use partial indexes for filtered queries
10. [ ] Increase `work_mem` for complex sorts/hashes
11. [ ] Run `ANALYZE` after bulk operations
12. [ ] Monitor with `pg_stat_statements`

---

## Sources

- PostgreSQL Official Docs: https://www.postgresql.org/docs/current/performance-tips.html
- DevPages: PostgreSQL Performance Optimization: 15 Essential Techniques
- Percona: PostgreSQL Performance Tuning Guide
- Simi Studio: PostgreSQL Performance Optimization: 10x Faster Queries
- PostgreSQL Wiki: Performance Optimization
