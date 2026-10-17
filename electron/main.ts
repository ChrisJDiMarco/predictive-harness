import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { HarnessRequest, ProviderId, ProviderStatus } from '../src/shared/types';
import { runHarness } from './harness';
import { ProviderKeyStore } from './keyStore';
import { getProviderStatuses, PROVIDERS } from './providers';

let mainWindow: BrowserWindow | undefined;
const keyStore = new ProviderKeyStore();

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 940,
    minWidth: 1120,
    minHeight: 760,
    title: 'Predictive Harness',
    backgroundColor: '#08090d',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  registerIpc();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function registerIpc(): void {
  ipcMain.handle('providers:list', async () => providerStatuses());

  ipcMain.handle('providers:set-key', async (_event, providerId: ProviderId, apiKey: string) => {
    ensureProvider(providerId);
    await keyStore.set(providerId, apiKey);
    return providerStatuses();
  });

  ipcMain.handle('providers:clear-key', async (_event, providerId: ProviderId) => {
    ensureProvider(providerId);
    await keyStore.clear(providerId);
    return providerStatuses();
  });

  ipcMain.handle('harness:start', async (event, request: HarnessRequest) => {
    const statuses = await providerStatuses();
    const runId = randomUUID();

    setTimeout(() => {
      void runHarness(
        request,
        statuses,
        (providerId) => keyStore.get(providerId),
        (harnessEvent) => {
          event.sender.send(`harness:event:${runId}`, harnessEvent);
        },
        runId,
      ).catch((error) => {
        event.sender.send(`harness:event:${runId}`, {
          type: 'error',
          snapshot: {
            runId,
            status: 'error',
            mode: request.mode,
            objective: request.objective,
            route: [],
            branches: [],
            trace: [],
            metrics: {
              hiddenCalls: 0,
              prunedBranches: 0,
              estimatedTokens: 0,
              elapsedMs: 0,
            },
            error: error instanceof Error ? error.message : String(error),
          },
        });
      });
    }, 0);

    return runId;
  });
}

async function providerStatuses(): Promise<ProviderStatus[]> {
  const entries = await Promise.all(
    PROVIDERS.map(async (provider) => ({
      id: provider.id,
      hasKey: await keyStore.has(provider.id),
      encryptedAt: await keyStore.encryptedAt(provider.id),
    })),
  );
  const hasKey = (providerId: ProviderId) => entries.find((entry) => entry.id === providerId)?.hasKey ?? false;
  const encryptedAt = (providerId: ProviderId) => entries.find((entry) => entry.id === providerId)?.encryptedAt;
  return getProviderStatuses(hasKey, encryptedAt);
}

function ensureProvider(providerId: ProviderId): void {
  if (!PROVIDERS.some((provider) => provider.id === providerId)) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
}
