## 2024-05-24 - React Grid Performance
**Learning:** Grid item components like `ReaderCard` that render in large lists and depend on unchanged object references can cause heavy re-renders when parent filter states change. Furthermore, lists of images without lazy loading block bandwidth on initial load.
**Action:** Wrap list item components in `React.memo()` and use `loading="lazy"` on their images to prevent unnecessary re-renders and defer off-screen image loading.
