import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getPlugins, getPlugin, updatePluginSettings } from '../../api';
import { PluginInfo } from '../../types';

interface PluginScreensaverHostProps {
  isGameRunning?: boolean;
  remotePort?: number;
}

export type ScreensaverVisualMode = 'fullscreen' | 'minimized' | 'hidden';

/**
 * PluginScreensaverHost
 * 
 * Composant hôte 100% découplé (Règle 1 — Zéro trace croisée) :
 * - Découvre dynamiquement tout plugin activé déclarant contribuer à "kairo-screensaver".
 * - Monte une iframe persistante en arrière-plan avec les permissions Web Audio / DRM requises ("encrypted-media *; autoplay *").
 * - Gère 3 modes d'affichage :
 *     1. 'fullscreen' : Plein écran immersif avec paroles karaoké.
 *     2. 'minimized' : Widget compact flottant en bas à droite au-dessus de l'interface ou des jeux.
 *     3. 'hidden' : Invisible en arrière-plan (maintient la connexion audio Spotify Connect active sans coupure).
 * - Raccourci global touche Inser (Insert) : bascule entre Plein Écran, Minimisé et Masqué.
 * - Écoute de l'événement personnalisé 'kairo_open_music_player' (déclenché depuis les réglages).
 */
export const PluginScreensaverHost: React.FC<PluginScreensaverHostProps> = ({
  isGameRunning = false,
  remotePort = 8080,
}) => {
  const [activePlugin, setActivePlugin] = useState<PluginInfo | null>(null);
  const [viewMode, setViewMode] = useState<ScreensaverVisualMode>('hidden');
  const [iframeSrc, setIframeSrc] = useState<string>('');

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // 1. Découverte dynamique de plugins contribuant un écran de veille (Règle 1 & 2)
  const discoverScreensaverPlugin = useCallback(async () => {
    try {
      const plugins = await getPlugins();
      if (!Array.isArray(plugins)) return;

      // Recherche sans référence hardcodée à un plugin spécifique
      const found = plugins.find((p) => {
        if (!p.enabled) return false;
        const contribs = p.contributes as any;
        if (!contribs) return false;

        const targets = contribs.to;
        if (Array.isArray(targets) && targets.includes('kairo-screensaver')) {
          return true;
        }
        if (contribs.screensaver || contribs.points?.screensaver) {
          return true;
        }
        return false;
      });

      if (found) {
        setActivePlugin(found);
        try {
          const detail = await getPlugin(found.id);
          const currentSettings = detail?.settings || {};

          const contribs = found.contributes as any;
          const entryPoint =
            contribs?.screensaver?.entry ||
            contribs?.points?.screensaver?.entry ||
            found.ui ||
            'dist/index.html';

          // Nettoyage de l'entrée relative
          const cleanEntry = entryPoint.startsWith('/') ? entryPoint.slice(1) : entryPoint;
          const port = remotePort || 8080;
          const url = `http://127.0.0.1:${port}/plugins/${found.id}/${cleanEntry}#settings=${encodeURIComponent(
            JSON.stringify(currentSettings)
          )}`;

          setIframeSrc((prev) => (prev === url ? prev : url));
        } catch (detailErr) {
          console.warn('[PluginScreensaverHost] Erreur chargement détails plugin:', detailErr);
        }
      } else {
        setActivePlugin(null);
        setIframeSrc('');
      }
    } catch (err) {
      console.warn('[PluginScreensaverHost] Découverte plugins impossible:', err);
    }
  }, [remotePort]);

  useEffect(() => {
    discoverScreensaverPlugin();
    // Vérification périodique (au démarrage et si des plugins sont activés/désactivés)
    const interval = setInterval(() => {
      discoverScreensaverPlugin();
    }, 4000);
    return () => clearInterval(interval);
  }, [discoverScreensaverPlugin]);

  // 2. Écoute des messages postMessage provenant de l'iframe du plugin
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      const { type, mode, active, id, settings } = event.data;

      // Changement de mode visuel (fullscreen / minimized / hidden)
      if (type === 'screensaver_view_mode' && mode) {
        if (mode === 'fullscreen' || mode === 'minimized' || mode === 'hidden') {
          setViewMode(mode);
        }
      } else if (type === 'screensaver_state') {
        if (active) {
          setViewMode((prev) => (prev === 'hidden' ? 'fullscreen' : prev));
        } else {
          setViewMode('hidden');
        }
      }

      // Mise à jour de réglages (ex: jeton renouvelé par PKCE)
      if (type === 'update_plugin_settings' && id && settings) {
        try {
          await updatePluginSettings(id, settings);
        } catch (err) {
          console.warn('[PluginScreensaverHost] Erreur sauvegarde réglages plugin:', err);
        }
      }

      // Transmission directe des réglages vers l'iframe en temps réel
      if (type === 'kairo_update_settings' && settings) {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'kairo_update_settings', settings }, '*');
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Écoute de l'événement personnalisé de mise à jour des paramètres
  useEffect(() => {
    const handlePluginSettingsUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      const newSettings = customEvt.detail?.settings;
      if (newSettings && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: 'kairo_update_settings', settings: newSettings },
          '*'
        );
      }
    };

    window.addEventListener('kairo_update_plugin_settings', handlePluginSettingsUpdate);
    return () => window.removeEventListener('kairo_update_plugin_settings', handlePluginSettingsUpdate);
  }, []);

  // 3. Raccourci global touche Inser (Insert) et déblocage audio instantané
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Débloquer l'élément audio du lecteur Spotify dans l'iframe dès une touche pressée
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: 'kairo_unlock_audio' }, '*');
      }

      if (e.key === 'Insert' || e.code === 'Insert') {
        e.preventDefault();
        setViewMode((prev) => {
          let nextMode: ScreensaverVisualMode;
          if (prev === 'hidden') {
            nextMode = isGameRunning ? 'minimized' : 'fullscreen';
          } else if (prev === 'fullscreen') {
            nextMode = 'minimized';
          } else {
            nextMode = isGameRunning ? 'hidden' : 'fullscreen';
          }

          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              { type: 'kairo_set_view_mode', mode: nextMode },
              '*'
            );
          }
          return nextMode;
        });
      }
    };

    const handleGlobalPointerDown = () => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: 'kairo_unlock_audio' }, '*');
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    window.addEventListener('pointerdown', handleGlobalPointerDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      window.removeEventListener('pointerdown', handleGlobalPointerDown, true);
    };
  }, [isGameRunning]);

  // 4. Détection de mouvement globale :
  // Si un mouvement (souris, clavier, tactile, molette, manette) est détecté alors que l'affichage est maximisé,
  // il doit immédiatement revenir en mode minimisé.
  useEffect(() => {
    let lastActivityTime = Date.now();

    const handleUserMotion = () => {
      const now = Date.now();
      if (now - lastActivityTime < 30) return;
      lastActivityTime = now;

      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: 'kairo_unlock_audio' }, '*');
        iframeRef.current.contentWindow.postMessage({ type: 'kairo_activity' }, '*');
      }

      if (viewMode === 'fullscreen') {
        setViewMode('minimized');
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: 'kairo_set_view_mode', mode: 'minimized' },
            '*'
          );
        }
      }
    };

    const events = ['mousemove', 'mousedown', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    const onEvent = (e: Event) => {
      if (e.type === 'keydown' && ((e as KeyboardEvent).key === 'Insert' || (e as KeyboardEvent).code === 'Insert')) {
        return;
      }
      handleUserMotion();
    };

    events.forEach((evt) => window.addEventListener(evt, onEvent, { capture: true, passive: true }));

    // Surveillance de la manette (Gamepad API) à 60Hz
    const gamepadInterval = setInterval(() => {
      try {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        let hasGamepadInput = false;

        for (const gp of gamepads) {
          if (!gp) continue;
          for (let i = 0; i < gp.buttons.length; i++) {
            if (gp.buttons[i]?.pressed) {
              hasGamepadInput = true;
              break;
            }
          }
          if (hasGamepadInput) break;
          for (let i = 0; i < gp.axes.length; i++) {
            if (Math.abs(gp.axes[i] || 0) > 0.25) {
              hasGamepadInput = true;
              break;
            }
          }
          if (hasGamepadInput) break;
        }

        if (hasGamepadInput) {
          handleUserMotion();
        }
      } catch (_) {}
    }, 60);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, onEvent, { capture: true } as any));
      clearInterval(gamepadInterval);
    };
  }, [viewMode]);

  // 4. Écoute de l'événement personnalisé pour ouverture manuelle
  useEffect(() => {
    const handleOpenMusicPlayer = (e: Event) => {
      const customEvt = e as CustomEvent;
      const targetMode: ScreensaverVisualMode = customEvt.detail?.mode || 'fullscreen';
      setViewMode(targetMode);
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: 'kairo_set_view_mode', mode: targetMode },
          '*'
        );
      }
    };

    window.addEventListener('kairo_open_music_player', handleOpenMusicPlayer);
    return () => window.removeEventListener('kairo_open_music_player', handleOpenMusicPlayer);
  }, []);

  // 5. Si un jeu se lance, le plugin est invisible dans tous les cas (Règle stricte)
  useEffect(() => {
    if (isGameRunning && viewMode !== 'hidden') {
      setViewMode('hidden');
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: 'kairo_set_view_mode', mode: 'hidden' },
          '*'
        );
      }
    }
  }, [isGameRunning, viewMode]);

  // Si aucun plugin screensaver activé n'a été trouvé, rien à monter
  if (!activePlugin || !iframeSrc) {
    return null;
  }

  // Styles selon le mode visuel demandé
  // Mode 1 : Plein Écran (z-[9990])
  // Mode 2 : Minimisé Flottant en bas à droite (z-[9995], au-dessus de l'UI si aucun jeu n'est lancé)
  // Mode 3 : Caché (invisible en arrière-plan pour maintenir la session Spotify Connect sans coupure)
  const isFullscreen = viewMode === 'fullscreen' && !isGameRunning;
  const isMinimized = viewMode === 'minimized' && !isGameRunning;
  const isHidden = viewMode === 'hidden' || isGameRunning;

  let containerClasses = 'fixed transition-all duration-300 ease-out select-none';

  if (isFullscreen) {
    containerClasses += ' inset-0 w-full h-full z-[9990] opacity-100 pointer-events-auto bg-slate-950';
  } else if (isMinimized) {
    containerClasses +=
      ' bottom-6 right-6 w-96 h-28 z-[9995] opacity-100 pointer-events-auto rounded-2xl shadow-2xl overflow-hidden border border-white/15';
  } else {
    containerClasses += ' inset-0 w-full h-full -z-[9990] opacity-0 pointer-events-none';
  }

  return (
    <div
      aria-hidden={isHidden}
      className={containerClasses}
    >
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        allow="encrypted-media *; autoplay *; clipboard-write *"
        className="w-full h-full border-none bg-transparent"
        title="KaïroOS Plugin Screensaver Host"
      />
    </div>
  );
};
