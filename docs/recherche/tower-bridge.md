# Tower Bridge, London – Maße für einen 1:1-Nachbau

Stand 2026-10-23 · Ziel: Minecraft **Java 26.2** · 1 Block = 1 m · für `js/builds/infrastruktur/tower-bridge.js`

| Zeichen | Bedeutung |
|---|---|
| **B** | belegt (Wikipedia en/de) `[Qn]` |
| **O** | aus OpenStreetMap-Umrissen vermessen [Q4] (Genauigkeit etwa ±1 m) |
| **R** | eigene Rechnung aus belegten Werten |
| **G** | **geschätzt**, nicht belegt (nach allgemeinen Fotos/Beschreibungen) |
| **I** | Umsetzung im Bau |

## 1. Kurzfassung

- **Bauwerk (B):** kombinierte Klapp- und Hängebrücke über die Themse, gebaut 1886–1894, eröffnet am 30. Juni 1894;
  Architekt Horace Jones († 1887), Ingenieur John Wolfe Barry; Stahlskelett, verkleidet mit Granit aus Cornwall und
  Portland-Kalkstein [Q1][Q2].
- **Längen (B):** 940 ft (rund 287 m) einschließlich der Widerlager; Mittelöffnung zwischen den Türmen 200 ft (61 m), zwei
  Seitenfelder (Hängebrücken) je 270 ft (82 m) [Q1].
- **Höhen (B):** Türme 213 ft (65 m), obere Fußgängerstege 143 ft (43,6 m) über der Themse bei Hochwasser; Durchfahrtshöhe
  unter der geschlossenen Klappe 29 ft (8,8 m), offen 135 ft [Q1].
- **Breite (B):** 60 ft (18,3 m), über der Klappöffnung 49 ft (14,9 m) [Q1].
- **Klappen (B):** je rund 1 070 t, Hub in etwa fünf Minuten; Winkel 82° [Q1] bzw. bis 86° [Q2].
- **Farbe (B):** blau-weiß seit der Sanierung 2008–2012; 1977 zum Silberjubiläum rot-weiß-blau [Q1].
- **Grundrisse (O):** Pfeiler, Stege und Widerlager aus OSM-Umrissen vermessen [Q4]; Brückenachse in London 203° (also um
  23° gegen Nord–Süd gedreht).

## 2. Maße mit Quelle

| Maß | Wert | Kz. | Quelle / Anmerkung |
|---|---|---|---|
| Gesamtlänge mit Widerlagern | 940 ft = 286,5 m | B | [Q1] (gerundet „290 m“) |
| Mittelöffnung zwischen den Türmen | 200 ft = 61 m | B | [Q1] |
| Seitenfelder | je 270 ft = 82,3 m | B | [Q1] |
| Turmhöhe | 213 ft = 65 m | B | [Q1] (Infobox) |
| Stege über Hochwasser | 143 ft = 43,6 m | B | [Q1] |
| Durchfahrtshöhe geschlossen | 29 ft = 8,8 m | B | [Q1], Vorgabe des Gesetzes von 1885 |
| Brückenbreite | 60 ft = 18,3 m | B | [Q1] |
| Breite über der Klappe | 49 ft = 14,9 m | B | [Q1] |
| Klappengewicht | ≈ 1 070 t | B | [Q1] |
| Drehpunkt der Klappe | 13 ft 3 in hinter der Pfeilerfront, 5 ft 7 in unter der Fahrbahn | B | [Q1] |
| Pfeiler (Umriss) | 21,4 × 57 m | O | OSM-Wege 367652787 / 367652791 („North/South Tower“, `height=9`) |
| Stege (Umriss) | 72,4 m lang (bis in die Türme), 4,3 m breit, innere Kanten 10,5 m auseinander | O | OSM-Wege 367652753 / 367653917 (`height=45`, `min_height=40`) |
| Widerlager (Umriss) | 9,1 × 23 m, 22 m hoch | O | OSM-Weg 367654296 („Middlesex Abutment“, `height=22`) |
| Achse | 202,8° | O | aus den Endpunkten der Stege |
| Turmgrundriss über dem Pfeiler | ca. 29 × 19 m | G | nicht veröffentlicht |
| Fahrbahnoberfläche über Hochwasser | ca. 10 m | R | 8,8 m Durchfahrt + Fahrbahnplatte |
| Glasböden in den Stegen | seit 2014, zwei je Steg | B | [Q1]; Länge nicht belegt (G) |

## 3. Bauteile

- **Pfeiler:** zwei Flusspfeiler mit runden Enden gegen die Strömung, darauf die Haupttürme.
- **Haupttürme:** Stahlskelett mit Steinverkleidung, Sockel aus Granit, darüber Portland-Kalkstein, vier achteckige
  Ecktürmchen mit spitzen Helmen, steiles Dach mit Spitze; innen heute Treppen, Aufzüge und Ausstellung [Q1][Q2].
  Mitten hindurch führt die Fahrbahn in einem Spitzbogen.
- **Klappbrücke:** zwei Klappen, im Modell geschlossen; Träger zu den Pfeilern hin tiefer (dort sitzen Drehpunkt und Gegengewicht).
- **Obere Stege:** zwei Fachwerkträger mit verglasten Seiten und Dach, heute Museum mit Glasböden [Q1][Q2].
- **Seitenfelder:** Hängebrücken; die Ketten laufen vom Hauptturm in Höhe der Stege durch, hängen bis knapp über die Fahrbahn
  und steigen zu den Widerlagertürmen wieder an; Hänger tragen die Fahrbahn.
