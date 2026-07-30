import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { LeaguePhaseRoute } from "./components/LeagueRouteGuard";
import { LEAGUE_STATUS } from "./lib/leagueStatuses";
import "./App.css";

const ActivityPage = lazy(() => import("./pages/ActivityPage"));
const AchievementsPage = lazy(() => import("./pages/AchievementsPage"));
const AwardsPage = lazy(() => import("./pages/AwardsPage"));
const ContractsPage = lazy(() => import("./pages/ContractsPage"));
const DraftPage = lazy(() => import("./pages/DraftPage"));
const FreeAgencyPage = lazy(() => import("./pages/FreeAgencyPage"));
const GamesPage = lazy(() => import("./pages/GamesPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const LeagueLobbyPage = lazy(() => import("./pages/LeagueLobbyPage"));
const LeaguesPage = lazy(() => import("./pages/LeaguesPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const MyTeamPage = lazy(() => import("./pages/MyTeamPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const PlayoffsPage = lazy(() => import("./pages/PlayoffsPage"));
const SeasonHistoryPage = lazy(() => import("./pages/SeasonHistoryPage"));
const SignUpPage = lazy(() => import("./pages/SignUpPage"));
const StandingsPage = lazy(() => import("./pages/StandingsPage"));
const TradeCenterPage = lazy(() => import("./pages/TradeCenterPage"));

const protectedPage = (page) => <ProtectedRoute>{page}</ProtectedRoute>;
const leaguePhasePage = (page, statuses) =>
  protectedPage(<LeaguePhaseRoute statuses={statuses}>{page}</LeaguePhaseRoute>);

const TEAM_PHASES = [
  LEAGUE_STATUS.SEASON_READY,
  LEAGUE_STATUS.REGULAR_SEASON,
  LEAGUE_STATUS.PLAYOFFS,
  LEAGUE_STATUS.OFFSEASON,
];
const GAME_PHASES = [LEAGUE_STATUS.REGULAR_SEASON];
const TRADE_PHASES = [LEAGUE_STATUS.REGULAR_SEASON];
const CONTRACT_PHASES = [LEAGUE_STATUS.SEASON_READY, LEAGUE_STATUS.REGULAR_SEASON, LEAGUE_STATUS.PLAYOFFS, LEAGUE_STATUS.OFFSEASON];
const FUTURE_OFFSEASON_FEATURE_PHASES = [];
const FUTURE_SEASON_FEATURE_PHASES = [];
function App() {
  return (
    <Suspense fallback={<div className="route-loader">Loading court...</div>}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/" element={protectedPage(<HomePage />)} />
      <Route path="/my-team" element={leaguePhasePage(<MyTeamPage />, TEAM_PHASES)} />
      <Route path="/activity" element={leaguePhasePage(<ActivityPage />, FUTURE_SEASON_FEATURE_PHASES)} />
      <Route path="/achievements" element={leaguePhasePage(<AchievementsPage />, FUTURE_SEASON_FEATURE_PHASES)} />
      <Route path="/free-agency" element={leaguePhasePage(<FreeAgencyPage />, FUTURE_OFFSEASON_FEATURE_PHASES)} />
      <Route path="/contracts" element={leaguePhasePage(<ContractsPage />, CONTRACT_PHASES)} />
      <Route path="/notifications" element={leaguePhasePage(<NotificationsPage />, FUTURE_SEASON_FEATURE_PHASES)} />
      <Route path="/awards" element={leaguePhasePage(<AwardsPage />, FUTURE_SEASON_FEATURE_PHASES)} />
      <Route path="/league" element={protectedPage(<LeaguesPage />)} />
      <Route path="/league/draft" element={leaguePhasePage(<DraftPage />, [LEAGUE_STATUS.DRAFTING])} />
      <Route
        path="/league/:leagueId"
        element={protectedPage(<LeagueLobbyPage />)}
      />
      <Route path="/games" element={leaguePhasePage(<GamesPage />, GAME_PHASES)} />
      <Route path="/standings" element={leaguePhasePage(<StandingsPage />, [LEAGUE_STATUS.REGULAR_SEASON, LEAGUE_STATUS.PLAYOFFS])} />
      <Route path="/playoffs" element={leaguePhasePage(<PlayoffsPage />, [LEAGUE_STATUS.PLAYOFFS])} />
      <Route path="/league/history" element={leaguePhasePage(<SeasonHistoryPage />, [LEAGUE_STATUS.SEASON_READY, LEAGUE_STATUS.REGULAR_SEASON, LEAGUE_STATUS.PLAYOFFS, LEAGUE_STATUS.OFFSEASON])} />
      <Route path="/trade-center" element={leaguePhasePage(<TradeCenterPage />, TRADE_PHASES)} />
      <Route path="/settings" element={protectedPage(<ProfilePage />)} />
      <Route path="/draft" element={<Navigate to="/league/draft" replace />} />
      <Route path="/leagues" element={<Navigate to="/league" replace />} />
      <Route path="/profile" element={<Navigate to="/settings" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes></Suspense>
  );
}
export default App;
