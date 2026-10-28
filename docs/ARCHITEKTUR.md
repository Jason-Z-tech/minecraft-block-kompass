# Block-Kompass – Architektur und Schnittstellen

Stand 2026-10-22 · Minecraft **Java 26.2** (world_version 4903, resource pack 88)

Dieses Dokument ist der verbindliche Plan. Alle Module halten sich an die Schnittstellen hier.
Wer davon abweichen muss, trägt die Änderung hier ein (Abschnitt anpassen, Zeile „Änderung: …“ dazu)
und nennt sie im Abschlussbericht.

---

## 1. Rahmen

- **Zweck:** private, lokale Webseite mit Minecraft-Bauprojekten und Schritt-für-Schritt-Anleitungen
  in 3D. Nur für den eigenen Gebrauch des Users, wird nicht veröffentlicht.
  Änderung (Webseite, 2026-10-27, Entscheid des Users): Die Seite ist online auf GitHub Pages
  (https://jason-z-tech.github.io/minecraft-block-kompass/, „Deploy from a branch“ main, Root, `.nojekyll`) und soll ohne
  Node und auch auf dem Handy laufen. Weiterhin gilt: keine Mojang-Dateien im Repo oder auf der Seite. Der Katalog
  (`data/catalog.json`, nur Projekttexte, Größen, Zahlen, IDs) liegt im Repo; die Spieldaten lädt der Browser selbst aus
  öffentlichen Quellen (misode/mcmeta, „Weg A“, §13). Lokal (127.0.0.1/localhost) bleibt `game-data/` nutzbar.
- **Technik:** statisches HTML/CSS/JS mit ES-Modulen. Kein Build-Tool, **keine npm-Pakete, keine
  CDNs**. Node-Skripte nur mit Bordmitteln (`node:fs`, `node:zlib`, `node:http`, `node:test`,
  `node:child_process` …). Installiert: Node 24, Python 3.13, git, Chrome.
- **Start:** `node scripts/serve.mjs` → http://127.0.0.1:8080 (ES-Module und Worker brauchen http).
- **Spieldaten:** Texturen, Blockmodelle, deutsche Namen und Original-Strukturen liest
  `node scripts/extract-game-data.mjs` einmalig aus der installierten Minecraft Java 26.2 nach
  `game-data/` (gitignored, wird nie weitergegeben).
  - **Nur lesen.** Nie etwas in `%APPDATA%\.minecraft` oder `%USERPROFILE%\curseforge` schreiben.
    **Nie Minecraft, einen Server oder eine .jar starten** (ausdrücklicher Wunsch des Users).
- **Edition:** nur Java, Version 26.2. Bauten nutzen nur Blöcke, die es in 26.2 gibt.
- **Sprache:** Oberfläche Deutsch (du-Form), Blocknamen wie im deutschen Spiel plus ID
  (z. B. „Steinziegel · minecraft:stone_bricks“). Code-Namen Englisch, Kommentare kurz, Deutsch,
  nur wo der Code nicht selbsterklärend ist.
- **Sicherheit:** URL-Parameter und Eingaben prüfen (Whitelist, Zahlengrenzen). Nutzerdaten nie als
  HTML einsetzen (`textContent`, DOM-APIs). CSP per `<meta>` in jeder Seite; der lokale Server
  setzt dieselben Header, bindet nur an 127.0.0.1 und blockt Pfad-Traversal. Fehlermeldungen
  für Nutzer allgemein, Details nur in der Konsole.
- **Qualität:** keine Platzhalter, keine TODOs, keine halben Lösungen. Fehler nie still schlucken.
  Kleine Funktionen, sprechende Namen. Ehrlich testen.
- **Bedienung:** mobile first, Touch **und** Maus/Tastatur, `prefers-reduced-motion` beachten,
  gute Kontraste, Fokus sichtbar. Lade-, Leer- und Fehlerzustände immer mitgestalten.

## 2. Ordner und Zuständigkeiten

```
minecraft-block-kompass/
  index.html  kategorie.html  bau.html  erstellen.html
  assets/            fonts/ (woff2, OFL-Lizenzen, QUELLEN.md), logo.svg, favicon.svg, icons.svg,
                     patterns/ (Grasskante, Gelände, Textur), ui/ (Masken für Haken und Pfeil)
  css/style.css      Design-System (Tokens, Komponenten)
  js/core/           Kern, läuft in Browser UND Node (keine DOM-/Browser-APIs!)
    blockstate.js    Zustands-Strings parsen/formatieren
    block-data.js    Blockliste + Eigenschaften + Standardwerte (aus game-data/blocks.json)
    volume.js        BlockVolume (Chunk-Speicher)
    builder.js       Builder-API für Bau-Module
    shapes.js        Geometrie-Helfer (vom Builder genutzt)
    transform.js     Drehen/Spiegeln von Positionen und Zuständen
    connections.js   automatische Verbindungen (Zäune, Mauern, Scheiben, Treppenform, Redstone …)
    steps.js         Schrittplan (Kapitel → Ebenen)
    materials.js     Block → Item, Mengen, Stacks/Shulkerkisten
    describe.js      Zustände in deutsche Bauanweisungen übersetzen
    random.js        deterministischer Zufall
  js/render/         WebGL2-Ansicht
    block-models.js  Zustand → Quads (aus game-data/models.json)
    special-models.js  Truhen, Betten, Schilder, Banner, Köpfe, Shulkerkisten, Glocke, Flüssigkeiten …
    tints.js         Einfärbungen (Gras, Laub, Wasser, Redstone …)
    mesher.js        Chunk-Meshing (rein, in Node testbar)
    texture-store.js Texturen laden → TEXTURE_2D_ARRAY
    engine-worker.js Worker: bauen + meshen
    renderer.js      Viewer-Klasse (Szene, Schritte, Schnitt, Geist, Hervorhebung)
    controls.js      Orbit- und Lauf-/Flugsteuerung (Maus, Touch, Tastatur)
    picking.js       Strahl-Test (DDA) für Hover/Klick
    mat.js           kleine Vektor-/Matrix-Helfer
  js/ui/             Seitenlogik
  js/create/         Freitext-Erkennung, Formen-Generatoren
  js/builds/<kategorie>/<id>.js   Bau-Module (Inhalte)
  js/builds/lib/     Hilfsbibliothek für Bau-Module (§9.1): index.js (alles), palettes.js, bauteile.js, innen.js, natur.js
  js/builds/game-structures.js    Auswahl der Original-Strukturen aus dem Spiel
  scripts/           Node-Skripte (serve, extract-game-data, build-catalog, check-build, shot)
  scripts/lib/       zip.mjs, nbt.mjs
  tests/unit/        node --test
  tests/visual/      Testseiten für Screenshots
  tests/browser.mjs  Chrome-Steuerung über DevTools-Protokoll (aus dem Dyna-Kompass übernommen)
  game-data/         ERZEUGT, gitignored
  data/catalog.json  ERZEUGT von build-catalog.mjs, aber im Repo (Etappe 1; ohne Spieldaten, mit der Seite veröffentlicht)
  thumbs/            ERZEUGT, gitignored (Vorschaubilder, nur lokal)
  tmp/               gitignored (Screenshots, Testreste)
  .nojekyll          GitHub Pages liefert alle Dateien unverändert aus (kein Jekyll)
  docs/              ARCHITEKTUR.md, recherche/*.md
```
Änderung: `assets/` enthält zusätzlich das Icon-Sprite `icons.svg` (eigene 16×16-Pixel-Icons, Farbe =
`currentColor`), Muster in `assets/patterns/` und CSS-Masken in `assets/ui/`. Alle diese SVGs (auch Logo und
Favicon) entstehen aus ASCII-Rastern in `assets/pixel-art/`: `node assets/pixel-art/build.mjs` schreibt sie neu
(nur Node-Bordmittel); `tests/unit/ui-pixel-art.test.mjs` prüft, dass Quellen und SVGs übereinstimmen.

## 3. Koordinaten und Richtungen

- Wie Minecraft: **x → Osten**, **y → oben**, **z → Süden**. Norden = −z, Westen = −x.
- Richtungen als Strings: `north`, `south`, `west`, `east`, `up`, `down`.
- Bau-Module bauen in eigenen Koordinaten; `finalize()` verschiebt alles so, dass die kleinste
  Ecke bei (0,0,0) liegt. In der Anleitung heißt die unterste Ebene „Ebene 1“ (y = 0).
- Drehung `rotate: 90` = 90° im Uhrzeigersinn von oben gesehen: Norden → Osten → Süden → Westen.
  Position: (x, z) → (−z, x). Spiegeln `mirror: 'x'`: x → −x (Osten ↔ Westen); `'z'`: z → −z.

## 4. Blockzustände (`js/core/blockstate.js`)

Format wie in Minecraft-Befehlen, **ohne** Namensraum: `oak_stairs[facing=north,half=bottom]`.
Eingaben mit `minecraft:` werden akzeptiert und gekürzt. Normalform: Eigenschaften alphabetisch.

```js
parseState(str)          // → { id, props }  (wirft Error bei Syntaxfehler)
formatState(id, props)   // → normalisierter String
normalizeState(str)      // → normalisierter String
withProps(str, patch)    // patch-Wert null löscht die Eigenschaft
getProp(str, key)        // → string | undefined
stateId(str)             // → id (schnell, ohne Objekt)
```

`js/core/block-data.js` (Daten aus `game-data/blocks.json`, in Node per `fs`, im Browser per
`fetch` geladen und mit `setBlockData()` gesetzt):

```js
setBlockData(json)
hasBlock(id)             // → boolean
blockProps(id)           // → { prop: [werte…] } | null
defaultProps(id)         // → { prop: wert }
validateState(str)       // → { ok, errors: [deutsche Meldungen] }
completeState(str)       // → vollständiger, normalisierter Zustand (fehlende Eigenschaften = Standard)
```
Änderung: `defaultProps(id)` liefert für unbekannte Blöcke `null`; `completeState` wirft bei ungültigen
Zuständen. Zusätzlich `isBlockDataLoaded()`, `blockDataInfo()`, `allBlockIds()`, `defaultPropsFrozen(id)`
(schnell, nicht verändern) und `clearBlockData()` (für Tests). Ohne geladene Daten werfen die Abfragen
einen `Error` mit Hinweis. In `blockstate.js` zusätzlich `parseStateCached(str)` (eingefroren, schnell),
`isAirId(id)`, `isAirState(str)`; IDs, Namen und Werte nur aus `a–z 0–9 _`.

**Bedeutung wichtiger Eigenschaften** (für Bauregeln, Drehungen und Beschreibungen):

| Block | Eigenschaft | Bedeutung |
|---|---|---|
| Treppen | `facing` | Richtung, in die man hinaufgeht (die hohe Stufe liegt auf dieser Seite); `half` bottom/top; `shape` wird automatisch berechnet |
| Stufen | `type` | bottom / top / double |
| Stämme, Säulen | `axis` | x / y / z |
| Türen | `half`, `facing`, `hinge`, `open` | zwei Blöcke lower/upper |
| Betten | `part`, `facing` | foot/head; facing = Richtung vom Fuß- zum Kopfteil |
| Repeater, Komparator | `facing` | zeigt zur **Eingangsseite**; das Signal läuft in die Gegenrichtung (facing=south → Signal nach Norden). Repeater `delay` 1–4, Komparator `mode` compare/subtract |
| Beobachter | `facing` | beobachtete Seite („Gesicht“); Ausgang auf der Gegenseite |
| Kolben | `facing` | Schubrichtung |
| Trichter | `facing` | Ausgaberichtung (`down` oder waagrecht) |
| Spender, Werfer | `facing` | Ausgaberichtung |
| Wandfackel, Leiter, Wandschild, Knopf/Hebel mit `face=wall` | `facing` | zeigt von der Wand weg |
| Stehende Schilder, Banner, Köpfe | `rotation` | 0–15: 0 = Süden, 4 = Westen, 8 = Norden, 12 = Osten |

Änderung (render:models, nach `SkullBlock`/`SkullBlockRenderer` 26.2): bei **Köpfen und Schädeln** zählt `rotation`
andersherum – 0 = Gesicht nach Norden, 4 = Osten, 8 = Süden, 12 = Westen. Das Spiel speichert beim Setzen die Blickrichtung
des Spielers ohne +180° (Banner und Schilder mit +180°), der Kopf schaut also den Spieler an. Wandköpfe: `facing` = Blickrichtung.

## 5. Spieldaten (`game-data/`, erzeugt von `scripts/extract-game-data.mjs`)

**Quellen (nur lesen):**
- Jar: `%APPDATA%\.minecraft\versions\26.2\26.2.jar` (überschreibbar mit `--jar <pfad>`).
  Enthält `assets/minecraft/{blockstates,models,textures,items,lang/en_us.json}` und
  `data/minecraft/structure/**.nbt`.
- Deutsch: `minecraft/lang/de_de.json` über Asset-Index `32.json` aus
  `%USERPROFILE%\curseforge\minecraft\Install\assets` (sonst `%APPDATA%\.minecraft\assets`;
  überschreibbar mit `--assets <ordner>`). Datei: `objects/<hash[0..2]>/<hash>`.
- Blockeigenschaften mit Standardwerten: Datengenerator-Bericht von 26.2 aus dem öffentlichen
  Repo misode/mcmeta (Download, Cache in `game-data/.cache/`). Fehlt er, werden Eigenschaften aus
  den Blockstate-Dateien abgeleitet und Standardwerte per Tabelle gesetzt (`"source":"derived"`).
  Änderung: feste Adresse `https://raw.githubusercontent.com/misode/mcmeta/26.2-summary/blocks/data.min.json`
  (Format `{ id: [ {prop: [werte…]}, {prop: standard} ] }`), geprüft über `version.json` desselben Tags
  (`id` = 26.2, `data_version` = 4903). Cache: `game-data/.cache/mcmeta-26.2-summary-{version,blocks}.json`;
  mit `--offline` wird nichts geladen. Asset-Index-ID aus `versions/26.2/26.2.json` (`assetIndex.id`,
  sonst 32); `de_de.json` wird per SHA-1 gegen den Index geprüft.
- Änderung (cloud:spieldaten): **ohne Installation** `--remote` (`scripts/lib/remote-source.mjs`), für Claude Code im Web.
  Statt Jar: ZIP-Archive der Tags `26.2-assets-tiny` (Assets ohne Sounds/fremde Sprachen) und `26.2-data` von misode/mcmeta
  über `https://codeload.github.com/misode/mcmeta/zip/refs/tags/<tag>` (Hauptordner `mcmeta-<tag>/` wird abgeschnitten,
  beide Archive zu einer Quelle zusammengelegt; `version.json` im mcmeta-Format: `data_version` = worldVersion,
  `resource_pack_version`, `data_pack_version`). Geprüft 2026-10-23: alle Blockstates, Modelle, Texturen, `en_us.json` und
  Struktur-NBTs sind Byte für Byte gleich wie in der 26.2-Jar (Git-Blob-SHA). `de_de.json`: Mojang-Versionsliste
  (`piston-meta.mojang.com/mc/game/version_manifest_v2.json`) → Versionsdatei → Asset-Index → `resources.download.minecraft.net`,
  jede Stufe per SHA-1 geprüft; Rückfall `raw.githubusercontent.com/misode/mcmeta/26.2-assets/assets/minecraft/lang/de_de.json`
  (Stand der Veröffentlichung, ohne Prüfsumme: Mojang ergänzt die Datei im Asset-Index später um Namen neuerer Versionen;
  Namen aller 26.2-Blöcke sind gleich, Warnung in `meta.json`). Blockbericht wie oben; fehlt er, bricht `--remote` ab
  (kein „derived“). Cache: `<out>/.cache/` (`mcmeta-<tag>.zip`, `mojang-26.2.json`, `mojang-assets-<id>.json`,
  `mojang-de_de.json`); `--remote --offline` nur aus dem Cache. Gesperrte Domain → deutsche Meldung mit der Domain, der
  Liste aller vier Domains und dem Hinweis auf README „In der Cloud“. Gesetzter `HTTPS_PROXY`/`HTTP_PROXY` ohne aktive
  Proxy-Unterstützung → das Skript startet sich einmal mit `node --use-env-proxy` neu. Ergebnis identisch mit dem Jar-Weg
  (Hash-Vergleich aller Dateien), nur `meta.json` hat zusätzlich `sources.remote = { assets, data, lang }` und eine andere
  `extractedAt`. Nie ein Jar herunterladen oder ausführen.

**Ausgaben:**

`meta.json`
```json
{ "version": "26.2", "worldVersion": 4903, "extractedAt": "ISO-Zeit",
  "counts": { "blocks": 0, "models": 0, "textures": 0, "structures": 0 }, "warnings": [] }
```
Änderung: zusätzlich `resourcePack` (88), `dataPack` (107), `sources` (`blocks`, `blocksRef`, `assetIndex`),
weitere `counts` (`blockstates`, `blockNames`, `itemNames`) und `features` (Zählungen der neuen 26.2-Felder,
`rotationAngles`, `blocksWithoutGeometry` = Blöcke, deren Modelle alle keine Elemente haben).

`names.json` – aus `block.minecraft.<id>` und `item.minecraft.<id>`
```json
{ "block": { "stone_bricks": { "de": "Steinziegel", "en": "Stone Bricks" } },
  "item":  { "redstone": { "de": "Redstone-Staub", "en": "Redstone Dust" } } }
```

`blocks.json`
```json
{ "version": "26.2", "source": "mcmeta" ,
  "blocks": { "oak_stairs": {
      "props": { "facing": ["north","south","west","east"], "half": ["top","bottom"],
                 "shape": ["straight","inner_left","inner_right","outer_left","outer_right"],
                 "waterlogged": ["true","false"] },
      "default": { "facing": "north", "half": "bottom", "shape": "straight", "waterlogged": "false" } } } }
```
Änderung: bei `source: "mcmeta"` zusätzlich `"ref": "misode/mcmeta@26.2-summary"`. 1196 Blöcke; `item_frame`
und `glow_item_frame` haben Blockstate-Dateien (Modelle für den Rahmen), sind aber keine Blöcke.

`models.json` – vollständig aufgelöste Modelle (Eltern-Kette, `#`-Texturverweise, Standard-UVs)
```json
{
  "version": "26.2",
  "textures": ["block/stone", "block/oak_planks"],
  "models": [
    { "ao": true, "particle": 0,
      "elements": [
        { "from": [0,0,0], "to": [16,16,16],
          "rotation": null,
          "shade": true, "light": 0,
          "faces": { "down": { "tex": 0, "uv": [0,0,16,16], "rotation": 0, "cull": "down", "tint": -1 } } } ] }
  ],
  "blocks": {
    "stone": { "variants": [ { "when": {}, "apply": [ { "model": 0, "x": 0, "y": 0, "uvlock": false, "weight": 1 } ] } ] },
    "oak_fence": { "multipart": [
      { "when": null, "apply": [ { "model": 5, "x": 0, "y": 0, "uvlock": false, "weight": 1 } ] },
      { "when": { "north": ["true"] }, "apply": [ … ] },
      { "when": { "OR": [ { "east": ["low","tall"] }, { "north": ["low"] } ] }, "apply": [ … ] } ] }
  }
}
```
- `rotation` eines Elements: `{ "origin": [8,8,8], "axis": "y", "angle": 45, "rescale": false }` oder `null`.
  Änderung (26.2): Winkel sind frei (Schilder nutzen −90, −67.5 und 0.0001), und es gibt Mehrachsen-Drehungen
  `{origin, x, y, z}` (im Spiel `Matrix4f.rotationZYX`: erst um X, dann Y, dann Z, feste Achsen) – ausgegeben als
  `"axis": null, "angle": null, "euler": [x,y,z]`. Jede Drehung hat zusätzlich `"matrix"` (3×3, zeilenweise,
  `rescale` schon eingerechnet: Spalte je Achse × 1/max(|M·e|), wie im Spiel). **Renderer: immer `matrix` nutzen**,
  Punkt in 1/16-Einheiten: `p' = matrix·(p − origin) + origin`. Einzelachse = gegen den Uhrzeigersinn um die
  positive Achse (rechtshändig).
- Änderung: jedes Modell hat zusätzlich `"name"` (z. B. `"block/stone"`). Flächen bekommen `"translucent": true`,
  wenn die Textur im Modell als `{ "sprite": …, "force_translucent": true }` steht (26.2: Glas, Buntglas, Scheiben,
  Redstone-Staub) → immer durchscheinende Ebene; fehlt der Schlüssel, gilt false.
- Änderung: `apply`-Einträge können `"z"` (0/90/180/270) haben – das Spiel kennt es, 26.2 nutzt es nicht.
  Multipart-Werte mit `!` (z. B. `"!none"` = jeder andere Wert) werden mit den Werten aus blocks.json zu einer
  normalen Liste aufgelöst; Werte sind immer Strings.
- Änderung: wie im Spiel 26.2 beendet schon ein vorhandenes, leeres `"elements": []` die Vererbung. Die Flächen-
  `texture` meint mit oder ohne `#` den Texturplatz. Ignoriert (liest das Spiel für Blöcke nicht): `display`,
  `gui_light`, `groups`, `texture_size`, Element-`name`/`__comment`.
- Änderung: in 26.2 haben Betten und alle Schilder (stehend, Wand, hängend) echte JSON-Modelle mit Block-Texturen.
  Ohne Elemente bleiben u. a. Truhen (normal, Falle, Ender, Kupfer), Banner, Köpfe, Shulkerkisten, Krug, Aquisitor,
  Kupfergolem-Statuen, Endportal/-transitportal, Wasser, Lava, Luftarten, `light`, `barrier`, `structure_void`,
  `moving_piston`, `bubble_column` (vollständig: `meta.json` → `features.blocksWithoutGeometry`).
- Fehlt `uv`, wird der Standard aus der Elementgröße berechnet (wie im Spiel):
  down `[x1,16−z2,x2,16−z1]`, up `[x1,z1,x2,z2]`, north `[16−x2,16−y2,16−x1,16−y1]`,
  south `[x1,16−y2,x2,16−y1]`, west `[z1,16−y2,z2,16−y1]`, east `[16−z2,16−y2,16−z1,16−y1]`.
- `tex`: Index in `textures`; nicht auflösbar → `-1` (Fläche wird übersprungen, Warnung).
- Modelle ohne Elemente (z. B. Truhe: nur `particle`) haben `"elements": []` – die zeichnet
  `special-models.js`.
- Varianten-Schlüssel `"facing=east,half=bottom"` → `when: {facing:"east", half:"bottom"}`; `""` → `{}`.
  Multipart-Werte `"low|tall"` → Arrays.

`textures.json` + `textures.bin` – alle PNGs hintereinander in einer Datei
```json
{ "version": "26.2", "entries": {
    "block/stone": { "o": 0, "l": 345, "w": 16, "h": 16, "anim": null },
    "block/water_still": { "o": 345, "l": 4000, "w": 16, "h": 512,
      "anim": { "fw": 16, "fh": 16, "frames": [[0,2],[1,2]], "interpolate": false } } } }
```
Enthalten: `textures/block/**`, `textures/item/**`, `textures/colormap/*` und die für
Sondermodelle nötigen Entity-Texturen (`entity/chest/*`, `entity/bed/*`, `entity/signs/**`,
`entity/shulker/*`, `entity/banner*`, `entity/bell/*`, `entity/decorated_pot/*`, `entity/conduit/*`,
Köpfe: `entity/skeleton/*`, `entity/zombie/zombie.png`, `entity/creeper/creeper.png`,
`entity/piglin/piglin.png`, `entity/enderdragon/dragon.png`, `entity/player/wide/steve.png`).
`frames`: Liste `[frameIndex, ticks]`; ohne Liste in der .mcmeta = alle Frames der Reihe nach mit
`frametime` (Standard 1).
Änderung: `entity/bed/*` und `entity/signs/**` gibt es in 26.2 nicht mehr (Betten/Schilder nutzen Block-Texturen
wie `block/white_bed_head_up`, `block/oak_sign`); die Banner-Grundtextur heißt `entity/banner/banner_base`.
Zusätzlich landet jede von Modellen genutzte Textur in der Datei (z. B. `item/barrier`, `item/light_00`).
Optional `"mip"` = `texture.mipmap_strategy` aus der .mcmeta (`dark_cutout` Laub, `strict_cutout` Blumen,
`mean` Glas/Redstone-Staub). Framegröße ohne Angabe: Quadrat mit der kürzeren Bildseite (wie im Spiel).

`structures/index.json` + `structures/<datei>.json` – Original-Strukturen aus dem Spiel
```json
{ "version": "26.2", "structures": [
  { "path": "village/plains/houses/plains_small_house_1",
    "file": "village__plains__houses__plains_small_house_1.json",
    "size": [9,7,9], "blocks": 210, "paletteSize": 18, "entities": 0 } ] }
```
```json
{ "path": "village/plains/houses/plains_small_house_1", "size": [9,7,9],
  "palette": ["air", "cobblestone", "oak_stairs[facing=east,half=bottom,shape=straight,waterlogged=false]"],
  "rle": [0, 15, 1, 3] }
```
- `rle`: Paare `[paletteIndex, anzahl]` in der Reihenfolge y (außen) → z → x (innen),
  Index `(y*sizeZ + z)*sizeX + x`. `palette[0]` ist immer `"air"`.
- Umwandlung: `air`, `cave_air`, `structure_void` fallen weg; `jigsaw` → sein `final_state`
  (aus dem Block-Entity, `minecraft:air` fällt weg); `structure_block` → weg; bei `palettes`
  (mehrere) die erste nehmen; Entities nur zählen.
- Änderung: auch `void_air` fällt weg. Zustände werden wie beim Laden im Spiel mit den Standardwerten aus
  blocks.json vervollständigt (wichtig bei `final_state` wie `spruce_stairs[facing=east]`); bei `source: "mcmeta"`
  fallen unbekannte Blöcke/Eigenschaften mit Warnung weg. `palette` enthält nur genutzte Zustände,
  `paletteSize` = Länge von `palette` (mit `"air"`), `blocks` = Zahl der Nicht-Luft-Zellen. Das Beispiel oben ist
  schematisch – das echte `plains_small_house_1` ist 7×7×7 mit 153 Blöcken und 22 Paletteneinträgen.

`catalog.json` – erzeugt von `scripts/build-catalog.mjs` (siehe §9).
Änderung (Webseite, Etappe 1): Der Katalog liegt nicht mehr hier, sondern im Repo unter `data/catalog.json` (§9).

Änderung (create:voxelize): `block-colors.json` – mittlere Blockfarben für den Modell-Import (§12.3), erzeugt von
`node scripts/build-block-colors.mjs [--data <ordner>]` (≈ 0,3 s) und automatisch von `extract-game-data.mjs` (scheitert es
dort, z. B. an unlesbaren Texturen, bleibt der restliche Extrakt gültig: Warnung in `meta.json`, nur der Modell-Import fehlt).
```json
{ "format": 1, "version": "26.2", "generatedAt": "ISO-Zeit", "count": 384,
  "blocks": { "red_concrete": { "state": "red_concrete", "group": "beton",
      "top":    { "rgb": [142,33,33], "lab": [31.75,45.26,28.36], "pattern": 0.39 },
      "side": { … }, "bottom": { … }, "all": { … },
      "animated": false, "light": 0, "emissive": false, "tinted": false, "falls": false, "changes": false, "special": false } } }
```
- Aufgenommen wird jeder Block (Standardzustand aus blocks.json), dessen Modell `BlockModels.isOpaqueFullCube` erfüllt
  (Logik aus `js/render/block-models.js`, nicht nachgebaut); Sondermodelle (`specialKind`) fehlen. 26.2: 384 Blöcke.
- Farbe je Seite: die Flächen auf der Blockgrenze werden auf einem n×n-Raster (n = Texturbreite, 16 … 64) abgetastet wie gezeichnet
  (deckend vor cutout, cutout mit Alpha-Test 0,5, also z. B. Gras-Overlay), feste Tönung aus §7.1 in sRGB multipliziert wie im
  Shader, Animations-Frames nach Dauer gewichtet; gemittelt in **linearem RGB**. `top` = up, `bottom` = down, `side` = die vier
  Seiten zusammen, `all` = alle sechs. `rgb` sRGB 0 … 255, `lab` CIELAB (D65), `pattern` = mittlerer Lab-Abstand der Abtastpunkte
  zum Mittel (Musterstärke; Beton ≈ 0,4, Bücherregal ≈ 20).
- `group`: `beton`, `betonpulver`, `wolle`, `terrakotta`, `glasierte-terrakotta`, `holz`, `stein`, `erz`, `mineral` (Erzblöcke,
  Amethyst …), `kupfer`, `natur`, `licht`, `technik` (Redstone-Bauteile, TNT …), `arbeitsblock`, `sonder` (Befehls-, Struktur-,
  Test-, Spawner-, Tresorblöcke, Grundgestein, Barriere, Leuchtfeuer, Licht, befallene Blöcke …). Merkmale: `animated`,
  `light`/`emissive` (Lichtwert wie im Spiel > 0), `tinted` (feste Tönung), `falls` (Sand, roter Sand, Kies, verdächtige Blöcke,
  Betonpulver), `changes` (verändert sich von selbst: Gras/Myzel/Nezel, Korallenblöcke, unversiegeltes Kupfer außer „oxidized“),
  `special` (= Gruppe `sonder`).

## 6. Kern (`js/core/`)

### 6.1 BlockVolume (`volume.js`)

Chunks mit 16×16×16 Blöcken, Index im Chunk `(ly*16 + lz)*16 + lx`.
Chunk-Schlüssel: `((cx+1024)*2048 + (cy+1024))*2048 + (cz+1024)` (cx, cy, cz in −1024 … 1023).

```js
class BlockVolume {
  palette            // string[], palette[0] === 'air'
  chunks             // Map<key, { cx, cy, cz, blocks: Uint16Array(4096), steps: Uint16Array(4096) }>
  paletteIndex(state)          // fügt bei Bedarf hinzu (max. 65535 Einträge)
  set(x, y, z, state, step = 0) // 'air' entfernt
  get(x, y, z)                  // → state ('air' wenn leer)
  getIndex(x, y, z)             // → Paletten-Index (0 = Luft)
  getStep(x, y, z) / setStep(x, y, z, step)
  has(x, y, z) / delete(x, y, z)
  get count()                   // Anzahl Nicht-Luft-Blöcke
  get bounds()                  // { min:[x,y,z], max:[x,y,z] } inklusiv, oder null
  forEach(cb)                   // cb(x, y, z, state, step, paletteIndex)
  toTransfer()                  // { palette, chunks:[{cx,cy,cz,blocks,steps}], bounds } – Typed Arrays übertragbar
  static fromTransfer(obj)
}
```
Änderung: zusätzlich `setIndex(x, y, z, index, step = 0)` (schneller Weg mit fertigem Paletten-Index),
`chunkList()` (Chunks in fester Reihenfolge nach Schlüssel) und `static transferList(obj)` (ArrayBuffers für
`postMessage`). `getStep` liefert −1 an leeren Stellen, `setStep` gibt `false` zurück, wenn dort kein Block
ist. `toTransfer()` liefert Kopien (das Volumen bleibt nutzbar); `fromTransfer()` übernimmt die Arrays und
prüft sie. Chunk-Objekte haben zusätzlich `count`; leere Chunks werden entfernt. Koordinaten: ganze Zahlen
−16384 … 16383 (sonst `Error`); `cave_air`/`void_air` gelten als Luft.

### 6.2 Builder (`builder.js`)

Bau-Module bekommen eine `Builder`-Instanz `b`. Alle Formen sind exakt und ganzzahlig.

```js
new Builder({ seed = 'block-kompass', maxBlocks = 3_000_000, maxSize = 4064 })

// Gliederung der Anleitung
b.phase(title)   // neues Kapitel, nur ein Titel; ohne b.step() wird es in Ebenen aufgeteilt
b.step()         // eigener Schritt im aktuellen Kapitel (dann keine Ebenen-Aufteilung), ohne Titel und Text

// Setzen
b.set(x, y, z, state, { raw = false } = {})    // ersetzt vorhandenes; raw = keine Auto-Verbindungen
b.get(x, y, z) / b.remove(x, y, z)
b.fill(x1, y1, z1, x2, y2, z2, state, { hollow, outline, replace, keep } = {})
   // hollow: nur Hülle; outline: nur Kanten; replace: nur diese IDs ersetzen; keep: nur in Luft
b.walls(x1, y1, z1, x2, y2, z2, state)          // vier senkrechte Wände
b.line(x1, y1, z1, x2, y2, z2, state)           // 3D-Linie

// Formen
b.cylinder(cx, y, cz, radius, height, state, { hollow = false, thickness = 1 } = {})
b.disc(cx, y, cz, radius, state, { hollow = false, thickness = 1 } = {})
b.ellipse(cx, y, cz, rx, rz, state, { hollow = false } = {})
b.sphere(cx, cy, cz, radius, state, { hollow = false, thickness = 1, part = 'full' } = {})  // part: full|top|bottom
b.cone(cx, y, cz, rBottom, rTop, height, state, { hollow = false } = {})
b.polygon(points, y, state, { hollow = false } = {})        // points [[x,z],…], gefüllt (gerade-ungerade-Regel)
b.prism(points, y1, y2, state, { hollow = false } = {})     // senkrecht extrudiertes Polygon

// Bauteile (setzen alle nötigen Teile mit richtigem Zustand)
b.door(x, y, z, id, { facing = 'north', hinge = 'left', open = false } = {})
b.bed(x, y, z, id, { facing = 'north' } = {})               // Fußteil bei (x,y,z), Kopfteil in facing-Richtung
b.tall(x, y, z, id)                                         // doppelte Pflanzen: sunflower, lilac, rose_bush, peony, tall_grass, large_fern, tall_seagrass, pitcher_plant
b.stairs(x, y, z, id, { facing = 'north', half = 'bottom' } = {})
b.slab(x, y, z, id, { type = 'bottom' } = {})
b.roof({ x1, z1, x2, z2, y, type = 'gable', axis = 'x', stairs, slab, full, overhang = 0, hollow = true })
   // type: gable (First entlang axis) | hip | pyramid | flat
b.spiralStairs(cx, cz, y1, y2, radius, stairsId, { clockwise = true, core = null } = {})

// Drehen/Spiegeln (verschachtelbar, dreht auch Zustände richtig: facing, axis, rotation,
// north/east/south/west, Schienen-shape, Treppen-shape, hinge, Truhen-type …)
b.transform({ offset = [0,0,0], rotate = 0, mirror = null }, () => { … })

// Zufall (deterministisch, Startwert = seed)
b.rng() / b.rngInt(min, max) / b.pick(array)

b.finalize()  // → BuildResult
```

`BuildResult`:
```js
{
  volume,            // BlockVolume, kleinste Ecke (0,0,0), steps = endgültige Schrittnummern
  size: [w, h, l],   // x, y, z
  offset: [dx, dy, dz],
  phases: [ { title, steps: [stepIndex, …] } ],
  steps:  [ { index, phase, layerY /* number|null */, blockCount, materials: [[itemId, n], …] } ],
  materials: [[itemId, n], …],    // gesamt, absteigend
  blockCount,
  warnings: []
}
```

Regeln:
- Blöcke vor dem ersten `phase()` landen im Kapitel „Aufbau“. Wird eine Position erneut gesetzt,
  gilt der letzte Zustand und sein Kapitel/Schritt.
- Anleitungstexte gibt es nicht (Änderung 2026-10-28): `b.phase()` nimmt genau einen nicht leeren Titel, jedes
  weitere Argument (Text oder Optionen wie `tips`) → `Error` „phase: nur ein Titel – Texte und Tipps gibt es nicht
  mehr.“ `b.step()` nimmt keine Argumente, sonst `Error` „step: Schritte haben keinen Titel und keinen Text mehr.“
  `b.note` gibt es nicht mehr. Das Ergebnis hat keine Texte, Tipps oder Notizen; das gilt auch für Worker-Nachrichten
  und Bauten aus Struktur, Form und Upload.
- Grenzen: mehr als `maxBlocks` Blöcke oder eine Kante größer als `maxSize` → `Error` mit deutscher Meldung.
- `finalize()` führt aus: Normalisieren → Auto-Verbindungen (§6.3) → Schrittplan (§6.4) → Materialien (§6.5).

Änderung (Ergänzungen und genaue Regeln):
- Zusätzlich `b.pickWeighted([[wert, gewicht], …])`, `b.chance(p)` und `b.blockCount` (Blöcke bis jetzt).
  `ellipse`, `cone`, `polygon` und `prism` haben ebenfalls `thickness`. Unbekannte Optionen → `Error`.
  Mit geladenen Blockdaten prüft `set()` jeden Zustand sofort (unbekannter Block/Wert → `Error`).
- **Mittelpunkte und Radien:** Ein Block wird durch seinen ganzzahligen Mittelpunkt vertreten und gehört
  zur Form, wenn sein Abstand ≤ r + 0.5 ist → Durchmesser entlang der Achsen = 2·r + 1. Ungerader
  Durchmesser D: ganzzahliger Mittelpunkt, r = (D − 1) / 2. Gerader Durchmesser: Mittelpunkt und Radius
  auf .5 (D = 6 ab x = 0: cx = 2.5, r = 2.5). Helfer `spanCenter(start, size)`, `spanRadius(size)` in
  `shapes.js`. Mittelpunkte müssen ganz oder halb sein, Radien beliebig ≥ 0.
- **Hohl** (`thickness` t): alle Blöcke der Form mit höchstens t Schritten über Flächen bis nach außen.
  Kein innerer Block berührt den Außenraum mit einer Fläche (6-Nachbarschaft dicht). Kugeln sind
  geschlossen; Zylinder, Kegel und Prismen nur Mantel (oben/unten offen), Kuppeln (`part: 'top'`) unten
  offen. `part: 'top'` = Ebenen y ≥ cy, `'bottom'` = y ≤ cy (bei ganzzahligem cy gehört der Äquator dazu).
- Polygone: Blockmittelpunkte auf dem Rand gehören dazu, innen gerade-ungerade-Regel; Punkte ganz oder halb.
  `line`: ein Block pro Schritt entlang der längsten Achse, exakte Rundung (Richtung egal).
  `fill`: `hollow` = sechs Seiten (Inneres bleibt unberührt), `outline` = 12 Kanten, `replace` = ID oder
  Liste von IDs (`'air'` erlaubt), `keep` = nur in Luft.
- **Dach:** x1..x2 × z1..z2 = Außenkante der Wände, `overhang` verlängert nach allen Seiten. `y` = Höhe der
  äußersten Treppenreihe (Traufe inkl. Überstand), jede Reihe nach innen eine Ebene höher, hohe Seite zur
  Firstmitte. `gable`: gerade Breite → die zwei mittleren Reihen treffen sich; ungerade Breite → First aus
  unteren Stufen (`slab`), sonst `full` (sonst `Error`). Giebel an beiden Enden mit `full` gefüllt (nur Luft;
  ohne `full` → Warnung). `hip`: Ringe von außen nach innen, Ecken im Windrad-Muster → Außenecken, First wie
  bei `gable`. `pyramid`: wie `hip`, braucht eine quadratische Fläche (sonst `Error`). `flat`: eine Ebene
  `full`, sonst untere `slab`. `hollow: false` füllt den Raum unter dem Dach innerhalb der Wände mit `full`.
- `spiralStairs`: eine Treppe pro Ebene auf dem quadratischen Ring mit Abstand `radius` (8·radius Felder pro
  Umdrehung), Start an der Nordseite (cx, cz − radius) auf y1, facing = Laufrichtung; `core` füllt das
  Innere des Rings.
- `transform`: erst spiegeln, dann drehen, dann verschieben; verschachtelt wirkt der innere zuerst. Die
  Funktion muss synchron sein. `b.get()` liefert den Zustand in lokaler Ausrichtung.
- `BuildResult.offset` = kleinste Ecke in Modul-Koordinaten (Modul-Position = Ergebnis-Position + offset).
- `finalize()`: Auto-Verbindungen arbeiten auf den Zuständen des Moduls (fehlende Eigenschaften =
  Standardwert), danach `completeState` für alle Zustände und eine verdichtete Palette. Ohne Blockdaten:
  Warnung, Zustände bleiben unvollständig. Leerer Bau → Warnung „Der Bau enthält keine Blöcke.“

### 6.3 Auto-Verbindungen (`connections.js`)

Wie das Spiel beim Platzieren (außer bei `raw`):
- **Zäune** (`*_fence`): north/east/south/west = true, wenn Nachbar ein Zaun derselben Gruppe
  (Holz untereinander, Netherziegel nur mit Netherziegel), ein Zauntor quer dazu oder ein voller
  undurchsichtiger Block ist.
- **Mauern** (`*_wall`): Seiten `none|low|tall` (verbunden: `tall`, wenn direkt darüber ein voller
  Block oder eine Mauer ist, sonst `low`); `up` = false nur bei gerader Linie (nur N+S oder nur O+W)
  ohne Pfosten-Bedarf darüber. Verbindet zu Mauern, Scheiben/Gittern, Zauntoren quer, vollen Blöcken.
- **Glasscheiben, Eisen-/Kupfergitter** (`*glass_pane`, `*_bars`): verbinden zu Scheiben, Gittern,
  Mauern und vollen Blöcken.
- **Treppen-`shape`**: Logik von `StairBlock.getStairsShape` (vorne = Nachbar in facing-Richtung):
  ```
  vorne ist Treppe mit gleichem half und facing quer dazu, und canTakeShape(gegenüber von vorne.facing):
      vorne.facing == facing.gegenUhrzeiger ? outer_left : outer_right
  sonst hinten ist Treppe mit gleichem half und facing quer dazu, und canTakeShape(hinten.facing):
      hinten.facing == facing.gegenUhrzeiger ? inner_left : inner_right
  sonst straight
  canTakeShape(seite): Nachbar dort ist keine Treppe, oder hat anderes facing oder anderes half
  ```
- **Redstone-Staub** (`redstone_wire`): Seiten `none|side|up`. Verbindet zu Staub (gleiche Höhe;
  eine Stufe hoch = `up`, wenn über dem Staub kein voller Block ist; eine Stufe tiefer, wenn der
  Nachbarblock seitlich kein voller Block ist) und zu Bauteilen: Repeater/Beobachter nur entlang
  ihrer Achse bzw. Ausgangsseite, Komparator, Redstone-Fackel, Hebel, Knöpfe, Druckplatten,
  Tageslichtsensor, Redstone-Block, Zielblock, Redstone-Fackel an der Wand, Lesepult, Fallen-Truhe.
  Genau eine Verbindung → Gegenseite auch `side` (gerade Linie). Keine Verbindung → alle `side` (Kreuz).
- **Truhen** (`chest`, `trapped_chest`, Kupfertruhen): zwei benachbarte gleiche Truhen mit
  gleichem facing, nebeneinander quer zu facing → `type` left/right (Doppeltruhe).
- **Zauntore** neben Mauern quer zu ihrer Achse → `in_wall=true`.
- **Grasblock/Myzel/Podsol**: `snowy=true`, wenn darüber Schnee oder Schneeblock liegt.
- **Laub**: `persistent=true` (verrottet nicht).

Änderung (genauer wie im Spiel):
- „Voller Block“ ohne Renderer: `isFullSolid(id)` (Muster/Listen; Stufen, Treppen, Zäune, Mauern, Glas, Laub,
  Pflanzen, Fackeln, Türen, Falltüren, Teppiche, Schilder, Druckplatten, Knöpfe, Schienen, Leitern, Ketten,
  Gitter, Kerzen, Köpfe … sind nicht voll), `isFullSolidState(state)` (Doppelstufe voll, ausgefahrener Kolben
  nicht) und `isSturdyFull(id)` (zusätzlich durchsichtige volle Blöcke mit stabilen Seiten: Glas, Buntglas,
  Eis, Schleim, Leuchtfeuer, Spawner, Kupferrost, Mangrovenwurzeln; Änderung (Prüfung Kern/3D): auch Tresor `vault`).
- Zäune, Mauern und Scheiben verbinden wie im Spiel zu stabilen vollen Seiten: auch zu Glas/Eis, zur hohen
  Rückseite von Treppen (Innenecken: zwei Seiten) und zu Doppelstufen; nie zu Laub, Barriere, Kürbis, Melone.
- Mauern: `tall`, wenn der Block darüber die Seite abdeckt (voller Block, oder Mauer/Zaun/Scheibe mit derselben
  Seite verbunden), sonst `low`. `up` wie `WallBlock.shouldRaisePost`: Mauer mit Pfosten darüber → true;
  Ende/Ecke/T/allein → true; gerade Linie mit beiden Seiten `tall` → false; sonst nur true bei vollem Block,
  Zaun, Scheibe, senkrechter Kette/Endstab/Blitzableiter, Fackel, stehendem Schild/Banner, Druckplatte oder
  Stolperdraht darüber (Kreuzung ohne etwas darüber → kein Pfosten).
  Änderung (Prüfung Kern/3D, gegen `WallBlock` und den Tag `wall_post_override` aus dem 26.2-Jar): maßgeblich ist die
  Unterseite der **Kollisionsform** des Blocks darüber. Voll (→ Seite `tall`): volle Blöcke, untere und doppelte Stufen,
  untere Treppen, Teppiche, Laub, geschlossene untere Falltüren, Schnee ab 2 Schichten, Shulkerkisten, Ackerboden, Trampelpfad,
  Tageslichtsensor, Barriere, Endportalrahmen, Zaubertisch, Steinsäge, Lesepult, Lagerfeuer, Komposter, Sculk-Sensoren/-Kreischer;
  ein geschlossenes Zauntor deckt die beiden Arme in seiner Ebene. Nur die Mitte (→ Pfosten, wenn keine Regel davor greift):
  Zaun, Scheibe, Mauer, geschlossenes Zauntor, Truhen, stehende Laterne, Kerzen, Blumentöpfe, stehende Köpfe, Krug, Kuchen,
  Braustand, Amboss, Seegurke, Schildkröteneier, Seerose, Kaktus, Honigblock, Trichter nach unten, senkrechte Kette/Endstab/
  Blitzableiter. Der Tag zählt **alle** Schilder außer Hängeschildern (auch Wandschilder), **alle** Banner (auch Wandbanner),
  Druckplatten, Fackeln, Stolperdraht und `cactus_flower`.
- Redstone wie `RedStoneWireBlock`: nach oben, wenn der Nachbar Staub trägt (stabile Oberseite oder Falltür)
  und über dem eigenen Staub kein Leiter liegt; Wert `up` bei stabiler Nachbarseite, sonst `side`. Leiter =
  voller undurchsichtiger Block außer Beobachter, Redstone-Block, Kolben (Glas leitet nicht). Ein ausdrücklich
  gesetzter Punkt (alle vier Seiten `none`) bleibt ohne Verbindungen ein Punkt. Weitere Signalquellen:
  Stolperdrahthaken, Sensorschiene, Sculk-Sensoren, Blitzableiter.
- Truhen: nur gleiche ID paart; Änderung (Prüfung Kern/3D): Kupfertruhen paaren wie `CopperChestBlock.chestCanConnectTo`
  (Tag `copper_chests`) in jeder Oxidations- und Wachsstufe untereinander, jede Hälfte behält ihre Stufe (die Angleichung beim
  Setzen im Spiel, `getLeastOxidizedChestOfConnectedBlocks`, ist nicht nachgebildet). Truhen mit ausdrücklichem `type`
  (z. B. `type=single` = mit Schleichen gesetzt) bleiben unverändert. Paare in fester Reihenfolge (y, z, x),
  zuerst mit dem Nachbarn im Uhrzeigersinn von facing (dann ist die Truhe `left`). Schnee: auch Pulverschnee.

### 6.4 Schrittplan (`steps.js`)

- Reihenfolge der Kapitel wie im Modul. Kapitel mit `b.step()` → genau diese Schritte (Blöcke vor
  dem ersten `step()` bilden einen eigenen ersten Schritt).
- Kapitel ohne `b.step()` → ein Schritt pro belegter Ebene, von unten nach oben, `layerY = y`.
- Schritte haben keinen Titel und keinen Text; die Seite zeigt Nummer, Blockzahl und Ebene.
- Schrittnummern 0 … N−1 werden in `volume.steps` geschrieben (Wert 65535 ist reserviert).
- Pro Schritt: Blockzahl und Materialien.

### 6.5 Materialien (`materials.js`)

```js
itemForState(state)       // → { item, count } | null (null = nicht platzierbar/entsteht von selbst)
countMaterials(volume, step = null)   // → [[item, n], …] absteigend
stackSize(item)           // 64 Standard; 16 z. B. Schilder, Banner, Eier, Schneebälle, Enderperlen, Rüstungsständer; 1 z. B. Betten, Eimer, Boote, Loren
splitAmount(n, stack = 64)  // → { shulkers, stacks, rest }  (1 Shulkerkiste = 27 Stacks)
formatAmount(n, stack = 64) // → „2 Shulkerkisten, 5 Stacks und 12“ / „1 Stack und 3“ / „12“
```
Sonderfälle: Türen, Betten und doppelte Pflanzen nur einmal (unterer Teil bzw. Kopf); Doppelstufe
= 2 Stufen; Kerzen/Seegurken/Schildkröteneier/Schneeschichten nach Anzahl; `redstone_wire` →
`redstone`; Wand-Varianten → Grundgegenstand (`wall_torch` → `torch`, `*_wall_sign` → `*_sign`,
`*_wall_banner`, `*_wall_head`/`*_wall_skull`, `redstone_wall_torch`, `soul_wall_torch`);
Feldfrüchte → Saatgut/Frucht (`wheat` → `wheat_seeds`, `carrots` → `carrot`, `potatoes` → `potato`,
`beetroots` → `beetroot_seeds`, `melon_stem` → `melon_seeds`, `pumpkin_stem` → `pumpkin_seeds`,
`cocoa` → `cocoa_beans`, `sweet_berry_bush` → `sweet_berries`, `cave_vines*` → `glow_berries`,
`torchflower_crop` → `torchflower_seeds`, `pitcher_crop` → `pitcher_pod`); `*_plant`-Stängel
(Seetang, Ranken) → Grundgegenstand; `potted_<pflanze>` → `flower_pot` + Pflanze;
`water` → `water_bucket` (nur Quellen, level=0), `lava` → `lava_bucket`; `farmland` → `dirt`
(Hinweis „mit Hacke bearbeiten“), `dirt_path` → `dirt` („mit Schaufel“);
`null` für `air`, `piston_head`, `moving_piston`, `fire`, `soul_fire`, `nether_portal`,
`end_portal`, `end_gateway`, `bubble_column`, `frosted_ice`.

Änderung: `itemForState` liefert optional `extra: [[item, n], …]` (zweiter Gegenstand: Blumentopf + Pflanze,
Kessel + Eimer, Kuchen + Kerze) und `hint` (z. B. „Erde mit einer Hacke bearbeiten“). Weitere Regeln:
Blütenblätter/Wildblumen/Laubstreu nach Anzahl; Leuchtflechte, Sculk-Ader, Harzklumpen, Ranken nach Anzahl
der Seiten; `tall_seagrass` → `seagrass`; `*_cauldron` → `cauldron` + Eimer; `*candle_cake` → `cake` + Kerze;
`big_dripleaf_stem` → `big_dripleaf`; `bamboo_sapling` → `bamboo`; `powder_snow` → `powder_snow_bucket`;
`tripwire` → `string`; alle `*_wall_*`-Varianten (auch Wandfächer, hängende Wandschilder). `formatAmount` bei
Stapelgröße 1: nur die Zahl. Zusätzlich `materialsFromPaletteCounts`, `addItems`, `sortMaterials`
(gleich viele → nach ID).

### 6.6 Beschreibungen (`describe.js`)

```js
setNames(namesJson)
blockName(id) / itemName(id)     // deutscher Name, sonst englisch, sonst ID
describeState(state)             // → { name, id, detail }  z. B. detail „hohe Seite nach Norden, unten“
```
Texte nutzen die Bedeutungen aus §4 (z. B. Repeater: „Signal läuft nach Norden, 2 Ticks“).
Änderung: zusätzlich `blockLabel(id)` → „Steinziegel · minecraft:stone_bricks“. `detail` ist `''`, wenn es
nichts zu sagen gibt.
Änderung (Prüfung Kern/3D): Wandvarianten ohne eigenen Sprachschlüssel (in 26.2 die 16 Wandbanner) heißen wie im Spiel
(`overrideDescription`) wie der stehende Block, z. B. `white_wall_banner` → „Weißes Banner“; dafür ist `wallVariantBase(id)`
aus `materials.js` exportiert. Stehende Köpfe beschreibt `detail` nach §4 (rotation 0 = Gesicht nach Norden).

## 7. Rendering (`js/render/`)

### 7.1 Modelle zur Laufzeit (`block-models.js`, `special-models.js`, `tints.js`)

```js
class BlockModels {
  constructor(modelsJson, blockData)
  textureNames(states)          // → Set<string> aller nötigen Texturen (inkl. Sondermodelle/Regionen)
  bindTextures(map)             // Map<name, { layer, alpha: 'opaque'|'cutout'|'translucent' }>
  quads(stateFull, x, y, z)     // → Quad[] (Zufallsvariante per Positions-Hash, gewichtet)
  isOpaqueFullCube(stateFull)   // volles Element 0..16, alle 6 Flächen mit cullface und deckend
  cullsSameType(stateFull)      // Glas-Glas, gleiches Buntglas, Eis, Wasser, Laub gleicher Art
}
// Quad (Positionen blocklokal 0..1, UV in Texeln 0..16):
{ dir, cull, pos: Float32Array(12), uv: Float32Array(8), tex, tint /* 0xRRGGBB | -1 */,
  shade /* bool */, emissive /* bool */, layer /* solid|cutout|translucent */, normal: [x,y,z] }
```
- Modell-Drehung x/y in 90°-Schritten, `uvlock`, Element-Drehung (inkl. `rescale`), UV-`rotation`,
  `cullface` nach Drehung.
- Schattierung wie im Spiel: `min(nx²·0.6 + ny²·(3+ny)/4 + nz²·0.8, 1)` (oben 1, unten 0.5,
  N/S 0.8, O/W 0.6); `shade:false` → 1.
- Sondermodelle (keine JSON-Elemente im Spiel): Truhen (normal, Falle, Ender, Kupfer; einzeln/doppelt),
  Betten, Schilder (stehend, Wand, hängend), Shulkerkisten, Banner (Grundfarbe), Köpfe/Schädel,
  Glocke, verzierter Krug, Aquisitor, Endportal/Endtransitportal (dunkel), Wasser/Lava
  (Höhe 14/16 an der Oberfläche, sonst voll; Wasser-Einfärbung `0x3F76E4`, Lava leuchtet),
  wassergeflutete Blöcke bekommen zusätzlich Wasser. Unsichtbar: `air`, `light`, `barrier`,
  `structure_void`. Unbekannt ohne Elemente → Würfel mit `particle`-Textur.
- Ausschnitte aus Entity-Texturen als „Regionen“: Name `region:<textur>:<x>,<y>,<w>,<h>`;
  `texture-store.js` skaliert sie pixelgenau auf eine 16×16-Ebene.
- Einfärbung (feste Ebene-Biom-Werte): Gras `0x91BD59`, Laub `0x77AB2F`, Birke `0x80A755`,
  Fichte `0x619961`, Mangrove `0x8DB127`, Wasser `0x3F76E4`, Seerose `0x208030`,
  Redstone nach `power`, Stängel nach `age`.
- Leuchtende Blöcke (`emissive`): Tabelle (Leuchtstein, Seelaterne, Laternen, Fackeln, Pilzlicht,
  Froschlichter, Lava, Feuer, Redstone-Lampe `lit=true`, Kerzen `lit=true` …) plus `light` aus Modellen.

Änderung (Schnittstelle, umgesetzt):
```js
new BlockModels(modelsJson, blocksJson | null) // blocksJson ergänzt fehlende Eigenschaften; null → Daten aus js/core/block-data.js (falls geladen)
models.textureNames(states)      // → Set<string>, auch 'missingno', Regionen, Flüssigkeiten (water_still/_flow/_overlay, lava_still/_flow)
models.bindTextures(map)         // Map aus TextureStore.prepare (layer, alpha, mask …); neu binden leert die Caches
models.quads(stateFull, x, y, z) // → Quad[] (gecacht pro Zustand + Variante, nicht verändern); vorher bindTextures, sonst Error
models.renderInfo(state)         // für den Mesher: { opaqueFull, aoOccluder, sideCover[6] (16×16-Raster), fullSides, cullSame,
                                 //   glassLike, solidForFluid, fluid, emission, ao, invisible, quadsAt(x, y, z) }
models.isOpaqueFullCube(s) / cullsSameType(s) / lightEmission(s) / fluidOf(s) / textureLayer(name) / warnings / bindVersion / isBound
```
Quad zusätzlich: `texture` (Name), `dirIndex`, `cullIndex`, `layerIndex`, `shadeValue`, `useAo`, `boundary`, `mergeable`,
`faceAB`, `uvBase`, `coverMask` (Hilfswerte für den Mesher).
- Änderung: Schicht pro Fläche wie 26.2 (§7.3): `translucent: true` → translucent, sonst Alpha-Klasse des UV-Rechtecks
  (`rectAlphaClass`). Damit sind Glas, Buntglas, Scheiben, Redstone-Staub, Eis, Schleim, Honig und getöntes Glas translucent,
  Laub und Spawner cutout (Glas also nicht cutout).
- Änderung: Modell-Drehung wie `BlockModelRotation` (`rotateYXZ(−y, −x, −z)`), uvlock wie `FaceBakery`: UV je Vertex mit der
  inversen Flächen-Transformation (`BlockMath.getFaceTransformation`) um die Mitte gedreht. Passen mehrere Varianten, gilt die
  letzte (wie im Spiel). Schattierung gedrehter Flächen nach der nächstliegenden Richtung (`calculateFacing`).
- Änderung Sondermodelle: Maße und UV-Layout als Tabellen in `special-models.js` nach ChestModel, ShulkerModel, BannerModel/
  BannerFlagModel, SkullModel, PiglinHeadModel, DragonHeadModel, BellModel, DecoratedPotRenderer, ConduitRenderer. Deckel von
  Truhe/Shulkerkiste 1/16 Pixel größer (gegen Flimmern auf gleicher Ebene). Betten und Schilder kommen aus JSON. Vereinfacht:
  Banner nur Grundfarbe (keine Muster), Krug ohne Scherben, Aquisitor ruhend (Schale), Kiefer/Ohren in Ruhestellung,
  Endportal/-transitportal mit `block/black_concrete` (kein Sternen-Shader). Glocke = JSON-Gestell + Körper. `moving_piston`
  unsichtbar, `bubble_column` = Wasserquelle. Kupfergolem-Statuen: Entity-Textur fehlt in textures.bin → Ersatzwürfel (Warnung).
  Änderung (render:viewer): nur der **Truhen**deckel ist 1/16 Pixel größer; der Shulkerkisten-Deckel bleibt exakt wie im Spiel –
  seine Zacken greifen in die des Unterteils (deckende Texel überlappen nie), vergrößert entstanden helle Haarrisse an den Kanten.
- Änderung Flüssigkeiten: entstehen im Mesher (brauchen Nachbarn): Ecken wie `LiquidBlockRenderer.calculateAverageHeight`,
  Quelle 14/16, fließend amount/8 · 14/16, gleiche Flüssigkeit darüber → voll; Seiten mit `*_flow` (linkes oberes Viertel), neben
  Glas/Laub `water_overlay`; eine volle eigene Seite (z. B. obere Stufe) verdeckt das Wasser; Flächen 1/256 eingerückt.
  Immer wassergeflutet: Seetang, Seegras, hohes Seegras, Blasensäule.
- Änderung Einfärbung: zusätzlich Laubstreu `0xA37546` (dry_foliage der Ebene), Busch/Farn/Zuckerrohr → Gras, Rosa Blüten/
  Wildblumen nur tintindex 1 (Stängel), Wasserkessel → Wasser, angewachsene Stängel `0xE0C71C`. Ohne Tönung (BlockColors
  registriert sie nicht): Kirsch-, Blasseichen- und Azaleenlaub, Bambus, Steinsäge, Lava-/Pulverschneekessel. Redstone in
  Java-float-Rechnung (Stärke 0 = `0x4C0000`, 15 = `0xFF3200`).
- Änderung Leuchten: `lightEmission` je Zustand wie im Spiel; `emissive` ab Licht 3 (Block oder Modell-Element). Blöcke mit
  Licht > 0 bekommen wie im Spiel kein AO.

### 7.2 Mesher (`mesher.js`) – reine Funktionen, in Node testbar

```js
meshChunk(ctx, cx, cy, cz)   // → { solid, cutout, translucent }  statisches Mesh mit show/hide
meshStep(ctx, step)          // → { solid, cutout, translucent }  Blöcke des laufenden Schritts (alle sichtbaren Flächen, mit centers)
meshCap(ctx, y)              // → { solid, cutout, translucent }  Deckflächen der Ebene y für die Schnittansicht
// ctx = { volume, models }     MeshData = { vertices: ArrayBuffer, quadCount, centers?: Float32Array }
```

**Sichtbarkeit beim schrittweisen Aufbau:** Jede Fläche trägt `show` (Schritt ihres Blocks) und
`hide` (Schritt, ab dem sie verdeckt ist; 65535 = nie). Laufender Schritt `cur`:
statische Fläche sichtbar ⇔ `show < cur && hide >= cur`. Der laufende Schritt selbst kommt aus
`meshStep` (Blöcke „ploppen“ auf). Fläche zu einem verdeckenden Nachbarn mit Schritt ≤ eigenem Schritt
→ gar nicht ausgeben (Ausnahme: Deckflächen holt `meshCap`). Späterer Nachbar → `hide = nachbarSchritt`.
Verdeckend = `isOpaqueFullCube` oder `cullsSameType`.

**Greedy-Meshing** nur für Flächen voller Würfel, zusammengelegt nur bei gleicher Ebene, Tönung,
Licht an allen 4 Ecken, UV-Drehung, show, hide und Flags. Ambient Occlusion pro Ecke aus dem
Endzustand (Seite1, Seite2, Ecke): Stufen `[0.45, 0.65, 0.82, 1.0]`; Diagonale tauschen, wenn
`a00 + a11 < a01 + a10`.

**Vertex-Format (24 Byte, little-endian), 4 Vertices pro Quad, gemeinsamer Index-Puffer
`0,1,2, 0,2,3` je Quad:**

| Byte | Typ | Inhalt |
|---|---|---|
| 0–5 | 3×uint16 | Position chunk-lokal × 256 (0 … 4096) |
| 6–7 | uint16 | Textur-Ebene |
| 8–11 | 2×uint16 | UV in 1/64 Texel (16 Texel = 1024; Kacheln wiederholen sich, REPEAT) |
| 12–14 | 3×uint8 | Tönung RGB (255,255,255 = keine) |
| 15 | uint8 | Licht = Schattierung × AO (0 … 255) |
| 16–17 | uint16 | show |
| 18–19 | uint16 | hide |
| 20 | uint8 | Bit 0 leuchtend; Bits 4–7 Block-y im Chunk (0 … 15) |
| 21–23 | – | reserviert (0) |

`meshStep` liefert zusätzlich `centers` (4 Float32 pro Vertex: Blockmitte x, y, z chunk-unabhängig
in Weltkoordinaten, Reihenfolge 0 … 1 innerhalb des Schritts) für die Plopp-Animation.

- Änderung Position: **3×int16** (vorzeichenbehaftet) statt uint16, Wert sonst gleich (chunk-lokal × 256). Modelle ragen über
  den Block (Feldfrüchte 1/16 darunter, Wandfackeln, Korallenfächer, Banner bis 1,83 Blöcke hoch, Wandbanner fast 1 Block
  darunter, Drachenkopf) – auch unter 0. Shader: `vertexAttribPointer(loc, 3, gl.SHORT, false, 24, 0)`, dann `/ 256.0`.
- Änderung Verdeckung: zusätzlich (wie `Block.shouldRenderFace`) die **deckende Gegenseite**: das 16×16-Raster der deckenden
  (solid) Flächen des Nachbarn auf seiner Gegenseite deckt das Rechteck der Fläche ganz ab (Treppen-Rückseite, Stufen und
  gleich gedrehte Treppen nebeneinander). Gleiche Art nach Spielregeln: Scheiben/Gitter oben/unten und an beidseitig verbundenen
  Seiten, Mangrovenwurzeln nur oben/unten. Flüssigkeiten verdecken sich gleichartig (mit show/hide wie Blöcke).
- Änderung Greedy: nur Flächen auf der Blockgrenze, die die ganze Seite mit einer ganzen Kachel bedecken (eine der 8 Lagen);
  alle solchen Flächen eines Blocks auf derselben Seite (z. B. Gras + Overlay) werden gemeinsam zusammengelegt, nur bei
  gleichmäßigem Licht (alle 4 Ecken gleich). Seitenflächen nur entlang einer Zeile, damit Block-y je Vertex stimmt.
  Zufallsvarianten (Stein, Gras …) verbinden sich nur bei gleicher Variante.
- Änderung `meshStep`: Flächen zu Nachbarn **im selben Schritt** bleiben (Plopp ohne Lücken), verdeckt nur durch frühere
  Schritte; show = Schritt, hide = 65535; nicht zusammengelegt. Positionen chunk-lokal zum Chunk des **Blocks** → im Shader
  `origin = floor(center.xyz / 16.0) * 16.0`, Welt = origin + pos / 256.
- Änderung `meshCap`: Oberseiten der Ebene y, die ein Block darüber verdeckt (egal in welchem Schritt), ohne AO (Licht =
  Schattierung), show = Schritt des Blocks, hide = 65535, zusammengelegt; Flüssigkeit unter gleicher Flüssigkeit → volle
  Oberfläche. Liefert ebenfalls `centers` (Reihenfolge 0, gleicher Shader wie meshStep). Liegt genau auf den verdeckten
  Flächen → nach dem Chunk-Mesh mit `polygonOffset(-1, -1)` zeichnen.
- Änderung Zusätze: `ctx.ao` (Standard true), `createQuadIndices(n)` (Uint32Array, Chunks können > 16 384 Quads haben),
  `decodeVertex(mesh, i)`, `resetMeshCache(volume)` (nach Änderungen am Volumen; Schritt-Listen und Paletten-Infos sind je
  Volumen gecacht), Konstanten `VERTEX_BYTES`, `QUAD_BYTES`, `HIDE_NEVER`, `AO_LEVELS`. Leere Schicht → `vertices.byteLength` 0.

### 7.3 Texturen (`texture-store.js`)

```js
TextureStore.load(baseUrl = 'game-data/')   // → Promise<TextureStore>, lädt textures.json + textures.bin
store.has(name) / store.info(name)
store.prepare(gl, names)   // → Promise<Map<name, { layer, alpha }>>  nur benötigte Texturen; Animationen: eine Ebene, CPU tauscht Frames im 20-Hz-Takt (texSubImage3D)
store.tick(gl, timeMs)     // Animationen weiterschalten
store.iconDataUrl(itemOrBlockId, models) // → Promise<string> Icon (Item-Textur, sonst isometrischer Block)
```
TEXTURE_2D_ARRAY, 16×16, Mipmaps, `NEAREST` beim Vergrößern. Alpha-Klasse aus den Pixeln:
alles 255 → opaque; nur 0/255 → cutout; Zwischenwerte → translucent.

Änderung (Schnittstelle, Stand der Umsetzung):
```js
TextureStore.load(baseUrl = 'game-data/', { layerSize = 32 })  // je ein fetch für textures.json und textures.bin
store.has(name) / store.info(name) / store.names() / store.image(texture)   // name: Textur | 'region:<textur>:<x>,<y>,<w>,<h>' | 'missingno'
store.prepare(gl, names)   // → Promise<Map<name, { layer, alpha, mask, maskWidth, maskHeight, animated, missing }>>
                           //   Ebenen bleiben je Kontext stabil, weitere prepare-Aufrufe hängen nur Neues an
store.tick(gl, timeMs)     // → true, wenn Ebenen neu hochgeladen wurden (Tick = 50 ms)
store.bind(gl, unit = 0) / store.texture(gl) / store.dispose(gl) / store.stats(gl) / store.readLayer(gl, layer, level)
store.layerSize / store.levelCount                       // 32 / 6
store.iconDataUrl(id, faceTextures = null, { size = 64 }) // → Promise<string> data:-URL (PNG); iconImage(…) → RGBA
rectAlphaClass(entry, u0, v0, u1, v1)                    // Alpha-Klasse eines UV-Rechtecks (UV 0 … 16)
```
- Änderung: Ebenen **32×32** (6 Mip-Stufen 32 … 1) statt 16×16. 16×16-Texturen werden pixelgenau verdoppelt
  (sehen gleich aus, Stufe 1 = Original); 32×32-Texturen behalten die volle Auflösung (in 26.2 Schilder,
  Hängeschilder, Regale, Ghast-Tentakel – deren Modelle nutzen halbe UV-Einheiten wie `[1,1.5,2.5,2]`).
  Das Vertex-UV-Format (1/64 Texel, 16 Texel = 1024) bleibt; Shader tasten mit normierten UV ab (`uv / 1024.0`),
  nie mit festen Texelgrößen rechnen.
- Änderung: Mipmaps auf der CPU genau wie `MipmapGenerator` 26.2: lineares Mitteln über die sRGB-Tabellen des Spiels;
  `mip`-Strategien `mean`, `cutout`, `strict_cutout` (Alpha-Test 0,3), `dark_cutout` (Laub: transparente Pixel = ¾ der
  dunkelsten Farbe, transparente Nachbarn zählen als Schwarz); ohne `mip` = `auto` (cutout, wenn ein Pixel Alpha 0 hat,
  sonst mean). Bei cutout bleibt die Abdeckung des Alpha-Tests erhalten (Binärsuche, +0,025), transparente Pixel bekommen
  die Farbe des nächsten sichtbaren Pixels (`solidify`, nicht bei `item/…`). Filter `NEAREST_MIPMAP_LINEAR`, `REPEAT`.
  Optionales Feld `bias` je Textur = `alpha_cutoff_bias` (0,1 bei cactus_side, cactus_top, kelp, kelp_plant, tripwire –
  der Extrakt schreibt es noch nicht, Standard 0).
- Änderung: PNGs liest ein eigener Decoder (`DecompressionStream`, alle Farbtypen/Bittiefen, Adam7) statt
  `createImageBitmap`: der 2D-Canvas multipliziert Alpha vor und verliert die Farbe voll transparenter Pixel, die z. B. die
  Glas-Mipmaps (`mean`) mitteln. Läuft so auch in Worker und Node; im Browser gegen `createImageBitmap` geprüft.
- Änderung: Animationen wie `SpriteContents.AnimationState`: Frame-Liste in Ticks ab Tick 0; `interpolate` mischt alle
  Kanäle (auch Alpha) mit `trunc(subFrame/time·1000)/1000` auf jeder Mip-Stufe; Mipmaps über den ganzen Frame-Streifen
  wie im Spiel. Eine Ebene je animierter Textur.
- Änderung: Regionen (x, y, w, h in Pixeln innerhalb eines Frames) werden pixelgenau (nächster Nachbar, Pixelmitte) auf
  32×32 skaliert, bei animierten Texturen je Frame; UV 0 … 16 der Fläche = ganze Region. Ganze Texturen, die nicht
  quadratisch mit Zweierpotenz sind, ebenso; größere quadratische (64×64 …) über die Spiel-Mipmaps verkleinert.
- Änderung: unbekannte oder ungültige Namen → eingebaute Fehltextur (Magenta/Schwarz wie `MissingTextureAtlasSprite`),
  `missing: true`, eine Sammel-Warnung in der Konsole. Mehr Ebenen als `MAX_ARRAY_TEXTURE_LAYERS` → Error
  „Zu viele Texturen: N Ebenen nötig, die Grafikkarte erlaubt höchstens M (MAX_ARRAY_TEXTURE_LAYERS).“ (vor dem Dekodieren).
  Nach Kontextverlust wird die Textur beim nächsten `prepare`/`bind`/`tick` aus dem CPU-Spiegel neu angelegt.
  Änderung (Integration Runde 2): wächst die Kapazität (weiterer `load` im selben Viewer), wird die alte Textur erst nach dem
  Anlegen der neuen gelöscht, und war sie gebunden, bleibt danach die neue gebunden. Vorher band `withUploadState` die schon
  gelöschte Textur zurück → `INVALID_OPERATION` 1282, `load` lehnte ab („WebGL-Fehler beim Hochladen der Texturen“).
  Änderung (render:viewer): den Kontextverlust merkt sich der Store über das Ereignis `webglcontextlost` am Canvas des Kontexts
  (`gl.canvas`, auch OffscreenCanvas) statt bei jedem `bind`/`tick` `gl.isTexture` zu fragen – das ist in Chrome ein synchroner
  GPU-Aufruf und kostete ~5 ms je Bild. Ohne Canvas (Ersatz-Kontexte in Tests) bleibt die Prüfung mit `isTexture`.
- Änderung: Render-Ebene in 26.2 **pro Fläche**: `FaceBakery` nimmt die Transparenz des UV-Rechtecks der Fläche
  (`SpriteContents.computeTransparency`, floor/ceil auf Pixel, über alle Frames) und `ChunkSectionLayer.byTransparency`
  (halbtransparent → translucent, sonst transparent → cutout, sonst solid); `translucent: true` am Modell erzwingt translucent.
  Dafür liefert `prepare` je Textur `mask` (Uint8Array maskWidth×maskHeight, Bit 1 = Alpha 0, Bit 2 = Alpha 1 … 254) und
  `rectAlphaClass(entry, u0, v0, u1, v1)` rechnet es wie im Spiel nach. Alpha-Test im Spiel: cutout 0,5, durchscheinend 0,1.
- Änderung: `iconDataUrl(id, faceTextures, { size })` statt `(itemOrBlockId, models)` – ohne Abhängigkeit von
  block-models.js: `item/<id>` flach; sonst `faceTextures.flat` flach (z. B. Fackel `block/torch`); sonst isometrischer
  Block aus `faceTextures { up, north, east, height? }` (je Texturname, `{ texture, tint }` oder Liste davon, z. B.
  Gras-Seite + getöntes Overlay; `height` 0,5 für Stufen); sonst `block/<id>` auf allen Seiten; sonst Error.
  Ansicht wie das Inventar (Drehung 30°/225°, Maßstab 0,625): Ostseite links ×0,6, Nordseite rechts ×0,8, oben ×1,0.

### 7.4 Viewer (`renderer.js`), Steuerung, Picking, Worker

```js
const viewer = new Viewer(canvas, { onPick, onHover, onStatus })
await viewer.load(source, params)  // source: { kind:'module', path } | { kind:'structure', file } | { kind:'shape', shape, params }
viewer.result                       // BuildResult-Kopie (ohne Volume-Arrays-Doppelung im Hauptthread)
viewer.setProgress(p)               // p = Schritt als Kommazahl (12.4 = Schritt 12 zu 40 %)
viewer.setClip({ minY, maxY } | null)
viewer.setGhost(bool)               // künftige Blöcke durchsichtig zeigen
viewer.setHighlightStep(index | null)
viewer.setMode('orbit' | 'walk')
viewer.setView('iso' | 'top' | 'front' | 'side')
viewer.screenshot()                 // → Promise<Blob>
viewer.dispose()
```
- Bauen und Meshen laufen im Modul-Worker `engine-worker.js` (Hauptthread bleibt flüssig).
  Der Hauptthread behält eine Kopie des Volumens für Picking und Ebenen-Plan.
- Orbit: Ziehen = drehen, Rechtsziehen/zwei Finger = verschieben, Rad/Pinch = zoomen, Pfeiltasten.
- Laufen wie im Spiel: WASD, Maus (Pointer Lock), Leertaste springen, doppelt Leertaste = fliegen,
  Shift runter/schleichen, Strg sprinten, Esc beenden; Werte wie Java (Gehen 4,317 Blöcke/s,
  Sprinten 5,612, Fliegen 10,92, Sprung ≈ 1,25 Blöcke, Spieler 0,6 × 1,8, Augen 1,62).
  Touch: Joystick links, Blicken rechts, Knöpfe Springen/Fliegen/Hoch/Runter.
- 60 FPS anpeilen: Frustum-Culling pro Chunk, nur sichtbare Flächen, Greedy-Meshing.
- Änderung (Schnittstellen der Grundbausteine, umgesetzt):
  ```js
  // controls.js – Klassen pro Bild mit update(dtMs) aufrufen, danach viewMatrix(out) bzw. eye(out) lesen
  new OrbitControls(element, { target, distance, yaw, pitch /* Bogenmaß, yaw 0 = Kamera im Süden */, minDistance, maxDistance, fovY, onChange, onTap })
    // .update(dtMs) → bool · .viewMatrix(out) · .eye(out) · .orbit · .setView(view, { animate }) · .setHome(view) · .enabled · .fovY · .dispose()
  new WalkControls(element, { world: { collisionBoxes(x, y, z) }, position /* Füße */, yaw, pitch /* Grad wie im Spiel: yaw 0 = Süden */,
                              flying, mayFly, voidY = -64, sensitivity = 0.15, overlayParent, onExit, onChange })
    // .update(dtMs) → bool · .viewMatrix(out) · .eye(out) · .player · .teleport(pos, { yaw, pitch, flying }) · .enabled · .requestPointerLock() · .dispose()
  // rein (Node): tickPlayer, createPlayer, collideMovement, createOrbit, orbitEye/Pan/Zoom/Rotate, orbitFitDistance, createDoubleTap …
  // picking.js
  raycastBlocks(origin, direction, maxDistance, isHit) // → { x, y, z, face, normal, distance, point, inside } | null
  rayFromScreen(invViewProj, ndcX, ndcY)              // → { origin, direction }
  // mat.js: mat4 (create, identity, copy, multiply, fromTranslation, perspective (far = Infinity erlaubt), ortho, lookAt,
  //         invert, transformPoint/Direction/Vec4), vec3, frustumPlanes(out, viewProj), aabbInFrustum(planes, …)
  ```
  `collisionBoxes(x, y, z)` liefert die Boxen des Blocks blocklokal `[x1, y1, z1, x2, y2, z2]` (x/z 0 … 1, y bis 1,5 für
  Zäune/Mauern) oder null. Bewegung Tick für Tick wie Java (`LivingEntity.travel`, `Entity.collide`: Stufen über die
  Kandidaten-Höhen bis 0,6, Schleichen hält an Kanten, Sprint-Sprung +0,2, Landen beendet das Fliegen, Fliegen einschalten
  am Boden springt ab); gezeichnet interpoliert. Änderung: Fliegen ergibt mit der Java-Formel 10,89 Blöcke/s
  (0,05 · 0,98 / 0,09 · 20; die oft zitierten 10,92 sind gemessen), senkrecht 7,5. Esc ohne Pointer Lock → `onExit`.
  Pfeiltasten drehen/neigen im Lauf-Modus den Blick (Tastatur ohne Maus). Strg+W schließt Browser-Tabs und lässt sich nicht
  abfangen: solange Strg gehalten wird, fragt ein `beforeunload`-Wächter nach; Sprinten geht auch per Doppeltipp W.
  Touch-Steuerung (`.walk-touch`, Knöpfe mit `.btn` und aria-label) erscheint nach der ersten Touch-Eingabe bzw. bei
  `(pointer: coarse)`; Knöpfe lösen beim Drücken aus.
- Änderung (render:viewer, Viewer umgesetzt – Ergänzungen zur API oben):
  ```js
  new Viewer(canvas, { onPick, onHover, onStatus, onProgress, onModeChange, overlayParent, antialias = 'auto' })
    // wirft ViewerError (code 'no-webgl2' | 'webgl' | 'argument'); antialias: 'auto' | true | false
  viewer.load(source, params) // → Promise<BuildResult>; zusätzlich Testquellen { kind:'gallery', group, page } | { kind:'synthetic', count }
                              // Ein neuer load bricht den alten ab: dessen Promise lehnt mit ViewerError code 'cancelled' ab (ignorieren).
  viewer.setProgress(p, { animate = false })  // 0 … stepCount; animate läuft mit 900 ms je Schritt hin (prefers-reduced-motion: springt)
  viewer.setClip({ minY?, maxY? } | null)     // ganze Block-y; fehlende Grenze = offen
  viewer.setView(view, { animate = true })    // passt die Box mittig ins Bild (orbitForView)
  viewer.idle()                               // → Promise<boolean>: nichts mehr unterwegs und Bild gezeichnet (für Fertig-Signale)
  viewer.screenshot({ type = 'image/png', quality })
  viewer.result · stepCount · progress · clip · ghost · highlightStep · mode · ready · hover · bounds · controls { orbit, walk } · stats
  // reine Helfer (Node): splitProgress(p, n) → { cur, frac } · isStepShown(step, cur, frac) · sceneBounds(volume.bounds)
  //                      fitOrbitDistance(…) · orbitForView(view, bounds, aspect) · VIEWS · MODES · ORBIT_FOV · WALK_FOV
  ```
  - Fortschritt: `p = 12.4` → Schritte 0 … 11 fertig, Schritt 12 zu 40 % (seine Blöcke ploppen nach Reihenfolge y, z, x auf:
    Start bei `order · 0,7`, Dauer 0,3 des Schritts, EaseOutBack). `p = n` (stepCount) = fertiger Bau (Standard nach load).
    „Schritt i zeigen“ in der UI = `setProgress(i + 1, { animate: true })`.
  - Ereignisse: `onStatus({ state, message, progress })` mit state `loading` | `building` | `textures` | `meshing` | `ready` |
    `error` | `context-lost` | `restoring`; `onHover(hit | null)` und `onPick(hit | null)` mit
    `hit = { x, y, z, face, normal, point, distance, state, step, index }` (nur gesetzte, nicht weggeschnittene Blöcke; Klick ohne
    Ziehen, im Lauf-Modus der Block im Fadenkreuz bis 6 Blöcke); `onProgress(p)` (auch während der Animation);
    `onModeChange(mode)` (z. B. nach Esc im Lauf-Modus). Fehler in diesen Rückrufen landen in der Konsole.
  - Geist: künftige Blöcke (Schritt > laufender, laufender Schritt vor dem Ploppen) mit den Flächen des fertigen Baus
    (`hide = 65535`), erst Tiefe, dann halbdurchsichtig – nur die vorderste Geist-Fläche ist zu sehen. Ein hervorgehobener
    künftiger Schritt erscheint auch ohne Geist-Modus als goldener Geist (Flächen mit `hide > Schritt`), ein gebauter golden getönt
    (Puls; ohne bei prefers-reduced-motion).
  - Schnitt: Block-y aus den Flags, Deckflächen über `meshCap(maxY)`; unten (minY) gibt es keine Deckflächen.
  - Reihenfolge je Bild: Himmel → solid → cutout (Alpha 0,5) → Umriss unter dem Zeiger → Bodenraster → translucent (Alpha 0,1,
    Chunks von hinten nach vorne, ohne Tiefenschreiben) → Geist → Fadenkreuz (Lauf-Modus). Nebel ab Abstand + 1,5 · Radius.
    Gezeichnet wird nur, wenn sich etwas ändert (Kamera, Animation, animierte Texturen, Puls).
  - Leistung: Kantenglättung über einen eigenen 4×-MSAA-Framebuffer (RGB8 + Tiefe, danach blit in die Canvas), bei
    `antialias: 'auto'` nur bis 1,5 Mio. Bildpunkte der Canvas – gemessen auf der Intel UHD 770 mit 300 000 Blöcken: 1080p mit
    MSAA ~48 FPS mit Rucklern, ohne stabil 144 FPS (Bildrate von headless Chrome); 1280 × 800 mit MSAA ~110 FPS. Ist der
    Framebuffer unvollständig oder scheitert das erste Auflösen, geht es ohne MSAA weiter. Die deckende Schicht nutzt ein
    eigenes Programm ohne `discard`. `store.bind()` nur nach `prepare` und nach Kontextverlust (die Bindung auf Einheit 0
    bleibt sonst stehen; jedes bind() prüfte früher mit `gl.isTexture`, in Chrome ein synchroner GPU-Aufruf, ~5 ms je Bild).
  - Laufen: Start 3 Blöcke südlich des Baus mit Blick nach Norden; virtueller Boden unter dem Bau (Höhe des Rasters);
    Kollision nur mit gesetzten, nicht weggeschnittenen Blöcken.
  - Worker-Protokoll (`engine-worker.js`, intern): Hauptthread → `load { job, source, params }`, `textures { job, map }`,
    `step { job, step }`, `cap { job, y }`, `remesh { job }`; Worker → `status`, `built { result, volume (Transfer), textureNames,
    buildMs }`, `palette { collision, outline, pickable }`, `chunks { chunks: [{ cx, cy, cz, minStep, solid, cutout, translucent }],
    done, total }`, `meshed { chunks, quads, meshMs, warnings }`, `step`, `cap`, `error { request, code, message, detail }`.
    Ein neuer `load` macht ältere Jobs ungültig. Strukturen werden über den Builder gebaut (`raw`, ein Kapitel „Aufbau“ in
    Ebenen), Bau-Module per dynamischem import (Pfad nur `js/builds/…` oder `tests/fixtures/…`).
  - Kollision fürs Laufen (Worker, je Palette): Säulen-Verfahren über die waagrechten, nicht gedrehten Modellflächen (1/16-Raster,
    oberste Ober- und unterste Unterseite) → Boxen; Sondermodelle = Umriss ihrer Flächen; Zäune, Mauern, geschlossene Zauntore
    1,5 hoch; ohne Kollision: Pflanzen (gedrehte/flache Flächen), Fackeln, Schilder, Banner, Knöpfe, Druckplatten, Schienen,
    Redstone, Stolperdraht, Feuer, Portale, Spinnennetz, Pulverschnee, Flüssigkeiten, offene Zauntore; Barriere = voller Block.
  - Formen: `{ kind:'shape', shape, params }` lädt `js/create/shape-generators.js` und ruft dessen
    **`buildShape(b, shape, params)`** auf (baut in den übergebenen Builder, wirft verständliche Errors). Fehlt die Datei oder
    der Export: Ablehnung „Der Formen-Generator ist noch nicht verfügbar.“
  - Testquellen: `gallery` (`group` = `all` mit Seiten zu 100 Blöcken im Standardzustand – Türen/Pflanzen mit oberem Teil, Betten
    mit Kopfteil, Wandblöcke mit Wand – oder eine Zustandsreihe `stairs`, `orientation`, `fences`, `glass`, `plants`, `fluids`,
    `chests`, `beds`, `signs`, `doors`, `redstone`, `special`; jede Reihe ein Schritt; `result.gallery = { group, page, pages,
    items, rows }`) und `synthetic` (`count` bis 2 000 000: Gelände mit Wasser, Bäumen, Blumen; Schritte = Ebenen).

## 8. Seiten (`js/ui/`)

- `index.html` – Start: Suche/Freitext „Was willst du bauen?“, Kategorien mit Anzahl, Empfehlungen.
- `kategorie.html?k=<slug>` – Liste mit Vorschaubild, Filter (Größe, Herkunft, Test), Sortierung.
- `bau.html?id=<id>[&scale=<zahl>]` – 3D-Ansicht + Schritt-Player + Anleitung (Kapitel mit Titel, Schritte mit Nummer,
  Blockzahl und Ebene),
  Material (gesamt und pro Schritt, abhakbar), Ebenen-Plan (2D-Raster der Ebene mit Block-Icons),
  Infos & Quellen. Fortschritt im `localStorage` (`bk:progress:<id>`, immer in try/catch).
- `bau.html?form=<form>&…` – Ergebnis des Formen-Generators.
- `erstellen.html` – Freitext + Formen-Generator.

Kategorien (`slug` → Titel):
`haeuser` Häuser & Wohnen · `wahrzeichen` Wahrzeichen & Riesenbauten · `fantasy` Fantasy, Anime & Film ·
`mittelalter` Mittelalter & Burgen · `klein` Kleine Projekte & Deko ·
`farmen` Farmen & Technik · `infrastruktur` Brücken, Bahnhöfe & Häfen
Änderung (2026-10-28): Die Kategorie `redstone` gibt es nicht mehr (Bauten nicht prüfbar). Alte Adressen wie
`kategorie.html?k=redstone` oder `bau.html?id=lauflicht` zeigen die normale Anzeige für Unbekanntes.

Herkunft (`accuracy`):
`original` Original aus dem Spiel · `massstab` Nach echten Maßen · `vorlage` Nach bekannter Vorlage ·
`nachempfunden` Nachempfunden · `eigenes` Eigenes Design

Änderung: `kategorie.html` ohne `k` zeigt die Übersicht aller Kategorien (Kacheln mit Anzahl); ein
unbekanntes `k` zeigt einen Fehlerhinweis plus Übersicht. Die Kopf-Suche jeder Seite leitet auf
`erstellen.html?q=<text>` (bereinigt, höchstens 120 Zeichen). Die stabilen Container-IDs jeder Seite stehen
oben in ihrem Modul (`js/ui/home.js`, `category.js`, `build-page.js`, `create-page.js`); ein Test prüft,
dass es sie im HTML gibt. Gemeinsame Schnittstellen in `js/ui/` (alle Module ohne DOM-Zugriff beim Laden,
daher in Node testbar):
```js
// dom.js – nie innerHTML; href/src nur relativ oder https (für <img src> zusätzlich data:image/png|gif|jpeg|webp|avif;base64 und blob:)
el(tag, attrs, ...children) / svgEl(tag, attrs, ...children)   // attrs: class (Text|Liste), dataset, on: { click: fn }, sonst Attribute; on*-Attribute und style werfen
clear(node) / setChildren(node, ...children) / requireElement(id)
isSafeUrl(url, { allowImageData }) / isSafeSitePath(pfad) / sitePath('bau.html?id=…')  // → „/bau.html?id=…“ ab Website-Wurzel
// data.js – Fehler als DataError { kind: invalid-path|missing|http|network|timeout|parse|format, title, message, steps:[{text, command?}] }
loadJson(pfad, { fetch, timeoutMs, root }) / loadCatalog() / loadNames() / findBuild(catalog, id) / countByCategory(catalog)
// shared.js
CATEGORIES (slug, title, shortTitle, color, colorName, icon, description) · CATEGORY_SLUGS · ACCURACY_LABELS · ICON_NAMES
initPage() · bindSearchForm(form, input) · normalizeSearchQuery(text) · searchHref(text) · parseBuildParams(location.search)
formatNumber(n) („12.345“) · formatCount(n, 'Bau', 'Bauten') · formatSize([w,h,l]) · storageGet/storageSet/storageRemove('bk:…')
icon(name, { size: 16|32|48|64 }) · createChip / createCategoryChip / createAccuracyChip / createUntestedChip
createBuildCard(eintrag) · createSkeletonCards(n) · renderCategoryGrid(liste) · setCategoryCounts(kacheln, zahlen)
renderLoading / renderEmpty / renderInfo / renderError(container, fehler, { onRetry }) / renderState / createState
initTabs(root) · initSlider(input) / syncSlider(input) · setXpProgress(node, { value, max, level }) · showToast({ title, text, kind })
attachTooltip(ziel, () => tooltipContent(name, { lines, meta })) · contrastRatio(a, b) / mixHex(a, b, anteil)
```

Änderung (ui:browse, Start- und Kategorie-Seite): Zustand der Kategorie-Seite in der Adresse
`kategorie.html?k=<slug>[&q=<text>][&groesse=klein|mittel|gross|riesig…][&herkunft=<accuracy>…][&test=getestet|ungetestet|ohne…][&sort=<schlüssel>]`
– Mehrfachwerte als wiederholte Parameter (Komma-Listen werden auch gelesen), alles gegen Whitelists geprüft, Unbekanntes fällt weg
(Konsolen-Warnung), Standardwerte stehen nicht in der Adresse. `test`: true → getestet, false → ungetestet, null → ohne.
Sortierungen: `relevanz` (nur mit Suche, dann Standard), `name` (Standard ohne Suche), `groesse-auf|-ab` (Rauminhalt w·h·l),
`bloecke-auf|-ab`; fehlende Werte immer am Ende, Gleichstand nach Name. Alte Adressen mit `schwierigkeit=` oder
`sort=schwierigkeit-…` fallen still auf den Standard zurück. Filter: „oder“ in einer Gruppe,
„und“ zwischen Gruppen; eine Gruppe erscheint nur, wenn in der Kategorie ≥ 2 Werte vorkommen oder etwas gewählt ist. Filter und
Sortierung legen einen Verlaufseintrag an (Zurück-Taste), Tippen nur beim ersten Zeichen; `history.state = { mark: 'bk-browse',
shown, scrollY }` stellt nach Zurück die Zahl der Karten und die Stelle wieder her. Karten in Schritten zu 24 (IntersectionObserver
+ Knopf). Textsuche = `searchCatalog` aus `js/create/search.js`. Reine Module (Node-testbar) in `js/ui/browse/`: `model.js`
(Größenklassen, Test-Zustand, Rauminhalt), `filters.js`, `sort.js`, `url-state.js` (`parseBrowseState`, `browseSearch`, `browseHref`),
`view.js` (`createBrowseIndex`, `computeView(index, state, { search, category })`, `initialShown`, `nextShown`), `home-sections.js`
(`selectHomeSections(builds)`, `catalogTotals(builds)`). Startseite: Abschnitte nach festen Regeln ohne Zufall – Riesenbauten (gross +
riesig, meiste Blöcke), Klein & schnell gebaut (Größe klein, nach Blockzahl aufsteigend, dann Titel), Original aus dem Spiel,
Nach echten Maßen, Farmen (Kategorie `farmen`, die größten zuerst);
je 4 Karten, kein Bau doppelt, dazu Links „N Bauten in <Kategorie>“ auf genau diese Auswahl der Kategorie-Seite. Styles in
`css/browse.css` (nach `style.css` eingebunden). `data.js` übernimmt zusätzlich die Katalogfelder von Runde 2 (`description`,
`sources`, `credits`, `defaultScale`, `variants`, `phases`, `sizeClass`; nur wenn vorhanden), `shared.js` exportiert `SIZE_CLASS_KEYS`.
Alte Felder wie `difficulty` und `facts` übernimmt `data.js` nicht. Karten zeigen Größe und Blockzahl, keine Schwierigkeit.

Änderung (ui:build, Bau-Seite): Die Bau-Ansicht ist eine Komponente in `js/ui/build-view.js`, die `bau.html` (Container
`#build-view` in `#build-layout`) und „Selber erstellen“ einbetten:
```js
mountBuildView(container, { source, params, entry, progressKey, onReady, onError, onScaleChange })
  // → Promise<{ viewer, result, context, dispose() }>; lehnt bei Ladefehlern ab (Fehlerzustand und onError vorher)
  // source/params wie viewer.load · entry: Katalog-Eintrag oder gleich aufgebautes Objekt (viewEntry prüft jedes Feld)
  // progressKey: 'bk:progress:<id>' | 'bk:progress:<id>@<maßstab>' | 'bk:progress:form-<form>-<hash>' | null (nichts speichern)
  // Der Container muss im Dokument hängen; er bekommt die Klasse .build-view (Raster stage/player/panels, in .build-layout display: contents)
```
Fortschritt `{ v: 1, step, checked: [item…], updatedAt }` (Schritt als Kommazahl wie `setProgress`, gespeichert erst nach einer
Eingabe, gebündelt nach 400 ms, beim Verlassen `pagehide` sofort). Maßstab-Wechsel lädt in derselben Ansicht neu (eigener Schlüssel je
Maßstab), `onScaleChange` passt in `bau.html` die Adresse per `history.replaceState` an. `bau.html?form=…` lädt `parseShapeQuery` und
`SHAPES` aus `js/create/shape-generators.js` dynamisch (fehlt die Datei: Hinweis mit Link). Teile in `js/ui/build/` (ohne DOM beim Laden):
`entry.js` (Katalogfelder, Maßstab, Quelle, Schlüssel), `progress.js` (ProgressStore), `step-model.js`, `material-data.js`, `plan-model.js`
(reine Logik) sowie `stage.js`, `step-player.js`, `guide.js`, `materials.js`, `layer-plan.js`, `info.js`, `kit.js` (DOM) und `appearance.js`
(Icons und Draufsicht-Kacheln aus `models.json` + `textures.bin` im Hauptthread: Flächen einer Blickrichtung werden orthografisch
gerastert, Icons isometrisch über `renderBlockIcon`, `item/<id>` des Spiels hat Vorrang, dünne Formen wie Fackeln flach). Styles in
`css/build-view.css` (nach `style.css`). Hervorhebung in 3D: der Schritt unter dem Zeiger in der Anleitung, sonst der gerade gebaute
Schritt für 3 s bzw. während des Abspielens (danach aus, damit der Viewer nicht dauernd zeichnet). `window.__buildView` hält
in `bau.html` die geladene Ansicht (für Klick-Tests). Prüfung: `node tests/visual/build-page-check.mjs` (Screenshots, Abläufe, FPS).
Änderung (2026-10-28, Anleitung ohne Texte): Es gibt keine Schritt-Namen, Schritt- und Kapiteltexte, Tipps, Notizen (auch keine
Markierungen in 3D) und keinen Anleitungssatz unter dem Schieberegler. Anleitung: Kapitel mit „Kapitel n“, Titel und Schrittzahl,
Schritte mit Nummer und Kurzinfo „24 Blöcke · Ebene 3 (y = 2)“ (`stepMeta`, Teile `stepMetaParts`; Ebene 1 = y 0 wie in §3,
im Ebenen-Plan, im Schnitt und in den Kapiteltiteln der Formen; auf schmalen Handys bricht „Ebene 3 (y = 2)“ nur als Ganzes um). Player: „Kapitel n von N“, Kapiteltitel, Kurzinfo des Schritts,
daneben „Schritt n von N“; Live-Region „Schritt 3 von 12 (Erdgeschoss).“ (`stepAnnouncement`). Tooltips nennen „Schritt 5“,
der Materialhinweis „Schritt 5“ bzw. „Kapitel 2: Erdgeschoss“. Der Info-Tab zeigt Einordnung, Beschreibung, Maßstab, Kennzahlen,
Quellen und Design, aber keine Schwierigkeit und kein Wissenswertes.
Änderung (ui:create): `onError(error, handle)` bekommt als zweites Argument den Griff der Ansicht (`null`, wenn schon der Viewer nicht
starten konnte), weil das Promise bei Ladefehlern keinen liefert – Einbettungen räumen damit Viewer und Worker nach Fehlern ab.

Änderung (ui:create, „Selber erstellen“): `erstellen.html[?q=<text>][#formen|#import]` mit drei Reitern (Idee, Formen, Import;
`initTabs`, der Anker merkt den Reiter per `history.replaceState`). Freitext bis 200 Zeichen (`cleanRequest`), Ergebnis aus
`parseRequest` ohne Neuladen (Adresse per `replaceState`); `build` → Karten mit Link `bau.html?id=…[&scale=…]` (eindeutig: große Karte
„Anleitung öffnen“), `shape` → „So verstanden“ und vorbefüllter Generator, `none` → Begründung, echte Vorschläge, Knöpfe zu Formen und
Import. Formen-Generator aus `SHAPES` (Zahl + Regler, Block-Auswahl als Combobox über `findBlocks` mit Icons aus `Appearance`,
hohl/voll als Umschalter, `dependsOn` blendet Felder aus), Prüfung live mit `validateShapeParams`, Meldungen am Feld (Präfix „Label: “),
Vorschau mit `mountBuildView` (`formProgressKey`), kleine Formen (≤ 200 000 Blöcke) bauen sich nach 0,9 s Pause neu, letzte Form in
`bk:create:shape`. Import: Datei-Feld/Drag & Drop (`accept` = `UPLOAD_ACCEPT` + `.mtl`), Vorprüfung im Hauptthread, bei Modellen
Einstellungen (Höhe, hohl/voll, Palette, Block nur aus `block-colors.json`, Hochachse), Laden mit `progressKey: null`; jede Last baut eine
frische Ansicht (`ViewSlot`), Fehler → Ansicht weg, Meldung bei der Auswahl. Teile in `js/ui/create/`: `model.js` (rein, Node-testbar),
`view-slot.js`, `fields.js`, `block-picker.js`, `block-icons.js`, `shape-glyphs.js`, `shape-form.js`, `idea.js`, `importer.js`; Styles
`css/create.css` (nach `style.css` und `build-view.css`). Klick-Tests: `window.__createPage` (`ready`, `request`, `shape`, `imports`,
`lastImport`, `views.shape|import`); Prüfung `node tests/visual/create-page-check.mjs [--only idee|formen|import|handy|zustaende]`.
Grenze: Die Farben einer `.mtl` reicht die Upload-Quelle des Workers (`checkUploadSource`) noch nicht an `modelToVolume` weiter – die
Seite nimmt die `.mtl` an und sagt das ehrlich.

## 9. Bau-Module (Inhalte)

Datei `js/builds/<kategorie>/<id>.js`:
```js
export const meta = {
  id: 'tokyo-skytree',                 // = Dateiname, /^[a-z0-9-]{2,80}$/
  title: 'Tokyo Skytree',
  category: 'wahrzeichen',
  subtitle: 'Fernseh- und Aussichtsturm in Tokio',
  tags: ['Japan', 'Turm', 'Riesig'],
  aliases: ['skytree', 'sky tree', 'tokyo sky tree'],   // für die Freitext-Suche
  accuracy: 'massstab',
  description: 'Kurzer Text (2–4 Sätze).',
  sources: [{ title: 'Wikipedia: Tokyo Skytree', url: 'https://…' }],
  credits: null,                        // bei übernommenen Designs: { author, url, license }
  scales: [1, 0.5, 0.25],               // optional (nur bei echten Maßen): erlaubte Maßstäbe, 1 = 1 Block pro Meter
  tested: null,                         // Farmen: false = „nicht im Spiel getestet“
};
export default function build(b, { scale = 1 } = {}) { … }
```
Regeln: deterministisch (nur `b.rng()`), kein DOM, kein Netzwerk; nur Blöcke aus 26.2; Kapitel-Titel
kurz auf Deutsch, Schritte ohne Titel und Text; echte Bauwerke mit Quellen, unsichere Maße als solche benennen; nichts erfinden.
Änderung (2026-10-28): `meta.difficulty` und `meta.facts` gibt es nicht mehr; stehen sie noch im Modul, meldet check-build
einen Fehler („meta.difficulty gibt es nicht mehr.“ bzw. „meta.facts gibt es nicht mehr.“). `description`, `subtitle`,
`sources` und `credits` bleiben (Quelle und Lizenz übernommener Bauten).
Änderung (2026-10-28, Nacharbeit): Auch als Schlagwort gibt es keine Schwierigkeit. Tags wie „Anfänger“, „Einsteiger“,
„Fortgeschritten“, „Profi“, „Experte“ oder „Schwierigkeit“ (ganzer Tag, Groß-/Kleinschreibung egal, `difficultyTags` in
`check-build.mjs`) sind ein Fehler in check-build und `build-catalog.mjs` („meta.tags: „Anfänger“ ist eine Schwierigkeit – die gibt es
nicht mehr.“). Suchwörter in `aliases` (z. B. „anfängerhaus“) bleiben erlaubt, sie werden nicht angezeigt.
Änderung (Integration Runde 2): `Math.sin`, `Math.cos` und `Math.atan2` liefern in Node 24 (V8 13.6) und Chrome 156 im letzten
Bit verschiedene Werte. Wer aus Winkeln Blockpositionen rundet, rundet das Ergebnis vorher auf ein feines Raster (z. B.
`Math.round(v * 1e6) / 1e6`), sonst kippen einzelne Blöcke an .5-Grenzen und Katalog (Node) und Bau-Seite (Browser) haben
verschiedene Blockzahlen (beim Tokyo Skytree 1:1 waren es 3 Blöcke; `tokyo-skytree.js` rundet jetzt in `polarPoint`).

`scripts/build-catalog.mjs` liest alle Module und `game-structures.js`, prüft sie und schreibt
`game-data/catalog.json`.
Änderung (Webseite, Etappe 1): Ziel ist `data/catalog.json` (im Repo, wird mit der Seite veröffentlicht). Neu ist das Feld
`"inputs": { "code": sha256, "data": sha256 }` nach `version`: `code` = Fingerabdruck dieses Skripts (nur die Datei), von
`scripts/check-build.mjs`, `js/core/materials.js`, allen Bau-Modulen und `game-structures.js`, jeweils samt aller relativ
importierten Dateien (CRLF zählt als LF); `data` = Spieldaten-Version (`version|worldVersion` aus `meta.json`),
`blocks.json` und `structures/index.json`. Passt einer nicht mehr, ist der Katalog veraltet (`start.mjs`, Unit-Test
`tests/unit/catalog-fresh.test.mjs`). `thumb` ist im Katalog immer `null`: Vorschaubilder enthalten Spieltexturen und gibt es
nur lokal (`thumbs/`, Liste in `thumbs/index.json`); die Seite ergänzt sie nur auf 127.0.0.1/localhost (`loadLocalThumbIds`,
`applyThumbs` in `js/ui/data.js`), online gibt es keine Anfrage danach und die Karten zeigen das Kategorie-Icon.
Ändert sich außer `generatedAt` nichts, bleibt die Datei unberührt (`writeCatalogIfChanged`).
Änderung (catalog, verbindlich ab Runde 2 – ersetzt das kürzere Format):
```json
{ "generatedAt": "ISO-Zeit", "version": "26.2",
  "counts": { "total": n, "byCategory": { "<slug>": n } }, "warnings": [],
  "builds": [ {
    "id", "title", "category", "subtitle", "tags": [], "aliases": [], "accuracy",
    "description", "sources": [{ "title", "url" }], "credits": { "author", "url", "license" } | null,
    "tested": true | false | null,
    "module": "js/builds/<kategorie>/<id>.js" | null,
    "structure": "<datei>.json" | null,                (Original-Struktur aus game-data/structures/)
    "scales": [1, 0.5] | null, "defaultScale": 1 | null,
    "size": [w, h, l], "blocks": n, "steps": n, "phases": n,   (beim defaultScale bzw. ohne Maßstab)
    "variants": { "1": { "size", "blocks", "steps" }, "0.5": { … } } | null,   (nur bei scales)
    "topMaterials": [["stone_bricks", 1234], …],      (höchstens 8, Item-IDs, absteigend)
    "sizeClass": "klein" | "mittel" | "gross" | "riesig",   (Blöcke: klein < 1 000 ≤ mittel < 10 000 ≤ gross < 100 000 ≤ riesig)
    "thumb": "thumbs/<id>.webp" | null } ] }
```
- Original-Strukturen: `id` mit Vorsilbe `spiel-` (für Module verboten), `accuracy` `original`, `module` null, `structure` gesetzt,
  `phases` 1, `steps` = belegte Ebenen, `size` = Begrenzung der Blöcke (Luftränder der Vorlage zählen nicht).
  `defaultScale` = 1, wenn erlaubt, sonst der erste Maßstab (wie check-build).
- Änderung (2026-10-28): Der Katalog hat keine Felder `difficulty` und `facts` und keine Kategorie `redstone` mehr.
- `counts.byCategory` nennt immer alle 7 Kategorien (auch 0). `builds` sortiert nach Kategorie (Reihenfolge §8), dann Titel.
  `warnings`: Warnungen der Module (höchstens 20 je Eintrag), doppelte Titel, Einträge, die wegen Fehlern fehlen.
- Die Datei hat einen Eintrag je Zeile (kompakt, gültiges JSON) und wird atomar geschrieben (Zwischendatei + Umbenennen).
- Bau-Seite: `bau.html?id=<id>[&scale=<zahl>]`; Formen: `bau.html?form=<shape>&<param>=<wert>…`

`js/builds/game-structures.js` (Agent catalog) exportiert `GAME_STRUCTURE_DEFAULTS` (`accuracy`, `sources`, `credits`,
`tested`) und `GAME_STRUCTURES` (eingefroren): `{ id, structure: '<spielpfad>', title, subtitle, category, tags, aliases,
description }` (ein Eintrag mit `difficulty` oder `facts` ist ein Fehler); `structure` ist der Pfad unter
`data/minecraft/structure/` (z. B. `village/plains/houses/plains_library_1`),
der Dateiname folgt daraus (`/` → `__`, `.json`). Auswahl: vollständige, nachbaubare Stücke – keine Zombie-, Verfalls- oder
Kohle-Varianten, keine Straßen, Lampen, Deko-Kleinteile, Halb-Wracks oder Leerräume.

### 9.1 Hilfsbibliothek (`js/builds/lib/`)

Wiederverwendbare Bauteile für Bau-Module, damit alle Bauten einheitlich gut aussehen und keine Logik doppelt
entsteht. Gemeinsame Regeln:
- Reine Funktionen auf dem Builder: `fn(b, { x, y, z, facing = 'south', …optionen })`. Alles setzt über `b`, also wirken
  `b.transform`, Kapitel und Schritte (ein Aufruf im laufenden `b.phase`/`b.step` landet dort).
- Deterministisch, ohne DOM/Netz/Zeit; nur Blöcke aus 26.2 (`b.set` prüft jeden Zustand). Unbekannte Optionen → `Error`.
- Ursprung, vorne und Ausdehnung sind je Funktion dokumentiert. `facing` = Richtung, in die die Vorderseite zeigt;
  lokal ist vorne Süden (+z), `facing` dreht im Uhrzeigersinn wie `b.transform` (`west` = 90°, `north` = 180°, `east` = 270°).
- Schaukästen: `tests/fixtures/lib/showcase-<thema>.js` (gültige Module, mit `check-build` und `scripts/shot.mjs` prüfbar).
- Ein Import für alles: `import { WOOD, STONE, window, doorway, bedroom, lightRoom, tree, … } from '../lib/index.js'`
  (`index.js` = `export *` aus `palettes.js`, `bauteile.js`, `innen.js`, `natur.js`; ein Test prüft, dass kein Name doppelt ist).
- `check-build` durchsucht auch alle Dateien unter `js/builds/`, die ein Modul (auch über Umwege) relativ importiert, auf
  `Math.random`, Zeit, Netz und DOM (Meldung „`js/builds/lib/x.js (importiert): Die Datei …`“). Kern und 3D-Ansicht nicht.
  Änderung (lib:bauteile): `collectBuildSources(pfad, { within })` und `scanBuildSources(pfad, { within })` exportiert.

#### Paletten (`palettes.js`, Agent lib:bauteile)

Rolle → echte Block-ID aus 26.2 (reine ID ohne `[…]`, direkt für `b.set`/`b.fill`/`b.stairs`/`b.slab`/`b.door` oder als
`` `${p.log}[axis=x]` ``). Alle Paletten sind eingefroren und haben alle Rollen ihrer Art; gibt es eine Variante im Spiel nicht,
ist die Rolle `null` (ein Test prüft jede ID gegen `game-data/blocks.json` und das Namensmuster der Rolle).
```js
import { WOOD, STONE, COPPER, COLOR, COLOR_IDS, GLASS, FLOWERS, WARM_FLOWERS, COOL_FLOWERS, POTTED,
  WOOD_ROLES, STONE_ROLES, COPPER_ROLES, COLOR_ROLES, allPalettes } from '../lib/palettes.js';
```
- `WOOD.<holz>`: `eiche`, `fichte`, `birke`, `dschungel`, `akazie`, `schwarzeiche`, `mangrove`, `kirsche`, `bambus`, `blasseiche`,
  `karmesin`, `wirr`. Rollen: `planks, log, strippedLog, wood, strippedWood, stairs, slab, fence, fenceGate, door, trapdoor,
  button, pressurePlate, sign, wallSign, hangingSign, wallHangingSign, shelf, leaves, sapling, pottedSapling, mosaic,
  mosaicStairs, mosaicSlab`. Besonderheiten: Nether-Hölzer → `log` = Stängel, `wood` = Hyphen, `leaves` = Warzenblock,
  `sapling` = Pilz; Bambus → `log` = Bambusblock, `wood`/`leaves` = `null`, `mosaic*` nur hier; Mangrove → `sapling` = Keimling.
- `STONE.<familie>`: `stein`, `bruchstein`, `steinziegel`, `tiefenschiefer`, `schwarzstein`, `sandstein`, `roter-sandstein`, `quarz`,
  `ziegel`, `schlammziegel`, `tuffstein`, `prismarin`, `endstein`, `netherziegel`, `purpur`, `harz`, `andesit`, `diorit`, `granit` und
  die 8 Kupfer-Paletten. Hauptset `block, stairs, slab, wall` (das „typische“ Baumaterial der Familie, z. B. `tiefenschiefer.block` =
  Tiefenschieferziegel), dazu je nach Familie `bricks…`, `polished…`, `tiles…`, `smooth…`, `cut…`, `rough…` (Bruch-/Rohform, z. B.
  Bruchstein, Bruchtiefenschiefer, Schwarzstein), `mossy…`, `chiseled`, `chiseledBricks`, `cracked`, `crackedTiles`, `pillar`,
  `natural` (Naturstein der Familie), `dark…` (Prismarin), `red…` (rote Netherziegel), `gilded`, `fence`, `button`, `pressurePlate`.
- `COPPER` (auch in `STONE`): `kupfer`, `kupfer-angelaufen`, `kupfer-verwittert`, `kupfer-oxidiert`, jeweils auch `…-gewachst`.
  Zusätzlich `grate, bulb, door, trapdoor, bars, chain, lantern, chest, lightningRod, torch, wallTorch`.
- `COLOR.<farbe>` (16, `COLOR_IDS`: `weiss` → `white` …): `wool, carpet, concrete, concretePowder, terracotta, glazedTerracotta,
  stainedGlass, stainedGlassPane, bed, candle, banner, wallBanner, shulkerBox`.
- `GLASS = { block, pane, tinted }`, `FLOWERS` (12 kleine Blumen), `WARM_FLOWERS`, `COOL_FLOWERS`, `POTTED` (Topfpflanzen).

#### Bauteile (`bauteile.js`, Agent lib:bauteile)

Jede Funktion gibt die **dokumentierte Ausdehnung** als Box `{ min: [x, y, z], max: [x, y, z] }` in Aufrufer-Koordinaten zurück
(alle gesetzten Blöcke liegen darin – Test in allen 4 Ausrichtungen). Lokaler Rahmen: Vorderseite = Süden (+z), lokal **+x =
rechts** für jemanden, der vor dem Bauteil steht und es ansieht (bei `facing: 'south'` also Osten). **Wandbauteile** liegen in
der Wandebene `lz = 0`, `lz > 0` ist außen (vorne), `lz < 0` innen; `facing` = Außenseite der Wand. Setze sie **nach** der Wand –
sie ersetzen Wandblöcke (Öffnungen werden mit Luft freigeräumt). Breiten werden zentriert: `lx = lo … hi` mit
`lo = −floor((w − 1) / 2)`; bei gerader Breite liegt das zusätzliche Feld rechts (`centeredSpan(w)`). „Stamm-Blöcke“ bekommen ihre
Achse automatisch (`withAxis`), andere Blöcke bleiben, wie sie sind (z. B. Bretter als Rahmen gehen auch).
```js
import { window, doorway, chimney, column, arch, archProfile, battlements, arrowSlit, balcony, straightStairs, timberWall,
  brace, supportPost, dormer, hangingLantern, wallLantern, lampPost, floorPattern, gardenFence,
  partOptions, placeOriented, orientedBox, centeredSpan, withAxis, slabFor, checkInt, checkChoice, checkId, LIB_FACINGS } from '../lib/bauteile.js';
```
- **`window(b, { x, y, z, facing, width = 1, height = 2, style = 'pane', glass = 'glass_pane', frame, stairs = 'spruce_stairs',
  slab, sill, shutters = null, flowerBox = null })`** – Fenster. Ursprung = unterste Zelle der Öffnung (Mitte) in der Wandebene.
  `style`: `pane` (nur Glas), `framed` (Rahmen, Standard `stripped_spruce_log`, + Fensterbank), `arched` (Rundbogen oben aus
  oberen Treppen/Stufen `stairs`/`slab`, width ≥ 2), `round` (Rundfenster `width` 3 oder 5, quadratisch, Ecken aus Treppen).
  Zusätze für jeden Stil: `frame` (Block-ID → Ring um die Öffnung, `lx lo−1 … hi+1`, `ly −1 … height`), `sill` (Treppen-ID →
  obere Treppe unter der Öffnung bei `lz 1`, hohe Seite zur Wand; bei `framed` Standard = `stairs`), `shutters` (Falltür-ID →
  offene Falltüren flach an der Wand links/rechts, `lz 1`), `flowerBox` (`true` | `{ trapdoor = 'spruce_trapdoor', soil =
  'rooted_dirt', flowers = FLOWERS }` → Erdreihe bei `ly −1, lz 1`, ringsum Falltüren bis `lz 2`, Blumen darauf bei `ly 0`;
  ersetzt `sill`). Beim Bogenfenster ohne `frame` bleiben die Wandblöcke in den Ecken stehen.
  Ausdehnung: `lx lo … hi` (mit Rahmen/Läden/Kasten ±1), `ly 0 … height − 1` (`−1` mit Rahmen/Bank/Kasten, `height` mit Rahmen),
  `lz 0` (bis 1 mit Bank/Läden, bis 2 mit Kasten). Beispiel:
  `window(b, { x: 2, y: 2, z: 8, facing: 'south', shutters: WOOD.fichte.trapdoor, flowerBox: true })`.
- **`doorway(b, { x, y, z, facing, door = 'spruce_door', width = 1, frame = 'stripped_spruce_log', canopy = null, step = null,
  open = false })`** – Tür (1 oder 2 breit) mit Rahmen und Vordach. Ursprung = untere Türhälfte (bei width 2 die linke Tür) in
  der Wandebene; `facing` = außen. Die Tür hat `facing` = innen (öffnet nach innen), Doppeltüren mit Scharnier links/rechts.
  `frame`: Ständer links/rechts (`ly 0 … 1`) und Sturz (`ly 2`). `canopy`: Treppen-ID (Tiefe 1: Treppenreihe bei `ly 3, lz 1`,
  obere Treppen als Konsolen bei `ly 2`) oder `{ stairs, depth: 1 | 2, posts = 'spruce_fence' }` (Tiefe 2: zweite Reihe bei
  `ly 2, lz 2` auf Zaunpfosten). `step`: Treppen-ID → Stufe vor der Tür bei `ly −1, lz 1` (für einen Fußboden eine Ebene über
  dem Gelände). Ausdehnung: `lx −1 … width` (ohne Rahmen/Dach `0 … width − 1`), `ly (−1) 0 … 3`, `lz 0 … depth`.
- **`chimney(b, { x, y, z, facing, height = 4, block = 'bricks', width = 1, smoke = 'normal', rim = null, fire = 'campfire' })`** –
  Schornstein. Ursprung = Mitte der untersten Ebene; Schaft `width` 1 oder 3 (quadratisch) von `ly 0 … height − 1`.
  `smoke`: `normal` (Lagerfeuer), `tall` (Heuballen direkt darunter → Signalfeuer, Rauch steigt viel höher), `none`. Bei width 1
  sitzt das Feuer auf dem Schaft (`ly height`, der Heuballen ist die oberste Schaftzelle), bei width 3 vertieft in der Mitte
  (`ly height − 1`, Heuballen verdeckt darunter). `rim`: Treppen-ID → Kranz aus oberen Treppen um die oberste Ebene (±1).
  `facing` dreht nur das Lagerfeuer. Ausdehnung: `±(width − 1) / 2` (+1 mit Kranz), `ly 0 … height − 1` (+1 bei width 1 mit Feuer).
- **`column(b, { x, y, z, facing, height = 5, shaft = 'quartz_pillar', base = 'smooth_quartz', capital = 'chiseled_quartz_block',
  trim = 'smooth_quartz_stairs' })`** – Säule. Ursprung = Basis. `ly 0` Basis, Schaft, `ly height − 1` Kapitell (height ≥ 3);
  `trim` = 3 × 3-Kranz aus Treppen an Basis (unten) und Kapitell (oben), hohe Seite zur Säule, Ecken als Außenecken; `null` = schlank.
  Ausdehnung `±1` (ohne trim 0), `ly 0 … height − 1`.
- **`arch(b, { x, y, z, facing, width = 3, height = 4, style = 'round', block = 'stone_bricks', stairs = 'stone_brick_stairs',
  slab, depth = 1, pillars = true })`** – Bogen/Tor. Ursprung = unterste Zelle der Öffnung (Mitte) in der Wandebene. `height` =
  lichte Höhe in der Mitte; `style` `round` (Halbkreis, braucht `height ≥ width / 2`) oder `pointed` (Spitzbogen aus zwei Kreisbögen
  mit Radius 1,5 · halbe Breite, braucht `height ≥ 0,71 · width`); Rundung aus oberen Treppen (hohe Seite außen) und oberen Stufen.
  Öffnung = Luft, Pfeiler `lx lo − 1` und `hi + 1`, Scheitelreihe `ly height`. `depth` wiederholt nach hinten (`lz 0 … −(depth − 1)`).
  `archProfile(width, height, style)` → `{ lo, hi, center, get(lx, ly) }` mit `'open' | 'stairs' | 'slab' | 'solid'` (für eigene
  Bögen, z. B. Gewölbe). Ausdehnung `lx lo − 1 … hi + 1`, `ly 0 … height`, `lz −(depth − 1) … 0`.
- **`battlements(b, { x, y, z, facing, length = 5, block = 'stone_bricks', parapet = 1, height = 1, merlon = 1, gap = 1, cap = null,
  corbels = null })`** – Zinnenkranz. Ursprung = linkes Ende (von außen gesehen) auf Höhe der Brüstung, Reihe `lx 0 … length − 1`
  in der Wandebene (äußere Mauerreihe), `facing` = Feldseite. `parapet` Ebenen Brüstung, darüber Zinnen (`merlon` breit, `height`
  hoch) und Lücken (`gap`); die letzte Zelle ist immer eine Zinne. `cap`: Stufen-ID auf den Zinnen. `corbels`: Treppen-ID →
  die Reihe springt um 1 nach außen (`lz 1`) und sitzt auf Konsolen (obere Treppen bei `ly −1`). Ecken: zwei Aufrufe, die sich in
  der Eckzelle treffen. Ausdehnung `lx 0 … length − 1`, `ly (−1) 0 … parapet + height − 1 (+1 cap)`, `lz 0` (1 mit corbels).
- **`arrowSlit(b, { x, y, z, facing, height = 3, style = 'slit', depth = 1, fill = 'air' })`** – Schießscharte. Ursprung = unterste
  Zelle in der Wandebene. `slit` = 1 breit, `cross` = Querarm (±1) in der oberen Mitte (height ≥ 3); `depth` = Wanddicke nach hinten;
  `fill` z. B. `iron_bars`. Ausdehnung `lx 0` (±1 bei cross), `ly 0 … height − 1`, `lz −(depth − 1) … 0`.
- **`balcony(b, { x, y, z, facing, width = 3, depth = 2, floor = 'spruce_planks', railing = 'spruce_fence', supports =
  'spruce_stairs' })`** – Balkon. Ursprung = Wandzelle (Mitte) auf Höhe des Balkonbodens; Boden `lz 1 … depth`, Geländer eine Ebene
  höher am Rand, Konsolen (obere Treppen) unter den Seiten an der Wand (`ly −1`, bei depth ≥ 3 zwei übereinander). Die Tür setzt
  du mit `doorway`. Ausdehnung `lx lo … hi`, `ly −1 (−2) … 1`, `lz 1 … depth`.
- **`straightStairs(b, { x, y, z, facing, width = 1, height = 4, stairs = 'spruce_stairs', support = 'spruce_planks', railing = null
  })`** – gerade Treppe, steigt in `facing`-Richtung. Ursprung = unterste Stufe (Mitte); Stufe k bei `(·, k, k)`, Treppen-facing =
  `facing`. `support` füllt unter den Stufen bis `ly 0`; `railing` (braucht support): Wangen links/rechts mit Pfosten darauf.
  Ausdehnung `lx lo (−1) … hi (+1)`, `ly 0 … height − 1 (+1)`, `lz 0 … height − 1`.
- **`timberWall(b, { x, y, z, facing, length = 9, height = 4, frame = 'stripped_dark_oak_log', fill = 'white_terracotta', brace,
  pattern = 'diagonal', spacing = 4 })`** – Fachwerkwand. Ursprung = **linke untere Ecke** (von außen gesehen), Wand `lx 0 …
  length − 1`, `ly 0 … height − 1`, `lz 0`. Schwelle/Rähm aus `frame` (liegend), Ständer alle `spacing` und am Ende; `pattern`:
  `diagonal` (Streben im Wechsel / \), `cross` (Andreaskreuze), `grid` (Riegel in der Mitte, ab height 5), `plain`. Für ein Haus
  vier Aufrufe: Süd `(x0, y, z1)`, Nord `(x1, y, z0)`, West `(x0, y, z0)`, Ost `(x1, y, z1)` mit passendem facing.
- **`brace(b, { x, y, z, facing, length = 1, stairs = 'dark_oak_stairs', beam = null })`** – Kopfband unter einem Vorsprung.
  Ursprung = Wandzelle direkt unter dem Balken; Zelle i bei `(0, −(length − 1 − i), 1 + i)`, obere Treppen mit der hohen Seite zur
  Wand; `beam` = Balken bei `ly 1, lz 1 … length`. Ausdehnung `lx 0`, `ly −(length − 1) … 0 (1)`, `lz 1 … length`.
- **`supportPost(b, { x, y, z, facing, height = 3, log = 'dark_oak_log', braces = 'dark_oak_stairs', sides = 2 })`** – Pfosten mit
  Kopfbändern (obere Treppen, hohe Seite außen) an der obersten Ebene: `sides 2` links/rechts (lokal x), `4` rundum. Ursprung = Fuß.
- **`dormer(b, { x, y, z, facing, width = 3, wallHeight = 2, depth, wall = 'spruce_planks', corner = 'spruce_log', stairs =
  'dark_oak_stairs', slab, glass = 'glass_pane' })`** – Dachgaube mit eigenem Satteldach (First quer zum Hauptdach). Ursprung =
  unterste Zelle der Vorderwand (Mitte), `facing` = Talseite. Körper `lx −r … r` (`r = (width − 1) / 2`, width ungerade ≥ 3),
  `lz −(depth − 1) … 0`, innen frei, Fenster über die ganze Wandhöhe. Ohne `depth`: `wallHeight + r + 1` (passt zu 45°-Dächern
  von `b.roof`). Setze sie nach dem Hauptdach, die Vorderwand auf die Wandkrone. Ausdehnung `±(r + 1)`, `ly 0 … wallHeight + r`,
  `lz −(depth − 1) … 1`. Beispiel: `dormer(b, { x: 6, y: 6, z: 8, facing: 'south', stairs: WOOD.schwarzeiche.stairs })`.
- **Laternen.** `hangingLantern(b, { x, y, z, facing, chain = 1, lantern = 'lantern', chainBlock = 'iron_chain' })`: Ursprung = Zelle
  unter der Decke, `chain` Kettenglieder, darunter die hängende Laterne (`ly −chain … 0`). `wallLantern(b, { x, y, z, facing, style =
  'bracket', lantern, arm = 'spruce_fence', shelf = 'spruce_stairs' })`: Ursprung = Wandblock auf Laternenhöhe; `bracket` = Zaun-Arm
  bei `ly 1, lz 1`, Laterne hängt bei `ly 0, lz 1`; `shelf` = obere Treppe bei `ly −1`, Laterne steht darauf. `lampPost(b, { x, y, z,
  facing, height = 3, post = 'spruce_fence', base = null, lantern, style = 'top' })`: Ursprung = Fuß; `top` (Laterne obenauf,
  `ly height`), `arm` (Arm nach vorne bei `ly height − 1, lz 1`, Laterne hängt darunter), `double` (vorne und hinten); `base` =
  Sockelblock als unterste Ebene.
- **`floorPattern(b, { x, y, z, facing, width = 5, depth = 5, pattern = 'checker', blocks, border = null })`** – Bodenmuster auf
  Ebene `y`. Ursprung = Ecke; `lx 0 … width − 1` (rechts), `lz 0 … depth − 1` (vorne). `pattern`: `checker`, `stripes`, `border`
  (blocks[0] innen, [1] Rand), `rings`, `diamond`, `herringbone` (Fischgrät; mit Stämmen schön: Achsen wechseln, blocks[1] optional),
  `random` (Einträge auch `[id, gewicht]`, Mischung über `hashPosition` lokal). `border`: Randblock für jedes Muster.
- **`gardenFence(b, { x, y, z, facing, width = 7, depth = 5, fence = 'spruce_fence', gate = 'spruce_fence_gate', gateWidth = 1,
  posts = null, lanterns = false, sides = ['front', 'back', 'left', 'right'] })`** – Zaun ums Rechteck `lx 0 … width − 1`,
  `lz 0 … depth − 1`; Tor mittig vorne (`lz depth − 1`, `lx floor((width − 1) / 2)`); `posts` = Block für Ecken und Torpfosten
  (z. B. geschälter Stamm, Mauer), `lanterns` = Laternen auf den Torpfosten (braucht posts). Ausdehnung `ly 0` (1 mit lanterns).
- Helfer für eigene Bauteile (auch für `innen.js`): `partOptions(name, b, options, defaults)` (prüft b, unbekannte Optionen,
  x/y/z, facing; Standard facing `south`), `placeOriented(b, o, draw)` (= `b.transform` um den Ursprung), `orientedBox(o, min, max)`,
  `centeredSpan(width)`, `withAxis(id, axis)`, `slabFor(stairsId)`, `checkInt/checkChoice/checkId`.

#### Einrichtung und Licht (`innen.js`, Agent lib:bauteile)

Räume: **Ursprung = hintere linke Ecke auf Bodenhöhe** (erste Luftebene über dem Fußboden), von der Tür aus gesehen; die
Rückwand liegt hinter `lz = −1`, die Möbel stehen an ihr und schauen nach vorne (`facing`, Richtung Tür); der Raum reicht
`width` nach rechts (lokal +x) und `depth` nach vorne. Bei `facing: 'south'` ist der Ursprung also die Nordwest-Ecke. `wood` =
Holzname (`'fichte'`) oder eine Holz-Palette; Farben als Namen aus `COLOR` (`'rot'`). Rückgabe wie bei den Bauteilen.
```js
import { bedroom, kitchen, diningTable, bookWall, storage, enchantingSetup, ENCHANTING_SHELVES, workshop, fireplace,
  lightRoom, findDarkSpots, LIGHT_MAX } from '../lib/innen.js';
```
- **`bedroom(b, { x, y, z, facing, width = 5, depth = 5, wood = 'fichte', color = 'rot', rug = 'weiss', double = false })`** – Bett(en)
  mittig an der Rückwand (Kopfteil hinten), Nachttische (Fass) mit Laterne/Kerzen, Truhe am Fußende, Teppich (ab depth 4, `rug:
  null` ohne), Bücherregal mit Topfpflanze in einer freien Ecke, ab 6 × 5 ein Schrank vorne an der Seitenwand. width ≥ 3 (double ≥ 4),
  depth ≥ 3. Ausdehnung = Raum `lx 0 … width − 1`, `ly 0 … 1`, `lz 0 … depth − 1`.
- **`kitchen(b, { x, y, z, facing, width = 5, wood = 'fichte', cabinets = true })`** – Arbeitszeile an der Rückwand (`lz 0`):
  Räucherofen (mit Trichter als Abzug bei `ly 2`), Wasserkessel (Spüle), Fass, Ofen, Werkbank, Fass, Komposter, dann Arbeitsplatte
  (Bretter) und am Ende ein Fass; Hängeschränke (obere Treppen) bei `ly 2`, etwas Deko. width ≥ 4, Raumhöhe ≥ 3.
- **`diningTable(b, { x, y, z, facing, length = 3, width = 1, wood, top = 'slab', cloth = 'weiss', headChairs = true, decor = true })`**
  – Tisch `lx 0 … length − 1`, `lz 0 … width − 1` (Ursprung = linke hintere Tischecke), Stühle (Treppen, Lehne außen) bei `lz −1` und
  `lz width`, Kopfstühle bei `lx −1`/`length`. `top`: `slab` (obere Stufen, Kerzen/Blumen darauf) oder `carpet` (Zaunbeine + Teppich).
- **`bookWall(b, { x, y, z, facing, width = 5, height = 3, wood = 'schwarzeiche', chiseled = true, crown = true, ladder = false })`** –
  Bücherregale vor der Rückwand (`lz 0`), dazwischen gefüllte Regale (`chiseled_bookshelf`), Stämme an den Enden (ab width 3, bei
  langen Wänden alle 4), Kranz aus oberen Treppen bei `ly height`, Leiter mittig bei `lz 1`.
- **`storage(b, { x, y, z, facing, width = 5, height = 2, chest = 'chest', barrel = true })`** – Lagerwand (`lz 0`): Doppeltruhen
  (2 breit, `type` ausdrücklich gesetzt, Partner wie im Spiel) und Fässer im Wechsel, 1 … 3 Ebenen. `chest`: `chest`,
  `trapped_chest` oder eine Kupfertruhe.
- **`enchantingSetup(b, { x, y, z, facing, lights = true })`** – Zaubertisch mit genau 15 Bücherregalen (Stufe 30, Regel wie
  `EnchantingTableBlock`: 2 Felder entfernt, Tischhöhe oder eine höher, Feld dazwischen frei). Ursprung = Tisch, `facing` = offene
  Seite. Regale: hintere Reihe `lz −2` (oben ohne Mitte), Seiten `lx ±2` bei `lz −1` (2 hoch) und `lz 0` (unten); die 3 × 3 Felder um
  den Tisch werden freigeräumt. `ENCHANTING_SHELVES` = die 15 lokalen Positionen. `lights`: Laterne oben in der Mitte, Kerzen.
  Ausdehnung `±2`, `ly 0 … 2`, `lz −2 … 1`.
- **`workshop(b, { x, y, z, facing, width = 6, wood = 'fichte', shelves = true })`** – Werkbank-Zeile (`lz 0`): Werkbank,
  Schmiedetisch, Amboss, Schleifstein, Steinsäge, Bognertisch, Kartentisch, Webstuhl, Fass, Schmelzofen (so viele wie width), Regale
  (`*_shelf`) bei `ly 2`.
- **`fireplace(b, { x, y, z, facing, height = 4, block = 'bricks', mantel = 'dark_oak_stairs', fire = 'campfire', decor = true })`** –
  Kamin an der Rückwand. Ursprung = Mitte vorne auf Bodenhöhe; Körper `lx −1 … 1` bei `lz 0` (hinten, Lagerfeuer vertieft) und
  `lz 1` (Wangen, Sturz); Sims (obere Treppen) bei `ly 2`, `lx −2 … 2`; Deko darauf; Schlot bis `ly height − 1` (= Raumhöhe, ≥ 4).
- **`lightRoom(b, box, { lantern = 'lantern', mode = 'auto', chain = 'auto' })`** → `{ placed: [[x, y, z], …], walkable }` –
  Licht gegen Monster. `box = { x1, y1, z1, x2, y2, z2 }` = Luftraum innen (inklusive, Aufrufer-Koordinaten, ≤ 2 Mio. Felder).
  Setzt Laternen, bis jedes **begehbare Feld** (Luft mit einem Block darunter) Blocklicht > 0 hat – in 26.2 spawnen Monster nur bei
  Blocklicht 0. Rechnung: Lichtquellen in der Box (Werte wie im Spiel, `blockLightEmission`; Laterne 15, Seelenlaterne 10, Fackel
  14 …) breiten sich mit −1 je Block aus, nur durch Luft und kleine Blöcke (Laternen, Ketten, Teppiche, Zäune, Kerzen, Scheiben …);
  im Zweifel blockiert ein Block (vorsichtig). Gierig: das erste dunkle Feld wird erreicht, unter den Plätzen in Reichweite gewinnt
  der, der die meisten dunklen Felder hell macht. `mode`: `auto` = hängend an der Decke (Raum ≥ 3 hoch; an `chain` Kettengliedern,
  Standard `höhe − 4`, also etwa 3 Ebenen über dem Boden), sonst stehend am Boden an einer Wand; `ceiling`; `floor`. Aufrufen,
  **nachdem** der Raum eingerichtet ist (Möbel werfen Schatten). `findDarkSpots(b, box)` → dunkle begehbare Felder (gleiche Rechnung,
  z. B. für eigene Lichtplanung). Beispiel: `lightRoom(b, { x1: 1, y1: 1, z1: 1, x2: 7, y2: 4, z2: 6 })`.

#### Natur und Gelände (`natur.js`, Agent lib:natur)

Zufall: aus Position, Optionen und `seed` (Zahl oder Text, Standard 0) über `createRandom`/`hashPosition` – nicht aus
`b.rng()`. Ein Baum sieht also gleich aus, egal was davor gebaut wurde; anderer `seed` = andere Form. Jede Funktion gibt
die belegte Box `{ min: [x, y, z], max: [x, y, z] }` in Aufrufer-Koordinaten zurück, `null`, wenn nichts gesetzt wurde.
**Reihenfolge:** erst Boden/Gelände, dann Bäume, Felsen, Bewuchs – Bodendeko (Blütenblätter, Laubstreu, Bewuchs) landet
nur auf vorhandener Erde/Gras, Laub nur in Luft. Wege möglichst nach den Bauten setzen (oder danach `fixDirtPaths`).

```js
import { tree, treeExtent, bush, bushExtent, flowerBed, vegetation, terrain, hill, pond, rock, rockExtent,
  path, pathAlong, fixDirtPaths, groundLevel, isPlantId } from '../lib/natur.js';

tree(b, { x, y, z, facing, species = 'eiche', size = 'mittel', seed, roots = true, ground = true, vines = true })
```
- **Bäume.** `species`: `eiche`, `birke`, `fichte`, `schwarzeiche`, `kirsche`, `akazie`, `dschungel`, `mangrove`
  (`TREE_SPECIES`); `size`: `klein`, `mittel`, `gross`, `riesig` (`TREE_SIZES`). Ursprung = unterster Stammblock auf
  Höhe `y` (der Boden liegt bei `y − 1`). 2×2-Stamm (Schwarzeiche immer, Dschungel ab gross, Eiche/Fichte/Mangrove riesig)
  belegt `x … x+1, z … z+1` in jeder Ausrichtung. `facing` dreht Äste und Krone (Eiche: erster Ast zeigt nach vorne,
  Akazie neigt sich nach vorne). Stamm = Stämme (`axis=y`), Äste = Holz-Blöcke (`*_wood`, Rinde rundum) mit `axis` in
  Wuchsrichtung, Wurzelansatz aus Holz-Blöcken am Fuß (ab mittel, Schwarzeiche immer; `roots: false` schaltet ab). Krone aus mehreren
  überlappenden Ellipsoiden mit ausgefranstem Rand, Laub `persistent=true`. Art-Details: Kirsche mit hängenden Blütenzweigen und
  `pink_petals` am Boden; Mangrove auf Stelzwurzeln (`mangrove_roots`) mit hängenden Keimlingen; Dschungel mit Ranken
  und Kakao (`vines: false` ohne); Eiche/Schwarzeiche mit Laubstreu; Fichte gross/riesig macht Gras unter sich teils zu
  Podsol/Grober Erde (`y − 1`). `ground: false` = keine Bodendeko.
  `treeExtent(species, size)` → `{ radius, height, trunk, below }`: alles liegt in `x − radius … x + radius (+1 bei
  trunk 2)`, `y − below … y + height − 1`, z wie x. Werte (radius/height):

  | Art | klein | mittel | gross | riesig |
  |---|---|---|---|---|
  | eiche | 3/8 | 5/10 | 7/13 | 11/16 |
  | birke | 2/11 | 3/13 | 3/16 | 4/20 |
  | fichte | 3/11 | 4/14 | 5/19 | 8/27 |
  | schwarzeiche | 4/7 | 6/9 | 7/11 | 10/14 |
  | kirsche | 4/7 | 5/9 | 7/10 | 9/12 |
  | akazie | 4/6 | 6/10 | 8/11 | 10/14 |
  | dschungel | 3/10 | 5/15 | 7/22 | 10/30 |
  | mangrove | 3/9 | 4/12 | 6/14 | 8/18 |

  Beispiel: `tree(b, { x: 5, y: 1, z: 5, species: 'kirsche', size: 'gross', seed: 2 })`.
```js
bush(b, { x, y, z, facing, size = 'mittel', leaves = 'eiche', seed, stem = true })
```
- **Busch.** Ursprung = Mitte der untersten Ebene (`y`). `size`: `klein`/`mittel`/`gross` (`bushExtent(size)` →
  radius/height 2/2, 3/3, 4/4: `x ± radius`, `y … y + height − 1`). `leaves`: Holzname mit Laub (`eiche`, `birke`, `fichte`,
  `schwarzeiche`, `kirsche`, `akazie`, `dschungel`, `mangrove`, `blasseiche`) oder `azalee` (Azaleen- und blühendes
  Azaleenlaub gemischt). `stem`: Stamm-Block in der Mitte (ab mittel). `facing` dreht die Form.
```js
flowerBed(b, { x, y, z, width, depth, facing, palette = 'bunt', soil = 'gras', border = null, wood = 'eiche',
               density = 0.8, tall = true, seed })
```
- **Blumenbeet.** Fläche `x … x+width−1`, `z … z+depth−1` (immer weltachsig), Boden auf Höhe `y`, Pflanzen auf `y+1`
  (doppelte bis `y+2`). `facing` = Vorderseite: vorne kleine Blumen in Gruppen derselben Sorte, hinten (ab 3 Reihen)
  doppelte Pflanzen über `b.tall`. `palette`: `bunt`, `warm`, `kuehl`, `rosa`, `weiss`, `wiese`; `soil`: `gras`, `erde`,
  `moos`, `podsol`; `border`: `null`, `stein` (Bruchstein/bemoost), `holz` (Stämme entlang der Kante, Ecken Holz aus `wood`).
  Beispiel: `flowerBed(b, { x: 0, y: 0, z: 8, width: 9, depth: 3, palette: 'warm', facing: 'south' })`.
```js
vegetation(b, { x, y, z, width, depth, facing, mix = 'wiese', density = 0.35, shape = 'rund', scan = 24, seed })
```
- **Bewuchs (Gras, Farne, Blumen).** Fläche wie beim Beet; `y` = obere Suchgrenze: je Säule wird der oberste Block
  zwischen `y` und `y − scan` gesucht (Pflanzen zählen nicht), Pflanzen kommen darauf – nur auf Erde/Gras/Moos
  (`trocken` auch auf Sand). Funktioniert also auf Hügeln. `mix`: `wiese`, `blumen`, `farn`, `wald` (mit Laubstreu und
  Pilzen), `trocken` (Trockengras, toter Busch). `shape`: `rund` (Ellipse mit ausgefranstem Rand) oder `eckig`. Fleckig
  verteilt (Rauschen). `facing` hat hier keine Wirkung.
```js
terrain(b, { x, y, z, width, depth, facing, height = 0, heightAt = null, shape = 'eckig', edge = 0, surface = 'gras',
             rocky = false, seed })   // → { min, max, top(x, z) }
hill(b, { x, y, z, width, depth, facing, height = 6, surface = 'gras', rocky = true, seed })   // → { min, max, top(x, z) }
```
- **Gelände.** Fläche wie beim Beet; jede Säule reicht von `y` bis `y + h`: oben `surface` (`gras`, `podsol`, `moos`,
  `erde` = grobe Erde/Erde/Wurzelerde, `sand` mit Sandstein darunter), darunter 2–3 Erde, unten Stein mit Andesit-, Kies-
  und Tuffnestern (die Seiten zeigen die Schichten). `h = heightAt(dx, dz)` (dx/dz ab der Nordwestecke, Kommazahlen werden
  gerundet, negativ = Loch) oder fest `height`. `edge` > 0 lässt die Höhe zum Rand weich auslaufen; `shape: 'rund'` =
  Ellipse mit ausgefranstem Rand. `rocky`: steile Stellen (≥ 2 Stufen) bekommen Stein/Andesit/bemoosten Bruchstein.
  `top(x, z)` liefert den obersten Geländeblock (Aufrufer-Koordinaten) oder `null`. `facing` hat bei `terrain` keine Wirkung.
  **Hügel** = runde Kuppe bis `y + height`, Höhenlinien verzerrt (keine Ringe); `facing` = Seite mit dem langen, flachen Hang
  (Gipfel nach hinten versetzt, gut für Wege hinauf). Beispiel: `const h = hill(b, { x: 0, y: 0, z: 0, width: 30, depth: 24,
  height: 8 }); tree(b, { x: 12, y: h.top(12, 10) + 1, z: 10, species: 'fichte' })`.
```js
pond(b, { x, y, z, width, depth, facing, waterDepth = 2, shore = 'sand', lilyPads = true, reeds = true, seagrass = true, seed })
```
- **Teich.** Fläche wie beim Beet (5 … 64), `y` = Wasserspiegel = Oberkante des umgebenden Bodens. Wasser nur als Quellen
  (`water[level=0]`), in der Mitte `waterDepth` tief, am Rand 1; Grund und Seiten unter dem Spiegel aus Sediment
  (Sand/Ton/Kies/Schlamm), damit nichts ausläuft; Ufer-Ring auf `y` (`shore`: `sand`, `ton`, `kies`, `gemischt`), auf der
  `facing`-Seite ein breiterer Sandstrand. Seerosen nur auf Wasserquellen, Schilf = Zuckerrohr (1–3 hoch) nur auf
  Sand/Erde/Gras direkt neben Wasser, Seegras ab 2 Tiefe. Pflanzen über der Fläche werden entfernt. Ausdehnung:
  `y − waterDepth … y + 3`.
```js
rock(b, { x, y, z, facing, size = 'mittel', material = 'stein', moss = true, sink = 1, rubble = true, seed })
```
- **Felsen.** Ursprung = Mitte auf Bodenhöhe `y` (unterste Felsreihe auf `y − sink`, also eingesunken). `size`: `klein`,
  `mittel`, `gross`, `riesig`; `material`: `stein`, `andesit`, `tuff`, `granit`, `diorit`, `schiefer`, `sandstein`
  (Gemisch in Flecken). `moss`: Moos/bemooster Bruchstein auf freien Oberseiten, teils Moosteppich. `rubble`: Geröll
  (Stufen/Blöcke) rundherum, nur auf vorhandenem Boden. Lange Seite zeigt nach `facing`.
  `rockExtent(size, { sink, rubble })` → `{ radius, height, below }`: `x ± radius`, `y − below … y + height − 1`
  (radius ohne Geröll 2/3/4/6, Geröll +2; height 3/4/5/7).
```js
path(b, { x, y, z, facing, length, width = 3, mix = 'erde', wiggle = 1, follow = false, seed })
pathAlong(b, { y, points: [[x, z], …], width = 3, mix = 'erde', wiggle = 0, follow = false, seed })
fixDirtPaths(b, { x1, y1, z1, x2, y2, z2 })   // → Anzahl umgewandelter Blöcke
groundLevel(b, x, z, { from, depth = 24 })    // → y des obersten Nicht-Pflanzen-Blocks oder null
```
- **Wege.** Ersetzen die Bodenschicht auf Höhe `y` (dort, wo das Gras liegt). `path`: Ursprung = Mitte der Anfangskante,
  läuft `length` Blöcke in `facing`-Richtung; quer `±(width/2 + wiggle)` (gerade Breite: eine Spalte mehr auf einer Seite).
  `pathAlong` folgt einer Linie aus Punkten (Ecken gerundet; Abweichung von der Signatur: `points` statt x/z/facing).
  `mix`: `erde` (vor allem Erdpfad, dazu grobe Erde, Kies, Wurzelerde), `kies`, `gemischt`; Ränder ausgefranst und gröber.
  **Erdpfad nie unter einem Block:** steht über einer Stelle etwas (außer Pflanzen, die entfernt werden), wird grobe Erde
  gesetzt. `wiggle` = seitliches Schlängeln (an Anfang und Ende 0). `follow: true` = `y` ist die obere Suchgrenze, der Weg
  liegt auf dem jeweils obersten Boden (Hügel). Ohne `follow` wird unter dem Weg bei Luft Erde ergänzt (`y − 1`).
  `fixDirtPaths` wandelt nachträglich jeden Erdpfad mit etwas darüber in grobe Erde um.
- Konstanten zum Auswählen: `TREE_SPECIES`, `TREE_SIZES`, `BUSH_SIZES`, `BUSH_LEAVES`, `ROCK_SIZES`, `ROCK_MATERIALS`,
  `FLOWER_BED_PALETTES`, `VEGETATION_MIXES`, `PATH_MIXES`, `POND_SHORES`, `TERRAIN_SURFACES`; `isPlantId(id)`.
- Bekannte Grenzen: Laub wird nicht über `distance` berechnet (immer `persistent=true`). Bodendeko und Geröll prüfen nur
  den Block direkt darunter. Teiche erwarten flachen Boden – höheres Gelände über dem Spiegel bleibt stehen.

## 10. Skripte und Tests

- `node scripts/serve.mjs [--port 8080]` – lokaler Server (nur 127.0.0.1).
  Änderung (Prüfung Kern/3D): der Server beantwortet nur Anfragen mit Host `127.0.0.1:<port>` oder `localhost:<port>`
  (sonst 403, Schutz vor DNS-Rebinding); `isAllowedHost(host, port)` ist exportiert.
- `node scripts/extract-game-data.mjs [--jar …] [--assets …] [--offline]` – Spieldaten erzeugen
  (Änderung: `--offline` = Blockbericht nur aus dem Cache, sonst „derived“; Laufzeit ≈ 1–2 s).
  Änderung (cloud:spieldaten): `--remote [--offline]` lädt aus öffentlichen Quellen statt Jar (§5; verträgt sich nicht mit
  `--jar`/`--assets`), `--out <ordner>` schreibt statt nach `game-data/` dorthin (Cache `<ordner>/.cache/`). Fehlt das Jar,
  nennt die Meldung `--remote`. `parseCliArgs` liefert `remote`/`out` nur, wenn gesetzt. Als Bibliothek:
  `extractGameData({ remote: true, out, offline }, log)`.
  Änderung (ohne Minecraft): ohne `--jar`, `--assets` und `--remote` und ohne Jar am Standardort wechselt der Aufruf
  automatisch auf `--remote` (Meldung „Keine Minecraft-Installation gefunden“). Entscheidung in
  `chooseSource(options, { jarPath, exists })` → `{ options, auto, jarPath }`; `extractGameData` selbst bleibt unverändert.
- `node scripts/check-imports.mjs [--root <ordner>]` (cloud:spieldaten) – prüft alle statisch erkennbaren lokalen Verweise auf
  exakte Groß-/Kleinschreibung (unter Linux entscheidend): JS/MJS in `js/`, `scripts/`, `tests/` (`import … from`,
  `export … from`, `import('…')`, `new URL('…', import.meta.url)` und daraus gebildete Basis-Variablen, `new Worker('…')`,
  `fetch('…')` – die beiden letzten relativ zur Seite: für `js/` die Projektwurzel), HTML (Wurzel und `tests/`: `src`/`href`)
  und CSS (`url()`, `@import`). Erzeugte Ordner (`game-data/`, `thumbs/`, `tmp/`) zählen nicht. Ausgabe `datei:zeile: art
  „verweis“ – grund`, Exit-Code 1 bei Funden. Als Bibliothek: `checkImports({ root })` → `{ files, references, errors }`.
- `node scripts/check-build.mjs <modulpfad>` – Modul bauen, prüfen (Blöcke/Zustände gültig,
  Grenzen, Titel, Untertitel und Beschreibung vorhanden), Kennzahlen ausgeben; Exit-Code 1 bei Fehlern.
  Änderung: Optionen `--scale <zahl>`, `--json` (Bericht als JSON: `ok, module, id, title, category, scale,
  size, blockCount, phases, steps, phaseList, materials[{item,name,count,amount}], topMaterials, warnings,
  errors, durationMs`) und `--data <ordner>` (andere Spieldaten, z. B. `tests/fixtures/core`). Prüft zusätzlich
  meta (§9), baut zweimal (deterministisch?) und sucht im Quelltext nach `Math.random`, Zeit-, Netzwerk- und
  DOM-Zugriffen. Als Bibliothek: `checkBuild(pfad, { scale, dataDir })`, `validateMeta(meta, { fileId,
  folderCategory })`.
  Änderung (2026-10-28): `meta.difficulty` und `meta.facts` sind Fehler („… gibt es nicht mehr.“), die Warnung „Kapitel … hat
  keinen Text“ entfällt (geprüft werden nur noch die Texte in meta), die Warnung zu `tested` gilt nur noch für `farmen`.
  Leere Schritte nennen Nummer und Kapitel („Schritt 3 (Kapitel „Möbel“) setzt keine Blöcke.“). `CATEGORIES` (7 Kategorien)
  nutzen auch `build-catalog.mjs` und `start.mjs`. Tags, die eine Schwierigkeit nennen, sind Fehler (§9).
- `node scripts/shot.mjs --module <pfad> | --structure <datei> [--views iso,front,top] [--out tmp/shots]`
  – Screenshots über Chrome (für Sichtprüfungen).
  Änderung: weitere Quellen `--gallery <gruppe|all>` (ohne `--page` alle Seiten) und `--synthetic <anzahl>`; Optionen
  `--progress 25,50,75` (zusätzliche Bilder bei diesen Prozent der Schritte), `--clip <y>`, `--ghost`, `--highlight <schritt>`,
  `--size 1280x800`, `--page <n>`, `--rows` (Galerie: Nahaufnahme je Reihe), `--focus x,y,z[,r]` (Nahaufnahme eines Blocks),
  `--gpu hardware|swiftshader` (Standard Grafikkarte, ohne WebGL2 dort Rückfall auf swiftshader), `--bench <s>` (Kamera dreht,
  FPS). Bilder unter `<out>/<name>/<ansicht>[-p50][-clip3][-ghost].png`; Ausgabe: Kennzahlen, Zeiten, Warnungen, fehlende
  Texturen, bei Galerien die Reihen. Exit-Code 1 bei Browser-Fehlern, 2 bei falschen Optionen.
- Änderung: Testseite `tests/visual/viewer.html` – `?structure=<datei>` | `?module=<pfad>` | `?gallery=1` | `?gallery=<gruppe>`
  `[&page=n]` | `?synthetic=<anzahl>` (ohne Angabe das Beispielhaus aus `tests/fixtures/core/`), dazu `view`, `progress` (Prozent)
  oder `step` (Schritt-Kommazahl), `clip`, `ghost=1`, `highlight`, `mode=walk`, `scale`, `ui=0` (nur die 3D-Ansicht),
  `bench=<s>`. Bedienleiste mit Ansichten, Laufen, Geist, Fortschritt (Schieber, ‹ Abspielen ›), Schnitt, Hover-
  Infos und Kennzahlen. Fertig-Signal: `window.__viewerTest.ready` (oder `.error`), dazu `result`, `stats`, `status`, `hover`,
  `picks`, `bench`; `window.__viewer` ist die Viewer-Instanz.
- `node scripts/build-catalog.mjs` – Katalog erzeugen.
  Änderung (catalog): findet `js/builds/<kategorie>/<id>.js` (nur Kategorie-Ordner aus §8; `lib/` still, andere Ordner mit
  Hinweis übersprungen), prüft jedes Modul mit `checkBuild` für jeden Maßstab und die Original-Strukturen (Datei vorhanden, Größe
  und Blockzahl wie `structures/index.json`, keine Vorlage doppelt); doppelte IDs sind ein Fehler (alle Einträge der ID fallen weg).
  Fehlerhafte Einträge fehlen im Katalog, alle Fehler stehen am Ende, Exit-Code 1 (2 bei falschen Optionen); der Katalog wird
  trotzdem geschrieben. Ausgabe: Tabelle je Kategorie, Bilder-Zahl, Warnungen, Laufzeit. Optionen `--thumbs [--force]`
  (danach `make-thumbs`, thumb-Felder neu), `--modules-dir <ordner>`, `--structures <datei>` | `--no-structures`, `--data <ordner>`,
  `--out <datei>`, `--thumbs-dir <ordner>`. Als Bibliothek: `buildCatalog({ modulesDir, structuresFile, dataDir, thumbsDir })` →
  `{ catalog, errors, notes, stats }`, `catalogModule`, `catalogStructures`, `analyzeStructure`, `sizeClass`, `serializeCatalog`,
  `writeCatalog`, `writeFileAtomic`.
  Änderung (Webseite, Etappe 1): Standard für `--out` ist `data/catalog.json` (`DEFAULT_OUT`); `--thumbs` rendert nur noch die
  Bilder (der Katalog bekommt keine thumb-Felder). Neu: `codeFingerprint`, `dataFingerprint`, `catalogInputs`,
  `writeCatalogIfChanged`. `moduleSources` liegt jetzt in `scripts/lib/module-sources.mjs` (make-thumbs exportiert es weiter).
- `node scripts/make-thumbs.mjs [--force] [--only <id>]… [--catalog <datei>] [--out thumbs] [--data <ordner>]
  [--gpu hardware|swiftshader] [--prune]` (catalog) – Vorschaubilder: ein Chrome (Grafikkarte, sonst swiftshader) lädt
  `tests/visual/thumb.html` und rendert jeden Eintrag mit dem echten Viewer in doppelter Auflösung, verkleinert auf **WebP
  640×400** (`thumbs/<id>.webp`). Kamera: Iso (yaw 35°, pitch 28°), lange Bauten (Seitenverhältnis ≥ 2,2) von der Längsseite
  (yaw 22° bzw. 68°, ab 4 : 1 yaw 10° bzw. 80° und pitch 22°), hohe (Höhe ≥ 1,5 × längere Seite) mit pitch 12°, flache
  (Höhe ≤ 0,2 × längere Seite) mit 42°; die Box füllt das Bild mit 7 % Rand. Von welcher Ecke aus, entscheidet `sideScores`:
  je Seite die zuerst sichtbaren Blöcke, gezählt die vom häufigsten Block abweichenden; eine andere Ecke (gespiegelte Winkel) gewinnt
  erst ab 15 % mehr Abwechslung.
  Neu gerendert wird nur bei geändertem Hash (Eintrag ohne `thumb`, Modul-Quelltext samt relativ importierter Dateien,
  Strukturdatei, Spieldaten-Stand `version|worldVersion|resourcePack`, `THUMB_STYLE`) – gespeichert in `thumbs/index.json`
  (`{ version: 1, style, size, entries: { <id>: { hash, bytes, renderedAt } } }`). Danach trägt es die thumb-Felder in den
  Katalog ein. Änderung (Webseite, Etappe 1): Der Katalog bleibt unverändert, Standard für `--catalog` ist `data/catalog.json`. `--prune` löscht Bilder ohne Katalog-Eintrag (sonst nur Hinweis). Schlägt ein Bild fehl, lädt es die Seite neu und
  versucht es einmal. Als Bibliothek: `makeThumbs({ catalog, outDir, dataDir, force, only, gpu, prune, log })` →
  `{ rendered, skipped, retried, errors, orphans, durationMs }`. Render-Seite: `window.__thumb.render({ source, scale })` →
  `{ ok, data (Base64-WebP), bytes, blocks, ms }`; die Kamera-Helfer `thumbAngles`/`thumbOrbit` in `tests/visual/thumb.js` sind rein.
- `node --test "tests/unit/**/*.test.mjs"` – Unit-Tests (Ordnername allein geht nicht).
  `node tests/e2e.mjs` – Klick-Test.
  Änderung (Integration Runde 2): `node tests/e2e.mjs [--only start,bau,erstellen,handy] [--gpu hardware|swiftshader] [--out <ordner>]`
  prüft im echten Chrome gegen den echten Katalog (`game-data/catalog.json`, seit Etappe 1 `data/catalog.json`; fehlt er → Exit-Code 2): Start → Kategorie (Filter,
  Sortierung, Zurück) → Bau-Seiten (Tokyo Skytree 1:1 mit Maßstab-Wechsel, Infinity Castle, ein Dorfhaus `spiel-…`, eine Farm
  mit `tested: false` (seit 2026-10-28 statt eines Redstone-Baus): Schritte, Abspielen, Tabs, Abhaken + Neuladen, Ebenen-Plan, Schnitt,
  Laufen, Bildrate) → „Selber erstellen“ (Freitext, Upload
  je Fixture-Format) → Handy 390 × 844. Ausgabe je Prüfung `OK`/`FEHLER`, Leistungswerte, Screenshots und `e2e-report.json` (Standard
  `tmp/integration/e2e/`); Exit-Code 1 bei Fehlern. Konsolenfehler zählen als Fehler (einzige Ausnahme: die absichtlich kaputte
  Upload-Datei, deren Ablehnung `renderer.js` mit `console.error` meldet).
- Änderung (Integration Runde 2): `node scripts/start.mjs [--port 8080] [--remote] [--no-thumbs]` – ein Befehl zum Starten: fehlen
  Spieldaten (`meta.json`, `blocks.json`, `names.json`, `models.json`, `textures.json/.bin`, `structures/index.json`, Version 26.2),
  ruft es `extract-game-data.mjs` (mit `--remote` aus dem Netz); ist der Katalog älter als `js/builds/`, `js/core/`, `build-catalog.mjs`,
  `check-build.mjs`, `structures/index.json` oder `blocks.json` (oder fehlt er), ruft es `build-catalog.mjs --thumbs`; dann startet
  der Server (belegter Port → die nächsten 9 probieren, außer bei `--port`). Exportiert `parseStartArgs`, `checkGameData`, `checkCatalog`.
  Änderung (ohne Minecraft): `ensureGameData({ remote, run, check, minecraftJar, log })` → `'present' | 'local' | 'remote'`.
  Jar am Standardort (`findMinecraftJar()`) → daraus lesen; scheitert das, ohne Jar oder mit `--remote` →
  `extract-game-data.mjs --remote`. Fehlen danach noch Dateien → Fehler mit Hinweis aufs Internet. Die Fehleranzeige der Seite
  nennt bei fehlendem `game-data/` (Katalog und `meta.json` fehlen) nur noch `node scripts/start.mjs`; bei einzelnen
  fehlenden Spieldaten `node scripts/extract-game-data.mjs` (geht ebenfalls ohne Minecraft). `serve.mjs` nennt beim Start
  `start.mjs`, wenn `game-data/catalog.json` fehlt.
  Änderung (Webseite, Etappe 1): Die Seite nennt nie Befehle (sie läuft auch online, z. B. auf dem Handy): Fehlerzustände sagen,
  was fehlt, und bieten Neuladen an; Entwickler-Hinweise stehen nur in der Konsole. `checkCatalog` ist async und vergleicht den
  Fingerabdruck (`inputs`) statt Dateizeiten (die nach `git pull` nichts aussagen); Katalog = `data/catalog.json`. `serve.mjs`
  nennt `start.mjs`, wenn `game-data/meta.json` fehlt.
- `tests/browser.mjs` – Chrome über DevTools-Protokoll, freier Debug-Port (parallele Läufe gehen).
  `launchBrowser({ gpu: 'hardware' })` nutzt die Grafikkarte (Intel UHD 770, D3D11),
  `gpu: 'swiftshader'` Software-WebGL. Beide liefern WebGL2 mit 2048 Textur-Ebenen.
  Änderung (Vorbereitung Runde 2): `page.route(match, { file } | { body, status, contentType })` beantwortet
  Anfragen, deren URL `match` enthält, mit Testdaten (vor `goto` aufrufen; gilt nur für die Hauptseite, nicht im
  Worker); `page.unroute(match?)` hebt das auf (ohne Argument alle). `page.setInputFiles(selector, [pfade])` wählt
  Dateien in einem `<input type="file">` und löst `input`/`change` wie eine echte Auswahl aus.
  Änderung (cloud:spieldaten): unter Linux sucht `chromeCandidates()` nach `CHROME_PATH`, `/usr/bin/google-chrome(-stable)`,
  `/opt/google/chrome/chrome`, `/usr/bin/chromium(-browser)`, `/snap/bin/chromium` und Playwright-Browsern
  (`$PLAYWRIGHT_BROWSERS_PATH` bzw. `~/.cache/ms-playwright/chromium-<rev>/chrome-linux*/chrome`, neueste zuerst);
  `platformChromeFlags()` ergänzt unter Linux `--disable-dev-shm-usage` und als root `--no-sandbox`. Windows unverändert.

## 11. Design

- Eigene Identität „Block-Kompass“: Logo = Pixel-Kompass (eigene SVG). Kein Standard-KI-Look,
  keine Bootstrap-Optik.
- Farben (Tokens in `css/style.css`): Tiefenschiefer-Dunkel als Grund (`#15171b`, Flächen
  `#1e2127`/`#272b32`), warmes Weiß `#ece8df`, Grasgrün `#5da33b`, Kupfer `#d0703c`,
  Oxidiert-Türkis `#4fa38b`, Gold `#f2c14e`, Redstone-Rot `#e0342f`, Diamant `#5de3d8`.
  Kategorie-Farben: Häuser Eiche `#b8945f`, Wahrzeichen Gold, Fantasy Amethyst `#9a5cc6`,
  Mittelalter Stein `#9a9a9a`, Klein Blüte `#e57ca3`, Farmen Weizen `#d9b84a`,
  Infrastruktur Kupfer. Änderung (2026-10-28): Die Kategorie Redstone (`--cat-redstone`, Icon `cat-redstone`) ist weg;
  `--c-redstone`, `--c-redstone-deep` und `--c-redstone-text` bleiben als Fehlerfarben.
- Schriften lokal (Google Fonts, OFL, heruntergeladen): Überschriften **Pixelify Sans**,
  Text **Atkinson Hyperlegible Next**, Zahlen/Koordinaten **Atkinson Hyperlegible Mono**.
  Änderung: Überschriften nutzen die zusammengesetzte Schrift „BK Display“ – Buchstaben aus Pixelify Sans,
  Ziffern 0–9 per `unicode-range` aus Atkinson Hyperlegible Mono, weil Pixelify-Ziffern in kleinen Größen
  kaum unterscheidbar sind (2/8, 5/S). Kleine Zahlen (Mengen, Schrittnummern, XP-Level) sind immer Mono.
- Änderung (Kontrast): Redstone-Rot, Amethyst und Kupfer erreichen als Text auf dunklen Flächen kein AA und
  dienen nur für Flächen, Ränder und Icons (≥ 3 : 1). Für Text gibt es hellere Tokens `--c-grass-text`
  `#8fd163`, `--c-copper-text` `#f09563`, `--c-redstone-text` `#ff8a80`, `--c-oxidized-text` `#6fc7ad`,
  `--c-amethyst-text` `#c39be8`. Alle Text/Fläche-Paare stehen in der Kontrasttabelle von
  `tests/visual/styleguide.html` und werden von `tests/unit/ui-contrast.test.mjs` geprüft.
- Details: Fortschritt als segmentierte „XP-Leiste“, Tooltips im Spiel-Stil (dunkel mit
  violettem Rand), Material als Inventar-Slots mit Block-Icons, Hover-Anhebung mit Pixel-Schatten,
  sanfte Übergänge, Plopp-Animation der Blöcke; alles respektiert `prefers-reduced-motion`.

## 12. Selber erstellen (`js/create/`)

### 12.1 Freitext und Formen (`search.js`, `text-parser.js`, `block-lookup.js`, `shape-generators.js`)

Keine KI: Katalogsuche, Formen-Generator und ein ehrliches „nicht gefunden“. Alles rein (kein DOM), läuft in Browser, Worker
und Node. Katalog = `data/catalog.json` (Format §9, Runde 2; bis Etappe 1 `game-data/catalog.json`), Namen = `names.json`, Blöcke = `blocks.json` (§5).

```js
// search.js – auch für die Textfilter der Seiten
normalize(text)          // klein, ä→ae ö→oe ü→ue ß→ss, Akzente/Satzzeichen weg, Leerraum zusammengefasst
tokenize(text)           // Wörter ohne Füllwörter (STOPWORDS), ohne Doppelte, höchstens 12; nur Füllwörter → bleiben
searchCatalog(catalog, query, { limit = 20, category, threshold = MATCH_THRESHOLD, relative = 0 })
  // → [{ entry, score (0 … 1), matched: [{ token, field, kind: exact|synonym|stem|prefix|part|typo, text }] }], beste zuerst
  // leere Suche → alle Einträge mit score 0; relative > 0: nur Treffer ≥ relative · bester, gibt es einen genauen Titel/Alias → nur diese
MATCH_THRESHOLD = 0.45 · SUGGEST_THRESHOLD = 0.2 · SYNONYM_GROUPS · damerauLevenshtein(a, b, max) · allowedTypos(len) · scoreEntry · catalogEntries
```
- Bewertung je Suchwort: bestes Feld (Gewicht title 10, aliases 9, id 8, tags 8, subtitle 5, Kategorie 4) × Güte (genau 1,
  Synonym 0,9, Wortstamm 0,9, Wortanfang 0,75/0,85, Teil eines Worts 0,6, Tippfehler 0,75/0,6); Summe / (Wörter · 10). Ganze
  Wortgruppe am Stück = Titel/Alias/ID („tokyo sky tree“) → 1. Tippfehler erst ab 5 Buchstaben (1), ab 8 (2), gleicher Anfangsbuchstabe.

```js
// block-lookup.js
findBlocks(query, { names, blocks, limit = 8, fullOnly = false }) // → [{ id, name, nameEn, score, full }]
blockForText(text, { names, blocks, fullOnly })                   // → ID oder null (Schwelle 0,6)
stairsFor(id, { blocks })  // stone_bricks → stone_brick_stairs, oak_planks → oak_stairs … oder null
blockDisplayName / blockDisplayLabel(id, names) („Steinziegel · minecraft:stone_bricks“) · isShapeFriendly(id) · isPlaceableAlone(id, blocks) · blockExists
```
- Deutsche und englische Namen und IDs; beide Seiten mit gleichem Wortstamm (Endungen ern/em/en/er/es/e/n/s wiederholt ab),
  „Buntglas“ mit Farbe → „… Glas“; Stoffwörter ohne eigenen Block (`MATERIAL_DEFAULTS`: Holz → oak_planks, Beton → white_concrete,
  Eisen → iron_block …) knapp unter einem genau gleichen Namen. Nur Blöcke aus `blocks` (Objekt aus blocks.json, Liste oder Menge;
  ohne → geladene Kerndaten, sonst die Schlüssel aus names.json); nicht setzbare (Luft, Feuer …) fallen weg.
- Änderung: „voller Block“ für Formen = `isSturdyFull` (statt `isFullSolid`), damit Glas, Buntglas und Eis ohne Warnung gehen.

```js
// shape-generators.js
SHAPES = { sphere, dome, cylinder, cone, pyramid, cube, cuboid, ellipsoid, torus, circle, arch, 'spiral-stairs' }
  // je { id, title, description, params: [{ key, label, type: 'int'|'block'|'bool'|'enum', default, min?, max?, step?, unit?,
  //      options?: [{ value, label }], optional? (block: '' = keiner), emptyLabel?, kind?: 'stairs', dependsOn?, hint? }],
  //      estimate(p), size(p) → [w, h, l], check?(p) → [Fehler], build(b, p) }
SHAPE_IDS · MAX_SHAPE_BLOCKS = 2_000_000 · defaultShapeParams(id) · shapeSize(id, params)
validateShapeParams(id, raw, { blocks }) // → { ok, params (vollständig), errors, warnings, estimate }
buildShape(b, id, params)                // Worker-Vertrag §7.4: prüft, baut in den Builder, wirft Error mit deutschen Meldungen
parseShapeQuery(URLSearchParams | text, { blocks }) // → { ok, shape, params, errors, warnings } – nur bekannte Parameter
shapeQueryString(id, params)             // „form=sphere&diameter=31&block=glass&hollow=1&thickness=1“ (ohne „?“, bool = 1/0)
```
- Parameter (Schlüssel passen zu `checkParams` im Worker): sphere/dome/circle `diameter, block, hollow, thickness`; cylinder
  `diameter, height, block, hollow, thickness, floor, battlements, roof (none|flat|cone|dome), roofBlock`; cone `diameter, height,
  block, hollow, thickness`; pyramid `width, block, hollow, thickness`; cube `size, block, hollow`; cuboid/ellipsoid `width, height,
  length, block, hollow (+ thickness)`; torus `radius, tube, block, hollow`; arch `width, height, depth, thickness, block`;
  spiral-stairs `height, radius, stairs, core, wall, clockwise`. Grenzen stehen in `params` (z. B. Durchmesser 3–301, Höhe bis 512).
- Unbekannte Parameter, falsche Typen und Werte außerhalb der Grenzen → Fehler. Blöcke: muss es geben (blocks/Kerndaten), einzeln
  setzbar (keine Türen, Betten, hohen Pflanzen, Luft, Wasser …), bei `kind: 'stairs'` eine Treppe; kein voller Block → Warnung.
  Vorab-Schätzung (Obergrenze) > 2 Mio. → Fehler „… höchstens 2 Mio. Mach sie kleiner oder hohl.“
- Alle Formen beginnen auf y = 0, Mittelpunkte/Radien wie §6.2 (gerader Durchmesser exakt). Kapitel ohne `b.step()` (eine Ebene
  je Schritt), nur mit Titel (seit 2026-10-28 ohne Text und Tipps); ab 11 Ebenen und 800 Blöcken 2 Kapitel (Hälften), ab 25 Ebenen Drittel, ab 121 Viertel, Titel
  mit Ebenen („Kugel: Unteres Drittel (Ebene 1–20)“). Turm: „Boden“, „Mauer …“, „Flachdach“, „Zinnen“, „Kegeldach“/„Kuppeldach“
  (mit Zinnen steht das Kegel-/Kuppeldach einen Block eingerückt zwischen ihnen); Bogen: „Pfeiler“, „Bogen“; Wendeltreppe ohne
  Markierung (Notizen gibt es nicht mehr). Hohle Kugeln, Ellipsoide und Ringe sind dicht; Pyramide, Kegel, Kuppel und Turm unten offen.

```js
// text-parser.js
parseRequest(text, { catalog, names, blocks }) // genau eines von:
  { kind: 'build', query, matches: [{ entry, score, scale }], scale, scaleText, notes: [], alternative: null | { kind: 'shape',
    shape, params, queryString }, truncated }
  { kind: 'shape', query, shape, title, params, understood: [], defaults: [], warnings: [], errors: [], ok, estimate, queryString, truncated }
  { kind: 'none', query, suggestions: [{ entry, score }], reason, hints: NONE_HINTS, truncated }
extractScale(folded) · formatScale(0.5) → „1:2“ · cleanRequest(raw) → { text, truncated } · MAX_REQUEST_LENGTH = 200
```
- Eingabe: Text, Steuer-/unsichtbare Zeichen raus, höchstens 200 Zeichen (nach Codepunkten).
- Maßstab: „1:1“, „1 zu 1“, „Originalgröße/-grösse/Original-Größe/originalgroß“, „1 Block = 1 m“, „echte Größe“, „in echt“ → 1;
  „halbe Größe“, „1:2“, „50 %“ → 0,5; „Viertel“, „Maßstab 1:4“ → 0,25; „Drittel“. Nur Maßstäbe aus `entry.scales`, sonst der
  nächste (Hinweis in `notes`); ohne Angabe `defaultScale`; Bau ohne Maßstäbe → `scale: null` und Hinweis, falls einer angegeben war.
- Form erkannt über Schlüsselwörter (Kugel, Kuppel/Halbkugel, Turm/Säule/Zylinder/Röhre, Kegel, Pyramide, Würfel, Quader, Ellipsoid,
  Torus/Donut/Ring, Kreis/Scheibe, (Tor-)Bogen, Wendeltreppe) auch zusammengesetzt mit Material („Glaskugel“, „Steinturm“). Maße:
  „Radius 15“ (→ Durchmesser 31), „Durchmesser 9“, „40 hoch“, „31 breit“, „3 tief“, „2 dick“, „10x5x20“ (Breite × Höhe × Länge),
  Zahlwörter bis hundert, Zahlen ohne Wort der Reihe nach auf die Hauptmaße; „hohl“/„voll“, „mit Boden/Zinnen/Dach/Flachdach“,
  „gegen den Uhrzeigersinn“, „mit Wand“; Material „aus …“ (auch „Dach aus …“, „Wand aus …“; Wendeltreppe → passende Treppe).
  Zu große/kleine Zahlen werden auf die Grenze gesetzt (Warnung); Ungenutztes wird in `warnings` genannt.
- Mehrdeutige Wörter (Turm, Tower, Pyramide, Bogen, Ring): ohne Maße/Material und mit Katalog-Treffern → `kind: 'build'` mit
  mehreren Treffern und der Form als `alternative`. Passt ein weiteres Wort zu einem Katalog-Eintrag („Tokyo Tower“) → Bau.
- `none`: Vorschläge nur aus echten Katalog-Einträgen (SUGGEST_THRESHOLD); `reason` z. B. „Für „Burj Khalifa“ gibt es noch keinen
  geprüften Bauplan.“; `hints` verweisen auf Formen-Generator und Datei-Import. Texte immer per `textContent` ausgeben.

### 12.2 Datei-Import (`js/create/import/`)

Fertige Bauten aus dem Netz laden → 3D-Ansicht + Anleitung (Kapitel „Aufbau“ in Ebenen; Litematica: je Region ein Kapitel
„Region „Name““). Kapitel nur mit Titel (`{ title, blocks, count }`, `b.phase(part.title)`), ohne Text. Dateien: `index.js` (Dispatcher), `nbt.js` (reiner NBT-Leser), `schem.js`, `litematic.js`,
`structure-nbt.js`, `rename.js` (Zustände auf 26.2), `common.js` (ImportError, Grenzen, Block-Sammler).

```js
// Viewer (Hauptthread) – die Datei geht als ArrayBuffer an den Worker
await viewer.load({ kind: 'upload', format, name, data: arrayBuffer, params })
//   format: 'schem' | 'litematic' | 'nbt' | 'vox' | 'stl' | 'obj' | 'glb' | 'gltf' (aus der Endung, formatFromName)
//   → BuildResult wie bei Strukturen, zusätzlich result.upload (Kennzahlen, s. u.);
//     result.source = { kind:'upload', format, name, bytes, params } (ohne die Datei)
// js/create/import/index.js (Browser, Worker, Node)
importFile({ format, name, data, params, onProgress, loadBlockColors, importVoxelizer, limits }) // → Promise<ImportResult>
importToBuildResult(imported, { onProgress })   // → BuildResult (Builder, raw: keine Auto-Verbindungen)
formatFromName(name) / cleanFileName(name) / sniffContent(bytes)
UPLOAD_FORMATS · NBT_FORMATS · MODEL_FORMATS · UPLOAD_ACCEPT (für accept=) · FORMAT_LABELS · IMPORT_LIMITS · ImportError · WORLD_VERSION (4903)
// js/create/import/nbt.js (auch von scripts/lib/nbt.mjs genutzt, der dort nur zlib dazunimmt)
parseNbt(bytes, { maxDepth, maxNodes }) · readNbtAsync(bytes, { maxBytes }) · inflate(bytes, 'gzip'|'zlib', { maxBytes })
detectCompression(bytes) · longArrayWords(bigInt64Array) · decodeModifiedUtf8 · TAG · NbtError (code corrupt|limit|unpacked-too-large|unsupported)
```
- **Formaterkennung am Inhalt:** gzip/zlib-Kennung → NBT; danach entscheidet der NBT-Aufbau: `Regions` → Litematica,
  `Schematic { Version }` bzw. Wurzel mit `Version` + `BlockData`/`Palette` → Sponge v1–v3, `size` + `blocks` + `palette(s)` →
  Strukturdatei, `Blocks` + `Data`/`Materials` → alte MCEdit-Schematic (Fehler `legacy-schematic`). `VOX ` → vox, `glTF` → glb,
  JSON → gltf, sonst gilt die Endung. Weicht der Inhalt von der Endung ab, wird er trotzdem geladen (Warnung). Ungepacktes NBT
  zählt nur bei Minecraft-Endungen.
- **Achsen:** Sponge `index = x + z·W + y·W·L` (Width/Height/Length als Short, vorzeichenlos; Varint-Daten, v3 unter
  `Blocks { Palette, Data }`); Litematica `index = (y·|sz| + z)·|sx| + x` relativ zur kleinsten Ecke der Region
  (negative Size: Region von `Position + Size + 1` bis `Position`), Bits je Eintrag `max(2, Bitlänge(Palette − 1))`, lückenlos über
  Long-Grenzen; Strukturdatei: `pos` je Block, `jigsaw` → `final_state`, `structure_block` fällt weg, erste Palette.
  Nach dem Lesen liegt die kleinste Ecke aller Blöcke bei (0, 0, 0).
- **Zustände:** Namensraum weg, Kleinschreibung; `BLOCK_RENAMES` (`sign`→`oak_sign`, `wall_sign`→`oak_wall_sign`,
  `grass_path`→`dirt_path`, `grass`→`short_grass`, `chain`→`iron_chain`; Test prüft jede Zeile gegen `game-data/blocks.json`);
  Mauer-Seiten `true/false` (bis 1.15) → `low/none`. Fremder Namensraum, unbekannter Block, unlesbarer Text → weg; unbekannte
  Eigenschaft → ignoriert; unbekannter Wert → Standardwert; fehlende Eigenschaften = Standardwerte (wie `completeState`).
  `air`, `cave_air`, `void_air`, `structure_void` fallen weg. Block-Entities (Truhen-Inhalte, Schildtexte) werden ignoriert und
  nur gezählt, Entities gezählt und als Warnung gemeldet. Die Palette enthält nur genutzte Zustände.
- **Grenzen (`IMPORT_LIMITS`):** Datei ≤ 64 MB, entpackt ≤ 256 MB (Abbruch beim Entpacken über `DecompressionStream`),
  ≤ 3 000 000 Blöcke, jede Kante (gesetzte Blöcke) ≤ 4064, NBT-Tiefe ≤ 512, ≤ 40 Mio. NBT-Werte; `__proto__` bleibt normaler
  Schlüssel. Der Worker prüft zusätzlich Format, `ArrayBuffer` und 64 MB (`checkUploadSource`).
- **Fehler** (`ImportError.code` → Meldung, im Viewer als `ViewerError` mit derselben Meldung, Worker-Code `upload`):
  `empty-file` „Die Datei ist leer.“ · `file-too-large` „Die Datei ist zu groß (X MB) – erlaubt sind höchstens 64 MB.“ ·
  `unpacked-too-large` „Die Datei ist entpackt größer als 256 MB und wird nicht geladen.“ · `corrupt` „Die Datei ist beschädigt oder
  unvollständig (…).“ · `unknown-format` „Die Datei ist keine Minecraft-Datei …“ bzw. „Unbekanntes Dateiformat …“ ·
  `legacy-schematic` · `unsupported` (Sponge-Version > 3, fehlender DecompressionStream) · `no-blocks` „Die Datei enthält keine
  Blöcke, die es in Minecraft 26.2 gibt …“ · `too-many-blocks` „Der Bau hat mehr als 3.000.000 Blöcke …“ · `too-big` „Der Bau ist
  W × H × L Blöcke groß – jede Kante darf höchstens 4.064 Blöcke lang sein.“ · `module-missing` (Modell-Import fehlt) ·
  `data-missing` (Blockdaten/Blockfarben fehlen) · `model` „Das Modell konnte nicht umgewandelt werden: …“.
- **Warnungen** (`result.warnings`, deutsch, meiste Blöcke zuerst, höchstens 40 + Sammelzeile): Umbenennungen, weggelassene
  Blöcke je ID mit Anzahl, ignorierte Eigenschaften, ersetzte Werte, Objekte (Entities), neuere/ältere Datenversion, mehrere
  Paletten, Inhalt ≠ Endung.
- **`result.upload`:** `{ format, declaredFormat, name, formatLabel („Sponge-Schematic v2“, „Litematica v6“, …), size, blockCount,
  chapters, version, dataVersion, sourceSize, regions, regionList [{ name, min, size, blocks, entities, blockEntities }] | null,
  entities, blockEntities, title, author (aus den Metadaten, bereinigt), compression, unpackedBytes, fileBytes, paletteSize,
  renamed [[alt, n]], dropped [[id, n]], fixedValues, ignoredProps, model (stats des Modell-Imports) }`.
- **Modelle** (vox/stl/obj/glb/gltf): `import { modelToVolume } from '../voxelize/index.js'` (create:voxelize);
  `await modelToVolume(format, arrayBuffer, params, { blockColors, onProgress })` → `{ size, palette (palette[0] = 'air'), data:
  Uint16Array ((y·l + z)·w + x), warnings, stats }`. Der Worker lädt `game-data/block-colors.json` einmal und reicht es als
  `blockColors` durch; `params` gehen unverändert weiter (geprüft mit `checkParams`), NBT-Formate ignorieren sie.
- Änderung (§7.4): neue Quelle `{ kind:'upload', … }` im Worker (`checkUploadSource`, `buildUploadResult(uploader, source, hooks)`,
  Lader `importUploader`, `importVoxelizer`, `loadBlockColors`, Fortschritt als `status`-Meldungen „Entpacke Datei …“, „Lese Blöcke …
  40 %“, „Baue N Blöcke …“). Der Renderer schickt `data` derzeit ohne Transfer-Liste (wird kopiert, funktioniert).
- Änderung (§2/§10): `scripts/lib/nbt.mjs` nutzt den Kern aus `js/create/import/nbt.js` (gleiches Ergebnis für alle 1212
  Strukturen des Jars geprüft). Testdateien erzeugt `node tests/fixtures/create/import/make-fixtures.mjs`; Testseite
  `tests/visual/import.html` (Datei-Feld `#file`, `?view=`, `?ui=0`; Fertig-Signal `window.__importTest.loads`/`.ready`/`.error`).
  Der lokale Server liefert `.schem/.litematic/.nbt` nicht aus – Dateien kommen immer über das Datei-Feld.

### 12.3 Modell-Import (`js/create/voxelize/`)

3D-Modelle (STL, OBJ + MTL, GLB/glTF) und MagicaVoxel (`.vox`) → Blöcke, Farben gegen die echten 26.2-Texturen
(`game-data/block-colors.json`, §5). Rein (kein DOM), läuft im Worker und in Node. Dateien: `index.js` (Einstieg), `stl.js`,
`obj.js`, `gltf.js`, `vox.js`, `voxelize.js` (Dreiecke → Raster), `colors.js` (Farbabgleich), `mesh.js` (gemeinsam: `LIMITS`,
`ModelError`, `MeshBuilder`); Werkzeuge `scripts/build-block-colors.mjs`, `scripts/lib/png.mjs` (`decodePng`, `encodePng`,
`readPngInfo`; Farbtypen 0/2/3/4/6, 1–16 Bit, Filter 0–4, Palette + tRNS, Adam7, Prüfsummen).

```js
// index.js
modelToVolume(format, arrayBuffer, params, { blockColors, onProgress, mtl, decodeImage }) // → Promise<VoxelVolume>
  // VoxelVolume = { size: [w, h, l], palette: ['air', zustand …] (nach Häufigkeit), data: Uint16Array ((y·l + z)·w + x),
  //                 warnings: [deutsch], stats: { triangles, voxels, ms } }
  // blockColors: Inhalt von block-colors.json (Pflicht) · onProgress(meldung, null) optional · mtl: .mtl als ArrayBuffer (nur OBJ)
  // decodeImage(bytes, mimeType) → { width, height, data RGBA } (Standard: createImageBitmap + OffscreenCanvas, Node: png.mjs)
parseModel(format, bytes, { mtl, decodeImage }) → { kind: 'mesh', mesh } | { kind: 'voxels', voxels }   // nur lesen
volumeFromModel(model, params, { blockColors, consume, onProgress }) → VoxelVolume                    // synchron, mehrfach nutzbar
normalizeParams(format, params) · formatFromFileName(name) · MODEL_FORMATS · UP_AXES · DEFAULT_MESH_HEIGHT (64) · LIMITS · ModelError
// colors.js
nearestBlock(rgb, { set, face: 'top'|'side'|'bottom'|'all', blockColors, block }) → { id, state, deltaE, score }
createColorMatcher({ blockColors, set, block }) → { candidates, match(r, g, b, faceIndex 0 oben|1 seitlich|2 unten|3 alle) → index }
blocksInSet(blockColors, set, block) · prepareBlockColors(json) · deltaE2000(lab1, lab2, kL, kC, kH) · matchDistance · srgbToLab
PALETTE_SETS · MATCH_WEIGHTS · PATTERN_WEIGHT (0,1)
```
- **params** (unbekannte Schlüssel, falsche Typen, Werte außerhalb → `ModelError` code `params`, deutsche Meldung):
  `height` ganze Zahl 1 … 1024 (Mesh-Standard 64; `.vox` ohne Angabe = Originalgröße, sonst nächster Nachbar auf diese Höhe) –
  Höhe in Blöcken, Seitenverhältnis bleibt; flache Modelle (ohne Höhe): die größte Seite = `height` (Warnung). `solid` (false)
  füllt das Innere. `palette` `'alle'` (Standard) | `'beton'` | `'wolle'` | `'terrakotta'` (17 inkl. ungefärbter) | `'einfarbig'`.
  `block` nur bei `einfarbig` (Pflicht; ID oder Zustand, muss in block-colors.json stehen, also ein voller deckender Block).
  `upAxis` `'auto'` | `'y'` | `'z'`: auto = übliche Achse des Formats – STL und `.vox` z oben (CAD/3D-Druck, MagicaVoxel),
  OBJ und glTF y oben (Blender-Export, glTF-Standard). z oben wird rechtshändig zu Minecraft (x, z, −y); vox-z = Minecraft-y.
- **Set „alle“** = alle Einträge ohne `falls`, `emissive`, `changes`, `special` und ohne die Gruppen `erz`, `sonder`, `technik`,
  `arbeitsblock` (26.2: 262 Blöcke). Die anderen Sets = genau ihre Gruppe.
- **Farbabgleich:** CIELAB (D65) mit ΔE2000, Seite des Voxels (Oberfläche: Normale des nächsten Dreiecks – oben, seitlich, unten;
  `.vox`: erste freie Nachbarseite oben → seitlich → unten) gegen die Seitenfarbe des Blocks, + 0,1 · Musterstärke. Änderung:
  Auswahl mit parametrischen Faktoren `MATCH_WEIGHTS` – kL = 1 + 3 · max(0, C* − 30) / 100 (C* = Chroma der Modellfarbe), kC 0,85,
  kH 0,75: Modellfarben sind oft viel kräftiger als jeder Block, dann zählt der Farbton mehr als die Helligkeit (#FF0000 → roter
  Beton statt dem helleren orangen, #0000FF → blauer statt violetter Beton); ruhige Farben (C* ≤ 30: Haut, Holz, Stein) vergleicht
  es mit kL = 1. Grenzfall: reines #FFFF00 landet bei Beton knapp bei Lime (gelber Beton ist goldgelb). `deltaE` im Ergebnis ist
  das echte ΔE2000. Vorauswahl der 32 besten über eine Näherung, Cache je Blockfarben-Objekt, Set und auf 6 Bit gerundeter Farbe.
- **Oberfläche ohne Löcher:** jede Zelle, deren Würfel ein Dreieck berührt (Trennachsen-Test nach Akenine-Möller, je Dreieck nur die
  Spalten unter seiner Ebene). Farbe = nächster Punkt der berührenden Dreiecke (Material × Eckfarbe × Textur, in linearem RGB).
  **Inneres** (`solid`): Strahlen durch die Zellmitten entlang x, y, z zählen Schnittpunkte; Strahlen mit ungerader Zahl (undichtes
  Netz) enthalten sich, innen = Mehrheit der gültigen Stimmen; gefüllt mit dem Block des nächsten Oberflächen-Voxels der x-Reihe.
  `.vox` füllt per Flutfüllung von außen (6er-Nachbarschaft).
- **Formate:** STL binär und ASCII (Erkennung über Größe 84 + 50·n und Inhalt, nicht nur „solid“; Farben nach VisCAM und Magics).
  OBJ `v` (optional Eckfarbe), `vt`, `f` mit Polygonen (Fächer), negative Indizes, `usemtl`, Fortsetzungszeilen; `.mtl` mit `newmtl`
  + `Kd` (fehlt sie: Grundfarbe sRGB 200 und Warnung; `map_Kd` wird nicht geladen). glTF 2.0: `.glb` und `.gltf` mit eingebetteten
  `data:`-URIs, Primitive TRIANGLES (auch Streifen/Fächer), Indizes, Knoten-Matrizen/TRS samt Hierarchie, `baseColorFactor`,
  `baseColorTexture` über `TEXCOORD_n` mit Sampler-Wiederholung, normierte Ganzzahl-Attribute, dünn besetzte Accessoren,
  `EXT_texture_webp`; externe Dateien
  → „… bitte als .glb exportieren (alles in einer Datei)“, Draco/Meshopt → Meldung, `KHR_texture_transform` ignoriert (Warnung).
  `.vox`: SIZE/XYZI, RGBA (fehlt: Standardpalette), Szene aus nTRN/nGRP/nSHP mit Drehung `_r` und Verschiebung `_t`
  (ausgeblendete Knoten/Ebenen fallen weg), ohne Szene mehrere Modelle nebeneinander.
- **Grenzen (`LIMITS`):** Datei ≤ 64 MB, ≤ 2 000 000 Dreiecke, ≤ 3 000 000 Blöcke (auch schon die Oberfläche), Kante ≤ 4064,
  dichtes Raster ≤ 64 Mio. Zellen (Meldung mit größter möglicher Höhe), Höhe ≤ 1024, ≤ 4096 Materialien, Textur ≤ 8192 Pixel je
  Seite (größere werden im Browser auf 16 Mio. Pixel verkleinert), ≤ 1024 `.vox`-Modelle. Fehler: `ModelError` (code `params`,
  `format`, `limit`, `model`, `argument`), im Import als `ImportError` `model` „Das Modell konnte nicht umgewandelt werden: …“.
- **Laufzeit** (Node 24, i7-13700K, mit paralleler Last anderer Agenten gemessen): 100 000 Dreiecke auf Höhe 128 hohl ≈ 150 ms (77 000 Blöcke), gefüllt ≈ 165 ms
  (1,14 Mio. Blöcke); Kugel mit 4 000 Dreiecken auf Höhe 40 gefüllt ≈ 20–40 ms; Blockfarben erzeugen ≈ 0,3 s.
- Tests: `tests/unit/create-voxelize-*.test.mjs`; Testmodelle erzeugt `node tests/fixtures/create/voxelize/make-fixtures.mjs`
  (selbst gebaut). Testseite `tests/visual/voxelize.html`: Datei-Feld `#file` (mehrere Dateien, `.mtl` dazu), Einstellungen,
  Umwandlung auf der Seite (Kennzahlen, Draufsicht, Blockliste) und dieselbe Datei über `{ kind:'upload' }` im echten Viewer;
  `?view=`, `?ui=0`; Fertig-Signal `window.__voxelTest.loads`/`.ready`/`.error`, dazu `.page` und `.viewer`. Die Upload-Quelle
  trägt nur eine Datei – eine `.mtl` wirkt dort noch nicht (Warnung „… die .mtl-Datei fehlt …“).

## 13. Spieldaten im Browser (`js/data/`, Etappe 2, „Weg A“)

Änderung (Webseite, Etappe 2, 2026-10-27): Die Seite braucht kein `game-data/` mehr. Online (GitHub Pages) lädt der Browser
die Original-Dateien von Minecraft Java 26.2 selbst aus misode/mcmeta auf raw.githubusercontent.com (CORS `*`, gzip) und
wandelt sie mit derselben Logik wie `scripts/extract-game-data.mjs` um. Ergebnis: genau das Format von `game-data/`
(names, blocks, models, Strukturen, Blockfarben Text für Text gleich; Texturen pixelgleich, als Atlas-Einträge). Auf der Seite
und im Repo liegen keine Mojang-Dateien. Ablage im Browser (IndexedDB), danach ohne Netz.

Dateien (alle laufen in Fenster, Worker und Node, ohne DOM):
- `convert.js` – reine Umwandlung (vorher im Node-Skript, das sie jetzt importiert und weiter exportiert): Namen, Blockbericht,
  Modelle (`buildModels`, `createAssetsFromSummary` als Assets-Adapter für die mcmeta-Zusammenfassungen), Textur-Einträge
  (`textureEntry`, `selectTextureNames`, `parseAnimation`), Strukturen (`convertStructure`, `structureFileName`/
  `structurePathFromFile`). `CONVERT_VERSION` (heute 1) erhöhen, sobald sich die Ausgabe ändert – sonst behalten Besucher alte
  Daten; `tests/unit/data-remote.test.mjs` hält dafür eine Prüfsumme je Version fest.
- `block-colors.js` – Kern der Blockfarben (`buildBlockColorsFrom` mit synchronem `textureImage(name)`), auch von
  `scripts/build-block-colors.mjs` genutzt.
- `sources.js` – feste Commits (unveränderlich): summary `711a353b…` (version.json, Blockbericht, alle Blockstates, alle
  Modelle), atlas `dbfab673…` (blocks/items/entities: `atlas.png` + `data.min.json` mit `[x, y, w, h]`), assets `a4151022…`
  (101 `.png.mcmeta`, Liste `MCMETA_TEXTURES` = Texturen mit Animation oder Mipmap-Strategie), assetsJson `9a92e5df…`
  (de_de/en_us), data `4d12c055…` (Struktur-NBT). `mcmetaUrl` prüft Pfade streng; `LIMITS` je Dateiart.
  Die Zeile `MCMETA_BASE = 'https://raw.githubusercontent.com/misode/mcmeta/'` ersetzt nur der Testserver (Spiegel).
- `net.js` – `fetchBytes`/`fetchJson`: nur einfache GET ohne eigene Header (raw.githubusercontent.com beantwortet den
  CORS-Preflight mit 403), `credentials: 'omit'`, Größengrenze (Content-Length und beim Lesen), Zeitlimit je Versuch,
  Wiederholung bei Netzfehler/429/5xx (0,5/1,5/4 s), `NetError { kind: network|timeout|http|rate-limit|too-large|format }`
  mit deutschen Meldungen; `createLimiter`.
- `store.js` – IndexedDB „block-kompass-data“ (Objektspeicher „files“), Rückfall auf den Arbeitsspeicher (privates Fenster,
  Kontingent, Fehler), `withLock` über Web Locks.
- `remote.js` – `createRemoteSource()`: `names()`, `blocks()`, `models()`, `textures()` (Einträge `{ atlas, x, y, w, h, anim,
  mip? }`, ohne die 3 Colormaps, die zur Laufzeit niemand braucht), `atlas(name)` (PNG-Bytes), `structure(file)`,
  `blockColors()`, `isCached(name)`. Je Stufe: gemerkte Promise → Speicher → Sperre `bk-data:<name>` (Seite und Worker laden
  nie doppelt) → Speicher erneut → erzeugen → speichern; Fehler werden nie gemerkt. Schlüssel
  `v<STORE_VERSION>.<CONVERT_VERSION>.<BLOCK_COLORS_FORMAT>|<Commits>|<Stufe>`, alte Schlüssel räumt `keepOnly` weg.
  Scheitert eine `.mcmeta`, werden die übrigen abgebrochen (bei 429 keine Anfragen im Hintergrund). Höchstens 16 gleichzeitig.
- `game-data.js` – einzige Datenquelle der Seite: `dataMode()` ('local' nur auf 127.0.0.1/localhost/[::1] mit vorhandenem
  `game-data/meta.json`, sonst 'remote' – online ohne jede Anfrage nach `game-data/`), `loadGameNames/Blocks/Models/
  Textures/Structure/BlockColors()` (Texturen lokal `{ json, bin }`, online `{ json, atlas }` für `TextureStore.fromSource`),
  `onGameDataProgress` (`{ stage, label, done, total, share, text }`, nur bei echtem Download, z. B. „Spieldaten von GitHub
  laden (einmalig) … 42 %“), `GameDataError { kind, title, message }` / `toGameDataError` (menschliche Texte ohne Befehle).
  Benutzt von `renderer.js` (`loadTextureStore`), `appearance.js`, `engine-worker.js` (Modelle, Blöcke, Strukturen,
  Blockfarben; Fortschritt als Status „data“ mit Anteil), `ui/data.js` (`loadNames`), `create-page.js`, `create/importer.js`.
- `texture-store.js`: Atlas-Modus (`new TextureStore(json, { atlas })`, `TextureStore.fromSource`, `mode`,
  `TextureSourceError`); jeder Atlas wird einmal geladen und dekodiert, nach dem Ausschneiden aller Einträge freigegeben.

CSP: `connect-src 'self' https://raw.githubusercontent.com/misode/mcmeta/` (Seiten-Meta und `scripts/serve.mjs`); nur
dieses Repo ist erlaubt. Hinweis: Auf GitHub Pages gibt es keine HTTP-Header; Modul-Worker haben dort keine eigene CSP.

Messwerte (headless Chrome, echtes raw.githubusercontent.com): erster Besuch einer Bau-Seite 112 Anfragen, ≈ 1,5 s
(mit 4-facher CPU-Drosselung ≈ 2,4–3,2 s), danach aus IndexedDB ≈ 30–250 ms ohne Anfrage. Mindestversion bleibt iOS 16.4
(DecompressionStream).

Tests: `tests/unit/data-*.test.mjs` (u. a. Gleichheit mit `game-data/` über den Spiegel, Chrome mit IndexedDB),
`node scripts/mirror-mcmeta.mjs` (Spiegel der festen Dateien nach `tmp/mcmeta-mirror/`), `tests/lib/mcmeta-mirror.mjs`
(`mirrorOverrides` für `startServer({ overrides })`, nur programmatisch), `node tests/e2e-remote.mjs [--live]`
(Pages-Nachbau auf 127.0.0.2 unter `/minecraft-block-kompass/`, ohne `game-data/` und `thumbs/`, mit Spiegel oder echtem GitHub).
