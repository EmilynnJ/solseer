## 2026-09-01 - Prevent Memory Bloat in Drizzle Pagination with Correlated Subqueries
**Learning:** Using `LEFT JOIN` and `GROUP BY` to count related records (e.g., counting comments for posts, or reviews for readers) causes significant memory bloat and performance degradation during pagination due to the database returning a row for every joined record before grouping them.
**Action:** Replace the `LEFT JOIN` + `GROUP BY` pattern with a correlated subquery using `sql<number>'(select count(*)::int from child_table where parentId = ${parent_table.id})'` to significantly improve query performance and reduce memory usage in Drizzle ORM/PostgreSQL.
## 2026-09-06 - Pre-calculating array mappings for find

**Learning:** When performing string replacements/regex manipulations inside of an Array `.find` loop, doing `.map` over the array to precalculate the result beforehand can provide a significant performance improvement (e.g. from 20s for 1000 items repeated 10k times to 6s) because finding a value in a pre-calculated mapping is much faster.

**Action:** Look for Array `.find`, `.filter`, or `.reduce` calls and ensure they don't repeatedly perform expensive operations that can be pre-calculated.
