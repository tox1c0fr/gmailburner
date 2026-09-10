const https = require('https');

const API_BASE = 'api.mail.tm';

function request(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const payload = data ? JSON.stringify(data) : null;
    const options = {
      hostname: API_BASE,
      port: 443,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'BurnerMailCLI/1.0.0',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode === 204) {
          return resolve(true);
        }
        let parsed;
        try {
          parsed = JSON.parse(responseBody);
        } catch (e) {
          parsed = responseBody;
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          const errMsg = parsed?.message || parsed?.['hydra:description'] || `HTTP ${res.statusCode}`;
          reject(new Error(errMsg));
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

function extractList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.['hydra:member'])) return data['hydra:member'];
  return [];
}

async function getAvailableDomains() {
  const data = await request('/domains');
  const domains = extractList(data);
  return domains.filter(d => d.isActive).map(d => d.domain);
}

function generateRandomString(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function createAccount(address, password) {
  return await request('/accounts', 'POST', { address, password });
}

async function getToken(address, password) {
  const res = await request('/token', 'POST', { address, password });
  return res.token;
}

async function createRandomAccount(preferredUsername = null) {
  const domains = await getAvailableDomains();
  if (domains.length === 0) {
    throw new Error('No active domains available from Mail service');
  }

  const domain = domains[0];
  const user = preferredUsername
    ? preferredUsername.toLowerCase().replace(/[^a-z0-9._-]/g, '')
    : `user_${generateRandomString(6)}`;
  const address = `${user}@${domain}`;
  const password = `P@ss_${generateRandomString(12)}!`;

  const account = await createAccount(address, password);
  const token = await getToken(address, password);

  return {
    id: account.id,
    address: account.address,
    password,
    token,
    createdAt: account.createdAt,
  };
}

async function getMessages(token, page = 1) {
  const data = await request(`/messages?page=${page}`, 'GET', null, token);
  return extractList(data);
}

async function getMessage(token, id) {
  return await request(`/messages/${id}`, 'GET', null, token);
}

async function deleteMessage(token, id) {
  return await request(`/messages/${id}`, 'DELETE', null, token);
}

async function getAccountMe(token) {
  return await request('/me', 'GET', null, token);
}

module.exports = {
  getAvailableDomains,
  createRandomAccount,
  createAccount,
  getToken,
  getMessages,
  getMessage,
  deleteMessage,
  getAccountMe,
};
