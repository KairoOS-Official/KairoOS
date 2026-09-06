export interface ScrapedResult {
  found: boolean;
  title: string;
  system_id?: string;
  cover_url?: string;
  backdrop_url?: string;
  screenshots?: string[];
  video_url?: string;
  release_date?: string;
  developer?: string;
  publisher?: string;
  genre?: string;
  rating?: number;
  players?: number;
  synopsis?: string;
  source?: 'known' | 'libretro' | 'wikipedia' | 'screenscraper';
}

import { mkdir, writeFile } from '@tauri-apps/plugin-fs';
import { dirname, join } from '@tauri-apps/api/path';
import { fetch } from '@tauri-apps/plugin-http';

export async function downloadGameMedia(
  gameFilePath: string,
  mediaUrls: { cover?: string; backdrop?: string; screenshots?: string[]; video?: string }
): Promise<{ cover_url?: string; backdrop_url?: string; screenshots?: string[]; video_url?: string }> {
  const gameDir = await dirname(gameFilePath);
  const mediaDir = await join(gameDir, 'media');
  const screenshotsDir = await join(mediaDir, 'screenshots');
  const videosDir = await join(mediaDir, 'videos');

  // Create directories
  await mkdir(mediaDir, { recursive: true }).catch(() => {});
  await mkdir(screenshotsDir, { recursive: true }).catch(() => {});
  await mkdir(videosDir, { recursive: true }).catch(() => {});

  const result: { cover_url?: string; backdrop_url?: string; screenshots?: string[]; video_url?: string } = {};

  const downloadFile = async (url: string, destPath: string) => {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buffer = await res.arrayBuffer();
        await writeFile(destPath, new Uint8Array(buffer));
        return destPath;
      }
    } catch (err) {
      console.warn('Failed to download', url, err);
    }
    return undefined;
  };

  if (mediaUrls.cover) {
    const ext = mediaUrls.cover.split('.').pop()?.split('?')[0] || 'png';
    const dest = await join(mediaDir, `cover.${ext}`);
    const savedPath = await downloadFile(mediaUrls.cover, dest);
    if (savedPath) result.cover_url = savedPath;
  }

  if (mediaUrls.backdrop) {
    const ext = mediaUrls.backdrop.split('.').pop()?.split('?')[0] || 'jpg';
    const dest = await join(mediaDir, `backdrop.${ext}`);
    const savedPath = await downloadFile(mediaUrls.backdrop, dest);
    if (savedPath) result.backdrop_url = savedPath;
  }

  if (mediaUrls.video) {
    const ext = mediaUrls.video.split('.').pop()?.split('?')[0] || 'mp4';
    const dest = await join(videosDir, `trailer.${ext}`);
    const savedPath = await downloadFile(mediaUrls.video, dest);
    if (savedPath) result.video_url = savedPath;
  }

  if (mediaUrls.screenshots && mediaUrls.screenshots.length > 0) {
    result.screenshots = [];
    for (let i = 0; i < mediaUrls.screenshots.length; i++) {
      const url = mediaUrls.screenshots[i];
      const ext = url.split('.').pop()?.split('?')[0] || 'png';
      const dest = await join(screenshotsDir, `screenshot_${i + 1}.${ext}`);
      const savedPath = await downloadFile(url, dest);
      if (savedPath) result.screenshots.push(savedPath);
    }
  }

  return result;
}

