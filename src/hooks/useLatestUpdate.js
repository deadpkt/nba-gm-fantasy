import { useEffect, useState } from "react";
import { isUpdateUnseen, loadLatestUpdateMeta, readSeenVersion } from "../lib/devLogs";
export default function useLatestUpdate() {
  const [state, setState] = useState({ meta: null, unseen: false });
  useEffect(() => { let active = true; loadLatestUpdateMeta().then((meta) => { if (active) setState({ meta, unseen: isUpdateUnseen(meta?.latestPublishedVersion, readSeenVersion()) }); }).catch(() => {}); return () => { active = false; }; }, []);
  return state;
}
