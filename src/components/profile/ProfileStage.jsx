import SocialStats from "./SocialStats";
import "./profile.css";

function CameraIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8.4 5 10 3h4l1.6 2H19a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h3.4ZM12 8a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" /></svg>;
}

function joinedLabel(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return "";
  return `Joined ${new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(date)}`;
}

export default function ProfileStage({ profile, action, onChangeBanner, onChangePhoto, onOpenSocial }) {
  const name = profile?.displayName || "Full Court Player";
  const joined = joinedLabel(profile?.joinedAt);
  const bannerStyle = profile?.bannerURL ? { backgroundImage: `url("${profile.bannerURL}")` } : undefined;
  return <section className="profile-stage">
    <div className={`profile-stage__banner ${onChangeBanner ? "is-editable" : ""}`} style={bannerStyle}>
      {onChangeBanner && <button className="profile-media-action profile-media-action--banner" type="button" onClick={onChangeBanner} aria-label="Change profile banner"><CameraIcon /><span>Change Banner</span></button>}
    </div>
    <div className="profile-identity-plane">
      <div className="profile-avatar-wrap">
        <span className="profile-avatar">{name.slice(0, 1).toUpperCase()}{profile?.photoURL && <img src={profile.photoURL} alt={`${name} profile`} referrerPolicy="no-referrer" onError={(event) => event.currentTarget.remove()} />}</span>
        {onChangePhoto && <button className="profile-media-action profile-media-action--avatar" type="button" onClick={onChangePhoto} aria-label="Change profile photo"><CameraIcon /><span>Change Photo</span></button>}
      </div>
      <div className="profile-identity-main">
        <div className="profile-identity-copy">
          <h1>{name}</h1>
          <div className="profile-identity-meta"><span>General Manager</span>{joined && <><i aria-hidden="true" /><time>{joined}</time></>}</div>
        </div>
        <SocialStats profile={profile} onOpen={onOpenSocial} />
      </div>
      {action && <div className="profile-identity-action">{action}</div>}
    </div>
  </section>;
}

export function ProfileStageSkeleton() {
  return <div className="profile-page profile-page--loading" aria-label="Loading profile"><section className="profile-stage profile-stage--skeleton"><div className="profile-stage__banner" /><div className="profile-identity-plane"><span className="profile-avatar" /><div className="profile-identity-main"><div className="profile-identity-copy"><h1 /><p /></div><div className="social-stats" /></div><i className="profile-identity-action" /></div></section><div className="profile-editorial-skeleton"><i /><i /></div></div>;
}
