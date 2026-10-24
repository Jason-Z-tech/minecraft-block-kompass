# Golden Gate Bridge – Maße für einen 1:1-Nachbau

Stand 2026-10-23 · Ziel: Minecraft **Java 26.2** · 1 Block = 1 m · für `js/builds/infrastruktur/golden-gate-bridge.js`
(Maßstäbe 1, 0,5 und 0,25)

Jede Angabe ist gekennzeichnet:

| Zeichen | Bedeutung |
|---|---|
| **B** | belegt: Betreiber (Golden Gate Bridge, Highway and Transportation District, goldengate.org) `[Qn]` |
| **S** | Sekundärquelle: Wikipedia, Fachpresse (ENR), Ingenieurbüro (Langan) |
| **R** | eigene Rechnung aus belegten Werten (Rechenweg steht dabei) |
| **G** | **geschätzt**, nicht belegt (Form oder Lage nach allgemeiner Kenntnis der Brücke, ohne Plan) |
| **U** | unbekannt: in keiner erreichbaren Quelle gefunden |
| **I** | Festlegung für den Bau |

---

## 1. Kurzfassung

- **Länge (B):** 2737 m (8981 ft) von Widerlager zu Widerlager inklusive Zufahrten [Q1]. Davon Hängebrücke 1966 m
  (6450 ft) = Hauptöffnung **1280 m** (4200 ft) + zwei Seitenöffnungen je **343 m** (1125 ft) [Q1].
- **Türme (B):** **227 m** über dem Wasser, **152 m** über der Fahrbahn; jedes Bein am Fuß **10 × 16 m** (33 × 54 ft) [Q1].
  Die Beine sind zellenförmig („honeycomb“) aus Stahlkästen [Q4] und **dreimal in der Dicke abgestuft**, an jeder
  Stufe ein Querriegel; die Portale werden nach oben kleiner [Q3][Q6].
- **Fahrbahn (B):** 27 m breit, davon **19 m zwischen den Bordsteinen** (sechs Spuren) und zwei Gehwege je **3 m** [Q1][Q5].
  **Durchfahrtshöhe 67 m** über mittlerem Hochwasser [Q1]. Fahrbahnhöhe (R): 227 − 152 = **75 m**.
- **Versteifungsträger (S):** zwei Fachwerkträger, **7,6 m** hoch [Q6]. Unterkante = 67 m (Durchfahrt), Oberkante ≈ 75 m (R, passt).
- **Hauptkabel (B):** zwei Stück, je **0,92 m** ⌀, 27.572 Drähte, 2332 m lang [Q1]. Hänger: **250 Paare im Abstand von 50 ft
  (15,24 m)** [Q1]. Durchhang: **nicht gefunden (U)**, im Bau berechnet (Abschnitt 6).
- **Zufahrten (S):** Nordviadukt „approximately 1000-foot-long“ auf vier Stahltürmen [Q8]; Südviadukt 714 ft (218 m),
  Fort-Point-Bogen 320 ft (97,5 m), Betonpylone „approximately 220-ft-tall“ [Q7].
- **Farbe (B):** „International Orange“, CMYK **0/69/100/6** [Q3] → RGB ≈ **#F04A00** (R, einfache Umrechnung).
  Im Bau **Oranger Beton** (`orange_concrete`), der unter allen geprüften Blöcken am nächsten liegt (Abschnitt 5).

---

## 2. Alle Maße mit Quelle

