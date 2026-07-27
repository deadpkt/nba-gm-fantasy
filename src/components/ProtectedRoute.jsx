import { Navigate, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return <div className="route-loader">Loading your franchise...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export default ProtectedRoute;
