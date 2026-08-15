# Bolt's Journal - Performance Learnings

## 2026-08-15 - Reader Marketplace SQL Aggregation Bottleneck
**Learning:** Joining raw review records before grouping in `listReaders` causes row multiplication (M*N) prior to `GROUP BY`, forcing Postgres to scan and aggregate unindexed review records across all reader profiles. Pre-aggregating review metrics in a CTE/subquery or left-joining a aggregated subquery reduces joined dataset size to 1 row per reader.
**Action:** When querying entities with total/average child aggregations (e.g. reviews, ratings, counts), always compute subquery aggregates per parent ID before joining to parent tables.
