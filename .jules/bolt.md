## 2026-09-01 - ReaderCard Memoization and Image Lazy Loading
**Learning:** Component grids like ReaderCard re-render every item when parent page filter state changes, unless memoized with React.memo. Profile image loads also benefit from native loading="lazy" and decoding="async".
**Action:** Always memoize list item components whose props remain structurally unchanged during filter/search state updates, and add lazy loading to off-screen avatar images.
