## 2026-08-18 - Standardize Modal Dialog Keyboard Dismissal (Escape Key)
**Learning:** Shared modal overlay dialogs require an explicit `Escape` key listener attached to window events during mount to ensure full keyboard navigation compliance (WAI-ARIA modal design pattern) across client features.
**Action:** Always include a `useEffect` hook with an `Escape` key event listener and cleanup function when implementing or updating modal components.
