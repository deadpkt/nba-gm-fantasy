import { useEffect, useRef, useState } from "react";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import ImageCropEditor from "../components/ImageCropEditor";
import PageLayout from "../components/PageLayout";
import ProfileStage, { ProfileStageSkeleton } from "../components/profile/ProfileStage";
import ProfileEditorial from "../components/profile/ProfileEditorial";
import SocialListModal from "../components/profile/SocialListModal";
import useAuth from "../hooks/useAuth";
import usePublicProfile from "../hooks/usePublicProfile";
import useTeam from "../hooks/useTeam";
import useLeague from "../hooks/useLeague";
import useRecentProfileActivity from "../hooks/useRecentProfileActivity";
import { db } from "../lib/firebase";
import { publicProfileRef } from "../lib/publicProfiles";
import { hasPendingProfileChanges } from "../lib/profileMedia";
import { uploadBannerImage, uploadProfileImage } from "../lib/storage";
import { getUserFriendlyError } from "../lib/clientErrors";
import UiIcon from "../components/UiIcon";

function useImagePreview(file, savedUrl) {
  const [preview, setPreview] = useState(savedUrl || "");
  useEffect(() => {
    if (!file) { setPreview(savedUrl || ""); return undefined; }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file, savedUrl]);
  return preview;
}

function ProfilePage() {
  const { user } = useAuth();
  const { profile: privateProfile } = useTeam();
  const { activeLeague, teams } = useLeague();
  const { profile: publicProfile, loading } = usePublicProfile(user.uid);
  const [displayName, setDisplayName] = useState(privateProfile.displayName || user.displayName || "");
  const [profileImage, setProfileImage] = useState(null);
  const [bannerImage, setBannerImage] = useState(null);
  const [cropRequest, setCropRequest] = useState(null);
  const [openSocialList, setOpenSocialList] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const avatarInput = useRef(null);
  const bannerInput = useRef(null);
  const savedPhotoURL = publicProfile?.photoURL || privateProfile.photoURL || user.photoURL || "";
  const savedBannerURL = publicProfile?.bannerURL || privateProfile.bannerURL || "";
  const photoURL = useImagePreview(profileImage, savedPhotoURL);
  const bannerURL = useImagePreview(bannerImage, savedBannerURL);
  const normalizedName = displayName.trim();
  const savedName = publicProfile?.displayName || privateProfile.displayName || user.displayName || "";
  const hasChanges = hasPendingProfileChanges({ displayName, savedDisplayName: savedName, profileImage, bannerImage });
  const heroProfile = { ...publicProfile, uid: user.uid, displayName: normalizedName || "Full Court Player", photoURL, bannerURL };
  const activeTeam = teams.find((team) => team.ownerUid === user.uid || team.id === user.uid) || null;
  const recentActivity = useRecentProfileActivity(activeLeague?.id, user.uid, Boolean(activeLeague && activeTeam));

  useEffect(() => { if (publicProfile?.displayName) setDisplayName(publicProfile.displayName); }, [publicProfile?.displayName]);

  function selectImage(type, file) {
    if (!file) return;
    setError(""); setMessage("");
    if (!file.type?.startsWith("image/")) { setError("Choose a valid image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Images must be 5 MB or smaller."); return; }
    setCropRequest({ type, file });
  }

  function acceptCrop(blob) {
    if (cropRequest.type === "avatar") setProfileImage(blob);
    else setBannerImage(blob);
    setCropRequest(null);
    setEditing(true);
    setMessage("Crop ready. Save changes when the profile looks right.");
  }

  async function saveProfile() {
    if (!hasChanges || !normalizedName) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const [nextPhotoURL, nextBannerURL] = await Promise.all([
        profileImage ? uploadProfileImage(user.uid, profileImage) : savedPhotoURL,
        bannerImage ? uploadBannerImage(user.uid, bannerImage) : savedBannerURL,
      ]);
      const privateRef = doc(db, "users", user.uid);
      const projectionRef = publicProfileRef(user.uid);
      const projectionSnapshot = await getDoc(projectionRef);
      const now = serverTimestamp();
      const batch = writeBatch(db);
      batch.set(privateRef, { displayName: normalizedName, email: user.email || "", photoURL: nextPhotoURL, bannerURL: nextBannerURL, updatedAt: now }, { merge: true });
      batch.set(projectionRef, projectionSnapshot.exists() ? { displayName: normalizedName, photoURL: nextPhotoURL, bannerURL: nextBannerURL, updatedAt: now } : { uid: user.uid, displayName: normalizedName, photoURL: nextPhotoURL, bannerURL: nextBannerURL, joinedAt: now, followersCount: 0, followingCount: 0, updatedAt: now }, { merge: true });
      await batch.commit();
      await updateProfile(user, { displayName: normalizedName, photoURL: nextPhotoURL });
      setProfileImage(null); setBannerImage(null); setMessage("Profile changes saved.");
    } catch (nextError) { setError(getUserFriendlyError(nextError, "Could not save profile changes.")); }
    finally { setSaving(false); }
  }

  if (loading && !publicProfile) return <PageLayout><ProfileStageSkeleton /></PageLayout>;

  return <PageLayout>
    <div className="profile-page own-profile-page">
      <input ref={avatarInput} className="settings-file-input" type="file" accept="image/*" onChange={(event) => { selectImage("avatar", event.target.files?.[0]); event.target.value = ""; }} />
      <input ref={bannerInput} className="settings-file-input" type="file" accept="image/*" onChange={(event) => { selectImage("banner", event.target.files?.[0]); event.target.value = ""; }} />
      <ProfileStage profile={heroProfile} onOpenSocial={setOpenSocialList} onChangePhoto={() => avatarInput.current?.click()} onChangeBanner={() => bannerInput.current?.click()} action={<button className="button-secondary profile-action" type="button" aria-expanded={editing} onClick={() => setEditing(true)}><UiIcon name="pen" size={14} />Edit Profile</button>} />
      <ProfileEditorial profile={privateProfile} league={activeLeague} team={activeTeam} ownProfile activities={recentActivity.activities} />
    </div>
    {editing && <div className="profile-edit-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(false); }}><section className="profile-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-edit-title">
      <header><div><span>Profile details</span><h2 id="profile-edit-title">Edit Profile</h2></div><button type="button" aria-label="Close profile editor" onClick={() => setEditing(false)}>×</button></header>
      <label><span>Display name</span><input value={displayName} maxLength="60" onChange={(event) => { setDisplayName(event.target.value); setMessage(""); }} /></label>
      <p>Change your avatar or banner directly from the profile hero. Media previews remain private until saved.</p>
      {error && <p className="settings-save-message settings-save-message--error" role="alert">{error}</p>}
      {message && <p className="settings-save-message" role="status">{message}</p>}
      <footer><button className="button-secondary" type="button" onClick={() => setEditing(false)}>Cancel</button><button className="button-primary" type="button" disabled={!hasChanges || !normalizedName || saving} onClick={saveProfile}>{saving ? "Saving..." : "Save Changes"}</button></footer>
    </section></div>}
    {cropRequest && <ImageCropEditor file={cropRequest.file} type={cropRequest.type} onCancel={() => setCropRequest(null)} onConfirm={acceptCrop} />}
    {openSocialList && <SocialListModal uid={user.uid} type={openSocialList} counts={heroProfile} onClose={() => setOpenSocialList(null)} />}
  </PageLayout>;
}

export default ProfilePage;
