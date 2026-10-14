import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "./styles/tokens.css";
import "./styles/app.css";
import "./styles/shell.css";
import "./styles/pages.css";
import "./styles/chat.css";
import "./styles/dashboard.css";
import { initMotion } from "./lib/motion";
import { App } from "./App";

initMotion();

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
