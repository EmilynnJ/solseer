## 2026-08-24 - React.memo on List Items

**Learning:** When a page has complex filtering states (like `ReadersPage`), filtering triggers re-renders of the entire list. Without `React.memo`, every list item component re-renders even if its props haven't changed.
**Action:** Use `React.memo` for list items, especially when the parent component has frequent state changes for filtering or sorting. Always ensure props passed to memoized components are stable references.
