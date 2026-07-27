import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { LeagueProvider } from "./context/LeagueContext";
import { LeagueTeamProvider } from "./context/LeagueTeamContext";
import { PlayersProvider } from "./context/PlayersContext";
import { TeamProvider } from "./context/TeamContext";
import "./index.css";
import "./basketball.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PlayersProvider>
          <TeamProvider>
            <LeagueProvider>
              <LeagueTeamProvider>
                <App />
              </LeagueTeamProvider>
            </LeagueProvider>
          </TeamProvider>
        </PlayersProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
