## 2026-08-24 - Modal Focus Management and Keyboard Dismissal
**Learning:** React Modal dialogs in this app require dedicated keyboard dismissal (`Escape` key) and container focus management (`tabIndex={-1}`) on mount to ensure keyboard navigation and screen-reader accessibility without stealing focus on parent re-renders.
**Action:** Always include an `Escape` key event listener in a clean effect and decouple focus-on-mount logic into an effect with empty dependencies when modifying modal components.
