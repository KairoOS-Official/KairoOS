import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Speaker,
  Layout,
  Type,
  Maximize,
  RotateCw,
  FastForward,
  Plus,
  Gamepad2,
  ListMusic,
  Disc,
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
type SettingsTab = 'mode' | 'layout' | 'cover' | 'lyrics' | 'controls' | 'diagnostics';

const STORAGE_KEY = 'kairo_spotify_settings_v5';
const FAVORITES_STORAGE_KEY = 'kairo_spotify_favorites_v1';
const CUSTOM_DEVICES_KEY = 'kairo_spotify_custom_devices_v1';

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

const parseBool = (v: any, fallback = false): boolean => {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
    if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  }
  return Boolean(v);
};

export default function App() {
  const { theme, isDark } = useKairoTheme();

  // Onglet actif dans la page des réglages
  const [activeTab, setActiveTab] = useState<SettingsTab>('mode');

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

  // Appareils personnalisés ajoutés par l'utilisateur
  const [customDevices, setCustomDevices] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_DEVICES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newDeviceInput, setNewDeviceInput] = useState<string>('');
  const [addDeviceNotice, setAddDeviceNotice] = useState<string | null>(null);

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
    lyricsAlignment: 'left',
    coverSize: 'medium',
    vinylRotation: true,
    vinylSpeed: 'normal',
    blurBackground: true,
    blurIntensity: 30,
    showControls: true,
    showProgressBar: true,
    showPlaylistName: true,
    showAlbumName: true,
    showDeviceBadge: true,
    showGamepadHints: true,
    transitionSpeed: 'smooth',
    lyricsHighlightColor: 'accent',
    lyricsGlow: true,
    lyricsUnderline: false,
    lyricsActiveScale: true,
    lyricsLinesBefore: -1,
    lyricsLinesAfter: -1,
  });

  // Appareils détectés sur le réseau Spotify + personnalisés
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
  const lastActivityRef = useRef<number>(Date.now());
  const isManualFullscreenRef = useRef<boolean>(false);
  const [isFullscreenManual, setIsFullscreenManual] = useState<boolean>(false);

  const setVisualMode = useCallback((mode: 'fullscreen' | 'minimized' | 'hidden', manual = false) => {
    const isMan = mode === 'fullscreen' && manual;
    isManualFullscreenRef.current = isMan;
    setIsFullscreenManual(isMan);
    setViewMode(mode);
  }, []);

  // Références d'interpolation haute fréquence (50ms) pour une synchronisation fluide des paroles à 60fps
  const baseProgressRef = useRef<number>(0);
  const baseTimeRef = useRef<number>(performance.now());
  const isPlayingRef = useRef<boolean>(false);

  // Synchronisation autoritaire de l'état de lecture
  const syncTrackProgress = useCallback((liveTrack: SpotifyTrack) => {
    setCurrentTrack(liveTrack);
    baseProgressRef.current = liveTrack.progressMs || 0;
    baseTimeRef.current = performance.now();
    isPlayingRef.current = Boolean(liveTrack.isPlaying);
    setIsPlayingAudio(Boolean(liveTrack.isPlaying));
    setProgressMs(liveTrack.progressMs || 0);
  }, []);

  // Détection robuste et stricte si la lecture s'effectue sur la borne (Web Playback SDK)
  const isBornePlayback = useCallback(
    (track: SpotifyTrack | null) => {
      if (!track) return false;
      // 1. Appareil Web Playback SDK officiel de la borne
      if (track.deviceId === 'web-playback-device') return true;
      if (webPlaybackDeviceId && track.deviceId === webPlaybackDeviceId) return true;

      // 2. Nom spécifique de la borne configuré par l'utilisateur
      const name = (track.deviceName || '').toLowerCase().trim();
      const cleanBorne = (borneDeviceName || '').toLowerCase().trim().replace(/ï/g, 'i');
      if (cleanBorne && cleanBorne.length >= 3) {
        const cleanName = name.replace(/ï/g, 'i');
        if (cleanName === cleanBorne || cleanName.includes(cleanBorne)) {
          return true;
        }
      }

      // 3. Nom de l'OS Kaïro
      return Boolean(
        name &&
          (name.includes('borne kaïro') ||
            name.includes('borne kairo') ||
            name.includes('kairoos') ||
            name.includes('kairo-borne'))
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
    } catch (_) {
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
          if (injected.selected_device) setSelectedDevice(injected.selected_device);
          if (injected.spotify_device_name) setBorneDeviceName(injected.spotify_device_name);
          if (injected.idle_timeout_seconds) setIdleTimeoutSeconds(injected.idle_timeout_seconds);
          if (injected.spotify_access_token) setSpotifyToken(injected.spotify_access_token);
          if (injected.spotify_refresh_token) setSpotifyRefreshToken(injected.spotify_refresh_token);
          if (injected.spotify_client_id) setSpotifyClientId(injected.spotify_client_id);
          if (injected.spotify_token_expires_at) setSpotifyTokenExpiresAt(Number(injected.spotify_token_expires_at));
          setDisplaySettings((prev) => ({
            ...prev,
            showCover: injected.show_cover !== undefined ? parseBool(injected.show_cover, prev.showCover) : prev.showCover,
            showLyrics: injected.show_lyrics !== undefined ? parseBool(injected.show_lyrics, prev.showLyrics) : prev.showLyrics,
            overlayBrightness: Math.max(10, Math.min(100, injected.overlay_brightness ?? prev.overlayBrightness)),
            displayLayout: injected.display_layout ?? prev.displayLayout,
            lyricsFontSize: injected.lyrics_font_size ?? prev.lyricsFontSize,
            lyricsAlignment: injected.lyrics_alignment ?? prev.lyricsAlignment,
            coverSize: injected.cover_size || injected.coverSize || prev.coverSize,
            vinylRotation: injected.vinyl_rotation !== undefined ? parseBool(injected.vinyl_rotation, prev.vinylRotation) : prev.vinylRotation,
            vinylSpeed: injected.vinyl_speed ?? prev.vinylSpeed,
            blurBackground: injected.blur_background !== undefined ? parseBool(injected.blur_background, prev.blurBackground) : prev.blurBackground,
            blurIntensity: injected.blur_intensity !== undefined ? Number(injected.blur_intensity) : prev.blurIntensity,
            showControls: injected.show_controls !== undefined ? parseBool(injected.show_controls, prev.showControls) : prev.showControls,
            showProgressBar: injected.show_progress_bar !== undefined ? parseBool(injected.show_progress_bar, prev.showProgressBar) : prev.showProgressBar,
            showPlaylistName: injected.show_playlist_name !== undefined ? parseBool(injected.show_playlist_name, prev.showPlaylistName) : prev.showPlaylistName,
            showAlbumName: injected.show_album_name !== undefined ? parseBool(injected.show_album_name, prev.showAlbumName) : prev.showAlbumName,
            showDeviceBadge: injected.show_device_badge !== undefined ? parseBool(injected.show_device_badge, prev.showDeviceBadge) : prev.showDeviceBadge,
            showGamepadHints: injected.show_gamepad_hints !== undefined ? parseBool(injected.show_gamepad_hints, prev.showGamepadHints) : prev.showGamepadHints,
            transitionSpeed: injected.transition_speed ?? prev.transitionSpeed,
            lyricsHighlightColor: injected.lyrics_highlight_color ?? prev.lyricsHighlightColor,
            lyricsGlow: injected.lyrics_glow !== undefined ? parseBool(injected.lyrics_glow, prev.lyricsGlow) : prev.lyricsGlow,
            lyricsUnderline: injected.lyrics_underline !== undefined ? parseBool(injected.lyrics_underline, false) : (injected.lyricsUnderline !== undefined ? parseBool(injected.lyricsUnderline, false) : prev.lyricsUnderline),
            lyricsActiveScale: injected.lyrics_active_scale !== undefined ? parseBool(injected.lyrics_active_scale, true) : prev.lyricsActiveScale,
            lyricsLinesBefore: injected.lyrics_lines_before !== undefined ? Number(injected.lyrics_lines_before) : prev.lyricsLinesBefore,
            lyricsLinesAfter: injected.lyrics_lines_after !== undefined ? Number(injected.lyrics_lines_after) : prev.lyricsLinesAfter,
          }));
          loaded = true;
        }
      } catch (urlErr) {
        console.warn('[Spotify Plugin] Erreur parsing URL settings:', urlErr);
      }

      for (const key of [STORAGE_KEY, 'kairo_spotify_settings_v5', 'kairo_spotify_settings_v4', 'kairo_spotify_settings_v3']) {
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
              if (detail.settings.selected_device) setSelectedDevice(detail.settings.selected_device);
              if (detail.settings.spotify_device_name) setBorneDeviceName(detail.settings.spotify_device_name);
              if (detail.settings.idle_timeout_seconds) setIdleTimeoutSeconds(detail.settings.idle_timeout_seconds);
              setDisplaySettings((prev) => ({
                ...prev,
                showCover: detail.settings.show_cover !== undefined ? parseBool(detail.settings.show_cover, prev.showCover) : prev.showCover,
                showLyrics: detail.settings.show_lyrics !== undefined ? parseBool(detail.settings.show_lyrics, prev.showLyrics) : prev.showLyrics,
                overlayBrightness: detail.settings.overlay_brightness ?? prev.overlayBrightness,
                displayLayout: detail.settings.display_layout ?? prev.displayLayout,
                lyricsFontSize: detail.settings.lyrics_font_size ?? prev.lyricsFontSize,
                lyricsAlignment: detail.settings.lyrics_alignment ?? prev.lyricsAlignment,
                coverSize: detail.settings.cover_size || detail.settings.coverSize || prev.coverSize,
                vinylRotation: detail.settings.vinyl_rotation !== undefined ? parseBool(detail.settings.vinyl_rotation, prev.vinylRotation) : prev.vinylRotation,
                vinylSpeed: detail.settings.vinyl_speed ?? prev.vinylSpeed,
                blurBackground: detail.settings.blur_background !== undefined ? parseBool(detail.settings.blur_background, prev.blurBackground) : prev.blurBackground,
                blurIntensity: detail.settings.blur_intensity !== undefined ? Number(detail.settings.blur_intensity) : prev.blurIntensity,
                showControls: detail.settings.show_controls !== undefined ? parseBool(detail.settings.show_controls, prev.showControls) : prev.showControls,
                showProgressBar: detail.settings.show_progress_bar !== undefined ? parseBool(detail.settings.show_progress_bar, prev.showProgressBar) : prev.showProgressBar,
                showPlaylistName: detail.settings.show_playlist_name !== undefined ? parseBool(detail.settings.show_playlist_name, prev.showPlaylistName) : prev.showPlaylistName,
                showAlbumName: detail.settings.show_album_name !== undefined ? parseBool(detail.settings.show_album_name, prev.showAlbumName) : prev.showAlbumName,
                showDeviceBadge: detail.settings.show_device_badge !== undefined ? parseBool(detail.settings.show_device_badge, prev.showDeviceBadge) : prev.showDeviceBadge,
                showGamepadHints: detail.settings.show_gamepad_hints !== undefined ? parseBool(detail.settings.show_gamepad_hints, prev.showGamepadHints) : prev.showGamepadHints,
                transitionSpeed: detail.settings.transition_speed ?? prev.transitionSpeed,
                lyricsHighlightColor: detail.settings.lyrics_highlight_color ?? prev.lyricsHighlightColor,
                lyricsGlow: detail.settings.lyrics_glow !== undefined ? parseBool(detail.settings.lyrics_glow, prev.lyricsGlow) : prev.lyricsGlow,
                lyricsUnderline: detail.settings.lyrics_underline !== undefined ? parseBool(detail.settings.lyrics_underline, false) : (detail.settings.lyricsUnderline !== undefined ? parseBool(detail.settings.lyricsUnderline, false) : prev.lyricsUnderline),
                lyricsActiveScale: detail.settings.lyrics_active_scale !== undefined ? parseBool(detail.settings.lyrics_active_scale, true) : prev.lyricsActiveScale,
                lyricsLinesBefore: detail.settings.lyrics_lines_before !== undefined ? Number(detail.settings.lyrics_lines_before) : prev.lyricsLinesBefore,
                lyricsLinesAfter: detail.settings.lyrics_lines_after !== undefined ? Number(detail.settings.lyrics_lines_after) : prev.lyricsLinesAfter,
              }));
            }
            setSpotifyToken((prev) => prev || detail.settings.spotify_access_token || '');
            if (detail.settings.spotify_refresh_token) setSpotifyRefreshToken(detail.settings.spotify_refresh_token);
            if (detail.settings.spotify_client_id) setSpotifyClientId(detail.settings.spotify_client_id);
            if (detail.settings.spotify_token_expires_at) setSpotifyTokenExpiresAt(Number(detail.settings.spotify_token_expires_at));
          }
        }
      } catch (_) {}
    };

    loadConfig();
  }, []);

  // Écoute des messages de l'hôte KaïroOS (Prise en compte des paramètres en temps réel)
  useEffect(() => {
    const handleHostMessage = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'kairo_plugin_init' || e.data.type === 'kairo_update_settings') {
        const s = e.data.settings || {};
        if (s.operation_mode !== undefined) setOperationMode(s.operation_mode);
        if (s.selected_device !== undefined) setSelectedDevice(s.selected_device);
        if (s.target_speaker !== undefined && !s.selected_device) setSelectedDevice(s.target_speaker);
        if (s.spotify_device_name !== undefined) setBorneDeviceName(s.spotify_device_name);
        if (s.idle_timeout_seconds !== undefined) setIdleTimeoutSeconds(Number(s.idle_timeout_seconds));
        if (s.spotify_access_token !== undefined) setSpotifyToken(s.spotify_access_token);
        if (s.spotify_refresh_token !== undefined) setSpotifyRefreshToken(s.spotify_refresh_token);
        if (s.spotify_client_id !== undefined) setSpotifyClientId(s.spotify_client_id);
        if (Array.isArray(s.custom_devices)) setCustomDevices(s.custom_devices);

        setDisplaySettings((prev) => {
          const updated = {
            ...prev,
            showCover: s.show_cover !== undefined ? parseBool(s.show_cover, prev.showCover) : prev.showCover,
            showLyrics: s.show_lyrics !== undefined ? parseBool(s.show_lyrics, prev.showLyrics) : prev.showLyrics,
            overlayBrightness: s.overlay_brightness !== undefined ? Number(s.overlay_brightness) : prev.overlayBrightness,
            displayLayout: s.display_layout || prev.displayLayout,
            lyricsFontSize: s.lyrics_font_size || prev.lyricsFontSize,
            lyricsAlignment: s.lyrics_alignment || prev.lyricsAlignment,
            coverSize: s.cover_size || s.coverSize || prev.coverSize,
            vinylRotation: s.vinyl_rotation !== undefined ? parseBool(s.vinyl_rotation, prev.vinylRotation) : prev.vinylRotation,
            vinylSpeed: s.vinyl_speed || prev.vinylSpeed,
            blurBackground: s.blur_background !== undefined ? parseBool(s.blur_background, prev.blurBackground) : prev.blurBackground,
            blurIntensity: s.blur_intensity !== undefined ? Number(s.blur_intensity) : prev.blurIntensity,
            showControls: s.show_controls !== undefined ? parseBool(s.show_controls, prev.showControls) : prev.showControls,
            showProgressBar: s.show_progress_bar !== undefined ? parseBool(s.show_progress_bar, prev.showProgressBar) : prev.showProgressBar,
            showPlaylistName: s.show_playlist_name !== undefined ? parseBool(s.show_playlist_name, prev.showPlaylistName) : prev.showPlaylistName,
            showAlbumName: s.show_album_name !== undefined ? parseBool(s.show_album_name, prev.showAlbumName) : prev.showAlbumName,
            showDeviceBadge: s.show_device_badge !== undefined ? parseBool(s.show_device_badge, prev.showDeviceBadge) : prev.showDeviceBadge,
            showGamepadHints: s.show_gamepad_hints !== undefined ? parseBool(s.show_gamepad_hints, prev.showGamepadHints) : prev.showGamepadHints,
            transitionSpeed: s.transition_speed || prev.transitionSpeed,
            lyricsHighlightColor: s.lyrics_highlight_color || prev.lyricsHighlightColor,
            lyricsGlow: s.lyrics_glow !== undefined ? parseBool(s.lyrics_glow, prev.lyricsGlow) : prev.lyricsGlow,
            lyricsUnderline: s.lyrics_underline !== undefined ? parseBool(s.lyrics_underline, false) : (s.lyricsUnderline !== undefined ? parseBool(s.lyricsUnderline, false) : prev.lyricsUnderline),
            lyricsActiveScale: s.lyrics_active_scale !== undefined ? parseBool(s.lyrics_active_scale, true) : prev.lyricsActiveScale,
            lyricsLinesBefore: s.lyrics_lines_before !== undefined ? Number(s.lyrics_lines_before) : prev.lyricsLinesBefore,
            lyricsLinesAfter: s.lyrics_lines_after !== undefined ? Number(s.lyrics_lines_after) : prev.lyricsLinesAfter,
          };
          try {
            const currentSaved = localStorage.getItem(STORAGE_KEY);
            const parsed = currentSaved ? JSON.parse(currentSaved) : {};
            parsed.displaySettings = updated;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          } catch (_) {}
          return updated;
        });
      } else if (e.data.type === 'kairo_set_view_mode') {
        if (e.data.mode === 'fullscreen' || e.data.mode === 'minimized' || e.data.mode === 'hidden') {
          setVisualMode(e.data.mode, Boolean(e.data.manual));
        }
      } else if (e.data.type === 'kairo_toggle_player') {
        setVisualMode(viewMode === 'fullscreen' ? 'minimized' : 'fullscreen', true);
      } else if (e.data.type === 'kairo_activity') {
        lastActivityRef.current = Date.now();
        setIdleSeconds(0);
        // Si veille automatique (pas manuelle) : tout mouvement/bouton quitte vers minimisé
        if (viewMode === 'fullscreen' && !isManualFullscreenRef.current) {
          setVisualMode('minimized', false);
        }
      } else if (e.data.type === 'dismiss_screensaver') {
        lastActivityRef.current = Date.now();
        setIdleSeconds(0);
        setVisualMode('minimized', false);
      }
    };

    window.addEventListener('message', handleHostMessage);
    return () => window.removeEventListener('message', handleHostMessage);
  }, [viewMode, setVisualMode]);


  // Synchronisation de l'état du screensaver vers KaïroOS
  useEffect(() => {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'screensaver_view_mode',
            mode: viewMode,
            active: viewMode !== 'hidden',
            manual: isFullscreenManual,
            pluginId: 'kairo-spotify-screensaver',
          },
          '*'
        );
      }
    } catch (_) {}
  }, [viewMode, isFullscreenManual]);

  // Sauvegarde automatique et persistante en direct dès modification
  const isInitialPluginMountRef = useRef(true);
  const autoSaveTimerRef = useRef<any>(null);

  const performAutoSave = useCallback(async () => {
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
            selected_device: selectedDevice,
            target_speaker: selectedDevice,
            spotify_device_name: borneDeviceName,
            idle_timeout_seconds: idleTimeoutSeconds,
            show_cover: displaySettings.showCover,
            show_lyrics: displaySettings.showLyrics,
            overlay_brightness: displaySettings.overlayBrightness,
            display_layout: displaySettings.displayLayout,
            lyrics_font_size: displaySettings.lyricsFontSize,
            lyrics_alignment: displaySettings.lyricsAlignment,
            cover_size: displaySettings.coverSize,
            coverSize: displaySettings.coverSize,
            vinyl_rotation: displaySettings.vinylRotation,
            vinyl_speed: displaySettings.vinylSpeed,
            blur_background: displaySettings.blurBackground,
            blur_intensity: displaySettings.blurIntensity,
            show_controls: displaySettings.showControls,
            show_progress_bar: displaySettings.showProgressBar,
            show_playlist_name: displaySettings.showPlaylistName,
            show_album_name: displaySettings.showAlbumName,
            show_device_badge: displaySettings.showDeviceBadge,
            show_gamepad_hints: displaySettings.showGamepadHints,
            transition_speed: displaySettings.transitionSpeed,
            lyrics_highlight_color: displaySettings.lyricsHighlightColor,
            lyrics_glow: displaySettings.lyricsGlow,
            lyrics_underline: displaySettings.lyricsUnderline,
            lyrics_active_scale: displaySettings.lyricsActiveScale,
            lyrics_lines_before: displaySettings.lyricsLinesBefore,
            lyrics_lines_after: displaySettings.lyricsLinesAfter,
            spotify_access_token: spotifyToken,
            custom_devices: customDevices,
            ...(spotifyRefreshToken ? { spotify_refresh_token: spotifyRefreshToken } : {}),
            ...(spotifyClientId ? { spotify_client_id: spotifyClientId } : {}),
            ...(spotifyTokenExpiresAt ? { spotify_token_expires_at: spotifyTokenExpiresAt } : {}),
          },
        }).catch(() => {});
      }
    } catch (_) {}
  }, [
    operationMode,
    selectedDevice,
    borneDeviceName,
    idleTimeoutSeconds,
    displaySettings,
    spotifyToken,
    spotifyRefreshToken,
    spotifyClientId,
    spotifyTokenExpiresAt,
    customDevices,
  ]);

  // Sauvegarde sur événement : déclenchée uniquement lors d'une modification utilisateur
  const isUserInteractingRef = useRef(false);

  const saveOnUserEvent = useCallback(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      if (isUserInteractingRef.current) {
        performAutoSave();
        isUserInteractingRef.current = false;
      }
    }, 200);
  }, [performAutoSave]);

  // Ajout manuel d'une enceinte externe (résolution explicite du "bouton ajouter")
  const handleAddCustomDevice = () => {
    const trimmed = newDeviceInput.trim();
    if (!trimmed) return;
    let updated = customDevices;
    if (!customDevices.includes(trimmed)) {
      updated = [...customDevices, trimmed];
      setCustomDevices(updated);
      try {
        localStorage.setItem(CUSTOM_DEVICES_KEY, JSON.stringify(updated));
      } catch (_) {}
    }
    setSelectedDevice(trimmed);
    setNewDeviceInput('');
    setAddDeviceNotice(`✓ Enceinte « ${trimmed} » ajoutée et sélectionnée pour la surveillance !`);
    setTimeout(() => setAddDeviceNotice(null), 3500);

    try {
      const tauriInvoke =
        (window as any).__TAURI__?.core?.invoke ||
        (window.parent as any)?.__TAURI__?.core?.invoke;
      if (tauriInvoke) {
        tauriInvoke('update_plugin_settings', {
          id: 'kairo-spotify-screensaver',
          settings: {
            selected_device: trimmed,
            target_speaker: trimmed,
            custom_devices: updated,
          },
        }).catch(() => {});
      }
    } catch (_) {}
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
      const ms = Math.floor(audio.currentTime * 1000);
      baseProgressRef.current = ms;
      baseTimeRef.current = performance.now();
      isPlayingRef.current = !audio.paused;
      setProgressMs(ms);
    };

    audio.onended = () => {
      isPlayingRef.current = false;
      setIsPlayingAudio(false);
      setProgressMs(0);
      setCurrentTrack((prev) => (prev ? { ...prev, isPlaying: false } : null));
    };

    audio.onpause = () => {
      isPlayingRef.current = false;
      setIsPlayingAudio(false);
      setCurrentTrack((prev) => (prev ? { ...prev, isPlaying: false } : null));
    };

    audio.onplay = () => {
      isPlayingRef.current = true;
      baseTimeRef.current = performance.now();
      setIsPlayingAudio(true);
      setCurrentTrack((prev) => (prev ? { ...prev, isPlaying: true } : null));
    };

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // Interpolation locale haute fréquence (50ms) du temps de lecture
  // Supprime les sauts de lignes et assure une synchronisation fluide et continue des paroles
  useEffect(() => {
    const ticker = setInterval(() => {
      if (isPlayingRef.current && currentTrack?.durationMs) {
        const elapsed = performance.now() - baseTimeRef.current;
        const estimated = Math.min(
          currentTrack.durationMs,
          Math.round(baseProgressRef.current + elapsed)
        );
        setProgressMs(estimated);
      }
    }, 50);

    return () => clearInterval(ticker);
  }, [currentTrack?.durationMs]);

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
        syncTrackProgress(liveTrack);
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
  }, [spotifyToken, borneDeviceName, spotifyClientId, spotifyRefreshToken, spotifyTokenExpiresAt, tokenAnalysis.status, syncTrackProgress]);

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
            syncTrackProgress(liveTrack);
          }
        }
      } catch (_) {}
    };

    fetchSpotifyData();
    const interval = setInterval(
      fetchSpotifyData,
      spotifyToken && currentTrack?.isPlaying ? 1500 : 4000
    );

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [spotifyToken, spotifyClientId, spotifyRefreshToken, spotifyTokenExpiresAt, tokenAnalysis.status, currentTrack?.isPlaying, syncTrackProgress]);

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

  // Vérification de l'état favori pour le morceau actuel (API + cache local)
  useEffect(() => {
    if (!currentTrack?.id) {
      setIsFavorite(false);
      return;
    }
    // 1. Vérification locale immédiate
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const favList: string[] = saved ? JSON.parse(saved) : [];
      if (favList.includes(currentTrack.id)) {
        setIsFavorite(true);
        return;
      }
    } catch (_) {}

    // 2. Vérification API si token disponible
    if (spotifyToken) {
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

  // Gestion robuste de l'ajout aux favoris (persistance locale garantie + sync API)
  const handleToggleFavorite = async () => {
    const trackId = currentTrack?.id || 'current-song';
    const nextState = !isFavorite;
    setIsFavorite(nextState);

    // 1. Sauvegarde locale persistante instantanée
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      let favList: string[] = saved ? JSON.parse(saved) : [];
      if (nextState) {
        if (!favList.includes(trackId)) favList.push(trackId);
      } else {
        favList = favList.filter((id) => id !== trackId);
      }
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favList));
    } catch (_) {}

    // 2. Appel API Spotify si token présent
    if (spotifyToken && currentTrack?.id && !currentTrack.id.startsWith('demo-')) {
      toggleFavoriteTrack(currentTrack.id, spotifyToken, isFavorite).catch(() => {});
    }
  };

  const handleToggleShuffle = async () => {
    const nextShuffle = await spotifyToggleShuffle(spotifyToken, isShuffle);
    setIsShuffle(nextShuffle);
  };

  // Détection d'activité utilisateur (mise à jour du chronomètre d'inactivité)
  useEffect(() => {
    const onUserActivity = () => {
      lastActivityRef.current = Date.now();
      setIdleSeconds(0);

      // Si maximisé AUTOMATIQUEMENT pour la veille (et pas manuellement) :
      // N'importe quel mouvement ou bouton quitte immédiatement pour revenir en minimisé !
      if (viewMode === 'fullscreen' && !isManualFullscreenRef.current) {
        console.log('⚡ [Spotify Plugin] Activité détectée en veille auto -> retour en minimisé');
        setVisualMode('minimized', false);
      }
    };

    window.addEventListener('keydown', onUserActivity, { capture: true, passive: true });
    window.addEventListener('pointerdown', onUserActivity, { capture: true, passive: true });
    window.addEventListener('mousedown', onUserActivity, { capture: true, passive: true });
    window.addEventListener('mousemove', onUserActivity, { capture: true, passive: true });
    window.addEventListener('wheel', onUserActivity, { capture: true, passive: true });
    window.addEventListener('touchstart', onUserActivity, { capture: true, passive: true });

    // Polling continu des manettes branchées (mouvement sticks ou appui touches)
    const gamepadInterval = setInterval(() => {
      const gamepads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
      for (const gp of gamepads) {
        if (!gp) continue;
        const buttonPressed = gp.buttons.some((b) => b.pressed);
        const stickMoved = gp.axes.some((a) => Math.abs(a) > 0.15);
        if (buttonPressed || stickMoved) {
          onUserActivity();
          break;
        }
      }
    }, 60);

    return () => {
      window.removeEventListener('keydown', onUserActivity, { capture: true });
      window.removeEventListener('pointerdown', onUserActivity, { capture: true });
      window.removeEventListener('mousedown', onUserActivity, { capture: true });
      window.removeEventListener('mousemove', onUserActivity, { capture: true });
      window.removeEventListener('wheel', onUserActivity, { capture: true });
      window.removeEventListener('touchstart', onUserActivity, { capture: true });
      clearInterval(gamepadInterval);
    };
  }, [viewMode, setVisualMode]);

  // =========================================================================
  // LOGIQUE UNIFIÉE DU MODE HYBRIDE :
  // - État par défaut : l'affichage doit toujours être minimisé lorsque de la musique est jouée sur l'enceinte ou sur la borne.
  // - Passage en mode maximisé : uniquement si l'appareil reste en veille plus longtemps que la durée définie pour le mode veille.
  // - Détection de mouvement : immédiatement revenir en mode minimisé.
  // - Si joué sur une autre enceinte pas sélectionnée : ON AFFICHE RIEN (hidden)
  // =========================================================================
  useEffect(() => {
    const interval = setInterval(() => {
      const isPlaying = Boolean(currentTrack?.isPlaying);
      const trackDevName = (currentTrack?.deviceName || '').trim().toLowerCase();
      const targetDevName = (selectedDevice || '').trim().toLowerCase();
      const isBorne = isBornePlayback(currentTrack);

      const isTargetSpeaker = Boolean(
        targetDevName && (
          trackDevName === targetDevName ||
          currentTrack?.deviceId === selectedDevice ||
          (targetDevName.length >= 3 && trackDevName.includes(targetDevName)) ||
          (trackDevName.length >= 3 && targetDevName.includes(trackDevName))
        )
      );

      // Soit sur la borne, soit sur l'enceinte sélectionnée
      const isAuthorizedDevice = isBorne || isTargetSpeaker;
      const isAuthorizedPlaying = Boolean(isPlaying && currentTrack && isAuthorizedDevice);

      // CAS 1 : Joué sur la borne OU sur l'enceinte sélectionnée
      if (isAuthorizedPlaying) {
        const now = Date.now();
        const currentIdle = Math.floor((now - lastActivityRef.current) / 1000);
        setIdleSeconds(currentIdle);

        // État par défaut : si masqué au démarrage, passer en minimisé
        if (viewMode === 'hidden') {
          console.log('🎵 [Spotify Plugin] Musique démarrée sur borne ou enceinte -> Minimisé');
          setVisualMode('minimized', false);
        } else if (viewMode === 'minimized' && currentIdle >= idleTimeoutSeconds) {
          // Passage en mode maximisé automatique si l'appareil reste en veille
          console.log(`🌙 [Spotify Plugin] Veille (${currentIdle}s >= ${idleTimeoutSeconds}s) -> Maximisé auto`);
          setVisualMode('fullscreen', false);
        }
        // Persistance : si l'utilisateur est en mode maximisé (fullscreen), il y reste tant qu'il ne choisit pas d'en sortir !
        return;
      }

      // CAS 2 : Joué sur une autre enceinte pas sélectionnée (ex: PC, mobile) OU musique arrêtée
      // RÈGLE : on affiche rien
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      setIdleSeconds(0);
      if (viewMode !== 'hidden') {
        console.log('🔇 [Spotify Plugin] Autre enceinte ou arrêt -> On affiche rien (hidden)');
        setVisualMode('hidden', false);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [currentTrack, isBornePlayback, selectedDevice, viewMode, idleTimeoutSeconds, setVisualMode]);

  // Liste combinée des appareils disponibles + custom
  const allSelectableDevices = useMemo(() => {
    const devNames = new Set(availableDevices.map((d) => d.name));
    const combined: Array<{ id: string; name: string; type: string; is_custom?: boolean }> = [
      ...availableDevices,
    ];
    for (const c of customDevices) {
      if (!devNames.has(c)) {
        combined.push({ id: `custom-${c}`, name: c, type: 'Enceinte Personnalisée', is_custom: true });
      }
    }
    return combined;
  }, [availableDevices, customDevices]);

  // 1. Vue Plein Écran (ScreensaverView)
  if (viewMode === 'fullscreen') {
    return (
      <ScreensaverView
        track={currentTrack}
        lyrics={lyrics}
        currentProgressMs={progressMs}
        displaySettings={displaySettings}
        isBornePlaying={isBornePlayback(currentTrack)}
        isManual={isFullscreenManual}
        onMinimize={() => setVisualMode('minimized', false)}
        onExit={() => {
          const isPlaying = Boolean(currentTrack?.isPlaying);
          const trackDevName = (currentTrack?.deviceName || '').trim().toLowerCase();
          const targetDevName = (selectedDevice || '').trim().toLowerCase();
          const isBorne = isBornePlayback(currentTrack);
          const isTargetSpeaker = Boolean(
            targetDevName && (
              trackDevName === targetDevName ||
              currentTrack?.deviceId === selectedDevice ||
              (targetDevName.length >= 3 && trackDevName.includes(targetDevName)) ||
              (trackDevName.length >= 3 && targetDevName.includes(trackDevName))
            )
          );
          const isAuthorizedPlaying = Boolean(isPlaying && currentTrack && (isBorne || isTargetSpeaker));
          setVisualMode(isAuthorizedPlaying ? 'minimized' : 'hidden', false);
          setIdleSeconds(0);
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
          onMaximize={() => setVisualMode('fullscreen', true)}
          onClose={() => {
            setVisualMode('hidden', false);
            if (currentTrack?.id) dismissedTrackIdRef.current = currentTrack.id;
          }}
          isDemo={Boolean(spotifyToken && tokenAnalysis.status !== 'valid_format')}
          onTogglePlay={handleTogglePlay}
          onNext={handleNext}
        />
      </div>
    );
  }

  // 3. Vue Cachée ou en Attente de Lecture
  return (
    <div
      onInputCapture={() => {
        isUserInteractingRef.current = true;
        saveOnUserEvent();
      }}
      onClickCapture={() => {
        isUserInteractingRef.current = true;
        saveOnUserEvent();
      }}
      className="min-h-screen p-8 select-none transition-colors duration-300"
      style={{
        backgroundColor: 'var(--kairo-bg-primary, #0f172a)',
        color: 'var(--kairo-text-primary, #ffffff)',
      }}
    >
      {/* En-tête Principal */}
      <header className="flex items-center justify-between pb-6 mb-8 border-b" style={{ borderColor: 'var(--kairo-border-color, #334155)' }}>
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--kairo-accent-primary, #10b981)',
            }}
          >
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Configuration Spotify KaïroOS</h1>
            <p className="text-xs text-slate-400">Mode Hybride Unifié • Écran de veille karaoké dynamique</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border shadow-sm"
            style={{
              borderColor: 'rgba(16, 185, 129, 0.3)',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--kairo-accent-primary, #10b981)',
            }}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Sauvegarde auto active</span>
          </div>

          <button
            onClick={() => {
              dismissedTrackIdRef.current = '';
              setVisualMode('fullscreen', true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs shadow-lg active:scale-95 transition-all cursor-pointer"
            style={{
              borderColor: 'var(--kairo-border-color, #334155)',
              backgroundColor: 'var(--kairo-bg-card, #1e293b)',
              color: 'var(--kairo-text-primary, #ffffff)',
            }}
          >
            <Eye className="w-4 h-4" style={{ color: 'var(--kairo-accent-primary, #10b981)' }} />
            <span>Tester l'Écran</span>
          </button>
        </div>
      </header>

      {/* Barre d'onglets ergonomique */}
      <nav
        className="flex items-center gap-1.5 p-1.5 rounded-2xl border mb-6 overflow-x-auto"
        style={{
          borderColor: 'var(--kairo-border-color, #334155)',
          backgroundColor: 'var(--kairo-bg-card, #1e293b)',
        }}
      >
        <button
          onClick={() => setActiveTab('mode')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'mode'
              ? 'bg-[var(--kairo-accent-primary,#10b981)] text-slate-950 shadow-sm'
              : 'text-[var(--kairo-text-secondary,#94a1b2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <Speaker className="w-4 h-4" />
          <span>Mode & Enceintes</span>
        </button>

        <button
          onClick={() => setActiveTab('layout')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'layout'
              ? 'bg-[var(--kairo-accent-primary,#10b981)] text-slate-950 shadow-sm'
              : 'text-[var(--kairo-text-secondary,#94a1b2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <Layout className="w-4 h-4" />
          <span>Layout & Thème</span>
        </button>

        <button
          onClick={() => setActiveTab('cover')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'cover'
              ? 'bg-[var(--kairo-accent-primary,#10b981)] text-slate-950 shadow-sm'
              : 'text-[var(--kairo-text-secondary,#94a1b2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <Disc className="w-4 h-4" />
          <span>Pochette & Vinyle</span>
        </button>

        <button
          onClick={() => setActiveTab('lyrics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'lyrics'
              ? 'bg-[var(--kairo-accent-primary,#10b981)] text-slate-950 shadow-sm'
              : 'text-[var(--kairo-text-secondary,#94a1b2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <Type className="w-4 h-4" />
          <span>Paroles & Typo</span>
        </button>

        <button
          onClick={() => setActiveTab('controls')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'controls'
              ? 'bg-[var(--kairo-accent-primary,#10b981)] text-slate-950 shadow-sm'
              : 'text-[var(--kairo-text-secondary,#94a1b2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Affichage & Contrôles</span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'diagnostics'
              ? 'bg-[var(--kairo-accent-primary,#10b981)] text-slate-950 shadow-sm'
              : 'text-[var(--kairo-text-secondary,#94a1b2)] hover:text-white hover:bg-white/5'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Connexion & Diagnostic</span>
        </button>
      </nav>

      {/* Notification Toast */}
      {saveSuccessNotice && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>✓ Paramètres enregistrés et synchronisés avec succès.</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 1 : MODE & ENCEINTES                                              */}
      {/* ========================================================================= */}
      {activeTab === 'mode' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Bannière Mode Hybride */}
          <div
            className="p-5 rounded-3xl border space-y-3"
            style={{
              borderColor: 'var(--kairo-accent-primary, #10b981)',
              backgroundColor: 'var(--kairo-bg-card, #1e293b)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Mode Hybride Unifié Actif (Gestion Automatique)</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                100% Intelligent
              </span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
              Les deux modes fonctionnent <strong>simultanément</strong> : si vous lancez la musique sur la borne (« {borneDeviceName} »), elle s'ouvre immédiatement. Si la musique tourne sur votre enceinte surveillée (« {selectedDevice} ») et que vous ne touchez pas à la borne, la veille s'affiche.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Colonne Gauche : Sélection et Ajout d'Enceintes */}
            <div
              className="md:col-span-7 p-6 rounded-3xl border space-y-4 shadow-xl"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-card, #1e293b)',
              }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--kairo-border-color, #334155)' }}>
                <div className="flex items-center gap-2 text-xs font-black uppercase">
                  <Speaker className="w-4 h-4 text-sky-400" />
                  <span>Enceinte Externe Surveillée</span>
                </div>
                <span className="text-[10px] font-mono text-sky-400">Règle exclusive</span>
              </div>

              <div className="p-3 rounded-2xl bg-sky-950/20 border border-sky-500/30 text-xs text-sky-200">
                <strong>Filtre strict actif :</strong> Si la musique joue sur une enceinte différente de celle sélectionnée ci-dessous, la borne <strong>ne l'affichera pas</strong>.
              </div>

              {/* Formulaire d'ajout d'une enceinte personnalisée (BOUTON AJOUTER FONCTIONNEL) */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
                  Ajouter une enceinte manuellement :
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newDeviceInput}
                    onChange={(e) => setNewDeviceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCustomDevice();
                    }}
                    placeholder="Ex: Echo Salon, Barre de son TV, Sonos..."
                    className="flex-1 p-2.5 rounded-xl border text-xs font-bold outline-none"
                    style={{
                      borderColor: 'var(--kairo-border-color, #334155)',
                      backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                      color: 'var(--kairo-text-primary, #ffffff)',
                    }}
                  />
                  <button
                    onClick={handleAddCustomDevice}
                    disabled={!newDeviceInput.trim()}
                    className="px-4 py-2.5 rounded-xl font-bold text-xs bg-sky-600 hover:bg-sky-500 text-white transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-40"
                    title="Ajouter l'enceinte à la liste"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter</span>
                  </button>
                </div>
                {addDeviceNotice && (
                  <p className="text-xs text-emerald-400 font-bold animate-fadeIn">{addDeviceNotice}</p>
                )}
              </div>

              {/* Liste des enceintes sélectionnables */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {allSelectableDevices.map((dev) => {
                  const isSelected = selectedDevice.trim().toLowerCase() === dev.name.trim().toLowerCase();
                  return (
                    <button
                      key={dev.id}
                      onClick={() => setSelectedDevice(dev.name)}
                      className={`w-full flex items-center justify-between p-3 rounded-2xl border text-xs text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-950/30 text-white font-bold ring-1 ring-emerald-500/30'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Radio className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-600'}`} />
                        <div>
                          <div className="font-bold">{dev.name}</div>
                          <div className="text-[10px] text-slate-500">{dev.type}</div>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                          Sélectionnée
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Colonne Droite : Temporisation & Nom Borne */}
            <div
              className="md:col-span-5 p-6 rounded-3xl border space-y-5 shadow-xl"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-card, #1e293b)',
              }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--kairo-border-color, #334155)' }}>
                <div className="flex items-center gap-2 text-xs font-black uppercase">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span>Délai d'Inactivité</span>
                </div>
                <span className="text-purple-400 font-mono font-bold text-xs">
                  {idleTimeoutSeconds}s
                </span>
              </div>

              <div className="space-y-2">
                <input
                  type="range"
                  min="10"
                  max="300"
                  step="5"
                  value={idleTimeoutSeconds}
                  onChange={(e) => setIdleTimeoutSeconds(Math.max(10, parseInt(e.target.value, 10)))}
                  className="w-full accent-purple-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>10s (rapide)</span>
                  <span>30s (défaut)</span>
                  <span>5 min (arcade)</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-1 text-xs">
                <div className="text-slate-400">Compteur d'inactivité actuel :</div>
                <div className="text-lg font-black font-mono text-purple-400">{idleSeconds}s / {idleTimeoutSeconds}s</div>
                <p className="text-[10px] text-slate-500">
                  Toute manipulation manette ou clavier réinitialise immédiatement ce délai à 0.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="text-xs font-bold" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
                  Nom de la borne (Spotify Connect) :
                </label>
                <input
                  type="text"
                  value={borneDeviceName}
                  onChange={(e) => setBorneDeviceName(e.target.value)}
                  className="w-full p-2.5 rounded-xl border text-xs font-bold outline-none"
                  style={{
                    borderColor: 'var(--kairo-border-color, #334155)',
                    backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                    color: 'var(--kairo-text-primary, #ffffff)',
                  }}
                  placeholder="Borne Kaïro"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : LAYOUT & THÈME                                                */}
      {/* ========================================================================= */}
      {activeTab === 'layout' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Choix du Layout visuel */}
          <div
            className="p-6 rounded-3xl border space-y-4 shadow-xl"
            style={{
              borderColor: 'var(--kairo-border-color, #334155)',
              backgroundColor: 'var(--kairo-bg-card, #1e293b)',
            }}
          >
            <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--kairo-border-color, #334155)' }}>
              <Layout className="w-5 h-5 text-sky-400" />
              <h2 className="text-sm font-black uppercase tracking-wider">
                Disposition de l'Écran (display_layout)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setDisplaySettings((p) => ({ ...p, displayLayout: 'karaoke' }))}
                className={`p-5 rounded-3xl border-2 text-left transition-all cursor-pointer space-y-2 ${
                  displaySettings.displayLayout === 'karaoke'
                    ? 'border-emerald-500 bg-emerald-950/20 text-white ring-2 ring-emerald-500/30'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm">Layout « Karaoké » (2 Colonnes)</span>
                  {displaySettings.displayLayout === 'karaoke' && <Check className="w-5 h-5 text-emerald-400" />}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Disposition classique : pochette vinyle à gauche avec temps et contrôles, grand texte des paroles à droite défilant verticalement avec centrage automatique.
                </p>
              </button>

              <button
                onClick={() => setDisplaySettings((p) => ({ ...p, displayLayout: 'immersive' }))}
                className={`p-5 rounded-3xl border-2 text-left transition-all cursor-pointer space-y-2 ${
                  displaySettings.displayLayout === 'immersive'
                    ? 'border-sky-500 bg-sky-950/20 text-white ring-2 ring-sky-500/30'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-sm">Layout « Immersif » (Now Playing)</span>
                  {displaySettings.displayLayout === 'immersive' && <Check className="w-5 h-5 text-sky-400" />}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Fond dynamique flou extrait de la pochette avec ColorThief, pochette centrale majestueuse avec ombre lumineuse, gros titre en gras et ambiance musicale immersive.
                </p>
              </button>
            </div>
          </div>

          {/* Réglages Fond & Flou */}
          <div
            className="p-6 rounded-3xl border space-y-4 shadow-xl"
            style={{
              borderColor: 'var(--kairo-border-color, #334155)',
              backgroundColor: 'var(--kairo-bg-card, #1e293b)',
            }}
          >
            <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--kairo-border-color, #334155)' }}>
              <Sun className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-black uppercase tracking-wider">
                Ambiance d'Arrière-Plan & Luminosité
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setDisplaySettings((p) => ({ ...p, blurBackground: !p.blurBackground }))}
                className="flex items-center justify-between p-4 rounded-2xl border text-xs text-left cursor-pointer transition-all"
                style={{
                  borderColor: 'var(--kairo-border-color, #334155)',
                  backgroundColor: 'var(--kairo-bg-secondary, #111827)',
                }}
              >
                <div>
                  <div className="font-bold">Fond flou couleur pochette</div>
                  <div className="text-[10px] text-slate-500">Extraction ColorThief en temps réel</div>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: displaySettings.blurBackground ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: displaySettings.blurBackground ? 'var(--kairo-accent-primary, #10b981)' : '#64748b',
                  }}
                >
                  {displaySettings.blurBackground ? 'Activé' : 'Désactivé'}
                </span>
              </button>

              <div
                className="p-4 rounded-2xl border space-y-2"
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

              <div
                className={`p-4 rounded-2xl border space-y-2 ${!displaySettings.blurBackground ? 'opacity-40 pointer-events-none' : ''}`}
                style={{
                  borderColor: 'var(--kairo-border-color, #334155)',
                  backgroundColor: 'var(--kairo-bg-secondary, #111827)',
                }}
              >
                <div className="flex justify-between text-xs font-bold">
                  <span>Intensité du flou :</span>
                  <span className="font-mono">{displaySettings.blurIntensity}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="2"
                  disabled={!displaySettings.blurBackground}
                  value={displaySettings.blurIntensity}
                  onChange={(e) =>
                    setDisplaySettings((p) => ({
                      ...p,
                      blurIntensity: parseInt(e.target.value, 10),
                    }))
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 3 : POCHETTE & VINYLE                                             */}
      {/* ========================================================================= */}
      {activeTab === 'cover' && (
        <div className="p-6 rounded-3xl border space-y-6 shadow-xl animate-fadeIn"
          style={{
            borderColor: 'var(--kairo-border-color, #334155)',
            backgroundColor: 'var(--kairo-bg-card, #1e293b)',
          }}
        >
          <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--kairo-border-color, #334155)' }}>
            <Disc className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-black uppercase tracking-wider">
              Jaquette & Animation Vinyle
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <option value="medium">Moyenne (standard)</option>
                <option value="large">Grande (arcade)</option>
              </select>
            </div>

            {/* Vitesse vinyle */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
                <RotateCw className="w-4 h-4" />
                <span>Vitesse de rotation vinyle :</span>
              </label>
              <select
                value={displaySettings.vinylSpeed}
                onChange={(e) => setDisplaySettings((p) => ({ ...p, vinylSpeed: e.target.value as any }))}
                className="w-full p-2.5 rounded-xl border text-xs font-bold outline-none"
                style={{
                  borderColor: 'var(--kairo-border-color, #334155)',
                  backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                  color: 'var(--kairo-text-primary, #ffffff)',
                }}
              >
                <option value="slow">Lente (33T nostalgique)</option>
                <option value="normal">Normale (standard)</option>
                <option value="fast">Rapide (dynamique)</option>
              </select>
            </div>

            {/* Afficher album */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
                <Music className="w-4 h-4" />
                <span>Nom de l'album :</span>
              </label>
              <button
                onClick={() => setDisplaySettings((p) => ({ ...p, showAlbumName: !p.showAlbumName }))}
                className="w-full p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between"
                style={{
                  borderColor: 'var(--kairo-border-color, #334155)',
                  backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                }}
              >
                <span>Sous le titre</span>
                <span className={displaySettings.showAlbumName ? 'text-emerald-400' : 'text-slate-500'}>
                  {displaySettings.showAlbumName ? 'Affiché' : 'Masqué'}
                </span>
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setDisplaySettings((p) => ({ ...p, vinylRotation: !p.vinylRotation }))}
              className="flex items-center justify-between p-4 rounded-2xl border text-xs w-full cursor-pointer transition-all"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <div>
                <div className="font-bold">Effet disque vinyle rotatif 33 Tours</div>
                <div className="text-[10px] text-slate-500">Disque rétro qui sort de la pochette lors de la lecture</div>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: displaySettings.vinylRotation ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: displaySettings.vinylRotation ? 'var(--kairo-accent-primary, #10b981)' : '#64748b',
                }}
              >
                {displaySettings.vinylRotation ? 'Activé' : 'Désactivé'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 4 : PAROLES & TYPO                                                */}
      {/* ========================================================================= */}
      {activeTab === 'lyrics' && (
        <div className="p-6 rounded-3xl border space-y-6 shadow-xl animate-fadeIn"
          style={{
            borderColor: 'var(--kairo-border-color, #334155)',
            backgroundColor: 'var(--kairo-bg-card, #1e293b)',
          }}
        >
          <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--kairo-border-color, #334155)' }}>
            <Type className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-black uppercase tracking-wider">
              Paroles Karaoké & Typographie
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Taille des paroles */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
                Taille du texte :
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
                <option value="large">Grande (recommandé)</option>
                <option value="xlarge">Très grande (arcade éloignée)</option>
              </select>
            </div>

            {/* Alignement des paroles */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
                Alignement du texte :
              </label>
              <select
                value={displaySettings.lyricsAlignment}
                onChange={(e) => setDisplaySettings((p) => ({ ...p, lyricsAlignment: e.target.value as any }))}
                className="w-full p-2.5 rounded-xl border text-xs font-bold outline-none"
                style={{
                  borderColor: 'var(--kairo-border-color, #334155)',
                  backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                  color: 'var(--kairo-text-primary, #ffffff)',
                }}
              >
                <option value="left">À gauche (standard)</option>
                <option value="center">Centré</option>
                <option value="right">À droite</option>
              </select>
            </div>

            {/* Couleur de la ligne active */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
                Couleur de surbrillance :
              </label>
              <select
                value={displaySettings.lyricsHighlightColor}
                onChange={(e) => setDisplaySettings((p) => ({ ...p, lyricsHighlightColor: e.target.value }))}
                className="w-full p-2.5 rounded-xl border text-xs font-bold outline-none"
                style={{
                  borderColor: 'var(--kairo-border-color, #334155)',
                  backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                  color: 'var(--kairo-text-primary, #ffffff)',
                }}
              >
                <option value="accent">Couleur d'accent du thème actif</option>
                <option value="#10b981">Émeraude fluo (#10b981)</option>
                <option value="#38bdf8">Cyan électrique (#38bdf8)</option>
                <option value="#f43f5e">Rose néon (#f43f5e)</option>
                <option value="#fbbf24">Or arcade (#fbbf24)</option>
                <option value="#a855f7">Violet cyber (#a855f7)</option>
              </select>
            </div>

            {/* Lignes affichées avant */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
                Lignes affichées avant :
              </label>
              <select
                value={displaySettings.lyricsLinesBefore}
                onChange={(e) => setDisplaySettings((p) => ({ ...p, lyricsLinesBefore: parseInt(e.target.value, 10) }))}
                className="w-full p-2.5 rounded-xl border text-xs font-bold outline-none"
                style={{
                  borderColor: 'var(--kairo-border-color, #334155)',
                  backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                  color: 'var(--kairo-text-primary, #ffffff)',
                }}
              >
                <option value="-1">Toutes (Défilement complet)</option>
                <option value="0">0 ligne avant (aucune)</option>
                <option value="1">1 ligne avant</option>
                <option value="2">2 lignes avant</option>
                <option value="3">3 lignes avant</option>
                <option value="4">4 lignes avant</option>
                <option value="5">5 lignes avant</option>
              </select>
            </div>

            {/* Lignes affichées après */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
                Lignes affichées après :
              </label>
              <select
                value={displaySettings.lyricsLinesAfter}
                onChange={(e) => setDisplaySettings((p) => ({ ...p, lyricsLinesAfter: parseInt(e.target.value, 10) }))}
                className="w-full p-2.5 rounded-xl border text-xs font-bold outline-none"
                style={{
                  borderColor: 'var(--kairo-border-color, #334155)',
                  backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                  color: 'var(--kairo-text-primary, #ffffff)',
                }}
              >
                <option value="-1">Toutes (Défilement complet)</option>
                <option value="0">0 ligne après (aucune)</option>
                <option value="1">1 ligne après</option>
                <option value="2">2 lignes après</option>
                <option value="3">3 lignes après</option>
                <option value="4">4 lignes après</option>
                <option value="5">5 lignes après</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <button
              onClick={() => setDisplaySettings((p) => ({ ...p, lyricsUnderline: !p.lyricsUnderline }))}
              className="flex items-center justify-between p-4 rounded-2xl border text-xs w-full cursor-pointer transition-all"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <div>
                <div className="font-bold">Souligner parole chantée</div>
                <div className="text-[10px] text-slate-500">Trait de soulignement sous la ligne active</div>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: displaySettings.lyricsUnderline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: displaySettings.lyricsUnderline ? 'var(--kairo-accent-primary, #10b981)' : '#64748b',
                }}
              >
                {displaySettings.lyricsUnderline ? 'Activé' : 'Désactivé'}
              </span>
            </button>

            <button
              onClick={() => setDisplaySettings((p) => ({ ...p, lyricsActiveScale: !p.lyricsActiveScale }))}
              className="flex items-center justify-between p-4 rounded-2xl border text-xs w-full cursor-pointer transition-all"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <div>
                <div className="font-bold">Zoom parole chantée</div>
                <div className="text-[10px] text-slate-500">Grossissement dynamique de la ligne en cours</div>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: displaySettings.lyricsActiveScale ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: displaySettings.lyricsActiveScale ? 'var(--kairo-accent-primary, #10b981)' : '#64748b',
                }}
              >
                {displaySettings.lyricsActiveScale ? 'Activé' : 'Désactivé'}
              </span>
            </button>

            <button
              onClick={() => setDisplaySettings((p) => ({ ...p, lyricsGlow: !p.lyricsGlow }))}
              className="flex items-center justify-between p-4 rounded-2xl border text-xs w-full cursor-pointer transition-all"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <div>
                <div className="font-bold">Effet halo lumineux</div>
                <div className="text-[10px] text-slate-500">Ombre lumineuse sur la ligne active</div>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: displaySettings.lyricsGlow ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  color: displaySettings.lyricsGlow ? 'var(--kairo-accent-primary, #10b981)' : '#64748b',
                }}
              >
                {displaySettings.lyricsGlow ? 'Activé' : 'Désactivé'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 5 : AFFICHAGE & CONTRÔLES                                         */}
      {/* ========================================================================= */}
      {activeTab === 'controls' && (
        <div className="p-6 rounded-3xl border space-y-6 shadow-xl animate-fadeIn"
          style={{
            borderColor: 'var(--kairo-border-color, #334155)',
            backgroundColor: 'var(--kairo-bg-card, #1e293b)',
          }}
        >
          <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--kairo-border-color, #334155)' }}>
            <Sliders className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-black uppercase tracking-wider">
              Contrôles & Éléments d'Interface
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Contrôles play/skip */}
            <button
              onClick={() => setDisplaySettings((p) => ({ ...p, showControls: !p.showControls }))}
              className="flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left cursor-pointer transition-all"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <div>
                <div className="font-bold">Contrôles de lecture</div>
                <div className="text-[10px] text-slate-500">Play, Pause, Suivant, Précédent, Favori</div>
              </div>
              <span className={displaySettings.showControls ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {displaySettings.showControls ? 'Oui' : 'Non'}
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
              <div>
                <div className="font-bold">Barre de progression</div>
                <div className="text-[10px] text-slate-500">Avancement et durée du morceau</div>
              </div>
              <span className={displaySettings.showProgressBar ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {displaySettings.showProgressBar ? 'Oui' : 'Non'}
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
              <div>
                <div className="font-bold">Nom de la playlist</div>
                <div className="text-[10px] text-slate-500">Badge dans l'en-tête</div>
              </div>
              <span className={displaySettings.showPlaylistName ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {displaySettings.showPlaylistName ? 'Oui' : 'Non'}
              </span>
            </button>

            {/* Badge appareil diffuseur */}
            <button
              onClick={() => setDisplaySettings((p) => ({ ...p, showDeviceBadge: !p.showDeviceBadge }))}
              className="flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left cursor-pointer transition-all"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <div>
                <div className="font-bold">Badge diffuseur Spotify</div>
                <div className="text-[10px] text-slate-500">Indique le nom de l'enceinte en haut</div>
              </div>
              <span className={displaySettings.showDeviceBadge ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {displaySettings.showDeviceBadge ? 'Oui' : 'Non'}
              </span>
            </button>

            {/* Raccourcis manette en bas */}
            <button
              onClick={() => setDisplaySettings((p) => ({ ...p, showGamepadHints: !p.showGamepadHints }))}
              className="flex items-center justify-between p-3.5 rounded-2xl border text-xs text-left cursor-pointer transition-all"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <div>
                <div className="font-bold">Aide manette dans le pied</div>
                <div className="text-[10px] text-slate-500">Touches A, Y, D-Pad affichées</div>
              </div>
              <span className={displaySettings.showGamepadHints ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                {displaySettings.showGamepadHints ? 'Oui' : 'Non'}
              </span>
            </button>

            {/* Vitesse de transition */}
            <div
              className="p-3.5 rounded-2xl border space-y-1.5"
              style={{
                borderColor: 'var(--kairo-border-color, #334155)',
                backgroundColor: 'var(--kairo-bg-secondary, #111827)',
              }}
            >
              <div className="text-xs font-bold">Vitesse de transition :</div>
              <select
                value={displaySettings.transitionSpeed}
                onChange={(e) => setDisplaySettings((p) => ({ ...p, transitionSpeed: e.target.value as any }))}
                className="w-full p-1.5 rounded-lg border text-xs font-bold outline-none"
                style={{
                  borderColor: 'var(--kairo-border-color, #334155)',
                  backgroundColor: 'var(--kairo-bg-primary, #0b0f19)',
                  color: 'var(--kairo-text-primary, #ffffff)',
                }}
              >
                <option value="instant">Instantanée</option>
                <option value="fast">Rapide</option>
                <option value="smooth">Fluide (recommandé)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 6 : CONNEXION & DIAGNOSTICS                                       */}
      {/* ========================================================================= */}
      {activeTab === 'diagnostics' && (
        <div className="p-6 rounded-3xl border space-y-6 shadow-xl animate-fadeIn"
          style={{
            borderColor: 'var(--kairo-border-color, #334155)',
            backgroundColor: 'var(--kairo-bg-card, #1e293b)',
          }}
        >
          <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--kairo-border-color, #334155)' }}>
            <Activity className="w-5 h-5 text-sky-400" />
            <h2 className="text-sm font-black uppercase tracking-wider">
              Token Spotify Web API & Diagnostic Technique
            </h2>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold" style={{ color: 'var(--kairo-text-secondary, #94a1b2)' }}>
                Token d'accès Spotify (Access Token OAuth) :
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
                <div className="font-bold text-xs">1. Tester Profil</div>
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
                <div className="font-bold text-xs">4. Tester Paroles</div>
                <div className="text-[10px] text-slate-500">lrclib.net</div>
              </button>
            </div>

            <div className="pt-2">
              <button
                onClick={playAudioChimeTest}
                disabled={playingChime}
                className="py-2.5 px-4 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-500 text-white cursor-pointer transition-all flex items-center gap-2"
              >
                <Volume2 className="w-4 h-4" />
                <span>{playingChime ? 'Test carillon en cours...' : '🔔 Tester les Haut-Parleurs de la Borne'}</span>
              </button>
            </div>

            {/* Résultats diagnostics */}
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
      )}
    </div>
  );
}
