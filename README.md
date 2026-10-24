# Block-Kompass

Lokale Webseite mit Minecraft-Bauten (Java Edition 26.2). Jeder Bau hat eine 3D-Schritt-für-Schritt-Anleitung im Browser (Block für Block, auch zum Herumlaufen), eine Materialliste mit den deutschen Blocknamen und einen Ebenen-Plan. Dazu kommt „Selber erstellen“: Katalogsuche, Formen-Generator und Upload von Schematics oder 3D-Modellen.

Nur für den Eigengebrauch, läuft nur lokal (127.0.0.1). Noch in Arbeit (Runde 2 von 3).

## Voraussetzungen
- Node.js 24 (keine npm-Pakete nötig)
- Minecraft Java 26.2 installiert: Texturen, Modelle und Namen werden daraus nur gelesen, das Spiel wird nie gestartet (ohne Installation: `--remote`, siehe „In der Cloud“)
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
node scripts/check-imports.mjs     # alle lokalen Verweise mit exakter Groß-/Kleinschreibung
```

## In der Cloud
Für Claude Code im Web (Linux-Container mit Klon des Repos, ohne Minecraft). `game-data/` ist nicht im Repo und entsteht dort aus öffentlichen Quellen: Archive von [misode/mcmeta](https://github.com/misode/mcmeta) (unveränderte Dateien der 26.2-Jar) und die deutsche Sprachdatei von Mojang. Das Ergebnis ist Byte für Byte gleich wie mit dem Jar; nur `meta.json` nennt zusätzlich Zeit und Quellen.
```bash
node scripts/extract-game-data.mjs --remote   # ≈ 13 MB Download, Cache in game-data/.cache/
node scripts/check-imports.mjs                # unter Linux zählt die Groß-/Kleinschreibung
node --test "tests/unit/**/*.test.mjs"
node scripts/serve.mjs                        # http://127.0.0.1:8080
```
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

## Ordner
- `js/core/`: Block-Volumen, Builder-API, Schritte, Materialien
- `js/render/`: 3D-Ansicht (WebGL2) mit Worker
- `js/ui/`: Seiten-Logik
- `scripts/`: Extraktion, Server, Prüf- und Screenshot-Werkzeuge
- `docs/ARCHITEKTUR.md`: verbindliche Spezifikation; `docs/recherche/`: Quellen zu Wahrzeichen
- `tests/`: Unit-, Browser- und Sichttests
- `assets/fonts/`: lokale Schriften (SIL OFL, Quellen in `QUELLEN.md`)
