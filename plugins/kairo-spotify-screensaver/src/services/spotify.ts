import { fetchLyrics } from './lyrics';

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl?: string;
  durationMs: number;
  progressMs: number;
  isPlaying: boolean;
  deviceName: string;
  deviceId: string;
  playlistName?: string;
  isFavorite?: boolean;
  shuffleState?: boolean;
}

export const DEMO_DEVICES: SpotifyDevice[] = [
  { id: 'borne-local', name: 'Borne Kaïro (Ce PC)', type: 'Computer', is_active: true, volume_percent: 85 },
  { id: 'dev-salon', name: 'Salon (Echo / Enceinte)', type: 'Speaker', is_active: false, volume_percent: 70 },
  { id: 'dev-cuisine', name: 'Cuisine (Ampli Hi-Fi)', type: 'AudioDongle', is_active: false, volume_percent: 50 },
  { id: 'dev-chambre', name: 'Chambre (Google Home)', type: 'Speaker', is_active: false, volume_percent: 60 },
];

export const DEMO_TRACKS: SpotifyTrack[] = [
  {
    id: 'demo-1',
    title: 'Retro Arcade Groove',
    artist: 'Kaïro Sound Studio',
    album: 'Arcade Memories Vol. 1',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    audioUrl: 'https://actions.google.com/sounds/v1/science_fiction/retro_game_music.ogg',
    durationMs: 38000,
    progressMs: 0,
    isPlaying: false,
    deviceName: 'Borne Kaïro (Ce PC)',
    deviceId: 'borne-local',
  },
  {
    id: 'demo-2',
    title: 'Bohemian Rhapsody',
    artist: 'Queen',
    album: 'A Night at the Opera',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    durationMs: 354000,
    progressMs: 30000,
    isPlaying: false,
    deviceName: 'Salon (Echo / Enceinte)',
    deviceId: 'dev-salon',
  },
  {
    id: 'demo-3',
    title: 'Get Lucky',
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    durationMs: 248000,
    progressMs: 45000,
    isPlaying: false,
    deviceName: 'Cuisine (Ampli Hi-Fi)',
    deviceId: 'dev-cuisine',
  },
  {
    id: 'demo-4',
    title: 'Take On Me',
    artist: 'a-ha',
    album: 'Hunting High and Low',
    coverUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop&q=80',
    durationMs: 225000,
    progressMs: 15000,
    isPlaying: false,
    deviceName: 'Chambre (Google Home)',
    deviceId: 'dev-chambre',
  },
];

export interface SpotifyAuthConfig {
  clientId?: string;
  refreshToken?: string;
  expiresAt?: number;
  onTokenRefreshed?: (newAccessToken: string, newRefreshToken?: string, newExpiresAt?: number) => void;
}

export async function refreshSpotifyAccessToken(
  clientId: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    grant_type: 'refresh_token',
    refresh_token: refreshToken.trim(),
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errData.error_description || errData.error || `Erreur renouvellement token (${res.status})`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresIn: Number(data.expires_in) || 3600,
    refreshToken: data.refresh_token || refreshToken,
  };
}

