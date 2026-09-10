# Palette's Journal

## 2026-09-10 - Modal Keyboard Dismissal & Icon Tooltips
**Learning:** Icon-only controls (such as modal close buttons, navigation toggles, and conversation refresh buttons) need both `aria-label` for screen readers and matching `title` attributes for native desktop hover tooltips. Furthermore, standard modal dialogs require `Escape` key event handling to satisfy WAI-ARIA keyboard accessibility guidelines.
**Action:** Always combine `aria-label` and `title` attributes on icon-only buttons and ensure dialog modals listen for `Escape` key events.
