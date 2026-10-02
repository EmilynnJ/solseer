## 2026-10-02 - Decouple Modal Focus Management On Mount
**Learning:** In React modal dialogs, focus-on-mount logic must be decoupled from parent component re-renders into a dedicated effect with an empty dependency array (`useEffect(() => { ... }, [])`).
**Action:** Always separate modal focus initialization from event listeners or state dependencies to prevent stealing focus from active inputs inside modal forms when parent or form state updates.
