import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Header,
  Sidebar,
  BottomNav,
  PinModal,
  LoginScreen,
  ModeSelector,
  VirtualGamepad,
  DashboardView,
  GamesView,
  AddGameView,
  SettingsView,
  KioskUnlockView,
  ConsoleView,
} from './components';
import {
  ThemeMode,
  StatusResponse,
  Game,
  System,
  RemoteConfig,
  AppSettings,
  Emulator,
  PluginContributionPayload,
  ContributedNavItem,
} from './types';
import { CheckCircle2, AlertCircle, Puzzle } from 'lucide-react';
import { useGamepad } from './hooks/useGamepad';

export default function App() {
  // 1. États d'Authentification & Mode (Interface claire et sobre d'administration)
  const [theme] = useState<ThemeMode>('light');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeMode, setActiveMode] = useState<'hub' | 'admin' | 'gamepad'>('hub');
  const [pin, setPin] = useState<string>('1234');
  const [pinModalOpen, setPinModalOpen] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  // Navigation manette physique PWA avec contournement automatique du PIN si manette connectée
  useGamepad({
    enabled: true,
    onGamepadDetected: () => {
      // Manette physique locale détectée = accès de confiance, pas de PIN requis
      setIsAuthenticated(true);
    },
    onBack: () => {
      if (pinModalOpen) {
        setPinModalOpen(false);
      } else if (activeMode === 'gamepad') {
        setActiveMode('admin');
      } else if (currentTab !== 'dashboard') {
        setCurrentTab('dashboard');
      }
    },
  });

  // 2. États Réseau & Données
  const [connected, setConnected] = useState<boolean>(false);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [contributions, setContributions] = useState<PluginContributionPayload[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 3. Polling de l'état de la borne (toutes les 2 secondes)
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status');
      if (res.ok) {
        const data: StatusResponse = await res.json();
        setStatus(data);
        setConnected(true);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  // Découverte universelle des plugins contributeurs pour kairo-remote
  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations?host=kairo-remote');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setContributions(json.data);
        }
      }
    } catch (e) {
      console.warn('Erreur chargement intégrations plugins:', e);
    }
  }, []);

  // 4. Chargement de la bibliothèque
  const loadData = useCallback(async () => {
    try {
      const [gamesRes, recentRes, systemsRes] = await Promise.all([
        fetch('/api/games'),
        fetch('/api/games/recent'),
        fetch('/api/systems'),
      ]);

      if (gamesRes.ok) {
        const json = await gamesRes.json();
        if (json.data) setGames(json.data);
      }

      if (recentRes.ok) {
        const json = await recentRes.json();
        if (json.data) setRecentGames(json.data);
      }

      if (systemsRes.ok) {
        const json = await systemsRes.json();
        if (json.data) setSystems(json.data);
      }

      await fetchIntegrations();
    } catch (e) {
      console.warn('Erreur chargement données:', e);
    }
  }, [fetchIntegrations]);

  const contributedNavItems: ContributedNavItem[] = useMemo(() => {
    return contributions
      .filter((c) => c.integration_point === 'remote_nav_item' || c.integration_point === 'remote_settings_page')
      .map((c) => ({
        id: c.data?.id || c.from,
        from: c.from,
        label: c.data?.label || c.from,
        icon: c.data?.icon,
        badge: c.data?.badge,
        url: c.data?.url || (c.data?.entry ? `/plugins/${c.from}/${c.data.entry}` : `/plugins/${c.from}/index.html`),
      }));
  }, [contributions]);

  useEffect(() => {
    fetchStatus();
    loadData();
    const interval = setInterval(() => {
      fetchStatus();
      fetchIntegrations();
    }, 2500);
    return () => clearInterval(interval);
  }, [fetchStatus, loadData, fetchIntegrations]);

  // 5. Authentification initiale obligatoire
  const handleLogin = async (enteredPin: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPin(enteredPin);
        localStorage.setItem('kairo_pin', enteredPin);
        setIsAuthenticated(true);
        setActiveMode('hub');
        showToast('Connexion réussie !');
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveMode('hub');
    showToast('Déconnecté');
  };

  // 6. Actions REST
  const handleLaunchGame = async (gameId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/games/launch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kairo-Pin': pin,
        },
        body: JSON.stringify({ game_id: gameId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('🎮 Jeu lancé sur la borne !');
        fetchStatus();
        loadData();
        setCurrentTab('dashboard');
      } else {
        showToast(json.error || 'Erreur de lancement (Vérifiez le PIN)', 'error');
        if (res.status === 401) setPinModalOpen(true);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStopGame = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/games/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kairo-Pin': pin,
        },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('🛑 Jeu arrêté avec succès !');
        fetchStatus();
        loadData();
      } else {
        showToast(json.error || "Erreur lors de l'arrêt du jeu", 'error');
        if (res.status === 401) setPinModalOpen(true);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (gameId: string) => {
    try {
      const res = await fetch(`/api/games/${gameId}/favorite`, {
        method: 'POST',
        headers: {
          'X-Kairo-Pin': pin,
        },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setGames((prev) =>
          prev.map((g) => (g.id === gameId ? { ...g, favorite: Boolean(json.data) } : g))
        );
        showToast(json.data ? '⭐ Ajouté aux favoris' : 'Favori retiré');
      } else {
        showToast(json.error || 'Erreur de favori', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleAddGame = async (path: string, systemId: string, title?: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/games/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kairo-Pin': pin,
        },
        body: JSON.stringify({ path, system_id: systemId, title }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('✅ ROM ajoutée à la borne !');
        loadData();
        setCurrentTab('games');
      } else {
        showToast(json.error || 'Erreur ajout ROM', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLockKiosk = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/kiosk/lock', {
        method: 'POST',
        headers: { 'X-Kairo-Pin': pin },
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('🔒 Mode Kiosk activé !');
        fetchStatus();
      } else {
        showToast(json.error || 'Erreur verrouillage', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockKiosk = async (enteredPin: string): Promise<boolean> => {
    setLoading(true);
    try {
      const res = await fetch('/api/kiosk/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: enteredPin }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPin(enteredPin);
        showToast('🔓 Mode Admin déverrouillé !');
        fetchStatus();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRemoteConfig = async (cfg: RemoteConfig) => {
    setLoading(true);
    try {
      const res = await fetch('/api/remote/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kairo-Pin': pin,
        },
        body: JSON.stringify(cfg),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setPin(cfg.pin);
        showToast('Configuration Remote enregistrée !');
        fetchStatus();
      } else {
        showToast(json.error || 'Erreur enregistrement', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAppSettings = async (settings: AppSettings) => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kairo-Pin': pin,
        },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Paramètres KaïroOS enregistrés !');
        fetchStatus();
      } else {
        showToast(json.error || 'Erreur enregistrement', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmulators = async (emus: Emulator[]) => {
    setLoading(true);
    try {
      const res = await fetch('/api/emulators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kairo-Pin': pin,
        },
        body: JSON.stringify(emus),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        showToast('Émulateurs enregistrés avec succès !');
      } else {
        showToast(json.error || 'Erreur enregistrement émulateurs', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === 'dark';

  // 1. Si NON Authentifié : Écran de connexion obligatoire
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} theme={theme} />;
  }

  // 2. Si sur l'écran Sélecteur de Mode (Hub)
  if (activeMode === 'hub') {
    return (
      <ModeSelector
        onSelectMode={(mode) => setActiveMode(mode)}
        status={status}
        onLogout={handleLogout}
        theme={theme}
      />
    );
  }

  // 3. Si en Mode Manette Virtuelle (Gamepad)
  if (activeMode === 'gamepad') {
    return (
      <VirtualGamepad
        pin={pin}
        status={status}
        onBackToHub={() => setActiveMode('hub')}
        onStopGame={handleStopGame}
        theme={theme}
      />
    );
  }

  // 4. Mode Panneau d'Administration (Clean & Sobre)
  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-150 select-none ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl text-xs font-semibold shadow-xl flex items-center gap-2 animate-bounce ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Propre */}
      <Header
        connected={connected}
        pin={pin}
        onOpenPinModal={() => setPinModalOpen(true)}
        appMode="admin"
        onToggleAppMode={() => setActiveMode('gamepad')}
        onLogout={handleLogout}
      />

      {/* Corps Principal Responsive (Sidebar Desktop + Contenu Central) */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto overflow-hidden">
        {/* Navigation Latérale Desktop (>= 768px) */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          status={status}
          gamesCount={games.length}
          theme={theme}
          onOpenGamepad={() => setActiveMode('gamepad')}
          contributedNavItems={contributedNavItems}
        />

        {/* Zone de Contenu Principal */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 md:pb-8">
          {currentTab === 'dashboard' && (
            <DashboardView
              status={status}
              recentGames={recentGames}
              onLaunchGame={handleLaunchGame}
              onStopGame={handleStopGame}
              onLockKiosk={handleLockKiosk}
              onOpenUnlockModal={() => setCurrentTab('unlock')}
              onNavigateToGames={() => setCurrentTab('games')}
              onOpenGamepad={() => setActiveMode('gamepad')}
              loading={loading}
              theme={theme}
            />
          )}

          {currentTab === 'games' && (
            <GamesView
              games={games}
              systems={systems}
              status={status}
              pin={pin}
              onLaunchGame={handleLaunchGame}
              onToggleFavorite={handleToggleFavorite}
              onReloadGames={loadData}
              loading={loading}
              theme={theme}
            />
          )}

          {currentTab === 'add' && (
            <AddGameView
              systems={systems}
              onAddGame={handleAddGame}
              loading={loading}
              theme={theme}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              pin={pin}
              onSaveRemoteConfig={handleSaveRemoteConfig}
              onSaveAppSettings={handleSaveAppSettings}
              onSaveEmulators={handleSaveEmulators}
              onReloadAll={async () => {
                await fetchStatus();
                await loadData();
                showToast('Données rafraîchies !');
              }}
              onNavigateToTab={setCurrentTab}
              loading={loading}
            />
          )}

          {currentTab === 'unlock' && (
            <KioskUnlockView
              status={status}
              onUnlockKiosk={handleUnlockKiosk}
              onLockKiosk={handleLockKiosk}
              loading={loading}
              theme={theme}
            />
          )}

          {currentTab === 'console' && (
            <ConsoleView pin={pin} theme={theme} />
          )}

          {/* Vues Contribuées par des Plugins Tiers */}
          {currentTab.startsWith('contrib:') && (() => {
            const contribId = currentTab.replace('contrib:', '');
            const item = contributedNavItems.find((c) => c.id === contribId);
            if (!item) {
              return (
                <div className="p-8 text-center text-slate-500">
                  Extension introuvable ou inactive.
                </div>
              );
            }
            return (
              <div className="h-full min-h-[700px] flex flex-col rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-xs">
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                  <div className="flex items-center gap-2">
                    <Puzzle className="w-4 h-4 text-purple-600" />
                    <span>{item.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-mono">
                      {item.from}
                    </span>
                  </div>
                </div>
                <iframe
                  src={`${item.url}${item.url.includes('?') ? '&' : '?'}pin=${encodeURIComponent(pin)}`}
                  className="w-full flex-1 min-h-[650px] border-none"
                  title={item.label}
                />
              </div>
            );
          })()}
        </main>
      </div>

      {/* Navigation Basse Mobile (< 768px) */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        status={status}
        theme={theme}
        onOpenGamepad={() => setActiveMode('gamepad')}
        contributedNavItems={contributedNavItems}
      />

      {/* Modale Modification PIN */}
      <PinModal
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onConfirm={async (enteredPin) => {
          setPin(enteredPin);
          showToast('Code PIN de session mis à jour !');
        }}
        initialPin={pin}
        theme={theme}
      />
    </div>
  );
}