| Bauteil | Maß | Zeichen | Quelle / Rechnung | im Bau (1:1) |
|---|---|---|---|---|
| Gesamtlänge Widerlager–Widerlager | 2737 m (8981 ft) | B | [Q1] | 2737 Blöcke (z 0 … 2736) |
| Hängebrücke gesamt | 1966 m | B | [Q1] | 365 … 2331 = 1966 |
| Hauptöffnung (Turm–Turm) | 1280 m | B | [Q1] | Turmmitten z 708,5 / 1988,5 → 1280 |
| Seitenöffnungen | je 343 m | B | [Q1] | 708 − 365 = 343; 2331 − 1988 = 343 |
| Lage der Türme in der Länge | Nordturm 708 m vom Nordende | R/I | 2737 − 1966 = 771 m Zufahrten; Nord 305 m (S, ~1000 ft [Q8]) + 60 m Ankerhaus (G) | z = 708 |
| Turmhöhe über Wasser | 227 m (746 ft) | B | [Q1] | 227 Ebenen (y 0 … 226) |
| Turm über Fahrbahn | 152 m (500 ft) | B | [Q1] | 226 − 74 = 152 |
| Fahrbahnhöhe | 75 m | R | 227 − 152 | Fahrbahn auf Ebene 75 (y 74) |
| Durchfahrtshöhe | 67 m (220 ft) | B | [Q1][Q2] | Unterkante Träger y 67 |
| Versteifungsträger | 7,6 m hoch | S | [Q6] („7,6 Meter hohen Fachwerkträgern“) | y 67 … 74 = 8 Ebenen inkl. Fahrbahn |
| Breite gesamt | 27 m (90 ft) | B | [Q1] | 27 Blöcke |
| Fahrbahn zwischen Bordsteinen | 19 m (62 ft) | B | [Q1] | 19 Blöcke |
| Gehwege | je 3 m (10 ft) | B | [Q1] | 3 Blöcke je Seite (inkl. Randblock) |
| Spuren | 6 | B/S | [Q5][Q6] | 6 Spuren, Mittelschutz als Stufe |
| Turmbein am Fuß | 10 × 16 m (quer × längs) | B | [Q1] | 10 × 16 |
| Lichte Weite zwischen den Beinen | 19 m | I | = Fahrbahnbreite, die durch das Portal läuft | 19 |
| Abstufung der Beine | 3 Stufen | S | [Q6] („dreimal in der Dicke abgestuft“) | quer 10 → 9 → 8 → 7, längs 16 → 14 → 12 → 10 (Werte G) |
| Querriegel über der Fahrbahn | 4, Portale nach oben kleiner | B | [Q3] „portals … decrease on ascent“ | y 125–130, 167–172, 199–204, 221–226 (Höhen G) |
| Riegel und Kreuz unter der Fahrbahn | Andreaskreuz + Riegel | G | Fotos allgemein bekannt, keine Maße | Kreuz y 13 … 58, Riegel y 59 … 73 |
| Rippen der Riegel | senkrecht, breit | B | [Q3] „wide, vertical ribbing … on the horizontal tower bracing“ | jede 2. Spalte 1 Block vor (nur 1:1) |
| Fundament Südturm | 34 m unter Niedrigwasser | B | [Q1] | nicht gebaut (unter Wasser) |
| Pfeiler über Wasser | 13 m | G | – | Glatter Stein bis y 12 |
| Fender Südturm | Oval ~72 × 56 m, 3 m dick, 9 m hoch | G | [Q1] nennt nur das abgepumpte Wasser | Ellipse rx 36, rz 28 |
| Kabel-⌀ | 0,92 m (36 3/8 in) | B | [Q1] | 1 Block |
| Kabelabstand quer | 26 m | I | Kabel über der Außenkante der 27 m breiten Fahrbahn | x ±13 |
| Kabel am Turm (Sattel) | 223 m | I | 4 m unter der Spitze, auf dem Kronenriegel | y 223 |
| Kabel in Feldmitte | 78 m | G | knapp über dem Geländer, wie auf Fotos | y 78 |
| Durchhang Hauptöffnung | 145 m | R | 223 − 78; Literaturwert nicht gefunden (U) | Parabel |
| Durchhang Seitenöffnung | 10,4 m unter der Sehne | R | 145 · (343/1280)² (gleiche Horizontalkraft, gleichmäßige Last) | Parabel über der Sehne Turm → Pylon |
| Hänger | 250 Paare, 15,24 m (50 ft) | B | [Q1] | je Kabel 83 (Haupt) + 2 × 21 (Seiten) = 125 → 250 |
| Hängerseil-⌀ | 2 11/16 in (6,8 cm) | B | [Q1] | Akazienholzzaun (dünn) |
| Ankerblöcke | je 60.000 t | B | [Q1] | Ankerhäuser hohl, Form G |
| Nordviadukt | ~305 m (~1000 ft), 4 Stahltürme | S | [Q8] | z 6 … 304, 4 Stützen alle 61 m |
| Südviadukt | 218 m (714 ft) | S | [Q7] | z 2519 … 2730, 6 Felder |
| Fort-Point-Bogen | 97,5 m (320 ft) | S | [Q7] | z 2346 … 2443 = 98 |
| Betonpylone | ~67 m (220 ft) hoch (ab Gelände) | S | [Q7] | Oberkante 88 bzw. 92 m über Wasser (G; Pylone stehen auf den Hügeln) |
| Pylon-Querschnitt | 10 × 15 m | G | – | 10 × 15 |
| Ankerhäuser | je ~60 m lang | G | – | Nord z 305 … 364, Süd z 2459 … 2518 |
| Eröffnung | 27. Mai 1937 | S | [Q5] | Fakt |

## 3. Bauteile

