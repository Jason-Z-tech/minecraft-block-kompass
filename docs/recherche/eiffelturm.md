# Eiffelturm (Tour Eiffel, Paris) – Maße für einen 1:1-Nachbau

Stand 2026-10-22 · Ziel: Minecraft **Java 26.2** · 1 Block = 1 m · für `js/builds/wahrzeichen/eiffelturm.js`

Jede Angabe ist gekennzeichnet:

| Zeichen | Bedeutung |
|---|---|
| **B** | belegt: Wikipedia (de/fr/en) oder Fachartikel `[Qn]` |
| **R** | eigene Rechnung aus belegten Werten (Rechenweg steht dabei) |
| **G** | **geschätzt**, nicht belegt |
| **I** | Umsetzung/Interpretation für den Bau |

---

## 1. Kurzfassung

- **Höhe (B):** 330 m mit Antennen seit März 2022 (vorher 324 m) [Q1][Q2][Q3]; eigentliche Eisenkonstruktion 300,51 m,
  1889 mit Laterne und Fahnenmast 312,27 m [Q1].
- **Grundfläche (B):** Quadrat, 125 m Seitenlänge [Q2][Q3]; außen 124,90 m, zwischen den Pfeilern innen 74,24 m [Q1][Q2];
  Pfeilerbreite 26,08 m [Q1]. Jeder Pfeiler zeigt in eine Himmelsrichtung [Q1][Q2].
- **Etagen (B):** 57,63 m (Seite 70,69 m) · 115,73 m (40,96 m) · 276,13 m mit Oberdeck 279,11 m (18,65 m) [Q2].
- **Zierbögen (B):** Scheitel 39 m über dem Boden, „Durchmesser“ 74 m [Q1][Q2].
- **Außenkurve (B):** 29 Felder, jedes mit Höhe, Neigung und halber Breite in Tabelle 1 von Weidman & Pinelis [Q4].
- **Farbe (B):** „Eiffelturm-Braun“ (Bronzeton seit 1968), drei Abstufungen – unten dunkler, oben heller [Q3].

## 2. Maße mit Quelle

### 2.1 Höhen

| Bauteil | Wert | Kennz. | Quelle |
|---|---|---|---|
| Gesamthöhe mit Antennen (seit 2022) | 330 m | B | [Q1][Q2][Q3] |
| Höhe 2000–2022 | 324 m | B | [Q1][Q2] |
| Eisenkonstruktion | 300,51 m | B | [Q1] |
| 1889 mit Laterne und Fahnenmast | 312,27 m | B | [Q1][Q2] |
| Leuchtfeuer | 295 m | B | [Q1] |
| Erste Etage (Boden) | 57,63 m (de: 57,6 m) | B | [Q2][Q1] |
| Zweite Etage | 115,73 m | B | [Q2] |
| Dritte Etage / Oberdeck | 276,13 m / 279,11 m | B | [Q2] |
| Scheitel der Zierbögen | 39 m | B | [Q1][Q2] |
| Restaurant im Südpfeiler (zweite Etage) | 123 m | B | [Q1] |

### 2.2 Grundriss, Pfeiler, Plattformen

| Bauteil | Wert | Kennz. | Quelle |
|---|---|---|---|
| Grundfläche (Wettbewerb 1886) | Quadrat 125 m | B | [Q2][Q3] |
| Außenmaß von Pfeiler zu Pfeiler | 124,90 m | B | [Q1][Q2] |
| Lichter Abstand der Pfeiler | 74,24 m | B | [Q1][Q2] |
| Breite eines Pfeilers am Fuß | 26,08 m | B | [Q1] |
| Sockel (soubassements) | 25 m × 25 m, 4 m hoch | B | [Q2] |
| Neigung der Eckträger | 54° | B | [Q2] |
| Seite erste Etage | 70,69 m (4 200–4 415 m²) | B | [Q1][Q2] |
| Seite zweite Etage | 40,96 m (1 430–1 650 m²) | B | [Q1][Q2] |
| Seite dritte Etage | 18,65 m (250–350 m²) | B | [Q1][Q2] |
| Querverbindungen der Pfeiler | „etwa alle 50 m“ | B | [Q2] |

### 2.3 Außenprofil (Weidman & Pinelis 2004, Tabelle 1) [Q4]

