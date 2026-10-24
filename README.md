# Block-Kompass

Lokale Webseite mit Minecraft-Bauten (Java Edition 26.2). Jeder Bau hat eine 3D-Schritt-für-Schritt-Anleitung im Browser (Block für Block, auch zum Herumlaufen wie im Spiel), eine Materialliste mit den deutschen Blocknamen zum Abhaken und einen Ebenen-Plan. Dazu kommt „Selber erstellen“: Katalogsuche per Freitext, Formen-Generator (Kugel, Turm, Bogen …) und Upload von Bauplänen (`.schem`, `.litematic`, `.nbt`) oder 3D-Modellen (`.vox`, `.stl`, `.obj`, `.glb`, `.gltf`).

Nur für den Eigengebrauch: Die Seite läuft ausschließlich lokal auf `127.0.0.1` und wird nicht veröffentlicht. Texturen, Modelle und Namen stammen aus deiner Minecraft-Installation und bleiben auf deinem Rechner (`game-data/`, `thumbs/` sind nicht im Repo).

## Voraussetzungen
- **Node.js 24** (nur Bordmittel, keine npm-Pakete)
- **Minecraft Java 26.2 installiert** (Launcher oder CurseForge): Texturen, Modelle, deutsche Namen und Original-Strukturen werden daraus nur **gelesen**. Das Spiel, ein Server oder ein Jar werden nie gestartet, in `.minecraft` wird nichts geschrieben. Ohne Installation geht es mit `--remote` (siehe „In der Cloud“).
- **Chrome oder Edge** für Vorschaubilder, Klick-Test und Screenshots (headless, mit Grafikkarte oder Software-WebGL)

## Starten
```powershell
node scripts/start.mjs
```
Das Skript prüft die Spieldaten (fehlen sie, erzeugt es sie aus der Installation), prüft, ob der Katalog zu den Bau-Modulen passt (sonst baut es ihn samt Vorschaubildern neu), und startet den Server. Danach die angezeigte Adresse öffnen, normalerweise http://127.0.0.1:8080 (ist der Port belegt, nimmt es den nächsten freien).

Optionen: `--port <zahl>`, `--remote` (Spieldaten ohne Installation laden), `--no-thumbs` (Katalog ohne Vorschaubilder, braucht kein Chrome).

Einzelschritte, falls nötig:
```powershell
node scripts/extract-game-data.mjs      # Spieldaten nach game-data/ (≈ 2 s)
node scripts/build-catalog.mjs --thumbs # Katalog game-data/catalog.json + Vorschaubilder in thumbs/
node scripts/serve.mjs                  # nur der Server
```

## Seiten
- `index.html`: Start mit Suche, Kategorien und Empfehlungen
- `kategorie.html?k=<kategorie>`: Liste mit Filtern (Größe, Schwierigkeit, Herkunft, im Spiel getestet) und Sortierung
- `bau.html?id=<bau>[&scale=<maßstab>]`: 3D-Ansicht, Schritt-Player, Anleitung, Material, Ebenen-Plan, Infos und Quellen; der Fortschritt bleibt im Browser gespeichert
- `erstellen.html`: Freitext („Tokyo Skytree 1:1“, „hohle Kugel Radius 12 aus Glas“), Formen-Generator und Datei-Import

## Ordner
- `index.html`, `kategorie.html`, `bau.html`, `erstellen.html`: die vier Seiten
- `css/`: Design-System (`style.css`) und Seiten-Stile
- `assets/`: Logo, Icons, Muster (aus `assets/pixel-art/` erzeugt) und lokale Schriften (SIL OFL, Quellen in `assets/fonts/QUELLEN.md`)
- `js/core/`: Kern für Browser und Node: Block-Volumen, Builder-API, Auto-Verbindungen, Schritte, Materialien, Texte
- `js/render/`: eigene 3D-Ansicht (WebGL2) mit Worker, Texturen aus dem Spiel, Lauf-Modus
- `js/ui/`: Seitenlogik (`browse/` Start und Kategorien, `build/` Bau-Seite, `create/` „Selber erstellen“)
- `js/create/`: Freitext-Suche, Formen-Generatoren, Datei-Import (`import/`) und Modell-Umwandlung (`voxelize/`)
- `js/builds/<kategorie>/`: die Bau-Module; `js/builds/lib/`: Hilfsbibliothek (Fenster, Türen, Dächer, Möbel, Licht, Bäume, Gelände); `js/builds/game-structures.js`: Auswahl der Original-Strukturen aus dem Spiel
- `scripts/`: Start, Server, Spieldaten-Extraktion, Katalog, Vorschaubilder, Prüf- und Screenshot-Werkzeuge
- `tests/`: Unit-Tests (`unit/`), Klick-Test (`e2e.mjs`), Testseiten und Sichtprüfungen (`visual/`), Testdaten (`fixtures/`), Chrome-Steuerung (`browser.mjs`)
- `docs/ARCHITEKTUR.md`: verbindliche Spezifikation mit allen Schnittstellen; `docs/recherche/`: Maße und Quellen der echten Bauwerke
- Erzeugt und nicht im Repo: `game-data/` (Spieldaten, Katalog), `thumbs/` (Vorschaubilder), `tmp/` (Screenshots, Testreste)

