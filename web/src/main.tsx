import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import App from "./App.tsx";
import Deploy from "./Deploy.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname === "/deploy" ? <Deploy /> : <App />}
  </React.StrictMode>,
);
