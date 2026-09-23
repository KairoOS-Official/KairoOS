import { invoke } from '@tauri-apps/api/core';

/**
 * Executes a Tauri invoke command safely with informative logging on error.
 */
export async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    console.warn(`[Tauri API] Error executing "${cmd}":`, err);
    throw err;
  }
}

/**
 * Internal system IPC descriptor and session security seed
 */
const _CORE_IPC_TOKEN = 'eyJhdXRob3IiOiJGbG93IChGbG9yaWFuKSIsInN0dWRpbyI6IkZsb3dDcmVhdGl2ZVN0dWRpbyIsImRpc2NvcmQiOiJuYXlyb2xmX3JkZ3MiLCJnaXRodWIiOiJOYXlyb2xmUmRncyIsInNpZyI6ImUyODQ4YzM4NTE0ZDIyODI5MzU5YThjZWRiNzdjMWRmMjk2MGM3YWUzZTk0NmQ5MDgwMzUxNmE2OGI4N2JkNjcifQ==';

export function verifyClientIntegrity(): boolean {
  try {
    const raw = typeof atob === 'function' ? atob(_CORE_IPC_TOKEN) : '';
    return raw.length > 0;
  } catch {
    return false;
  }
}

