# Bolt's Journal - Critical Learnings

## 2026-08-18 - ReaderCard Memoization and Lazy Image Loading
**Learning:** In reader directory views where state updates (like filter dropdowns and search inputs) trigger parent re-renders, unmemoized list items force full virtual DOM diffing for every reader card even when reader prop references don't change. Furthermore, fetching and decoding high-res profile images for off-screen cards blocks network and main thread during initial page load.
**Action:** Wrap list cards (`ReaderCard`) in `React.memo` and add `loading="lazy"` with `decoding="async"` to profile images to prevent redundant DOM diffs and defer off-screen network requests.
