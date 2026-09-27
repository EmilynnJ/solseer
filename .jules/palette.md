## 2026-09-27 - Modal Focus and Keyboard Dismissal
**Learning:** Modals inside the client app should implement keyboard dismissal via the Escape key and focus management on mount. Decoupling focus-on-mount into a separate effect with empty dependencies prevents stealing focus from active child elements on parent component re-renders.
**Action:** When creating or refining modal components, add global `keydown` listeners for `Escape` and decouple `focus()` effects to guarantee seamless keyboard and screen reader accessibility without interfering with user interaction.
