# Palette's Journal

## 2026-08-29 - Modal Keyboard Accessibility & Focus Handling
**Learning:** Modals in the app lacked keyboard dismissal via the Escape key and did not auto-focus on mount. Adding an `useEffect` listener for `Escape` keypresses improves modal accessibility.
**Action:** Enhance `Modal` in `apps/client/src/components/ui.tsx` to handle Escape key dismissal and maintain focus control.
