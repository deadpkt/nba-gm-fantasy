import { Navigate } from "react-router-dom";
import useAdminClaim from "../hooks/useAdminClaim";
import { RouteLoading } from "./brand/AppLoadingScreen";
import { resolveAdminRoute } from "../lib/adminAccess";
export default function AdminRoute({ children }) { const access = resolveAdminRoute(useAdminClaim()); if (access === "loading") return <RouteLoading />; return access === "allowed" ? children : <Navigate to="/" replace />; }
