import React, { useState, useEffect } from 'react';
import {
  Radio,
  Clock,
  Music,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Save,
  Check,
  RefreshCw,
  Speaker,
  Play,
  AlignLeft,
  Image as ImageIcon,
  Sun,
  ShieldCheck,
  Zap,
  ClipboardCopy,
  HelpCircle,
  BookOpen,
  Sparkles,
  Plus,
  Trash2,
  Layout,
  Type,
  Palette,
  Disc,
} from 'lucide-react';
import {
  openExternalUrl,
  generateCodeVerifier,
  buildSpotifyPkceAuthUrl,
  exchangeCodeForTokens,
  refreshSpotifyToken,
  extractSpotifyAuthData,
} from '../../../utils';

interface SpotifySettingsSectionProps {
  settings: Record<string, any>;
  onSave: (newSettings: Record<string, any>) => Promise<void>;
  saving?: boolean;
}

interface TestFeedback {
  status: 'idle' | 'loading' | 'success' | 'warning' | 'error';
  message: string;
  devices?: Array<{ id: string; name: string; type: string; is_active: boolean }>;
}

// Extraction automatique intelligente d'un jeton Spotify (depuis jeton brut, URL complète avec #access_token=..., ou JSON)
function extractSpotifyToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Cas 1 : URL avec paramètre hash access_token=...
  const matchHash = trimmed.match(/access_token=([^&]+)/);
  if (matchHash && matchHash[1]) {
    return decodeURIComponent(matchHash[1]);
  }

  // Cas 2 : JSON { "access_token": "..." }
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.access_token && typeof parsed.access_token === 'string') {
      return parsed.access_token.trim();
    }
  } catch {}

  // Cas 3 : Recherche de motif BQ... (longueur Spotify typique > 50 car.)
  const matchBq = trimmed.match(/(BQ[A-Za-z0-9_-]{50,})/);
  if (matchBq && matchBq[1]) {
    return matchBq[1];
  }

  // Si l'utilisateur colle directement une chaîne
  if (trimmed.startsWith('BQ') && trimmed.length > 30) {
    return trimmed;
  }

  return trimmed;
}

