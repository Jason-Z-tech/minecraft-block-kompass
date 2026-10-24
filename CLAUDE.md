# Block-Kompass – Hinweise für Claude

Lokale Webseite (nur Eigengebrauch) mit Minecraft-Bauten: 3D-Schritt-für-Schritt-Anleitungen im Browser (eigener WebGL2-Viewer mit Lauf-Modus), Materiallisten, Ebenen-Plan und „Selber erstellen“. Minecraft **Java Edition 26.2**.
Verbindliche Spezifikation: `docs/ARCHITEKTUR.md` (Ordner, Schnittstellen, Datenformate, Design). Recherchen mit Quellen: `docs/recherche/`.

## Entscheidungen des Users (verbindlich)
- **Nie Minecraft, einen Server oder ein Jar starten**, nie etwas in `.minecraft` oder `curseforge` schreiben. Spieldaten werden nur gelesen.
- Texturen, Modelle und deutsche Blocknamen kommen original aus dem Spiel (`de_de.json`), nicht nachgebaut. Blocknamen immer korrekt.
- Keine KI in der Seite. „Selber erstellen“ = Katalogsuche, Form-Generator und Upload (`.schem`, `.litematic`, `.nbt`, `.stl`, `.obj`, `.glb`, `.vox`). Nichts erfinden, lieber ehrlich „nicht gefunden“. Genauigkeits-Labels: original, massstab, vorlage, nachempfunden, eigenes.
- Kein Export, keine Warnung zur Bauhöhe, kein Hinweis- oder Disclaimer-Text.
- Sehr viele Bauten (Ziel: 100+ pro Kategorie). Fertige Online-Bauten dürfen übernommen werden; Quelle und Lizenz in `sources`/`credits` notieren.
- Redstone und Farmen sind nicht im Spiel getestet und tragen `tested: false`.
- Seite und Antworten auf Deutsch, Code-Namen auf Englisch.

## Arbeitsregeln
- Kurz antworten, Fragen als nummerierte Liste, am Ende 2–3 Zeilen: was geändert wurde und wie man es testet.
- Bei grösseren Aufgaben zuerst kurz den Plan zeigen und auf OK warten.
- Nur Node-Bordmittel: keine npm-Pakete, CDNs oder neuen Abhängigkeiten ohne Nachfrage.
- Ehrlich testen: „funktioniert“ nur nach echtem Lauf. Tests nie abschwächen, auskommentieren oder löschen.
- Nichts ungefragt löschen, überschreiben oder umbenennen. Ursache beheben statt Symptom.
- Sicherheit: Eingaben und Uploads prüfen (Typ, Grösse), Ausgaben escapen, die strenge CSP beibehalten.

## Git und GitHub
- Privates Repo `Jason-Z-tech/minecraft-block-kompass`, Branch `main`.
- Auftrag des Users (2026-10-22): nach jedem erreichten Meilenstein committen und pushen, damit GitHub immer aktuell ist. Das macht nur die Haupt-Session. Workflow- und Sub-Agenten führen keine git-Schreibbefehle aus.
- Identität nur `Jason-Z-tech` / `181737057+Jason-Z-tech@users.noreply.github.com`. Nie echte Namen oder E-Mail-Adressen in Commits oder Dateien.
- Nie force-push, `reset --hard` oder `clean`. Commit-Nachrichten auf Deutsch.
- `game-data/`, `thumbs/` und `tmp/` nie committen: Sie enthalten Mojang-Dateien bzw. daraus erzeugte Bilder.

## Spieldaten (`game-data/`, nicht im Repo)
- Lokal einmal erzeugen: `node scripts/extract-game-data.mjs`. Liest das 26.2-Jar und die Assets der Installation, holt den Blockbericht von misode/mcmeta. Optionen: `--jar`, `--assets`, `--offline`.
- In der Cloud (claude.ai/code) gibt es kein Jar und darum zuerst kein `game-data/`. Dort `node scripts/extract-game-data.mjs --remote` ausführen (lädt die Daten von misode/mcmeta und Mojang, siehe README „In der Cloud“).

## Starten und testen
- Server: `node scripts/serve.mjs` → http://127.0.0.1:8080 (anderer Port mit `--port`).
- Unit-Tests: `node --test "tests/unit/**/*.test.mjs"`
- Bau prüfen: `node scripts/check-build.mjs <modulpfad> [--scale <zahl>] [--json]`
- Screenshots: `node scripts/shot.mjs --module <pfad>` (Chrome headless über `tests/browser.mjs`, Pfad notfalls per `CHROME_PATH`).

## Stand (2026-10-24, 16:00)
- Runde 1 fertig und geprüft (alle Unit-Tests grün): Spieldaten-Extraktion, Kern (Builder-API, Auto-Verbindungen, Schritte, Materialien), 3D-Ansicht mit Spieltexturen und Lauf-Modus, Seitenhülle und Design, Recherche Tokyo Skytree und Infinity Castle.
- Offen aus der Prüfung von Runde 1 (für Runde 3): durchsichtige Flächen innerhalb eines Chunks unsortiert (Buntglas mischt sich je nach Blickwinkel), Schritt-Meshes bei sehr grossen Ebenen-Schritten speicherhungrig, `fill` mit replace/keep ohne Blockgrenze, Wasserhöhe 14/16 statt 8/9, Komposter-Seiten nicht stabil, Text „linke Hälfte“ bei Doppeltruhen missverständlich, Geist-Durchgänge auch bei fertigem Bau.
- Runde 2 läuft lokal als Workflow (Zwischenstand committet, 804/804 Unit-Tests grün). Fertig und im Repo: Hilfsbibliothek (`js/builds/lib/`), Katalog mit Original-Strukturen aus dem Spiel, Startseite/Kategorien (`js/ui/browse/`), Bau-Seite mit Schritt-Player (`js/ui/build/`), „Selber erstellen“ mit Oberfläche (`js/ui/create/`) und Logik (Freitext, Formen, Upload/Voxelisierung in `js/create/`), Spieldaten-Download für die Cloud (`--remote`). Geprüfte Bauten: Tokyo Skytree 1:1, Infinity Castle, Wahrzeichen, Kleinbauten, Mittelalter, Fantasy, Infrastruktur.
- Noch in Arbeit (lokal, darum nicht im Repo): Bauten für Häuser (in Prüfung), Farmen und Redstone, danach Zusammenführung und Klick-Test. Diese Teile in der Cloud nicht neu anfangen, sie kommen mit dem nächsten Commit.
- Danach Runde 3 (Gesamt-Review, End-to-End-Test, README), dann prüft der User die Qualität. Erst danach auf 100+ Bauten pro Kategorie skalieren.
