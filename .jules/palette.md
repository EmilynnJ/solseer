## 2025-05-18 - Modal Keyboard Dismissal and Focus Management

**Learning:** Modals using `role="dialog"` require both an Escape key listener on `window` and decoupled initial focus on mount to satisfy standard modal accessibility keyboard patterns without stealing focus on parent re-renders.
**Action:** Decouple focus-on-mount into a `useEffect` with an empty dependency array `[]` and bind `keydown` listeners for `"Escape"` on `window`.
