import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import ProfileStage, { ProfileStageSkeleton } from "../components/profile/ProfileStage";
import ProfileEditorial from "../components/profile/ProfileEditorial";
import SocialListModal from "../components/profile/SocialListModal";
import useAuth from "../hooks/useAuth";
import usePublicProfile from "../hooks/usePublicProfile";
import useLeague from "../hooks/useLeague";
import useRecentProfileActivity from "../hooks/useRecentProfileActivity";
import { setFollowState, subscribeFollowState } from "../lib/publicProfiles";
import { getUserFriendlyError } from "../lib/clientErrors";

function PublicProfilePage() {
  const { uid } = useParams();
  const { user } = useAuth();
  const { profile, loading, error } = usePublicProfile(uid);
  const { activeLeague, teams } = useLeague();
  const sharedTeam = teams.find((team) => team.ownerUid === uid || team.id === uid) || null;
  const recentActivity = useRecentProfileActivity(activeLeague?.id, uid, Boolean(activeLeague && sharedTeam));
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [followError, setFollowError] = useState("");
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);
  const [openList, setOpenList] = useState(null);
  useEffect(() => {
    if (!uid) { setFollowLoading(false); return undefined; }
    setFollowLoading(true);
    return subscribeFollowState(user.uid, uid, (value) => { setFollowing(value); setFollowLoading(false); }, () => setFollowLoading(false));
  }, [uid, user.uid]);

  if (loading) return <PageLayout><ProfileStageSkeleton /></PageLayout>;
  if (error || !profile) return <PageLayout><section className="profile-unavailable"><h2>Profile unavailable.</h2><p>This profile may no longer exist.</p></section></PageLayout>;

  async function toggleFollow() {
    if (following && !confirmUnfollow) { setConfirmUnfollow(true); return; }
    setFollowBusy(true); setFollowError("");
    try { await setFollowState(profile.uid, !following); setConfirmUnfollow(false); }
    catch (nextError) { setFollowError(getUserFriendlyError(nextError, "Could not update this follow.")); }
    finally { setFollowBusy(false); }
  }

  return <PageLayout>
    <div className="profile-page public-profile-page">
      <ProfileStage profile={profile} onOpenSocial={setOpenList} action={<button className={`profile-action profile-follow-action ${following ? "button-secondary is-following" : "button-primary"} ${confirmUnfollow ? "is-confirming" : ""}`} type="button" disabled={followLoading || followBusy} onBlur={() => setConfirmUnfollow(false)} onClick={toggleFollow} aria-label={confirmUnfollow ? `Confirm unfollow ${profile.displayName}` : following ? `Following ${profile.displayName}. Click to unfollow.` : `Follow ${profile.displayName}`}>
          {followLoading ? "Loading..." : followBusy ? "Updating..." : confirmUnfollow ? "Unfollow?" : following ? "Following ✓" : "Follow"}
        </button>} />
      {followError && <p className="public-profile-error" role="alert">{followError}</p>}
      <ProfileEditorial profile={profile} league={sharedTeam ? activeLeague : null} team={sharedTeam} activities={recentActivity.activities} />
    </div>
    {openList && <SocialListModal uid={profile.uid} type={openList} counts={profile} onClose={() => setOpenList(null)} />}
  </PageLayout>;
}

export default PublicProfilePage;
