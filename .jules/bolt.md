## 2026-09-01 - Prevent Memory Bloat in Drizzle Pagination with Correlated Subqueries
**Learning:** Using `LEFT JOIN` and `GROUP BY` to count related records (e.g., counting comments for posts, or reviews for readers) causes significant memory bloat and performance degradation during pagination due to the database returning a row for every joined record before grouping them.
**Action:** Replace the `LEFT JOIN` + `GROUP BY` pattern with a correlated subquery using `sql<number>'(select count(*)::int from child_table where parentId = ${parent_table.id})'` to significantly improve query performance and reduce memory usage in Drizzle ORM/PostgreSQL.

## 2026-09-19 - Prioritize Loading of Above-the-Fold Images
**Learning:** Above-the-fold images (e.g. hero images) can significantly delay the Largest Contentful Paint (LCP) if the browser doesn't know it needs to prioritize them.
**Action:** Always add `fetchPriority="high"` (React camelCase for the HTML `fetchpriority` attribute) to critical above-the-fold `<img>` elements to explicitly signal to the browser that these resources should be loaded first, improving the LCP metric.