export async function getLiveSpotifyDevices(
  token: string,
  authConfig?: SpotifyAuthConfig
): Promise<SpotifyDevice[]> {
  if (!token && !authConfig?.refreshToken) return DEMO_DEVICES;

  let activeToken = token;

  try {
    let res = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${activeToken}` },
    });

    if (res.status === 401 && authConfig?.clientId && authConfig?.refreshToken) {
      try {
        const refreshed = await refreshSpotifyAccessToken(authConfig.clientId, authConfig.refreshToken);
        activeToken = refreshed.accessToken;
        if (authConfig.onTokenRefreshed) {
          authConfig.onTokenRefreshed(refreshed.accessToken, refreshed.refreshToken, Date.now() + refreshed.expiresIn * 1000);
        }
        res = await fetch('https://api.spotify.com/v1/me/player/devices', {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
      } catch (refreshErr) {
        console.warn('[Spotify API] Échec auto-refresh lors de getLiveSpotifyDevices:', refreshErr);
      }
    }

    if (!res.ok) return DEMO_DEVICES;
    const data = await res.json();
    return data.devices || DEMO_DEVICES;
  } catch (err) {
    console.warn('[Spotify API] Erreur récupération appareils:', err);
    return DEMO_DEVICES;
  }
}

export async function getLiveSpotifyStatus(
  token: string,
  authConfig?: SpotifyAuthConfig
): Promise<SpotifyTrack | null> {
  if (!token && !authConfig?.refreshToken) return null;

  let activeToken = token;

  try {
    let res = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${activeToken}` },
    });

    if (res.status === 401 && authConfig?.clientId && authConfig?.refreshToken) {
      try {
        const refreshed = await refreshSpotifyAccessToken(authConfig.clientId, authConfig.refreshToken);
        activeToken = refreshed.accessToken;
        if (authConfig.onTokenRefreshed) {
          authConfig.onTokenRefreshed(refreshed.accessToken, refreshed.refreshToken, Date.now() + refreshed.expiresIn * 1000);
        }
        res = await fetch('https://api.spotify.com/v1/me/player', {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
      } catch (refreshErr) {
        console.warn('[Spotify API] Échec auto-refresh lors de getLiveSpotifyStatus:', refreshErr);
      }
    }

    if (res.status === 204 || !res.ok) return null;

    const data = await res.json();
    if (!data || !data.item) return null;

    return {
      id: data.item.id,
      title: data.item.name,
      artist: data.item.artists?.map((a: any) => a.name).join(', ') || 'Artiste inconnu',
      album: data.item.album?.name || '',
      coverUrl: data.item.album?.images?.[0]?.url || '',
      durationMs: data.item.duration_ms || 0,
      progressMs: data.progress_ms || 0,
      isPlaying: Boolean(data.is_playing),
      deviceName: data.device?.name || '',
      deviceId: data.device?.id || '',
    };
  } catch (err) {
    console.warn('[Spotify API] Erreur récupération lecteur:', err);
    return null;
  }
}

export interface TokenValidationResult {
  status: 'empty' | 'is_client_id' | 'valid_format' | 'invalid';
  message: string;
}

export function analyzeTokenString(token: string): TokenValidationResult {
  const trimmed = token.trim();
  if (!trimmed) {
    return { status: 'empty', message: 'Aucun jeton renseigné (mode simulation actif).' };
  }
  // Un client ID Spotify fait exactement 32 caractères hexadécimaux
  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return {
      status: 'is_client_id',
      message: 'Attention : Vous avez saisi un "Client ID" (32 caractères). Un "Access Token" Spotify commence par "BQ..." et fait plus de 150 caractères.',
    };
  }
  if (trimmed.startsWith('BQ') && trimmed.length > 80) {
    return {
      status: 'valid_format',
      message: 'Format d\'Access Token valide (OAuth Bearer Token).',
    };
  }
  if (trimmed.length < 50) {
    return {
      status: 'invalid',
      message: 'Ce jeton semble trop court. Un Access Token Spotify fait plus de 150 caractères et commence par "BQ...".',
    };
  }
  return {
    status: 'valid_format',
    message: 'Jeton personnalisé configuré.',
  };
}

