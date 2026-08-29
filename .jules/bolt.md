## 2024-08-29 - Optimize Drizzle Pagination with Correlated Subqueries
**Learning:** In Drizzle ORM/PostgreSQL, using `LEFT JOIN` combined with `GROUP BY` for counting or averaging related records (like reviews for a reader) causes the database to compute massive intermediate result sets before filtering/limiting. This leads to severe memory bloat and slow pagination.
**Action:** Replace `LEFT JOIN` + `GROUP BY` patterns with correlated subqueries using `sql(...)` for aggregate fields (e.g., `sql<number>\`(select coalesce(avg(rating), 0) from reviews where reader_id = users.id)::float\``).
