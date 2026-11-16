const { syncAllGooglePlacesPhotos } = require('../src/services/google-maps-photo-sync.service');

syncAllGooglePlacesPhotos().then(result => {
  if (result.blocked) {
    console.error('Google Places photo rehosting is disabled pending rights and policy review.');
    process.exitCode = 1;
    return;
  }
  console.error('Google Places photo sync did not run.');
  process.exitCode = 1;
}).catch(() => {
  console.error('Google Places photo sync did not run.');
  process.exitCode = 1;
});