// Correspondance des systèmes Kaïro vers les dépôts officiels Libretro Thumbnails
export const LIBRETRO_SYSTEM_FOLDERS: Record<string, string> = {
  snes: 'Nintendo_-_Super_Nintendo_Entertainment_System',
  nes: 'Nintendo_-_Nintendo_Entertainment_System',
  n64: 'Nintendo_-_Nintendo_64',
  gamecube: 'Nintendo_-_GameCube',
  gc: 'Nintendo_-_GameCube',
  wii: 'Nintendo_-_Wii',
  gb: 'Nintendo_-_Game_Boy',
  gbc: 'Nintendo_-_Game_Boy_Color',
  gba: 'Nintendo_-_Game_Boy_Advance',
  nds: 'Nintendo_-_Nintendo_DS',
  megadrive: 'Sega_-_Mega_Drive_-_Genesis',
  genesis: 'Sega_-_Mega_Drive_-_Genesis',
  mastersystem: 'Sega_-_Master_System_-_Mark_III',
  master_system: 'Sega_-_Master_System_-_Mark_III',
  gamegear: 'Sega_-_Game_Gear',
  saturn: 'Sega_-_Saturn',
  dreamcast: 'Sega_-_Dreamcast',
  psx: 'Sony_-_PlayStation',
  ps1: 'Sony_-_PlayStation',
  ps2: 'Sony_-_PlayStation_2',
  psp: 'Sony_-_PlayStation_Portable',
  arcade: 'FBNeo_-_Arcade_Games',
  mame: 'MAME',
  neogeo: 'SNK_-_Neo_Geo',
  atari2600: 'Atari_-_2600',
  atari7800: 'Atari_-_7800',
  pcengine: 'NEC_-_PC_Engine_-_TurboGrafx_16',
  tg16: 'NEC_-_PC_Engine_-_TurboGrafx_16',
};

// Dictionnaire de correspondances connues pour homebrews et grands classiques
const KNOWN_GAMES: Record<string, Partial<ScrapedResult>> = {
  'uwol': {
    title: 'Uwol: Quest For Money',
    system_id: 'snes',
    genre: 'Plateforme / Arcade',
    developer: 'The Mojon Twins',
    publisher: 'Homebrew',
    release_date: '2010',
    rating: 4.7,
    players: 1,
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co3w4f.png',
    backdrop_url: 'https://images.igdb.com/igdb/image/upload/t_1080p/sc7xvd.jpg',
    synopsis: 'Aidez Uwol à récupérer un maximum de pièces d\'or dans le mystérieux manoir de Stormlord.',
  },
  'classic kong': {
    title: 'Classic Kong Complete',
    system_id: 'snes',
    genre: 'Plateforme / Arcade',
    developer: 'Bubble Zap Productions',
    publisher: 'Homebrew',
    release_date: '2012',
    rating: 4.7,
    players: 2,
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1x7e.png',
    backdrop_url: 'https://images.igdb.com/igdb/image/upload/t_1080p/sc7yud.jpg',
    synopsis: 'Portage fidèle et soigné du classique Donkey Kong pour Super Nintendo.',
  },
  'street fighter': {
    title: 'Street Fighter II: Champion Edition',
    genre: 'Combat / Versus',
    developer: 'Capcom',
    publisher: 'Capcom',
    release_date: '1992',
    rating: 4.8,
    players: 2,
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1r2s.png',
    backdrop_url: 'https://images.igdb.com/igdb/image/upload/t_1080p/sc7xvd.jpg',
    synopsis: 'Le roi des jeux de combat 2D en arcade. Choisissez parmi 12 combattants légendaires.',
  },
  'metal slug': {
    title: 'Metal Slug 3',
    genre: 'Run and Gun / Arcade',
    developer: 'SNK',
    publisher: 'SNK',
    release_date: '1999',
    rating: 4.7,
    players: 2,
    cover_url: 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1x3k.png',
    backdrop_url: 'https://images.igdb.com/igdb/image/upload/t_1080p/sc7yud.jpg',
    synopsis: 'Action explosive à deux joueurs sur Neo-Geo avec des armes folles et des boss gigantesques.',
  },
  'super mario 64': {
    title: 'Super Mario 64',
    system_id: 'n64',
    genre: 'Plateforme 3D',
    developer: 'Nintendo EAD',
    publisher: 'Nintendo',
    release_date: '1996',
    rating: 4.95,
    players: 1,
    cover_url: 'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Nintendo_64/master/Named_Boxarts/Super%20Mario%2064%20(USA).png',
    backdrop_url: 'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Nintendo_64/master/Named_Snaps/Super%20Mario%2064%20(USA).png',
    synopsis: 'Mario saute à travers les peintures magiques du château de Peach pour récupérer les 120 étoiles dérobées par Bowser.',
  },
  'super mario world': {
    title: 'Super Mario World',
    system_id: 'snes',
    genre: 'Plateforme',
    developer: 'Nintendo EAD',
    publisher: 'Nintendo',
    release_date: '1990',
    rating: 4.9,
    players: 2,
    cover_url: 'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Super_Nintendo_Entertainment_System/master/Named_Boxarts/Super%20Mario%20World%20(USA).png',
    backdrop_url: 'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Super_Nintendo_Entertainment_System/master/Named_Snaps/Super%20Mario%20World%20(USA).png',
    synopsis: 'Mario et Yoshi voyagent à travers Dinosaur Land pour délivrer la princesse Peach.',
  },
  'zelda a link to the past': {
    title: 'The Legend of Zelda: A Link to the Past',
    system_id: 'snes',
    genre: 'Action-RPG / Aventure',
    developer: 'Nintendo',
    publisher: 'Nintendo',
    release_date: '1991',
    rating: 5.0,
    players: 1,
    cover_url: 'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Super_Nintendo_Entertainment_System/master/Named_Boxarts/Legend%20of%20Zelda%2C%20The%20-%20A%20Link%20to%20the%20Past%20(USA).png',
    backdrop_url: 'https://raw.githubusercontent.com/libretro-thumbnails/Nintendo_-_Super_Nintendo_Entertainment_System/master/Named_Snaps/Legend%20of%20Zelda%2C%20The%20-%20A%20Link%20to%20the%20Past%20(USA).png',
    synopsis: 'Link s\'éveille pour sauver Hyrule et le Monde des Ténèbres du maléfique Ganon.',
  },
  'sonic the hedgehog 2': {
    title: 'Sonic The Hedgehog 2',
    system_id: 'megadrive',
    genre: 'Plateforme / Vitesse',
    developer: 'Sonic Team',
    publisher: 'Sega',
    release_date: '1992',
    rating: 4.8,
    players: 2,
    cover_url: 'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Boxarts/Sonic%20The%20Hedgehog%202%20(World).png',
    backdrop_url: 'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Snaps/Sonic%20The%20Hedgehog%202%20(World).png',
    synopsis: 'Foncez à toute vitesse avec Sonic et Tails pour contrecarrer les plans du Dr. Robotnik.',
  },
};