- **Widerlager:** kleinere Türme an beiden Ufern mit Torbogen und vier Ecktürmchen.

## 4. Farben und Palette

| Bauteil | Vorbild | Minecraft |
|---|---|---|
| Sockel, Pfeiler | Granit aus Cornwall [Q1] | Steinziegel, rissige und (am Wasser) bemooste Steinziegel, polierter Andesit als Abschluss |
| Turmwände | Portland-Kalkstein [Q1] | polierter Diorit mit Diorit, Gesimse aus Kalzit, Fensterbänke/Tropfgesimse aus poliertem Diorit |
| Fenster | dunkle Verglasung | graue Glasscheiben |
| Dächer | dunkler Schiefer | Tiefenschieferfliesen (Treppen, Stufen, Blöcke), Blitzableiter und Goldblock als Spitze |
| Stahlteile | blau und weiß [Q1] | hellblauer und weißer Beton, Eisengitter |
| Fahrbahn | Asphalt, Gehwege | grauer Beton mit weißer Mittellinie, glatter Stein |
| Fluss | Themse | Wasserquellen auf Schlamm, Ton und grober Erde |

## 5. Unsicherheiten

- **Turmgrundriss, Fenster und Gliederung** sind nicht vermessen veröffentlicht (G); die Fensterbänder und Gesimse sind nachempfunden.
- **Kettenkurve:** nur Anfang (Steghöhe) und Ende (Widerlager) sind sinnvoll ableitbar, der tiefste Punkt ist geschätzt (G).
- **Klappenwinkel:** 82° [Q1] gegen 86° [Q2] – im Modell ist die Brücke geschlossen, das Maß spielt keine Rolle.
- **Fahrbahnhöhe:** nicht direkt belegt, aus der Durchfahrtshöhe abgeleitet (R).
- **Innenräume** (Ausstellung, Wendeltreppe) frei gestaltet (G).
- Gesperrt (nicht umgangen): `https://www.saint-gobain.co.uk/case-study/tower-bridge` – HTTP 403 (Angaben zu den Glasböden
  daher nicht übernommen). `https://www.towerbridge.org.uk/discover/history` ist eine Übersichtsseite ohne Maße (nur
  Eröffnung 1894).

## 6. Umsetzung (I)

- Brücke entlang z (Norden = −z), Fuge der Klappen bei z = 0, Wasserspiegel (Hochwasser) y = 0, Flussbett y = −1.
  Gebaut wird die Südhälfte, die Nordhälfte entsteht gespiegelt.
- Maßstab 1: Pfeiler z 31 … 51 (21) × x ±28,5 mit runden Enden; Hauptturm z 32 … 50 (19) × x ±14 (29), Ecktürmchen
  bis y 54, Helme bis 61, Spitze 64 → **65 Blöcke** über dem Wasserspiegel; Geschossböden y 18, 26, 35, 43.
- Klappe z −30 … 30 = **61 Blöcke** lichte Weite, **15 Blöcke** breit, Fahrbahn y 9 (Oberfläche 10 m), Unterkante an der
  Spitze y 9 → 8,1 m Durchfahrt.
- Stege: Boden y 43 (Lauffläche 44 Blöcke über dem Wasserblock, im Spiel ≈ 43,1 über der Wasseroberfläche), x ±5 … ±9
  (5 breit, Abstand der Innenkanten 9), Dach y 47.
- Seitenfelder z 51 … 133 (**82–83 Blöcke**), **19 Blöcke** breit, Ketten an den Außenkanten x ±9 von y 43 am Turm über
  y 12 bis y 21 am Widerlager, Hänger alle 4 Blöcke.
- Widerlager z 134 … 143 (10) × x ±11 (23), Mauer bis y 21 (**22 Blöcke**), massiv; Gesamtlänge Widerlager–Widerlager
  **287 Blöcke**, mit Zufahrten 301.
- Maßstab 0,5: alle Längen halbiert und gerundet (Klappe 7, Seitenfelder 9 Blöcke breit; Turm 33, Stege 22 Blöcke über dem
  Wasser; Gesamtlänge 143 bzw. 151 Blöcke), Leiter statt Wendeltreppe.
- Licht: Laternen in Durchfahrten, Geschossen und Stegen (Seelaternen im Dach), Seelaternen im Kern der Wendeltreppe; geprüft
  mit `findDarkSpots` (keine dunklen begehbaren Felder unter Dach); Turmhelme und Widerlagerdächer massiv (keine Hohlräume).

## 7. Quellen (Abruf 2026-10-22 und 2026-10-23)

- [Q1] Wikipedia (en): Tower Bridge – https://en.wikipedia.org/wiki/Tower_Bridge
- [Q2] Wikipedia (de): Tower Bridge – https://de.wikipedia.org/wiki/Tower_Bridge
- [Q3] Tower Bridge (offizielle Seite): History – https://www.towerbridge.org.uk/discover/history (nur Eröffnung 1894)
- [Q4] OpenStreetMap über Overpass API, © OpenStreetMap-Mitwirkende, ODbL: Wege 367652787 / 367652791 (Pfeiler),
  367652753 / 367653917 (Stege), 367654296 (Widerlager), 378541210 (Fahrbahn) – https://www.openstreetmap.org/way/367652787
