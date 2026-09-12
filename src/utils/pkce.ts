/**
 * Utilitaires d\'authentification Spotify OAuth 2.0 PKCE (Proof Key for Code Exchange)
 * Conforme RFC 7636 et aux exigences Spotify Web API 2025+.
 */

export interface SpotifyTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  expiresAt: number; // timestamp ms
  scope?: string;
}

export interface SpotifyAuthData {
  type: 'code' | 'access_token' | 'json' | 'unknown';
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  raw: string;
}

/**
 * Genere un verificateur aleatoire cryptographiquement securise (43 a 128 caracteres)
 */
export function generateCodeVerifier(length = 64): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values).map((x) => possible[x % possible.length]).join('');
}

/**
 * Calcule le code_challenge SHA-256 en Base64URL sans padding (RFC 7636)
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Construit l\'URL d\'autorisation officielle Spotify PKCE
 */
export async function buildSpotifyPkceAuthUrl(
  clientId: string,
  redirectUri: string,
  codeVerifier: string,
  scopes: string[] = [
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'streaming',
    'user-read-private',
    'user-read-email',
  ]
): Promise<string> {
  const challenge = await generateCodeChallenge(codeVerifier);
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    response_type: 'code',
    redirect_uri: redirectUri.trim(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: scopes.join(' '),
    show_dialog: 'true',
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * Echange le code d'autorisation contre des jetons d'acces et de rafraichissement
 */
export async function exchangeCodeForTokens(
  clientId: string,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<SpotifyTokens> {
  const params = new URLSearchParams({
    client_id: clientId.trim(),
    grant_type: 'authorization_code',
    code: code.trim(),
    redirect_uri: redirectUri.trim(),
    code_verifier: codeVerifier.trim(),
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
    throw new Error(errData.error_description || errData.error || `Erreur d'échange de code (${res.status})`);
  }

  const data = await res.json();
  const expiresIn = Number(data.expires_in) || 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: data.scope,
  };
}

/**
 * Rafraichit un access token a partir d'un refresh token (sans nouvelle invite utilisateur)
 */
export async function refreshSpotifyToken(
  clientId: string,
  refreshToken: string
): Promise<SpotifyTokens> {
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
    throw new Error(errData.error_description || errData.error || `Erreur renouvellement jeton (${res.status})`);
  }

  const data = await res.json();
  const expiresIn = Number(data.expires_in) || 3600;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Spotify peut retourner un nouveau refresh_token ou conserver l\'existant
    expiresIn,
    expiresAt: Date.now() + expiresIn * 1000,
    scope: data.scope,
  };
}

/**
 * Analyse intelligemment le texte colle (URL de redirection, JSON ou jeton direct)
 */
export function extractSpotifyAuthData(input: string): SpotifyAuthData {
  const trimmed = input.trim();
  if (!trimmed) {
    return { type: 'unknown', raw: '' };
  }

  // Cas 1 : URL avec parametre code=... (Authorization Code Flow)
  const matchCode = trimmed.match(/[?&#]code=([^&]+)/);
  if (matchCode && matchCode[1]) {
    return {
      type: 'code',
      code: decodeURIComponent(matchCode[1]),
      raw: trimmed,
    };
  }

  // Cas 2 : JSON contenant access_token, code ou refresh_token
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.code && typeof parsed.code === 'string') {
      return { type: 'code', code: parsed.code.trim(), raw: trimmed };
    }
    if (parsed.access_token && typeof parsed.access_token === 'string') {
      return {
        type: 'json',
        accessToken: parsed.access_token.trim(),
        refreshToken: typeof parsed.refresh_token === 'string' ? parsed.refresh_token.trim() : undefined,
        raw: trimmed,
      };
    }
  } catch {}

  // Cas 3 : URL avec hash access_token=... (Implicit Grant / Legacy)
  const matchHashToken = trimmed.match(/access_token=([^&]+)/);
  if (matchHashToken && matchHashToken[1]) {
    return {
      type: 'access_token',
      accessToken: decodeURIComponent(matchHashToken[1]),
      raw: trimmed,
    };
  }

  // Cas 4 : Jeton BQ... brut
  const matchBq = trimmed.match(/(BQ[A-Za-z0-9_-]{50,})/);
  if (matchBq && matchBq[1]) {
    return {
      type: 'access_token',
      accessToken: matchBq[1],
      raw: trimmed,
    };
  }

  // Cas 5 : Si commence par BQ direct
  if (trimmed.startsWith('BQ') && trimmed.length > 30) {
    return {
      type: 'access_token',
      accessToken: trimmed,
      raw: trimmed,
    };
  }

  // Cas 6 : Si ressemble a un code d'autorisation brut (environ 100-250 car. alphanumeriques)
  if (trimmed.length > 40 && !trimmed.includes(' ') && !trimmed.includes('/')) {
    return {
      type: 'code',
      code: trimmed,
      raw: trimmed,
    };
  }

  return { type: 'unknown', raw: trimmed };
}
