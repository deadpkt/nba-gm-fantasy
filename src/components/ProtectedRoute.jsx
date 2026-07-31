import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import AppLoadingScreen from "./brand/AppLoadingScreen";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return <AppLoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: { pathname: location.pathname, search: location.search, hash: location.hash } }} />;
  return children;
}

export default ProtectedRoute;
