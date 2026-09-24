import { invokeCommand } from './client';
import { Theme, AppSettings } from '../types';

export async function getThemes(): Promise<Theme[]> {
  return invokeCommand<Theme[]>('get_themes');
}

export async function getTheme(id: string): Promise<Theme> {
  return invokeCommand<Theme>('get_theme', { id });
}

export async function setTheme(id: string): Promise<Theme> {
  return invokeCommand<Theme>('set_theme', { id });
}

export async function saveTheme(theme: Theme): Promise<Theme> {
  return invokeCommand<Theme>('save_theme', { theme });
}

export async function createTheme(id: string, name: string, withCode?: boolean): Promise<Theme> {
  return invokeCommand<Theme>('create_theme', { id, name, with_code: withCode });
}

export async function deleteTheme(id: string): Promise<void> {
  return invokeCommand<void>('delete_theme', { id });
}

export async function openThemesFolder(): Promise<void> {
  return invokeCommand<void>('open_themes_folder');
}

export async function openLogsFolder(): Promise<void> {
  return invokeCommand<void>('open_logs_folder');
}

export async function exportConfig(destZipPath: string): Promise<void> {
  return invokeCommand<void>('export_config', { destZipPath });
}

export async function importConfig(srcZipPath: string): Promise<void> {
  return invokeCommand<void>('import_config', { srcZipPath });
}

export async function resetSettings(): Promise<AppSettings> {
  return invokeCommand<AppSettings>('reset_settings');
}

export async function downloadCommunityTheme(themeId: string, zipUrl: string): Promise<Theme> {
  return invokeCommand<Theme>('download_community_theme', { themeId, zipUrl });
}