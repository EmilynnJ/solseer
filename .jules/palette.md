## 2026-09-24 - Modal Focus Management and Escape Key Dismissal
**Learning:** In React modals across the app, decoupled focus-on-mount logic with an empty dependency array ensures the modal receives focus upon opening without repeatedly stealing focus from active child controls when parent components re-render.
**Action:** Always decouple `modalRef.current?.focus()` into its own `useEffect` with `[]` dependencies when adding focus management to reusable dialog or modal overlays.
