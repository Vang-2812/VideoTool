import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createCredentialPathStore,
  readServiceAccount,
  validateServiceAccount,
  createRestAccessToken,
  redactGoogleError
} from '../electron/tts/googleCredentials.js';

test('stores only the credential path', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tts-creds-'));
  const settingsPath = join(dir, 'Config', 'tts-settings.json');
  const store = createCredentialPathStore({ settingsPath });
  await store.save('C:/keys/service-account.json');
  assert.deepEqual(JSON.parse(await readFile(settingsPath, 'utf8')), {
    googleCredentialsPath: 'C:/keys/service-account.json'
  });
  assert.equal(await store.load(), 'C:/keys/service-account.json');
  await store.clear();
  assert.equal(await store.load(), '');
});

test('accepts and validates a service-account file without returning its key', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tts-creds-'));
  const file = join(dir, 'service.json');
  await writeFile(file, JSON.stringify({
    type: 'service_account',
    project_id: 'project-one',
    client_email: 'voice@project-one.iam.gserviceaccount.com',
    private_key: 'SECRET'
  }));

  const value = await readServiceAccount(file);
  assert.equal(value.project_id, 'project-one');

  let closed = false;
  const result = await validateServiceAccount(file, {
    clientFactory: () => ({
      listVoices: async () => [{ voices: [] }],
      close: async () => { closed = true; }
    })
  });
  assert.deepEqual(result, { status: 'valid', path: file });
  assert.equal(closed, true);
  assert.equal('credentials' in result, false);
});

test('rejects JSON that is not a service account', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tts-creds-'));
  const file = join(dir, 'oauth.json');
  await writeFile(file, JSON.stringify({ type: 'authorized_user' }));
  await assert.rejects(() => readServiceAccount(file), /service-account/i);
});

test('creates REST access tokens from OAuth and service-account payloads', async () => {
  class FakeOAuthClient {
    setCredentials(value) { this.credentials = value; }
    async getAccessToken() { return { token: `oauth:${this.credentials.refresh_token}` }; }
  }
  class FakeGoogleAuth {
    constructor(options) { this.options = options; }
    async getClient() {
      return { getAccessToken: async () => ({ token: `service:${this.options.credentials.project_id}` }) };
    }
  }

  assert.equal(await createRestAccessToken(JSON.stringify({
    clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh'
  }), { OAuth2ClientClass: FakeOAuthClient, GoogleAuthClass: FakeGoogleAuth }), 'oauth:refresh');

  assert.equal(await createRestAccessToken(JSON.stringify({
    type: 'service_account', project_id: 'project-one', client_email: 'a', private_key: 'key'
  }), { OAuth2ClientClass: FakeOAuthClient, GoogleAuthClass: FakeGoogleAuth }), 'service:project-one');
});

test('redacts tokens and PEM private keys from errors', () => {
  const message = redactGoogleError(new Error(
    'token=TOKEN_VALUE private_key=SECRET -----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----'
  ));
  assert.equal(message.includes('TOKEN_VALUE'), false);
  assert.equal(message.includes('SECRET'), false);
  assert.equal(message.includes('ABC'), false);
  assert.match(message, /REDACTED/);
});
