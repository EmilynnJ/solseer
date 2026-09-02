## 2026-08-23 - [React.memo in Filtered Lists]
**Learning:** Using `React.memo` on list components like `ReaderCard` is crucial when the parent component performs client-side filtering. Even if the array is newly generated (e.g., via `filter()`), object references within the array (the `reader` props) often remain identical, allowing `memo` to skip expensive re-renders across the entire list.
**Action:** Always consider `React.memo` for individual items rendered within a frequently updated list, especially when filtering or sorting large datasets locally on the frontend.
