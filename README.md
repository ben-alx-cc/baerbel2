# Taube über Wasser – Web Experience

Kleine interaktive 3D-ähnliche Szene (Top-Down), optimiert für GitHub Pages und iOS Safari.

## Entwicklung
- `index.html` lokal mit einem statischen Server öffnen (z. B. `python3 -m http.server`).
- Keine Build-Tools nötig – Three.js wird via ESM CDN geladen.

## Deployment auf GitHub Pages
1. Repository erstellen und diese Dateien in den Root-Ordner legen.
2. Settings → Pages → Branch `main` (Root) auswählen.
3. URL: `https://<USER>.github.io/<REPO>/`.

## Interaktion
- Touch/Pointer-Down auf beliebiger Stelle: Flügelschlag + Beschleunigung.
- Ohne Interaktion: gleichmäßiger Gleitflug.

## Tech
- Three.js (ES Modules via `unpkg`)
- Wasser-Shader (kleine Wellen + Flow)
- Vereinfachtes Taubenmodell (Körper, Kopf, Flügel, Schwanz) + Federlinien

## Lizenz
MIT
