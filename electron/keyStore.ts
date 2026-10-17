import { app, safeStorage } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProviderId } from '../src/shared/types';

type StoredKey = {
  encryptedValue: string;
  encryptedAt: string;
  mode: 'safeStorage' | 'base64';
};

type KeyStoreFile = Partial<Record<ProviderId, StoredKey>>;

const STORE_FILE = 'provider-keys.json';

export class ProviderKeyStore {
  private cache: KeyStoreFile | null = null;

  async has(providerId: ProviderId): Promise<boolean> {
    const store = await this.readStore();
    return Boolean(store[providerId]?.encryptedValue);
  }

  async encryptedAt(providerId: ProviderId): Promise<string | undefined> {
    const store = await this.readStore();
    return store[providerId]?.encryptedAt;
  }

  async get(providerId: ProviderId): Promise<string | undefined> {
    const store = await this.readStore();
    const entry = store[providerId];
    if (!entry) {
      return undefined;
    }

    if (entry.mode === 'safeStorage' && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(entry.encryptedValue, 'base64'));
    }

    return Buffer.from(entry.encryptedValue, 'base64').toString('utf8');
  }

  async set(providerId: ProviderId, apiKey: string): Promise<void> {
    const store = await this.readStore();
    const trimmed = apiKey.trim();
    if (!trimmed) {
      delete store[providerId];
      await this.writeStore(store);
      return;
    }

    const canEncrypt = safeStorage.isEncryptionAvailable();
    const encryptedValue = canEncrypt
      ? safeStorage.encryptString(trimmed).toString('base64')
      : Buffer.from(trimmed, 'utf8').toString('base64');

    store[providerId] = {
      encryptedValue,
      encryptedAt: new Date().toISOString(),
      mode: canEncrypt ? 'safeStorage' : 'base64',
    };
    await this.writeStore(store);
  }

  async clear(providerId: ProviderId): Promise<void> {
    const store = await this.readStore();
    delete store[providerId];
    await this.writeStore(store);
  }

  private async readStore(): Promise<KeyStoreFile> {
    if (this.cache) {
      return this.cache;
    }

    try {
      const raw = await readFile(this.storePath(), 'utf8');
      this.cache = JSON.parse(raw) as KeyStoreFile;
      return this.cache;
    } catch {
      this.cache = {};
      return this.cache;
    }
  }

  private async writeStore(store: KeyStoreFile): Promise<void> {
    this.cache = store;
    await mkdir(path.dirname(this.storePath()), { recursive: true });
    await writeFile(this.storePath(), `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  }

  private storePath(): string {
    return path.join(app.getPath('userData'), STORE_FILE);
  }
}
