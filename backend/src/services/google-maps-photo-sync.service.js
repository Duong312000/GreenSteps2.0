const PHOTO_SYNC_ENABLED = false;

function blockedResult() {
  return {
    success: false,
    blocked: true,
    code: 'GOOGLE_PHOTO_REHOSTING_DISABLED'
  };
}

async function syncServicePhotoFromGoogle() {
  return blockedResult();
}

async function syncAllGooglePlacesPhotos() {
  return { ...blockedResult(), results: [] };
}

module.exports = {
  PHOTO_SYNC_ENABLED,
  syncServicePhotoFromGoogle,
  syncAllGooglePlacesPhotos
};
