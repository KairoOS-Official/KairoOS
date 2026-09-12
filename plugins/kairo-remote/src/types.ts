export type ThemeMode = 'dark' | 'light';

export interface StatusResponse {
  is_running: boolean;
  current_game_id?: string;
  current_game_title?: string;
  current_system_id?: string;
  current_game_cover?: string;
  elapsed_seconds?: number;
  kiosk_mode: boolean;
  port: number;
  local_ip: string;
  version: string;
}

export interface SystemInfoResponse {
  local_ip: string;
  port: number;
  version: string;
  install_dir: string;
  kiosk_mode: boolean;
  total_games: number;
}

export interface Game {
  id: string;
  system_id: string;
  title: string;
  original_title?: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_hash?: string;
  franchise?: string;
  cover_url?: string;
  backdrop_url?: string;
  logo_url?: string;
  release_date?: string;
  publisher?: string;
  developer?: string;
  genre?: string;
  players?: number;
  rating?: number;
  synopsis?: string;
  favorite: boolean;
  hidden: boolean;
  play_count: number;
  play_time_seconds: number;
  last_played?: string;
  created_at: string;
  updated_at: string;
}

export interface System {
  id: string;
  name: string;
  short_name: string;
  manufacturer: string;
  generation?: number;
  release_year?: number;
  extensions: string[];
  icon: string;
  default_emulator_id: string;
  default_core?: string;
  folder_names: string[];
}

export interface Emulator {
  id: string;
  name: string;
  exe_path?: string;
  default_args: string;
  is_builtin: boolean;
  website_url?: string;
}

export interface RemoteConfig {
  enabled: boolean;
  port: number;
  pin: string;
  allowed_origins: string[];
}

export interface GamepadMapping {
  player_index: number;
  device_name: string;
  device_id: string;
  controller_type: string;
  btn_up?: string;
  btn_down?: string;
  btn_left?: string;
  btn_right?: string;
  btn_a?: string;
  btn_b?: string;
  btn_x?: string;
  btn_y?: string;
  btn_l1?: string;
  btn_r1?: string;
  btn_l2?: string;
  btn_r2?: string;
  btn_select?: string;
  btn_start?: string;
}

export interface AppSettings {
  fullscreen: boolean;
  always_on_top: boolean;
  kiosk_mode: boolean;
  auto_kiosk?: boolean;
  game_select_action?: string;
  arcade_ui_scale?: string;
  enabled_franchises: string[];
  custom_franchises: any[];
  roms_path?: string;
  theme: string;
  enabled_systems?: string[];
  enabled_modes?: string[];
  default_sort?: string;
  retroarch_shader?: string;
  aspect_ratio?: string;
  brightness?: number;
  contrast?: number;
  metadata_language?: string;
  launch_resolution?: string;
  forced_fullscreen?: string;
  autosave_enabled?: boolean;
  rewind_enabled?: boolean;
  cheats_dir?: string;
  saves_dir?: string;
  screenshots_dir?: string;
  scraping_delay_seconds?: number;
  screenscraper_ssid?: string;
  screenscraper_sspassword?: string;
  hide_mouse_cursor?: boolean;
  ui_resolution?: string;
  ui_language?: string;
  cores_dir?: string;
  startup_sound_enabled?: boolean;
  auto_scan_on_startup?: boolean;
  default_view?: string;
  show_games_without_cover?: boolean;
  recent_games_limit?: number;
  extra_cli_args?: string;
  debug_logs?: boolean;
  button_prompt_style?: string;
}

export interface Theme {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  is_active: boolean;
  is_builtin?: boolean;
  colors?: {
    bg_primary?: string;
    bg_secondary?: string;
    bg_card?: string;
    accent_primary?: string;
    text_primary?: string;
    text_muted?: string;
    border_color?: string;
  };
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  plugin_type: string;
  description: string;
  enabled: boolean;
  running: boolean;
  permissions: string[];
  commands: string[];
  ui?: string;
  has_settings: boolean;
  settings_section?: {
    label?: string;
    icon?: string;
    order?: number;
  };
  host?: any;
  contributes?: any;
  path: string;
}

export interface PluginContributionPayload {
  from: string;
  to: string;
  integration_point: string;
  data: any;
}

export interface ContributedNavItem {
  id: string;
  from: string;
  label: string;
  icon?: string;
  badge?: string;
  url: string;
}
