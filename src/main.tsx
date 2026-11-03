import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Progressive enhancement: only hide reveal blocks when JS is running.
document.documentElement.classList.add("js-reveal");

createRoot(document.getElementById("root")!).render(<App />);
