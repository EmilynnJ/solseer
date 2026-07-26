import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/alex-brush";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@neondatabase/neon-js/ui/css";
import "./styles.css";
import { App } from "./app";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
