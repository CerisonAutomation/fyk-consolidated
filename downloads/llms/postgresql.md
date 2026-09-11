# PostgreSQL Performance Optimization Patterns

> Compiled from official PostgreSQL docs, Percona, DevPages, CloudPloy, and community guides (2024-2026).

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Memory Configuration](#memory-configuration)
- [Query Analysis with EXPLAIN](#query-analysis-with-explain)
- [Indexing Strategies](#indexing-strategies)
- [Connection Pooling](#connection-pooling)
- [Partitioning](#partitioning)
- [VACUUM and Maintenance](#vacuum-and-maintenance)
- [Replication and HA](#replication-and-ha)
- [Configuration Checklist](#configuration-checklist)

---

## Architecture Overview

PostgreSQL uses a **process-based architecture** (one backend process per connection). The shared memory area contains:

- **Buffer cache** (shared_buffers) - main data cache
- **WAL buffers** - write-ahead log buffering
- **Process arrays** - backend process management

Key internals:
- **MVCC** (Multi-Version Concurrency Control) enables high concurrency but requires careful vacuum tuning
- **Cost-based query planner** relies on accurate statistics; `ANALYZE` is critical
- **WAL** (Write-Ahead Logging) ensures crash safety; tuning impacts write performance

---

## Memory Configuration

### Production postgresql.conf

```ini
# Shared Buffers: 25% of RAM for dedicated servers
shared_buffers = 32GB
huge_pages = try
shared_preload_libraries = 'pg_stat_statements,auto_explain,pg_buffercache'

# Work Memory (per sort/hash operation - be careful with high concurrency)
work_mem = 256MB
maintenance_work_mem = 2GB
autovacuum_work_mem = 1GB

# WAL Configuration
wal_buffers = 64MB
wal_level = replica
max_wal_size = 16GB
min_wal_size = 2GB
checkpoint_completion_target = 0.9
checkpoint_timeout = 15min

# Query Planning
effective_cache_size = 96GB
random_page_cost = 1.1        # SSD storage
seq_page_cost = 1.0
cpu_tuple_cost = 0.01
cpu_index_tuple_cost = 0.005
cpu_operator_cost = 0.0025

# Connections
max_connections = 200
superuser_reserved_connections = 5

# Parallel Workers
max_worker_processes = 16
max_parallel_workers_per_gather = 4
max_parallel_workers = 16
max_parallel_maintenance_workers = 4

# Statistics
default_statistics_target = 100
track_activities = on
track_counts = on
track_io_timing = on
track_functions = all
```

### Key Tuning Rules

| Parameter | Rule of Thumb | Notes |
|-----------|--------------|-------|
| `shared_buffers` | 25% of RAM | Never exceed 8GB on older PG versions |
| `effective_cache_size` | 50-75% of RAM | Tells planner about total cache (OS + PG) |
| `work_mem` | 256MB-1GB | Per operation; multiplied by concurrent queries |
| `maintenance_work_mem` | 2-4GB | For VACUUM, CREATE INDEX, ALTER TABLE |
| `random_page_cost` | 1.1 for SSD, 4.0 for HDD | Affects planner's index vs seq scan choice |

---

## Query Analysis with EXPLAIN

### EXPLAIN Options

```sql
-- Basic execution plan
EXPLAIN SELECT * FROM orders WHERE customer_id = 123;

-- Full analysis with actual execution
EXPLAIN (ANALYZE, BUFFERS, VERBOSE, SETTINGS, WAL)
SELECT * FROM orders WHERE customer_id = 123;

-- Read-only analysis (no actual execution)
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE customer_id = 123;
```

### Reading Plans - What to Look For

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders
WHERE user_id = 12345
  AND status = 'completed'
  AND created_at > '2024-01-01'
ORDER BY created_at DESC
LIMIT 20;
```

**Red flags in plans:**
- `Seq Scan` on large tables = missing index
- `Rows Removed by Filter: 8234567` = reading millions of rows to return a few
- `Sort Method: external merge Disk` = work_mem too small
- `loops=N` with large N = correlated subquery running per row
- `Buffers: shared read=XXX` = cold data (not cached)

### pg_stat_statements Analysis

```sql
-- Enable in postgresql.conf
-- shared_preload_libraries = 'pg_stat_statements'

-- Find slowest queries
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    stddev_exec_time,
    rows,
    100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0) AS hit_ratio,
    temp_blks_written
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY total_exec_time DESC
LIMIT 20;
```

---

## Indexing Strategies

### Index Types Quick Reference

| Type | Use Case | Size | Write Impact |
|------|----------|------|--------------|
| B-Tree | Equality, range, sorting | Medium | Medium |
| GIN | JSONB, FTS, arrays | Large | High (slow writes) |
| GiST | Geometric, nearest-neighbor | Medium | Medium |
| BRIN | Large append-only tables | Tiny | Low |
| Hash | Equality only (PG 10+) | Medium | Medium |

### B-Tree (Default - Most Cases)

```sql
-- Composite index: equality before range
CREATE INDEX CONCURRENTLY idx_orders_user_date
    ON orders(user_id, order_date DESC)
    WHERE status != 'cancelled';

-- Expression index
CREATE INDEX CONCURRENTLY idx_users_lower_email
    ON users(LOWER(email));

-- Covering index with INCLUDE (PG 11+)
CREATE INDEX CONCURRENTLY idx_orders_covering
    ON orders(customer_id, order_date)
    INCLUDE (total_amount, status, shipping_address);
```

### Partial Indexes

```sql
-- Only index rows the query actually touches
CREATE INDEX CONCURRENTLY idx_orders_pending
    ON orders(created_at)
    WHERE status = 'pending' AND payment_status = 'unpaid';

-- Much smaller than indexing all rows
CREATE INDEX CONCURRENTLY idx_active_users_email
    ON users(email)
    WHERE is_active = true;
```

### GIN (JSONB, FTS, Arrays)

```sql
-- JSONB containment queries
CREATE INDEX idx_products_metadata
    ON products USING GIN(metadata jsonb_path_ops);

-- Full-text search
CREATE INDEX idx_products_search
    ON products USING GIN(
        to_tsvector('english', name || ' ' || description)
    );

-- Array contains
CREATE INDEX idx_tags_array
    ON articles USING GIN(tags);
```

### BRIN (Large Time-Series)

```sql
-- Tiny index for append-only tables with natural ordering
CREATE INDEX idx_logs_timestamp
    ON logs USING BRIN(timestamp)
    WITH (pages_per_range = 128);
```

### Finding Missing & Unused Indexes

```sql
-- Tables with high sequential scan rates (missing indexes)
SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan,
       seq_tup_read / GREATEST(seq_scan, 1) AS avg_tuples_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 1000 AND seq_tup_read > 100000
ORDER BY seq_tup_read DESC;

-- Unused indexes (wasting write resources)
SELECT schemaname, tablename, indexname, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Safely drop unused indexes
DROP INDEX CONCURRENTLY idx_unused_name;
```

---

## Connection Pooling

### Why PgBouncer

PostgreSQL forks a process per connection. Too many connections = too much memory, poor performance.

```
20 app instances x 20 pool = 400 connections
PostgreSQL configured for 100 max_connections = ERROR
```

### PgBouncer Configuration

```ini
[databases]
myapp_prod = host=db.internal port=5432 dbname=myapp user=app

[pgbouncer]
pool_mode = transaction          # Key setting
max_client_conn = 2000           # Accept many clients
default_pool_size = 25           # Multiplex onto few backends
min_pool_size = 10
reserve_pool_size = 5
```

### Pool Mode Comparison

| Mode | Reuse | Constraint |
|------|-------|-----------|
| Session | Held for client session | No multiplexing benefit |
| **Transaction** | Returned after each transaction | No prepared statements, SET, LISTEN/NOTIFY |
| Statement | Returned after each statement | No multi-statement transactions |

**Transaction pooling is the standard production choice**, but be aware: prepared statements and session state features break silently behind transaction pooling.

---

## Partitioning

### Range Partitioning (Time-Series)

```sql
CREATE TABLE measurements (
    id BIGSERIAL,
    sensor_id INTEGER NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    temperature NUMERIC(5,2),
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Monthly partitions
CREATE TABLE measurements_2024_01 PARTITION OF measurements
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE measurements_2024_02 PARTITION OF measurements
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Auto-create partitions with pg_cron
CREATE OR REPLACE FUNCTION create_monthly_partition() RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE + interval '1 month');
    end_date := start_date + interval '1 month';
    partition_name := 'measurements_' || to_char(start_date, 'YYYY_MM');

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF measurements FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
END;
$$ LANGUAGE plpgsql;
```

### List Partitioning (Categorical)

```sql
CREATE TABLE orders (
    order_id BIGSERIAL,
    region TEXT NOT NULL,
    customer_id INTEGER,
    total_amount NUMERIC(10,2),
    PRIMARY KEY (order_id, region)
) PARTITION BY LIST (region);

CREATE TABLE orders_north_america PARTITION OF orders
    FOR VALUES IN ('US', 'CA', 'MX');
CREATE TABLE orders_europe PARTITION OF orders
    FOR VALUES IN ('UK', 'DE', 'FR');
```

### Hash Partitioning (Even Distribution)

```sql
CREATE TABLE users (
    user_id BIGSERIAL PRIMARY KEY,
    username TEXT UNIQUE
) PARTITION BY HASH (user_id);

CREATE TABLE users_part_0 PARTITION OF users
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE users_part_1 PARTITION OF users
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);
```

**Benefits:** Partition pruning skips irrelevant partitions; smaller indexes fit in memory.

---

## VACUUM and Maintenance

### Autovacuum Tuning

```sql
-- Global settings
ALTER SYSTEM SET autovacuum_vacuum_scale_factor = 0.1;
ALTER SYSTEM SET autovacuum_analyze_scale_factor = 0.05;
ALTER SYSTEM SET autovacuum_vacuum_cost_delay = 2;
ALTER SYSTEM SET autovacuum_vacuum_cost_limit = 400;
ALTER SYSTEM SET autovacuum_max_workers = 6;
ALTER SYSTEM SET autovacuum_naptime = '30s';

-- Table-specific for high-update tables
ALTER TABLE high_update_table SET (
    autovacuum_vacuum_scale_factor = 0.01,
    autovacuum_analyze_scale_factor = 0.01,
    autovacuum_vacuum_cost_delay = 0
);
```

### Key Maintenance Commands

```sql
-- Update statistics (critical for planner accuracy)
ANALYZE orders;

-- Manual vacuum for specific tables
VACUUM (VERBOSE, ANALYZE) orders;

-- Reindex bloated indexes
REINDEX INDEX CONCURRENTLY idx_orders_customer_date;

-- Check table bloat
SELECT
    schemaname, tablename,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
    n_dead_tup,
    n_live_tup,
    ROUND(100.0 * n_dead_tup / GREATEST(n_live_tup, 1), 1) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 10000
ORDER BY n_dead_tup DESC;
```

---

## Replication and HA

### Streaming Replication

```ini
# postgresql.conf on primary
wal_level = replica
max_wal_senders = 10
wal_keep_segments = 64
max_replication_slots = 10
hot_standby = on
archive_mode = on
archive_command = 'rsync -a %p backup-server:/archive/%f'

# Synchronous replication
synchronous_standby_names = 'standby1,standby2'
synchronous_commit = on
```

### Logical Replication (Selective)

```sql
-- On publisher
CREATE PUBLICATION my_publication
    FOR TABLE customers, orders
    WHERE (active = true);

-- On subscriber
CREATE SUBSCRIPTION my_subscription
    CONNECTION 'host=primary-server dbname=mydb user=replicator'
    PUBLICATION my_publication;
```

### Monitor Replication Lag

```sql
SELECT
    client_addr, usename, application_name, state, sync_state,
    pg_wal_lsn_diff(pg_current_wal_lsn(), sent_lsn) AS sent_lag,
    pg_wal_lsn_diff(pg_current_wal_lsn(), flush_lsn) AS flush_lag,
    pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_lag
FROM pg_stat_replication;
```

---

## Configuration Checklist

### Before Going Live

1. [ ] Run `EXPLAIN (ANALYZE, BUFFERS)` on all critical queries
2. [ ] Ensure `pg_stat_statements` is enabled
3. [ ] Set `shared_buffers` to 25% of RAM
4. [ ] Set `effective_cache_size` to 50-75% of RAM
5. [ ] Set `random_page_cost` to 1.1 for SSDs
6. [ ] Deploy PgBouncer with transaction pooling
7. [ ] Review all indexes: drop unused, add missing
8. [ ] Tune autovacuum for high-update tables
9. [ ] Enable `track_io_timing` for I/O analysis
10. [ ] Set up replication monitoring

### Performance Monitoring Queries

```sql
-- Cache hit ratio (should be > 99%)
SELECT
    sum(blks_hit) / (sum(blks_hit) + sum(blks_read)) AS cache_hit_ratio
FROM pg_stat_database
WHERE datname = current_database();

-- Table cache hit ratio
SELECT
    schemaname, tablename,
    heap_blks_hit / (heap_blks_hit + heap_blks_read) AS table_cache_hit,
    idx_blks_hit / (idx_blks_hit + idx_blks_read) AS index_cache_hit
FROM pg_statio_user_tables
WHERE heap_blks_hit + heap_blks_read > 0
ORDER BY table_cache_hit ASC;

-- Active queries running long
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active'
  AND now() - pg_stat_activity.query_start > interval '5 minutes';
```

---

## Sources

- PostgreSQL Official Docs: https://www.postgresql.org/docs/current/performance-tips.html
- CloudPloy: PostgreSQL Performance Optimization Guide 2025
- Percona: PostgreSQL Performance Tuning Guide
- DevPages: PostgreSQL Performance Optimization: 15 Essential Techniques
- PostgresAI: Performance & Optimization Howtos
