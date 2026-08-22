## 2026-08-22 - Memoization of Core List Card Components
**Learning:** List pages rendering multiple items (e.g. `ReadersPage` or `HomePage`) trigger full virtual DOM re-renders of all list child components on parent state changes (such as slider controls or search/filter updates). Wrapping display components like `ReaderCard` in `React.memo` avoids redundant re-renders of items whose props haven't changed.
**Action:** When working on React list items, apply `React.memo` to pure item components to optimize list filtering performance.