export function initWebPlaybackPlayer(
  token: string,
  deviceName: string,
  onReady: (deviceId: string) => void,
  onStateChange: (track: SpotifyTrack) => void,
  onError: (msg: string) => void,
  authConfig?: SpotifyAuthConfig
): (() => void) | null {
  if (typeof window === 'undefined') return null;

  let playerInstance: any = null;
  let isCancelled = false;
  let retryTimer: any = null;
  let activeToken = token;

  const startPlayer = (SpotifySDK: any) => {
    if (isCancelled || playerInstance) return;
    try {
      const devName = deviceName || 'Borne Kaïro';
      console.log('🎵 [Web Playback SDK] Initialisation du lecteur Spotify Connect:', devName);
      const player = new SpotifySDK.Player({
        name: devName,
        getOAuthToken: async (cb: (t: string) => void) => {
          const isExpiringSoon = authConfig?.expiresAt ? Date.now() > (authConfig.expiresAt - 120000) : false;
          if ((!activeToken || isExpiringSoon) && authConfig?.clientId && authConfig?.refreshToken) {
            try {
              console.log('🔄 [Web Playback SDK] Renouvellement automatique préventif du token Spotify...');
              const refreshed = await refreshSpotifyAccessToken(authConfig.clientId, authConfig.refreshToken);
              activeToken = refreshed.accessToken;
              if (authConfig.onTokenRefreshed) {
                authConfig.onTokenRefreshed(refreshed.accessToken, refreshed.refreshToken, Date.now() + refreshed.expiresIn * 1000);
              }
              cb(refreshed.accessToken);
              return;
            } catch (e) {
              console.warn('[Web Playback SDK] Échec refresh préventif, utilisation du jeton existant:', e);
            }
          }
          if (activeToken) {
            cb(activeToken);
            return;
          }
          cb(token);
        },
        volume: 1.0,
      });

      player.addListener('ready', ({ device_id }: { device_id: string }) => {
        console.log('✅ [Web Playback SDK] Connecté avec succès ! Appareil Spotify Connect prêt avec ID:', device_id);
        if (typeof player.setVolume === 'function') {
          player.setVolume(1.0).catch(() => {});
        }
        onReady(device_id);
      });

      player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.warn('⚠️ [Web Playback SDK] L\'appareil Spotify Connect s\'est déconnecté:', device_id);
      });

      player.addListener('initialization_error', ({ message }: { message: string }) => {
        console.error('❌ [Web Playback SDK] Erreur initialisation:', message);
        onError(message);
      });

      player.addListener('playback_error', ({ message }: { message: string }) => {
        console.error('❌ [Web Playback SDK] Erreur lecture audio (playback_error):', message);
        onError(`Erreur audio : ${message}`);
        // Tenter d'activer l'élément audio au cas où le flux a calé
        if (typeof player.activateElement === 'function') {
          player.activateElement().catch(() => {});
        }
      });

      player.addListener('autoplay_failed', () => {
        console.warn('⚠️ [Web Playback SDK] Autoplay restreint par le navigateur. Tentative d\'activation audio...');
        if (typeof player.activateElement === 'function') {
          player.activateElement().catch(() => {});
        }
      });

      player.addListener('authentication_error', async ({ message }: { message: string }) => {
        console.warn('❌ [Web Playback SDK] Erreur authentification:', message);
        onError(message);
        // Tentative de rafraîchissement immédiat en cas d'erreur d'auth et reconnexion
        if (authConfig?.clientId && authConfig?.refreshToken) {
          try {
            console.log('🔄 [Web Playback SDK] Renouvellement automatique du jeton après 401...');
            const refreshed = await refreshSpotifyAccessToken(authConfig.clientId, authConfig.refreshToken);
            activeToken = refreshed.accessToken;
            if (authConfig.onTokenRefreshed) {
              authConfig.onTokenRefreshed(refreshed.accessToken, refreshed.refreshToken, Date.now() + refreshed.expiresIn * 1000);
            }
            player.connect();
          } catch (reErr) {
            console.warn('❌ [Web Playback SDK] Échec du renouvellement après 401:', reErr);
          }
        }
      });

      player.addListener('account_error', ({ message }: { message: string }) => {
        console.warn('❌ [Web Playback SDK] Erreur de compte (Spotify Premium requis):', message);
        onError(message);
      });

      player.addListener('player_state_changed', (state: any) => {
        if (!state) return;
        // Si la lecture démarre, s'assurer que l'élément audio du lecteur est actif
        if (!state.paused && typeof player.activateElement === 'function') {
          player.activateElement().catch(() => {});
        }

        if (!state.track_window?.current_track) return;
        const t = state.track_window.current_track;
        onStateChange({
          id: t.id,
          title: t.name,
          artist: t.artists?.map((a: any) => a.name).join(', ') || 'Artiste inconnu',
          album: t.album?.name || '',
          coverUrl: t.album?.images?.[0]?.url || '',
          durationMs: state.duration || 0,
          progressMs: state.position || 0,
          isPlaying: !state.paused,
          deviceName: devName,
          deviceId: 'web-playback-device',
        });
      });

      player.connect().then((success: boolean) => {
        if (success) {
          console.log('📡 [Web Playback SDK] player.connect() réussi — appareil visible dans Spotify Connect');
        } else {
          console.warn('⚠️ [Web Playback SDK] player.connect() a retourné false');
        }
      }).catch((connErr: any) => {
        console.error('❌ [Web Playback SDK] Exception lors de player.connect():', connErr);
      });

      playerInstance = player;
      (window as any).SpotifyPlayerInstance = player;
    } catch (err: any) {
      console.warn('❌ [Web Playback SDK] Exception instanciation:', err);
      onError(err?.message || 'Erreur instanciation');
    }
  };

  const SpotifySDK = (window as any).Spotify;
  if (SpotifySDK && SpotifySDK.Player) {
    startPlayer(SpotifySDK);
  } else {
    console.log('⏳ [Web Playback SDK] En attente du chargement du script Spotify SDK...');
    const prevHandler = (window as any).onSpotifyWebPlaybackSDKReady;
    (window as any).onSpotifyWebPlaybackSDKReady = () => {
      if (typeof prevHandler === 'function') {
        try { prevHandler(); } catch (_) {}
      }
      const sdk = (window as any).Spotify;
      if (sdk && sdk.Player) {
        startPlayer(sdk);
      }
    };

    // Fallback polling si l'événement a déjà tiré ou est retardé
    let attempts = 0;
    retryTimer = setInterval(() => {
      attempts++;
      const sdk = (window as any).Spotify;
      if (sdk && sdk.Player) {
        clearInterval(retryTimer);
        startPlayer(sdk);
      } else if (attempts > 60) {
        clearInterval(retryTimer);
        console.warn('❌ [Web Playback SDK] Délai dépassé (30s) en attente du script SDK');
      }
    }, 500);
  }

  return () => {
    isCancelled = true;
    if (retryTimer) clearInterval(retryTimer);
    if (playerInstance) {
      try {
        console.log('🔌 [Web Playback SDK] Déconnexion du lecteur Spotify');
        playerInstance.disconnect();
      } catch (_) {}
      playerInstance = null;
    }
  };
}

