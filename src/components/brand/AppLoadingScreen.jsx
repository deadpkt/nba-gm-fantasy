import { useEffect, useState } from "react";
import FullCourtLogo from "./FullCourtLogo";
import "./brand.css";

export function RouteLoading() {
  return <div className="route-loading" role="status"><i /><span>Loading...</span></div>;
}

function AppLoadingScreen({ delay = 180 }) {
  const [visible, setVisible] = useState(delay <= 0);
  useEffect(() => {
    if (delay <= 0) return undefined;
    const timer = window.setTimeout(() => setVisible(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay]);
  if (!visible) return null;

  return <div className="app-loading" role="status" aria-live="polite">
    <div className="app-loading__play" aria-hidden="true">
      <FullCourtLogo size={44} className="app-loading__ball" />
      <svg className="app-loading__hoop" viewBox="0 0 96 70" fill="none">
        <path d="M14 22h68" stroke="#e32842" strokeWidth="5" strokeLinecap="round" />
        <path d="M23 25 31 62M73 25 65 62M31 62h34M35 26l4 36M61 26l-4 36M47 26v36" stroke="#8ba0b6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
    <div className="app-loading__brand"><FullCourtLogo size={28} /><b>FULL COURT</b></div>
    <span>Loading...</span>
  </div>;
}

export default AppLoadingScreen;
