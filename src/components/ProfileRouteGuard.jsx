import { Navigate, useLocation, useParams } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { PROFILE_ACCESS, resolveProfileRoute } from "../lib/profileAccess";
import AppLoadingScreen from "./brand/AppLoadingScreen";

function ProfileRouteGuard({ children }) {
  const { user, loading } = useAuth();
  const { uid } = useParams();
  const location = useLocation();
  const { access, redirectTo } = resolveProfileRoute({ authLoading: loading, userUid: user?.uid, targetUid: uid || null });
  if (access === PROFILE_ACCESS.LOADING) return <AppLoadingScreen />;
  if (access === PROFILE_ACCESS.LOGIN) return <Navigate to="/login" replace state={{ from: { pathname: location.pathname, search: location.search, hash: location.hash } }} />;
  if (access === PROFILE_ACCESS.OWN) return <Navigate to={redirectTo} replace />;
  return children;
}

export default ProfileRouteGuard;
