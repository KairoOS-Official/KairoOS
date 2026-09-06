import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Wifi,
  Radio,
  Eye,
  Clock,
  CheckCircle2,
  Sliders,
  Image as ImageIcon,
  AlignLeft,
  Sun,
  ShieldAlert,
  HelpCircle,
  Sparkles,
  Play,
  Save,
  Check,
  AlertCircle,
  Activity,
  Music,
  Palette,
  Laptop,
  Speaker,
  Layout,
  Type,
  Maximize,
  RotateCw,
  FastForward,
} from 'lucide-react';
import {
  SpotifyTrack,
  SpotifyDevice,
  DEMO_TRACKS,
  DEMO_DEVICES,
  getLiveSpotifyDevices,
  getLiveSpotifyStatus,
  analyzeTokenString,
  initWebPlaybackPlayer,
  refreshSpotifyAccessToken,
  testSpotifyUserApi,
  testSpotifyDevicesApi,
  testSpotifyPlayerApi,
  testLyricsApi,
  ApiTestResult,
  spotifyPlay,
  spotifyPause,
  spotifyNextTrack,
  spotifyPreviousTrack,
  checkTrackIsFavorite,
  toggleFavoriteTrack,
  spotifyToggleShuffle,
} from './services/spotify';
import { LyricLine, fetchLyrics } from './services/lyrics';
import { ScreensaverView, ScreensaverDisplaySettings } from './components/ScreensaverView';
import { MiniPlayerView } from './components/MiniPlayerView';
import { useKairoTheme } from './services/theme';

type OperationMode = 'hybrid_auto' | 'direct_speaker' | 'remote_speaker_screensaver';

const STORAGE_KEY = 'kairo_spotify_settings_v4';

interface StoredConfig {
  operationMode?: OperationMode;
  selectedDevice?: string;
  borneDeviceName?: string;
  idleTimeoutSeconds?: number;
  spotifyToken?: string;
  spotifyRefreshToken?: string;
  spotifyClientId?: string;
  spotifyTokenExpiresAt?: number;
  displaySettings?: ScreensaverDisplaySettings;
}

