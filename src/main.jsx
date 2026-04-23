import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./theme/brandTheme.css";
import "rsuite/dist/rsuite.min.css";
import "./feedback/salt-dashboard-feedback.css";
import App from "./App.jsx";
import { BrandThemeProvider } from "./context/BrandThemeContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrandThemeProvider>
      <App />
    </BrandThemeProvider>
  </StrictMode>
);