export const SpotifySettingsSection: React.FC<SpotifySettingsSectionProps> = ({
  settings: initialSettings,
  onSave,
  saving = false,
}) => {
  // Configuration Mode 1 (Borne Directe)
  const [deviceName, setDeviceName] = useState<string>(
    initialSettings.spotify_device_name || 'Borne Kaïro'
  );
  const [token, setToken] = useState<string>(initialSettings.spotify_access_token || '');
  const [showSecret, setShowSecret] = useState<boolean>(false);

  // Assistant Connexion Rapide
  const [showFastConnect, setShowFastConnect] = useState<boolean>(false);
  const [clientId, setClientId] = useState<string>(
    initialSettings.spotify_client_id || '744337ebc86048fc9d3ac3cdffd82aef'
  );
  const [fastConnectFeedback, setFastConnectFeedback] = useState<string | null>(null);
  const [showTokenGuide, setShowTokenGuide] = useState<boolean>(false);
  const [browserNotice, setBrowserNotice] = useState<string | null>(null);

  // Gestion PKCE & Refresh Token
  const [refreshToken, setRefreshToken] = useState<string>(
    initialSettings.spotify_refresh_token || ''
  );
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number>(
    initialSettings.spotify_token_expires_at || 0
  );
  const [authCodeInput, setAuthCodeInput] = useState<string>('');
  const [isExchangingCode, setIsExchangingCode] = useState<boolean>(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState<boolean>(false);

  // Surveillance Enceinte Externe
  const [targetSpeaker, setTargetSpeaker] = useState<string>(
    initialSettings.selected_device || initialSettings.target_speaker || 'HP-Bureau'
  );
  const [idleTimeout, setIdleTimeout] = useState<number>(
    initialSettings.idle_timeout_seconds !== undefined ? initialSettings.idle_timeout_seconds : 30
  );

  // Appareils personnalisés (Bouton Ajouter fonctionnel)
  const [customDevices, setCustomDevices] = useState<string[]>(() => {
    if (Array.isArray(initialSettings.custom_devices) && initialSettings.custom_devices.length > 0) {
      return initialSettings.custom_devices;
    }
    const initialTarget = initialSettings.selected_device || initialSettings.target_speaker || 'HP-Bureau';
    return Array.from(new Set([initialTarget, 'HP-Bureau', 'Echo Salon', 'Barre de Son TV']));
  });
  const [newDeviceInput, setNewDeviceInput] = useState<string>('');
  const [addDeviceNotice, setAddDeviceNotice] = useState<string | null>(null);

  // Paramètres UI & Layout enrichis
  const [displayLayout, setDisplayLayout] = useState<'karaoke' | 'immersive'>(
    initialSettings.display_layout === 'immersive' ? 'immersive' : 'karaoke'
  );
  const [lyricsFontSize, setLyricsFontSize] = useState<'small' | 'medium' | 'large' | 'xlarge'>(
    initialSettings.lyrics_font_size || 'large'
  );
  const [lyricsAlignment, setLyricsAlignment] = useState<'left' | 'center' | 'right'>(
    initialSettings.lyrics_alignment || 'left'
  );
  const [lyricsHighlightColor, setLyricsHighlightColor] = useState<string>(
    initialSettings.lyrics_highlight_color || 'accent'
  );
  const [lyricsGlow, setLyricsGlow] = useState<boolean>(
    initialSettings.lyrics_glow !== undefined ? Boolean(initialSettings.lyrics_glow) : true
  );
  const [coverSize, setCoverSize] = useState<'small' | 'medium' | 'large'>(
    initialSettings.cover_size || 'medium'
  );
  const [vinylRotation, setVinylRotation] = useState<boolean>(
    initialSettings.vinyl_rotation !== undefined ? Boolean(initialSettings.vinyl_rotation) : true
  );
  const [vinylSpeed, setVinylSpeed] = useState<'slow' | 'normal' | 'fast'>(
    initialSettings.vinyl_speed || 'normal'
  );
  const [blurBackground, setBlurBackground] = useState<boolean>(
    initialSettings.blur_background !== undefined ? Boolean(initialSettings.blur_background) : true
  );
  const [blurIntensity, setBlurIntensity] = useState<number>(
    initialSettings.blur_intensity !== undefined ? initialSettings.blur_intensity : 30
  );
  const [showControls, setShowControls] = useState<boolean>(
    initialSettings.show_controls !== undefined ? Boolean(initialSettings.show_controls) : true
  );
  const [showProgressBar, setShowProgressBar] = useState<boolean>(
    initialSettings.show_progress_bar !== undefined ? Boolean(initialSettings.show_progress_bar) : true
  );
  const [showPlaylistName, setShowPlaylistName] = useState<boolean>(
    initialSettings.show_playlist_name !== undefined ? Boolean(initialSettings.show_playlist_name) : true
  );
  const [showAlbumName, setShowAlbumName] = useState<boolean>(
    initialSettings.show_album_name !== undefined ? Boolean(initialSettings.show_album_name) : true
  );
  const [showDeviceBadge, setShowDeviceBadge] = useState<boolean>(
    initialSettings.show_device_badge !== undefined ? Boolean(initialSettings.show_device_badge) : true
  );
  const [showGamepadHints, setShowGamepadHints] = useState<boolean>(
    initialSettings.show_gamepad_hints !== undefined ? Boolean(initialSettings.show_gamepad_hints) : true
  );
  const [transitionSpeed, setTransitionSpeed] = useState<'instant' | 'fast' | 'smooth'>(
    initialSettings.transition_speed || 'smooth'
  );

  // Paramètres Communs (Affichage)
  const [pluginEnabled, setPluginEnabled] = useState<boolean>(
    initialSettings.enabled !== undefined ? Boolean(initialSettings.enabled) : true
  );
  const [showCover, setShowCover] = useState<boolean>(
    initialSettings.show_cover !== undefined ? Boolean(initialSettings.show_cover) : true
  );
  const [showLyrics, setShowLyrics] = useState<boolean>(
    initialSettings.show_lyrics !== undefined ? Boolean(initialSettings.show_lyrics) : true
  );
  const [overlayBrightness, setOverlayBrightness] = useState<number>(
    initialSettings.overlay_brightness !== undefined ? initialSettings.overlay_brightness : 80
  );

  // États de tests d'API en direct
  const [userTest, setUserTest] = useState<TestFeedback>({ status: 'idle', message: '' });
  const [playerTest, setPlayerTest] = useState<TestFeedback>({ status: 'idle', message: '' });
  const [devicesTest, setDevicesTest] = useState<TestFeedback>({ status: 'idle', message: '' });
  const [lyricsTest, setLyricsTest] = useState<TestFeedback>({ status: 'idle', message: '' });

  // Confirmation visuelle de sauvegarde
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Mettre à jour si les props initialSettings changent
  useEffect(() => {
    if (initialSettings.spotify_device_name !== undefined) setDeviceName(initialSettings.spotify_device_name);
    if (initialSettings.spotify_access_token !== undefined) setToken(initialSettings.spotify_access_token);
    if (initialSettings.spotify_client_id !== undefined) setClientId(initialSettings.spotify_client_id);
    if (initialSettings.spotify_refresh_token !== undefined) setRefreshToken(initialSettings.spotify_refresh_token);
    if (initialSettings.spotify_token_expires_at !== undefined) setTokenExpiresAt(initialSettings.spotify_token_expires_at);
    if (initialSettings.selected_device !== undefined) setTargetSpeaker(initialSettings.selected_device);
    else if (initialSettings.target_speaker !== undefined) setTargetSpeaker(initialSettings.target_speaker);
    if (initialSettings.idle_timeout_seconds !== undefined) setIdleTimeout(initialSettings.idle_timeout_seconds);
    if (Array.isArray(initialSettings.custom_devices)) setCustomDevices(initialSettings.custom_devices);
    if (initialSettings.enabled !== undefined) setPluginEnabled(Boolean(initialSettings.enabled));
    if (initialSettings.show_cover !== undefined) setShowCover(Boolean(initialSettings.show_cover));
    if (initialSettings.show_lyrics !== undefined) setShowLyrics(Boolean(initialSettings.show_lyrics));
    if (initialSettings.overlay_brightness !== undefined) setOverlayBrightness(initialSettings.overlay_brightness);
    if (initialSettings.display_layout !== undefined) setDisplayLayout(initialSettings.display_layout);
    if (initialSettings.lyrics_font_size !== undefined) setLyricsFontSize(initialSettings.lyrics_font_size);
    if (initialSettings.lyrics_alignment !== undefined) setLyricsAlignment(initialSettings.lyrics_alignment);
    if (initialSettings.lyrics_highlight_color !== undefined) setLyricsHighlightColor(initialSettings.lyrics_highlight_color);
    if (initialSettings.lyrics_glow !== undefined) setLyricsGlow(Boolean(initialSettings.lyrics_glow));
    if (initialSettings.cover_size !== undefined) setCoverSize(initialSettings.cover_size);
    if (initialSettings.vinyl_rotation !== undefined) setVinylRotation(Boolean(initialSettings.vinyl_rotation));
    if (initialSettings.vinyl_speed !== undefined) setVinylSpeed(initialSettings.vinyl_speed);
    if (initialSettings.blur_background !== undefined) setBlurBackground(Boolean(initialSettings.blur_background));
    if (initialSettings.blur_intensity !== undefined) setBlurIntensity(initialSettings.blur_intensity);
    if (initialSettings.show_controls !== undefined) setShowControls(Boolean(initialSettings.show_controls));
    if (initialSettings.show_progress_bar !== undefined) setShowProgressBar(Boolean(initialSettings.show_progress_bar));
    if (initialSettings.show_playlist_name !== undefined) setShowPlaylistName(Boolean(initialSettings.show_playlist_name));
    if (initialSettings.show_album_name !== undefined) setShowAlbumName(Boolean(initialSettings.show_album_name));
    if (initialSettings.show_device_badge !== undefined) setShowDeviceBadge(Boolean(initialSettings.show_device_badge));
    if (initialSettings.show_gamepad_hints !== undefined) setShowGamepadHints(Boolean(initialSettings.show_gamepad_hints));
    if (initialSettings.transition_speed !== undefined) setTransitionSpeed(initialSettings.transition_speed);
  }, [initialSettings]);

  // Détection automatique d'erreur de jeton (Client ID vs Access Token)
  const isClientId = token.trim().length === 32 && !token.startsWith('BQ');

  const handleOpenLink = async (url: string, label: string) => {
    try {
      const opened = await openExternalUrl(url);
      if (opened) {
        setBrowserNotice(`Lien ouvert dans votre navigateur (${label}) !`);
      } else {
        setBrowserNotice('Impossible d\'ouvrir directement le navigateur. Utilisez le bouton Copier.');
      }
      setTimeout(() => setBrowserNotice(null), 5000);
    } catch (e) {
      setBrowserNotice('Erreur lors de l\'ouverture.');
      setTimeout(() => setBrowserNotice(null), 5000);
    }
  };

  // Ajout manuel d'une enceinte (Bouton Ajouter fonctionnel)
  const handleAddCustomDevice = () => {
    const trimmed = newDeviceInput.trim();
    if (!trimmed) return;
    let updated = customDevices;
    if (!customDevices.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      updated = [...customDevices, trimmed];
      setCustomDevices(updated);
    }
    setTargetSpeaker(trimmed);
    setNewDeviceInput('');
    setAddDeviceNotice(`✓ Enceinte « ${trimmed} » ajoutée et sélectionnée !`);
    setTimeout(() => setAddDeviceNotice(null), 3500);
  };

  const handleRemoveCustomDevice = (deviceNameToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customDevices.filter((d) => d !== deviceNameToRemove);
    setCustomDevices(updated);
    if (targetSpeaker === deviceNameToRemove) {
      setTargetSpeaker(updated[0] || 'HP-Bureau');
    }
  };

  // Gestion de la saisie du token avec extraction automatique
  const handleTokenChange = (val: string) => {
    const extracted = extractSpotifyToken(val) || val;
    setToken(extracted);
  };

  // Coller depuis le presse-papier avec extraction automatique
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        const extracted = extractSpotifyToken(clipText);
        if (extracted) {
          setToken(extracted);
          setFastConnectFeedback(`✓ Jeton extrait et inséré depuis le presse-papier (${extracted.length} caractères) !`);
          setTimeout(() => setFastConnectFeedback(null), 4000);
        } else {
          setFastConnectFeedback('Le texte du presse-papier ne contient pas de jeton Spotify valide.');
        }
      }
    } catch (err) {
      console.warn('Erreur lecture presse-papier:', err);
    }
  };

  // Lancer la connexion rapide OAuth Spotify (Authorization Code Flow with PKCE)
  const handleLaunchFastConnect = async () => {
    const cleanId = clientId.trim() || '744337ebc86048fc9d3ac3cdffd82aef';
    const redirectUri = 'https://developer.spotify.com/dashboard';

    // 1. Generer un code_verifier cryptographique securise et stocker dans le cache local
    const verifier = generateCodeVerifier();
    localStorage.setItem('kairo_spotify_pkce_verifier', verifier);
    localStorage.setItem('kairo_spotify_pkce_client_id', cleanId);
    localStorage.setItem('kairo_spotify_pkce_redirect_uri', redirectUri);

    try {
      // 2. Construire l'URL avec response_type=code et code_challenge SHA-256
      const authUrl = await buildSpotifyPkceAuthUrl(cleanId, redirectUri, verifier);
      await openExternalUrl(authUrl);
      setFastConnectFeedback(
        'Page d\'autorisation Spotify (PKCE) ouverte dans votre navigateur ! Cliquez sur « Accepter », puis copiez l\'URL de retour et collez-la à l\'Étape 2 ci-dessous.'
      );
    } catch (err: any) {
      console.error('Erreur lancement PKCE:', err);
      setFastConnectFeedback(`Erreur lors du lancement PKCE : ${err.message || String(err)}`);
    }
  };

  // Traiter et echanger un code d'autorisation Spotify contre des jetons
  const handleProcessAndExchangeCode = async (rawInput: string) => {
    const cleanInput = rawInput.trim();
    if (!cleanInput) {
      setFastConnectFeedback('Veuillez renseigner l\'URL de retour ou le code.');
      return;
    }

    const data = extractSpotifyAuthData(cleanInput);

    if (data.type === 'code' && data.code) {
      const verifier = localStorage.getItem('kairo_spotify_pkce_verifier');
      const savedClientId = localStorage.getItem('kairo_spotify_pkce_client_id') || clientId.trim();
      const redirectUri = localStorage.getItem('kairo_spotify_pkce_redirect_uri') || 'https://developer.spotify.com/dashboard';

      if (!verifier) {
        setFastConnectFeedback(
          'Code détecté, mais aucun vérificateur PKCE trouvé en session. Veuillez d\'abord cliquer sur « 1. Lancer Connexion (PKCE) ».'
        );
        return;
      }

      setIsExchangingCode(true);
      setFastConnectFeedback('Échange sécurisé du code avec Spotify (/api/token)...');

      try {
        const tokens = await exchangeCodeForTokens(savedClientId, data.code, verifier, redirectUri);
        setToken(tokens.accessToken);
        if (tokens.refreshToken) {
          setRefreshToken(tokens.refreshToken);
        }
        setTokenExpiresAt(tokens.expiresAt);
        setAuthCodeInput('');

        // Sauvegarder immediatement
        await onSave({
          ...initialSettings,
          spotify_access_token: tokens.accessToken,
          spotify_refresh_token: tokens.refreshToken || refreshToken,
          spotify_client_id: savedClientId,
          spotify_token_expires_at: tokens.expiresAt,
        });

        const expStr = new Date(tokens.expiresAt).toLocaleTimeString();
        setFastConnectFeedback(
          `✅ Connexion PKCE réussie ! Access Token et Refresh Token enregistrés (valide jusqu\'à ${expStr}, renouvellement automatique permanent activé).`
        );
        setTimeout(() => setFastConnectFeedback(null), 8000);
      } catch (err: any) {
        console.error('Erreur echange code PKCE:', err);
        setFastConnectFeedback(`❌ Échec de l\'échange de code : ${err.message || String(err)}`);
      } finally {
        setIsExchangingCode(false);
      }
      return;
    }

    if (data.type === 'access_token' && data.accessToken) {
      setToken(data.accessToken);
      await onSave({
        ...initialSettings,
        spotify_access_token: data.accessToken,
      });
      setFastConnectFeedback(`✓ Access Token direct configuré (${data.accessToken.length} car.). Note: expire dans 1h sans Refresh Token.`);
      setTimeout(() => setFastConnectFeedback(null), 5000);
      return;
    }

    if (data.type === 'json' && data.accessToken) {
      setToken(data.accessToken);
      if (data.refreshToken) setRefreshToken(data.refreshToken);
      await onSave({
        ...initialSettings,
        spotify_access_token: data.accessToken,
        spotify_refresh_token: data.refreshToken || refreshToken,
      });
      setFastConnectFeedback('✓ Tokens extraits du JSON et sauvegardés !');
      setTimeout(() => setFastConnectFeedback(null), 5000);
      return;
    }

    setFastConnectFeedback('Texte non reconnu. Veuillez copier l\'URL complète de votre navigateur après avoir accepté sur Spotify.');
  };

  // Coller depuis le presse-papier avec detection intelligente PKCE
  const handleSmartPaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        setAuthCodeInput(clipText);
        await handleProcessAndExchangeCode(clipText);
      }
    } catch (err) {
      console.warn('Erreur lecture presse-papier:', err);
    }
  };

  // Test du renouvellement manuel du Refresh Token
  const handleTestRefreshToken = async () => {
    if (!refreshToken.trim()) {
      setFastConnectFeedback('Aucun Refresh Token enregistré pour effectuer le test.');
      return;
    }

    const cleanId = clientId.trim() || '744337ebc86048fc9d3ac3cdffd82aef';
    setIsRefreshingToken(true);
    setFastConnectFeedback('Test du renouvellement automatique auprès de Spotify (/api/token)...');

    try {
      const refreshed = await refreshSpotifyToken(cleanId, refreshToken);
      setToken(refreshed.accessToken);
      if (refreshed.refreshToken) setRefreshToken(refreshed.refreshToken);
      setTokenExpiresAt(refreshed.expiresAt);

      await onSave({
        ...initialSettings,
        spotify_access_token: refreshed.accessToken,
        spotify_refresh_token: refreshed.refreshToken || refreshToken,
        spotify_client_id: cleanId,
        spotify_token_expires_at: refreshed.expiresAt,
      });

      const expStr = new Date(refreshed.expiresAt).toLocaleTimeString();
      setFastConnectFeedback(`✅ Renouvellement réussi ! Nouveau jeton d\'accès actif jusqu\'à ${expStr}.`);
      setTimeout(() => setFastConnectFeedback(null), 6000);
    } catch (err: any) {
      console.error('Erreur refresh:', err);
      setFastConnectFeedback(`❌ Échec du renouvellement : ${err.message || String(err)}`);
    } finally {
      setIsRefreshingToken(false);
    }
  };

  const broadcastSettingsUpdate = (payload: any) => {
    try {
      window.dispatchEvent(
        new CustomEvent('kairo_update_plugin_settings', {
          detail: { id: 'kairo-spotify-screensaver', settings: payload },
        })
      );
      window.postMessage(
        {
          type: 'kairo_update_settings',
          settings: payload,
        },
        '*'
      );
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach((ifr) => {
        try {
          ifr.contentWindow?.postMessage(
            {
              type: 'kairo_update_settings',
              settings: payload,
            },
            '*'
          );
        } catch (_) {}
      });
    } catch (_) {}
  };

  // Enregistrer tous les réglages
  const handleSave = async () => {
    const payload = {
      ...initialSettings,
      enabled: pluginEnabled,
      show_cover: showCover,
      show_lyrics: showLyrics,
      display_layout: displayLayout,
      lyrics_font_size: lyricsFontSize,
      lyrics_alignment: lyricsAlignment,
      lyrics_highlight_color: lyricsHighlightColor,
      lyrics_glow: lyricsGlow,
      cover_size: coverSize,
      vinyl_rotation: vinylRotation,
      vinyl_speed: vinylSpeed,
      blur_background: blurBackground,
      blur_intensity: blurIntensity,
      show_controls: showControls,
      show_progress_bar: showProgressBar,
      show_playlist_name: showPlaylistName,
      show_album_name: showAlbumName,
      show_device_badge: showDeviceBadge,
      show_gamepad_hints: showGamepadHints,
      transition_speed: transitionSpeed,
      selected_device: targetSpeaker.trim(),
      target_speaker: targetSpeaker.trim(),
      idle_timeout_seconds: idleTimeout,
      custom_devices: customDevices,
      spotify_device_name: deviceName.trim() || 'Borne Kaïro',
      overlay_brightness: overlayBrightness,
      spotify_access_token: token.trim(),
      spotify_client_id: clientId.trim() || initialSettings.spotify_client_id || '744337ebc86048fc9d3ac3cdffd82aef',
      spotify_refresh_token: refreshToken.trim() || initialSettings.spotify_refresh_token || '',
      spotify_token_expires_at: tokenExpiresAt || initialSettings.spotify_token_expires_at || 0,
    };

    await onSave(payload);
    broadcastSettingsUpdate(payload);

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  // --- API TEST 1 : Utilisateur (/v1/me) ---
  const handleTestUser = async () => {
    if (!token.trim()) {
      setUserTest({ status: 'warning', message: 'Veuillez saisir un token Spotify pour tester.' });
      return;
    }
    if (isClientId) {
      setUserTest({
        status: 'error',
        message: 'Erreur : Vous avez saisi un Client ID (32 car.). Il faut un Access Token commençant par "BQ...".',
      });
      return;
    }
    setUserTest({ status: 'loading', message: 'Vérification du profil auprès de Spotify...' });
    try {
      const res = await fetch('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUserTest({
          status: 'success',
          message: `✓ Profil validé : ${data.display_name || data.id} (${data.product === 'premium' ? '★ Premium' : 'Free'}) • Pays : ${data.country}`,
        });
      } else if (res.status === 401) {
        setUserTest({
          status: 'error',
          message: 'Erreur 401 (Jeton non autorisé) : Le jeton est invalide ou a expiré (durée de validité Spotify : 1h).',
        });
      } else {
        setUserTest({ status: 'error', message: `Erreur Spotify HTTP ${res.status} (${res.statusText})` });
      }
    } catch (err: any) {
      setUserTest({ status: 'error', message: `Échec réseau : ${err?.message || String(err)}` });
    }
  };

  // --- API TEST 2 : Lecture en Cours (/v1/me/player) ---
  const handleTestPlayer = async () => {
    if (!token.trim()) {
      setPlayerTest({ status: 'warning', message: 'Token requis pour interroger la lecture.' });
      return;
    }
    setPlayerTest({ status: 'loading', message: 'Interrogation de la lecture en cours...' });
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player', {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (res.status === 204) {
        setPlayerTest({
          status: 'warning',
          message: 'Aucune lecture active détectée sur votre compte Spotify en ce moment (lecteur en veille).',
        });
      } else if (res.ok) {
        const data = await res.json();
        const track = data.item;
        const device = data.device?.name || 'Inconnu';
        const artist = track?.artists?.map((a: any) => a.name).join(', ') || 'Artiste inconnu';
        const stateStr = data.is_playing ? '▶ En lecture' : '⏸ En pause';
        setPlayerTest({
          status: 'success',
          message: `✓ Morceau détecté (${stateStr}) : "${track?.name}" par ${artist} sur [${device}]`,
        });
      } else if (res.status === 401) {
        setPlayerTest({ status: 'error', message: 'Erreur 401 : Jeton expiré ou invalide.' });
      } else {
        setPlayerTest({ status: 'error', message: `Erreur Spotify HTTP ${res.status}` });
      }
    } catch (err: any) {
      setPlayerTest({ status: 'error', message: `Échec requête : ${err?.message || String(err)}` });
    }
  };

  // --- API TEST 3 : Scanner Enceintes (/v1/me/player/devices) ---
  const handleTestDevices = async () => {
    if (!token.trim()) {
      setDevicesTest({ status: 'warning', message: 'Token requis pour scanner les appareils.' });
      return;
    }
    setDevicesTest({ status: 'loading', message: 'Recherche des enceintes Spotify Connect en ligne...' });
    try {
      const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
        headers: { Authorization: `Bearer ${token.trim()}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.devices || [];
        if (list.length === 0) {
          setDevicesTest({
            status: 'warning',
            message: 'Aucun appareil en ligne. Ouvrez Spotify sur votre smartphone ou allumez une enceinte.',
            devices: [],
          });
        } else {
          setDevicesTest({
            status: 'success',
            message: `✓ ${list.length} appareil(s) Spotify Connect détecté(s) en ligne :`,
            devices: list,
          });
        }
      } else if (res.status === 401) {
        setDevicesTest({ status: 'error', message: 'Erreur 401 : Token non autorisé.' });
      } else {
        setDevicesTest({ status: 'error', message: `Erreur HTTP ${res.status}` });
      }
    } catch (err: any) {
      setDevicesTest({ status: 'error', message: `Erreur scan : ${err?.message || String(err)}` });
    }
  };

  // --- API TEST 4 : Test Paroles LRCLIB ---
  const handleTestLyrics = async () => {
    setLyricsTest({ status: 'loading', message: "Test de l'API LRCLIB avec \"Bohemian Rhapsody\"..." });
    try {
      const res = await fetch(
        'https://lrclib.net/api/get?track_name=Bohemian%20Rhapsody&artist_name=Queen'
      );
      if (res.ok) {
        const data = await res.json();
        const lines = data.syncedLyrics ? data.syncedLyrics.split('\n').filter(Boolean) : [];
        setLyricsTest({
          status: 'success',
          message: `✓ API LRCLIB opérationnelle ! Paroles synchronisées reçues (${lines.length} versets défilants avec horodatages).`,
        });
      } else {
        setLyricsTest({ status: 'error', message: `Erreur LRCLIB HTTP ${res.status}` });
      }
    } catch (err: any) {
      setLyricsTest({ status: 'error', message: `Erreur connexion LRCLIB : ${err?.message || String(err)}` });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Entête & Bouton de sauvegarde supérieur */}
      <div
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        className="p-5 rounded-3xl border shadow-xs flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h4 style={{ color: 'var(--text-primary)' }} className="text-sm font-black uppercase tracking-wider">
              Spotify Connect Enceinte & Paroles Karaoké
            </h4>
            <p style={{ color: 'var(--text-muted)' }} className="text-xs">
              Deux modes disponibles avec tests d'API en direct et paroles synchronisées.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('kairo_open_music_player', { detail: { mode: 'fullscreen' } })
              );
            }}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
            title="Afficher l'écran de musique et paroles en plein écran (Raccourci : Touche Inser)"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>Ouvrir le Lecteur / Paroles</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-700/80 font-mono text-purple-100">
              Inser
            </span>
          </button>

          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-1 animate-fadeIn">
              <Check className="w-4 h-4" />
              <span>Enregistré !</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ backgroundColor: 'var(--accent-primary)' }}
            className="px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
          </button>
        </div>
      </div>

      {/* 2. BANNIÈRE EXPLICATIVE DU MODE HYBRIDE SIMULTANÉ */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)',
          borderColor: 'rgba(168, 85, 247, 0.3)',
        }}
        className="p-5 rounded-3xl border-2 space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 style={{ color: 'var(--text-primary)' }} className="text-sm font-black uppercase tracking-wider">
              Mode Hybride Simultané (Actif)
            </h3>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-white shadow-xs">
            2 en 1 automatique
          </span>
        </div>

        <p style={{ color: 'var(--text-secondary)' }} className="text-xs leading-relaxed">
          Les deux modes fonctionnent désormais en parallèle de façon transparente, sans choix exclusif :
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-2xl bg-black/20 border border-emerald-500/30 text-xs space-y-1">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <Speaker className="w-3.5 h-3.5" />
              <span>1. Spotify Connect sur Borne</span>
            </div>
            <p style={{ color: 'var(--text-muted)' }} className="text-[11px] leading-relaxed">
              Dès que vous diffusez vers <strong>{deviceName}</strong>, l'affichage karaoké s'ouvre <strong>immédiatement</strong> sans attente.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-black/20 border border-purple-500/30 text-xs space-y-1">
            <div className="font-bold text-purple-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>2. Enceinte Externe Dédiée</span>
            </div>
            <p style={{ color: 'var(--text-muted)' }} className="text-[11px] leading-relaxed">
              Si la musique joue sur <strong>{targetSpeaker || 'votre enceinte'}</strong> et que la borne est inactive pendant <strong>{idleTimeout}s</strong>, l'écran de veille démarre.
            </p>
          </div>

          <div className="p-3 rounded-2xl bg-black/20 border border-rose-500/30 text-xs space-y-1">
            <div className="font-bold text-rose-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>3. Filtre Strict d'Exclusion</span>
            </div>
            <p style={{ color: 'var(--text-muted)' }} className="text-[11px] leading-relaxed">
              Si la musique joue sur une enceinte <strong>non sélectionnée</strong> (PC, smartphone, etc.), le plugin reste <strong>100% invisible</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* 3. ENCEINTE EXTERNE À SURVEILLER (AVEC BOUTON AJOUTER & SCAN) */}
      <div
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        className="p-5 rounded-3xl border shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between border-b border-black/10 pb-3">
          <div className="flex items-center gap-2">
            <Speaker className="w-4 h-4 text-purple-500" />
            <h4 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider">
              Enceinte Externe à Surveiller (Seule cette enceinte déclenchera la veille)
            </h4>
          </div>
          <span className="text-[10px] font-mono font-bold text-purple-400 px-2 py-0.5 rounded-lg bg-purple-500/10">
            Filtre actif : {targetSpeaker || 'Aucune'}
          </span>
        </div>

        {/* Formulaire d'ajout d'une enceinte manuelle (BOUTON AJOUTER FONCTIONNEL) */}
        <div className="space-y-2">
          <label style={{ color: 'var(--text-primary)' }} className="block text-xs font-bold">
            Ajouter une nouvelle enceinte personnalisée :
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newDeviceInput}
              onChange={(e) => setNewDeviceInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCustomDevice();
              }}
              placeholder="Ex: HP-Bureau, Echo Salon, Sonos Cuisine..."
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              className="flex-1 text-xs font-mono p-3 rounded-xl border focus:ring-1 focus:ring-purple-500 outline-none"
            />
            <button
              type="button"
              onClick={handleAddCustomDevice}
              disabled={!newDeviceInput.trim()}
              className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0"
              title="Ajouter l'enceinte à la liste et la sélectionner"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter</span>
            </button>

            <button
              type="button"
              onClick={handleTestDevices}
              disabled={devicesTest.status === 'loading'}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
              title="Scanner automatiquement les appareils Spotify Connect connectés sur votre réseau"
            >
              <RefreshCw className={`w-4 h-4 ${devicesTest.status === 'loading' ? 'animate-spin' : ''}`} />
              <span>Scanner Enceintes</span>
            </button>
          </div>

          {addDeviceNotice && (
            <p className="text-xs font-bold text-emerald-400 animate-fadeIn">{addDeviceNotice}</p>
          )}
        </div>

        {/* Liste cliquable des enceintes (Custom + Détectées) */}
        <div className="space-y-2 pt-1">
          <label style={{ color: 'var(--text-muted)' }} className="block text-[11px] font-bold uppercase tracking-wider">
            Sélectionnez l'enceinte cible active (Cliquer pour définir) :
          </label>
          <div className="flex flex-wrap gap-2">
            {customDevices.map((devName) => {
              const isSelected = targetSpeaker.trim().toLowerCase() === devName.trim().toLowerCase();
              return (
                <div
                  key={devName}
                  onClick={() => setTargetSpeaker(devName)}
                  className={`px-3.5 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600 border-purple-400 text-white shadow-sm ring-2 ring-purple-500/40'
                      : 'bg-black/20 hover:bg-purple-600/20 text-slate-300 border-white/10'
                  }`}
                >
                  <Speaker className="w-3.5 h-3.5 shrink-0" />
                  <span>{devName}</span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                  <button
                    type="button"
                    onClick={(e) => handleRemoveCustomDevice(devName, e)}
                    className="ml-1 text-white/50 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                    title={`Supprimer « ${devName} »`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Résultats du scan en direct */}
        {devicesTest.message && (
          <div
            className={`p-3 rounded-2xl border text-xs font-mono space-y-2 ${
              devicesTest.status === 'success'
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                : devicesTest.status === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : devicesTest.status === 'loading'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 shrink-0" />
              <span>{devicesTest.message}</span>
            </div>

            {devicesTest.devices && devicesTest.devices.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {devicesTest.devices.map((dev) => (
                  <button
                    key={dev.id}
                    type="button"
                    onClick={() => {
                      setTargetSpeaker(dev.name);
                      if (!customDevices.includes(dev.name)) {
                        setCustomDevices([...customDevices, dev.name]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      targetSpeaker === dev.name
                        ? 'bg-purple-600 border-purple-400 text-white'
                        : 'bg-black/30 border-purple-500/30 text-purple-200 hover:bg-purple-600/30'
                    }`}
                  >
                    <Speaker className="w-3.5 h-3.5" />
                    <span>{dev.name}</span>
                    <span className="text-[10px] opacity-75">({dev.type})</span>
                    {dev.is_active && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Curseur de délai d'inactivité */}
        <div className="pt-2 border-t border-black/10">
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ color: 'var(--text-primary)' }} className="text-xs font-bold flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>Délai d'inactivité avant veille automatique sur enceinte externe :</span>
            </label>
            <span className="font-mono text-xs font-black text-purple-400">
              {idleTimeout} secondes ({Math.round((idleTimeout / 60) * 10) / 10} min)
            </span>
          </div>
          <input
            type="range"
            min="10"
            max="300"
            step="5"
            value={idleTimeout}
            onChange={(e) => setIdleTimeout(parseInt(e.target.value, 10))}
            className="w-full accent-purple-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
            <span>10 sec (test immédiat)</span>
            <span>30 sec (recommandé)</span>
            <span>5 minutes</span>
          </div>
        </div>
      </div>

      {/* 4. PERSONNALISATION VISUELLE & PARAMÈTRES UI */}
      <div
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        className="p-5 rounded-3xl border shadow-xs space-y-5"
      >
        <div className="flex items-center gap-2 border-b border-black/10 pb-3">
          <Layout className="w-4 h-4 text-emerald-400" />
          <h4 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider">
            Personnalisation Visuelle & Interface de Lecture
          </h4>
        </div>

        {/* 4.1 CHOIX DU LAYOUT (Karaoké vs Immersif) */}
        <div className="space-y-2">
          <label style={{ color: 'var(--text-primary)' }} className="block text-xs font-bold">
            Disposition Graphique de l'Écran de Veille :
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => setDisplayLayout('karaoke')}
              style={{
                backgroundColor:
                  displayLayout === 'karaoke' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-secondary)',
                borderColor: displayLayout === 'karaoke' ? '#10b981' : 'var(--border-color)',
              }}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer space-y-1.5 ${
                displayLayout === 'karaoke' ? 'ring-2 ring-emerald-500/30' : 'hover:border-slate-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                  Disposition 1 : Karaoké
                </span>
                {displayLayout === 'karaoke' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500 text-white">
                    Actif
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--text-secondary)' }} className="text-xs leading-relaxed">
                Pochette d'album à gauche avec disque vinyle rotatif, paroles larges défilantes à droite. Épuré et orienté chant.
              </p>
            </div>

            <div
              onClick={() => setDisplayLayout('immersive')}
              style={{
                backgroundColor:
                  displayLayout === 'immersive' ? 'rgba(168, 85, 247, 0.1)' : 'var(--bg-secondary)',
                borderColor: displayLayout === 'immersive' ? '#a855f7' : 'var(--border-color)',
              }}
              className={`p-4 rounded-2xl border-2 transition-all cursor-pointer space-y-1.5 ${
                displayLayout === 'immersive' ? 'ring-2 ring-purple-500/30' : 'hover:border-slate-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-purple-400 uppercase tracking-wider">
                  Disposition 2 : Immersif
                </span>
                {displayLayout === 'immersive' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-purple-500 text-white">
                    Actif
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--text-secondary)' }} className="text-xs leading-relaxed">
                Fond lumineux extrait dynamiquement de la pochette (ColorThief), carte de lecture centrée, atmosphère enveloppante.
              </p>
            </div>
          </div>
        </div>

        {/* 4.2 OPTIONS TYPOGRAPHIQUES & PAROLES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Taille des paroles */}
          <div
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            className="p-3.5 rounded-2xl border space-y-1.5"
          >
            <label style={{ color: 'var(--text-primary)' }} className="text-xs font-bold flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-sky-400" />
              <span>Taille des paroles :</span>
            </label>
            <select
              value={lyricsFontSize}
              onChange={(e: any) => setLyricsFontSize(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              className="w-full p-2 rounded-xl text-xs font-bold border outline-none cursor-pointer"
            >
              <option value="small">Petite</option>
              <option value="medium">Moyenne</option>
              <option value="large">Grande (Défaut)</option>
              <option value="xlarge">Très Grande</option>
            </select>
          </div>

          {/* Alignement des paroles */}
          <div
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            className="p-3.5 rounded-2xl border space-y-1.5"
          >
            <label style={{ color: 'var(--text-primary)' }} className="text-xs font-bold flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Alignement paroles :</span>
            </label>
            <select
              value={lyricsAlignment}
              onChange={(e: any) => setLyricsAlignment(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              className="w-full p-2 rounded-xl text-xs font-bold border outline-none cursor-pointer"
            >
              <option value="left">Gauche (Karaoké standard)</option>
              <option value="center">Centré (Poétique)</option>
              <option value="right">Droite</option>
            </select>
          </div>

          {/* Couleur de surbrillance */}
          <div
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            className="p-3.5 rounded-2xl border space-y-1.5"
          >
            <label style={{ color: 'var(--text-primary)' }} className="text-xs font-bold flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span>Couleur de surbrillance :</span>
            </label>
            <select
              value={lyricsHighlightColor}
              onChange={(e: any) => setLyricsHighlightColor(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              className="w-full p-2 rounded-xl text-xs font-bold border outline-none cursor-pointer"
            >
              <option value="accent">Thème Actif KaïroOS</option>
              <option value="green">Vert Spotify (#10b981)</option>
              <option value="gold">Or / Ambre (#f59e0b)</option>
              <option value="cyan">Cyan Électrique (#06b6d4)</option>
              <option value="white">Blanc Pur (#ffffff)</option>
            </select>
          </div>
        </div>

        {/* 4.3 OPTIONS DE POCHETTE & VINYLE */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Taille pochette */}
          <div
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            className="p-3.5 rounded-2xl border space-y-1.5"
          >
            <label style={{ color: 'var(--text-primary)' }} className="text-xs font-bold flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
              <span>Taille jaquette :</span>
            </label>
            <select
              value={coverSize}
              onChange={(e: any) => setCoverSize(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              className="w-full p-2 rounded-xl text-xs font-bold border outline-none cursor-pointer"
            >
              <option value="small">Compacte</option>
              <option value="medium">Moyenne (Défaut)</option>
              <option value="large">Grande</option>
            </select>
          </div>

          {/* Rotation vinyle */}
          <div
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            className="p-3.5 rounded-2xl border flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Disc className="w-4 h-4 text-emerald-400" />
              <div>
                <div style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                  Rotation Vinyle 33T
                </div>
                <div style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                  Effet disque tournant
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={vinylRotation}
              onChange={(e) => setVinylRotation(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 cursor-pointer"
            />
          </div>

          {/* Vitesse vinyle */}
          <div
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            className="p-3.5 rounded-2xl border space-y-1.5"
          >
            <label style={{ color: 'var(--text-primary)' }} className="text-xs font-bold flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Vitesse vinyle :</span>
            </label>
            <select
              value={vinylSpeed}
              onChange={(e: any) => setVinylSpeed(e.target.value)}
              disabled={!vinylRotation}
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              className="w-full p-2 rounded-xl text-xs font-bold border outline-none cursor-pointer disabled:opacity-40"
            >
              <option value="slow">Lente (12s / tour)</option>
              <option value="normal">Standard (8s / tour)</option>
              <option value="fast">Rapide (4s / tour)</option>
            </select>
          </div>
        </div>

        {/* 4.4 TOGGLES COMPLÉMENTAIRES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Lueur sur paroles */}
          <div
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            className="p-3 rounded-2xl border flex items-center justify-between"
          >
            <span style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
              Lueur Paroles (Glow)
            </span>
            <input
              type="checkbox"
              checked={lyricsGlow}
              onChange={(e) => setLyricsGlow(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 cursor-pointer"
            />
          </div>

          {/* Arrière-plan flou */}
          <div
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            className="p-3 rounded-2xl border flex items-center justify-between"
          >
            <span style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
              Arrière-plan flou
            </span>
            <input
              type="checkbox"
              checked={blurBackground}
              onChange={(e) => setBlurBackground(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 cursor-pointer"
            />
          </div>

          {/* Contrôles de lecture */}
          <div
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            className="p-3 rounded-2xl border flex items-center justify-between"
          >
            <span style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
              Boutons de Lecture
            </span>
            <input
              type="checkbox"
              checked={showControls}
              onChange={(e) => setShowControls(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 cursor-pointer"
            />
          </div>

          {/* Barre de progression */}
          <div
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            className="p-3 rounded-2xl border flex items-center justify-between"
          >
            <span style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
              Barre de temps
            </span>
            <input
              type="checkbox"
              checked={showProgressBar}
              onChange={(e) => setShowProgressBar(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 cursor-pointer"
            />
          </div>
        </div>

        {/* 4.5 LUMINOSITÉ OVERLAY & INTENSITÉ FLOU */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span className="flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Luminosité de l'overlay :</span>
              </span>
              <span className="font-mono text-emerald-400">{overlayBrightness}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={overlayBrightness}
              onChange={(e) => setOverlayBrightness(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span style={{ color: 'var(--text-primary)' }}>Intensité du flou d'arrière-plan :</span>
              <span className="font-mono text-purple-400">{blurIntensity}px</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={blurIntensity}
              onChange={(e) => setBlurIntensity(parseInt(e.target.value, 10))}
              className="w-full accent-purple-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 5. CONFIGURATION DE LA BORNE (SPOTIFY CONNECT DIRECT) */}
      <div
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        className="p-5 rounded-3xl border shadow-xs space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-black/10 pb-3">
          <Speaker className="w-4 h-4 text-emerald-500" />
          <h4 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider">
            Nom Spotify Connect de cette Borne
          </h4>
        </div>

        <div>
          <label style={{ color: 'var(--text-primary)' }} className="block text-xs font-bold mb-1">
            Nom diffusé aux téléphones et tablettes :
          </label>
          <input
            type="text"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="Ex: Borne Kaïro"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            className="w-full text-xs font-mono p-3 rounded-xl border focus:ring-1 focus:ring-emerald-500 outline-none"
          />
          <p style={{ color: 'var(--text-muted)' }} className="text-[11px] mt-1">
            Lorsque vous sélectionnez cet appareil sur Spotify, la borne affiche immédiatement les paroles sans délai.
          </p>
        </div>
      </div>

      {/* 6. AUTHENTIFICATION SPOTIFY (TOKEN & PKCE FAST CONNECT) */}
      <div
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)' }}
        className="p-5 rounded-3xl border shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            <h4 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider">
              Authentification Spotify Web API
            </h4>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowTokenGuide(!showTokenGuide)}
              className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <HelpCircle className="w-3 h-3 text-indigo-400" />
              <span>Guide 30s</span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleOpenLink(
                  'https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track',
                  'Console Spotify'
                )
              }
              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <BookOpen className="w-3 h-3" />
              <span>Console (1-Clic)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowFastConnect(!showFastConnect)}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <Zap className="w-3 h-3 text-amber-400" />
              <span>⚡ Connexion Rapide PKCE</span>
            </button>

            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
            >
              <ClipboardCopy className="w-3 h-3" />
              <span>Coller</span>
            </button>
          </div>
        </div>

        {browserNotice && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{browserNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setBrowserNotice(null)}
              className="text-emerald-400 hover:text-white text-xs font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Volet Guide */}
        {showTokenGuide && (
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-indigo-500/30 text-slate-300 space-y-3 animate-fadeIn text-xs">
            <div className="flex items-center justify-between">
              <strong className="text-white">Obtenir un jeton en 30 secondes :</strong>
              <button
                type="button"
                onClick={() => setShowTokenGuide(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕ Fermer
              </button>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-300">
              <li>Ouvrez la <strong>Console Spotify</strong> avec le bouton vert ci-dessus.</li>
              <li>Connectez-vous et cliquez sur <strong>« Request Token »</strong>.</li>
              <li>Cochez <code>user-read-playback-state</code>, <code>user-read-currently-playing</code> et <code>streaming</code>.</li>
              <li>Copiez le jeton (commence par <code>BQ...</code>) et cliquez sur <strong>« Coller »</strong> !</li>
            </ol>
          </div>
        )}

        {/* Volet Fast Connect PKCE */}
        {showFastConnect && (
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/40 space-y-3 animate-fadeIn text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4" />
                <span>Assistant OAuth PKCE (Renouvellement automatique)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowFastConnect(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕ Fermer
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 mb-1">Client ID Spotify :</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Client ID (32 car.)"
                  className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 outline-none"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleLaunchFastConnect}
                  className="w-full px-3 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>1. Lancer Autorisation</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="block text-[10px] font-bold text-slate-400">
                Coller l'URL de retour ou le code reçu :
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={authCodeInput}
                  onChange={(e) => setAuthCodeInput(e.target.value)}
                  placeholder="https://developer.spotify.com/dashboard?code=AQD..."
                  className="flex-1 text-xs font-mono p-2.5 rounded-xl border border-slate-700 bg-slate-900 text-slate-200 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleProcessAndExchangeCode(authCodeInput)}
                  disabled={isExchangingCode}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isExchangingCode ? 'Échange...' : '2. Valider'}
                </button>
                <button
                  type="button"
                  onClick={handleSmartPaste}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 cursor-pointer"
                >
                  📋 Coller & Valider
                </button>
              </div>
            </div>

            {fastConnectFeedback && (
              <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/40 text-amber-300 text-xs font-mono">
                {fastConnectFeedback}
              </div>
            )}
          </div>
        )}

        {/* Champ Token & Tests */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type={showSecret ? 'text' : 'password'}
              value={token}
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder="Collez votre Access Token Spotify (commence par BQ...)"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: isClientId ? '#ef4444' : 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
              className="w-full text-xs font-mono p-3 pr-10 rounded-xl border focus:ring-1 focus:ring-emerald-500 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleTestUser}
              disabled={userTest.status === 'loading'}
              className="px-3.5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              title="Tester la validité du jeton auprès de Spotify"
            >
              <ShieldCheck className={`w-4 h-4 ${userTest.status === 'loading' ? 'animate-spin' : ''}`} />
              <span>Tester Jeton</span>
            </button>

            <button
              type="button"
              onClick={handleTestPlayer}
              disabled={playerTest.status === 'loading'}
              className="px-3.5 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              title="Interroger la lecture en cours"
            >
              <Play className={`w-3.5 h-3.5 ${playerTest.status === 'loading' ? 'animate-spin' : ''}`} />
              <span>Tester Lecture</span>
            </button>

            {refreshToken && (
              <button
                type="button"
                onClick={handleTestRefreshToken}
                disabled={isRefreshingToken}
                className="px-3.5 py-3 rounded-xl bg-teal-700 hover:bg-teal-600 text-teal-100 font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                title="Tester le renouvellement automatique avec le Refresh Token"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingToken ? 'animate-spin' : ''}`} />
                <span>Tester Refresh</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleTestLyrics}
              disabled={lyricsTest.status === 'loading'}
              className="px-3.5 py-3 rounded-xl bg-purple-700 hover:bg-purple-600 text-purple-100 font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
              title="Tester l'accès aux paroles défilantes LRCLIB"
            >
              <Music className={`w-3.5 h-3.5 ${lyricsTest.status === 'loading' ? 'animate-spin' : ''}`} />
              <span>Tester Paroles</span>
            </button>
          </div>
        </div>

        {/* Feedback tests */}
        {userTest.message && (
          <div
            className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2 ${
              userTest.status === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : userTest.status === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : userTest.status === 'loading'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{userTest.message}</span>
          </div>
        )}

        {playerTest.message && (
          <div
            className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2 ${
              playerTest.status === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : playerTest.status === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : playerTest.status === 'loading'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <Music className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{playerTest.message}</span>
          </div>
        )}

        {lyricsTest.message && (
          <div
            className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2 ${
              lyricsTest.status === 'success'
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                : lyricsTest.status === 'loading'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{lyricsTest.message}</span>
          </div>
        )}
      </div>

      {/* 5. BARRE D'ENREGISTREMENT INFÉRIEURE */}
      <div className="flex items-center justify-between pt-2">
        <div style={{ color: 'var(--text-muted)' }} className="text-xs">
          Les réglages sont automatiquement persistés et synchronisés avec KaïroOS.
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{ backgroundColor: 'var(--accent-primary)' }}
          className="px-6 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider shadow-md hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Enregistrement...' : 'Enregistrer les Paramètres'}</span>
        </button>
      </div>
    </div>
  );
};
