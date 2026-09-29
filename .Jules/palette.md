## 2026-09-29 - Modal Keyboard Accessibility and Focus Management
**Learning:** Modals inside the client app benefit from standard keyboard accessibility (Escape key dismissal) and initial focus capture on mount. Decoupling focus-on-mount into a separate `useEffect` with empty dependencies prevents focus-stealing on parent component re-renders.
**Action:** When creating modal components, bind a window `keydown` listener for Escape key dismissal and use a decoupled `useEffect` with `modalRef.current?.focus()` to capture initial focus safely.
