## 2026-09-01 - Prevent Memory Bloat in Drizzle Pagination with Correlated Subqueries
**Learning:** Using `LEFT JOIN` and `GROUP BY` to count related records (e.g., counting comments for posts, or reviews for readers) causes significant memory bloat and performance degradation during pagination due to the database returning a row for every joined record before grouping them.
**Action:** Replace the `LEFT JOIN` + `GROUP BY` pattern with a correlated subquery using `sql<number>'(select count(*)::int from child_table where parentId = ${parent_table.id})'` to significantly improve query performance and reduce memory usage in Drizzle ORM/PostgreSQL.

## 2026-10-04 - React LCP Optimizations
**Learning:** React 18+ natively supports standard HTML attributes like `fetchPriority`, `loading`, and `decoding` on `<img>` elements without needing extra types or dependencies.
**Action:** Add `fetchPriority="high"` to above-the-fold hero images to improve LCP, and apply `loading="lazy"` along with `decoding="async"` to below-the-fold images to save memory and main thread execution time.
