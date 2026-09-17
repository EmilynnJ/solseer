## 2026-09-01 - Prevent Memory Bloat in Drizzle Pagination with Correlated Subqueries
**Learning:** Using `LEFT JOIN` and `GROUP BY` to count related records (e.g., counting comments for posts, or reviews for readers) causes significant memory bloat and performance degradation during pagination due to the database returning a row for every joined record before grouping them.
**Action:** Replace the `LEFT JOIN` + `GROUP BY` pattern with a correlated subquery using `sql<number>'(select count(*)::int from child_table where parentId = ${parent_table.id})'` to significantly improve query performance and reduce memory usage in Drizzle ORM/PostgreSQL.

## 2026-09-08 - Avoid Lazy Loading Above-The-Fold Images
**Learning:** Adding `loading="lazy"` to above-the-fold images (like hero images or main profile pictures on a profile page) prevents the browser's preload scanner from discovering the image early, causing a severe degradation in Largest Contentful Paint (LCP). This is a major performance anti-pattern.
**Action:** Only apply `loading="lazy"` to images that are guaranteed to be below the fold or rendered within long lists (like the ReaderCard component in a list view).
