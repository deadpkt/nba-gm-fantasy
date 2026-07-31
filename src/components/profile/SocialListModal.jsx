import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { getFollowState, loadSocialPage, setFollowState } from "../../lib/publicProfiles";
import { mergeSocialProfiles } from "../../lib/socialProfile";
import { filterLoadedSocialProfiles, followActionLabel, formatSocialCount, normalizeSocialTab, shouldShowFollowAction, SOCIAL_TABS, socialEmptyMessage } from "../../lib/socialUi";
import { getUserFriendlyError } from "../../lib/clientErrors";

function SocialUserRow({ profile, viewerUid, onNavigate }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(profile.uid !== viewerUid);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);
  const isSelf = !shouldShowFollowAction(viewerUid, profile.uid);

  useEffect(() => {
    if (isSelf) { setLoading(false); return undefined; }
    let active = true;
    void getFollowState(viewerUid, profile.uid).then((value) => { if (active) setFollowing(value); }).catch(() => { if (active) setActionError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isSelf, profile.uid, viewerUid]);

  async function toggleFollow() {
    setBusy(true); setActionError(false);
    try { await setFollowState(profile.uid, !following); setFollowing((value) => !value); }
    catch { setActionError(true); }
    finally { setBusy(false); }
  }

  const initial = profile.displayName.slice(0, 1).toUpperCase();
  return <article className="social-user-row">
    <Link className="social-user-row__identity" to={`/profile/${profile.uid}`} onClick={onNavigate}>
      <span>{initial}{profile.photoURL && <img src={profile.photoURL} alt="" loading="lazy" onError={(event) => event.currentTarget.remove()} />}</span>
      <div><b>{profile.displayName}</b></div>
    </Link>
    {!isSelf && <button className={following ? "is-following" : ""} type="button" disabled={loading || busy} title={actionError ? "Could not update. Try again." : undefined} aria-label={`${following ? "Unfollow" : "Follow"} ${profile.displayName}`} onClick={toggleFollow}>{actionError ? "Retry" : followActionLabel({ following, pending: loading || busy })}</button>}
  </article>;
}

function SocialListModal({ uid, type: initialTab, counts = {}, onClose }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(() => normalizeSocialTab(initialTab));
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const visibleRows = useMemo(() => filterLoadedSocialProfiles(rows, search), [rows, search]);

  async function loadPage(reset = false) {
    const id = ++requestId.current;
    if (reset) setLoading(true); else setLoadingMore(true);
    setError("");
    try {
      const page = await loadSocialPage({ uid, type: activeTab, cursor: reset ? null : cursor });
      if (id !== requestId.current) return;
      setRows((current) => reset ? page.profiles : mergeSocialProfiles(current, page.profiles));
      setCursor(page.cursor); setHasMore(page.hasMore);
    } catch (nextError) { if (id === requestId.current) setError(getUserFriendlyError(nextError, "This list is unavailable.")); }
    finally { if (id === requestId.current) { setLoading(false); setLoadingMore(false); } }
  }

  useEffect(() => {
    setRows([]); setCursor(null); setHasMore(false); setSearch("");
    void loadPage(true);
  }, [activeTab, uid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleKey = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return <div className="social-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="social-modal" role="dialog" aria-modal="true" aria-labelledby="social-modal-title">
      <header><div><span>SOCIAL</span><h2 id="social-modal-title">Connections</h2></div><button type="button" onClick={onClose} aria-label="Close social connections">×</button></header>
      <div className="social-modal__tabs" role="tablist" aria-label="Social lists">
        {SOCIAL_TABS.map((tab) => <button role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? "is-active" : ""} type="button" onClick={() => setActiveTab(tab)} key={tab}><span>{tab}</span><b>{formatSocialCount(counts[`${tab}Count`] || 0)}</b></button>)}
      </div>
      <label className="social-modal__search"><span aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" aria-label="Search loaded people" /></label>
      <div className="social-modal__list" role="tabpanel">
        {visibleRows.map((profile) => <SocialUserRow profile={profile} viewerUid={user.uid} onNavigate={onClose} key={profile.uid} />)}
        {loading && Array.from({ length: 4 }, (_, index) => <div className="social-user-skeleton" aria-hidden="true" key={index}><i /><span /><b /></div>)}
      </div>
      {!loading && !visibleRows.length && !error && <p className="social-modal__empty">{search ? "No loaded people match that search." : socialEmptyMessage(activeTab)}</p>}
      {error && <p className="social-modal__error" role="alert">{error}</p>}
      {hasMore && !loading && <button className="social-modal__load button-secondary" type="button" disabled={loadingMore} onClick={() => loadPage(false)}>{loadingMore ? "Loading..." : "Load More"}</button>}
    </section>
  </div>;
}
export default SocialListModal;
