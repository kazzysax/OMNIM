const dns = require('dns');
const https = require('https');

const cache = new Map();
cache.set('api.vercel.com', '76.76.21.9');
cache.set('vercel.com', '76.76.21.21');

function resolveDoH(hostname) {
  return new Promise((resolve, reject) => {
    if (cache.has(hostname)) return resolve(cache.get(hostname));
    const req = https.get(`https://1.1.1.1/dns-query?name=${hostname}&type=A`, {
      headers: { 'Accept': 'application/dns-json' },
      timeout: 3000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.Answer && json.Answer.length > 0) {
            const aRecord = json.Answer.find(a => a.type === 1);
            if (aRecord) {
              cache.set(hostname, aRecord.data);
              return resolve(aRecord.data);
            }
          }
          reject(new Error('No A record found for ' + hostname));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('DoH timeout'));
    });
  });
}

const originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (cache.has(hostname)) {
    const ip = cache.get(hostname);
    if (options && options.all) {
      return callback(null, [{ address: ip, family: 4 }]);
    }
    return callback(null, ip, 4);
  }

  originalLookup(hostname, options, async (err, address, family) => {
    if (!err && address) {
      return callback(null, address, family);
    }
    // Fallback to DoH
    try {
      const ip = await resolveDoH(hostname);
      if (options && options.all) {
        return callback(null, [{ address: ip, family: 4 }]);
      }
      return callback(null, ip, 4);
    } catch (dohErr) {
      return callback(err || dohErr);
    }
  });
};
