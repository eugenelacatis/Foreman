import * as Sentry from "@sentry/react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0,
});

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
