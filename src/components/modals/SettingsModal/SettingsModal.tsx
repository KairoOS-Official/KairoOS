import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Palette,
  Monitor,
  Cpu,
  Tv,
  Gamepad2,
  Library,
  Globe,
  Wifi,
  Layers,
  Settings as SettingsIcon,
  Check,
  ChevronRight,
  Puzzle,
  Sparkles,
} from 'lucide-react';
import { AppSettings, Emulator, RemoteConfig, System, GamepadMapping, PluginInfo } from '../../../types';
import { useTheme, useGamepad } from '../../../hooks';
import { getPlugins } from '../../../api';
import { ThemesSection } from './ThemesSection';
import { DisplaySection } from './DisplaySection';
import { EmulatorsSection } from './EmulatorsSection';
import { MediaSection } from './MediaSection';
import { GamepadsSection } from './GamepadsSection';
import { LibrarySection } from './LibrarySection';
import { PluginsSection } from './PluginsSection';
import { AdvancedSection } from './AdvancedSection';
import { ConsolesTab } from './ConsolesTab';
import { PluginSettingsTab } from './PluginSettingsTab';

export type SettingsSectionId = string;

export interface SectionItem {
  id: SettingsSectionId;
  label: string;
  icon: React.ReactNode;
}

const renderPluginIcon = (iconName?: string) => {
  switch (iconName?.toLowerCase()) {
    case 'globe':
      return <Globe className="w-4 h-4" />;
    case 'wifi':
      return <Wifi className="w-4 h-4" />;
    case 'gamepad':
      return <Gamepad2 className="w-4 h-4" />;
    case 'cpu':
      return <Cpu className="w-4 h-4" />;
    case 'monitor':
      return <Monitor className="w-4 h-4" />;
    case 'tv':
      return <Tv className="w-4 h-4" />;
    case 'library':
      return <Library className="w-4 h-4" />;
    case 'palette':
      return <Palette className="w-4 h-4" />;
    case 'sparkles':
      return <Sparkles className="w-4 h-4" />;
    default:
      return <Puzzle className="w-4 h-4" />;
  }
};