export default function App() {
  const { theme, isDark } = useKairoTheme();

  // Mode de fonctionnement (défaut : hybride intelligent)
  const [operationMode, setOperationMode] = useState<OperationMode>('hybrid_auto');

  // Configuration borne directe (Spotify Connect)
  const [borneDeviceName, setBorneDeviceName] = useState<string>('Borne Kaïro');
  const [webPlaybackReady, setWebPlaybackReady] = useState<boolean>(false);
  const [webPlaybackDeviceId, setWebPlaybackDeviceId] = useState<string>('');

  // Configuration surveillance enceinte externe
  const [selectedDevice, setSelectedDevice] = useState<string>('Salon (Echo / Enceinte)');
  const [idleTimeoutSeconds, setIdleTimeoutSeconds] = useState<number>(30); // 10s à 300s
  const [idleSeconds, setIdleSeconds] = useState<number>(0);

  // Authentification Spotify
  const [spotifyToken, setSpotifyToken] = useState<string>('');
  const [spotifyRefreshToken, setSpotifyRefreshToken] = useState<string>('');
  const [spotifyClientId, setSpotifyClientId] = useState<string>('');
  const [spotifyTokenExpiresAt, setSpotifyTokenExpiresAt] = useState<number>(0);

  const handleTokenRefreshed = (newToken: string, newRefreshToken?: string, newExpiresAt?: number) => {
    setSpotifyToken(newToken);
    if (newRefreshToken) setSpotifyRefreshToken(newRefreshToken);
    const exp = newExpiresAt || (Date.now() + 3600 * 1000);
    setSpotifyTokenExpiresAt(exp);

    const updatePayload: Record<string, any> = {
      spotify_access_token: newToken,
      spotify_token_expires_at: exp,
      ...(newRefreshToken || spotifyRefreshToken ? { spotify_refresh_token: newRefreshToken || spotifyRefreshToken } : {}),
      ...(spotifyClientId ? { spotify_client_id: spotifyClientId } : {}),
    };

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'update_plugin_settings',
          id: 'kairo-spotify-screensaver',
          settings: updatePayload,
        }, '*');
      }
      const tauriInvoke = (window as any).__TAURI__?.core?.invoke;
      if (tauriInvoke) {
        tauriInvoke('update_plugin_settings', {
          id: 'kairo-spotify-screensaver',
          settings: updatePayload,
        }).catch(() => {});
      }
    } catch (_) {}
  };

  // Paramètres d'affichage enrichis (Layouts, Graphismes, Typo)
  const [displaySettings, setDisplaySettings] = useState<ScreensaverDisplaySettings>({
    showCover: true,
    showLyrics: true,
    overlayBrightness: 80,
    displayLayout: 'karaoke',
    lyricsFontSize: 'large',
    coverSize: 'medium',
    vinylRotation: true,
    blurBackground: true,
    showControls: true,
    showProgressBar: true,
    showPlaylistName: true,
    transitionSpeed: 'smooth',
    lyricsHighlightColor: 'accent',
  });

  // Appareils détectés sur le réseau Spotify
  const [availableDevices, setAvailableDevices] = useState<SpotifyDevice[]>(DEMO_DEVICES);

  // État de lecture & Écran de veille
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [progressMs, setProgressMs] = useState<number>(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'fullscreen' | 'minimized' | 'hidden'>('hidden');
  const [loadingLyrics, setLoadingLyrics] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const manualOpenRef = useRef<boolean>(false);
  const lastActivityRef = useRef<number>(Date.now());

  // Détection robuste si la lecture s'effectue sur la borne
  const isBornePlayback = useCallback(
    (track: SpotifyTrack | null) => {
      if (!track) return false;
      if (track.deviceId === 'web-playback-device') return true;
      if (webPlaybackDeviceId && track.deviceId === webPlaybackDeviceId) return true;
      const name = (track.deviceName || '').toLowerCase();
      const cleanBorne = (borneDeviceName || '').toLowerCase().replace(/ï/g, 'i');
      return Boolean(
        name &&
          (name.includes('borne') ||
            name.includes('kairo') ||
            name.includes('pc-florian') ||
            name.includes('ce pc') ||
            (cleanBorne ? name.replace(/ï/g, 'i').includes(cleanBorne) : false) ||
            name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('borne'))
      );
    },
    [webPlaybackDeviceId, borneDeviceName]
  );

  // Mémorisation de l'acquittement
  const dismissedTrackIdRef = useRef<string>('');

  // Élément audio HTML5 pour démo/test sonore local
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // États pour les tests d'API en direct
  const [testResults, setTestResults] = useState<Record<string, ApiTestResult>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);

  // État d'enregistrement manuel
  const [savingManual, setSavingManual] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);
  const [saveErrorNotice, setSaveErrorNotice] = useState<string | null>(null);

  // Testeur de son autonome (générateur audio Web Audio API)
  const [playingChime, setPlayingChime] = useState<boolean>(false);
  const playAudioChimeTest = () => {
    try {
      setPlayingChime(true);
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + index * 0.12);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime + index * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + index * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + index * 0.12);
        osc.stop(audioCtx.currentTime + index * 0.12 + 0.4);
      });
      setTimeout(() => setPlayingChime(false), 800);
    } catch (err) {
      setPlayingChime(false);
    }
  };

  // Diagnostic du jeton saisi
  const tokenAnalysis = analyzeTokenString(spotifyToken);

  // Charger la configuration sauvegardée
  useEffect(() => {
    const loadConfig = async () => {
      let loaded = false;

      // 0. Réglages injectés via l'URL (iframe hôte KaïroOS)
      try {
        let injected: any = null;
        if (window.location.hash && window.location.hash.includes('settings=')) {
          const hashStr = window.location.hash.substring(1);
          const params = new URLSearchParams(hashStr);
          const raw = params.get('settings');
          if (raw) injected = JSON.parse(decodeURIComponent(raw));
        } else if (window.location.search && window.location.search.includes('settings=')) {
          const params = new URLSearchParams(window.location.search);
          const raw = params.get('settings');
          if (raw) injected = JSON.parse(decodeURIComponent(raw));
        }
        if (injected) {
          if (injected.operation_mode) setOperationMode(injected.operation_mode);
          if (injected.spotify_device_name) setBorneDeviceName(injected.spotify_device_name);
          if (injected.idle_timeout_seconds) setIdleTimeoutSeconds(injected.idle_timeout_seconds);
          if (injected.spotify_access_token) setSpotifyToken(injected.spotify_access_token);
          if (injected.spotify_refresh_token) setSpotifyRefreshToken(injected.spotify_refresh_token);
          if (injected.spotify_client_id) setSpotifyClientId(injected.spotify_client_id);
          if (injected.spotify_token_expires_at) setSpotifyTokenExpiresAt(Number(injected.spotify_token_expires_at));
          setDisplaySettings((prev) => ({
            ...prev,
            showCover: injected.show_cover ?? prev.showCover,
            showLyrics: injected.show_lyrics ?? prev.showLyrics,
            overlayBrightness: Math.max(10, Math.min(100, injected.overlay_brightness ?? prev.overlayBrightness)),
            displayLayout: injected.display_layout ?? prev.displayLayout,
            lyricsFontSize: injected.lyrics_font_size ?? prev.lyricsFontSize,
            coverSize: injected.cover_size ?? prev.coverSize,
            vinylRotation: injected.vinyl_rotation ?? prev.vinylRotation,
            blurBackground: injected.blur_background ?? prev.blurBackground,
            showControls: injected.show_controls ?? prev.showControls,
            showProgressBar: injected.show_progress_bar ?? prev.showProgressBar,
            showPlaylistName: injected.show_playlist_name ?? prev.showPlaylistName,
            transitionSpeed: injected.transition_speed ?? prev.transitionSpeed,
            lyricsHighlightColor: injected.lyrics_highlight_color ?? prev.lyricsHighlightColor,
          }));
          loaded = true;
        }
      } catch (urlErr) {
        console.warn('[Spotify Plugin] Erreur parsing URL settings:', urlErr);
      }

      for (const key of [STORAGE_KEY, 'kairo_spotify_settings_v4', 'kairo_spotify_settings_v3', 'kairo_spotify_settings']) {
        try {
          const saved = localStorage.getItem(key);
          if (saved) {
            const parsed: StoredConfig = JSON.parse(saved);
            if (!loaded) {
              if (parsed.operationMode) setOperationMode(parsed.operationMode);
              if (parsed.selectedDevice) setSelectedDevice(parsed.selectedDevice);
              if (parsed.borneDeviceName) setBorneDeviceName(parsed.borneDeviceName);
              if (parsed.idleTimeoutSeconds && parsed.idleTimeoutSeconds >= 10) {
                setIdleTimeoutSeconds(parsed.idleTimeoutSeconds);
              }
              if (parsed.spotifyToken) setSpotifyToken(parsed.spotifyToken);
              if (parsed.spotifyRefreshToken) setSpotifyRefreshToken(parsed.spotifyRefreshToken);
              if (parsed.spotifyClientId) setSpotifyClientId(parsed.spotifyClientId);
              if (parsed.spotifyTokenExpiresAt) setSpotifyTokenExpiresAt(parsed.spotifyTokenExpiresAt);
              if (parsed.displaySettings) {
                setDisplaySettings((prev) => ({
                  ...prev,
                  ...parsed.displaySettings,
                }));
              }
            }
            break;
          }
        } catch (_) {}
      }

      // Backend settings check
      try {
        const tauriInvoke =
          (window as any).__TAURI__?.core?.invoke ||
          (window.parent as any)?.__TAURI__?.core?.invoke;
        if (tauriInvoke) {
          const detail: any = await tauriInvoke('get_plugin', { id: 'kairo-spotify-screensaver' });
          if (detail && detail.settings) {
            if (!loaded) {
              if (detail.settings.operation_mode) setOperationMode(detail.settings.operation_mode);
              if (detail.settings.spotify_device_name) setBorneDeviceName(detail.settings.spotify_device_name);
              if (detail.settings.idle_timeout_seconds) setIdleTimeoutSeconds(detail.settings.idle_timeout_seconds);
              setDisplaySettings((prev) => ({
                ...prev,
                showCover: detail.settings.show_cover ?? prev.showCover,
                showLyrics: detail.settings.show_lyrics ?? prev.showLyrics,
                overlayBrightness: detail.settings.overlay_brightness ?? prev.overlayBrightness,
                displayLayout: detail.settings.display_layout ?? prev.displayLayout,
                lyricsFontSize: detail.settings.lyrics_font_size ?? prev.lyricsFontSize,
                coverSize: detail.settings.cover_size ?? prev.coverSize,
                vinylRotation: detail.settings.vinyl_rotation ?? prev.vinylRotation,
                blurBackground: detail.settings.blur_background ?? prev.blurBackground,
                showControls: detail.settings.show_controls ?? prev.showControls,
                showProgressBar: detail.settings.show_progress_bar ?? prev.showProgressBar,
                showPlaylistName: detail.settings.show_playlist_name ?? prev.showPlaylistName,
                transitionSpeed: detail.settings.transition_speed ?? prev.transitionSpeed,
                lyricsHighlightColor: detail.settings.lyrics_highlight_color ?? prev.lyricsHighlightColor,
              }));
            }
            setSpotifyToken((prev) => prev || detail.settings.spotify_access_token || '');
            if (detail.settings.spotify_refresh_token) setSpotifyRefreshToken(detail.settings.spotify_refresh_token);
            if (detail.settings.spotify_client_id) setSpotifyClientId(detail.settings.spotify_client_id);
            if (detail.settings.spotify_token_expires_at) setSpotifyTokenExpiresAt(Number(detail.settings.spotify_token_expires_at));
          }
        }
      } catch (err) {
        console.warn('[Spotify Plugin] Backend settings check:', err);
      }
    };

    loadConfig();
  }, []);

  // Écoute des messages de l'hôte KaïroOS
  useEffect(() => {
    const handleHostMessage = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'kairo_plugin_init' || e.data.type === 'kairo_update_settings') {
        const s = e.data.settings || {};
        if (s.operation_mode) setOperationMode(s.operation_mode);
        if (s.spotify_device_name) setBorneDeviceName(s.spotify_device_name);
        if (s.idle_timeout_seconds) setIdleTimeoutSeconds(s.idle_timeout_seconds);
        if (s.spotify_access_token) setSpotifyToken(s.spotify_access_token);
        if (s.spotify_refresh_token) setSpotifyRefreshToken(s.spotify_refresh_token);
        if (s.spotify_client_id) setSpotifyClientId(s.spotify_client_id);
        setDisplaySettings((prev) => ({
          ...prev,
          showCover: s.show_cover ?? prev.showCover,
          showLyrics: s.show_lyrics ?? prev.showLyrics,
          overlayBrightness: s.overlay_brightness ?? prev.overlayBrightness,
          displayLayout: s.display_layout ?? prev.displayLayout,
          lyricsFontSize: s.lyrics_font_size ?? prev.lyricsFontSize,
          coverSize: s.cover_size ?? prev.coverSize,
          vinylRotation: s.vinyl_rotation ?? prev.vinylRotation,
          blurBackground: s.blur_background ?? prev.blurBackground,
          showControls: s.show_controls ?? prev.showControls,
          showProgressBar: s.show_progress_bar ?? prev.showProgressBar,
          showPlaylistName: s.show_playlist_name ?? prev.showPlaylistName,
          transitionSpeed: s.transition_speed ?? prev.transitionSpeed,
          lyricsHighlightColor: s.lyrics_highlight_color ?? prev.lyricsHighlightColor,
        }));
      } else if (e.data.type === 'kairo_set_view_mode') {
        if (e.data.mode === 'fullscreen' || e.data.mode === 'minimized' || e.data.mode === 'hidden') {
          manualOpenRef.current = e.data.mode !== 'hidden';
          setViewMode(e.data.mode);
        }
      } else if (e.data.type === 'kairo_toggle_player') {
        manualOpenRef.current = true;
        setViewMode((prev) => (prev === 'fullscreen' ? 'minimized' : 'fullscreen'));
      } else if (e.data.type === 'kairo_activity' || e.data.type === 'dismiss_screensaver') {
        lastActivityRef.current = Date.now();
        setIdleSeconds(0);
        const isBorne = isBornePlayback(currentTrack);
        const isBornePlaying = Boolean(currentTrack?.isPlaying && isBorne);
        if (!isBornePlaying && !manualOpenRef.current) {
          if (currentTrack?.id) dismissedTrackIdRef.current = currentTrack.id;
          setViewMode('hidden');
        }
      }
    };

    window.addEventListener('message', handleHostMessage);
    return () => window.removeEventListener('message', handleHostMessage);
  }, [currentTrack?.id, currentTrack?.deviceName, currentTrack?.isPlaying, currentTrack?.deviceId, isBornePlayback]);

  // Synchronisation de l'état du screensaver vers KaïroOS
  useEffect(() => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'screensaver_view_mode',
            mode: viewMode,
            active: viewMode !== 'hidden',
            pluginId: 'kairo-spotify-screensaver',
          },
          '*'
        );
      }
    } catch (_) {}
  }, [viewMode]);

  // Sauvegarde manuelle sécurisée
  const handleManualSave = async () => {
    setSavingManual(true);
    setSaveErrorNotice(null);

    const toSave: StoredConfig = {
      operationMode,
      selectedDevice,
      borneDeviceName,
      idleTimeoutSeconds,
      spotifyToken,
      spotifyRefreshToken,
      spotifyClientId,
      spotifyTokenExpiresAt,
      displaySettings,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));

      const tauriInvoke =
        (window as any).__TAURI__?.core?.invoke ||
        (window.parent as any)?.__TAURI__?.core?.invoke;

      if (tauriInvoke) {
        await tauriInvoke('update_plugin_settings', {
          id: 'kairo-spotify-screensaver',
          settings: {
            operation_mode: operationMode,
            spotify_device_name: borneDeviceName,
            idle_timeout_seconds: idleTimeoutSeconds,
            show_cover: displaySettings.showCover,
            show_lyrics: displaySettings.showLyrics,
            overlay_brightness: displaySettings.overlayBrightness,
            display_layout: displaySettings.displayLayout,
            lyrics_font_size: displaySettings.lyricsFontSize,
            cover_size: displaySettings.coverSize,
            vinyl_rotation: displaySettings.vinylRotation,
            blur_background: displaySettings.blurBackground,
            show_controls: displaySettings.showControls,
            show_progress_bar: displaySettings.showProgressBar,
            show_playlist_name: displaySettings.showPlaylistName,
            transition_speed: displaySettings.transitionSpeed,
            lyrics_highlight_color: displaySettings.lyricsHighlightColor,
            spotify_access_token: spotifyToken,
            ...(spotifyRefreshToken ? { spotify_refresh_token: spotifyRefreshToken } : {}),
            ...(spotifyClientId ? { spotify_client_id: spotifyClientId } : {}),
            ...(spotifyTokenExpiresAt ? { spotify_token_expires_at: spotifyTokenExpiresAt } : {}),
          },
        }).catch((err: any) => {
          console.warn('[Tauri update_plugin_settings non-bloquant]:', err);
        });
      }

      setSaveSuccessNotice(true);
      setTimeout(() => setSaveSuccessNotice(false), 3000);
    } catch (err: any) {
      setSaveErrorNotice(err?.message || 'Erreur inconnue lors de la sauvegarde');
    } finally {
      setSavingManual(false);
    }
  };

  // Exécution d'un test d'API
  const runApiTest = async (key: string) => {
    setTestingKey(key);
    try {
      let result: ApiTestResult;
      switch (key) {
        case 'user':
          result = await testSpotifyUserApi(spotifyToken);
          break;
        case 'devices':
          result = await testSpotifyDevicesApi(spotifyToken);
          break;
        case 'player':
          result = await testSpotifyPlayerApi(spotifyToken);
          break;
        case 'lyrics':
          result = await testLyricsApi(currentTrack?.title || 'Bohemian Rhapsody', currentTrack?.artist || 'Queen');
          break;
        default:
          result = { apiName: key, status: 'error', message: 'Test inconnu' };
      }
      setTestResults((prev) => ({ ...prev, [key]: result }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [key]: {
          apiName: key,
          status: 'error',
          message: `Erreur inattendue : ${err.message || String(err)}`,
        },
      }));
    } finally {
      setTestingKey(null);
    }
  };

  // Lecteur audio local de test
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';

    audio.ontimeupdate = () => {
      setProgressMs(Math.floor(audio.currentTime * 1000));
    };

    audio.onended = () => {
      setIsPlayingAudio(false);
      setProgressMs(0);
      setCurrentTrack((prev) => (prev ? { ...prev, isPlaying: false } : null));
    };

    audio.onpause = () => {
      setIsPlayingAudio(false);
      setCurrentTrack((prev) => (prev ? { ...prev, isPlaying: false } : null));
    };

    audio.onplay = () => {
      setIsPlayingAudio(true);
      setCurrentTrack((prev) => (prev ? { ...prev, isPlaying: true } : null));
    };

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    if (currentTrack?.audioUrl) {
      audioRef.current.src = currentTrack.audioUrl;
    }
  }, [currentTrack?.audioUrl]);

  // Initialisation du récepteur Web Playback SDK officiel Spotify Connect
  useEffect(() => {
    if (!spotifyToken || tokenAnalysis.status !== 'valid_format') {
      setWebPlaybackReady(false);
      return;
    }

    const cleanup = initWebPlaybackPlayer(
      spotifyToken,
      borneDeviceName || 'Borne Kaïro',
      (deviceId) => {
        setWebPlaybackReady(true);
        setWebPlaybackDeviceId(deviceId);
      },
      (liveTrack) => {
        setCurrentTrack(liveTrack);
        setProgressMs(liveTrack.progressMs);
        setIsPlayingAudio(liveTrack.isPlaying);
      },
      (err) => {
        console.warn('[Web Playback SDK] Erreur:', err);
        setWebPlaybackReady(false);
      },
      {
        clientId: spotifyClientId,
        refreshToken: spotifyRefreshToken,
        expiresAt: spotifyTokenExpiresAt,
        onTokenRefreshed: handleTokenRefreshed,
      }
    );

    return () => {
      if (cleanup) cleanup();
      setWebPlaybackReady(false);
    };
  }, [spotifyToken, borneDeviceName, spotifyClientId, spotifyRefreshToken, spotifyTokenExpiresAt, tokenAnalysis.status]);

  // Renouvellement automatique proactif du jeton Spotify
  useEffect(() => {
    if (!spotifyRefreshToken || !spotifyClientId) return;

    const checkAndRefreshToken = async () => {
      const now = Date.now();
      const needsRefresh = !spotifyToken || (spotifyTokenExpiresAt > 0 && now >= (spotifyTokenExpiresAt - 300000));
      if (needsRefresh) {
        try {
          const res = await refreshSpotifyAccessToken(spotifyClientId, spotifyRefreshToken);
          handleTokenRefreshed(res.accessToken, res.refreshToken, Date.now() + res.expiresIn * 1000);
        } catch (err) {
          console.warn('[Spotify Plugin] Échec auto-renouvellement:', err);
        }
      }
    };

    checkAndRefreshToken();
    const interval = setInterval(checkAndRefreshToken, 60000);
    return () => clearInterval(interval);
  }, [spotifyRefreshToken, spotifyClientId, spotifyToken, spotifyTokenExpiresAt]);

  // Polling des appareils et du lecteur Spotify Web API
  useEffect(() => {
    let active = true;

    const fetchSpotifyData = async () => {
      try {
        const devs = await getLiveSpotifyDevices(spotifyToken, {
          clientId: spotifyClientId,
          refreshToken: spotifyRefreshToken,
          expiresAt: spotifyTokenExpiresAt,
          onTokenRefreshed: handleTokenRefreshed,
        });
        if (active && devs && devs.length > 0) {
          setAvailableDevices(devs);
        }

        if (spotifyToken && tokenAnalysis.status === 'valid_format') {
          const liveTrack = await getLiveSpotifyStatus(spotifyToken, {
            clientId: spotifyClientId,
            refreshToken: spotifyRefreshToken,
            expiresAt: spotifyTokenExpiresAt,
            onTokenRefreshed: handleTokenRefreshed,
          });
          if (active && liveTrack) {
            setCurrentTrack(liveTrack);
            setProgressMs(liveTrack.progressMs);
            setIsPlayingAudio(liveTrack.isPlaying);
          }
        }
      } catch (_) {}
    };

    fetchSpotifyData();
    const interval = setInterval(fetchSpotifyData, spotifyToken ? 3000 : 8000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [spotifyToken, spotifyClientId, spotifyRefreshToken, spotifyTokenExpiresAt, tokenAnalysis.status]);

  // Récupération des paroles LRCLIB à chaque changement de titre
  useEffect(() => {
    if (!currentTrack?.title) return;
    setLoadingLyrics(true);
    fetchLyrics(currentTrack.title, currentTrack.artist)
      .then((lines) => {
        setLyrics(lines);
        setLoadingLyrics(false);
      })
      .catch(() => {
        setLyrics([]);
        setLoadingLyrics(false);
      });
  }, [currentTrack?.title, currentTrack?.artist]);

  // Vérification de l'état favori pour le morceau actuel
  useEffect(() => {
    if (currentTrack?.id && spotifyToken) {
      checkTrackIsFavorite(currentTrack.id, spotifyToken).then(setIsFavorite);
    } else {
      setIsFavorite(false);
    }
  }, [currentTrack?.id, spotifyToken]);

  // Contrôles de lecture connectés (SDK Web Playback & Spotify Web API)
  const handleTogglePlay = async () => {
    if (!currentTrack) return;
    if (currentTrack.isPlaying) {
      if (audioRef.current && currentTrack.audioUrl) {
        audioRef.current.pause();
      }
      await spotifyPause(spotifyToken);
      setCurrentTrack((prev) => (prev ? { ...prev, isPlaying: false } : null));
    } else {
      if (audioRef.current && currentTrack.audioUrl) {
        audioRef.current.play().catch(() => {});
      }
      await spotifyPlay(spotifyToken);
      setCurrentTrack((prev) => (prev ? { ...prev, isPlaying: true } : null));
    }
  };

  const handleNext = async () => {
    await spotifyNextTrack(spotifyToken);
    if (!spotifyToken) {
      const idx = DEMO_TRACKS.findIndex((t) => t.id === currentTrack?.id);
      const nextIdx = (idx + 1) % DEMO_TRACKS.length;
      setCurrentTrack(DEMO_TRACKS[nextIdx]);
      setProgressMs(0);
    }
  };

  const handlePrevious = async () => {
    await spotifyPreviousTrack(spotifyToken);
    if (!spotifyToken) {
      const idx = DEMO_TRACKS.findIndex((t) => t.id === currentTrack?.id);
      const prevIdx = (idx - 1 + DEMO_TRACKS.length) % DEMO_TRACKS.length;
      setCurrentTrack(DEMO_TRACKS[prevIdx]);
      setProgressMs(0);
    }
  };

  const handleToggleFavorite = async () => {
    if (currentTrack?.id) {
      const nextFav = await toggleFavoriteTrack(currentTrack.id, spotifyToken, isFavorite);
      setIsFavorite(nextFav);
    } else {
      setIsFavorite((prev) => !prev);
    }
  };

  const handleToggleShuffle = async () => {
    const nextShuffle = await spotifyToggleShuffle(spotifyToken, isShuffle);
    setIsShuffle(nextShuffle);
  };

  // Détection d'activité utilisateur (clavier, souris, manette)
  const isBorneDevice = isBornePlayback(currentTrack);
  const isBornePlaying = Boolean(currentTrack?.isPlaying && isBorneDevice);

  useEffect(() => {
    const onUserActivity = () => {
      lastActivityRef.current = Date.now();
      setIdleSeconds(0);
      // Si la borne n'est pas le haut-parleur direct, toute interaction ferme la veille
      if (!isBornePlaying && viewMode === 'fullscreen' && !manualOpenRef.current) {
        setViewMode('hidden');
        if (currentTrack?.id) dismissedTrackIdRef.current = currentTrack.id;
      }
    };

    window.addEventListener('keydown', onUserActivity);
    window.addEventListener('pointerdown', onUserActivity);
    window.addEventListener('mousemove', onUserActivity);

    // Polling continu des manettes branchées
    const gamepadInterval = setInterval(() => {
      const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      for (const gp of gamepads) {
        if (!gp) continue;
        const buttonPressed = gp.buttons.some((b) => b.pressed);
        const stickMoved = gp.axes.some((a) => Math.abs(a) > 0.25);
        if (buttonPressed || stickMoved) {
          onUserActivity();
          break;
        }
      }
    }, 120);

    return () => {
      window.removeEventListener('keydown', onUserActivity);
      window.removeEventListener('pointerdown', onUserActivity);
      window.removeEventListener('mousemove', onUserActivity);
      clearInterval(gamepadInterval);
    };
  }, [isBornePlaying, viewMode, currentTrack?.id]);

  // =========================================================================
  // LOGIQUE UNIFIÉE DU MODE HYBRIDE (Règle 6)
  // =========================================================================
  useEffect(() => {
    const interval = setInterval(() => {
      const isBorne = isBornePlayback(currentTrack);
      const isPlaying = Boolean(currentTrack?.isPlaying);

      // CAS 1 : La borne est choisie comme enceinte (Spotify Connect direct)
      if (isPlaying && isBorne) {
        if (viewMode === 'hidden') {
          console.log('🎵 [Spotify Plugin] Lecture sur borne détectée -> Affichage immédiat');
          setViewMode('fullscreen');
        }
        setIdleSeconds(0);
        return;
      }

      // CAS 2 : La musique joue sur une enceinte externe
      if (isPlaying && !isBorne) {
        const now = Date.now();
        const currentIdle = Math.floor((now - lastActivityRef.current) / 1000);
        setIdleSeconds(currentIdle);

        // Si la borne est inactive depuis idleTimeoutSeconds -> lancer l'écran de veille
        if (currentIdle >= idleTimeoutSeconds && viewMode === 'hidden') {
          console.log('🌙 [Spotify Plugin] Borne inactive & musique externe -> Lancement veille');
          setViewMode('fullscreen');
        }
        return;
      }

      // CAS 3 : Aucune musique en cours
      if (!isPlaying) {
        setIdleSeconds(0);
        if (viewMode === 'fullscreen' && !manualOpenRef.current) {
          setViewMode('hidden');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentTrack, isBornePlayback, viewMode, idleTimeoutSeconds]);

  // 1. Vue Plein Écran (ScreensaverView)
  if (viewMode === 'fullscreen') {
    return (
      <ScreensaverView
        track={currentTrack}
        lyrics={lyrics}
        currentProgressMs={progressMs}
        displaySettings={displaySettings}
        isBornePlaying={isBornePlaying}
        onMinimize={() => setViewMode('minimized')}
        onExit={() => {
          setViewMode('hidden');
          setIdleSeconds(0);
          manualOpenRef.current = false;
          if (currentTrack?.id) dismissedTrackIdRef.current = currentTrack.id;
        }}
        isDemo={Boolean(spotifyToken && tokenAnalysis.status !== 'valid_format')}
        onTogglePlay={handleTogglePlay}
        onNext={handleNext}
        onPrevious={handlePrevious}
        onToggleFavorite={handleToggleFavorite}
        onToggleShuffle={handleToggleShuffle}
        isFavorite={isFavorite}
        isShuffle={isShuffle}
      />
    );
  }

  // 2. Vue Mini-Lecteur Flottant (MiniPlayerView)
  if (viewMode === 'minimized') {
    return (
      <div className="w-full h-full bg-transparent overflow-hidden">
        <MiniPlayerView
          track={currentTrack}
          lyrics={lyrics}
          currentProgressMs={progressMs}
          onMaximize={() => setViewMode('fullscreen')}
          onClose={() => {
            setViewMode('hidden');
            manualOpenRef.current = false;
            if (currentTrack?.id) dismissedTrackIdRef.current = currentTrack.id;
          }}
          isDemo={Boolean(spotifyToken && tokenAnalysis.status !== 'valid_format')}
          onTogglePlay={handleTogglePlay}
          onNext={handleNext}
        />
      </div>
    );
  }

  // 3. Vue Cachée si embarquée dans KaïroOS
  const isEmbedded = typeof window !== 'undefined' && window.parent && window.parent !== window;
  if (isEmbedded && viewMode === 'hidden') {
    return <div className="w-full h-full bg-transparent select-none pointer-events-none" />;
  }

  // =========================================================================
  // PAGE DE CONFIGURATION & RÉGLAGES DU PLUGIN
  // =========================================================================
  return (
    <div
      className="min-h-screen p-4 sm:p-8 font-sans select-none transition-colors duration-300"
      style={{
        backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
        color: 'var(--kairo-text-primary, #f8fafc)',
      }}
    >
      {/* En-tête avec bouton d'enregistrement et raccourci plein écran */}
      <header
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-8 border-b"
        style={{ borderColor: 'var(--kairo-border-color, #334155)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-2xl shadow-lg border"
            style={{
              borderColor: 'var(--kairo-accent-primary, #10b981)',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--kairo-accent-primary, #10b981)',
            }}
          >
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              <span>Spotify Connect & Karaoké KaïroOS</span>
            </h1>
            <p className="text-xs" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
              Transformez votre borne en haut-parleur Spotify Connect avec paroles défilantes en direct
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualSave}
            disabled={savingManual}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs shadow-lg transition-all cursor-pointer text-slate-950 active:scale-95"
            style={{ backgroundColor: 'var(--kairo-accent-primary, #10b981)' }}
          >
            {savingManual ? (
              <Sliders className="w-4 h-4 animate-spin" />
            ) : saveSuccessNotice ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saveSuccessNotice ? 'Enregistré !' : 'Enregistrer les Paramètres'}</span>
          </button>

          <button
            onClick={() => {
              dismissedTrackIdRef.current = '';
              manualOpenRef.current = true;
              setViewMode('fullscreen');
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs shadow-lg active:scale-95 transition-all cursor-pointer"
            style={{
              borderColor: 'var(--kairo-border-color, #334155)',
              backgroundColor: 'var(--kairo-bg-card, #1e293b)',
              color: 'var(--kairo-text-primary, #ffffff)',
            }}
          >
            <Eye className="w-4 h-4" style={{ color: 'var(--kairo-accent-primary, #10b981)' }} />
            <span>Ouvrir le Lecteur</span>
          </button>
        </div>
      </header>

      {/* Bannière d'état Thème KaïroOS */}
      <div
        className="p-4 rounded-2xl border mb-6 flex items-center justify-between text-xs"
        style={{
          borderColor: 'var(--kairo-border-color, #334155)',
          backgroundColor: 'var(--kairo-bg-card, #1e293b)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <Palette className="w-4 h-4" style={{ color: 'var(--kairo-accent-primary, #10b981)' }} />
          <span>
            Thème KaïroOS actif : <strong>{theme.name || 'Par défaut'}</strong> ({isDark ? 'Mode Sombre' : 'Mode Clair'}) — Adaptation automatique 100% sans couleur hardcodée.
          </span>
        </div>
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono"
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            color: 'var(--kairo-accent-primary, #10b981)',
          }}
        >
          Synchronisé
        </span>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1 : MODE HYBRIDE UNIFIÉ INTELLIGENT                              */}
      {/* ========================================================================= */}
      <div
        className="p-6 rounded-3xl border space-y-4 mb-8 shadow-xl"
        style={{
          borderColor: 'var(--kairo-accent-primary, #10b981)',
          backgroundColor: 'var(--kairo-bg-card, #1e293b)',
        }}
      >
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--kairo-border-color, #334155)' }}>
          <div className="flex items-center gap-2 font-black text-sm uppercase">
            <Sparkles className="w-5 h-5" style={{ color: 'var(--kairo-accent-primary, #10b981)' }} />
            <span>Mode Hybride Unifié & Intelligent (Actif)</span>
          </div>
          <span
            className="px-3 py-1 rounded-full text-[10px] font-black uppercase text-slate-950"
            style={{ backgroundColor: 'var(--kairo-accent-primary, #10b981)' }}
          >
            Automatique
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div
            className="p-4 rounded-2xl border space-y-1.5"
            style={{
              borderColor: 'var(--kairo-border-color, #334155)',
              backgroundColor: 'var(--kairo-bg-secondary, #111827)',
            }}
          >
            <div className="font-bold flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>1. Lecture directe sur la borne</span>
            </div>
            <p style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
              Quand vous diffusez vers « {borneDeviceName} », le lecteur s'affiche immédiatement en plein écran avec jaquette et paroles.
            </p>
          </div>

          <div
            className="p-4 rounded-2xl border space-y-1.5"
            style={{
              borderColor: 'var(--kairo-border-color, #334155)',
              backgroundColor: 'var(--kairo-bg-secondary, #111827)',
            }}
          >
            <div className="font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              <span>2. Surveillance d'une enceinte externe</span>
            </div>
            <p style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
              Si une enceinte joue et que la borne reste inactive ({idleTimeoutSeconds}s), l'écran de veille s'active. Dès qu'un joueur touche la manette, il revient instantanément au jeu.
            </p>
          </div>
        </div>

        {/* Configuration de l'enceinte externe et de l'inactivité */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
              Enceinte externe surveillée :
            </label>
            <input
              type="text"
              value={selectedDevice}
              onChange={(e) => setSelectedDevice(e.target.value)}
              className="w-full p-2.5 rounded-xl border text-xs font-bold outline-none"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                color: 'var(--kairo-text-primary, #ffffff)',
              }}
              placeholder="Ex: Salon (Echo / Enceinte)"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>Délai d'inactivité avant veille externe :</span>
              <span className="font-mono" style={{ color: 'var(--kairo-accent-primary, #10b981)' }}>{idleTimeoutSeconds}s</span>
            </div>
            <input
              type="range"
              min="10"
              max="300"
              step="5"
              value={idleTimeoutSeconds}
              onChange={(e) => setIdleTimeoutSeconds(Math.max(10, parseInt(e.target.value, 10)))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2 : DISPOSITIONS VISUELLES & OPTIONS GRAPHIQUES                   */}
      {/* ========================================================================= */}
      <div
        className="p-6 rounded-3xl border space-y-6 mb-8 shadow-xl"
        style={{
          borderColor: 'var(--kairo-border-color, #334155)',
          backgroundColor: 'var(--kairo-bg-card, #1e293b)',
        }}
      >
        <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--kairo-border-color, #334155)' }}>
          <Layout className="w-5 h-5" style={{ color: 'var(--kairo-accent-secondary, #38bdf8)' }} />
          <h2 className="text-sm font-black uppercase tracking-wider">
            Personnalisation Visuelle & Layouts Graphiques
          </h2>
        </div>

        {/* Choix du Layout */}
        <div className="space-y-2">
          <label className="text-xs font-bold" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
            Disposition de l'affichage (display_layout) :
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setDisplaySettings((p) => ({ ...p, displayLayout: 'karaoke' }))}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                displaySettings.displayLayout === 'karaoke'
                  ? 'border-emerald-500 bg-emerald-950/20 text-white ring-1 ring-emerald-500/30'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <div className="font-bold text-xs flex items-center justify-between">
                <span>Layout « Karaoké » (2 Colonnes)</span>
                {displaySettings.displayLayout === 'karaoke' && <Check className="w-4 h-4 text-emerald-400" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Pochette à gauche, paroles défilantes à droite, sobre, épuré et ultra lisible.
              </p>
            </button>

            <button
              onClick={() => setDisplaySettings((p) => ({ ...p, displayLayout: 'immersive' }))}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                displaySettings.displayLayout === 'immersive'
                  ? 'border-sky-500 bg-sky-950/20 text-white ring-1 ring-sky-500/30'
                  : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              <div className="font-bold text-xs flex items-center justify-between">
                <span>Layout « Immersif » (Couleur Dominante)</span>
                {displaySettings.displayLayout === 'immersive' && <Check className="w-4 h-4 text-sky-400" />}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Fond dégradé flou extrait de la pochette avec ColorThief, pochette centrale et ambiance grand spectacle.
              </p>
            </button>
          </div>
        </div>

        {/* Options de tailles & vitesses */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Taille des paroles */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
              <Type className="w-4 h-4" />
              <span>Taille des paroles :</span>
            </label>
            <select
              value={displaySettings.lyricsFontSize}
              onChange={(e) => setDisplaySettings((p) => ({ ...p, lyricsFontSize: e.target.value as any }))}
              className="w-full p-2.5 rounded-xl border text-xs font-bold outline-none"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                color: 'var(--kairo-text-primary, #ffffff)',
              }}
            >
              <option value="small">Petite</option>
              <option value="medium">Moyenne</option>
              <option value="large">Grande (défaut)</option>
              <option value="xlarge">Très grande</option>
            </select>
          </div>

          {/* Taille de la pochette */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
              <Maximize className="w-4 h-4" />
              <span>Taille de la jaquette :</span>
            </label>
            <select
              value={displaySettings.coverSize}
              onChange={(e) => setDisplaySettings((p) => ({ ...p, coverSize: e.target.value as any }))}
              className="w-full p-2.5 rounded-xl border text-xs font-bold outline-none"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                color: 'var(--kairo-text-primary, #ffffff)',
              }}
            >
              <option value="small">Petite</option>
              <option value="medium">Moyenne (défaut)</option>
              <option value="large">Grande</option>
            </select>
          </div>

          {/* Vitesse de transition */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
              <FastForward className="w-4 h-4" />
              <span>Vitesse de transition :</span>
            </label>
            <select
              value={displaySettings.transitionSpeed}
              onChange={(e) => setDisplaySettings((p) => ({ ...p, transitionSpeed: e.target.value as any }))}
              className="w-full p-2.5 rounded-xl border text-xs font-bold outline-none"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                color: 'var(--kairo-text-primary, #ffffff)',
              }}
            >
              <option value="instant">Instantanée</option>
              <option value="fast">Rapide</option>
              <option value="smooth">Fluide (défaut)</option>
            </select>
          </div>
        </div>

        {/* Toggles graphiques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {/* Rotation vinyle */}
          <button
            onClick={() => setDisplaySettings((p) => ({ ...p, vinylRotation: !p.vinylRotation }))}
            className="flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left cursor-pointer transition-all"
            style={{
              borderColor: 'var(--kairo-border-color, #334155)',
              backgroundColor: 'var(--kairo-bg-secondary, #111827)',
            }}
          >
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-emerald-400" />
              <span>Rotation vinyle</span>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: displaySettings.vinylRotation ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: displaySettings.vinylRotation ? 'var(--kairo-accent-primary, #10b981)' : '#64748b',
              }}
            >
              {displaySettings.vinylRotation ? 'Activé' : 'Désactivé'}
            </span>
          </button>

          {/* Fond flou couleur pochette */}
          <button
            onClick={() => setDisplaySettings((p) => ({ ...p, blurBackground: !p.blurBackground }))}
            className="flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left cursor-pointer transition-all"
            style={{
              borderColor: 'var(--kairo-border-color, #334155)',
              backgroundColor: 'var(--kairo-bg-secondary, #111827)',
            }}
          >
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Fond flou couleur dominante</span>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: displaySettings.blurBackground ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: displaySettings.blurBackground ? 'var(--kairo-accent-primary, #10b981)' : '#64748b',
              }}
            >
              {displaySettings.blurBackground ? 'Activé' : 'Désactivé'}
            </span>
          </button>

          {/* Contrôles de lecture */}
          <button
            onClick={() => setDisplaySettings((p) => ({ ...p, showControls: !p.showControls }))}
            className="flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left cursor-pointer transition-all"
            style={{
              borderColor: 'var(--kairo-border-color, #334155)',
              backgroundColor: 'var(--kairo-bg-secondary, #111827)',
            }}
          >
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-purple-400" />
              <span>Contrôles play/pause/skip</span>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: displaySettings.showControls ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: displaySettings.showControls ? 'var(--kairo-accent-primary, #10b981)' : '#64748b',
              }}
            >
              {displaySettings.showControls ? 'Activé' : 'Désactivé'}
            </span>
          </button>

          {/* Barre de progression */}
          <button
            onClick={() => setDisplaySettings((p) => ({ ...p, showProgressBar: !p.showProgressBar }))}
            className="flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left cursor-pointer transition-all"
            style={{
              borderColor: 'var(--kairo-border-color, #334155)',
              backgroundColor: 'var(--kairo-bg-secondary, #111827)',
            }}
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              <span>Barre de progression</span>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: displaySettings.showProgressBar ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: displaySettings.showProgressBar ? 'var(--kairo-accent-primary, #10b981)' : '#64748b',
              }}
            >
              {displaySettings.showProgressBar ? 'Activé' : 'Désactivé'}
            </span>
          </button>

          {/* Nom de la playlist */}
          <button
            onClick={() => setDisplaySettings((p) => ({ ...p, showPlaylistName: !p.showPlaylistName }))}
            className="flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left cursor-pointer transition-all"
            style={{
              borderColor: 'var(--kairo-border-color, #334155)',
              backgroundColor: 'var(--kairo-bg-secondary, #111827)',
            }}
          >
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-rose-400" />
              <span>Nom de la playlist</span>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: displaySettings.showPlaylistName ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: displaySettings.showPlaylistName ? 'var(--kairo-accent-primary, #10b981)' : '#64748b',
              }}
            >
              {displaySettings.showPlaylistName ? 'Activé' : 'Désactivé'}
            </span>
          </button>

          {/* Luminosité overlay slider */}
          <div
            className="p-3.5 rounded-2xl border space-y-1.5"
            style={{
              borderColor: 'var(--kairo-border-color, #334155)',
              backgroundColor: 'var(--kairo-bg-secondary, #111827)',
            }}
          >
            <div className="flex justify-between text-xs font-bold">
              <span>Luminosité du fond :</span>
              <span className="font-mono">{displaySettings.overlayBrightness}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={displaySettings.overlayBrightness}
              onChange={(e) =>
                setDisplaySettings((p) => ({
                  ...p,
                  overlayBrightness: Math.max(10, Math.min(100, parseInt(e.target.value, 10))),
                }))
              }
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3 : AUTHENTIFICATION & DIAGNOSTIC SPOTIFY                         */}
      {/* ========================================================================= */}
      <div
        className="p-6 rounded-3xl border space-y-5 mb-8 shadow-xl"
        style={{
          borderColor: 'var(--kairo-border-color, #334155)',
          backgroundColor: 'var(--kairo-bg-card, #1e293b)',
        }}
      >
        <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--kairo-border-color, #334155)' }}>
          <Activity className="w-5 h-5 text-sky-400" />
          <h2 className="text-sm font-black uppercase tracking-wider">
            Authentification & Console Diagnostic API
          </h2>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
              Token d'accès Spotify (Access Token) :
            </label>
            <input
              type="password"
              value={spotifyToken}
              onChange={(e) => setSpotifyToken(e.target.value)}
              placeholder="BQ..."
              className="w-full p-2.5 rounded-xl border text-xs font-mono outline-none"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                color: 'var(--kairo-text-primary, #ffffff)',
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <button
              onClick={() => runApiTest('user')}
              disabled={testingKey === 'user'}
              className="p-3 rounded-xl border text-left cursor-pointer transition-all disabled:opacity-50"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <div className="font-bold text-xs">1. Tester Profil Spotify</div>
              <div className="text-[10px] text-slate-500">/v1/me</div>
            </button>

            <button
              onClick={() => runApiTest('devices')}
              disabled={testingKey === 'devices'}
              className="p-3 rounded-xl border text-left cursor-pointer transition-all disabled:opacity-50"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <div className="font-bold text-xs">2. Tester Enceintes</div>
              <div className="text-[10px] text-slate-500">/v1/me/player/devices</div>
            </button>

            <button
              onClick={() => runApiTest('player')}
              disabled={testingKey === 'player'}
              className="p-3 rounded-xl border text-left cursor-pointer transition-all disabled:opacity-50"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <div className="font-bold text-xs">3. Tester Lecteur</div>
              <div className="text-[10px] text-slate-500">/v1/me/player</div>
            </button>

            <button
              onClick={() => runApiTest('lyrics')}
              disabled={testingKey === 'lyrics'}
              className="p-3 rounded-xl border text-left cursor-pointer transition-all disabled:opacity-50"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <div className="font-bold text-xs">4. Tester Paroles LRCLIB</div>
              <div className="text-[10px] text-slate-500">lrclib.net</div>
            </button>
          </div>

          {/* Diagnostic results */}
          {Object.keys(testResults).length > 0 && (
            <div
              className="space-y-2 p-3 rounded-2xl border"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
              }}
            >
              {Object.entries(testResults).map(([k, res]) => (
                <div key={k} className="text-xs font-mono flex items-start gap-2">
                  {res.status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold">{res.apiName} : </span>
                    <span className="opacity-90">{res.message}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
