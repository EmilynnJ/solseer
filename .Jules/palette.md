## 2026-08-26 - Decoupled focus-on-mount in shared Modal component
**Learning:** In shared Modal dialogs, focus-on-mount logic must be decoupled from event listeners (like Escape key dismissal) to avoid stealing focus from active child form inputs on parent re-renders.
**Action:** Place focus-on-mount in a separate `useEffect` with empty dependencies (`[]`), while keeping event listeners in their own effect with callback dependencies.
