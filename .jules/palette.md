## 2026-08-22 - Modal Focus Management and Keyboard Dismissal

**Learning:** Modals inside the client app require both Escape key dismissal and decoupled focus-on-mount logic (`useEffect` with `[]` dependencies) to prevent stealing focus from active input elements on parent component re-renders.
**Action:** When implementing modal dialogs, attach `tabIndex={-1}` to the dialog element, trigger focus once on mount in an empty dependency effect, and attach a window `keydown` listener for the Escape key.