1. **Pfeiler** – Südturm im offenen Wasser mit ovalem Fender, Nordturm am Ufer von Lime Point (Felsen). [Q1][Q6]
2. **Türme** – zwei hohle Beine (Stahlzellen [Q4]), unten Andreaskreuz und Fahrbahnriegel, darüber vier Querriegel mit
   Art-déco-Rippen [Q3]; die Beine springen an jedem Riegel zurück [Q6].
3. **Pylone N1/N2, S1/S2** – Art-déco-Betonpylone an den Enden der Hängebrücke; unter N1–N2 und S1-Ankerhaus die
   Kabelanker [Q1][Q7].
4. **Fort-Point-Bogen** – Stahlbogen über der Festung von 1861 am Südufer [Q6][Q7].
5. **Hauptkabel, Hänger, Versteifungsträger** – Parabel, Hänger alle 50 ft, zwei Fachwerkwände 7,6 m hoch [Q1][Q6].
6. **Zufahrten** – Nord: Fachwerk auf vier Stahltürmen [Q8]; Süd: Viadukt zum Toll Plaza [Q7].
7. **Fahrbahn, Gehwege, Geländer, Leuchten** – schlichtes Geländer mit weit gestellten Pfosten, schräge, schlanke
   Lichtmasten mit gelbem Licht [Q3].

## 4. Farben und Palette

| Rolle | Block | Begründung |
|---|---|---|
| Stahl (Türme, Kabel, Träger) | Oranger Beton `orange_concrete` | mittlere Texturfarbe #E06101, ΔE 15,4 zu #F04A00 – bester Wert aller geprüften Blöcke |
| Leuchtenmast | Harzziegelmauer/-stufe `resin_brick_wall`, `resin_brick_slab` | #CE5918, ΔE 21,3 – schlanke Form, passt farblich |
| Hänger, Geländer | Akazienholzzaun `acacia_fence` | dünn, orange-braun; ein Zaun in Oranger-Beton-Farbe gibt es nicht |
| Beton (Pfeiler, Pylone, Ankerhäuser) | Glatter Stein, Kanten Polierter Andesit | heller Sichtbeton |
| Fahrbahn | Grauer Beton, Markierung Weißer Beton | Asphalt |
| Gehweg | Hellgrauer Beton + Glatte Steinstufe | halbe Stufe erhöht wie ein Bordstein |
| Licht | Laterne (hängend unter der Stufe, stehend auf Zaun/Beton) | gelbes Licht wie die Natriumdampflampen [Q3] |
| Felsen Lime Point | Stein, Andesit, (bemooster) Bruchstein | – |

**Farbvergleich** (`tmp/infrastruktur-b/colors.mjs`: mittlere Farbe der 26.2-Textur, CIELAB-Abstand ΔE76):

| Block | Farbe | ΔE zu #F04A00 |
|---|---|---|
| Oranger Beton | #E06101 | **15,4** |
| Orange Wolle | #F17614 | 20,3 |
| Harzziegel | #CE5918 | 21,3 |
| Oranger Trockenbeton | #E38420 | 32,7 |
| Geschnittener roter Sandstein | #BD6620 | 34,7 |
| Orange Keramik | #A25426 | 43,4 |
| Akazienholzbretter | #A85A32 | 45,2 |
| Kupferblock | #C06C50 | 47,5 |
| Roter Beton | #8E2121 | 47,9 |

Wolle wäre fast gleich gut, brennt aber und sieht weich aus; Trockenbeton fällt (Schwerkraft). Der Anstrich-Ton von
Sherwin-Williams heißt „Fireweed“ (SW 6328) [Q3]; dessen Farbwert steht nicht auf der Quelle (U) und wurde nicht verwendet.

## 5. Unsicherheiten und Widersprüche

- **Kabeldurchhang:** in keiner erreichbaren Quelle (U). Gebaut mit Sattel 223 m und Tiefpunkt 78 m (G) → 145 m.
- **Lage und Höhe der Querriegel**, Abstufung der Beine (welche Breite in welcher Höhe): nur qualitativ belegt
  („dreimal abgestuft“, „Portale werden nach oben kleiner“). Werte geschätzt.
- **Pylone, Ankerhäuser, Pfeilerhöhe, Fender:** Form und Maße geschätzt. ENR nennt die Pylone „approximately 220 ft tall“ –
  das gilt ab ihrem Fuß am Hang; da der Bau alles auf die Wasserlinie stellt, stehen sie hier bis y = 0.
