import React, { useState, useEffect } from 'react';
import {
  Palette,
  FolderOpen,
  Check,
  RotateCcw,
  Save,
  Type,
  LayoutGrid,
  Image as ImageIcon,
  Sparkles,
  Tv,
  Plus,
  Trash2,
  Sliders,
  Globe,
  ArrowLeft,
  Code,
  Download,
  ExternalLink,
  RefreshCw,
  Copy,
  Layers,
  Layout,
  FileCode,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useTheme } from '../../../hooks';
import { openThemesFolder, downloadCommunityTheme, saveTheme } from '../../../api';
import { Theme } from '../../../types';

interface ThemesSectionProps {
  themeManager: ReturnType<typeof useTheme>;
  onThemeChange?: (themeId: string) => void;
}

interface GitHubContentItem {
  name: string;
  path: string;
  type: string;
  download_url?: string;
}

// Composant pour sélecteur de couleur interactif avec pastille et code hex
interface ColorPickerFieldProps {
  label: string;
  description?: string;
  value: string;
  onChange: (hex: string) => void;
}

const ColorPickerField: React.FC<ColorPickerFieldProps> = ({
  label,
  description,
  value,
  onChange,
}) => {
  const [localHex, setLocalHex] = useState(value || '#000000');

  useEffect(() => {
    setLocalHex(value || '#000000');
  }, [value]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalHex(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val) || /^#[0-9A-Fa-f]{3}$/.test(val)) {
      onChange(val);
    }
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalHex(val);
    onChange(val);
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
      }}
      className="p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors hover:border-[var(--accent-primary)]/40"
    >
      <div className="min-w-0 flex-1">
        <div
          style={{ color: 'var(--text-primary)' }}
          className="text-xs font-bold truncate"
        >
          {label}
        </div>
        {description && (
          <div
            style={{ color: 'var(--text-muted)' }}
            className="text-[10px] truncate"
          >
            {description}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Input HEX */}
        <input
          type="text"
          value={localHex}
          onChange={handleHexChange}
          maxLength={7}
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            borderColor: 'var(--border-color)',
          }}
          className="w-20 px-2 py-1 text-center font-mono text-[11px] font-bold rounded-lg border focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
        />

        {/* Swatch & Picker */}
        <div className="relative w-8 h-8 rounded-xl border border-black/20 shadow-xs overflow-hidden cursor-pointer shrink-0">
          <input
            type="color"
            value={value && value.startsWith('#') ? value : '#000000'}
            onChange={handlePickerChange}
            className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer opacity-0"
            title="Choisir la couleur"
          />
          <div
            className="w-full h-full pointer-events-none rounded-xl"
            style={{ backgroundColor: value || '#000000' }}
          />
        </div>
      </div>
    </div>
  );
};

