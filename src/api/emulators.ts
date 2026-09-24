import { invokeCommand } from './client';
import { Emulator, EmulatorCatalogItem } from '../types';

export async function getEmulators(): Promise<Emulator[]> {
  return invokeCommand<Emulator[]>('get_emulators');
}

export async function updateEmulatorPath(id: string, exePath: string | null): Promise<void> {
  return invokeCommand<void>('update_emulator_path', { id, exePath });
}

export async function getEmulatorCatalog(): Promise<EmulatorCatalogItem[]> {
  return invokeCommand<EmulatorCatalogItem[]>('get_emulator_catalog');
}

export async function downloadEmulator(id: string): Promise<EmulatorCatalogItem> {
  return invokeCommand<EmulatorCatalogItem>('download_emulator', { id });
}

export async function scanAndAutoDetectEmulators(): Promise<EmulatorCatalogItem[]> {
  return invokeCommand<EmulatorCatalogItem[]>('scan_and_auto_detect_emulators');
}

export async function openEmulatorsFolder(): Promise<void> {
  return invokeCommand<void>('open_emulators_folder');
}

export async function testEmulatorExe(path: string): Promise<boolean> {
  return invokeCommand<boolean>('test_emulator_exe', { path });
}

