import { useState, useEffect, useCallback } from 'react';
import { AppMode, AppSettings, GamepadMapping, RemoteConfig } from '../types';
import {
  getAppSettings,
  saveAppSettings as apiSaveSettings,
  toggleFullscreen as apiToggleFullscreen,
  getGamepadMappings,
  saveGamepadMappings as apiSaveGamepadMappings,
  getAppMode as apiGetAppMode,
  setAppMode as apiSetAppMode,
  getRemoteConfig as apiGetRemoteConfig,
  saveRemoteConfig as apiSaveRemoteConfig,
} from '../api';
import { DEFAULT_APP_SETTINGS } from '../constants';

const DEFAULT_REMOTE_CONFIG: RemoteConfig = {
  enabled: true,
  port: 8080,
  pin: '1234',
  allowed_origins: ['*'],
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [gamepadMappings, setGamepadMappings] = useState<GamepadMapping[]>([]);
  const [primaryPlayerIndex, setPrimaryPlayerIndex] = useState<number>(0);
  const [appMode, setAppMode] = useState<AppMode>('admin');
  const [remoteConfig, setRemoteConfig] = useState<RemoteConfig>(DEFAULT_REMOTE_CONFIG);

  const loadSettings = useCallback(async () => {
    try {
      const [fetchedSettings, fetchedMappings, fetchedMode, fetchedRemote] = await Promise.all([
        getAppSettings(),
        getGamepadMappings(),
        apiGetAppMode().catch(() => 'admin' as AppMode),
        apiGetRemoteConfig().catch(() => DEFAULT_REMOTE_CONFIG),
      ]);
      setSettings(fetchedSettings);
      setGamepadMappings(fetchedMappings);
      setAppMode(fetchedMode);
      setRemoteConfig(fetchedRemote);
    } catch (err) {
      console.warn('[useAppSettings] Using default settings:', err);
    }
  }, []);

  useEffect(() => {
    loadSettings();

    let unlistenSettings: (() => void) | undefined;
    let unlistenKiosk: (() => void) | undefined;
    let unlistenEmus: (() => void) | undefined;

    try {
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<AppSettings>('kairo://settings-updated', (event) => {
          console.log('[useAppSettings] Synchronisation paramètres reçue en temps réel:', event.payload);
          setSettings((prev) => ({ ...prev, ...event.payload }));
          if (event.payload.kiosk_mode !== undefined) {
            setAppMode(event.payload.kiosk_mode ? 'kiosk' : 'admin');
          }
        }).then((fn) => {
          unlistenSettings = fn;
        }).catch(() => {});

        listen<boolean>('kairo://kiosk-changed', (event) => {
          console.log('[useAppSettings] Synchronisation mode kiosk reçue en temps réel:', event.payload);
          setAppMode(event.payload ? 'kiosk' : 'admin');
          setSettings((prev) => ({ ...prev, kiosk_mode: event.payload }));
        }).then((fn) => {
          unlistenKiosk = fn;
        }).catch(() => {});

        listen<any>('kairo://emulators-updated', () => {
          console.log('[useAppSettings] Émulateurs mis à jour en temps réel');
        }).then((fn) => {
          unlistenEmus = fn;
        }).catch(() => {});
      }).catch(() => {});
    } catch {
      // ignore
    }

    return () => {
      if (unlistenSettings) unlistenSettings();
      if (unlistenKiosk) unlistenKiosk();
      if (unlistenEmus) unlistenEmus();
    };
  }, [loadSettings]);

  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      await apiSaveSettings(newSettings);
    } catch (err) {
      console.warn('[useAppSettings] Save fallback:', err);
    }
    setSettings(newSettings);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      const next = await apiToggleFullscreen();
      setSettings((prev) => ({ ...prev, fullscreen: next }));
      return next;
    } catch {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        setSettings((prev) => ({ ...prev, fullscreen: true }));
        return true;
      } else {
        document.exitFullscreen().catch(() => {});
        setSettings((prev) => ({ ...prev, fullscreen: false }));
        return false;
      }
    }
  }, []);

  const saveGamepadMappings = useCallback(async (mappings: GamepadMapping[]) => {
    try {
      await apiSaveGamepadMappings(mappings);
    } catch (err) {
      console.warn('[useAppSettings] Gamepad mappings save fallback:', err);
    }
    setGamepadMappings(mappings);
  }, []);

  const lockKiosk = useCallback(async () => {
    try {
      await apiSetAppMode('kiosk');
      setAppMode('kiosk');
      setSettings((prev) => ({ ...prev, kiosk_mode: true }));
    } catch (err) {
      console.error('Erreur verrouillage kiosk:', err);
    }
  }, []);

  const unlockKiosk = useCallback(async (pin: string) => {
    try {
      await apiSetAppMode('admin', pin);
      setAppMode('admin');
      setSettings((prev) => ({ ...prev, kiosk_mode: false }));
      return true;
    } catch (err) {
      console.warn('Erreur code PIN déverrouillage:', err);
      return false;
    }
  }, []);

  const saveRemote = useCallback(async (cfg: RemoteConfig) => {
    try {
      await apiSaveRemoteConfig(cfg);
    } catch (err) {
      console.warn('Erreur sauvegarde remote config:', err);
    }
    setRemoteConfig(cfg);
  }, []);

  return {
    settings,
    saveSettings,
    toggleFullscreen,
    gamepadMappings,
    saveGamepadMappings,
    primaryPlayerIndex,
    setPrimaryPlayerIndex,
    appMode,
    lockKiosk,
    unlockKiosk,
    remoteConfig,
    saveRemoteConfig: saveRemote,
  };
}
