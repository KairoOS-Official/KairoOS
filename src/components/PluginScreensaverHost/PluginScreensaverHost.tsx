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
  const lastActiveModeRef = useRef<'fullscreen' | 'minimized'>('minimized');
  const isManualFullscreenRef = useRef<boolean>(false);

  useEffect(() => {
    if (viewMode === 'fullscreen' || viewMode === 'minimized') {
      lastActiveModeRef.current = viewMode;
    }
  }, [viewMode]);

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
    // Découverte sur événement uniquement (sans boucle permanente en arrière-plan)
    window.addEventListener('kairo_plugins_changed', discoverScreensaverPlugin);
    return () => window.removeEventListener('kairo_plugins_changed', discoverScreensaverPlugin);
  }, [discoverScreensaverPlugin]);

  // 2. Écoute des messages postMessage provenant de l'iframe du plugin
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;

      const { type, mode, active, id, settings } = event.data;

      // Changement de mode visuel (fullscreen / minimized / hidden)
      if (type === 'screensaver_view_mode' && mode) {
        if (mode === 'fullscreen' || mode === 'minimized' || mode === 'hidden') {
          if (event.data.manual !== undefined) {
            isManualFullscreenRef.current = Boolean(event.data.manual);
          } else if (mode === 'minimized' || mode === 'hidden') {
            isManualFullscreenRef.current = false;
          }
          setViewMode(mode);
        }
      } else if (type === 'screensaver_state') {
        if (active) {
          setViewMode((prev) => (prev === 'hidden' ? 'fullscreen' : prev));
        } else {
          setViewMode('hidden');
          isManualFullscreenRef.current = false;
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

  const lastSettingsRef = useRef<Record<string, any> | null>(null);

  // Écoute de l'événement personnalisé de mise à jour des paramètres
  useEffect(() => {
    const handlePluginSettingsUpdate = (e: Event) => {
      const customEvt = e as CustomEvent;
      const newSettings = customEvt.detail?.settings;
      if (newSettings) {
        lastSettingsRef.current = newSettings;
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: 'kairo_update_settings', settings: newSettings },
            '*'
          );
        }
      }
    };

    window.addEventListener('kairo_update_plugin_settings', handlePluginSettingsUpdate);
    return () => window.removeEventListener('kairo_update_plugin_settings', handlePluginSettingsUpdate);
  }, []);

  // Écoute des mises à jour émises depuis le core Tauri ou l'interface à distance
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    const listenTauri = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<any>('kairo://plugins-updated', async () => {
          if (activePlugin?.id) {
            try {
              const detail = await getPlugin(activePlugin.id);
              if (detail?.settings) {
                lastSettingsRef.current = detail.settings;
                if (iframeRef.current?.contentWindow) {
                  iframeRef.current.contentWindow.postMessage(
                    { type: 'kairo_update_settings', settings: detail.settings },
                    '*'
                  );
                }
              }
            } catch (_) {}
          }
        });
      } catch (_) {}
    };
    listenTauri();
    return () => {
      if (unlisten) unlisten();
    };
  }, [activePlugin]);

  // 3. Raccourci global touche Inser (Insert) et déblocage audio instantané
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Débloquer l'élément audio du lecteur Spotify dans l'iframe dès une touche pressée
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: 'kairo_unlock_audio' }, '*');
      }

      // Sortie exclusive du mode maximisé avec Échap (Escape)
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (viewMode === 'fullscreen') {
          e.preventDefault();
          isManualFullscreenRef.current = false;
          setViewMode('minimized');
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              { type: 'kairo_set_view_mode', mode: 'minimized', manual: false },
              '*'
            );
          }
          return;
        }
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
          isManualFullscreenRef.current = nextMode === 'fullscreen';

          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              { type: 'kairo_set_view_mode', mode: nextMode, manual: true },
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

  // 4. Détection d'activité et touche B de la manette :
  // Le mode maximisé persiste et ne se quitte que via le bouton dédié ou la touche B de la manette.
  useEffect(() => {
    let lastActivityTime = Date.now();
    let lastBPress = 0;

    const handleUserMotion = () => {
      const now = Date.now();
      if (now - lastActivityTime < 30) return;
      lastActivityTime = now;

      // Si le mode maximisé a été activé AUTOMATIQUEMENT pour la veille :
      // N'importe quel mouvement ou bouton quitte immédiatement la page pour revenir en minimisé !
      if (viewMode === 'fullscreen' && !isManualFullscreenRef.current) {
        setViewMode('minimized');
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { type: 'kairo_set_view_mode', mode: 'minimized', manual: false },
            '*'
          );
        }
      }

      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: 'kairo_unlock_audio' }, '*');
        iframeRef.current.contentWindow.postMessage({ type: 'kairo_activity' }, '*');
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

          // Touche B (Bouton 1) -> Sortie exclusive du mode maximisé
          if (gp.buttons[1]?.pressed && viewMode === 'fullscreen') {
            const now = Date.now();
            if (now - lastBPress > 350) {
              lastBPress = now;
              isManualFullscreenRef.current = false;
              setViewMode('minimized');
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                  { type: 'kairo_set_view_mode', mode: 'minimized', manual: false },
                  '*'
                );
              }
            }
          }

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
      if (targetMode === 'fullscreen') {
        isManualFullscreenRef.current = true;
      }
      setViewMode(targetMode);
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: 'kairo_set_view_mode', mode: targetMode, manual: true },
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


  let containerClasses = 'fixed transition-all duration-300 ease-out select-none origin-bottom-right overflow-hidden';

  if (isFullscreen) {
    containerClasses += ' bottom-0 right-0 w-full h-full z-[9990] opacity-100 pointer-events-auto bg-slate-950 rounded-none border-transparent';
  } else if (isMinimized) {
    containerClasses +=
      ' bottom-6 right-6 w-96 h-28 z-[9995] opacity-100 pointer-events-auto rounded-2xl shadow-2xl border border-white/15';
  } else {
    // Mode caché : ranger vers la droite jusqu'à disparaître
    if (lastActiveModeRef.current === 'fullscreen') {
      containerClasses += ' bottom-0 right-0 w-full h-full -z-[9990] opacity-0 pointer-events-none scale-95';
    } else {
      containerClasses += ' bottom-6 right-6 w-96 h-28 -z-[9990] opacity-0 pointer-events-none translate-x-[calc(100%+3rem)]';
    }
  }

  return (
    <div
      aria-hidden={isHidden}
      className={containerClasses}
    >
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        onLoad={() => {
          if (lastSettingsRef.current && iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              { type: 'kairo_update_settings', settings: lastSettingsRef.current },
              '*'
            );
          }
        }}
        allow="encrypted-media *; autoplay *; clipboard-write *"
        className="w-full h-full border-none bg-transparent"
        title="KaïroOS Plugin Screensaver Host"
      />
    </div>
  );
};
