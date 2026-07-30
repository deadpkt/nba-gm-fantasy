import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firebaseEnabled } from "./firebase";
import { storage } from "./firebaseStorage";

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

function validateImage(file) {
  if (!file) throw new Error("Choose an image before saving your profile.");
  if (!file.type?.startsWith("image/")) throw new Error("Profile images must be valid image files.");
  if (file.size > MAX_IMAGE_SIZE_BYTES) throw new Error("Profile images must be 5 MB or smaller.");
}

async function uploadUserImage(userId, file, type) {
  if (!firebaseEnabled || !storage) throw new Error("Firebase Storage is not configured.");
  if (!userId) throw new Error("You must be signed in to upload an image.");
  validateImage(file);

  const imageRef = ref(storage, `users/${userId}/${type}/image`);
  console.debug("[ProfileSettings] Image upload started", {
    type,
    path: imageRef.fullPath,
    name: file.name || `${type}-crop.jpg`,
    size: file.size,
    contentType: file.type,
  });
  await uploadBytes(imageRef, file, { contentType: file.type });
  const downloadURL = await getDownloadURL(imageRef);
  console.debug("[ProfileSettings] Image upload completed", {
    type,
    path: imageRef.fullPath,
    downloadURL,
  });
  return downloadURL;
}

export const uploadProfileImage = (userId, file) => uploadUserImage(userId, file, "profile");
export const uploadBannerImage = (userId, file) => uploadUserImage(userId, file, "banner");
