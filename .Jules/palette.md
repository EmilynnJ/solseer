## 2026-08-15 - Modal Keyboard Accessibility

**Learning:** Modal components across the client application lacked Escape key listener handlers for keyboard dismissal.
**Action:** Always ensure modal and overlay dialogs attach a global `keydown` event listener for the Escape key and properly clean up on unmount.
