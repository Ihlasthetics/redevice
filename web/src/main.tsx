import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import App from "./App.tsx";
import Admin from "./Admin.tsx";
import Deploy from "./Deploy.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname === "/deploy" ? (
      <Deploy />
    ) : window.location.pathname === "/admin" ? (
      <Admin />
    ) : (
      <App
        view={
          window.location.pathname === "/register"
            ? "register"
            : window.location.pathname === "/repairer"
              ? "repairer"
              : "auto"
        }
      />
    )}
  </React.StrictMode>,
);