x = Abstand unter der Oberkante von Feld 29, w = halbe Turmbreite. Feld 29 (oben) steht senkrecht.

| x (m) | 0 | 11,28 | 23,28 | 36,68 | 51,66 | 68,39 | 87,08 | 107,08 | 128,08 | 149,38 | 165,58 | 185,78 | 207,78 | 225,78 | 247,78 | 269,78 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| w (m) | 5,00 | 5,00 | 5,59 | 6,24 | 6,97 | 7,78 | 8,70 | 10,00 | 11,79 | 14,30 | 16,93 | 21,58 | 27,42 | 33,70 | 43,58 | 53,46 |

(Alle 30 Stützstellen stehen im Modul in `PROFILE`.) Laut [Q4] trägt das oberste Feld die oberste Aussichtsplattform –
daraus folgt: **Oberkante Feld 29 = 276,13 m** (R), das unterste Feld beginnt also auf 6,35 m (R).

### 2.4 Masse, Bauteile, Anstrich

| Angabe | Wert | Kennz. | Quelle |
|---|---|---|---|
| Schmiedeeisen | 7 300 t, gesamt 10 100 t | B | [Q1][Q3] |
| Einzelteile / Niete | 18 038 / 2,5 Mio. | B | [Q1] |
| Stufen bis zur Spitze | 1 665 (Ostpfeiler) | B | [Q1][Q2] |
| Anstrich | 250 000 m², rund 60 t Farbe | B | [Q1] |
| Farbe | „Eiffel Tower Brown“, drei Töne, unten dunkler | B | [Q3] |

## 3. Bauteile

- **Pfeiler:** vier hohle Gitterkästen mit je vier Eckträgern; sie stehen auf Sockeln und laufen geneigt nach innen, bis sie
  auf Höhe der zweiten Etage zusammenkommen (B für die Neigung der Eckträger [Q2], G für den genauen Verlauf der Innenkante).
- **Zierbögen:** auf jeder Seite ein Bogen zwischen zwei Pfeilern, rein dekorativ (B [Q1][Q3]).
- **Erste Etage:** umlaufender Randträger, Plattform mit Pavillons; Glasboden über der Turmmitte (seit 2014, G – aus
  allgemeinem Wissen, nicht in den abgerufenen Ausschnitten).
- **Zweite Etage:** Plattform mit Pavillons und Restaurant, ab hier Vertikalaufzüge zur Spitze (B [Q1]).
- **Dritte Etage:** verglaste untere Ebene, offenes Oberdeck; Gustave Eiffels kleines Büro/Appartement (B [Q3]).
- **Spitze:** Laterne mit Leuchtfeuer (295 m, B), darüber Antennen bis 330 m (B); die Form ist nur aus Fotos bekannt (G).

## 4. Farben und Palette

| Rolle | Block (26.2) | Mittlere Texturfarbe | Begründung |
|---|---|---|---|
| Eisen unten (0–110 m) | Braune Keramik `brown_terracotta` | #4d3324 | dunkelster der drei Töne |
| Eisen Mitte (110–220 m) | Fester Schlamm `packed_mud` | #8e6b50 | mittlerer Bronzeton |
| Eisen oben (ab 220 m) | Hellgraue Keramik `light_gray_terracotta` | #876b62 | hellster, leicht grauer Ton |
| Streben (Gitter) | Gewachster angelaufener Kupferrost `waxed_exposed_copper_grate` | #a27e69 (70 % deckend) | sichtbares Gitterwerk; gewachst, damit es nicht grün wird |
| Geländer | Gewachstes angelaufenes Kupfergitter `waxed_exposed_copper_bars` | #866c59 | passend zum Gitter |
| Plattformböden | Fichtenholzbretter, Rand entrindetes Fichtenholz | #735531 | warmer Holzboden |
| Pavillons | Hellgraue Keramik, Glasscheiben, glatte Steinstufen | – | helle Rahmen, flaches Dach |

Die drei Höhenstufen der Farbe sind **G** (die Quelle nennt nur „drei Töne, unten dunkler“, nicht die Grenzen).
Farben gemessen mit `tmp/wahrzeichen-a/colors.mjs` aus `game-data/textures.bin`.

## 5. Unsicherheiten

