## 2026-08-27 - Modal Focus Management and Keyboard Dismissal
**Learning:** Modals inside the client app require Escape key dismissal via window event listeners and focus management on mount. Focus-on-mount logic must be decoupled into a separate effect with empty dependencies (`[]`) to avoid stealing focus from nested active elements during parent component re-renders.
**Action:** When creating or modifying modal components, separate the focus-on-mount effect (`[]`) from event listeners or parent props re-evaluations.
