import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { LeaguePhaseRoute } from "./components/LeagueRouteGuard";
import { LEAGUE_STATUS } from "./lib/leagueStatuses";
import ActivityPage from "./pages/ActivityPage";
import AchievementsPage from "./pages/AchievementsPage";
import AwardsPage from "./pages/AwardsPage";
import ContractsPage from "./pages/ContractsPage";
import DraftPage from "./pages/DraftPage";
import FreeAgencyPage from "./pages/FreeAgencyPage";
import GamesPage from "./pages/GamesPage";
import HomePage from "./pages/HomePage";
import LeagueLobbyPage from "./pages/LeagueLobbyPage";
import LeaguesPage from "./pages/LeaguesPage";
import LoginPage from "./pages/LoginPage";
import MyTeamPage from "./pages/MyTeamPage";
import NotFoundPage from "./pages/NotFoundPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import SignUpPage from "./pages/SignUpPage";
import StandingsPage from "./pages/StandingsPage";
import TradeCenterPage from "./pages/TradeCenterPage";
import "./App.css";

const protectedPage = (page) => <ProtectedRoute>{page}</ProtectedRoute>;
const leaguePhasePage = (page, statuses) =>
  protectedPage(<LeaguePhaseRoute statuses={statuses}>{page}</LeaguePhaseRoute>);

const TEAM_PHASES = [
  LEAGUE_STATUS.SEASON_READY,
  LEAGUE_STATUS.REGULAR_SEASON,
  LEAGUE_STATUS.PLAYOFFS,
  LEAGUE_STATUS.OFFSEASON,
];
const GAME_PHASES = [LEAGUE_STATUS.REGULAR_SEASON, LEAGUE_STATUS.PLAYOFFS];
const TRADE_PHASES = [LEAGUE_STATUS.REGULAR_SEASON];
const FUTURE_OFFSEASON_FEATURE_PHASES = [];
const FUTURE_SEASON_FEATURE_PHASES = [];
function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/" element={protectedPage(<HomePage />)} />
      <Route path="/my-team" element={leaguePhasePage(<MyTeamPage />, TEAM_PHASES)} />
      <Route path="/activity" element={leaguePhasePage(<ActivityPage />, FUTURE_SEASON_FEATURE_PHASES)} />
      <Route path="/achievements" element={leaguePhasePage(<AchievementsPage />, FUTURE_SEASON_FEATURE_PHASES)} />
      <Route path="/free-agency" element={leaguePhasePage(<FreeAgencyPage />, FUTURE_OFFSEASON_FEATURE_PHASES)} />
      <Route path="/contracts" element={leaguePhasePage(<ContractsPage />, FUTURE_OFFSEASON_FEATURE_PHASES)} />
      <Route path="/notifications" element={leaguePhasePage(<NotificationsPage />, FUTURE_SEASON_FEATURE_PHASES)} />
      <Route path="/awards" element={leaguePhasePage(<AwardsPage />, FUTURE_SEASON_FEATURE_PHASES)} />
      <Route path="/league" element={protectedPage(<LeaguesPage />)} />
      <Route path="/league/draft" element={leaguePhasePage(<DraftPage />, [LEAGUE_STATUS.DRAFTING])} />
      <Route
        path="/league/:leagueId"
        element={protectedPage(<LeagueLobbyPage />)}
      />
      <Route path="/games" element={leaguePhasePage(<GamesPage />, GAME_PHASES)} />
      <Route path="/standings" element={leaguePhasePage(<StandingsPage />, [LEAGUE_STATUS.REGULAR_SEASON])} />
      <Route path="/trade-center" element={leaguePhasePage(<TradeCenterPage />, TRADE_PHASES)} />
      <Route path="/settings" element={protectedPage(<ProfilePage />)} />
      <Route path="/draft" element={<Navigate to="/league/draft" replace />} />
      <Route path="/leagues" element={<Navigate to="/league" replace />} />
      <Route path="/profile" element={<Navigate to="/settings" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
export default App;
