# Crée un plugin et le copie dans plugins/ + kairos-plugins/official/
# Usage: .\scripts\new-plugin.ps1 <plugin-id> [official|community]

param(
    [Parameter(Mandatory=$true)]
    [string]$PluginId,
    [string]$Category = "official"
)

$KairoRoot = "C:\Users\propo\Music\Kairo"
$StoreRoot = "C:\Users\propo\Music\kairos-plugins"

$TargetPlugin = "$KairoRoot\plugins\$PluginId"
$TargetStore = "$StoreRoot\$Category\$PluginId"

if (Test-Path $TargetPlugin) {
    Write-Host "ERREUR: $TargetPlugin existe deja." -ForegroundColor Red
    exit 1
}

if (Test-Path $TargetStore) {
    Write-Host "ERREUR: $TargetStore existe deja." -ForegroundColor Red
    exit 1
}

# Creer la structure dans plugins/
New-Item -ItemType Directory -Path "$TargetPlugin\src" -Force | Out-Null

# plugin.json
@"
{
  "id": "$PluginId",
  "name": "$PluginId",
  "version": "1.0.0",
  "author": "Nayrolf",
  "type": "official",
  "description": "Plugin KaïroOS",
  "permissions": [],
  "entry": "index.js",
  "commands": ["start", "stop"],
  "settings_schema": {}
}
"@ | Set-Content "$TargetPlugin\plugin.json" -Encoding UTF8

# index.js
@" 
import { createPlugin } from 'kairo-plugin-host';

export default createPlugin({
  id: '$PluginId',
  name: '$PluginId',

  async onLoad(ctx) {
    console.log('[$PluginId] Loaded');
  },

  async onUnload() {
    console.log('[$PluginId] Unloaded');
  }
});
"@ | Set-Content "$TargetPlugin\index.js" -Encoding UTF8

# Copier dans kairos-plugins/
Copy-Item -Path $TargetPlugin -Destination $TargetStore -Recurse

Write-Host "Plugin cree :" -ForegroundColor Green
Write-Host "  Local  : plugins/$PluginId" -ForegroundColor Cyan
Write-Host "  Store  : kairos-plugins/$Category/$PluginId" -ForegroundColor Cyan
