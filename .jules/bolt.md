## 2026-09-01 - Prevent Memory Bloat in Drizzle Pagination with Correlated Subqueries
**Learning:** Using `LEFT JOIN` and `GROUP BY` to count related records (e.g., counting comments for posts, or reviews for readers) causes significant memory bloat and performance degradation during pagination due to the database returning a row for every joined record before grouping them.
**Action:** Replace the `LEFT JOIN` + `GROUP BY` pattern with a correlated subquery using `sql<number>'(select count(*)::int from child_table where parentId = ${parent_table.id})'` to significantly improve query performance and reduce memory usage in Drizzle ORM/PostgreSQL.

## 2026-09-22 - Image Loading Optimizations with fetchPriority and lazy loading
**Learning:** React applications often fail to prioritize the Largest Contentful Paint (LCP) image and frequently load off-screen images synchronously, delaying page load. In React 18+, `fetchPriority="high"` can be used declaratively on critical images.
**Action:** Add `fetchPriority="high"` to hero/above-the-fold images, and `loading="lazy"` to off-screen/below-the-fold images. Add `decoding="async"` to all images to prevent main-thread blocking during image decode.
