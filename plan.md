1. Modify `apps/client/src/components/reader-card.tsx` to add `loading="lazy"` and `decoding="async"` to the profile image, which reduces initial network requests and memory usage for images below the fold. Also, wrap the `ReaderCard` component in `React.memo` to prevent unnecessary re-renders when filtering readers on the `ReadersPage`.
2. Complete pre commit steps to ensure proper testing, verification, review, and reflection are done.
3. Submit the change as a PR.
