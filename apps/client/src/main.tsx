import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/alex-brush";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/600.css";
import "@neondatabase/neon-js/ui/css";
import "./styles.css";
import "./reading-reentry.css";
import { App } from "./app";
import "./lib/posthog";

const root = document.getElementById("root");
if (!root) throw new Error("The SoulSeer root element is missing.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
