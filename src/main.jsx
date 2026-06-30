import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { SeasonalEffects } from "./seasonal/SeasonalEffects.jsx";
import { SeasonalThemeProvider } from "./seasonal/useSeasonalTheme.js";
import "./styles.css";
import "./seasonal/seasonal.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SeasonalThemeProvider>
      <App />
      <SeasonalEffects />
    </SeasonalThemeProvider>
  </React.StrictMode>,
);
