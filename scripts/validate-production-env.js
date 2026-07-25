'use strict';

const requiredUrls = ['NEXT_PUBLIC_BASE_URL', 'NEXT_PUBLIC_FRONTEND_URL'];

for (const name of requiredUrls) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`Missing required production environment variable: ${name}`);
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`${name} must use HTTPS in production.`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${name} must be a plain public origin without credentials, query, or fragment.`);
  }
  if (url.pathname !== '/' || value.endsWith('/')) {
    throw new Error(`${name} must not include a path or trailing slash.`);
  }
}

console.log('Management production environment is valid.');