export interface ApiTestResult {
  apiName: string;
  status: 'success' | 'error' | 'warning';
  statusCode?: number;
  message: string;
  data?: any;
}

export async function testSpotifyUserApi(token: string): Promise<ApiTestResult> {
  const analysis = analyzeTokenString(token);
  if (analysis.status === 'is_client_id') {
    return {
      apiName: 'Spotify Auth (/v1/me)',
      status: 'error',
      statusCode: 400,
      message: 'Attention : Vous avez saisi un "Client ID" (32 caractères) au lieu d\'un "Access Token". Un Access Token commence par "BQ...".',
    };
  }
  if (!token.trim()) {
    return {
      apiName: 'Spotify Auth (/v1/me)',
      status: 'warning',
      message: 'Aucun token renseigné. Le plugin fonctionne en mode simulation / démo.',
    };
  }

  try {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    if (res.ok) {
      const data = await res.json();
      return {
        apiName: 'Spotify Auth (/v1/me)',
        status: 'success',
        statusCode: res.status,
        message: `✓ Authentifié avec succès : ${data.display_name || data.id} (${data.product === 'premium' ? '★ Spotify Premium' : data.product || 'Standard'})`,
        data,
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      return {
        apiName: 'Spotify Auth (/v1/me)',
        status: 'error',
        statusCode: res.status,
        message: `Erreur Spotify (${res.status}) : ${errData.error?.message || res.statusText}`,
        data: errData,
      };
    }
  } catch (err: any) {
    return {
      apiName: 'Spotify Auth (/v1/me)',
      status: 'error',
      message: `Erreur réseau : ${err.message || String(err)}`,
    };
  }
}

export async function testSpotifyDevicesApi(token: string): Promise<ApiTestResult> {
  if (!token.trim()) {
    return {
      apiName: 'Spotify Enceintes (/v1/me/player/devices)',
      status: 'warning',
      message: `Mode Démo : 4 appareils simulés (${DEMO_DEVICES.map((d) => d.name).join(', ')})`,
      data: DEMO_DEVICES,
    };
  }

  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    if (res.ok) {
      const data = await res.json();
      const devices: SpotifyDevice[] = data.devices || [];
      const names = devices.map((d) => `"${d.name}" (${d.type})`).join(', ');
      return {
        apiName: 'Spotify Enceintes (/v1/me/player/devices)',
        status: 'success',
        statusCode: res.status,
        message: `✓ ${devices.length} appareil(s) Spotify Connect en ligne : ${names || 'Aucun appareil actif actuellement'}`,
        data: devices,
      };
    } else {
      return {
        apiName: 'Spotify Enceintes (/v1/me/player/devices)',
        status: 'error',
        statusCode: res.status,
        message: `Erreur HTTP ${res.status} lors de la détection des appareils.`,
      };
    }
  } catch (err: any) {
    return {
      apiName: 'Spotify Enceintes (/v1/me/player/devices)',
      status: 'error',
      message: `Erreur réseau : ${err.message || String(err)}`,
    };
  }
}