1. **Höhenlage des Profils:** [Q4] nennt keine Bodenhöhe; angenommen ist, dass Feld 29 an der dritten Etage endet (R/I).
   Die Kurve wird dann mit dem Faktor 1,109 so gestreckt, dass sie unten genau 124,90 m breit ist (R). So passt auch die erste
   Etage: Turm 68–69 m breit unter der 70,69 m breiten Plattform.
2. **Innenkante der Pfeiler:** nicht belegt. Angenommen: gerade von 74,24 m am Boden bis zur Mitte auf 115,73 m (G).
3. **Bogenform:** „Durchmesser 74 m“ ist als Kreis mit Radius 37 m und Scheitel 39 m gedeutet (I); Bogenstärke 3 m (G).
4. **Spitze über 280 m** (Eckstreben, Laterne, Kuppel): Form geschätzt (G). Der Antennenmast ist rot-weiß dargestellt (G).
5. **Pavillons, Einrichtung, Glasboden, Randträgerhöhe (6 m / 4 m):** vereinfacht bzw. geschätzt (G).
6. **Ausrichtung:** echt zeigen die Pfeiler in die Himmelsrichtungen [Q1][Q2]; im Bau stehen die Seiten achsparallel (I).
7. **Flächenangaben** der Etagen unterscheiden sich zwischen [Q1] und [Q2] (z. B. 4 415 m² gegen 4 200 m²); gebaut wird
   nach den Seitenlängen aus [Q2].

## 6. Umsetzung (Modul)

- Je Ebene y: Außenhalbbreite aus dem Profil, Innenkante der Pfeiler, daraus vier Gitterkästen bzw. ab der zweiten Etage ein
  gemeinsamer Schaft. Gurte (volle Reihen) an den Feldgrenzen aus [Q4]; zu dichte Grenzen werden zusammengelegt.
  Eckträger massiv (3 / 2 / 1 Block breit je Abschnitt bei 1:1), dazwischen X-Streben je Feld, in schmalen Feldern Zickzack.
- Plattformen: auf der ersten Etage liegt über den hohlen Pfeilern ein Rost aus Kupferrost (I); die zweite Etage ist bis auf
  den Aufzugsschacht ganz ausgelegt; eine Leiter führt vom verglasten Raum der dritten Etage aufs Oberdeck (I).
- Maßstäbe `[1, 0.5, 0.25]`; bei 0,5 und 0,25 werden Gurte, Streben und Eckträger gröber, die Pavillons der zweiten Etage
  entfallen bei 0,5, bei 0,25 auch die der ersten.

**Nachgemessen im fertigen Volumen (scale 1, `tmp/wahrzeichen-a/measure.mjs`):**

| Maß | Recherche | Bau |
|---|---|---|
| Gesamthöhe | 330 m | 330 Blöcke über dem Platz |
| Grundfläche außen | 124,90 m | 125 Blöcke |
| Lichter Abstand der Pfeiler (am Boden) | 74,24 m | 73 Blöcke |
| Scheitel Bogen-Innenkante | 39 m | 40 Blöcke |
| Erste Etage: Höhe / Seite | 57,63 m / 70,69 m | 58 / 71 |
| Zweite Etage: Höhe / Seite | 115,73 m / 40,96 m | 116 / 41 |
| Dritte Etage / Oberdeck / Seite | 276,13 / 279,11 / 18,65 m | 276 / 279 / 19 |
| Turmbreite auf 270 m | 10 m · 1,109 = 11,1 m (R) | 11 |

## 7. Quellen (Abruf 2026-10-22)

- [Q1] Wikipedia (de): Eiffelturm – https://de.wikipedia.org/wiki/Eiffelturm
- [Q2] Wikipedia (fr): Tour Eiffel (Abschnitt Dimensions) – https://fr.wikipedia.org/wiki/Tour_Eiffel
- [Q3] Wikipedia (en): Eiffel Tower – https://en.wikipedia.org/wiki/Eiffel_Tower
- [Q4] P. Weidman, I. Pinelis: Model equations for the Eiffel Tower profile: historical perspective and new results.
  C. R. Mécanique 332 (2004) 571–584 – https://doi.org/10.1016/j.crme.2004.02.021 (Tabelle 1; der Text lag als Auszug aus
  einem früheren Lauf dieses Auftrags in `tmp/wahrzeichen-a/research/weidman.txt` vor)
- Nicht erreichbar: https://www.toureiffel.paris/fr/le-monument/chiffres-cles (HTTP 403, übersprungen, nicht umgangen)
