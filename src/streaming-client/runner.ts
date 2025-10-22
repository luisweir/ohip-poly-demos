import poly from 'polyapi';

// uncomment to test locally
poly.ohip.streaming.sclient()
  .then(status => console.log(status))
  .catch(error => console.error('Error in sclient:', error.message));
  

