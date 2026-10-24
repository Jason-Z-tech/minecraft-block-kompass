# Kapellbrücke mit Wasserturm, Luzern – Maße für einen 1:1-Nachbau

Stand 2026-10-23 · Ziel: Minecraft **Java 26.2** · 1 Block = 1 m · für `js/builds/infrastruktur/kapellbruecke-luzern.js`

| Zeichen | Bedeutung |
|---|---|
| **B** | belegt (Wikipedia, Luzern Tourismus, Fachtext) `[Qn]` |
| **O** | aus OpenStreetMap-Umrissen vermessen [Q6] (Genauigkeit etwa ±1 m) |
| **R** | eigene Rechnung aus belegten Werten |
| **G** | **geschätzt**, nicht belegt |
| **I** | Umsetzung im Bau |

## 1. Kurzfassung

- **Brücke (B):** gedeckte Holzbrücke über die Reuss, heute **202,90 m** lang, mit Vordächern **204,70 m** [Q1][Q2].
  Ursprünglich rund 279 m; das Ufer wurde im 19. Jahrhundert aufgeschüttet, das Südende 1833–1838 gekürzt und abgewinkelt,
  das Nordende um 1897/98 um einige Meter gekürzt [Q1][Q3].
- **Unterbau (B):** 28 Joche im Wasser (20 aus Holz, 8 aus Stein), 27 Felder; „strutted and triangulated trusses of moderate
  span“ auf gerammten Pfahljochen [Q2]. Mittlere Feldweite 202,9 / 27 ≈ **7,5 m** (R).
- **Verlauf (O):** schräg über die Reuss. Hauptstück vom Nordende (Rathausquai, Peterskapelle) 130 m nach **214–216°**
  (Südsüdwest), am Wasserturm Knick um +19° auf **234°** (55,5 m), am Südende Knick um −61° auf **173°** (14,5 m) [Q6].
- **Breite (O/G):** Gehweg 3 m (OSM-Tag `width=3`), Gebäudeumriss 4,4–4,8 m [Q6]. Höhe der Fahrbahn über dem Wasser,
  Brüstungs- und Firsthöhe sind **nirgends veröffentlicht** (G).
- **Dach (B/O):** Satteldach mit Ziegeln, „ragt weit nach unten“ [Q5]; OSM: `roof:shape=gabled`, `roof:material=roof_tiles`,
  `roof:colour=maroon` [Q6].
- **Ausstattung (B):** Geranien in Kästen an der Außenseite [Q5], dreieckige Giebelbilder unter dem Dach (ursprünglich 158,
  vor dem Brand 147, Tafeln 150–181 × 85–95 cm) [Q1][Q2][Q4]. Seeseitige Brüstung höher gebaut (Wehrgang) [Q1].
- **Wasserturm (B):** achteckig, **34,5 m** hoch [Q2][Q4] (Wikipedia de: 35 m [Q3]), **Seitenlänge 4,4–5 m, Umfang 39 m** [Q4];
  Verlies mit rund 3 m dicken Mauern ohne Fenster und Tür, Zugang nur durch eine Bodenöffnung; darüber zwei Geschosse und
  ein rund 15 m hoher Dachstock [Q3]. Zeltdach mit Ziegeln, laut OSM 12 m hoch [Q6].

## 2. Maße mit Quelle

### 2.1 Brücke

| Maß | Wert | Kz. | Quelle / Anmerkung |
|---|---|---|---|
| Länge heute | 202,90 m | B | [Q1]; [Q2] nennt 204,7 m (mit Vordächern laut [Q1]) |
| Länge mit Vordächern | 204,70 m | B | [Q1] |
| ursprüngliche Länge | ca. 279 m | B | [Q1] (über 270 m [Q2]) |
| Joche im Wasser | 28 (20 Holz, 8 Stein) | B | [Q2] Infobox |
| Felder | 27 | B | [Q2] |
| Feldweite | ≈ 7,5 m | R | 202,9 / 27 |
| Länge Hauptstück (Nordende → Knick am Turm) | 130,0 m | O | Mittellinie OSM-Weg 265741898 [Q6] |
| Länge Mittelstück (Turm → Südknick) | 55,5 m | O | [Q6] |
| Länge Südstück | 14,5 m | O | [Q6] |
| Summe Mittellinie OSM | 200,1 m | O | 2,8 m kürzer als [Q1] – das OSM-Nordende liegt im Umriss 3 m hinter dem Gebäudeende |
| Richtung Hauptstück | 214,2° / 216,3° | O | 0° = Nord, im Uhrzeigersinn |
| Knick am Turm | +19,3° (auf 233,9°) | O | |
| Knick Südende | −61° (auf 172,9°) | O | 1833–1838 abgewinkelt [Q1] |
| Gehwegbreite | 3 m | O | OSM-Tag `width=3` |
| Breite Gebäudeumriss | 4,4–4,8 m | O | Abstand der Längskanten in OSM-Weg 396669328 |
| Wandhöhe (bis Traufe) | 2,5 m | O | OSM `height=2.5` – unklar, ob ab Gehweg oder ab Wasser |
| Gehweg über Wasser | ca. 2 m | G | wenige Treppenstufen vom Quai hinauf [Q5] |
| Firsthöhe über Gehweg | ca. 4,5–5,5 m | G | nicht belegt |
| Giebelbilder | 158 ursprünglich, 147 vor 1993, 110/111 beim Brand in der Brücke | B | [Q1][Q2][Q4] – Zahlen widersprechen sich leicht |
| Bildtafeln | 150–181 cm breit, 85–95 cm hoch | B | [Q1][Q2] |

