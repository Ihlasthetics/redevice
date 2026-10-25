import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import App from "./App.tsx";
import Admin from "./Admin.tsx";
import Deploy from "./Deploy.tsx";

const PasskeySpike =
  import.meta.env.DEV || import.meta.env.VITE_PASSKEY_TESTING === "true"
    ? React.lazy(() => import("./PasskeySpike.tsx"))
    : null;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {PasskeySpike && window.location.pathname === "/passkey-spike" ? (
      <Suspense fallback={<p>Loading passkey test…</p>}>
        <PasskeySpike />
      </Suspense>
    ) : window.location.pathname === "/deploy" ? (
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