/**
 * Génère des variantes de titres pour correspondre aux conventions No-Intro de Libretro
 */
function generateCandidates(rawTitle: string): string[] {
  const set = new Set<string>();

  // 1. Nettoyer l'extension de fichier si présente
  let clean = rawTitle.replace(/\.(sfc|smc|z64|n64|v64|nes|md|gen|bin|iso|chd|pbp|gba|gbc|gb|zip|7z)$/i, '');

  // 2. Nettoyer les tags entre parenthèses et crochets ([!], [b1], (USA), etc.)
  clean = clean
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[\/\?\<\>\\:\*\|"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 3. Décomposer le CamelCase (ex: UwolQuestForMoney -> Uwol Quest For Money)
  const unCamel = clean
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .trim();

  const baseNames = [clean];
  if (unCamel !== clean) baseNames.push(unCamel);

  for (const base of [...baseNames]) {
    // Variations pour l'article 'The' en tête
    if (/^The\s+/i.test(base)) {
      const noThe = base.replace(/^The\s+/i, '').trim();
      baseNames.push(`${noThe}, The`);
      if (noThe.includes(' - ')) {
        const parts = noThe.split(' - ');
        baseNames.push(`${parts[0].trim()}, The - ${parts.slice(1).join(' - ').trim()}`);
      }
    }
    // Variations pour les sous-titres avec tiret ou deux-points
    if (base.includes(' - ')) {
      baseNames.push(base.split(' - ')[0].trim());
    }
    if (base.includes(': ')) {
      baseNames.push(base.replace(': ', ' - '));
      baseNames.push(base.split(': ')[0].trim());
    }
  }

  // Suffixes régionaux standards No-Intro Libretro
  const regions = [
    ' (USA)',
    ' (Europe)',
    ' (World)',
    ' (USA, Europe)',
    ' (Japan, USA)',
    ' (Japan, USA) (En,Ja)',
    ' (Europe) (En,Fr,De)',
    ' (USA, Europe) (En,Ja)',
    ' (En,Fr,De)',
    ' (France)',
    ' (Japan)',
    '',
  ];

  for (const b of baseNames) {
    if (!b) continue;
    for (const r of regions) {
      set.add(`${b}${r}`);
    }
  }

  return Array.from(set);
}

/**
 * Recherche les jaquettes (Boxarts) et captures (Snaps) officielles sur Libretro CDN
 */
async function searchLibretroMedia(
  systemId: string,
  title: string
): Promise<{ cover_url?: string; backdrop_url?: string; matchedTitle?: string } | null> {
  const folder = LIBRETRO_SYSTEM_FOLDERS[systemId.toLowerCase()];
  if (!folder) return null;

  const candidates = generateCandidates(title);

  for (const c of candidates) {
    const boxartUrl = `https://raw.githubusercontent.com/libretro-thumbnails/${folder}/master/Named_Boxarts/${encodeURIComponent(c)}.png`;
    try {
      const res = await fetch(boxartUrl, { method: 'HEAD' });
      if (res.ok && res.status === 200) {
        const snapUrl = `https://raw.githubusercontent.com/libretro-thumbnails/${folder}/master/Named_Snaps/${encodeURIComponent(c)}.png`;
        let backdropUrl: string | undefined = undefined;
        try {
          const snapRes = await fetch(snapUrl, { method: 'HEAD' });
          if (snapRes.ok && snapRes.status === 200) {
            backdropUrl = snapUrl;
          }
        } catch {
          // snap optionnel
        }

        let cleanTitle = c.replace(/\s*\([^)]+\)/g, '').trim();
        if (cleanTitle.includes(', The')) {
          cleanTitle = 'The ' + cleanTitle.replace(', The', '');
        }

        return {
          cover_url: boxartUrl,
          backdrop_url: backdropUrl,
          matchedTitle: cleanTitle,
        };
      }
    } catch {
      // continuer sur les autres candidats
    }
  }

  return null;
}

