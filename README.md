# Block-Kompass

Lokale Webseite mit Minecraft-Bauten (Java Edition 26.2). Jeder Bau hat eine 3D-Schritt-für-Schritt-Anleitung im Browser (Block für Block, auch zum Herumlaufen), eine Materialliste mit den deutschen Blocknamen und einen Ebenen-Plan. Dazu kommt „Selber erstellen“: Katalogsuche, Formen-Generator und Upload von Schematics oder 3D-Modellen.

Nur für den Eigengebrauch, läuft nur lokal (127.0.0.1). Noch in Arbeit (Runde 2 von 3).

## Voraussetzungen
- Node.js 24 (keine npm-Pakete nötig)
- Minecraft Java 26.2 installiert: Texturen, Modelle und Namen werden daraus nur gelesen, das Spiel wird nie gestartet
- Chrome oder Edge für Browser-Tests und Screenshots

## Starten
```powershell
node scripts/extract-game-data.mjs   # einmalig: Spieldaten nach game-data/ (nicht im Repo)
node scripts/serve.mjs               # danach http://127.0.0.1:8080 öffnen
```

## Testen
```powershell
node --test "tests/unit/**/*.test.mjs"
node scripts/check-build.mjs <modulpfad>
```

## Ordner
- `js/core/`: Block-Volumen, Builder-API, Schritte, Materialien
- `js/render/`: 3D-Ansicht (WebGL2) mit Worker
- `js/ui/`: Seiten-Logik
- `scripts/`: Extraktion, Server, Prüf- und Screenshot-Werkzeuge
- `docs/ARCHITEKTUR.md`: verbindliche Spezifikation; `docs/recherche/`: Quellen zu Wahrzeichen
- `tests/`: Unit-, Browser- und Sichttests
- `assets/fonts/`: lokale Schriften (SIL OFL, Quellen in `QUELLEN.md`)
