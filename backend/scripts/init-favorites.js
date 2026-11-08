require('../src/config/env');
const {store}=require('../src/models');
require('../src/services/favorites.service').ensureSchema()
  .then(()=>console.log('Favorites collection, validation and indexes ready.'))
  .catch(error=>{console.error('Favorites initialization:',error.message);process.exitCode=1;})
  .finally(()=>store.close());
