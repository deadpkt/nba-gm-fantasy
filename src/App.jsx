import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import ProfileRouteGuard from "./components/ProfileRouteGuard";
import { LeaguePhaseRoute } from "./components/LeagueRouteGuard";
import { LEAGUE_STATUS } from "./lib/leagueStatuses";
import { RouteLoading } from "./components/brand/AppLoadingScreen";
import AdminRoute from "./components/AdminRoute";
import "./App.css";
import "./typography.css";

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
const PublicProfilePage = lazy(() => import("./pages/PublicProfilePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const PlayoffsPage = lazy(() => import("./pages/PlayoffsPage"));
const SeasonHistoryPage = lazy(() => import("./pages/SeasonHistoryPage"));
const SignUpPage = lazy(() => import("./pages/SignUpPage"));
const StandingsPage = lazy(() => import("./pages/StandingsPage"));
const TradeCenterPage = lazy(() => import("./pages/TradeCenterPage"));
const UpdatesPage = lazy(() => import("./pages/UpdatesPage"));
const AdminDevLogPage = lazy(() => import("./pages/AdminDevLogPage"));
const AdminRatingsPreviewPage = lazy(() => import("./pages/AdminRatingsPreviewPage"));

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
const FREE_AGENCY_PHASES = [LEAGUE_STATUS.OFFSEASON];
const FUTURE_SEASON_FEATURE_PHASES = [];
function App() {
  return (
    <Suspense fallback={<RouteLoading />}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/updates" element={<UpdatesPage />} />
      <Route path="/" element={protectedPage(<HomePage />)} />
      <Route path="/my-team" element={leaguePhasePage(<MyTeamPage />, TEAM_PHASES)} />
      <Route path="/activity" element={leaguePhasePage(<ActivityPage />, FUTURE_SEASON_FEATURE_PHASES)} />
      <Route path="/achievements" element={leaguePhasePage(<AchievementsPage />, FUTURE_SEASON_FEATURE_PHASES)} />
      <Route path="/free-agency" element={leaguePhasePage(<FreeAgencyPage />, FREE_AGENCY_PHASES)} />
      <Route path="/contracts" element={leaguePhasePage(<ContractsPage />, CONTRACT_PHASES)} />
      <Route path="/notifications" element={protectedPage(<NotificationsPage />)} />
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
      <Route path="/league/:leagueId/history" element={protectedPage(<SeasonHistoryPage />)} />
      <Route path="/trade-center" element={leaguePhasePage(<TradeCenterPage />, TRADE_PHASES)} />
      <Route path="/profile" element={<ProfileRouteGuard><ProfilePage /></ProfileRouteGuard>} />
      <Route path="/profile/:uid" element={<ProfileRouteGuard><PublicProfilePage /></ProfileRouteGuard>} />
      <Route path="/settings" element={protectedPage(<SettingsPage />)} />
      <Route path="/admin/dev-log" element={protectedPage(<AdminRoute><AdminDevLogPage /></AdminRoute>)} />
      <Route path="/admin/nba-data/ratings-preview" element={protectedPage(<AdminRoute><AdminRatingsPreviewPage /></AdminRoute>)} />
      <Route path="/draft" element={<Navigate to="/league/draft" replace />} />
      <Route path="/leagues" element={<Navigate to="/league" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes></Suspense>
  );
}
export default App;