export async function testSpotifyPlayerApi(token: string): Promise<ApiTestResult> {
  if (!token.trim()) {
    return {
      apiName: 'Spotify Lecteur (/v1/me/player)',
      status: 'warning',
      message: `Mode Démo actif. Morceau simulé : "Retro Arcade Groove" sur "Borne Kaïro".`,
    };
  }

  try {
    const res = await fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${token.trim()}` },
    });
    if (res.status === 204) {
      return {
        apiName: 'Spotify Lecteur (/v1/me/player)',
        status: 'warning',
        statusCode: 204,
        message: 'Spotify est connecté, mais aucun morceau n\'est actuellement en cours de lecture.',
      };
    }
    if (res.ok) {
      const data = await res.json();
      const title = data.item?.name || 'Inconnu';
      const artist = data.item?.artists?.map((a: any) => a.name).join(', ') || '';
      const device = data.device?.name || 'Inconnu';
      const isPlaying = data.is_playing ? 'En lecture ▶' : 'En pause ⏸';
      return {
        apiName: 'Spotify Lecteur (/v1/me/player)',
        status: 'success',
        statusCode: res.status,
        message: `✓ ${isPlaying} : "${title}" - ${artist} (sur ${device})`,
        data,
      };
    } else {
      return {
        apiName: 'Spotify Lecteur (/v1/me/player)',
        status: 'error',
        statusCode: res.status,
        message: `Erreur HTTP ${res.status}`,
      };
    }
  } catch (err: any) {
    return {
      apiName: 'Spotify Lecteur (/v1/me/player)',
      status: 'error',
      message: `Erreur réseau : ${err.message || String(err)}`,
    };
  }
}

export async function testLyricsApi(title: string, artist: string): Promise<ApiTestResult> {
  try {
    const lines = await fetchLyrics(title, artist);
    if (lines.length > 0) {
      return {
        apiName: 'LRCLIB Paroles Karaoké',
        status: 'success',
        message: `✓ ${lines.length} lignes de paroles synchronisées récupérées avec succès pour "${title}" (${artist}).`,
        data: lines.slice(0, 3),
      };
    } else {
      return {
        apiName: 'LRCLIB Paroles Karaoké',
        status: 'warning',
        message: `Aucune parole synchronisée trouvée sur LRCLIB pour "${title}" (${artist}).`,
      };
    }
  } catch (err: any) {
    return {
      apiName: 'LRCLIB Paroles Karaoké',
      status: 'error',
      message: `Erreur LRCLIB : ${err.message || String(err)}`,
    };
  }
}

/**
 * Reprend la lecture (Web Playback SDK local ou Web API Spotify)
 */
export async function spotifyPlay(token?: string): Promise<boolean> {
  try {
    const player = (window as any).SpotifyPlayerInstance;
    if (player && typeof player.resume === 'function') {
      await player.resume();
      return true;
    }
    if (token) {
      const res = await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    }
  } catch (err) {
    console.warn('[Spotify Controls] Erreur lecture:', err);
  }
  return false;
}

/**
 * Met en pause la lecture (Web Playback SDK local ou Web API Spotify)
 */
export async function spotifyPause(token?: string): Promise<boolean> {
  try {
    const player = (window as any).SpotifyPlayerInstance;
    if (player && typeof player.pause === 'function') {
      await player.pause();
      return true;
    }
    if (token) {
      const res = await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    }
  } catch (err) {
    console.warn('[Spotify Controls] Erreur pause:', err);
  }
  return false;
}

/**
 * Passe au morceau suivant
 */
export async function spotifyNextTrack(token?: string): Promise<boolean> {
  try {
    const player = (window as any).SpotifyPlayerInstance;
    if (player && typeof player.nextTrack === 'function') {
      await player.nextTrack();
      return true;
    }
    if (token) {
      const res = await fetch('https://api.spotify.com/v1/me/player/next', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    }
  } catch (err) {
    console.warn('[Spotify Controls] Erreur morceau suivant:', err);
  }
  return false;
}

/**
 * Revient au morceau précédent
 */
export async function spotifyPreviousTrack(token?: string): Promise<boolean> {
  try {
    const player = (window as any).SpotifyPlayerInstance;
    if (player && typeof player.previousTrack === 'function') {
      await player.previousTrack();
      return true;
    }
    if (token) {
      const res = await fetch('https://api.spotify.com/v1/me/player/previous', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    }
  } catch (err) {
    console.warn('[Spotify Controls] Erreur morceau précédent:', err);
  }
  return false;
}

/**
 * Vérifie si le morceau est dans les favoris
 */
export async function checkTrackIsFavorite(trackId?: string, token?: string): Promise<boolean> {
  if (!trackId || !token) return false;
  try {
    const res = await fetch(`https://api.spotify.com/v1/me/tracks/contains?ids=${trackId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data && data[0]);
    }
  } catch (err) {
    console.warn('[Spotify Controls] Erreur vérification favori:', err);
  }
  return false;
}

/**
 * Ajoute (PUT /v1/me/tracks) ou retire (DELETE /v1/me/tracks) un titre des favoris
 */
export async function toggleFavoriteTrack(trackId: string, token: string, currentlyFav: boolean): Promise<boolean> {
  if (!trackId) return !currentlyFav;
  if (!token) return !currentlyFav;
  try {
    const method = currentlyFav ? 'DELETE' : 'PUT';
    const res = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${trackId}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    if (res.ok) {
      return !currentlyFav;
    }
  } catch (err) {
    console.warn('[Spotify Controls] Erreur bascule favori:', err);
  }
  return currentlyFav;
}

/**
 * Bascule le mode aléatoire (Shuffle)
 */
export async function spotifyToggleShuffle(token: string, currentShuffle: boolean): Promise<boolean> {
  if (!token) return !currentShuffle;
  try {
    const nextState = !currentShuffle;
    const res = await fetch(`https://api.spotify.com/v1/me/player/shuffle?state=${nextState}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      return nextState;
    }
  } catch (err) {
    console.warn('[Spotify Controls] Erreur toggle shuffle:', err);
  }
  return currentShuffle;
}
