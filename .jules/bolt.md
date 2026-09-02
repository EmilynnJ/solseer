## 2026-08-18 - Reader Card Memoization and Image Optimization
**Learning:** In a list of cards like `ReaderCard` used heavily across the site (e.g. `ReadersPage` and `HomePage`), wrapping them in `React.memo` coupled with native browser attributes (`loading="lazy"` and `decoding="async"`) for below-the-fold images is a safe and high-impact optimization to avoid unnecessary re-renders when filtering arrays.
**Action:** Always check heavily rendered list items for `React.memo` potential and lazy-load their images if they are likely to appear below the fold.
