import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App";
import "./styles.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root 요소가 없습니다");

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