### 2.2 Wasserturm

| Maß | Wert | Kz. | Quelle / Anmerkung |
|---|---|---|---|
| Höhe | 34,5 m | B | [Q2][Q4]; [Q3] und OSM: 35 m |
| Grundriss | Achteck, leicht geneigt | B | [Q3] |
| Seitenlänge | 4,4–5 m | B | [Q4] |
| Umfang | 39 m | B | [Q4] |
| Breite über die Seiten | ≈ 11,8 m | R | 39 / 8 · (1 + √2) |
| Umriss in OSM | ca. 15–16 m | O | vermutlich mit Dachüberstand |
| Mauerstärke Verlies | ca. 3 m | B | [Q3] |
| Dachstock | ca. 15 m hoch | B | [Q3] |
| Dachhöhe | 12 m | O | OSM `roof:height=12`, `roof:shape=pyramidal` |
| Mauerhöhe bis Traufe | ≈ 22,5 m | R | 34,5 − 12 |
| Lage | 8–9 m neben der Brückenmitte, Seeseite, am Knick | O | Turm-Mittelpunkt aus OSM-Weg 35862663 |
| Baujahr | um 1290–1300 (vor der Brücke) | B | [Q4]; [Q3]: nach 1262, erste Erwähnung 1367 |

## 3. Bauteile

- **Joche:** Pfahlreihen quer zur Brücke, darauf Querbalken, darüber Längsbalken unter den Brüstungen.
- **Gehweg:** Bretterboden, an beiden Enden Stufe zum Quai.
- **Wände:** Brüstung aus Brettern, Pfosten in regelmäßigem Abstand, dazwischen offene Fensterbänder („regelmäßige Öffnungen
  auf beiden Seiten“ [Q5]); seeseitige Brüstung höher [Q1].
- **Dach:** Satteldach, Traufe tief über den Blumenkästen [Q5], Vordächer an den Enden [Q1].
- **Wasserturm:** Verlies (fensterlos), 1. Geschoss (früher Gefängnis/Schatzkammer), 2. Geschoss (Archiv bis 1919),
  Dachstock (Mauerseglerkolonie seit 1892); heute vermietet an den Artillerieverein Luzern [Q3].
- **Anbau:** kleiner Holzbau zwischen Brücke und Turm mit Souvenirladen [Q5]; Form nur aus dem OSM-Umriss (Ausbuchtung am
  Brückenumriss bei den Punkten (−30,4|26,5), (−27,5|29,9), (−23,3|26,4) in lokalen Metern) [Q6] – **Form geschätzt (G)**.

## 4. Farben und Palette

| Bauteil | Vorbild | Minecraft |
|---|---|---|
| Holz (Brücke) | dunkles, gealtertes Nadelholz | Fichtenbretter, Fichtenstamm, entrindeter Fichtenstamm |
| Dach | rotbraune Ziegel („maroon“) [Q6] | Ziegeltreppe, Ziegelstufe, Ziegelsteine |
| Turmmauer | Bruchstein, grau-beige („wheat“ in OSM) | Tuffstein, Andesit, Stein, unten bemooster Bruchstein |
| Blumen | rote Geranien [Q5] | Rote und rosa Tulpen, Mohn |
| Fluss | Reuss | Wasserquellen auf Ton, Schlamm und grober Erde |
| Quai | Pflaster, Quaimauer | Bruchstein, Andesit, polierter Andesit, Steinziegel, Eisengitter |

Erste Versuche mit Schlammziegeln, Tropfstein und Sandstein wirkten in der 3D-Ansicht orange bzw. fleckig; die graue
Mischung kommt dem verwitterten Bruchstein am nächsten (I).

## 5. Unsicherheiten

