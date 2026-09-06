export interface LyricLine {
  timeMs: number;
  text: string;
}

const FALLBACK_LYRICS: Record<string, LyricLine[]> = {
  'Retro Arcade Groove': [
    { timeMs: 0, text: "? KA�RO-OS RETRO ARCADE GROOVE ?" },
    { timeMs: 4000, text: "Bienvenue sur votre borne d'arcade Ka�ro" },
    { timeMs: 8000, text: "Le son sort directement sur les enceintes de la borne !" },
    { timeMs: 13000, text: "Pr�t pour une session de jeu l�gendaire ?" },
    { timeMs: 18000, text: "Appuyez sur un bouton de la manette pour quitter la veille" },
    { timeMs: 23000, text: "Ou laissez la musique jouer en arri�re-plan..." },
    { timeMs: 28000, text: "100% Gamepad First � Z�ro configuration complexe" },
    { timeMs: 33000, text: "? KA�RO CONNECT SOUND SYSTEM ?" },
  ],
};

export async function fetchLyrics(track: string, artist: string): Promise<LyricLine[]> {
  if (FALLBACK_LYRICS[track]) {
    return FALLBACK_LYRICS[track];
  }

  try {
    const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(track)}&artist_name=${encodeURIComponent(artist)}`;
    const res = await fetch(url);
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    if (!data || !data.syncedLyrics) {
      return [];
    }
    return parseLrc(data.syncedLyrics);
  } catch (err) {
    console.warn('[LRCLIB] Erreur r�cup�ration paroles:', err);
    return [];
  }
}

/**
 * Parse les paroles format LRC : [mm:ss.xx] Paroles
 */
export function parseLrc(lrcContent: string): LyricLine[] {
  const lines = lrcContent.split('\n');
  const result: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const line of lines) {
    const match = regex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millis = parseInt(match[3].padEnd(3, '0').slice(0, 3), 10);
      const timeMs = minutes * 60 * 1000 + seconds * 1000 + millis;
      const text = match[4].trim();
      if (text) {
        result.push({ timeMs, text });
      }
    }
  }

  return result.sort((a, b) => a.timeMs - b.timeMs);
}
