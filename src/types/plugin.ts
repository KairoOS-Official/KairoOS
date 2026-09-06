export type PluginType = 'builtin' | 'official' | 'community';

export interface PluginSettingField {
  type: 'string' | 'number' | 'boolean';
  label: string;
  default: any;
  secret?: boolean;
}

export interface PluginSettingsSection {
  label?: string;
  icon?: string;
  order?: number;
}

export interface PluginHostConfig {
  protocol: string;
  discovers: string[];
}

export interface PluginContributesConfig {
  to: string[];
  points: Record<string, any>;
}

export interface PluginContributionPayload {
  from: string;
  to: string;
  integration_point: string;
  data: any;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  type: PluginType;
  description: string;
  min_kairo_version?: string;
  permissions: string[];
  entry?: string;
  ui?: string;
  builtin_service?: string;
  host?: PluginHostConfig;
  contributes?: PluginContributesConfig;
  commands: string[];
  settings_section?: PluginSettingsSection;
  settings_schema: Record<string, PluginSettingField>;
  sandbox?: boolean;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  plugin_type: PluginType;
  description: string;
  enabled: boolean;
  running: boolean;
  permissions: string[];
  commands: string[];
  ui?: string;
  builtin_service?: string;
  host?: PluginHostConfig;
  contributes?: PluginContributesConfig;
  has_settings: boolean;
  settings_section?: PluginSettingsSection;
  path: string;
}

export interface PluginDetail {
  manifest: PluginManifest;
  enabled: boolean;
  running: boolean;
  settings: Record<string, any>;
  path: string;
}
