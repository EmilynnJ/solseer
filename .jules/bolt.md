## 2026-09-01 - Prevent Memory Bloat in Drizzle Pagination with Correlated Subqueries
**Learning:** Using `LEFT JOIN` and `GROUP BY` to count related records (e.g., counting comments for posts, or reviews for readers) causes significant memory bloat and performance degradation during pagination due to the database returning a row for every joined record before grouping them.
**Action:** Replace the `LEFT JOIN` + `GROUP BY` pattern with a correlated subquery using `sql<number>'(select count(*)::int from child_table where parentId = ${parent_table.id})'` to significantly improve query performance and reduce memory usage in Drizzle ORM/PostgreSQL.
## 2026-09-06 - Webhook Signature Public Key Caching
**Learning:** Network requests and cryptographic imports (`crypto.subtle.importKey`) performed synchronously on every webhook request are a significant source of latency and CPU overhead, especially when the key data is static.
**Action:** Use a module-level variable to cache the result of the `importKey` operation alongside the source URL to dramatically reduce latency and CPU cost on subsequent executions.
