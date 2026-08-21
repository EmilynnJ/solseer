## 2024-05-20 - React component rendering with useApiData hooks
**Learning:** `useApiData` combined with `useMemo` for filtering causes massive re-rendering of large lists (like `ReaderCard`s) when filter state changes, even if the individual items haven't changed.
**Action:** When mapping over filtered arrays to render complex components, always wrap the child component in `React.memo` and evaluate if `loading="lazy"` is appropriate for offscreen media.
