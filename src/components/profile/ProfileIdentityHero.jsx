import SocialStats from "./SocialStats";
import "./profile.css";

function CameraIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M8.4 5 10 3h4l1.6 2H19a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h3.4ZM12 8a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Zm0 2a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
    </svg>
  );
}

function ProfileIdentityHero({
  profile,
  children,
  onChangeBanner,
  onChangePhoto,
  onOpenSocial,
}) {
  const name = profile?.displayName || "Full Court Player";
  const initial = name.slice(0, 1).toUpperCase();
  const bannerStyle = profile?.bannerURL
    ? {
        backgroundImage: `linear-gradient(180deg, transparent 48%, #06111eb8), url("${profile.bannerURL}")`,
      }
    : undefined;

  return (
    <section className="profile-hero">
      <div
        className={`profile-hero__banner ${onChangeBanner ? "is-editable" : ""}`}
        style={bannerStyle}
      >
        {onChangeBanner && (
          <button
            className="profile-hero__media-action profile-hero__media-action--banner"
            type="button"
            onClick={onChangeBanner}
            aria-label="Change profile banner"
          >
            <CameraIcon />
            <span>Change Banner</span>
          </button>
        )}
      </div>
      <div className="profile-hero__identity">
        <div
          className={`profile-hero__avatar-wrap ${onChangePhoto ? "is-editable" : ""}`}
        >
          <span className="profile-hero__avatar">
            {initial}
            {profile?.photoURL && (
              <img
                src={profile.photoURL}
                alt={`${name} profile`}
                referrerPolicy="no-referrer"
                onError={(event) => event.currentTarget.remove()}
              />
            )}
          </span>
          {onChangePhoto && (
            <button
              className="profile-hero__media-action profile-hero__media-action--avatar"
              type="button"
              onClick={onChangePhoto}
              aria-label="Change profile photo"
            >
              <CameraIcon />
              <span>Change Photo</span>
            </button>
          )}
        </div>
        <div className="profile-hero__copy">
          <h1>{name}</h1>
          <p>General Manager</p>
          <SocialStats profile={profile} onOpen={onOpenSocial} />
        </div>
        {children && <div className="profile-hero__action">{children}</div>}
      </div>
    </section>
  );
}

export function ProfileHeroSkeleton() {
  return (
    <div
      className="profile-page profile-page--loading"
      aria-label="Loading profile"
    >
      <section className="profile-hero profile-hero--skeleton">
        <div className="profile-hero__banner" />
        <div className="profile-hero__identity">
          <span className="profile-hero__avatar" />
          <div className="profile-hero__copy">
            <i />
            <b />
            <em />
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProfileIdentityHero;
