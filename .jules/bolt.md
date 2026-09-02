## 2026-09-02 - Drizzle ORM Pagination Performance and Memory Bloat
**Learning:** In Drizzle ORM/PostgreSQL, using `LEFT JOIN` and `GROUP BY` patterns for counting or averaging related records can significantly degrade pagination performance and cause result set memory bloat. This is a common performance bottleneck in this codebase's architecture.
**Action:** Replace `LEFT JOIN` + `GROUP BY` patterns with correlated subqueries using `sql(...)` for counting/averaging related records, especially when pagination or limits are involved.
