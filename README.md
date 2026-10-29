# Block-Kompass

Webseite mit Minecraft-Bauten (Java Edition 26.2). Jeder Bau hat eine 3D-Schritt-für-Schritt-Anleitung im Browser (Block für Block, auch zum Herumlaufen wie im Spiel), eine Materialliste mit den deutschen Blocknamen zum Abhaken und einen Ebenen-Plan. Dazu kommt „Selber erstellen“: Katalogsuche per Freitext, Formen-Generator (Kugel, Turm, Bogen …) und Upload von Bauplänen (`.schem`, `.litematic`, `.nbt`) oder 3D-Modellen (`.vox`, `.stl`, `.obj`, `.glb`, `.gltf`). Unter „Meine Bauten“ bleiben eigene Bau-Dateien dauerhaft im Browser und bekommen dieselbe Anleitung wie die Bauten des Katalogs.

Für den Eigengebrauch. **Online als Webseite, auch auf dem Handy, ohne etwas zu installieren:** https://jason-z-tech.github.io/minecraft-block-kompass/ (GitHub Pages, Branch `main`, iOS ab 16.4, aktuelles Chrome/Android).

Texturen, Modelle und Namen stammen original aus Minecraft 26.2. Mojang-Dateien liegen nie im Repo oder auf der Seite (`game-data/`, `thumbs/` sind gitignored): Der Browser lädt sie beim ersten Besuch selbst aus [misode/mcmeta](https://github.com/misode/mcmeta) auf GitHub (feste Commits, ≈ 2 MB, gut 1 s), wandelt sie um und speichert sie im Browser (IndexedDB); danach geht es ohne Download. Im Repo liegen nur der Katalog der Bauten (`data/catalog.json`: Projekttexte, Größen, Zahlen und Block-IDs) und die Community-Bauten (`data/community/`, siehe unten). Online zeigen die Karten Kategorie-Icons statt Vorschaubildern.

## Voraussetzungen (nur zum Entwickeln)
- **Node.js 24** (nur Bordmittel, keine npm-Pakete)
- **Minecraft ist nicht nötig.** Ist Minecraft Java 26.2 installiert (Launcher oder CurseForge), werden Texturen, Modelle und deutsche Namen daraus nur **gelesen**: Das Spiel, ein Server oder ein Jar werden nie gestartet, in `.minecraft` wird nichts geschrieben. Ohne Installation lädt der Start die gleichen Dateien einmalig aus dem Internet (siehe „Ohne Minecraft“).
- **Chrome oder Edge** für Vorschaubilder, Klick-Test und Screenshots (headless, mit Grafikkarte oder Software-WebGL)

## Lokal starten (nur zum Entwickeln)
Die Webseite braucht kein Node. Lokal ist es nur zum Entwickeln und Testen nötig; mit vorhandenem `game-data/` nutzt die Seite auf 127.0.0.1/localhost diese Dateien (offline, schnell), sonst lädt sie wie online aus misode/mcmeta.
```powershell
node scripts/start.mjs
```
Das Skript prüft die Spieldaten (fehlen sie, liest es sie aus der Minecraft-Installation, ohne Installation lädt es sie aus dem Internet), prüft, ob der Katalog zu den Bau-Modulen passt (sonst baut es ihn samt Vorschaubildern neu), und startet den Server. Danach die angezeigte Adresse öffnen, normalerweise http://127.0.0.1:8080 (ist der Port belegt, nimmt es den nächsten freien).

Optionen: `--port <zahl>`, `--remote` (Spieldaten immer aus dem Internet, auch wenn Minecraft installiert ist), `--no-thumbs` (Katalog ohne Vorschaubilder, braucht kein Chrome).

## Ohne Minecraft
Einfach `node scripts/start.mjs` ausführen. Findet es keine Installation von Minecraft Java 26.2 (oder klappt das Lesen daraus nicht), lädt es die Spieldaten einmalig aus öffentlichen Quellen: Archive von [misode/mcmeta](https://github.com/misode/mcmeta) (unveränderte Dateien der 26.2-Jar) und die deutsche Sprachdatei von Mojang, zusammen ≈ 7 MB. Das Ergebnis ist Byte für Byte gleich wie mit dem Jar. Danach läuft alles ohne Internet, die Daten liegen in `game-data/`.

Auch `node scripts/extract-game-data.mjs` ohne Optionen wechselt automatisch auf die öffentlichen Quellen, wenn am Standardort keine Jar liegt. Die nötigen Domains stehen unten unter „In der Cloud“.

Einzelschritte, falls nötig:
```powershell
node scripts/extract-game-data.mjs      # Spieldaten nach game-data/ (≈ 2 s; ohne Minecraft automatisch aus dem Internet)
node scripts/build-catalog.mjs --thumbs # Katalog data/catalog.json (im Repo) + Vorschaubilder in thumbs/ (nur lokal)
node scripts/serve.mjs                  # nur der Server
```

## Katalog im Repo
`data/catalog.json` wird mit der Seite veröffentlicht. Er enthält einen Fingerabdruck der Bau-Module und Spieldaten (`inputs`); der Unit-Test `tests/unit/catalog-fresh.test.mjs` schlägt fehl, sobald er veraltet ist. Dann neu erzeugen (braucht `game-data/`) und mit committen:
```bash
node scripts/build-catalog.mjs
```
Vorschaubilder (`node scripts/build-catalog.mjs --thumbs`) gibt es nur lokal: Die Seite zeigt sie auf 127.0.0.1/localhost (Liste in `thumbs/index.json`), online zeigen die Karten das Kategorie-Icon.

## Seiten
- `index.html`: Start, bewusst klein: Titel, Suche (führt zu „Selber erstellen“), die 6 Kategorien als Kacheln mit Anzahl und Links zu „Selber erstellen“ und „Meine Bauten“
- `kategorie.html?k=<kategorie>`: Liste mit Filtern (Größe, Herkunft, im Spiel getestet) und Sortierung
- `bau.html?id=<bau>[&scale=<maßstab>]`: 3D-Ansicht, Schritt-Player, Anleitung (Kapitel mit Titel, Schritte mit Blockzahl und Ebene, ohne Anleitungstexte), Material, Ebenen-Plan, Infos und Quellen; der Fortschritt bleibt im Browser gespeichert
- `erstellen.html`: Freitext („Tokyo Skytree 1:1“, „hohle Kugel Radius 12 aus Glas“), Formen-Generator und Datei-Import; nach einem Upload „Zu Meine Bauten“
- `meine.html`: Meine Bauten – eigene Dateien hinzufügen (Auswahl oder Ziehen, auch `.zip`), suchen, nach Kategorie filtern, öffnen, umbenennen, Kategorie ändern, löschen
- `bau.html?meine=<id>`: ein eigener Bau, gebaut wie ein Upload (Schritte Ebene für Ebene, Material, Ebenen-Plan, Abhaken)

Die Kopfzeile aller Seiten: Start · Kategorien · Selber erstellen · Meine Bauten (ohne Suchfeld; gesucht wird auf der Startseite).

## Community-Bauten
- Fertige Bauten anderer Ersteller, nur mit offener Lizenz (CC0, CC BY, CC BY-SA, CC BY-NC, CC BY-NC-SA, MIT, Apache 2.0, Unlicense). Die Dateien (`.nbt`, `.schem`, `.litematic`) liegen unverändert unter `data/community/`, die Angaben (Titel, Kategorie, Ersteller, Link, Lizenz, Commit bzw. Modrinth-Version, Prüfsumme) in `data/community/builds.json`, je Quelle der Lizenztext unter `data/community/licenses/`.
- Der Katalog baut jede Datei wie einen Upload (Ebene für Ebene); die Bau-Seite öffnet sie wie die eigenen Bauten unter `bau.html?id=<bau>` und zeigt unter „Infos“ Ersteller, Link und Lizenz. Herkunft: „Original vom Ersteller“.
- Neue Bauten: Datei nach `data/community/<id>.<endung>`, Eintrag in `builds.json`, dann `node scripts/build-catalog.mjs`. Geprüft werden Felder, Lizenz, Dateigröße (höchstens 20 MB, Ordner höchstens 200 MB) und Prüfsumme; Fehler stehen am Ende der Ausgabe.
- Sichtprüfung: `node scripts/shot.mjs --community <id>.<endung>`.
- Stand 2026-10-29: 161 Community-Bauten aus 42 Quellen (7 GitHub-Repos, 35 Modrinth-Projekte), zusammen knapp 10 MB; dazu 59 eigene Bau-Module, also 220 Bauten in 6 Kategorien. Keine Spielstrukturen und keine Neugestaltungen davon (z. B. Wüstenpyramide, Iglu, Dorfhaus, Schiffswrack). Enthält eine Datei Blöcke, die es in Minecraft 26.2 nicht gibt (z. B. aus Mods), oder mehr als 3 Mio. Blöcke, fehlt der Bau mit Fehler im Katalog; übrige Hinweise des Imports (Objekte, umbenannte Blöcke) zeigt `build-catalog.mjs` nur in der Konsole, die Dateien bleiben unverändert.

## Lauf-Modus
- W A S D laufen, Maus oder Pfeiltasten blicken (Klick ins Bild sperrt den Zeiger), Leertaste springen (doppelt: fliegen), Umschalt schleichen bzw. runter, Strg sprinten, Esc beendet. Auf dem Handy Joystick und Knöpfe.
- Nichts läuft von allein weiter: Esc lässt immer alle Tasten los. Ende der Zeigersperre, Vollbild-Wechsel, Ein- und Ausschalten, Kontextmenü außerhalb der Ansicht und Alt/Cmd/Windows-Taste lassen ebenfalls los; ohne Finger auf dem Bildschirm ist nichts Berührtes mehr gehalten.

## Meine Bauten
- Gespeichert wird nur in diesem Browser (IndexedDB `bk-mine`, getrennt vom Spieldaten-Speicher), nichts geht ins Netz. Anderer Browser oder anderes Gerät = eigene Liste.
- Formate wie beim Upload: `.schem`, `.schematic`, `.litematic`, `.nbt`, `.vox`, `.stl`, `.obj`, `.glb`, `.gltf`, dazu `.zip` mit vielen Bauten. Je Datei höchstens 64 MB, ein ZIP entpackt höchstens 256 MB und 500 Einträge. Jede Datei wird beim Hinzufügen wie beim Upload gelesen: alte MCEdit-`.schematic`, beschädigte, leere oder zu große Dateien kommen gar nicht erst in die Liste.
- Ein ZIP darf eine `manifest.json` enthalten: `[{ "file": "haus.schem", "title": "Mein Haus", "category": "haeuser", "author": "…", "url": "https://…", "license": "CC BY 4.0" }]`. Pfade gelten ab dem Ordner der `manifest.json` (nur wenn ein Pfad nicht passt, zählt ein eindeutiger Dateiname); Texte werden gekürzt, `url` nur mit https, unbekannte Kategorien werden zu „ohne Kategorie“. Ohne Manifest heißt jeder Bau wie seine Datei.
- Autor, Link und Lizenz zeigt die Bau-Seite unter „Infos“. Bei 3D-Modellen, die über „Selber erstellen“ gespeichert werden, bleiben die gewählten Optionen (Höhe, Blöcke, hohl, Achse) erhalten.

## Ordner
- `index.html`, `kategorie.html`, `bau.html`, `erstellen.html`, `meine.html`: die fünf Seiten
- `css/`: Design-System (`style.css`) und Seiten-Stile
- `assets/`: Logo, Icons, Muster (aus `assets/pixel-art/` erzeugt) und lokale Schriften (SIL OFL, Quellen in `assets/fonts/QUELLEN.md`)
- `js/core/`: Kern für Browser und Node: Block-Volumen, Builder-API, Auto-Verbindungen, Schritte, Materialien, Blocknamen
- `js/render/`: eigene 3D-Ansicht (WebGL2) mit Worker, Texturen aus dem Spiel, Lauf-Modus
- `js/ui/`: Seitenlogik (`browse/` Kategorien, `build/` Bau-Seite, `create/` „Selber erstellen“, `mine/` Meine Bauten)
- `js/data/`: Spieldaten im Browser (Download aus misode/mcmeta, Umwandlung, Speicher), Meine Bauten (`my-builds.js`) und ZIP-Leser (`zip.js`)
- `js/create/`: Freitext-Suche, Formen-Generatoren, Datei-Import (`import/`) und Modell-Umwandlung (`voxelize/`)
- `js/builds/<kategorie>/`: die Bau-Module in 6 Kategorien (Häuser, Wahrzeichen, Fantasy, Mittelalter, Kleine Projekte, Infrastruktur); `js/builds/lib/`: Hilfsbibliothek (Fenster, Türen, Dächer, Möbel, Licht, Bäume, Gelände)
- `scripts/`: Start, Server, Spieldaten-Extraktion, Katalog, Vorschaubilder, Prüf- und Screenshot-Werkzeuge
- `tests/`: Unit-Tests (`unit/`), Klick-Test (`e2e.mjs`), Testseiten und Sichtprüfungen (`visual/`), Testdaten (`fixtures/`), Chrome-Steuerung (`browser.mjs`)
- `docs/ARCHITEKTUR.md`: verbindliche Spezifikation mit allen Schnittstellen; `docs/recherche/`: Maße und Quellen der echten Bauwerke
- `data/catalog.json`: Katalog der Bauten (erzeugt, aber im Repo); `data/community/`: Community-Bauten mit Angaben und Lizenztexten; `.nojekyll`: GitHub Pages liefert alles unverändert aus
- Erzeugt und nicht im Repo: `game-data/` (Spieldaten), `thumbs/` (Vorschaubilder), `tmp/` (Screenshots, Testreste)

## Testen
```powershell
node --test "tests/unit/**/*.test.mjs"   # Unit-Tests
node tests/e2e.mjs                       # Klick-Test im echten Chrome gegen den echten Katalog (Desktop und Handy)
node scripts/check-imports.mjs           # alle lokalen Verweise mit exakter Groß-/Kleinschreibung (wichtig unter Linux)
node scripts/check-build.mjs <modulpfad> [--scale <zahl>] [--json]   # einen Bau prüfen
node scripts/shot.mjs --module <modulpfad>                           # Screenshots der 3D-Ansicht
```
- `node tests/e2e-remote.mjs [--live]`: Klick-Test wie auf GitHub Pages (eigener statischer Server auf 127.0.0.2 unter `/minecraft-block-kompass/`, ohne `game-data/` und `thumbs/`). Ohne `--live` aus dem Spiegel `tmp/mcmeta-mirror/` (erzeugen mit `node scripts/mirror-mcmeta.mjs`), mit `--live` gegen das echte raw.githubusercontent.com.
- Der Klick-Test geht Start (sechs Kategorien, ohne Scrollen bei 1280 × 800 und 390 × 844, Kopf ohne Suche) → Kategorie (Filter samt „Original vom Ersteller“, Sortierung, Zurück) → Bau-Seiten (Tokyo Skytree 1:1, Infinity Castle, ein Haus mit Bett und Truhe, Community-Bauten mit Ersteller und Lizenz, Lauf-Modus ohne hängende Tasten, alte Adressen `spiel-…`, Redstone und Farmen) → „Selber erstellen“ (Freitext, Upload je Dateiformat) → Meine Bauten (ZIP mit Manifest, „Zu Meine Bauten“, Liste, Öffnen, Neuladen, Löschen) → Handy-Ansicht durch, misst Ladezeiten und Bildrate und legt Screenshots nach `tmp/integration/e2e/`. Optionen: `--only start,bau,erstellen,meine,handy`, `--gpu swiftshader`, `--out <ordner>`. Der Online-Test lädt Community-Bauten wie auf Pages aus `/minecraft-block-kompass/data/community/`.
- Ausführlichere Sichtprüfungen einzelner Seiten: `node tests/visual/build-page-check.mjs`, `node tests/visual/create-page-check.mjs`.

## In der Cloud
Für Claude Code im Web (Linux-Container mit Klon des Repos, ohne Minecraft). `game-data/` ist nicht im Repo und entsteht dort aus öffentlichen Quellen: Archive von [misode/mcmeta](https://github.com/misode/mcmeta) (unveränderte Dateien der 26.2-Jar) und die deutsche Sprachdatei von Mojang. Das Ergebnis ist Byte für Byte gleich wie mit dem Jar; nur `meta.json` nennt zusätzlich Zeit und Quellen.
```bash
node scripts/extract-game-data.mjs --remote   # ≈ 7 MB Download, Cache in game-data/.cache/
node scripts/check-imports.mjs                # unter Linux zählt die Groß-/Kleinschreibung
node --test "tests/unit/**/*.test.mjs"
node scripts/build-catalog.mjs                # Katalog (mit --thumbs auch Vorschaubilder, braucht Chrome)
node scripts/serve.mjs                        # http://127.0.0.1:8080
```
Alles in einem Schritt: `node scripts/start.mjs --remote` (ohne Chrome zusätzlich `--no-thumbs`).

Netzwerkzugriff der Cloud-Umgebung: diese Domains erlauben.

| Domain | wofür |
|---|---|
| `codeload.github.com` | ZIP-Archiv von misode/mcmeta: Blockstates, Modelle, Texturen, englische Namen (nötig) |
| `raw.githubusercontent.com` | Blockbericht mit Eigenschaften und Standardwerten (nötig), Rückfall für `de_de.json` |
| `piston-meta.mojang.com` | Mojang-Versionsliste und Asset-Index (Prüfsumme der deutschen Sprachdatei) |
| `resources.download.minecraft.net` | `de_de.json` von Mojang |

- Ist eine Domain gesperrt, nennt das Skript sie und bricht ab. Nur für `de_de.json` gibt es einen Rückfall über GitHub (Stand der Veröffentlichung, Warnung in `meta.json`).
- `--offline` nimmt alles aus dem Cache, `--out <ordner>` schreibt woanders hin.
- Ein gesetzter `HTTPS_PROXY` wird genutzt: Das Skript startet sich dafür mit `node --use-env-proxy` neu (Node 24.5 oder neuer).
- Browser-Tests und Screenshots suchen Chrome/Chromium unter `/usr/bin/google-chrome`, `/usr/bin/chromium`, `/usr/bin/chromium-browser`, `/opt/google/chrome/chrome` und im Playwright-Cache (`~/.cache/ms-playwright`, `PLAYWRIGHT_BROWSERS_PATH`), sonst `CHROME_PATH` setzen. Als root läuft Chrome mit `--no-sandbox`. Ohne Grafikkarte: `node scripts/shot.mjs … --gpu swiftshader`.
