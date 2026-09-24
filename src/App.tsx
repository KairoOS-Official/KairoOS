import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getThemeUIComponent, ThemeUIProps } from './themes';
import {
  GameDetailsModal,
  SettingsModal,
  GamepadSettingsModal,
  ScannerModal,
  FranchiseOrganizerModal,
  KioskUnlockModal,
  AddGameModal,
} from './components/modals';
import { LaunchOverlay } from './components/overlay';
import { PluginScreensaverHost } from './components/PluginScreensaverHost';
import { useLibrary, useLauncher, useAppSettings, useGamepad, useTheme } from './hooks';
import { Game, GameConfig, LocalGameMetadata } from './types';
import {
  getGameDetails,
  updateGameConfig,
  saveLocalGameMetadata,
  organizeGameIntoFranchise,
  scanRomsDirectory,
  addManualGame,
} from './api';

export const App: React.FC = () => {
  // 0. Thème global de l'application (chargé dès le boot)
  const themeManager = useTheme();

  // 1. Hooks Métier
  const {
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
    saveRemoteConfig,
  } = useAppSettings();

  const {
    systems,
    emulators,
    allGames,
    loadData,
    toggleFavorite,
    updateLocalGame,
    selectedCategory,
    setSelectedCategory,
    sortBy,
    setSortBy,
    focusedIndex,
    setFocusedIndex,
    allFranchises,
    gamesCountBySystem,
    gamesCountByFranchise,
    totalFavorites,
    totalRecent,
    total2Players,
    totalFightGames,
    totalPlatformGames,
    filteredAndSortedGames,
  } = useLibrary({ customFranchises: settings.custom_franchises });

  const { launchStatus, isGameRunning, launch, kill } = useLauncher(loadData);

  // Synchronisation du tri par défaut depuis les paramètres
  useEffect(() => {
    if (settings.default_sort && settings.default_sort !== sortBy) {
      setSortBy(settings.default_sort);
    }
  }, [settings.default_sort, setSortBy, sortBy]);

  // Démarrage automatique en mode Kiosque si configuré
  useEffect(() => {
    if (settings.auto_kiosk && appMode !== 'kiosk') {
      lockKiosk();
    }
  }, [settings.auto_kiosk, appMode, lockKiosk]);

  // 2. États des Modales
  const [selectedGameForDetails, setSelectedGameForDetails] = useState<Game | null>(null);
  const [gameConfigForDetails, setGameConfigForDetails] = useState<GameConfig | null>(null);
  const [gameDetailsTab, setGameDetailsTab] = useState<'overview' | 'screenshots' | 'media' | 'history' | 'emulator'>('overview');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addGameOpen, setAddGameOpen] = useState(false);
  const [gamepadSettingsOpen, setGamepadSettingsOpen] = useState(false);
  const [kioskUnlockOpen, setKioskUnlockOpen] = useState(false);
  const [franchiseOrganizerGame, setFranchiseOrganizerGame] = useState<Game | null>(null);

  const isKiosk = appMode === 'kiosk';

  // Notification de réinitialisation d'urgence du thème (Touche Suppr)
  const [themeResetToast, setThemeResetToast] = useState(false);
  const themeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEmergencyResetTheme = useCallback(async () => {
    try {
      await themeManager.resetThemeToDefault();
      setThemeResetToast(true);
      if (themeResetTimeoutRef.current) clearTimeout(themeResetTimeoutRef.current);
      themeResetTimeoutRef.current = setTimeout(() => {
        setThemeResetToast(false);
      }, 3500);
    } catch (err) {
      console.error('[App] Erreur réinitialisation thème d\'urgence:', err);
    }
  }, [themeManager]);

  // Chargement initial des données & Auto-scan du dossier ROMs (une seule fois au boot)
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const initApp = async () => {
      await loadData();
      try {
        const romPath = settings.roms_path || './roms';
        const stats = await scanRomsDirectory(romPath);
        if (stats.games_added > 0 || stats.games_updated > 0) {
          await loadData();
        }
      } catch (err) {
        console.warn('[App] Auto-scan background:', err);
      }
    };
    initApp();
  }, [loadData, settings.roms_path]);

  // Raccourcis clavier globaux (F11 plein écran, Échap fermeture modales, Suppr réinitialisation thème par défaut)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        await toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (selectedGameForDetails) setSelectedGameForDetails(null);
        else if (scannerOpen) setScannerOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (addGameOpen) setAddGameOpen(false);
        else if (gamepadSettingsOpen) setGamepadSettingsOpen(false);
        else if (kioskUnlockOpen) setKioskUnlockOpen(false);
        else if (franchiseOrganizerGame) setFranchiseOrganizerGame(null);
      } else if (e.key === 'Delete' || e.key === 'Del') {
        // Raccourci d'urgence : Touche Suppr pour réinitialiser le thème par défaut si un thème pose problème
        const activeEl = document.activeElement;
        const isInput =
          activeEl?.tagName === 'INPUT' ||
          activeEl?.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement)?.isContentEditable;
        if (!isInput) {
          e.preventDefault();
          handleEmergencyResetTheme();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedGameForDetails,
    scannerOpen,
    settingsOpen,
    addGameOpen,
    gamepadSettingsOpen,
    kioskUnlockOpen,
    franchiseOrganizerGame,
    toggleFullscreen,
    handleEmergencyResetTheme,
  ]);

  // Actions Jeux
  const handleOpenDetails = async (game: Game) => {
    try {
      const [g, cfg] = await getGameDetails(game.id);
      setSelectedGameForDetails(g || game);
      setGameConfigForDetails(cfg);
      setGameDetailsTab('overview');
    } catch {
      setSelectedGameForDetails(game);
      setGameConfigForDetails(null);
      setGameDetailsTab('overview');
    }
  };

  // Clic ou sélection sur un jeu (selon préférence configurée) avec protection anti-rebond
  const lastSelectTimeRef = useRef<number>(0);
  const handleGameCardSelect = (game: Game) => {
    const now = Date.now();
    if (now - lastSelectTimeRef.current < 400) return;
    lastSelectTimeRef.current = now;

    if (settings.game_select_action === 'launch') {
      launch(game);
    } else {
      handleOpenDetails(game);
    }
  };

  const handleSaveConfig = async (config: GameConfig) => {
    if (isKiosk) return;
    try {
      await updateGameConfig(config);
    } catch (err) {
      console.warn('[App] Config save fallback:', err);
    }
    setGameConfigForDetails(config);
  };

  const handleSaveMetadata = async (gameId: string, metadata: LocalGameMetadata) => {
    if (isKiosk) return;
    try {
      await saveLocalGameMetadata(gameId, metadata);
      await loadData();
    } catch (err) {
      console.warn('[App] Save metadata fallback:', err);
      updateLocalGame(gameId, metadata);
    }
  };

  const handleAddManualGame = async (gameData: {
    filePath: string;
    systemId: string;
    title?: string;
    coverUrl?: string;
    franchise?: string;
    genre?: string;
    developer?: string;
    releaseDate?: string;
    synopsis?: string;
    rating?: number;
    players?: number;
  }) => {
    await addManualGame(gameData);
    await loadData();
  };

  // Liste des catégories pour cycler avec LB / RB à la manette
  const categoryList = useMemo(() => {
    const list = ['all', 'favorites', 'recent'];
    const activeModes = ['2-players', 'genre:fight', 'genre:platform'].filter((m) => {
      if (settings.enabled_modes === undefined) return true;
      return settings.enabled_modes.includes(m);
    });
    activeModes.forEach((m) => list.push(m));

    const visibleSystems = systems.filter((s) => {
      if (settings.enabled_systems === undefined) return true;
      return settings.enabled_systems.includes(s.id);
    });
    visibleSystems.forEach((s) => list.push(s.id));

    const visibleFranchises = allFranchises.filter((f) => {
      if (settings.enabled_franchises === undefined) return true;
      return settings.enabled_franchises.includes(f.id);
    });
    visibleFranchises.forEach((f) => list.push(`franchise:${f.id}`));
    return list;
  }, [systems, allFranchises, settings.enabled_systems, settings.enabled_modes, settings.enabled_franchises]);

  const currentCategoryTitle = useMemo(() => {
    if (selectedCategory === 'all') return 'TOUS LES JEUX';
    if (selectedCategory === 'favorites') return 'VOS JEUX FAVORIS';
    if (selectedCategory === 'recent') return 'RÉCEMMENT JOUÉS';
    if (selectedCategory === '2-players') return 'JEUX À 2 JOUEURS (VERSUS & CO-OP)';
    if (selectedCategory === 'genre:fight') return 'JEUX DE COMBAT (VERSUS FIGHTING)';
    if (selectedCategory === 'genre:platform') return 'JEUX DE PLATEFORME';
    const sys = systems.find((s) => s.id === selectedCategory || `system:${s.id}` === selectedCategory);
    if (sys) return sys.name.toUpperCase();
    const fr = allFranchises.find((f) => f.id === selectedCategory || `franchise:${f.id}` === selectedCategory);
    if (fr) return `FRANCHISE : ${fr.name.toUpperCase()}`;
    return selectedCategory.toUpperCase();
  }, [selectedCategory, systems, allFranchises]);

  // Actions de navigation Manette
  const gamepadActions = useMemo(
    () => ({
      onNavigate: (dir: 'up' | 'down' | 'left' | 'right') => {
        if (selectedGameForDetails) {
          const TABS = ['overview', 'screenshots', 'media', 'history', 'emulator'] as const;
          if (dir === 'right') {
            setGameDetailsTab((curr) => {
              const idx = TABS.indexOf(curr);
              return TABS[(idx + 1) % TABS.length];
            });
          } else if (dir === 'left') {
            setGameDetailsTab((curr) => {
              const idx = TABS.indexOf(curr);
              return TABS[(idx - 1 + TABS.length) % TABS.length];
            });
          }
          return;
        }

        if (
          scannerOpen ||
          settingsOpen ||
          addGameOpen ||
          gamepadSettingsOpen ||
          kioskUnlockOpen ||
          franchiseOrganizerGame ||
          isGameRunning
        )
          return;

        setFocusedIndex((prev) => {
          if (filteredAndSortedGames.length === 0) return 0;
          let next = prev;
          if (dir === 'right') next = Math.min(prev + 1, filteredAndSortedGames.length - 1);
          if (dir === 'left') next = Math.max(prev - 1, 0);
          if (dir === 'down') next = Math.min(prev + 4, filteredAndSortedGames.length - 1);
          if (dir === 'up') next = Math.max(prev - 4, 0);
          return next;
        });
      },
      onConfirm: () => {
        if (selectedGameForDetails) {
          launch(selectedGameForDetails);
          setSelectedGameForDetails(null);
        } else if (
          !scannerOpen &&
          !settingsOpen &&
          !addGameOpen &&
          !gamepadSettingsOpen &&
          !kioskUnlockOpen &&
          !franchiseOrganizerGame &&
          !isGameRunning &&
          filteredAndSortedGames[focusedIndex]
        ) {
          const game = filteredAndSortedGames[focusedIndex];
          if (settings.game_select_action === 'launch') {
            launch(game);
          } else {
            handleOpenDetails(game);
          }
        }
      },
      onBack: () => {
        if (selectedGameForDetails) setSelectedGameForDetails(null);
        else if (scannerOpen) setScannerOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else if (addGameOpen) setAddGameOpen(false);
        else if (gamepadSettingsOpen) setGamepadSettingsOpen(false);
        else if (kioskUnlockOpen) setKioskUnlockOpen(false);
        else if (franchiseOrganizerGame) setFranchiseOrganizerGame(null);
      },
      onToggleFavorite: () => {
        if (isKiosk) return;
        const target = selectedGameForDetails || filteredAndSortedGames[focusedIndex];
        if (target) toggleFavorite(target);
      },
      onDetails: () => {
        if (selectedGameForDetails) {
          setGameDetailsTab((curr) => (curr === 'emulator' ? 'overview' : 'emulator'));
          return;
        }
        if (
          !scannerOpen &&
          !settingsOpen &&
          !addGameOpen &&
          !gamepadSettingsOpen &&
          !kioskUnlockOpen &&
          filteredAndSortedGames[focusedIndex]
        ) {
          handleOpenDetails(filteredAndSortedGames[focusedIndex]);
        }
      },
      onPrevSystem: () => {
        if (selectedGameForDetails) {
          const TABS = ['overview', 'screenshots', 'media', 'history', 'emulator'] as const;
          setGameDetailsTab((curr) => {
            const idx = TABS.indexOf(curr);
            return TABS[(idx - 1 + TABS.length) % TABS.length];
          });
          return;
        }
        if (settingsOpen || addGameOpen || scannerOpen || isGameRunning) return;
        setSelectedCategory((curr) => {
          const idx = categoryList.indexOf(curr);
          const prevIdx = idx <= 0 ? categoryList.length - 1 : idx - 1;
          setFocusedIndex(0);
          return categoryList[prevIdx];
        });
      },
      onNextSystem: () => {
        if (selectedGameForDetails) {
          const TABS = ['overview', 'screenshots', 'media', 'history', 'emulator'] as const;
          setGameDetailsTab((curr) => {
            const idx = TABS.indexOf(curr);
            return TABS[(idx + 1) % TABS.length];
          });
          return;
        }
        if (settingsOpen || addGameOpen || scannerOpen || isGameRunning) return;
        setSelectedCategory((curr) => {
          const idx = categoryList.indexOf(curr);
          const nextIdx = idx === -1 || idx >= categoryList.length - 1 ? 0 : idx + 1;
          setFocusedIndex(0);
          return categoryList[nextIdx];
        });
      },
      onCoinStartExit: () => {
        if (isGameRunning) {
          kill();
        }
      },
      onMenu: () => {
        if (isKiosk) {
          setKioskUnlockOpen(true);
        } else {
          setSettingsOpen((prev) => !prev);
        }
      },
      onKioskUnlockCombo: () => {
        setKioskUnlockOpen(true);
      },
    }),
    [
      filteredAndSortedGames,
      focusedIndex,
      selectedGameForDetails,
      scannerOpen,
      settingsOpen,
      addGameOpen,
      gamepadSettingsOpen,
      kioskUnlockOpen,
      franchiseOrganizerGame,
      isGameRunning,
      isKiosk,
      settings.game_select_action,
      categoryList,
      launch,
      kill,
      toggleFavorite,
      setFocusedIndex,
      setSelectedCategory,
    ]
  );

  const isHubTheme = themeManager.activeTheme.id === 'kairo-hub';
  const isCustomCodeTheme =
    themeManager.activeTheme.theme_type === 'custom-code' ||
    Boolean(themeManager.activeTheme.entry_path);
  const isFullScreenTheme = isHubTheme || isCustomCodeTheme;

  const handlePrevGame = useCallback(() => {
    if (filteredAndSortedGames.length === 0) return;
    const currentIdx = filteredAndSortedGames.findIndex((g) => g.id === selectedGameForDetails?.id);
    const nextIdx = currentIdx <= 0 ? filteredAndSortedGames.length - 1 : currentIdx - 1;
    setSelectedGameForDetails(filteredAndSortedGames[nextIdx]);
  }, [filteredAndSortedGames, selectedGameForDetails]);

  const handleNextGame = useCallback(() => {
    if (filteredAndSortedGames.length === 0) return;
    const currentIdx = filteredAndSortedGames.findIndex((g) => g.id === selectedGameForDetails?.id);
    const nextIdx = currentIdx === -1 || currentIdx >= filteredAndSortedGames.length - 1 ? 0 : currentIdx + 1;
    setSelectedGameForDetails(filteredAndSortedGames[nextIdx]);
  }, [filteredAndSortedGames, selectedGameForDetails]);

  // La manette reste active dans le catalogue classique et en jeu
  // Elle est désactivée dans les paramètres, configurateur manette, fiche de jeu, thème Hub et thèmes custom avec code
  const { isConnected: gamepadConnected, gamepadName } = useGamepad(
    gamepadActions,
    !gamepadSettingsOpen && !settingsOpen && !selectedGameForDetails && !isFullScreenTheme,
    primaryPlayerIndex,
    gamepadMappings[primaryPlayerIndex]
  );

  const focusedGame = filteredAndSortedGames[focusedIndex] || null;

  const favoriteGames = useMemo(() => allGames.filter((g) => g.favorite), [allGames]);
  const twoPlayerGames = useMemo(() => allGames.filter((g) => (g.players || 1) >= 2), [allGames]);
  const recentGames = useMemo(() => allGames.filter((g) => (g.play_count || 0) > 0 || g.last_played), [allGames]);
  const fightGames = useMemo(() => {
    return allGames.filter((g) => {
      const t = g.title.toLowerCase();
      const desc = (g.synopsis || '').toLowerCase();
      const genre = (g.genre || '').toLowerCase();
      return (
        t.includes('street fighter') ||
        t.includes('mortal kombat') ||
        t.includes('tekken') ||
        t.includes('kof') ||
        t.includes('fight') ||
        genre.includes('combat') ||
        genre.includes('fight') ||
        desc.includes('combat') ||
        desc.includes('fighting')
      );
    });
  }, [allGames]);
  const platformGames = useMemo(() => {
    return allGames.filter((g) => {
      const t = g.title.toLowerCase();
      const desc = (g.synopsis || '').toLowerCase();
      const genre = (g.genre || '').toLowerCase();
      return (
        t.includes('mario') ||
        t.includes('sonic') ||
        t.includes('donkey kong') ||
        t.includes('megaman') ||
        t.includes('rayman') ||
        genre.includes('platform') ||
        genre.includes('plateforme') ||
        desc.includes('platform') ||
        desc.includes('plateforme')
      );
    });
  }, [allGames]);

  const arcadeScaleClass = settings.arcade_ui_scale === 'large'
    ? 'arcade-scale-large'
    : settings.arcade_ui_scale === 'xl'
    ? 'arcade-scale-xl'
    : 'arcade-scale-normal';

  const themeUIProps: ThemeUIProps = {
    systems,
    allGames,
    filteredAndSortedGames,
    allFranchises,
    customFranchises: Array.isArray(settings.custom_franchises) ? settings.custom_franchises : [],
    selectedCategory,
    onSelectCategory: (cat) => {
      setSelectedCategory(cat);
      setFocusedIndex(0);
    },
    categoryTitle: currentCategoryTitle,
    categoryList,
    enabledSystems: Array.isArray(settings.enabled_systems) ? settings.enabled_systems : undefined,
    enabledModes: Array.isArray(settings.enabled_modes) ? settings.enabled_modes : undefined,
    enabledFranchises: Array.isArray(settings.enabled_franchises) ? settings.enabled_franchises : ['mario', 'zelda', 'pokemon', 'sonic', 'versus', 'rpg'],
    favoriteGames,
    twoPlayerGames,
    recentGames,
    fightGames,
    platformGames,
    gamesCountBySystem,
    gamesCountByFranchise,
    totalAllGames: allGames.length,
    totalFavorites,
    totalRecent,
    total2Players,
    totalFightGames,
    totalPlatformGames,
    focusedGame,
    focusedIndex,
    setFocusedIndex,
    onSelectGame: handleGameCardSelect,
    onLaunchGame: launch,
    onToggleFavorite: toggleFavorite,
    onOpenSettings: () => setSettingsOpen(true),
    onOpenGamepadSettings: () => setGamepadSettingsOpen(true),
    onOpenScanner: () => setScannerOpen(true),
    onOpenAddGame: () => setAddGameOpen(true),
    onOpenKioskUnlock: () => setKioskUnlockOpen(true),
    gamepadConnected,
    gamepadName,
    isGameRunning,
    appMode,
    settings,
    theme: themeManager.activeTheme,
    primaryPlayerIndex,
    gamepadMapping: gamepadMappings[primaryPlayerIndex],
  };

  const ActiveThemeUI = getThemeUIComponent(themeManager.activeTheme);

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
      className={`flex h-screen w-screen overflow-hidden font-sans antialiased select-none ${arcadeScaleClass}`}
    >
      <ActiveThemeUI {...themeUIProps} />

      {/* Notification Toast de secours lors de l'appui sur Suppr */}
      {themeResetToast && (
        <div
          role="status"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/95 border border-emerald-500/50 shadow-2xl backdrop-blur-md text-white animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-none"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base border border-emerald-500/30">
            ✓
          </div>
          <div>
            <div className="font-semibold text-sm text-white flex items-center gap-2">
              Thème par défaut rétabli
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono border border-slate-700">Suppr</span>
            </div>
            <div className="text-xs text-slate-400">Le thème officiel Kaïro OS a été appliqué avec succès.</div>
          </div>
        </div>
      )}

      {/* 3. Modales & Overlays */}
      {selectedGameForDetails && (
        <GameDetailsModal
          game={selectedGameForDetails}
          system={systems.find((s) => s.id === selectedGameForDetails.system_id) || null}
          config={gameConfigForDetails}
          emulators={emulators}
          activeTab={gameDetailsTab}
          onTabChange={setGameDetailsTab}
          onClose={() => setSelectedGameForDetails(null)}
          onLaunch={(g: Game) => {
            launch(g);
            setSelectedGameForDetails(null);
          }}
          onToggleFavorite={toggleFavorite}
          onSaveConfig={handleSaveConfig}
          onSaveMetadata={handleSaveMetadata}
          onOpenFranchiseOrganizer={(g: Game) => {
            setSelectedGameForDetails(null);
            setFranchiseOrganizerGame(g);
          }}
          isFullScreen={isFullScreenTheme}
          onPrevGame={handlePrevGame}
          onNextGame={handleNextGame}
          primaryPlayerIndex={primaryPlayerIndex}
          gamepadMapping={gamepadMappings[primaryPlayerIndex]}
        />
      )}

      {addGameOpen && !isKiosk && (
        <AddGameModal
          systems={systems}
          onClose={() => setAddGameOpen(false)}
          onAddGame={handleAddManualGame}
          defaultSystemId={selectedCategory !== 'all' && selectedCategory !== 'favorites' && selectedCategory !== 'recent' ? selectedCategory : 'arcade'}
        />
      )}

      {scannerOpen && !isKiosk && (
        <ScannerModal
          onClose={() => setScannerOpen(false)}
          onScan={scanRomsDirectory}
          onScanComplete={loadData}
          defaultPath={settings.roms_path || './roms'}
        />
      )}

      {settingsOpen && !isKiosk && (
        <SettingsModal
          settings={settings}
          systems={systems}
          emulators={emulators}
          themeManager={themeManager}
          onClose={() => setSettingsOpen(false)}
          onSave={saveSettings}
          onToggleFullscreen={toggleFullscreen}
          onOpenGamepadSettings={() => {
            setSettingsOpen(false);
            setGamepadSettingsOpen(true);
          }}
          remoteConfig={remoteConfig}
          onSaveRemoteConfig={saveRemoteConfig}
          onLockKioskNow={() => {
            setSettingsOpen(false);
            lockKiosk();
          }}
          onScanComplete={loadData}
          primaryPlayerIndex={primaryPlayerIndex}
          gamepadMapping={gamepadMappings[primaryPlayerIndex]}
        />
      )}

      {gamepadSettingsOpen && (
        <GamepadSettingsModal
          initialMappings={gamepadMappings}
          primaryPlayerIndex={primaryPlayerIndex}
          onSetPrimaryPlayer={setPrimaryPlayerIndex}
          onClose={() => setGamepadSettingsOpen(false)}
          onSaveMappings={saveGamepadMappings}
        />
      )}

      {kioskUnlockOpen && (
        <KioskUnlockModal
          onClose={() => setKioskUnlockOpen(false)}
          onUnlock={unlockKiosk}
        />
      )}

      {franchiseOrganizerGame && !isKiosk && (
        <FranchiseOrganizerModal
          game={franchiseOrganizerGame}
          onClose={() => setFranchiseOrganizerGame(null)}
          onOrganize={(id: string, name: string) =>
            organizeGameIntoFranchise(id, name, settings.roms_path)
          }
          onComplete={loadData}
        />
      )}

      {isGameRunning && (
        <LaunchOverlay status={launchStatus} onKillGame={kill} />
      )}

      {/* Hôte dynamique d'écran de veille et d'arrière-plan audio pour plugins (Règle 1 & 2) */}
      <PluginScreensaverHost isGameRunning={isGameRunning} remotePort={remoteConfig.port} />
    </div>
  );
};
export default App;