export const ThemesSection: React.FC<ThemesSectionProps> = ({
  themeManager,
  onThemeChange,
}) => {
  // Navigation interne : 'grid' = tous les thèmes, 'settings' = réglages du thème, 'store' = en ligne, 'unverified' = non vérifiés
  const [viewMode, setViewMode] = useState<'grid' | 'settings' | 'store' | 'unverified'>('grid');

  // Modals de création de thème et d'édition de code JSON
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeId, setNewThemeId] = useState('');
  const [createWithCode, setCreateWithCode] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);

  // Modal d'aperçu visuel en grand
  const [themeToPreview, setThemeToPreview] = useState<Theme | null>(null);

  // Édition de code JSON brut
  const [jsonModalTheme, setJsonModalTheme] = useState<Theme | null>(null);
  const [jsonCodeContent, setJsonCodeContent] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonSuccess, setJsonSuccess] = useState(false);

  // Store en ligne
  const [communityThemes, setCommunityThemes] = useState<any[]>([]);
  const [loadingCommunity, setLoadingCommunity] = useState(false);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);

  // Thèmes non vérifiés & installation GitHub URL
  const [unverifiedThemes, setUnverifiedThemes] = useState<any[]>([]);
  const [unverifiedUrl, setUnverifiedUrl] = useState('');
  const [loadingUnverified, setLoadingUnverified] = useState(false);
  const [unverifiedError, setUnverifiedError] = useState<string | null>(null);
  const [analyzingTheme, setAnalyzingTheme] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analyzedTheme, setAnalyzedTheme] = useState<Theme | null>(null);
  const [applyingThemeId, setApplyingThemeId] = useState<string | null>(null);
  const [applySuccessId, setApplySuccessId] = useState<string | null>(null);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    themes,
    activeTheme,
    colorPresets,
    activePresetId,
    reloadThemes,
    applyTheme,
    updateThemeColor,
    updateThemeLayout,
    updateThemeCustomCss,
    updateThemeFont,
    updateThemeAsset,
    applyColorPreset,
    saveCurrentTheme,
    resetThemeToDefault,
    createNewTheme,
    removeTheme,
  } = themeManager;

  const currentColors = activeTheme?.colors || colorPresets[0]?.colors;
  const currentLayout = activeTheme?.layout || {
    card_radius: '16px',
    sidebar_width: '280px',
    card_gap: '16px',
    card_aspect: 'poster',
    card_glow: 'subtle',
    scanlines: 'none',
    card_shadow: 'soft',
    card_scale: 'dynamic',
  };
  const currentFonts = activeTheme?.fonts || {
    primary: 'Outfit, Inter, system-ui, sans-serif',
    arcade: 'Press Start 2P, monospace',
    size_base: '14px',
  };

  const handleApplyTheme = async (id: string) => {
    try {
      await applyTheme(id);
      if (onThemeChange) {
        onThemeChange(id);
      }
    } catch (err) {
      console.error('[ThemesSection] Erreur application thème:', err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveCurrentTheme();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('[ThemesSection] Erreur sauvegarde thème:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenJsonEditor = (t: Theme) => {
    setJsonModalTheme(t);
    setJsonCodeContent(JSON.stringify(t, null, 2));
    setJsonError(null);
    setJsonSuccess(false);
  };

  const handleSaveJsonCode = async () => {
    if (!jsonModalTheme) return;
    try {
      const parsed = JSON.parse(jsonCodeContent);
      await saveTheme(parsed);
      await reloadThemes();
      await applyTheme(parsed.id);
      setJsonSuccess(true);
      setTimeout(() => {
        setJsonSuccess(false);
        setJsonModalTheme(null);
      }, 1200);
    } catch (err: any) {
      setJsonError(err?.message || 'Code JSON invalide');
    }
  };

  const handleCreateNewThemeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const cleanId = (newThemeId || newThemeName).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanId) {
      setCreateError('Veuillez spécifier un nom ou un identifiant.');
      return;
    }

    try {
      await createNewTheme(cleanId, newThemeName || cleanId, createWithCode);
      setShowCreateModal(false);
      setNewThemeName('');
      setNewThemeId('');
      setViewMode('settings');
    } catch (err: any) {
      setCreateError(err?.message || 'Erreur lors de la création du thème.');
    }
  };

  const handleDeleteTheme = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === 'kairo-default') return;
    if (confirm(`Voulez-vous vraiment supprimer le thème "${id}" du disque ?`)) {
      try {
        await removeTheme(id);
      } catch (err) {
        console.error('[ThemesSection] Erreur suppression thème:', err);
      }
    }
  };

  // Charger les thèmes communautaires depuis GitHub
  const fetchCommunityThemes = async () => {
    setLoadingCommunity(true);
    setCommunityError(null);
    try {
      const res = await fetch('https://api.github.com/repos/KairoOS-Official/kairos-themes/contents/');
      if (!res.ok) {
        throw new Error(`Dépôt distant introuvable (${res.status})`);
      }
      const contents: GitHubContentItem[] = await res.json();
      const folders = contents.filter((item) => item.type === 'dir');

      const loadedThemes = await Promise.all(
        folders.map(async (folder) => {
          try {
            const rawJson = await fetch(
              `https://raw.githubusercontent.com/KairoOS-Official/kairos-themes/main/${folder.name}/theme.json`
            );
            if (rawJson.ok) {
              const parsed = await rawJson.json();
              const previewImageName = parsed.preview_image || 'preview.svg';
              return {
                ...parsed,
                preview_url: `https://raw.githubusercontent.com/KairoOS-Official/kairos-themes/main/${folder.name}/${previewImageName}`,
                folder_name: folder.name,
              };
            }
          } catch {
            // ignore
          }
          return {
            id: folder.name,
            name: folder.name,
            author: 'Communauté',
            version: '1.0.0',
            description: 'Thème communautaire KaïroOS',
            preview_url: `https://raw.githubusercontent.com/KairoOS-Official/kairos-themes/main/${folder.name}/preview.svg`,
            folder_name: folder.name,
          };
        })
      );

      setCommunityThemes(loadedThemes.filter(Boolean));
    } catch (err: any) {
      setCommunityError('Catalogue en ligne inaccessible ou aucun thème supplémentaire.');
      setCommunityThemes([]);
    } finally {
      setLoadingCommunity(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'store' && communityThemes.length === 0) {
      fetchCommunityThemes();
    }
  }, [viewMode]);

  const handleDownload = async (item: any) => {
    setDownloadingId(item.id);
    try {
      const zipUrl = `https://github.com/KairoOS-Official/kairos-themes/archive/refs/heads/main.zip`;
      await downloadCommunityTheme(item.id, zipUrl);
      await reloadThemes();
      setDownloadSuccessId(item.id);
      setTimeout(() => setDownloadSuccessId(null), 3000);
    } catch (err) {
      console.error('[ThemesSection] Erreur de téléchargement:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  // Charger les thèmes non vérifiés depuis GitHub (/unverified)
  const fetchUnverifiedThemes = async () => {
    setLoadingUnverified(true);
    setUnverifiedError(null);
    try {
      const res = await fetch('https://api.github.com/repos/KairoOS-Official/kairos-themes/contents/unverified');
      if (!res.ok) {
        if (res.status === 404) {
          setUnverifiedThemes([]);
          return;
        }
        throw new Error(`Dépôt distant introuvable (${res.status})`);
      }
      const contents: GitHubContentItem[] = await res.json();
      if (!Array.isArray(contents)) {
        setUnverifiedThemes([]);
        return;
      }

      const loadedThemes = await Promise.all(
        contents.map(async (item) => {
          if (item.type === 'dir') {
            try {
              const rawJson = await fetch(
                `https://raw.githubusercontent.com/KairoOS-Official/kairos-themes/main/unverified/${item.name}/theme.json`
              );
              if (rawJson.ok) {
                const parsed = await rawJson.json();
                const previewImageName = parsed.preview_image || 'preview.svg';
                return {
                  ...parsed,
                  theme_type: 'unverified',
                  preview_url: `https://raw.githubusercontent.com/KairoOS-Official/kairos-themes/main/unverified/${item.name}/${previewImageName}`,
                  folder_name: item.name,
                };
              }
            } catch {
              // ignore
            }
            return {
              id: item.name,
              name: item.name,
              author: 'Inconnu',
              version: '1.0.0',
              description: 'Thème non vérifié',
              theme_type: 'unverified',
              preview_url: `https://raw.githubusercontent.com/KairoOS-Official/kairos-themes/main/unverified/${item.name}/preview.svg`,
              folder_name: item.name,
            };
          } else if (item.name.endsWith('.json')) {
            try {
              const rawJson = await fetch(item.download_url || `https://raw.githubusercontent.com/KairoOS-Official/kairos-themes/main/unverified/${item.name}`);
              if (rawJson.ok) {
                const parsed = await rawJson.json();
                return {
                  ...parsed,
                  theme_type: 'unverified',
                  id: parsed.id || item.name.replace('.json', ''),
                };
              }
            } catch {
              // ignore
            }
          }
          return null;
        })
      );

      setUnverifiedThemes(loadedThemes.filter(Boolean));
    } catch (err: any) {
      console.warn('[ThemesSection] Erreur chargement thèmes non vérifiés:', err);
      setUnverifiedThemes([]);
    } finally {
      setLoadingUnverified(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'unverified' && unverifiedThemes.length === 0) {
      fetchUnverifiedThemes();
    }
  }, [viewMode]);

  // Analyser un thème GitHub à partir de son URL
  const handleAnalyzeThemeUrl = async () => {
    const rawInput = unverifiedUrl.trim();
    if (!rawInput) {
      setAnalysisError('Veuillez entrer une URL GitHub valide.');
      return;
    }

    setAnalyzingTheme(true);
    setAnalysisError(null);
    setAnalyzedTheme(null);

    try {
      let candidateUrls: string[] = [];

      if (rawInput.endsWith('theme.json') || rawInput.endsWith('.json')) {
        if (rawInput.includes('github.com') && rawInput.includes('/blob/')) {
          candidateUrls.push(rawInput.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'));
        }
        candidateUrls.push(rawInput);
      } else {
        let clean = rawInput.replace(/\/$/, '');
        clean = clean.replace(/^https?:\/\/github\.com\//, '');
        const parts = clean.split('/');
        if (parts.length >= 2) {
          const owner = parts[0];
          const repo = parts[1];
          candidateUrls.push(`https://raw.githubusercontent.com/${owner}/${repo}/main/theme.json`);
          candidateUrls.push(`https://raw.githubusercontent.com/${owner}/${repo}/master/theme.json`);
          candidateUrls.push(`https://raw.githubusercontent.com/${owner}/${repo}/main/unverified/theme.json`);
          candidateUrls.push(`https://api.github.com/repos/${owner}/${repo}/contents/theme.json`);
        } else {
          throw new Error("Format d'URL invalide. Spécifiez https://github.com/proprietaire/depot ou un lien raw direct.");
        }
      }

      let parsedTheme: any = null;
      let lastErr = '';

      for (const url of candidateUrls) {
        try {
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          if (res.ok) {
            const data = await res.json();
            if (data && data.content && data.encoding === 'base64') {
              const decoded = atob(data.content.replace(/\s/g, ''));
              parsedTheme = JSON.parse(decoded);
              break;
            } else if (data && (data.colors || data.id || data.name)) {
              parsedTheme = data;
              break;
            }
          }
        } catch (e: any) {
          lastErr = e.message;
        }
      }

      if (!parsedTheme) {
        throw new Error('Fichier theme.json introuvable dans le dépôt spécifié (testé sur main/master).' + (lastErr ? ` Détail: ${lastErr}` : ''));
      }

      const id = parsedTheme.id || unverifiedUrl.split('/').pop()?.replace(/\.json$/, '').toLowerCase() || 'theme-unverified';
      const cleanId = id.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

      const normalizedTheme: Theme = {
        id: cleanId,
        name: parsedTheme.name || cleanId,
        author: parsedTheme.author || 'Auteur tiers',
        version: parsedTheme.version || '1.0.0',
        description: parsedTheme.description || 'Thème non vérifié installé depuis GitHub',
        layout_type: parsedTheme.layout_type || 'sidebar_grid',
        theme_type: 'unverified',
        colors: {
          bg_primary: parsedTheme.colors?.bg_primary || '#0f172a',
          bg_secondary: parsedTheme.colors?.bg_secondary || '#1e293b',
          bg_card: parsedTheme.colors?.bg_card || '#1e293b',
          sidebar_bg: parsedTheme.colors?.sidebar_bg || '#0f172a',
          accent_primary: parsedTheme.colors?.accent_primary || '#f43f5e',
          accent_secondary: parsedTheme.colors?.accent_secondary || '#e11d48',
          text_primary: parsedTheme.colors?.text_primary || '#f8fafc',
          text_secondary: parsedTheme.colors?.text_secondary || '#94a3b8',
          text_muted: parsedTheme.colors?.text_muted || '#64748b',
          border: parsedTheme.colors?.border || '#334155',
          success: parsedTheme.colors?.success || '#10b981',
          warning: parsedTheme.colors?.warning || '#f59e0b',
          danger: parsedTheme.colors?.danger || '#ef4444',
          ...parsedTheme.colors,
        },
        fonts: parsedTheme.fonts || {
          primary: 'Outfit, Inter, system-ui, sans-serif',
          arcade: 'Press Start 2P, monospace',
          size_base: '14px',
        },
        layout: parsedTheme.layout || {
          card_radius: '16px',
          sidebar_width: '280px',
          card_gap: '16px',
          card_aspect: 'poster',
          card_glow: 'subtle',
          scanlines: 'none',
          card_shadow: 'soft',
          card_scale: 'dynamic',
        },
        assets: parsedTheme.assets || {},
        custom_css: parsedTheme.custom_css,
        preview_url: parsedTheme.preview_url,
        is_active: false,
      };

      setAnalyzedTheme(normalizedTheme);
    } catch (err: any) {
      setAnalysisError(err?.message || 'Erreur lors de l\'analyse du thème GitHub.');
    } finally {
      setAnalyzingTheme(false);
    }
  };

  // Télécharger/sauvegarder et appliquer un thème non vérifié
  const handleApplyAnalyzedTheme = async (themeToApply: any) => {
    setApplyingThemeId(themeToApply.id);
    try {
      const payload: Theme = {
        id: themeToApply.id,
        name: themeToApply.name || themeToApply.id,
        author: themeToApply.author || 'Auteur tiers',
        version: themeToApply.version || '1.0.0',
        description: themeToApply.description || 'Thème non vérifié',
        layout_type: themeToApply.layout_type || 'sidebar_grid',
        theme_type: 'unverified',
        colors: themeToApply.colors || currentColors,
        fonts: themeToApply.fonts || currentFonts,
        layout: themeToApply.layout || currentLayout,
        assets: themeToApply.assets || {},
        custom_css: themeToApply.custom_css,
        preview_url: themeToApply.preview_url,
        is_active: true,
      };

      await saveTheme(payload);
      await reloadThemes();
      await applyTheme(payload.id);
      if (onThemeChange) {
        onThemeChange(payload.id);
      }
      setApplySuccessId(themeToApply.id);
      setTimeout(() => setApplySuccessId(null), 3000);
    } catch (err: any) {
      console.error('[ThemesSection] Erreur application thème:', err);
      setAnalysisError(err?.message || 'Erreur lors de l\'application du thème.');
    } finally {
      setApplyingThemeId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Barre de navigation principale Thèmes */}
      <div
        style={{ borderColor: 'var(--border-color)' }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3"
      >
        <div className="flex items-center gap-2">
          {viewMode === 'settings' ? (
            <button
              onClick={() => setViewMode('grid')}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                borderColor: 'var(--border-color)',
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black border transition-all hover:border-[var(--accent-primary)]/40 shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-rose-500" />
              <span>← Retour aux Thèmes</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  backgroundColor: viewMode === 'grid' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'grid' ? '#ffffff' : 'var(--text-secondary)',
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tous les Thèmes ({themes.length})</span>
              </button>
              <button
                onClick={() => setViewMode('store')}
                style={{
                  backgroundColor: viewMode === 'store' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'store' ? '#ffffff' : 'var(--text-secondary)',
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Store & En ligne</span>
              </button>
              <button
                onClick={() => setViewMode('unverified')}
                style={{
                  backgroundColor: viewMode === 'unverified' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'unverified' ? '#ffffff' : 'var(--text-secondary)',
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>Non Vérifiés</span>
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {viewMode === 'settings' && (
            <>
              <button
                onClick={resetThemeToDefault}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-secondary)',
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold hover:opacity-80 transition-all shadow-2xs"
                title="Rétablir les couleurs d'origine"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réinitialiser</span>
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black hover:opacity-90 transition-all shadow-sm"
              >
                {saveSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Enregistré !</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Enregistrement...' : 'Sauvegarder'}</span>
                  </>
                )}
              </button>
            </>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)',
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold hover:border-[var(--accent-primary)]/40 transition-all shadow-2xs"
            title="Créer un nouveau thème dans le dossier themes/"
          >
            <Plus className="w-3.5 h-3.5 text-rose-500" />
            <span>Nouveau Thème</span>
          </button>

          <button
            onClick={() => openThemesFolder()}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
              color: 'var(--text-secondary)',
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border hover:opacity-80 text-xs font-bold transition-all shadow-2xs"
            title="Ouvrir le dossier themes/ dans l'explorateur Windows"
          >
            <FolderOpen className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
            <span>Dossier Thèmes</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VUE 1 : GRILLE DES THÈMES DISPONIBLES                    */}
      {/* ========================================================= */}
      {viewMode === 'grid' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {themes.map((t) => {
              const isActive = activeTheme.id === t.id;
              const tColors = t.colors || currentColors;
              const isCodeTheme = t.theme_type === 'custom-code' || Boolean(t.entry_path);

              return (
                <div
                  key={t.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: isActive ? 'var(--accent-primary)' : 'var(--border-color)',
                  }}
                  className={`rounded-3xl border-2 p-4 flex flex-col justify-between transition-all shadow-xs group ${
                    isActive ? 'ring-2 ring-[var(--accent-primary)]/20' : 'hover:border-[var(--accent-primary)]/40'
                  }`}
                >
                  {/* Aperçu Visuel Carte du Thème */}
                  <div
                    onClick={() => setThemeToPreview(t)}
                    style={{
                      backgroundColor: tColors.bg_primary,
                      borderColor: isActive ? 'var(--accent-primary)' : tColors.border,
                    }}
                    className="h-32 rounded-2xl border-2 relative overflow-hidden shadow-inner mb-3 cursor-pointer group/preview"
                    title="Cliquer pour afficher l'aperçu en grand"
                  >
                    {t.preview_url ? (
                      <img
                        src={t.preview_url.startsWith('http') ? t.preview_url : convertFileSrc(t.preview_url)}
                        alt={`Aperçu ${t.name}`}
                        className="w-full h-full object-cover group-hover/preview:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full p-2.5 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <div
                              className="w-3 h-3 rounded-md"
                              style={{ backgroundColor: tColors.accent_primary }}
                            />
                            <span
                              className="text-[10px] font-black truncate max-w-[120px]"
                              style={{ color: tColors.text_primary }}
                            >
                              {t.name}
                            </span>
                          </div>
                          <span
                            className="px-1.5 py-0.5 rounded text-[8px] font-bold"
                            style={{
                              backgroundColor: tColors.accent_secondary,
                              color: '#ffffff',
                            }}
                          >
                            v{t.version || '1.0'}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-1.5">
                          <div
                            style={{
                              backgroundColor: tColors.bg_card,
                              borderColor: tColors.accent_primary,
                              borderRadius: t.layout?.card_radius || '8px',
                            }}
                            className="h-10 border-2 flex items-center justify-center text-[8px] font-bold text-center"
                          >
                            <span style={{ color: tColors.accent_primary }}>Actif</span>
                          </div>
                          <div
                            style={{
                              backgroundColor: tColors.bg_card,
                              borderColor: tColors.border,
                              borderRadius: t.layout?.card_radius || '8px',
                            }}
                            className="h-10 border flex items-center justify-center text-[8px] text-center"
                          >
                            <span style={{ color: tColors.text_muted }}>Jeu 2</span>
                          </div>
                          <div
                            style={{
                              backgroundColor: tColors.bg_card,
                              borderColor: tColors.border,
                              borderRadius: t.layout?.card_radius || '8px',
                            }}
                            className="h-10 border flex items-center justify-center text-[8px] text-center"
                          >
                            <span style={{ color: tColors.text_muted }}>Jeu 3</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Badge Mode Code Custom ou Built-in ou Non Vérifié */}
                    <div className="absolute top-2 left-2 flex items-center gap-1">
                      {isCodeTheme ? (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-wide bg-emerald-500 text-white shadow-md flex items-center gap-1">
                          <Code className="w-2.5 h-2.5" />
                          <span>CODE VITE/HTML</span>
                        </span>
                      ) : t.theme_type === 'unverified' || (t as any).is_unverified ? (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-wide bg-red-600 text-white shadow-md">
                          NON VÉRIFIÉ
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black tracking-wide bg-purple-600/90 text-white shadow-md">
                          INTÉGRÉ
                        </span>
                      )}
                    </div>

                    {/* Badge Actif */}
                    {isActive && (
                      <div
                        style={{ backgroundColor: 'var(--accent-primary)' }}
                        className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-[9px] font-black text-white flex items-center gap-1 shadow-md"
                      >
                        <Check className="w-2.5 h-2.5" />
                        <span>ACTIF</span>
                      </div>
                    )}

                    {/* Overlay au survol */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-2xs">
                      <span className="px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-black shadow-lg flex items-center gap-1.5">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Aperçu</span>
                      </span>
                    </div>
                  </div>

                  {/* Infos Thème */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center justify-between">
                      <h4
                        style={{ color: 'var(--text-primary)' }}
                        className="text-sm font-black truncate"
                      >
                        {t.name}
                      </h4>
                      <span
                        style={{ color: 'var(--text-muted)' }}
                        className="text-[10px] font-mono shrink-0"
                      >
                        {t.id}
                      </span>
                    </div>

                    <p
                      style={{ color: 'var(--text-muted)' }}
                      className="text-[11px] line-clamp-2 leading-relaxed"
                    >
                      {t.description || "Thème pour la borne d'arcade KaïroOS."}
                    </p>

                    <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                      Par <span className="font-bold">{t.author || 'Kaïro Team'}</span>
                    </div>

                    {/* Pastilles des couleurs clés */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <div
                        className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: tColors.bg_primary }}
                        title={`Fond: ${tColors.bg_primary}`}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: tColors.bg_card }}
                        title={`Cartes: ${tColors.bg_card}`}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: tColors.sidebar_bg }}
                        title={`Sidebar: ${tColors.sidebar_bg}`}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: tColors.accent_primary }}
                        title={`Accent: ${tColors.accent_primary}`}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: tColors.accent_secondary }}
                        title={`Secondaire: ${tColors.accent_secondary}`}
                      />
                    </div>
                  </div>

                  {/* Boutons d'Action Thème */}
                  <div
                    style={{ borderColor: 'var(--border-color)' }}
                    className="pt-3 mt-3 border-t flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-1">
                      {/* Bouton Aperçu du Thème */}
                      <button
                        onClick={() => setThemeToPreview(t)}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          borderColor: 'var(--border-color)',
                        }}
                        className="p-1.5 rounded-xl border hover:border-[var(--accent-primary)]/40 transition-all shadow-2xs"
                        title="Afficher l'aperçu du thème"
                      >
                        <Eye className="w-3.5 h-3.5 text-cyan-500" />
                      </button>

                      {/* Petit bouton Paramètres du Thème demandé par l'utilisateur */}
                      <button
                        onClick={async () => {
                          if (!isActive) {
                            await handleApplyTheme(t.id);
                          }
                          setViewMode('settings');
                        }}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-primary)',
                          borderColor: 'var(--border-color)',
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold hover:border-[var(--accent-primary)]/40 transition-all shadow-2xs"
                        title="Configurer et personnaliser ce thème"
                      >
                        <Sliders className="w-3 h-3 text-rose-500" />
                        <span>Paramètres</span>
                      </button>

                      {/* Bouton Éditer le code JSON */}
                      <button
                        onClick={() => handleOpenJsonEditor(t)}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          color: 'var(--text-muted)',
                          borderColor: 'var(--border-color)',
                        }}
                        className="p-1.5 rounded-xl border hover:text-slate-800 transition-all"
                        title="Afficher et éditer le code JSON de ce thème"
                      >
                        <Code className="w-3.5 h-3.5" />
                      </button>

                      {/* Bouton Supprimer si non default */}
                      {t.id !== 'kairo-default' && (
                        <button
                          onClick={(e) => handleDeleteTheme(t.id, e)}
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-muted)',
                            borderColor: 'var(--border-color)',
                          }}
                          className="p-1.5 rounded-xl border hover:text-red-500 transition-all"
                          title="Supprimer ce thème"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Bouton Activer */}
                    {!isActive ? (
                      <button
                        onClick={() => handleApplyTheme(t.id)}
                        style={{
                          backgroundColor: 'var(--accent-primary)',
                          color: '#ffffff',
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-black hover:opacity-90 transition-all shadow-xs"
                      >
                        Appliquer
                      </button>
                    ) : (
                      <span
                        style={{ color: 'var(--color-success)' }}
                        className="text-xs font-black flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>En cours</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VUE 2 : PARAMÈTRES DU THÈME (LE PANNEAU DE PERSONNALISATION) */}
      {/* ========================================================= */}
      {viewMode === 'settings' && (
        <div className="space-y-6">
          {/* Bandeau Titre du Thème Actif en cours d'édition */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="p-5 rounded-3xl border shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner border border-black/10 shrink-0"
                style={{ backgroundColor: currentColors.bg_primary }}
              >
                <Sparkles className="w-6 h-6" style={{ color: currentColors.accent_primary }} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span
                    style={{ color: 'var(--accent-primary)' }}
                    className="text-[10px] font-black uppercase tracking-wider"
                  >
                    ⚙️ Paramètres du Thème
                  </span>
                  <span
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      borderColor: 'var(--border-color)',
                    }}
                    className="px-2 py-0.5 rounded-md border text-[10px] font-mono font-bold"
                  >
                    {activeTheme.name} ({activeTheme.id})
                  </span>
                </div>
                <h3
                  style={{ color: 'var(--text-primary)' }}
                  className="text-base font-black tracking-tight"
                >
                  Personnalisation & Ambiance Rétro
                </h3>
                <p style={{ color: 'var(--text-muted)' }} className="text-xs">
                  Modifiez les couleurs, les polices, les effets CRT et les styles en direct.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenJsonEditor(activeTheme)}
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  borderColor: 'var(--border-color)',
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold hover:text-slate-800 transition-all shadow-2xs"
                title="Modifier directement le code JSON"
              >
                <Code className="w-3.5 h-3.5 text-rose-500" />
                <span>Modifier le Code JSON</span>
              </button>
            </div>
          </div>

          {/* Mini Mockup / Live Preview interactif */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="p-5 rounded-3xl border shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <span
                  style={{ color: 'var(--text-primary)' }}
                  className="text-xs font-black uppercase tracking-wider"
                >
                  Aperçu en Direct de l'Interface
                </span>
              </div>
              <span style={{ color: 'var(--text-muted)' }} className="text-[11px] font-mono">
                Mise à jour instantanée en direct
              </span>
            </div>

            <div
              style={{
                backgroundColor: currentColors.bg_primary,
                borderColor: currentColors.border,
              }}
              className="p-4 rounded-2xl border flex gap-4 overflow-hidden relative shadow-inner min-h-[170px]"
            >
              {/* Mini Sidebar */}
              <div
                style={{
                  backgroundColor: currentColors.sidebar_bg,
                  borderColor: currentColors.border,
                  width:
                    currentLayout.sidebar_width === '240px'
                      ? '80px'
                      : currentLayout.sidebar_width === '320px'
                      ? '110px'
                      : '95px',
                }}
                className="rounded-xl border p-2 flex flex-col gap-1.5 shrink-0 transition-all duration-300"
              >
                <div className="flex items-center gap-1 mb-1">
                  <div
                    className="w-3.5 h-3.5 rounded-md"
                    style={{ backgroundColor: currentColors.accent_primary }}
                  />
                  <div
                    className="w-10 h-2 rounded"
                    style={{ backgroundColor: currentColors.text_primary, opacity: 0.8 }}
                  />
                </div>
                <div
                  className="px-1.5 py-1 rounded-lg text-[9px] font-bold flex items-center gap-1"
                  style={{
                    backgroundColor: currentColors.accent_primary,
                    color: '#ffffff',
                  }}
                >
                  <span>Tous les jeux</span>
                </div>
                <div
                  className="px-1.5 py-1 rounded-lg text-[9px] font-bold"
                  style={{ color: currentColors.text_secondary }}
                >
                  Favoris
                </div>
                <div
                  className="px-1.5 py-1 rounded-lg text-[9px] font-bold"
                  style={{ color: currentColors.text_muted }}
                >
                  Récents
                </div>
              </div>

              {/* Mini Main View */}
              <div className="flex-1 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div
                    className="h-3 w-28 rounded"
                    style={{ backgroundColor: currentColors.text_primary }}
                  />
                  <div className="flex gap-1.5">
                    <span
                      className="px-2 py-0.5 rounded text-[9px] font-bold"
                      style={{
                        backgroundColor: currentColors.accent_secondary,
                        color: '#ffffff',
                      }}
                    >
                      Secondaire
                    </span>
                    <span
                      className="px-2 py-0.5 rounded text-[9px] font-bold"
                      style={{
                        backgroundColor: currentColors.success,
                        color: '#ffffff',
                      }}
                    >
                      En ligne
                    </span>
                  </div>
                </div>

                <div
                  style={{ gap: currentLayout.card_gap || '16px' }}
                  className="grid grid-cols-2 flex-1 items-stretch"
                >
                  {/* Mini Card 1 (Focused) */}
                  <div
                    style={{
                      backgroundColor: currentColors.bg_card,
                      borderColor: currentColors.accent_primary,
                      borderRadius: currentLayout.card_radius || '16px',
                      boxShadow:
                        currentLayout.card_glow === 'neon'
                          ? `0 0 20px 2px ${currentColors.accent_primary}`
                          : currentLayout.card_glow === 'subtle'
                          ? `0 0 10px -2px ${currentColors.accent_primary}`
                          : undefined,
                      transform: currentLayout.card_scale === 'dynamic' ? 'scale(1.03)' : undefined,
                    }}
                    className="p-2.5 border-2 shadow-xs flex flex-col justify-between transition-all"
                  >
                    <div
                      className="h-12 rounded-lg mb-1 flex items-center justify-center text-[10px] font-black"
                      style={{
                        backgroundColor: currentColors.bg_secondary,
                        color: currentColors.accent_primary,
                      }}
                    >
                      Jeu Actif
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-bold truncate"
                        style={{ color: currentColors.text_primary }}
                      >
                        Super Mario World
                      </span>
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: currentColors.accent_primary }}
                      />
                    </div>
                  </div>

                  {/* Mini Card 2 */}
                  <div
                    style={{
                      backgroundColor: currentColors.bg_card,
                      borderColor: currentColors.border,
                      borderRadius: currentLayout.card_radius || '16px',
                    }}
                    className="p-2.5 border shadow-2xs flex flex-col justify-between transition-all"
                  >
                    <div
                      className="h-12 rounded-lg mb-1 flex items-center justify-center text-[10px] font-bold"
                      style={{
                        backgroundColor: currentColors.bg_secondary,
                        color: currentColors.text_muted,
                      }}
                    >
                      Tuile Normale
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-medium truncate"
                        style={{ color: currentColors.text_secondary }}
                      >
                        Sonic The Hedgehog
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1 : Variantes Rapides (Presets de Couleurs en 1-Clic) */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="p-5 rounded-3xl border shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <h3
                  style={{ color: 'var(--text-primary)' }}
                  className="text-xs font-black uppercase tracking-wider"
                >
                  Variantes de Couleurs Prédéfinies (1-Clic)
                </h3>
              </div>
              <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                Cliquez pour charger instantanément toute sa palette
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {colorPresets.map((preset) => {
                const isSelected = activePresetId === preset.id;

                return (
                  <div
                    key={preset.id}
                    onClick={() => applyColorPreset(preset.id)}
                    style={{
                      backgroundColor: isSelected ? 'var(--bg-secondary)' : 'var(--bg-card)',
                      borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-color)',
                    }}
                    className={`p-3 rounded-2xl border-2 cursor-pointer transition-all hover:scale-[1.01] shadow-2xs ${
                      isSelected ? 'ring-2 ring-[var(--accent-primary)]/20' : 'hover:border-[var(--accent-primary)]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        style={{ color: 'var(--text-primary)' }}
                        className="text-xs font-black truncate"
                      >
                        {preset.name}
                      </span>
                      {isSelected && (
                        <div
                          style={{ backgroundColor: 'var(--accent-primary)' }}
                          className="px-1.5 py-0.5 rounded text-[9px] font-black text-white flex items-center gap-0.5 shrink-0"
                        >
                          <Check className="w-2.5 h-2.5" />
                          <span>Actif</span>
                        </div>
                      )}
                    </div>

                    <p
                      style={{ color: 'var(--text-muted)' }}
                      className="text-[10px] line-clamp-1 mb-2"
                    >
                      {preset.description}
                    </p>

                    {/* Palette Swatches */}
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: preset.colors.bg_primary }}
                        title={`Fond: ${preset.colors.bg_primary}`}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: preset.colors.bg_card }}
                        title={`Cartes: ${preset.colors.bg_card}`}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: preset.colors.sidebar_bg }}
                        title={`Sidebar: ${preset.colors.sidebar_bg}`}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: preset.colors.accent_primary }}
                        title={`Accent: ${preset.colors.accent_primary}`}
                      />
                      <div
                        className="w-4 h-4 rounded-full border border-black/15 shadow-2xs"
                        style={{ backgroundColor: preset.colors.accent_secondary }}
                        title={`Secondaire: ${preset.colors.accent_secondary}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2 : Ambiance & Effets Rétro Arcade */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="p-5 rounded-3xl border shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2">
              <Tv className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <h3
                style={{ color: 'var(--text-primary)' }}
                className="text-xs font-black uppercase tracking-wider"
              >
                Ambiance & Effets Visuels Rétro Arcade
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Scanlines CRT */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                }}
                className="p-3.5 rounded-2xl border space-y-2.5"
              >
                <div>
                  <div style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                    Lignes de Balayage (CRT)
                  </div>
                  <div style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                    Effet écran cathodique arcade
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { label: 'Sans', value: 'none' },
                    { label: 'Subtil (12%)', value: 'light' },
                    { label: 'Rétro (28%)', value: 'retro' },
                    { label: 'Intense (44%)', value: 'intense' },
                  ].map((opt) => {
                    const isCur = (currentLayout.scanlines || 'none') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateThemeLayout('scanlines', opt.value as any)}
                        style={{
                          backgroundColor: isCur ? 'var(--accent-primary)' : 'var(--bg-card)',
                          color: isCur ? '#ffffff' : 'var(--text-secondary)',
                          borderColor: isCur ? 'transparent' : 'var(--border-color)',
                        }}
                        className="py-1 px-1.5 text-[10px] font-bold rounded-xl border transition-all text-center"
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lueur Néon (Card Glow) */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                }}
                className="p-3.5 rounded-2xl border space-y-2.5"
              >
                <div>
                  <div style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                    Lueur Néon sur Sélection
                  </div>
                  <div style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                    Halo lumineux autour des cartes actives
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: 'Désactivé', value: 'none' },
                    { label: 'Subtil', value: 'subtle' },
                    { label: 'Néon Fort', value: 'neon' },
                  ].map((opt) => {
                    const isCur = (currentLayout.card_glow || 'subtle') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateThemeLayout('card_glow', opt.value as any)}
                        style={{
                          backgroundColor: isCur ? 'var(--accent-primary)' : 'var(--bg-card)',
                          color: isCur ? '#ffffff' : 'var(--text-secondary)',
                          borderColor: isCur ? 'transparent' : 'var(--border-color)',
                        }}
                        className="py-1 px-1 text-[10px] font-bold rounded-xl border transition-all text-center"
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Format / Aspect Ratio des Tuiles */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                }}
                className="p-3.5 rounded-2xl border space-y-2.5"
              >
                <div>
                  <div style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                    Format des Cartes de Jeux
                  </div>
                  <div style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                    Ratio géométrique des tuiles
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: 'Boîtier 3:4', value: 'poster' },
                    { label: 'Carré 1:1', value: 'square' },
                    { label: 'Vidéo 16:9', value: 'landscape' },
                  ].map((opt) => {
                    const isCur = (currentLayout.card_aspect || 'poster') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateThemeLayout('card_aspect', opt.value as any)}
                        style={{
                          backgroundColor: isCur ? 'var(--accent-primary)' : 'var(--bg-card)',
                          color: isCur ? '#ffffff' : 'var(--text-secondary)',
                          borderColor: isCur ? 'transparent' : 'var(--border-color)',
                        }}
                        className="py-1 px-1 text-[10px] font-bold rounded-xl border transition-all text-center"
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Zoom dynamique au focus */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                }}
                className="p-3.5 rounded-2xl border space-y-2.5"
              >
                <div>
                  <div style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                    Zoom au Focus / Survol
                  </div>
                  <div style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                    Agrandissement carte sélectionnée
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: 'Statique (0%)', value: 'none' },
                    { label: 'Léger (+2.5%)', value: 'subtle' },
                    { label: 'Pop (+5%)', value: 'dynamic' },
                  ].map((opt) => {
                    const isCur = (currentLayout.card_scale || 'dynamic') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateThemeLayout('card_scale', opt.value as any)}
                        style={{
                          backgroundColor: isCur ? 'var(--accent-primary)' : 'var(--bg-card)',
                          color: isCur ? '#ffffff' : 'var(--text-secondary)',
                          borderColor: isCur ? 'transparent' : 'var(--border-color)',
                        }}
                        className="py-1 px-1 text-[10px] font-bold rounded-xl border transition-all text-center"
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3 : Formes, Agencement & Polices */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="p-5 rounded-3xl border shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <h3
                style={{ color: 'var(--text-primary)' }}
                className="text-xs font-black uppercase tracking-wider"
              >
                Style & Agencement de la Grille
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Arrondi des cartes */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                }}
                className="p-3.5 rounded-2xl border space-y-2.5"
              >
                <div>
                  <div style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                    Arrondi des Cartes
                  </div>
                  <div style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                    Rayon des tuiles
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { label: 'Carré', value: '0px' },
                    { label: '8px', value: '8px' },
                    { label: '16px', value: '16px' },
                    { label: '24px', value: '24px' },
                  ].map((opt) => {
                    const isCur = currentLayout.card_radius === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateThemeLayout('card_radius', opt.value)}
                        style={{
                          backgroundColor: isCur ? 'var(--accent-primary)' : 'var(--bg-card)',
                          color: isCur ? '#ffffff' : 'var(--text-secondary)',
                          borderColor: isCur ? 'transparent' : 'var(--border-color)',
                        }}
                        className="py-1 text-[11px] font-bold rounded-xl border transition-all text-center"
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Espacement de la grille */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                }}
                className="p-3.5 rounded-2xl border space-y-2.5"
              >
                <div>
                  <div style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                    Espacement Grille
                  </div>
                  <div style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                    Espace entre cartes
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: 'Compact', value: '12px' },
                    { label: 'Normal', value: '16px' },
                    { label: 'Aéré', value: '24px' },
                  ].map((opt) => {
                    const isCur = currentLayout.card_gap === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateThemeLayout('card_gap', opt.value)}
                        style={{
                          backgroundColor: isCur ? 'var(--accent-primary)' : 'var(--bg-card)',
                          color: isCur ? '#ffffff' : 'var(--text-secondary)',
                          borderColor: isCur ? 'transparent' : 'var(--border-color)',
                        }}
                        className="py-1 text-[11px] font-bold rounded-xl border transition-all text-center"
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Largeur barre latérale */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                }}
                className="p-3.5 rounded-2xl border space-y-2.5"
              >
                <div>
                  <div style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                    Largeur Barre Latérale
                  </div>
                  <div style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                    Dimension de navigation
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: 'Étroit', value: '240px' },
                    { label: 'Standard', value: '280px' },
                    { label: 'Large', value: '320px' },
                  ].map((opt) => {
                    const isCur = currentLayout.sidebar_width === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateThemeLayout('sidebar_width', opt.value)}
                        style={{
                          backgroundColor: isCur ? 'var(--accent-primary)' : 'var(--bg-card)',
                          color: isCur ? '#ffffff' : 'var(--text-secondary)',
                          borderColor: isCur ? 'transparent' : 'var(--border-color)',
                        }}
                        className="py-1 text-[11px] font-bold rounded-xl border transition-all text-center"
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Typographie */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                }}
                className="p-3.5 rounded-2xl border space-y-2.5"
              >
                <div className="flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <div>
                    <div style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                      Typographie
                    </div>
                    <div style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                      Police d'écriture
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { label: 'Moderne', value: 'Outfit, Inter, system-ui, sans-serif' },
                    { label: 'Pixel Rétro', value: 'Press Start 2P, monospace' },
                  ].map((opt) => {
                    const isCur = currentFonts.primary === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateThemeFont('primary', opt.value)}
                        style={{
                          backgroundColor: isCur ? 'var(--accent-primary)' : 'var(--bg-card)',
                          color: isCur ? '#ffffff' : 'var(--text-secondary)',
                          borderColor: isCur ? 'transparent' : 'var(--border-color)',
                        }}
                        className="py-1 text-[10px] font-bold rounded-xl border transition-all text-center truncate"
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Wallpaper personnalisé */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                }}
                className="p-3.5 rounded-2xl border space-y-2.5 sm:col-span-2 md:col-span-4"
              >
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" style={{ color: 'var(--accent-primary)' }} />
                  <div>
                    <div style={{ color: 'var(--text-primary)' }} className="text-xs font-bold">
                      Image de Fond Personnalisée (Wallpaper)
                    </div>
                    <div style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                      Chemin local (ex: C:/Images/fond.jpg) ou URL web
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="ex: https://example.com/wallpaper.jpg ou C:/Images/fond.png"
                    value={activeTheme?.assets?.background_image || ''}
                    onChange={(e) =>
                      updateThemeAsset('background_image', e.target.value.trim() || null)
                    }
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-primary)',
                    }}
                    className="flex-1 px-3 py-1.5 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                  />
                  {activeTheme?.assets?.background_image && (
                    <button
                      onClick={() => updateThemeAsset('background_image', null)}
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        borderColor: 'var(--border-color)',
                        color: 'var(--text-muted)',
                      }}
                      className="px-3 py-1.5 rounded-xl border text-xs font-bold hover:text-red-500 transition-colors"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section : Affichage des Rayons & Sections Visibles */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="p-5 rounded-3xl border shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layout className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <h3
                  style={{ color: 'var(--text-primary)' }}
                  className="text-xs font-black uppercase tracking-wider"
                >
                  Affichage des Rayons & Sections Visibles
                </h3>
              </div>
              <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                Activer ou masquer les rayons de l'interface
              </span>
            </div>

            {/* Toggles des Rayonnages & de la Sidebar */}
            <div className="space-y-2 pt-2">
              <h4
                style={{ color: 'var(--text-muted)' }}
                className="text-[11px] font-black uppercase tracking-wider"
              >
                Rayonnages et sections visibles sur la page
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {[
                  {
                    key: 'show_consoles_row',
                    label: '🕹️ Rayon Consoles & Systèmes',
                    desc: 'Grandes tuiles interactives de sélection système',
                    defaultVal: true,
                  },
                  {
                    key: 'show_favorites_row',
                    label: '⭐ Rayon Favoris',
                    desc: 'Carrousel horizontal des jeux favoris',
                    defaultVal: true,
                  },
                  {
                    key: 'show_modes_row',
                    label: '👥 Rayon Modes de Jeux',
                    desc: '2 Joueurs, Combat, Récents',
                    defaultVal: true,
                  },
                  {
                    key: 'show_genres_row',
                    label: '🏷️ Rayon Sagas & Franchises',
                    desc: 'Badges de franchises (Mario, Zelda, Sonic, etc.)',
                    defaultVal: true,
                  },
                  {
                    key: 'show_all_games_row',
                    label: '🎮 Rayon Bibliothèque Complète',
                    desc: 'Ruban horizontal de tous les jeux',
                    defaultVal: true,
                  },
                  {
                    key: 'show_sidebar',
                    label: '📂 Barre Latérale Gauche',
                    desc: 'Afficher la barre latérale de navigation',
                    defaultVal: activeTheme.layout_type !== 'single_page_categories',
                  },
                ].map((row) => {
                  const isEnabled = currentLayout[row.key as keyof typeof currentLayout] !== undefined
                    ? Boolean(currentLayout[row.key as keyof typeof currentLayout])
                    : row.defaultVal;

                  return (
                    <div
                      key={row.key}
                      onClick={() => updateThemeLayout(row.key as any, !isEnabled)}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderColor: isEnabled ? 'var(--accent-primary)' : 'var(--border-color)',
                      }}
                      className="p-3 rounded-2xl border flex items-center justify-between gap-2 cursor-pointer transition-all hover:border-[var(--accent-primary)]/40"
                    >
                      <div className="min-w-0 flex-1">
                        <div
                          style={{ color: 'var(--text-primary)' }}
                          className="text-xs font-bold truncate"
                        >
                          {row.label}
                        </div>
                        <div
                          style={{ color: 'var(--text-muted)' }}
                          className="text-[10px] truncate"
                        >
                          {row.desc}
                        </div>
                      </div>

                      <div
                        style={{
                          backgroundColor: isEnabled ? 'var(--accent-primary)' : 'var(--bg-card)',
                          borderColor: isEnabled ? 'var(--accent-primary)' : 'var(--border-color)',
                        }}
                        className="w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-colors"
                      >
                        {isEnabled && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section : Code CSS Personnalisé & Surcharges de Style */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="p-5 rounded-3xl border shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <h3
                  style={{ color: 'var(--text-primary)' }}
                  className="text-xs font-black uppercase tracking-wider"
                >
                  Code CSS Personnalisé (Injecteur en Temps Réel)
                </h3>
              </div>
              <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                Pour les développeurs & créateurs de thèmes
              </span>
            </div>

            <p style={{ color: 'var(--text-muted)' }} className="text-xs leading-relaxed">
              Injectez vos propres règles CSS pour styliser ou transformer n'importe quelle partie de l'application (ex: <code>.single-page-categories</code>, <code>.game-card</code>, <code>.shelf-row</code>, <code>.console-tile</code>). Les modifications sont appliquées instantanément en direct dans l'interface sans recompiler l'application.
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--text-secondary)' }} className="text-[11px] font-mono">
                  Éditeur CSS Live :
                </span>
                {activeTheme.custom_css && (
                  <button
                    type="button"
                    onClick={() => updateThemeCustomCss('')}
                    style={{
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-muted)',
                      borderColor: 'var(--border-color)',
                    }}
                    className="px-2 py-0.5 rounded-lg border text-[10px] font-bold hover:text-red-500 transition-colors"
                  >
                    Vider le CSS
                  </button>
                )}
              </div>

              <textarea
                value={activeTheme.custom_css || ''}
                onChange={(e) => updateThemeCustomCss(e.target.value)}
                placeholder={`/* Code CSS personnalisé injecté en direct */\n.single-page-categories {\n  /* personnalisation du hub */\n}\n\n.game-card {\n  /* personnalisation des tuiles de jeux */\n}`}
                rows={7}
                style={{
                  backgroundColor: '#0a0a0f',
                  color: '#4ade80',
                  borderColor: 'var(--border-color)',
                }}
                className="w-full p-3.5 rounded-2xl border font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)] resize-y"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Section 4 : Personnalisation Précise des Couleurs */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="p-5 rounded-3xl border shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
              <h3
                style={{ color: 'var(--text-primary)' }}
                className="text-xs font-black uppercase tracking-wider"
              >
                Personnalisation Précise des Couleurs (HEX & Pipette)
              </h3>
            </div>

            {/* Accents */}
            <div className="space-y-2">
              <h4
                style={{ color: 'var(--text-muted)' }}
                className="text-[11px] font-black uppercase tracking-wider"
              >
                Couleurs d'Accents & Sélections
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ColorPickerField
                  label="Accent Principal"
                  description="Boutons actifs, sélection manette, focus"
                  value={currentColors.accent_primary}
                  onChange={(val) => updateThemeColor('accent_primary', val)}
                />
                <ColorPickerField
                  label="Accent Secondaire"
                  description="Badges secondaires, dégradés et détails"
                  value={currentColors.accent_secondary}
                  onChange={(val) => updateThemeColor('accent_secondary', val)}
                />
              </div>
            </div>

            {/* Arrière-plans */}
            <div className="space-y-2 pt-2">
              <h4
                style={{ color: 'var(--text-muted)' }}
                className="text-[11px] font-black uppercase tracking-wider"
              >
                Arrière-plans & Surfaces
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <ColorPickerField
                  label="Fond Principal"
                  description="Arrière-plan global"
                  value={currentColors.bg_primary}
                  onChange={(val) => updateThemeColor('bg_primary', val)}
                />
                <ColorPickerField
                  label="Fond Secondaire"
                  description="Bandes et conteneurs"
                  value={currentColors.bg_secondary}
                  onChange={(val) => updateThemeColor('bg_secondary', val)}
                />
                <ColorPickerField
                  label="Cartes de Jeux"
                  description="Surface des tuiles"
                  value={currentColors.bg_card}
                  onChange={(val) => updateThemeColor('bg_card', val)}
                />
                <ColorPickerField
                  label="Menu Latéral"
                  description="Arrière-plan navigation"
                  value={currentColors.sidebar_bg}
                  onChange={(val) => updateThemeColor('sidebar_bg', val)}
                />
              </div>
            </div>

            {/* Typographie & États */}
            <div className="space-y-2 pt-2">
              <h4
                style={{ color: 'var(--text-muted)' }}
                className="text-[11px] font-black uppercase tracking-wider"
              >
                Typographie, Bordures & Statuts
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <ColorPickerField
                  label="Texte Principal"
                  description="Titres et labels"
                  value={currentColors.text_primary}
                  onChange={(val) => updateThemeColor('text_primary', val)}
                />
                <ColorPickerField
                  label="Texte Secondaire"
                  description="Sous-titres et détails"
                  value={currentColors.text_secondary}
                  onChange={(val) => updateThemeColor('text_secondary', val)}
                />
                <ColorPickerField
                  label="Bordures"
                  description="Séparateurs et contours"
                  value={currentColors.border}
                  onChange={(val) => updateThemeColor('border', val)}
                />
                <ColorPickerField
                  label="Succès / En ligne"
                  description="Statuts de connexion"
                  value={currentColors.success}
                  onChange={(val) => updateThemeColor('success', val)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VUE 3 : STORE EN LIGNE (TÉLÉCHARGER DES THÈMES)           */}
      {/* ========================================================= */}
      {viewMode === 'store' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>
                Thèmes proposés par la communauté sur{' '}
                <a
                  href="https://github.com/KairoOS-Official/kairos-themes"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-purple-700 underline inline-flex items-center gap-0.5"
                >
                  GitHub <ExternalLink className="w-3 h-3" />
                </a>
              </span>
            </div>

            <button
              onClick={fetchCommunityThemes}
              disabled={loadingCommunity}
              className="p-1.5 rounded-lg hover:bg-white text-slate-500 hover:text-slate-800 transition-all"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingCommunity ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {communityError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
              {communityError}
            </div>
          )}

          {communityThemes.length === 0 && !loadingCommunity && (
            <div className="p-8 text-center rounded-2xl border border-dashed border-purple-100 bg-purple-50/20 space-y-2">
              <Palette className="w-8 h-8 text-purple-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">
                Aucun thème en ligne disponible actuellement.
              </p>
              <p className="text-[11px] text-slate-400">
                Vous pouvez créer vos propres thèmes via le bouton "Nouveau Thème" et les modifier à volonté !
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {communityThemes.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-purple-100 p-3.5 bg-white shadow-xs space-y-3"
              >
                <div className="h-28 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200/60">
                  {item.preview_url ? (
                    <img src={item.preview_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <Palette className="w-8 h-8 text-purple-400" />
                  )}
                </div>

                <div>
                  <h4 className="text-xs font-black text-slate-900">{item.name}</h4>
                  <p className="text-[10px] text-slate-400">
                    Par <span className="font-bold text-slate-600">{item.author}</span> • v{item.version}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{item.description}</p>
                </div>

                <div className="flex items-center justify-end pt-2 border-t border-purple-50">
                  {downloadSuccessId === item.id ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Installé !</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDownload(item)}
                      disabled={downloadingId === item.id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{downloadingId === item.id ? 'Téléchargement...' : 'Télécharger'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VUE 4 : THÈMES NON VÉRIFIÉS & INSTALLATION PAR URL GITHUB */}
      {/* ========================================================= */}
      {viewMode === 'unverified' && (
        <div className="space-y-6">
          {/* Bandeau d'avertissement de sécurité */}
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
            className="flex items-center gap-3 p-4 rounded-2xl border text-xs font-bold shadow-xs"
          >
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <span>Les thèmes non vérifiés n'ont pas été validés par l'équipe KaïroOS.</span>
          </div>

          {/* Section 1 : Installation par URL GitHub & Analyse */}
          <div
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
            className="p-5 rounded-3xl border space-y-4 shadow-xs"
          >
            <div>
              <h3 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider">
                Installer un thème par URL GitHub
              </h3>
              <p style={{ color: 'var(--text-muted)' }} className="text-[11px] mt-0.5">
                Collez l'adresse d'un dépôt GitHub ou d'un fichier direct <code className="font-mono">theme.json</code> pour l'analyser et l'appliquer.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  placeholder="https://github.com/auteur/mon-theme ou lien raw theme.json"
                  value={unverifiedUrl}
                  onChange={(e) => setUnverifiedUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAnalyzeThemeUrl();
                  }}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all placeholder:text-slate-500"
                />
                {unverifiedUrl && (
                  <button
                    type="button"
                    onClick={() => setUnverifiedUrl('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleAnalyzeThemeUrl}
                disabled={analyzingTheme || !unverifiedUrl.trim()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-500 transition-all disabled:opacity-50 cursor-pointer shrink-0 shadow-xs"
              >
                {analyzingTheme ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyse en cours...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Analyser le thème</span>
                  </>
                )}
              </button>
            </div>

            {analysisError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                {analysisError}
              </div>
            )}

            {/* Aperçu du thème analysé */}
            {analyzedTheme && (
              <div
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'rgba(239, 68, 68, 0.4)',
                }}
                className="p-5 rounded-2xl border-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
              >
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b"
                  style={{ borderColor: 'var(--border-color)' }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 style={{ color: 'var(--text-primary)' }} className="text-base font-black">
                        {analyzedTheme.name}
                      </h4>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-red-600 text-white shadow-2xs">
                        NON VÉRIFIÉ
                      </span>
                      <span style={{ color: 'var(--text-muted)' }} className="text-xs font-mono font-bold">
                        v{analyzedTheme.version}
                      </span>
                    </div>
                    <p style={{ color: 'var(--text-muted)' }} className="text-xs">
                      Par <span className="font-bold text-slate-300">{analyzedTheme.author}</span> • ID : <code className="font-mono">{analyzedTheme.id}</code>
                    </p>
                    {analyzedTheme.description && (
                      <p style={{ color: 'var(--text-secondary)' }} className="text-xs mt-1">
                        {analyzedTheme.description}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleApplyAnalyzedTheme(analyzedTheme)}
                    disabled={applyingThemeId === analyzedTheme.id}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-500 shadow-md hover:scale-102 active:scale-98 transition-all cursor-pointer shrink-0"
                  >
                    {applySuccessId === analyzedTheme.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Thème Appliqué !</span>
                      </>
                    ) : applyingThemeId === analyzedTheme.id ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Application...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Appliquer ce thème</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Aperçu des couleurs (palette swatches) */}
                <div className="space-y-2">
                  <span style={{ color: 'var(--text-muted)' }} className="text-[11px] font-bold uppercase tracking-wider block">
                    Aperçu des couleurs (Palette)
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {[
                      { label: 'Fond principal', hex: analyzedTheme.colors.bg_primary },
                      { label: 'Secondaire', hex: analyzedTheme.colors.bg_secondary },
                      { label: 'Cartes', hex: analyzedTheme.colors.bg_card },
                      { label: 'Barre latérale', hex: analyzedTheme.colors.sidebar_bg },
                      { label: 'Accent 1', hex: analyzedTheme.colors.accent_primary },
                      { label: 'Accent 2', hex: analyzedTheme.colors.accent_secondary },
                      { label: 'Bordure', hex: analyzedTheme.colors.border },
                    ].map((c, i) => (
                      <div
                        key={i}
                        style={{
                          backgroundColor: 'var(--bg-secondary)',
                          borderColor: 'var(--border-color)',
                        }}
                        className="p-2 rounded-xl border flex flex-col items-center gap-1.5 text-center"
                      >
                        <div
                          className="w-6 h-6 rounded-lg border border-black/20 shadow-xs"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span style={{ color: 'var(--text-primary)' }} className="text-[10px] font-bold truncate w-full">
                          {c.label}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }} className="text-[9px] font-mono">
                          {c.hex}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Aperçu du layout (sidebar_grid, etc.) */}
                <div className="space-y-2">
                  <span style={{ color: 'var(--text-muted)' }} className="text-[11px] font-bold uppercase tracking-wider block">
                    Aperçu du layout
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                      className="px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs"
                    >
                      <Layout className="w-3.5 h-3.5 text-red-400" />
                      <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">Type :</span>
                      <span style={{ color: 'var(--text-primary)' }} className="font-bold">
                        {analyzedTheme.layout_type || 'sidebar_grid'}
                      </span>
                    </div>

                    <div
                      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                      className="px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs"
                    >
                      <LayoutGrid className="w-3.5 h-3.5 text-amber-400" />
                      <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">Rayon cartes :</span>
                      <span style={{ color: 'var(--text-primary)' }} className="font-bold">
                        {analyzedTheme.layout?.card_radius || '16px'}
                      </span>
                    </div>

                    <div
                      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                      className="px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs"
                    >
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">Barre latérale :</span>
                      <span style={{ color: 'var(--text-primary)' }} className="font-bold">
                        {analyzedTheme.layout?.sidebar_width || '280px'}
                      </span>
                    </div>

                    <div
                      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                      className="px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      <span style={{ color: 'var(--text-muted)' }} className="text-[11px]">Lueur :</span>
                      <span style={{ color: 'var(--text-primary)' }} className="font-bold">
                        {analyzedTheme.layout?.card_glow || 'subtle'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2 : Catalogue GitHub des thèmes non vérifiés (/unverified) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 style={{ color: 'var(--text-primary)' }} className="text-xs font-black uppercase tracking-wider">
                  Catalogue Non Vérifié
                </h3>
                <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                  Thèmes du dépôt communautaire ouvert KaïroOS (/unverified).
                </p>
              </div>

              <button
                onClick={fetchUnverifiedThemes}
                disabled={loadingUnverified}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                title="Rafraîchir"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingUnverified ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingUnverified ? (
              <div className="p-12 text-center text-xs text-slate-400">
                <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2 text-red-500" />
                <span>Interrogation des thèmes non vérifiés...</span>
              </div>
            ) : unverifiedError ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium">
                {unverifiedError}
              </div>
            ) : unverifiedThemes.length === 0 ? (
              <div
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
                className="p-8 rounded-3xl border text-center space-y-2"
              >
                <AlertTriangle className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
                <div style={{ color: 'var(--text-primary)' }} className="text-sm font-bold">
                  Aucun thème non vérifié dans le catalogue distant
                </div>
                <p style={{ color: 'var(--text-muted)' }} className="text-xs">
                  Vous pouvez installer n'importe quel thème en collant l'URL de son dépôt GitHub ci-dessus.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {unverifiedThemes.map((item) => {
                  const isCurrentActive = activeTheme.id === item.id;
                  const itemColors = item.colors || currentColors;

                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        borderColor: isCurrentActive
                          ? 'var(--accent-primary)'
                          : 'rgba(239, 68, 68, 0.3)',
                      }}
                      className="p-4 rounded-3xl border-2 flex flex-col justify-between gap-3 transition-all shadow-xs hover:border-red-500/50"
                    >
                      {/* Visual preview */}
                      <div
                        style={{
                          backgroundColor: itemColors.bg_primary,
                          borderColor: itemColors.border,
                        }}
                        className="h-28 rounded-2xl border relative overflow-hidden shadow-inner flex items-center justify-center"
                      >
                        {item.preview_url ? (
                          <img
                            src={item.preview_url}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Palette className="w-8 h-8 text-red-400" />
                        )}
                        <div className="absolute top-2 left-2">
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-red-600 text-white shadow-md">
                            NON VÉRIFIÉ
                          </span>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 style={{ color: 'var(--text-primary)' }} className="text-xs font-black truncate">
                            {item.name}
                          </h4>
                          <span style={{ color: 'var(--text-muted)' }} className="text-[10px] font-mono">
                            v{item.version || '1.0'}
                          </span>
                        </div>
                        <p style={{ color: 'var(--text-muted)' }} className="text-[10px]">
                          Par <span className="font-bold text-slate-300">{item.author || 'Inconnu'}</span>
                        </p>
                        {item.description && (
                          <p style={{ color: 'var(--text-secondary)' }} className="text-[11px] line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Action */}
                      <div className="flex items-center justify-end pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                        {isCurrentActive ? (
                          <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-500 text-[10px] font-black border border-emerald-500/20">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>ACTIF</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleApplyAnalyzedTheme(item)}
                            disabled={applyingThemeId === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 shadow-xs hover:scale-102 active:scale-98 transition-all cursor-pointer"
                          >
                            {applySuccessId === item.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Appliqué !</span>
                              </>
                            ) : applyingThemeId === item.id ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Application...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Appliquer ce thème</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1 : CRÉATION D'UN NOUVEAU THÈME                     */}
      {/* ========================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="w-full max-w-md rounded-3xl border shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-500">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    style={{ color: 'var(--text-primary)' }}
                    className="text-sm font-black"
                  >
                    Créer un Nouveau Thème
                  </h3>
                  <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                    Le thème sera créé dans le dossier themes/ (compatible portable)
                  </p>
                </div>
              </div>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateNewThemeSubmit} className="space-y-3.5">
              <div>
                <label
                  style={{ color: 'var(--text-secondary)' }}
                  className="block text-xs font-bold mb-1"
                >
                  Nom d'affichage du thème
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Mon Thème Rétro"
                  value={newThemeName}
                  onChange={(e) => {
                    setNewThemeName(e.target.value);
                    if (!newThemeId) {
                      setNewThemeId(
                        e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-')
                      );
                    }
                  }}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  className="w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label
                  style={{ color: 'var(--text-secondary)' }}
                  className="block text-xs font-bold mb-1"
                >
                  Identifiant dossier (ID unique)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: mon-theme-retro"
                  value={newThemeId}
                  onChange={(e) => setNewThemeId(e.target.value)}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-black/5 dark:bg-white/5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createWithCode}
                    onChange={(e) => setCreateWithCode(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <div className="text-xs font-black" style={{ color: 'var(--text-primary)' }}>
                      Thème avec Code Complet (HTML, CSS, JavaScript / Vite)
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Génère les fichiers index.html, style.css, app.js prêts à coder et connectés à l'API Kaïro.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold hover:opacity-80 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-black hover:opacity-90 transition-all shadow-xs"
                >
                  Créer et Personnaliser
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2 : ÉDITION DU CODE JSON BRUT                      */}
      {/* ========================================================= */}
      {jsonModalTheme && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="w-full max-w-2xl rounded-3xl border shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-600">
                  <Code className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    style={{ color: 'var(--text-primary)' }}
                    className="text-sm font-black"
                  >
                    Éditeur de Code JSON : {jsonModalTheme.name}
                  </h3>
                  <p style={{ color: 'var(--text-muted)' }} className="text-[11px]">
                    Modifiez directement le fichier theme.json de ce thème
                  </p>
                </div>
              </div>
            </div>

            {jsonError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                ⚠️ {jsonError}
              </div>
            )}

            {jsonSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-bold flex items-center gap-1.5">
                <Check className="w-4 h-4" />
                <span>Code JSON enregistré et appliqué avec succès !</span>
              </div>
            )}

            <div className="flex-1 min-h-[300px] flex flex-col">
              <textarea
                value={jsonCodeContent}
                onChange={(e) => setJsonCodeContent(e.target.value)}
                className="w-full flex-1 p-3.5 rounded-2xl bg-slate-950 text-emerald-400 font-mono text-xs border border-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-400 select-text resize-none"
                spellCheck={false}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(jsonCodeContent);
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copier le Code</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setJsonModalTheme(null)}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold hover:opacity-80 transition-all"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={handleSaveJsonCode}
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-black hover:opacity-90 transition-all shadow-xs"
                >
                  Enregistrer le Code
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ========================================================= */}
      {/* MODAL 3 : APERÇU VISUEL EN GRAND DU THÈME                 */}
      {/* ========================================================= */}
      {themeToPreview && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6 select-none animate-in fade-in duration-200">
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-color)',
            }}
            className="w-full max-w-4xl rounded-3xl border-2 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header de l'aperçu */}
            <div
              style={{
                backgroundColor: 'var(--sidebar-bg)',
                borderColor: 'var(--border-color)',
              }}
              className="p-4 border-b flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div
                  style={{ backgroundColor: 'var(--accent-primary)' }}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
                >
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3
                      style={{ color: 'var(--text-primary)' }}
                      className="text-base font-black tracking-tight"
                    >
                      {themeToPreview.name}
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-black/10 dark:bg-white/10" style={{ color: 'var(--text-muted)' }}>
                      v{themeToPreview.version || '1.0'}
                    </span>
                    {themeToPreview.theme_type === 'custom-code' || themeToPreview.entry_path ? (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-500 text-white">
                        CODE COMPLET HTML/JS
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-purple-600 text-white">
                        THÈME INTÉGRÉ
                      </span>
                    )}
                  </div>
                  <p style={{ color: 'var(--text-muted)' }} className="text-xs truncate max-w-lg">
                    {themeToPreview.description || 'Aperçu du thème KaïroOS'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setThemeToPreview(null)}
                className="w-8 h-8 rounded-xl border border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Corps de l'aperçu (Image HD ou Iframe de rendu) */}
            <div className="flex-1 bg-black/60 p-4 flex items-center justify-center overflow-hidden">
              <div className="w-full aspect-video rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative bg-slate-950 flex items-center justify-center">
                {themeToPreview.preview_url ? (
                  <img
                    src={themeToPreview.preview_url.startsWith('http') ? themeToPreview.preview_url : convertFileSrc(themeToPreview.preview_url)}
                    alt={`Aperçu ${themeToPreview.name}`}
                    className="w-full h-full object-contain"
                  />
                ) : themeToPreview.entry_path ? (
                  <iframe
                    src={convertFileSrc(themeToPreview.entry_path)}
                    title={themeToPreview.name}
                    className="w-full h-full border-0 pointer-events-none"
                    sandbox="allow-scripts allow-same-origin"
                  />
                ) : (
                  <div className="text-center p-8 text-slate-400">
                    <div className="text-4xl mb-2">🎨</div>
                    <div className="text-sm font-bold text-slate-200">{themeToPreview.name}</div>
                    <div className="text-xs text-slate-500 mt-1">Aucune capture d'écran preview n'a encore été enregistrée.</div>
                  </div>
                )}
              </div>
            </div>

            {/* Pied d'action de l'aperçu */}
            <div
              style={{
                backgroundColor: 'var(--sidebar-bg)',
                borderColor: 'var(--border-color)',
              }}
              className="p-4 border-t flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openThemesFolder()}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-secondary)',
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold hover:scale-102 transition-all cursor-pointer"
                  title="Ouvrir le dossier du thème dans l'explorateur Windows"
                >
                  <FolderOpen className="w-4 h-4 text-amber-500" />
                  <span>Dossier du Thème</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setThemeToPreview(null)}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold hover:opacity-80 transition-all cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  onClick={async () => {
                    await handleApplyTheme(themeToPreview.id);
                    setThemeToPreview(null);
                  }}
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                  }}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black shadow-md hover:scale-102 active:scale-98 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Appliquer ce Thème</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
