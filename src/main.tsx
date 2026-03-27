  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { AuthProvider } from "./app/auth/AuthContext";
  import { I18nProvider } from "./app/i18n/I18nContext";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(
    <AuthProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </AuthProvider>,
  );
  
