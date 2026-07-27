import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import DraftPage from "./pages/DraftPage";
import GamesPage from "./pages/GamesPage";
import HomePage from "./pages/HomePage";
import LeagueLobbyPage from "./pages/LeagueLobbyPage";
import LeaguesPage from "./pages/LeaguesPage";
import LiveMatchPage from "./pages/LiveMatchPage";
import LoginPage from "./pages/LoginPage";
import MyTeamPage from "./pages/MyTeamPage";
import MatchRoomPage from "./pages/MatchRoomPage";
import NotFoundPage from "./pages/NotFoundPage";
import OnlineMatchPage from "./pages/OnlineMatchPage";
import ProfilePage from "./pages/ProfilePage";
import SignUpPage from "./pages/SignUpPage";
import SimulationPage from "./pages/SimulationPage";
import "./App.css";

const protectedPage = (page) => <ProtectedRoute>{page}</ProtectedRoute>;
function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/" element={protectedPage(<HomePage />)} />
      <Route path="/my-team" element={protectedPage(<MyTeamPage />)} />
      <Route path="/league" element={protectedPage(<LeaguesPage />)} />
      <Route path="/league/draft" element={protectedPage(<DraftPage />)} />
      <Route
        path="/league/:leagueId"
        element={protectedPage(<LeagueLobbyPage />)}
      />
      <Route path="/games" element={protectedPage(<GamesPage />)} />
      <Route
        path="/games/exhibition"
        element={protectedPage(<SimulationPage />)}
      />
      <Route
        path="/games/online"
        element={protectedPage(<OnlineMatchPage />)}
      />
      <Route path="/settings" element={protectedPage(<ProfilePage />)} />
      <Route path="/draft" element={<Navigate to="/league/draft" replace />} />
      <Route
        path="/simulation"
        element={<Navigate to="/games/exhibition" replace />}
      />
      <Route path="/online" element={<Navigate to="/games/online" replace />} />
      <Route path="/leagues" element={<Navigate to="/league" replace />} />
      <Route
        path="/match/:matchId"
        element={protectedPage(<MatchRoomPage />)}
      />
      <Route
        path="/match/:matchId/live"
        element={protectedPage(<LiveMatchPage />)}
      />
      <Route path="/profile" element={<Navigate to="/settings" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
export default App;