- **Höhen der Brücke** (Gehweg über Wasser, Brüstung, First): nicht veröffentlicht, aus Fotobeschreibung und OSM geschätzt.
- **Lage der 8 Steinjoche:** nicht dokumentiert → im Bau sind alle Wasserjoche aus Holz.
- **Turmbreite:** Luzern Tourismus (Umfang 39 m → 11,8 m) gegen OSM (15–16 m). Gewählt: 12 m Mauer, Dach mit 1,5 m Überstand.
- **Turmhöhe:** 34,5 m [Q2][Q4] oder 35 m [Q3]; gewählt 34,5 m ab Flussbett.
- **Uferlinien:** aus OSM-Ufer-Wegen 1077581935, 1224766733, 122771961 [Q6]; der Brückenanfang liegt in OSM 3 m im Wasser –
  im Bau beginnt am Nordende ein kleiner Quai.
- **Anbau:** Form und Dach geschätzt.
- **Neigung des Turms** („leicht geneigt“ [Q3]): nicht nachgebaut.
- **Giebelbilder:** als Blöcke nicht darstellbar (Gemälde sind Objekte, keine Blöcke) – Hinweis in der Anleitung.
- Gesperrt/nicht nutzbar: `de.wikipedia.org/wiki/Wasserturm_(Luzern)` – 404 (richtige Seite: `Wasserturm_Luzern`).

## 6. Umsetzung (I)

- Gedreht um **34,5°**: Hauptstück entlang +z (Süden), Nordende bei (0, 0). Mittellinie in Blöcken:
  (0|0) → (0|133) → (−18,5|185,5) → (−9|196) = **202,8 m** (Nordende 3 m vor den OSM-Beginn verlängert, damit die Länge 202,9 m stimmt).
- Querschnitt über den Abstand d zur Mittellinie: Gehweg |d| < 1,6 (3 Blöcke), Brüstung |d| < 2,6, Blumenkasten und Traufe
  |d| < 3,6 → Brücke 5 Blöcke, Dach 7 Blöcke breit (2 Blöcke breiter als der OSM-Umriss, damit die Blumenkästen unter der Traufe liegen).
- Höhen (Maßstab 1): Flussbett y 0, Wasser y 1, Balken y 2, Gehweg y 3 (Lauffläche 4), Brüstung y 4, Fensterband y 5,
  Rähm y 6, Zugbalken y 7, First y 9 (Stufe). Pfosten alle 3 m, Laternen alle 9 m.
- Joche: 28 (k = 0 … 27) alle 7,51 m entlang der Mittellinie, 3 Pfähle je Joch; auf dem Land entfallen sie.
- Wasserturm: Achteck mit 12 Blöcken über die Seiten (Seite 6 Blöcke + 3 Diagonalstufen), Mittelpunkt (8,5|137,5);
  Mauer 3 / 2 / 1 Block dick; Böden y 3, 11, 19; Mauer bis y 22, Zeltdach y 23–34 mit 1,5 Blöcken Überstand → Spitze 34,5 m über dem Flussbett.
- Maßstab 0,5: alle Längen halbiert, Gehweg 1 Block, Brücke 3 und Dach 5 Blöcke breit, Turm 6 Blöcke breit und 17,5 hoch, ohne Verlies.

## 7. Quellen (Abruf 2026-10-22 und 2026-10-23)

- [Q1] Wikipedia (de): Kapellbrücke – https://de.wikipedia.org/wiki/Kapellbr%C3%BCcke
- [Q2] Wikipedia (en): Kapellbrücke – https://en.wikipedia.org/wiki/Kapellbr%C3%BCcke
- [Q3] Wikipedia (de): Wasserturm Luzern – https://de.wikipedia.org/wiki/Wasserturm_Luzern
- [Q4] Luzern Tourismus: Kapellbrücke und Wasserturm – https://www.luzern.com/de/poi/kapellbruecke
- [Q5] Hochschule Luzern, P. Halter: Raumbeschreibung Kappelbrücke (2021) – https://blog.hslu.ch/mur-hs21/files/2021/10/Raumbeschreibung-Kappelbruecke_patricia-halter.pdf
- [Q6] OpenStreetMap über Overpass API, © OpenStreetMap-Mitwirkende, ODbL: Wege 396669328 (Brücke, Gebäude), 265741898
  (Gehweg), 35862663 (Wasserturm), 1077581935 / 1224766733 / 122771961 (Ufer), Relation 1473467 (Reuss) – https://www.openstreetmap.org/way/396669328
- Suche nach Breite, Jochen, Dachziegeln und Mauerstärke (Web-Suche): keine weiteren belastbaren Zahlen gefunden.
