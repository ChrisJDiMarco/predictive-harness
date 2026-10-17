import { contextBridge, ipcRenderer } from 'electron';
import type { HarnessApi, HarnessEvent, HarnessRequest, ProviderId } from '../src/shared/types';

const api: HarnessApi = {
  getProviders: () => ipcRenderer.invoke('providers:list'),
  saveProviderKey: (providerId: ProviderId, apiKey: string) => ipcRenderer.invoke('providers:set-key', providerId, apiKey),
  clearProviderKey: (providerId: ProviderId) => ipcRenderer.invoke('providers:clear-key', providerId),
  startRun: (request: HarnessRequest) => ipcRenderer.invoke('harness:start', request),
  onRunEvent: (runId: string, callback: (event: HarnessEvent) => void) => {
    const channel = `harness:event:${runId}`;
    const listener = (_event: Electron.IpcRendererEvent, payload: HarnessEvent) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('harness', api);
