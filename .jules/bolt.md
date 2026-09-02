## 2026-08-20 - Memoizing ReaderCard to reduce filter re-renders

**Learning:** On the Readers page, filtering by specialty, max rate, or connection type triggers parent state changes that re-rendered every unchanged ReaderCard component in the list.
**Action:** Wrap list item components like `ReaderCard` with `React.memo` and ensure image assets utilize `loading="lazy"` to minimize UI thread re-renders and network spikes during active browsing.
