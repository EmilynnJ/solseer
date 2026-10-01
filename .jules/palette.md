# Palette's Journal - Critical UX/Accessibility Learnings

## 2026-10-01 - Decoupling Focus-on-Mount in Modal Dialogs
**Learning:** In reusable Modal dialog components, focus-on-mount logic should be placed in a dedicated `useEffect` with empty dependencies (`[]`). Decoupling it from handlers like `onClose` prevents focus from resetting to the dialog container whenever parent re-renders trigger state changes inside active form fields or textareas.
**Action:** Always separate mount-only focus initialization from handler-dependent event listeners (such as `Escape` key listeners) in interactive dialog components.
