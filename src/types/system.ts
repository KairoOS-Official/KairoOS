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

export interface EmulatorCatalogItem {
  id: string;
  name: string;
  systems: string[];
  description: string;
  default_exe: string;
  default_args: string;
  download_url?: string;
  is_installed: boolean;
  installed_path?: string;
  website_url: string;
  notes?: string;
}

export interface EmulatorDownloadProgress {
  id: string;
  percent: number;
  status: string;
  error?: string;
}

export interface FranchiseCollection {
  id: string;
  name: string;
  icon?: string;
  color: string;
  keywords: string[];
}

export interface CustomFranchise {
  id: string;
  name: string;
  color: string;
  keywords: string[];
  is_enabled: boolean;
}
