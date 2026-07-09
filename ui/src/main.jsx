import React from "react";
import { createRoot } from "react-dom/client";

// Self-hosted fonts (bundled by Vite → fully offline, no CDN). Latin subsets.
import "@fontsource/newsreader/latin-400.css";
import "@fontsource/newsreader/latin-500.css";
import "@fontsource/newsreader/latin-600.css";
import "@fontsource/libre-franklin/latin-400.css";
import "@fontsource/libre-franklin/latin-500.css";
import "@fontsource/libre-franklin/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";

import "./theme.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(<App />);
