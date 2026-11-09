const dns = require('dns');
const originalLookup = dns.lookup;
dns.lookup = function(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (hostname === 'api.vercel.com') {
    if (options && options.all) {
      return callback(null, [{ address: '76.76.21.9', family: 4 }]);
    }
    return callback(null, '76.76.21.9', 4);
  }
  return originalLookup(hostname, options, callback);
};
