import { useEffect, useRef, useState } from "react";
import { updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import PageLayout from "../components/PageLayout";
import useAuth from "../hooks/useAuth";
import useLeague from "../hooks/useLeague";
import useLeagueTeam from "../hooks/useLeagueTeam";
import useTeam from "../hooks/useTeam";
import { db } from "../lib/firebase";
import { uploadBannerImage, uploadProfileImage } from "../lib/storage";
import { getChemistry, getLineupOverall } from "../utils/team";

function useImagePreview(file, savedUrl) {
  const [preview, setPreview] = useState(savedUrl || "");

  useEffect(() => {
    if (!file) {
      setPreview(savedUrl || "");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, savedUrl]);

  return preview;
}

function ProfilePage() {
  const { user } = useAuth();
  const { profile } = useTeam();
  const { activeLeague } = useLeague();
  const { leagueTeam, roster, lineup, record } = useLeagueTeam();
  const profileInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [profileImage, setProfileImage] = useState(null);
  const [bannerImage, setBannerImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const photoURL = profile.photoURL || user.photoURL || "";
  const bannerURL = profile.bannerURL || "";
  const profilePreview = useImagePreview(profileImage, photoURL);
  const bannerPreview = useImagePreview(bannerImage, bannerURL);
  const resolvedDisplayName = displayName.trim() || "Full Court Player";
  const initial = (resolvedDisplayName || user.email || "F").slice(0, 1).toUpperCase();
  const overall = getLineupOverall(roster, lineup);
  const leagueName = activeLeague?.name || "No active league";
  const teamName = leagueTeam?.name || "No franchise selected";

  async function saveProfile(event) {
    event.preventDefault();
    console.log("[ProfileSettings] Save button clicked", {
      authUid: user.uid,
      hasProfileImage: Boolean(profileImage),
      hasBannerImage: Boolean(bannerImage),
    });
    setSaveError("");
    setSaveMessage("");
    setSaving(true);

    try {
      const [nextPhotoURL, nextBannerURL] = await Promise.all([
        profileImage ? uploadProfileImage(user.uid, profileImage) : photoURL,
        bannerImage ? uploadBannerImage(user.uid, bannerImage) : bannerURL,
      ]);
      const nextDisplayName = displayName.trim();

      console.log("[ProfileSettings] Firestore user update started", {
        path: `users/${user.uid}`,
      });
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: nextDisplayName,
          email: user.email || "",
          photoURL: nextPhotoURL,
          bannerURL: nextBannerURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      console.log("[ProfileSettings] Firestore user update completed", {
        path: `users/${user.uid}`,
      });
      await updateProfile(user, { displayName: nextDisplayName, photoURL: nextPhotoURL });

      setProfileImage(null);
      setBannerImage(null);
      setSaveMessage("Profile settings saved.");
    } catch (error) {
      console.error("[ProfileSettings] Save failed:", error);
      setSaveError(error.message || "Could not save profile settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageLayout>
      <section className="settings-hero">
        <div
          className="settings-hero__banner"
          aria-hidden="true"
          style={bannerPreview ? { backgroundImage: `linear-gradient(118deg, #071426d9 0%, #0714268f 52%, #20162ca8 100%), url("${bannerPreview}")` } : undefined}
        >
          <span>FULL COURT // PLAYER PROFILE</span><b>FC</b>
        </div>
        <div className="settings-hero__identity">
          <span className="settings-avatar">
            {profilePreview ? <img src={profilePreview} alt="" referrerPolicy="no-referrer" /> : initial}
          </span>
          <div><p className="section-label">PLAYER SETTINGS</p><h1>{resolvedDisplayName}</h1><p className="settings-hero__email">{user.email}</p></div>
          <span className="settings-hero__badge">LEAGUE MEMBER</span>
        </div>
      </section>

      <section className="settings-layout">
        <form className="settings-card account-settings" onSubmit={saveProfile}>
          <div className="settings-card__heading"><div><p className="section-label">ACCOUNT</p><h2>Profile settings</h2></div><span>SYNCED TO FIREBASE</span></div>
          <label className="settings-field"><span>Display name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Your display name" maxLength="60" /></label>
          <div className="settings-field"><span>Email address</span><div className="settings-readonly">{user.email}</div></div>
          <div className="settings-assets">
            <input ref={profileInputRef} className="settings-file-input" type="file" accept="image/*" onChange={(event) => setProfileImage(event.target.files?.[0] || null)} />
            <button type="button" className="asset-control" onClick={() => profileInputRef.current?.click()}><i aria-hidden="true">+</i><span><b>Profile picture</b><small>{profileImage ? profileImage.name : "Choose an image (max 5 MB)"}</small></span></button>
            <input ref={bannerInputRef} className="settings-file-input" type="file" accept="image/*" onChange={(event) => setBannerImage(event.target.files?.[0] || null)} />
            <button type="button" className="asset-control" onClick={() => bannerInputRef.current?.click()}><i aria-hidden="true">+</i><span><b>Banner image</b><small>{bannerImage ? bannerImage.name : "Choose an image (max 5 MB)"}</small></span></button>
          </div>
          <div className="settings-card__actions"><small>Profile and banner images are stored securely in Firebase Storage.</small><button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></div>
          {saveError && <p className="settings-save-message settings-save-message--error" role="alert">{saveError}</p>}
          {saveMessage && <p className="settings-save-message" role="status">{saveMessage}</p>}
        </form>

        <aside className="settings-card fantasy-settings">
          <div className="settings-card__heading"><div><p className="section-label">FANTASY IDENTITY</p><h2>Franchise snapshot</h2></div></div>
          <div className="fantasy-team-name"><span>TEAM NAME</span><b>{teamName}</b></div>
          <dl className="fantasy-details"><div><dt>League</dt><dd>{leagueName}</dd></div><div><dt>Season</dt><dd>{activeLeague?.season ? `Season ${activeLeague.season}` : "-"}</dd></div></dl>
          <div className="fantasy-metrics"><div><span>LINEUP OVR</span><b>{overall || "-"}</b></div><div><span>RECORD</span><b>{record.wins}<i>-{record.losses}</i></b></div><div><span>CHEMISTRY</span><b>{getChemistry(roster) || "-"}<i>%</i></b></div></div>
        </aside>
      </section>

      <section className="settings-roster">
        <div className="settings-card__heading"><div><p className="section-label">SAVED ROSTER</p><h2>Starting five <span>{roster.length}/5 players</span></h2></div><span className="settings-roster__label">FRANCHISE PREVIEW</span></div>
        {roster.length ? <div className="settings-roster__grid">{roster.map((player) => <article key={player.id} className="settings-roster__player"><img src={player.image} alt="" /><div><span>{player.position} / {player.team}</span><b>{player.name}</b></div><strong>{player.overall}<small>OVR</small></strong></article>)}</div> : <div className="settings-roster__empty">Your selected players will appear here once your franchise is built.</div>}
      </section>
    </PageLayout>
  );
}

export default ProfilePage;
