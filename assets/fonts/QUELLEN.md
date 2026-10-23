# Schriften – Quellen und Lizenzen

Alle Schriften stehen unter der **SIL Open Font License 1.1** (OFL). Die Lizenztexte liegen
neben den Dateien. Die Schriften werden lokal eingebunden (`css/style.css`, `@font-face` mit
`font-display: swap`), es gibt keine Anfragen an Google-Server.

Heruntergeladen am **2026-10-22** über die Google-Fonts-CSS-API (Chrome-User-Agent, damit woff2
geliefert wird). Übernommen wurden nur die Teilmengen `latin` und `latin-ext`, jeweils als
variable Schrift (eine Datei für alle Gewichte). Die `unicode-range`-Angaben in `css/style.css`
stammen aus diesen CSS-Antworten – mit einer Ausnahme: Für die Überschriften-Schrift „BK Display“
nimmt `css/style.css` die Ziffern 0–9 (U+0030–0039) aus Atkinson Hyperlegible Mono statt aus
Pixelify Sans, weil die Pixelify-Ziffern in kleinen Größen kaum unterscheidbar sind (2/8, 5/S).
Die Schriftdateien selbst sind unverändert.

## Pixelify Sans (Überschriften)

- Copyright 2021 The Pixelify Sans Project Authors (https://github.com/eifetx/Pixelify-Sans)
- CSS: https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&display=swap
- Gewichte 400–700 (variabel), Stil normal
- Lizenz: `pixelify-sans-OFL.txt` von https://raw.githubusercontent.com/google/fonts/main/ofl/pixelifysans/OFL.txt

| Datei | Teilmenge | Quelle | Bytes | SHA-256 |
|---|---|---|---|---|
| `pixelify-sans-latin.woff2` | latin | https://fonts.gstatic.com/s/pixelifysans/v3/CHylV-3HFUT7aC4iv1TxGDR9Jn0Eiw.woff2 | 12016 | `4a5633a0c9c1b73abd133a56d3716c2d8df2ed03cb987346f72194aeb224f382` |
| `pixelify-sans-latin-ext.woff2` | latin-ext | https://fonts.gstatic.com/s/pixelifysans/v3/CHylV-3HFUT7aC4iv1TxGDR9JnMEi1lR.woff2 | 8208 | `0afa0101fd8c5892b1661f7561564c98f0aa13ef2d6609809d477820c4bc6c89` |

## Atkinson Hyperlegible Next (Fließtext)

- Copyright 2020-2024 The Atkinson Hyperlegible Next Project Authors (https://github.com/googlefonts/atkinson-hyperlegible-next)
- CSS: https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:ital,wght@0,200..800;1,200..800&display=swap
- Gewichte 200–800 (variabel), Stil normal und kursiv
- Lizenz: `atkinson-hyperlegible-next-OFL.txt` von https://raw.githubusercontent.com/google/fonts/main/ofl/atkinsonhyperlegiblenext/OFL.txt

| Datei | Teilmenge | Quelle | Bytes | SHA-256 |
|---|---|---|---|---|
| `atkinson-hyperlegible-next-latin.woff2` | latin | https://fonts.gstatic.com/s/atkinsonhyperlegiblenext/v7/NaPNcYPdHfdVxJw0IfIP0lvYFqijb-UxCtm5_wdGseiJn3o.woff2 | 33996 | `18b2a1a39a2fa298b0ba5390aca68462669826c90925656f1c1f6796e0e1bbaf` |
| `atkinson-hyperlegible-next-latin-ext.woff2` | latin-ext | https://fonts.gstatic.com/s/atkinsonhyperlegiblenext/v7/NaPNcYPdHfdVxJw0IfIP0lvYFqijb-UxCtm5_wdGseiHn3qmpQ.woff2 | 19092 | `7dae0c6c66af1aec82e096186aeb1f0e6fa36ab8061ed65422f2b7daf4dd93f3` |
| `atkinson-hyperlegible-next-italic-latin.woff2` | latin, kursiv | https://fonts.gstatic.com/s/atkinsonhyperlegiblenext/v7/NaPPcYPdHfdVxJw0IfIP0lvYFqijb-UxCtm5_wdGseiMr3i-oQ.woff2 | 37644 | `4a5037bfaf6680f40147407407ec09fa42925774bde809a579283d27f9f08106` |
| `atkinson-hyperlegible-next-italic-latin-ext.woff2` | latin-ext, kursiv | https://fonts.gstatic.com/s/atkinsonhyperlegiblenext/v7/NaPPcYPdHfdVxJw0IfIP0lvYFqijb-UxCtm5_wdGseiMr3a-oXZ-.woff2 | 20132 | `c0c8da569118e5b2c17032c4f1d0e293271e478fb50d869aefd08fcffdf2042b` |

## Atkinson Hyperlegible Mono (Zahlen, Koordinaten, IDs, Befehle)

- Copyright 2020-2024 The Atkinson Hyperlegible Mono Project Authors (https://github.com/googlefonts/atkinson-hyperlegible-next-mono)
- CSS: https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@200..800&display=swap
- Gewichte 200–800 (variabel), Stil normal
- Lizenz: `atkinson-hyperlegible-mono-OFL.txt` von https://raw.githubusercontent.com/google/fonts/main/ofl/atkinsonhyperlegiblemono/OFL.txt

| Datei | Teilmenge | Quelle | Bytes | SHA-256 |
|---|---|---|---|---|
| `atkinson-hyperlegible-mono-latin.woff2` | latin | https://fonts.gstatic.com/s/atkinsonhyperlegiblemono/v8/tss4AoFBci4C4gvhPXrt3wjT1MqSzhA4t7IIcncBiwKthFw.woff2 | 17752 | `2706b1ee4f452e744ea91f7e4908cbde9c5d35521bf5ffffc71a382a2de89613` |
| `atkinson-hyperlegible-mono-latin-ext.woff2` | latin-ext | https://fonts.gstatic.com/s/atkinsonhyperlegiblemono/v8/tss4AoFBci4C4gvhPXrt3wjT1MqSzhA4t7IIcncBiwKjhFyRHQ.woff2 | 10740 | `3fa1fa7e990377c87018d62f356cc42b8db39fd88cee5724431e9f0d63b7f32f` |

## Zeichenabdeckung (geprüft)

Die cmap-Tabellen der `latin`-Dateien enthalten alle deutschen Zeichen (ÄÖÜäöüß), die
Anführungszeichen „“ ‚‘ ’, – — … × · › ‹ « » € ° ² ³ ± − ÷ •. **Nicht enthalten** sind Pfeile
(← ↑ → ↓), ✓ und ẞ; Pixelify Sans hat außerdem kein schmales Leerzeichen (U+2009).
Pfeile und Haken kommen deshalb als eigene SVG-Icons aus `assets/icons.svg`.
