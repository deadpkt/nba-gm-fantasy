import { useEffect, useState } from "react";
import useAuth from "./useAuth";
import { hasAdminClaim } from "../lib/adminAccess";
export default function useAdminClaim() {
  const { user } = useAuth();
  const [state, setState] = useState({ admin: false, loading: true });
  useEffect(() => { let active = true; if (!user) { setState({ admin: false, loading: false }); return () => { active = false; }; } user.getIdTokenResult().then((token) => { if (active) setState({ admin: hasAdminClaim(token), loading: false }); }).catch(() => { if (active) setState({ admin: false, loading: false }); }); return () => { active = false; }; }, [user]);
  return state;
}
