# Palette's Journal

## 2026-08-13 - Modal Keyboard Accessibility
**Learning:** Standard modal dialogs require proper keyboard accessibility. Specifically, users expect to be able to dismiss any active modal dialog using the `Escape` key, and assistive technologies benefit from the dialog container being focused when it mounts to provide the correct screen reader context.
**Action:** Implement `Escape` key dismissals and focus management (focus on mount) in the shared `Modal` component in `apps/client/src/components/ui.tsx` to instantly improve keyboard-friendliness across all platform modals.
