import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface LocalServerPlugin {
  /** Start the WebSocket server. Rejects if the port is taken. */
  start(options: { port: number }): Promise<{ port: number }>;
  stop(): Promise<void>;
  /** Send text frames to several connections in one bridge call. */
  sendMany(options: { messages: { id: string; data: string }[] }): Promise<void>;
  close(options: { id: string }): Promise<void>;
  /** This phone's IPv4 addresses on Wi-Fi / hotspot interfaces. */
  getAddresses(): Promise<{ addresses: string[] }>;
  addListener(event: 'connection', fn: (e: { id: string; address: string | null }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'message', fn: (e: { id: string; data: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'close', fn: (e: { id: string }) => void): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const LocalServer = registerPlugin<LocalServerPlugin>('LocalServer');