interface SettingsModalProps {
  settings: AppSettings;
  systems?: System[];
  emulators?: Emulator[];
  onClose: () => void;
  onSave: (settings: AppSettings) => Promise<void>;
  onToggleFullscreen: () => Promise<boolean | void>;
  onOpenGamepadSettings?: () => void;
  remoteConfig?: RemoteConfig;
  onSaveRemoteConfig?: (cfg: RemoteConfig) => Promise<void>;
  onLockKioskNow?: () => void;
  onScanComplete?: () => void;
  themeManager?: ReturnType<typeof useTheme>;
  primaryPlayerIndex?: number;
  gamepadMapping?: GamepadMapping;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings: initialSettings,
  systems = [],
  emulators = [],
  onClose,
  onSave,
  onToggleFullscreen,
  onOpenGamepadSettings,
  remoteConfig,
  onSaveRemoteConfig,
  onLockKioskNow,
  onScanComplete,
  themeManager: propsThemeManager,
  primaryPlayerIndex = 0,
  gamepadMapping,
}) => {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('themes');
  const [localSettings, setLocalSettings] = useState<AppSettings>(initialSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSettingsRef = useRef<AppSettings>(initialSettings);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // État de navigation manette
  const [focusZone, setFocusZone] = useState<'sidebar' | 'content'>('sidebar');
  const [contentFocusIndex, setContentFocusIndex] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const internalThemeManager = useTheme();
  const themeManager = propsThemeManager || internalThemeManager;

  // Sauvegarde temps réel avec debounce 300ms pour éviter tout redémarrage
  const updateSetting = useCallback(
    (key: keyof AppSettings, val: any) => {
      setLocalSettings((prev) => {
        const updated = { ...prev, [key]: val };
        pendingSettingsRef.current = updated;

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
          onSave(pendingSettingsRef.current).catch((err) => {
            console.error('[SettingsModal] Erreur sauvegarde temps réel:', err);
          });
        }, 300);

        return updated;
      });

      setSavedSuccess(true);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => setSavedSuccess(false), 1500);
    },
    [onSave]
  );

  // Éléments interactifs navigables dans le contenu de l'onglet actif
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!contentRef.current) return [];
    const elements = contentRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [role="button"]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]:not([disabled]), label:not([disabled]), .cursor-pointer'
    );
    return Array.from(elements).filter(
      (el) => el.offsetParent !== null && !el.hasAttribute('disabled')
    );
  }, []);

  const [plugins, setPlugins] = useState<PluginInfo[]>([]);

  useEffect(() => {
    getPlugins()
      .then((list) => {
        setPlugins(list);
      })
      .catch((err) => console.error('[SettingsModal] Erreur chargement plugins:', err));
  }, []);

  const visibleSections = useMemo((): SectionItem[] => {
    const list: SectionItem[] = [
      { id: 'themes', label: 'Thèmes & Style', icon: <Palette className="w-4 h-4" /> },
      { id: 'display', label: 'Affichage & Écran', icon: <Monitor className="w-4 h-4" /> },
      { id: 'emulators', label: 'Émulateurs & CLI', icon: <Cpu className="w-4 h-4" /> },
      { id: 'media', label: 'Image & Son', icon: <Tv className="w-4 h-4" /> },
      { id: 'gamepads', label: 'Manettes', icon: <Gamepad2 className="w-4 h-4" /> },
      { id: 'library', label: 'Bibliothèque', icon: <Library className="w-4 h-4" /> },
    ];

    // Plugins activés avec page ou paramètres de configuration (dynamique universel)
    const activePluginTabs = plugins
      .filter((p) => p.enabled && (p.has_settings || p.settings_section))
      .sort((a, b) => (a.settings_section?.order ?? 99) - (b.settings_section?.order ?? 99));

    activePluginTabs.forEach((p) => {
      list.push({
        id: `plugin:${p.id}`,
        label: p.settings_section?.label || p.name,
        icon: renderPluginIcon(p.settings_section?.icon),
      });
    });

    list.push(
      { id: 'consoles', label: 'Consoles & Modes', icon: <Layers className="w-4 h-4" /> },
      { id: 'plugins', label: 'Plugins & Extensions', icon: <Puzzle className="w-4 h-4" /> },
      { id: 'advanced', label: 'Avancé & Système', icon: <SettingsIcon className="w-4 h-4" /> }
    );

    return list;
  }, [plugins]);

  // Si l'onglet actif est masqué (ex: plugin désactivé), basculer automatiquement
  useEffect(() => {
    const isVisible = visibleSections.some((s) => s.id === activeSection);
    if (!isVisible && visibleSections.length > 0) {
      setActiveSection(visibleSections[0].id);
    }
  }, [visibleSections, activeSection]);

  const handlePrevTab = useCallback(() => {
    setActiveSection((curr) => {
      const idx = visibleSections.findIndex((s) => s.id === curr);
      const prevIdx = idx > 0 ? idx - 1 : visibleSections.length - 1;
      return visibleSections[prevIdx].id;
    });
    setContentFocusIndex(0);
  }, [visibleSections]);

  const handleNextTab = useCallback(() => {
    setActiveSection((curr) => {
      const idx = visibleSections.findIndex((s) => s.id === curr);
      const nextIdx = idx < visibleSections.length - 1 ? idx + 1 : 0;
      return visibleSections[nextIdx].id;
    });
    setContentFocusIndex(0);
  }, [visibleSections]);

  const handleGamepadNavigate = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      if (focusZone === 'sidebar') {
        if (dir === 'up') {
          handlePrevTab();
        } else if (dir === 'down') {
          handleNextTab();
        } else if (dir === 'right') {
          const focusables = getFocusableElements();
          if (focusables.length > 0) {
            setFocusZone('content');
            setContentFocusIndex(0);
          }
        }
      } else {
        const focusables = getFocusableElements();
        if (focusables.length === 0) {
          if (dir === 'left') setFocusZone('sidebar');
          return;
        }

        if (dir === 'left') {
          if (contentFocusIndex === 0) {
            setFocusZone('sidebar');
          } else {
            setContentFocusIndex((prev) => Math.max(0, prev - 1));
          }
        } else if (dir === 'right') {
          setContentFocusIndex((prev) => Math.min(focusables.length - 1, prev + 1));
        } else if (dir === 'up') {
          setContentFocusIndex((prev) => {
            if (prev <= 0) {
              setFocusZone('sidebar');
              return 0;
            }
            return prev - 1;
          });
        } else if (dir === 'down') {
          setContentFocusIndex((prev) => Math.min(focusables.length - 1, prev + 1));
        }
      }
    },
    [focusZone, getFocusableElements, handlePrevTab, handleNextTab, contentFocusIndex]
  );

  const handleGamepadConfirm = useCallback(() => {
    if (focusZone === 'sidebar') {
      const focusables = getFocusableElements();
      if (focusables.length > 0) {
        setFocusZone('content');
        setContentFocusIndex(0);
      }
    } else {
      const focusables = getFocusableElements();
      const current = focusables[contentFocusIndex];
      if (current) {
        current.click();
        if (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA') {
          current.focus();
        }
      }
    }
  }, [focusZone, getFocusableElements, contentFocusIndex]);

  const handleGamepadBack = useCallback(() => {
    if (focusZone === 'content') {
      setFocusZone('sidebar');
    } else {
      onClose();
    }
  }, [focusZone, onClose]);

  // Hook manette avec priorité USB et remapping actif
  const gamepadActions = useMemo(
    () => ({
      onNavigate: handleGamepadNavigate,
      onConfirm: handleGamepadConfirm,
      onBack: handleGamepadBack,
      onPrevSystem: handlePrevTab,
      onNextSystem: handleNextTab,
      onMenu: onClose,
    }),
    [handleGamepadNavigate, handleGamepadConfirm, handleGamepadBack, handlePrevTab, handleNextTab, onClose]
  );

  useGamepad(gamepadActions, true, primaryPlayerIndex, gamepadMapping);

  // Réinitialiser l'index de focus au changement d'onglet
  useEffect(() => {
    setContentFocusIndex(0);
  }, [activeSection]);

  // Mise en surbrillance arcade et défilement automatique de l'élément sélectionné
  useEffect(() => {
    if (focusZone === 'content') {
      const focusables = getFocusableElements();
      focusables.forEach((el, idx) => {
        if (idx === contentFocusIndex) {
          el.setAttribute('data-focused-gamepad', 'true');
          el.classList.add('ring-2', 'ring-purple-500', 'ring-offset-2', 'ring-offset-slate-900', 'shadow-lg');
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          el.removeAttribute('data-focused-gamepad');
          el.classList.remove('ring-2', 'ring-purple-500', 'ring-offset-2', 'ring-offset-slate-900', 'shadow-lg');
        }
      });
    } else {
      const focusables = getFocusableElements();
      focusables.forEach((el) => {
        el.removeAttribute('data-focused-gamepad');
        el.classList.remove('ring-2', 'ring-purple-500', 'ring-offset-2', 'ring-offset-slate-900', 'shadow-lg');
      });
    }
  }, [focusZone, contentFocusIndex, activeSection, getFocusableElements]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-md animate-fadeIn select-none">
      <div
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
          color: 'var(--text-primary)',
        }}
        className="relative w-full max-w-[95vw] 2xl:max-w-[1550px] h-[92vh] border rounded-3xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header Bar */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
          }}
          className="px-6 py-4 border-b flex items-center justify-between shrink-0"
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-color)',
                color: 'var(--accent-primary)',
              }}
              className="w-10 h-10 rounded-2xl flex items-center justify-center border shadow-2xs"
            >
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h2
                style={{ color: 'var(--text-primary)' }}
                className="text-base font-black font-sans tracking-tight"
              >
                PARAMÈTRES DE LA BORNE
              </h2>
              <p
                style={{ color: 'var(--text-muted)' }}
                className="text-xs"
              >
                Configuration générale, thèmes, émulation et manettes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {savedSuccess && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold animate-fadeIn">
                <Check className="w-3.5 h-3.5" />
                <span>Enregistré en temps réel</span>
              </div>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/10 text-slate-400 hover:text-slate-800 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Two Columns Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Internal Sidebar */}
          <div
            style={{
              backgroundColor: 'var(--sidebar-bg)',
              borderColor: 'var(--border-color)',
            }}
            className="w-64 border-r p-3 flex flex-col gap-1 overflow-y-auto shrink-0"
          >
            {visibleSections.map((item) => {
              const isActive = activeSection === item.id;
              const isSelectedInSidebar = focusZone === 'sidebar' && isActive;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    setFocusZone('sidebar');
                    setContentFocusIndex(0);
                  }}
                  style={{
                    backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-primary)',
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all text-left ${
                    isActive ? 'shadow-sm' : 'hover:bg-black/5'
                  } ${isSelectedInSidebar ? 'ring-2 ring-purple-400 ring-offset-1 ring-offset-slate-900 scale-[1.02]' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 opacity-80" />}
                </button>
              );
            })}

            <div
              style={{
                color: 'var(--text-muted)',
                borderColor: 'var(--border-color)',
              }}
              className="mt-auto pt-3 border-t text-[10px] text-center font-mono space-y-1"
            >
              <div>{focusZone === 'sidebar' ? '🎮 Focus : Menu latéral' : '🎮 Focus : Contenu'}</div>
              <div className="text-[9px] opacity-70">D-Pad ↕ naviguer • ➡ entrer • (B) fermer</div>
            </div>
          </div>

          {/* Section Main View */}
          <div
            ref={contentRef}
            style={{
              backgroundColor: 'var(--bg-primary)',
            }}
            className="flex-1 overflow-y-auto overflow-x-hidden p-6 scrollbar-thin"
          >
            {activeSection === 'themes' && (
              <ThemesSection
                themeManager={themeManager}
                onThemeChange={(newThemeId) => updateSetting('theme', newThemeId)}
              />
            )}

            {activeSection === 'display' && (
              <DisplaySection
                settings={localSettings}
                updateSetting={updateSetting}
                onNavigateToThemes={() => setActiveSection('themes')}
                activeTheme={themeManager.activeTheme}
                onToggleFullscreen={onToggleFullscreen}
              />
            )}

            {activeSection === 'emulators' && (
              <EmulatorsSection
                settings={localSettings}
                updateSetting={updateSetting}
                emulators={emulators}
              />
            )}

            {activeSection === 'media' && (
              <MediaSection settings={localSettings} updateSetting={updateSetting} />
            )}

            {activeSection === 'gamepads' && (
              <GamepadsSection
                settings={localSettings}
                updateSetting={updateSetting}
                onOpenGamepadModal={onOpenGamepadSettings}
              />
            )}

            {activeSection === 'library' && (
              <LibrarySection
                settings={localSettings}
                updateSetting={updateSetting}
                onScanComplete={onScanComplete}
              />
            )}

            {activeSection === 'consoles' && (
              <ConsolesTab
                systems={systems}
                enabledSystems={localSettings.enabled_systems !== undefined ? localSettings.enabled_systems : systems.map((s) => s.id)}
                setEnabledSystems={(systemsList) => updateSetting('enabled_systems', systemsList)}
                enabledModes={localSettings.enabled_modes !== undefined ? localSettings.enabled_modes : ['2-players', 'genre:fight', 'genre:platform']}
                setEnabledModes={(modesList) => updateSetting('enabled_modes', modesList)}
                enabledFranchises={localSettings.enabled_franchises !== undefined ? localSettings.enabled_franchises : ['mario', 'zelda', 'pokemon', 'sonic', 'versus', 'rpg']}
                setEnabledFranchises={(frList) => updateSetting('enabled_franchises', frList)}
              />
            )}

            {activeSection === 'plugins' && (
              <PluginsSection onPluginsChange={setPlugins} />
            )}

            {activeSection.startsWith('plugin:') && (
              <PluginSettingsTab
                pluginId={activeSection.replace('plugin:', '')}
                settings={localSettings}
                updateSetting={updateSetting}
                remoteConfig={remoteConfig}
                onSaveRemoteConfig={onSaveRemoteConfig}
              />
            )}

            {activeSection === 'advanced' && (
              <AdvancedSection
                settings={localSettings}
                updateSetting={updateSetting}
                onLockKioskNow={onLockKioskNow}
                onReloadSettings={onScanComplete}
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
          }}
          className="p-4 border-t flex flex-wrap items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-2 text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-black/5 border border-black/10 text-slate-500 font-semibold">
              LB / RB Onglets
            </span>
            <span className="px-2 py-0.5 rounded bg-black/5 border border-black/10 text-slate-500 font-semibold">
              D-Pad ↕/↔ Naviguer
            </span>
            <span className="px-2 py-0.5 rounded bg-black/5 border border-black/10 text-slate-500 font-semibold">
              (A) Valider
            </span>
            <span className="px-2 py-0.5 rounded bg-black/5 border border-black/10 text-slate-500 font-semibold">
              (B) {focusZone === 'content' ? 'Retour Onglets' : 'Fermer'}
            </span>
          </div>

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'var(--accent-primary)',
            }}
            className="px-6 py-2 rounded-xl text-white text-xs font-black uppercase tracking-wider shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};