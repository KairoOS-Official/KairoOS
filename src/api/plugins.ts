import { invokeCommand } from './client';
import { PluginInfo, PluginDetail, PluginManifest } from '../types';

export async function getPlugins(): Promise<PluginInfo[]> {
  return invokeCommand<PluginInfo[]>('get_plugins');
}

export async function getPlugin(id: string): Promise<PluginDetail> {
  return invokeCommand<PluginDetail>('get_plugin', { id });
}

export async function enablePlugin(id: string): Promise<void> {
  return invokeCommand<void>('enable_plugin', { id });
}

export async function disablePlugin(id: string): Promise<void> {
  return invokeCommand<void>('disable_plugin', { id });
}

export async function installPlugin(zipPath: string): Promise<PluginManifest> {
  return invokeCommand<PluginManifest>('install_plugin', { zipPath });
}

export async function installPluginFromUrl(url: string): Promise<PluginManifest> {
  return invokeCommand<PluginManifest>('install_plugin_from_url', { url });
}

export async function confirmInstallPlugin(pluginId: string): Promise<void> {
  return invokeCommand<void>('confirm_install_plugin', { pluginId });
}

export async function uninstallPlugin(id: string): Promise<void> {
  return invokeCommand<void>('uninstall_plugin', { id });
}

export async function updatePluginSettings(id: string, settings: Record<string, any>): Promise<void> {
  return invokeCommand<void>('update_plugin_settings', { id, settings });
}

export async function getPluginCommands(id: string): Promise<string[]> {
  return invokeCommand<string[]>('get_plugin_commands', { id });
}

export async function runPluginCommand(id: string, command: string): Promise<string> {
  return invokeCommand<string>('run_plugin_command', { id, command });
}

export async function openPluginsFolder(): Promise<void> {
  return invokeCommand<void>('open_plugins_folder');
}
