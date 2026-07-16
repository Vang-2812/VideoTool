import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleAuth, OAuth2Client } from 'google-auth-library';

const SERVICE_ACCOUNT_FIELDS = [
  'type',
  'project_id',
  'client_email',
  'private_key'
];

export function createCredentialPathStore({ settingsPath, fsImpl = fs }) {
  return {
    async load() {
      try {
        const value = JSON.parse(await fsImpl.readFile(settingsPath, 'utf8'));
        return typeof value.googleCredentialsPath === 'string'
          ? value.googleCredentialsPath
          : '';
      } catch {
        return '';
      }
    },
    async save(googleCredentialsPath) {
      await fsImpl.mkdir(path.dirname(settingsPath), { recursive: true });
      await fsImpl.writeFile(
        settingsPath,
        JSON.stringify({ googleCredentialsPath }, null, 2),
        'utf8'
      );
    },
    async clear() {
      await fsImpl.unlink(settingsPath).catch(() => {});
    }
  };
}

export async function readServiceAccount(filePath, fsImpl = fs) {
  const value = JSON.parse(await fsImpl.readFile(filePath, 'utf8'));
  const missingField = SERVICE_ACCOUNT_FIELDS.find((field) => !value[field]);
  if (value.type !== 'service_account' || missingField) {
    throw new Error('Selected JSON is not a Google service-account credential.');
  }
  return value;
}

export async function validateServiceAccount(filePath, { clientFactory }) {
  const credentials = await readServiceAccount(filePath);
  const client = clientFactory(credentials);
  try {
    await client.listVoices({ languageCode: 'en-US' });
    return { status: 'valid', path: filePath };
  } finally {
    await client.close?.();
  }
}

export async function createRestAccessToken(serializedAuth, dependencies = {}) {
  const OAuth2ClientClass = dependencies.OAuth2ClientClass ?? OAuth2Client;
  const GoogleAuthClass = dependencies.GoogleAuthClass ?? GoogleAuth;
  const credentials = JSON.parse(serializedAuth);

  if (
    credentials.clientId
    && credentials.clientSecret
    && credentials.refreshToken
  ) {
    const client = new OAuth2ClientClass(
      credentials.clientId,
      credentials.clientSecret
    );
    client.setCredentials({ refresh_token: credentials.refreshToken });
    const response = await client.getAccessToken();
    const token = typeof response === 'string' ? response : response?.token;
    if (!token) throw new Error('Google OAuth did not return an access token.');
    return token;
  }

  const auth = new GoogleAuthClass({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  const client = await auth.getClient();
  const response = await client.getAccessToken();
  const token = typeof response === 'string' ? response : response?.token;
  if (!token) throw new Error('Google service account did not return an access token.');
  return token;
}

export function redactGoogleError(error) {
  return String(error?.message ?? error)
    .replace(
      /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/gi,
      '[REDACTED PRIVATE KEY]'
    )
    .replace(
      /(private_key\s*[=:]\s*)(?:"(?:\\.|[^"])*"|[^\s,}]+)/gi,
      '$1[REDACTED]'
    )
    .replace(
      /\b(access_?token|refresh_?token|token)\s*[=:]\s*[^\s,}]+/gi,
      '$1=[REDACTED]'
    );
}
