# Crée un thème et le copie dans themes/ + kairos-themes/official/
# Usage: .\scripts\new-theme.ps1 <theme-id> [official|community]

param(
    [Parameter(Mandatory=$true)]
    [string]$ThemeId,
    [string]$Category = "official"
)

$KairoRoot = "C:\Users\propo\Music\Kairo"
$StoreRoot = "C:\Users\propo\Music\kairos-themes"

$TargetTheme = "$KairoRoot\themes\$ThemeId"
$TargetStore = "$StoreRoot\$Category\$ThemeId"

if (Test-Path $TargetTheme) {
    Write-Host "ERREUR: $TargetTheme existe deja." -ForegroundColor Red
    exit 1
}

if (Test-Path $TargetStore) {
    Write-Host "ERREUR: $TargetStore existe deja." -ForegroundColor Red
    exit 1
}

# Creer la structure dans themes/
New-Item -ItemType Directory -Path $TargetTheme -Force | Out-Null

# theme.json
@"
{
  "id": "$ThemeId",
  "name": "$ThemeId",
  "version": "1.0.0",
  "author": "Nayrolf",
  "theme_type": "official",
  "description": "Theme KaïroOS",
  "colors": {
    "bg_primary": "#0b0f19",
    "bg_secondary": "#111827",
    "bg_card": "#1e293b",
    "sidebar_bg": "#0f172a",
    "accent_primary": "#f43f5e",
    "accent_secondary": "#38bdf8",
    "text_primary": "#f8fafc",
    "text_secondary": "#94a3b8",
    "text_muted": "#64748b",
    "border": "#334155",
    "success": "#10b981",
    "warning": "#f59e0b",
    "danger": "#ef4444"
  },
  "fonts": {
    "primary": "Outfit, system-ui, sans-serif",
    "arcade": "Press Start 2P",
    "size_base": "14px"
  },
  "layout": {
    "card_radius": "16px",
    "sidebar_width": "280px",
    "card_gap": "16px"
  }
}
"@ | Set-Content "$TargetTheme\theme.json" -Encoding UTF8

# Copier dans kairos-themes/
Copy-Item -Path $TargetTheme -Destination $TargetStore -Recurse

Write-Host "Theme cree :" -ForegroundColor Green
Write-Host "  Local  : themes/$ThemeId" -ForegroundColor Cyan
Write-Host "  Store  : kairos-themes/$Category/$ThemeId" -ForegroundColor Cyan
