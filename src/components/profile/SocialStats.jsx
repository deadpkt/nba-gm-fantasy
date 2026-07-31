import { formatSocialCount } from "../../lib/socialUi";

function SocialStats({ profile, onOpen }) {
  const followers = profile?.followersCount || 0;
  const following = profile?.followingCount || 0;
  return <div className="social-stats" aria-label="Social connections">
    <button type="button" title={`${followers} followers`} aria-label={`${followers} followers. Open followers list.`} onClick={() => onOpen("followers")}><b aria-hidden="true">{formatSocialCount(followers)}</b><span>Followers</span></button>
    <button type="button" title={`${following} following`} aria-label={`${following} following. Open following list.`} onClick={() => onOpen("following")}><b aria-hidden="true">{formatSocialCount(following)}</b><span>Following</span></button>
  </div>;
}
export default SocialStats;
