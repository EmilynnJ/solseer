## 2026-09-20 - Image Loading Priorities
**Learning:** Adding fetchPriority="high" to LCP (Largest Contentful Paint) images and loading="lazy" to below-the-fold list images are standard React performance improvements. However, .wrangler build artifacts must not be committed when running local dev servers to verify frontend changes.
**Action:** Always ensure .wrangler/ is in .gitignore before committing when local wrangler dev servers have been spun up.