## Testen
```powershell
node --test "tests/unit/**/*.test.mjs"   # Unit-Tests
node tests/e2e.mjs                       # Klick-Test im echten Chrome gegen den echten Katalog (Desktop und Handy)
node scripts/check-imports.mjs           # alle lokalen Verweise mit exakter Groß-/Kleinschreibung (wichtig unter Linux)
node scripts/check-build.mjs <modulpfad> [--scale <zahl>] [--json]   # einen Bau prüfen
node scripts/shot.mjs --module <modulpfad>                           # Screenshots der 3D-Ansicht
```
- Der Klick-Test geht Start → Kategorie (Filter, Sortierung, Zurück) → Bau-Seiten (Tokyo Skytree 1:1, Infinity Castle, ein Dorfhaus, ein Redstone-Bau) → „Selber erstellen“ (Freitext, Upload je Dateiformat) → Handy-Ansicht durch, misst Ladezeiten und Bildrate und legt Screenshots nach `tmp/integration/e2e/`. Optionen: `--only start,bau,erstellen,handy`, `--gpu swiftshader`, `--out <ordner>`.
- Ausführlichere Sichtprüfungen einzelner Seiten: `node tests/visual/build-page-check.mjs`, `node tests/visual/create-page-check.mjs`.

## In der Cloud
Für Claude Code im Web (Linux-Container mit Klon des Repos, ohne Minecraft). `game-data/` ist nicht im Repo und entsteht dort aus öffentlichen Quellen: Archive von [misode/mcmeta](https://github.com/misode/mcmeta) (unveränderte Dateien der 26.2-Jar) und die deutsche Sprachdatei von Mojang. Das Ergebnis ist Byte für Byte gleich wie mit dem Jar; nur `meta.json` nennt zusätzlich Zeit und Quellen.
```bash
node scripts/extract-game-data.mjs --remote   # ≈ 13 MB Download, Cache in game-data/.cache/
node scripts/check-imports.mjs                # unter Linux zählt die Groß-/Kleinschreibung
node --test "tests/unit/**/*.test.mjs"
node scripts/build-catalog.mjs                # Katalog (mit --thumbs auch Vorschaubilder, braucht Chrome)
node scripts/serve.mjs                        # http://127.0.0.1:8080
```
Alles in einem Schritt: `node scripts/start.mjs --remote` (ohne Chrome zusätzlich `--no-thumbs`).

Netzwerkzugriff der Cloud-Umgebung: diese Domains erlauben.

| Domain | wofür |
|---|---|
| `codeload.github.com` | ZIP-Archive von misode/mcmeta: Blockstates, Modelle, Texturen, englische Namen, Strukturen (nötig) |
| `raw.githubusercontent.com` | Blockbericht mit Eigenschaften und Standardwerten (nötig), Rückfall für `de_de.json` |
| `piston-meta.mojang.com` | Mojang-Versionsliste und Asset-Index (Prüfsumme der deutschen Sprachdatei) |
| `resources.download.minecraft.net` | `de_de.json` von Mojang |

- Ist eine Domain gesperrt, nennt das Skript sie und bricht ab. Nur für `de_de.json` gibt es einen Rückfall über GitHub (Stand der Veröffentlichung, Warnung in `meta.json`).
- `--offline` nimmt alles aus dem Cache, `--out <ordner>` schreibt woanders hin.
- Ein gesetzter `HTTPS_PROXY` wird genutzt: Das Skript startet sich dafür mit `node --use-env-proxy` neu (Node 24.5 oder neuer).
- Browser-Tests und Screenshots suchen Chrome/Chromium unter `/usr/bin/google-chrome`, `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/opt/google/chrome/chrome` und im Playwright-Cache (`~/.cache/ms-playwright`, `PLAYWRIGHT_BROWSERS_PATH`), sonst `CHROME_PATH` setzen. Als root läuft Chrome mit `--no-sandbox`. Ohne Grafikkarte: `node scripts/shot.mjs … --gpu swiftshader`.
