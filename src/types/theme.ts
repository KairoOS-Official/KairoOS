export interface ThemeColors {
  bg_primary: string;
  bg_secondary: string;
  bg_card: string;
  sidebar_bg: string;
  accent_primary: string;
  accent_secondary: string;
  text_primary: string;
  text_secondary: string;
  text_muted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
}

export interface ThemeFonts {
  primary: string;
  arcade: string;
  size_base: string;
}

export type ThemeLayoutType = 'sidebar_grid' | 'single_page_categories' | 'console_launcher' | 'hero_carousel';

export interface ThemeLayout {
  card_radius: string;
  sidebar_width: string;
  card_gap: string;
  card_aspect?: 'poster' | 'square' | 'landscape';
  card_glow?: 'none' | 'subtle' | 'neon';
  scanlines?: 'none' | 'light' | 'retro' | 'intense';
  card_shadow?: 'flat' | 'soft' | 'arcade' | 'glow';
  card_scale?: 'none' | 'subtle' | 'dynamic';
  show_sidebar?: boolean;
  show_consoles_row?: boolean;
  show_modes_row?: boolean;
  show_genres_row?: boolean;
  show_favorites_row?: boolean;
  show_all_games_row?: boolean;
  // Options spécifiques au Console Launcher (Hero + Carrousel)
  hero_height?: string;
  carousel_position?: 'bottom' | 'middle';
  cards_visible?: number;
  show_controller_guide?: boolean;
  hero_backdrop_blur?: string;
  hero_gradient_opacity?: number;
}

export interface ThemeAssets {
  background_image?: string | null;
  logo_override?: string | null;
  startup_sound?: string | null;
}

export interface Theme {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  layout_type?: ThemeLayoutType;
  custom_css?: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  layout: ThemeLayout;
  assets: ThemeAssets;
  preview_url?: string;
  is_active?: boolean;
  theme_type?: 'built-in' | 'custom-code' | 'unverified';
  entry_path?: string;
}

export interface CommunityThemeItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url?: string;
  type: string;
}