- **Gelände:** Im Original stehen Zufahrten und Pylone auf den Hügeln von Marin und Fort Point. Der Bau hat kein Gelände
  und kein Wasser; Stützen reichen bis zur Wasserlinie (Hinweis im Kapitel „Zufahrten“).
- **Wikipedia (en) gibt 8980 ft** an, der Betreiber 8981 ft – der Bau folgt dem Betreiber (2737 m).
- **Turm-Feldmitte:** die Turmmitten liegen bei z 708,5 und 1988,5 (gerade Beintiefe 16) – Abstand genau 1280.

## 6. Umsetzung (alles **I**)

- Koordinaten: x quer (Osten +), z entlang der Brücke von Marin (z = 0) nach San Francisco, y = 0 Wasserlinie.
- Maßstab s: alle Längen `round(m · s)`; Breiten auf ungerade Zahlen (Mittellinie), Beintiefen gerade.
- Hauptkabel: `y(z) = yMid + (ySattel − yMid) · ((z − zMitte) / halbeSpannweite)²`, flächenverbunden (Lücken in derselben
  Spalte geschlossen). Seitenöffnungen: Sehne Turm → Pylon minus `4 · d · t · (1 − t)`, d = 145 · (343/1280)².
  Rückhaltekabel gerade vom Pylon N1/S2 in die Ankerpylone N2/S1.
- Bei 1:2 und 1:4 fallen Rillen, Rippen, Windverband und Markierungen (1:4) weg; Gehwege entfallen, sobald sie
  nicht mehr in die Breite passen.

**Nachgemessen im fertigen Volumen** (`tmp/infrastruktur-b/measure-ggb.mjs`):

| Maß | echt | 1:1 | 1:2 | 1:4 |
|---|---|---|---|---|
| Länge | 2737 m | 2737 | 1369 | 684 |
| Turmhöhe | 227 m | 227 | 114 | 57 |
| Hauptöffnung | 1280 m | 1280 | 640 | 320,5 |
| Fahrbahn über Wasser | 75 m (R) | 75 | 38 | 19 |
| Durchfahrtshöhe | 67 m | 67 | 34 | 17 |
| Breite gesamt | 27 m | 27 | 13 | 7 |
| Fahrbahn | 19 m | 19 | 9 | 5 |
| Turmbein am Fuß | 10 × 16 m | 10 × 16 | 5 × 8 | 3 × 4 |
| Kabel-Tiefpunkt | 78 m (G) | 78 | 39 | 20 |

## 7. Quellenliste (Abruf 2026-10-23)

- [Q1] Golden Gate Bridge District: Design & Construction Stats – https://www.goldengate.org/bridge/history-research/statistics-data/design-construction-stats/
- [Q2] Wikipedia (en): Golden Gate Bridge (Infobox) – https://en.wikipedia.org/wiki/Golden_Gate_Bridge
- [Q3] Golden Gate Bridge District: Color & Art Deco Styling – https://www.goldengate.org/bridge/history-research/bridge-features/color-art-deco-styling/
- [Q4] Golden Gate Bridge District: Bridge Towers (Ausstellung) – https://www.goldengate.org/exhibits/bridge-towers/
- [Q5] Wikipedia (en): Golden Gate Bridge (Text: Spuren, Eröffnung, Anstrich) – https://en.wikipedia.org/wiki/Golden_Gate_Bridge
- [Q6] Wikipedia (de): Golden Gate Bridge – https://de.wikipedia.org/wiki/Golden_Gate_Bridge
- [Q7] ENR: Famed Golden Gate Span Undergoes Complex Seismic Revamp – https://enr.com/articles/13013-famed-golden-gate-span-undergoes-complex-seismic-revamp
- [Q8] Langan: Golden Gate Bridge, North Approach Viaduct Seismic Retrofit – https://www.langan.com/portfolio/golden-gate-bridge
- [Q9] Golden Gate Bridge District: Painting the Bridge – https://www.goldengate.org/bridge/bridge-maintenance/painting-the-bridge/ (im Modul als Quelle genannt; in diesem Abruf nicht erneut ausgewertet)
- [Q10] Wikipedia (en): International orange – https://en.wikipedia.org/wiki/International_orange (im Modul als Quelle genannt; in diesem Abruf nicht erneut ausgewertet)
- [Q11] Minecraft Java 26.2, lokal nur gelesen: Texturen aus `game-data/textures.bin` (Farbvergleich)

**Nicht erreichbar oder nicht ausgewertet:** Wikipedia (en) wurde nur bis etwa 40 % des Textes gelesen (Seite sehr lang);
der Abschnitt zur Erdbebenertüchtigung blieb ungelesen. Gesperrte Seiten (403/402) traten nicht auf.