/**
 * Recherche des métadonnées riches sur Wikipedia FR & EN
 */
async function searchWikipediaInfo(
  title: string,
  _systemId?: string
): Promise<{
  title?: string;
  synopsis?: string;
  release_date?: string;
  developer?: string;
  publisher?: string;
  genre?: string;
} | null> {
  const cleanTitle = title
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[\/\?\<\>\\:\*\|"-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const lang of ['fr', 'en']) {
    try {
      const query = encodeURIComponent(`${cleanTitle} ${lang === 'fr' ? 'jeu vidéo' : 'video game'}`);
      const searchRes = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${query}&format=json&origin=*`
      );
      if (!searchRes.ok) continue;

      const searchData = await searchRes.json();
      const hits: any[] = searchData?.query?.search || [];
      if (hits.length === 0) continue;

      let bestHit = hits[0];
      const titleWords = cleanTitle.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      for (const hit of hits.slice(0, 5)) {
        const hitLower = hit.title.toLowerCase();
        const matchesCount = titleWords.filter(w => hitLower.includes(w)).length;
        if (matchesCount === titleWords.length) {
          bestHit = hit;
          break;
        }
      }

      const pageRes = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&pageids=${bestHit.pageid}&format=json&origin=*`
      );
      if (!pageRes.ok) continue;

      const pageData = await pageRes.json();
      const page = pageData?.query?.pages?.[bestHit.pageid];
      if (!page?.extract) continue;

      const extract: string = page.extract;
      const isVideoGame = /jeu vidéo|video game|arcade|console|gameplay|nintendo|sega|playstation/i.test(extract);
      if (!isVideoGame) continue;

      const yearMatch = extract.match(/\b(19[89]\d|20[0-2]\d)\b/);
      const releaseDate = yearMatch ? yearMatch[1] : undefined;

      let developer: string | undefined = undefined;
      const devMatch = extract.match(/(?:développé par|developed by)\s+([A-Z0-9][A-Za-z0-9\s&]+?)(?=[,\.\(]| et | and )/i);
      if (devMatch) developer = devMatch[1].trim();

      let publisher: string | undefined = undefined;
      const pubMatch = extract.match(/(?:édité par|publié par|published by)\s+([A-Z0-9][A-Za-z0-9\s&]+?)(?=[,\.\(]| et | and )/i);
      if (pubMatch) publisher = pubMatch[1].trim();

      let genre: string | undefined = undefined;
      if (/plates?-formes?|platform/i.test(extract)) genre = 'Plateforme';
      else if (/action-aventure|action-adventure/i.test(extract)) genre = 'Action-Aventure';
      else if (/rôle|role-playing|rpg/i.test(extract)) genre = 'RPG';
      else if (/combat|fighting/i.test(extract)) genre = 'Combat';
      else if (/course|racing/i.test(extract)) genre = 'Course';
      else if (/shoot 'em up|tir|shooter/i.test(extract)) genre = 'Shoot \'em up';
      else if (/puzzle|réflexion/i.test(extract)) genre = 'Puzzle / Réflexion';
      else if (/arcade/i.test(extract)) genre = 'Arcade';

      const firstParagraph = extract.split('\n').filter(p => p.trim().length > 20)[0] || extract.slice(0, 300);
      const parsedTitle = bestHit.title.replace(/\s*\([^)]+\)/g, '').trim();

      return {
        title: parsedTitle,
        synopsis: firstParagraph,
        release_date: releaseDate,
        developer,
        publisher,
        genre,
      };
    } catch {
      // continuer
    }
  }

  return null;
}

/**
 * Recherche principale : orchestre le scraping multi-sources
 */
export async function searchOnlineGameMetadata(
  title: string,
  systemId?: string
): Promise<ScrapedResult> {
  const cleanQuery = title.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').trim();

  // 1. Vérification dans le dictionnaire rapide (pour homebrews spécifiques ou classiques)
  const sortedEntries = Object.entries(KNOWN_GAMES).sort((a, b) => b[0].length - a[0].length);
  for (const [key, meta] of sortedEntries) {
    if (meta.system_id && systemId && meta.system_id.toLowerCase() !== systemId.toLowerCase()) {
      continue;
    }
    if (cleanQuery.includes(key)) {
      return {
        found: true,
        source: 'known',
        title: meta.title || title,
        system_id: systemId || meta.system_id,
        cover_url: meta.cover_url,
        backdrop_url: meta.backdrop_url,
        screenshots: meta.screenshots,
        video_url: meta.video_url,
        release_date: meta.release_date,
        developer: meta.developer,
        publisher: meta.publisher,
        genre: meta.genre,
        rating: meta.rating || 4.8,
        players: meta.players || 1,
        synopsis: meta.synopsis,
      };
    }
  }

  // 2. Recherche simultanée Libretro (jaquette & backdrop) et Wikipedia (métadonnées)
  try {
    const [libretroRes, wikiRes] = await Promise.all([
      systemId ? searchLibretroMedia(systemId, title) : Promise.resolve(null),
      searchWikipediaInfo(title, systemId),
    ]);

    if (libretroRes || wikiRes) {
      return {
        found: true,
        source: libretroRes ? 'libretro' : 'wikipedia',
        title: wikiRes?.title || libretroRes?.matchedTitle || title,
        system_id: systemId,
        cover_url: libretroRes?.cover_url,
        backdrop_url: libretroRes?.backdrop_url,
        synopsis: wikiRes?.synopsis,
        release_date: wikiRes?.release_date,
        developer: wikiRes?.developer,
        publisher: wikiRes?.publisher,
        genre: wikiRes?.genre || (systemId === 'arcade' ? 'Arcade' : undefined),
        rating: 4.8,
        players: 1,
      };
    }
  } catch (err) {
    console.warn('[Scraper] Erreur lors de la recherche en ligne:', err);
  }

  // 3. Si absolument rien n'a été trouvé : retourner explicitement found: false
  // Ne pas inventer de fausses données génériques et ne pas ouvrir Google
  return {
    found: false,
    title: title,
    system_id: systemId,
  };
}

