# Deep Structure Mastering Studio

Installierbare Web-App (PWA) unter `deepstructure.world/studio/`: Audio-Editor, Song-Check, KI-Artefakt-Suche, Mastering-Kette, Drum-Reparatur und Spiel-Daten-Export. Die gesamte Audioverarbeitung läuft lokal im Browser. Audiodateien verlassen das Gerät nie.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Die komplette App (HTML, CSS, JavaScript in einer Datei, ohne Build-Schritt) |
| `sw.js` | Service Worker: Offline-Start und Updates |
| `vorbis-encoder.js` | OGG-Vorbis-Encoder, wird nur beim OGG-Export nachgeladen (Lizenzen im Dateikopf) |
| `lame.min.js` | MP3-Encoder [LAME](https://lame.sourceforge.io) als JavaScript ([lamejs](https://github.com/zhuker/lamejs), LGPL), unverändert, wird nur beim MP3-Export nachgeladen |
| `Anleitung.pdf` | Bebilderte Anleitung für Tester und Nutzer, über den Knopf „Anleitung“ erreichbar |
| `manifest.webmanifest`, `icon-*.png`, `favicon.png`, `apple-touch-icon.png` | Installation als App |
| `tests/` | Automatisierte Tests (siehe `tests/README.md`) |
| `TESTREPORT.md` | Ergebnisse der letzten Prüfung inklusive FFmpeg-Gegenmessung |

## Technik

**Signalkette** (Echtzeit-Wiedergabe und Export nutzen denselben Aufbau, `buildChain()`):

1. **Eingang**
2. **8-Band-EQ:** Web-Audio-Biquads (RBJ). Low/High Cut sind Butterworth 2. Ordnung, die Q-Umrechnung in dB ist berücksichtigt.
3. **3-Band-Kompressor:** Linkwitz-Riley-Weichen 4. Ordnung mit Allpass-Ausgleich im Bassband. Je Band ein eigener Kompressor (`DSComp`, AudioWorklet in Echtzeit und in den Offline-Kontexten für Export und Messung):
   - Spitzenpegel, stereo gekoppelt
   - weiches Knie 6 dB
   - Regelung im dB-Bereich („smooth decoupled“ nach Giannoulis/Massberg/Reiss 2012)
   - kein automatisches Anheben: unterhalb der Schwelle bitgenau, Ausgleich nur über „Pegel“
   - keine Vorschau-Latenz

   Nur in Browsern ohne AudioWorklet wird auf den Browser-Kompressor zurückgegriffen.
4. **Sättigung:** tanh-Kennlinie, 4-fach überabgetastet, auf Kleinsignal-Verstärkung 1,0 normiert. Bei 0 % Mischung wird das Modul umgangen.
5. **Stereo:** M/S-Breite. Bass-Mono über einen Hochpass 4. Ordnung auf dem Seitensignal.
6. **Limiter:** True-Peak-Limiter mit 5 ms Vorschau (Details unten).

**True-Peak-Limiter:** gleitendes Minimum plus Kastenglättung, dadurch ist der Attack gleich der Vorschauzeit. Der Release ist exponentiell. Die Spitzenerkennung erfasst auch Zwischenwerte: ein schneller 16-Tap-Vorfilter entscheidet, wo es eng wird (ab 2,5 dB unter der Decke). Dort rechnet ein 4-fach-Polyphasen-FIR mit 128 Taps je Phase (Kaiser) plus Parabel-Feinbestimmung zwischen den Rasterpunkten. Eine Sicherheitsstufe schätzt zusätzlich Anteile nahe der Nyquist-Frequenz ab (Band per (−1)^n in den Bassbereich verschoben, tiefpassgefiltert, Hüllkurve als Zuschlag), damit die Decke auch unter idealer Rekonstruktion hält. Eine harte Sicherheitsgrenze sitzt auf Sample-Ebene. Signale unterhalb der Decke laufen bitgenau durch (latenzkorrigiert).

**Export:**
- Der Export rendert die Kette mit `OfflineAudioContext`. Die Latenz wird per Klick-Test kompensiert.
- Limiter, Messung und WAV-Kodierung laufen im Web Worker, mit demselben Limiter-Code wie in der Echtzeit-Wiedergabe (AudioWorklet). Die Wiedergabe nutzt ab 1.9.1 eine sparsame Spitzenerkennung (nur der 16-Tap-Vorfilter, ohne 128-Tap-Stufe und Nyquist-Zuschlag), damit auch Smartphones die Kette ohne Aussetzer schaffen. Export und Messung rechnen immer genau.
- Formate: WAV 16 und 24 Bit (TPDF-Dither, deterministisch), 32 Bit Float, OGG Vorbis (ca. 140 oder 240 kbit/s, VBR) sowie MP3 (320 oder 192 kbit/s, CBR).
- MP3: LAME über `lame.min.js` (lamejs, LGPL, als eigene Datei eingebunden). Vor die Audio-Frames setzt die App einen LAME-„Info“-Frame mit Encoder-Verzögerung (576) und Auffüllung. Browser, FFmpeg, VLC und minimp3 spielen dadurch lückenlos und sample-genau. MP3 erlaubt nur 32, 44,1 und 48 kHz, andere Raten werden für MP3 auf 48 kHz umgerechnet.
- Import von MP3, OGG und FLAC: Die Abtastrate wird aus dem Dateikopf gelesen, dekodiert wird in der Originalrate (vorher wurden MP3s auf 44,1 kHz umgerechnet).
- OGG Vorbis: libvorbis über `vorbis-encoder.js` (OggVorbisEncoder.js, MIT; libogg/libvorbis, BSD, Xiph.org). Die Datei wird erst beim ersten OGG-Export geladen und danach vom Service Worker zwischengespeichert. Die Kodierung läuft in Stücken, damit die Oberfläche bedienbar bleibt. Länge und Startzeit sind sample-genau wie beim WAV, die Spiel-Daten passen also auch zur OGG-Datei.

**Messung:**

| Messgröße | Verfahren |
|---|---|
| Lautheit | ITU-R BS.1770-4: K-Filter nach libebur128, Gating −70 LUFS absolut und −10 LU relativ |
| Kurzzeit-Lautheit | Fenster 3 s |
| Loudness Range | EBU Tech 3342: Perzentile 10 und 95, relatives Gate −20 LU |
| True Peak | 4-fach Oversampling, 48 Taps je Phase, Parabel-Feinbestimmung, Stille vor/nach der Datei berücksichtigt (hohe Töne bis 21 kHz auf ±0,02 dB genau) |

**Spektrum:**
- Linker und rechter Kanal werden getrennt transformiert (FFT 8192, Hann), die Leistung wird gemittelt. Gegenphasige Anteile löschen sich so nicht aus.
- Die Auswertung erfolgt in 31 Terzbändern.
- Das Live-Spektrum im EQ arbeitet ebenso mit getrennten Kanälen.

**Song-Check:**
- Er trennt *technische* Befunde (Clipping, Gleichspannung, Gegenphasigkeit, Knackser, Stille) von *klanglichen* Abweichungen (Balance gegenüber einer gemittelten Vergleichskurve oder der Referenz, Dynamik, Stereobreite).
- Klangliche Abweichungen werden nur als Hinweis formuliert, nie als Fehler.
- Die Punktzahl ist ein heuristischer Orientierungswert.
- Behebungen werden nur auf Knopfdruck angewendet.
- Stumme oder zu kurze Dateien (unter 0,4 s) werden nicht klanglich bewertet.

**KI-Artefakt-Suche:**
- STFT mit 2048 Punkten.
- Glitzern: Bin-Flackern über 6 kHz relativ zur Gesamtänderung.
- Stereo-Flattern: Instabilität der Phasendifferenz zwischen den Kanälen.
- Knackser: zweite Ableitung, nur bei höchstens 4 betroffenen Samples, damit Schlagzeug-Transienten nicht als Knackser zählen.
- Die Suche bewertet relativ zum Song selbst. Ihre Ergebnisse sind Hinweise, kein Beweis.

**Glätter:**
- Spektrales Entglitzern in Mitte und Seite: Begrenzung auf das 1- bis 3,6-Fache des zeitlichen Medians.
- STFT mit Wurzel-Hann-Fenster, verlustfrei rekonstruierend (getestet).
- Wahlweise nur auf markierte Stellen angewendet.

**Clean Song (Störtöne und Rauschteppich):**
- Suche: STFT mit 8192 Punkten (5,9 Hz Auflösung bei 48 kHz, 16384 ab 88,2 kHz), Hann, in Mitte und Seite getrennt. Für jede Frequenz wird gemessen, wie weit sie über ihren Nachbarn liegt (Ring 47–135 Hz daneben, Mittel in dB).
- Störton: ab 500 Hz, entweder in mindestens 65 % der hörbaren Abschnitte mehr als 8 dB über den Nachbarn und im Mittel mindestens 10 dB, oder in 60 % und im Mittel 12 dB. Musik wechselt Tonhöhe und Pegel (Töne der Tonart erreichen in den getesteten Songs höchstens 64 %), KI-Störlinien bleiben stehen (Blueprint: 83 %). Angehakt werden Töne ab 75 % und 9 dB, ab 14 dB und 800 Hz sowie Linien über 18 kHz; alles andere entscheidet der Nutzer nach dem Anhören.
- Rauschteppich: im Bereich 5–16 kHz der zusammenhängende Abschnitt (mind. 1,5 kHz breit), dessen Grundpegel (15-%-Wert) höchstens 9 dB unter dem Mittelwert (50 %) liegt. Abgesenkt wird nur in diesem Bereich (ohne Fund: 5–16 kHz, wenn der Regler von Hand aufgedreht wird).
- Entfernen: STFT 4096, Hop 1024, Hann/Hann (das Rauschprofil der Suche wird in Frequenz und Pegel auf diese Länge umgerechnet). Störtöne werden in ±5 Bins je Fenster auf die Hälfte des Nachbarpegels begrenzt (nur der Überschuss). Der Rauschteppich wird per spektraler Subtraktion mit zeitlich (≈ 45 ms) und spektral geglätteter Leistung abgesenkt; plötzliche Anstiege (Anschläge) werden sofort durchgelassen. Untergrenze −6 bis −18 dB je nach Regler, die Seite bekommt etwas mehr. Anschließend laufen Glätter und Knackser-Reparatur über die markierten Stellen. Ohne Auswahl bleibt das Signal bitgenau.
- Messung (synthetische Störung in „Dein Aber“): Störtöne −21 bis −32 dB, Rauschteppich in leisen Passagen −22 dB, laute Passagen und der restliche Frequenzgang praktisch unverändert.

**EQ-Kerben:** bis zu sechs Web-Audio-Notch-Filter hinter den acht Bändern, Güte 2–300 (bei 3,4 kHz und Güte 290 etwa 12 Hz breit, Mitte −145 dB, 155 Hz daneben −0,01 dB). Sie werden wie die Bänder im Export und in der Messung mitgerendert und bleiben bei Assistent, Presets und KI-Mastering erhalten. Clean Song kann einen gefundenen Störton direkt als Kerbe anlegen (Güte = Frequenz/12).

**Hör-Vergleich** (Näherung an PEAQ, ITU-R BS.1387, und ViSQOL):
- Gehörmodell: STFT 2048 (Hann, Hop 1024), Außen-/Mittelohr-Gewichtung nach Terhardt, 32 Bänder im ERB-Abstand von 50 Hz bis 16 kHz, Pegelbezug 0 dBFS = 92 dB SPL.
- Vorbereitung: Versatz per Kreuzkorrelation (±100 ms), Lautheit nach BS.1770 angeglichen, feste Klangfarben-Unterschiede je Band (Median) gemessen, angezeigt und vor dem Vergleich ausgeglichen. Verglichen werden Betragsspektren (phasenunabhängig).
- Verdeckung: Erregung mit Frequenzspreizung (27 dB/Band nach unten, 12 dB/Band nach oben) und Nachverdeckung (30 ms), Maske 4 dB unter der Erregung, mindestens Ruhehörschwelle.
- Kennwerte: Rauschen-zu-Maske-Verhältnis (NMR) je Band und Zeit, Anteil hörbar veränderter Abschnitte (NMR > 1,5 dB), NSIM-Ähnlichkeit der Gehör-Spektrogramme (3×3-Fenster, wie ViSQOL).
- Zahl 1–5 über eine eigene Kalibrierung an MP3 64–320 kbit/s, Vorbis q0–q8, Rauschen, Tiefpass, Bit-Reduktion und Clipping auf drei Songs: MP3 320 → 4,9, 192 → 4,75, 128 → 4,5, 96 → 3,3–3,9, 64 → 1,5–1,9; Vorbis q8 → 4,8, q5 → 4,6; Tiefpass 16 kHz → 5,0, 11 kHz → 3,6; reine EQ-Änderung → 5,0. Kein zertifizierter PEAQ- oder ViSQOL-Wert.
- Im Export wird bei MP3/OGG automatisch der Master mit der fertig dekodierten Datei verglichen („Hörbarer Kodierverlust“).

**Spiel-Daten** (Reiter „Spiel-Daten“, für Rhythmus- und Musikspiele, z. B. in Godot):
- Onset-Hüllkurve aus logarithmischem Spektral-Fluss (STFT 2048, Hop 512, L und R getrennt).
- Tempo: Autokorrelation mit metrischer Bewertung (Beat, halber und ganzer Takt) plus Bass-Periodizität. Eine sanfte Vorliebe für 60–200 BPM um 120 entscheidet Grenzfälle. Halbes oder doppeltes Tempo ist musikalisch oft gleichwertig, deshalb gibt es ÷ 2 und × 2 und ein Eingabefeld für ein bekanntes Tempo.
- Beat-Raster: gleichmäßig (konstantes Tempo). Periode und Phase werden fein gesucht, sodass möglichst viele Einsätze getroffen werden. Ganzzahlige Tempi werden eingerastet, wenn sie innerhalb von 0,04 BPM liegen. Genauigkeit an Testsignalen: unter 1 ms.
- Beat-Verfolgung (ab 1.10.0): Ausgehend vom festen Raster verfolgt eine dynamische Programmierung (nach Ellis 2007) die Schläge auf Breitband- plus Bass-Einsätzen (Kick), mit Straffheit 400 und Abständen von 85–118 % des Grundbeats. Danach wird über ±8 Beats linear geglättet. Weicht das Ergebnis bei 95 % der Beats um mehr als 20 ms vom festen Raster ab und trifft es die Einsätze deutlich besser (mindestens 8 %), gilt es (`steadyTempo: false`), sonst bleibt das exakt gleichmäßige Raster.
- Taktanfang (4/4): deutliche Bass-Akzente entscheiden. Fehlen sie, zählen Abschnittswechsel, die meist auf der „1“ liegen. Mit ‹ 1 und 1 › verschiebbar.
- Abschnitte: Neuheitskurve über Takt-Merkmale (Pegel, Bass, Mitten, Höhen, Einsatzstärke) mit etwa 5,5 s Kontext, unabhängig davon, ob halbes oder doppeltes Tempo gewählt ist. Die Typen (Intro, Aufbau, Hauptteil, Höhepunkt, Drop, Ruhephase, Outro) leitet eine Heuristik aus dem Energieverlauf ab. Sie sind frei umbenennbar.
- Schläge: adaptive Spitzensuche im Fluss je Band (Bass 30–150 Hz, Mitten 150–2500 Hz, Höhen 5–16 kHz) mit Stärke 0–1. Wahlweise auf 1/16 eingerastet.
- Export: JSON im Format `deepstructure.trackdata.v1`. Dazu gibt es GDScript (`TrackData`-Klasse mit `song_time()` nach Godot-Empfehlung) und eine Anleitung zum Einfügen in Codex. Mit „Klick“ läuft beim Abspielen ein Metronom am Mastering vorbei, um das Raster zu prüfen.
- Grenzen: Leichte Tempo-Schwankungen werden verfolgt, harte Tempowechsel (z. B. plötzlich halb so schnell) nur, solange der neue Beat innerhalb von 85–118 % des alten liegt. Die Taktart ist immer 4/4. Die Abschnittstypen sind Vorschläge, kein Songtext-Verständnis.

**Drum-Reparatur** (Reiter „Drums“, für typische KI-Drums im fertigen Stereo-Mix, ohne Stems):
- Erkennung: Einsätze in Bändern (Kick < 110 Hz mit Quadratur-Hüllkurve, Snare 1,2–5 kHz, HiHat > 7 kHz). Kick nur mit Tonhöhenabfall (unterscheidet sie von Bass-Tönen). Snare nur bei breitbandigem Anstieg in mindestens 4 von 5 Bändern. Zusätzlich werden nur Rasterplätze behalten, an denen regelmäßig Snares liegen. Marken erscheinen in der Wellenform.
- Metallklang: STFT 1024/256 mit Wurzel-Hann-Fenster. Eine schmale Frequenz wird abgesenkt, wenn sie bei einem Schlag gegenüber dem ruhigen Grundpegel neu aufklingt und dabei aus ihrer Umgebung herausragt. Stehende Töne wie Gesang, auch mit Vibrato, werden über einen Grundpegel-Verfolger mit Frequenz-Nachbarschaft geschont. Höchstens −12 dB.
- Sand: Die körnige Feinstruktur der Höhen wird in Zeit und Frequenz geglättet (3 × 5 Nachbarn, nur Absenkung von Spitzen). Danach wird die Energie je Frame wiederhergestellt.
- Ausklänge: Ein kurzer Raum (Freeverb-Prinzip) erhält nur die Höhen der ersten 60 ms jedes Schlags.
- Punch: Anschlag-Hüllkurve im Bass- und Höhenband (Nullphasen-Filter, komplementär). Optional wird der Ausklang in den Höhen gekürzt.
- Unterlegen: 6 Kick- und 7 Snare-Klänge (Punchy, Tief und weich, 808, Lo-Fi, akustisch, EDM bzw. akustisch, fett, hell, Clap, Snare + Clap, Trap, Rimshot) oder eigenes Sample, Tonhöhe aus dem Song gemessen. „An Original angleichen“ passt die Klangfarbe per Terzband-Korrektur (±12 dB) an das mittlere Spektrum der Original-Schläge an. „Im Song probehören“ rechnet 8 s ab dem Cursor oder die Auswahl und spielt sie in Schleife. Beim Klangwechsel wird nur neu unterlegt, das dauert unter 1 s. Die Kick wird per Kreuzkorrelation zeitlich und in der Polarität ausgerichtet. Der Pegel folgt jedem einzelnen Schlag.
- Anwenden erzeugt einen Bearbeitungsschritt mit Rückgängig. Erneutes Anwenden ersetzt ihn. „Vorher/Nachher“ tauscht nur den Abspiel-Puffer, die Wiedergabe läuft an derselben Stelle weiter. Mit allen Reglern aus bleibt der Song bitgenau unverändert.
- Grenzen: Was der Generator nicht erzeugt hat, lässt sich nicht zurückholen. Die Erkennung ist heuristisch, deshalb gibt es Marken zum Prüfen und drei Empfindlichkeitsstufen.

**Assistent:** Er korrigiert nur deutliche Abweichungen (Totzone ±2 dB, höchstens ±3 dB). Kompression setzt er nur bei großer Dynamik ein, Sättigung nie. Ein technisch sauberer Song bleibt nahezu unverändert.

## Mein Stil (lernendes Gedächtnis)

- **Beispiel:** Beim gemasterten Export (`styleLearnFromExport`) werden gespeichert: Merkmale des Songs vor dem Mastering aus `S.orig` (Terzband-Spektrum, auf 1 kHz-Mittel normiert und zu 10 Bereichen zusammengefasst; Lautheit I, LRA, PLR = TP − I, Seite/Mitte, Stereo im Bass, Korrelation), alle Einstellungen außer den Kerben, das gewählte Lautheitsziel und die erreichten Werte (I, TP, LRA). Schlüssel: Songname + Dauer; ein erneuter Export desselben Songs ersetzt das Beispiel.
- **Abstand:** gewichteter euklidischer Abstand in Maßstab-Einheiten (Spektrum 3 dB, I/LRA/PLR 3, Seite/Mitte 4 dB, Bass-Stereo 6 dB, Korrelation 0,15). Unter 15 Beispielen feste Gewichte (I und LRA 1,5, sonst 1). Ab 15 Beispielen gelernte Gewichte: je Merkmal 0,1 + 3 · r², r = stärkste Korrelation mit einer Entscheidung (EQ-Gains, Kompressor an, Sättigung an, Stereobreite, Bass-Mono, erreichte Lautheit).
- **Vorschlag:** die k = 5 nächsten Beispiele, Gewicht 1/(0,15 + d)². Zahlen gewichtet gemittelt (Frequenzen, Güten, Zeiten, Ratio logarithmisch), Schalter per Mehrheit, Filtertypen nach dem stärksten Gewicht. Ausgeschaltete EQ-Bänder zählen als 0 dB. Ergebnis wird gerundet und über `validateSettings` geprüft. Die Ziel-Lautheit ist das gewichtete Mittel der erreichten Lautheit, eingestellt über `setDriveToTarget`.
- **Speicher:** IndexedDB `dsms-style` auf dem Gerät, nichts verlässt das Gerät. Sicherung als `*.dsstyle.json` (Format `deepstructure.style.v1`); beim Laden werden Einträge mit ungültigen Einstellungen übersprungen.

## Album-Review

- **Speicher:** IndexedDB `dsms-album` mit den Bereichen `projects` (Projekt mit Songs, Versionen, Kommentaren, Entscheidungen) und `blobs` (Originaldateien unverändert; bearbeitete Audiodaten einer Version als WAV 24 Bit, gleiche Bearbeitung wird über einen Fingerabdruck nur einmal gespeichert). Gespeichert wird nach jedem Schritt, dadurch übersteht ein Projekt Abbruch und Neustart. Dekodiert im Arbeitsspeicher liegt nur der geöffnete Song.
- **Version:** `n`, Datum, Quelle, Modell (z. B. Claude API oder Mein Stil mit Vorbildern), App-Version, vollständige Einstellungen inkl. Kerben, Lautheitsziel, Bearbeitung (`editKey`, Beschreibung), Merkmale für Mein Stil, Messwerte (I, TP, LRA), Prüfergebnis, die zum Zeitpunkt offenen Kommentare.
- **Status:** `neu` (Nicht geprüft) nach jeder neuen oder zurückgeholten Version; `ueberarbeiten`; `frei` nur nach bestandener Prüfung und ausdrücklicher Freigabe; `blockiert` bei blockierendem Prüffehler. Alle Entscheidungen stehen mit Datum und Version im Protokoll des Songs.
- **Technische Prüfung:** Rendern des vollständigen Masters mit Limiter wie beim Export, dann: ungültige Samples (block), Sample-Spitze ≥ −0,001 dBFS (block), True Peak > 0 dBTP oder > Decke + 0,15 dB (block), Renderlänge ≠ Songlänge (block), Länge ≠ Original (Hinweis, Schnitt), ein Kanal stumm (block), Korrelation < −0,2 (block) bzw. < 0,2 (Hinweis), Bass unter 150 Hz verliert in Mono > 6 dB (block) bzw. > 3 dB (Hinweis), Gleichspannung > 0,5 % (Hinweis), Lautheit > 1,5 LU vom Ziel (Hinweis), Hör-Vergleich gegen das Original < 2 (Hinweis).
- **Lernen:** Freigabe schreibt genau ein positives Beispiel pro Song (`album:<Projekt>:<Song>:v<n>`, Bewertung `ok`), frühere positive Beispiele desselben Songs werden zu Entwürfen. „Überarbeiten“ schreibt die aktuelle Version als `schlecht`. `styleSuggest` und die gelernten Gewichte verwenden ausschließlich Beispiele mit Bewertung `ok`.
- **Export:** nur Songs mit Status `frei`, deren letzte Entscheidung die Freigabe der aktuellen Version ist; die Einstellungen werden vor dem Export gegen die freigegebene Version verglichen. Ausgabe über die vorhandene Export-Funktion (gleiche Formate und Messung), am PC per Ordnerauswahl (File System Access API), sonst als Downloads.

## KI-Mastering und Datenschutz

- **Claude-Version** (Artifact in claude.ai): Sie nutzt das Claude-Konto des Nutzers. Hier wird kein Schlüssel benötigt.
- **Diese Website:** Hier ist ein eigener Anthropic-API-Schlüssel nötig.
  - Er liegt standardmäßig **nur im Arbeitsspeicher** und ist nach dem Schließen weg.
  - Dauerhaft im Browser-Speicher landet er nur, wenn „Auf diesem Gerät merken“ angehakt ist.
  - Da es kein eigenes Backend gibt, sendet der Browser direkt an `api.anthropic.com`. Skripte auf der Seite und Browser-Erweiterungen könnten den Schlüssel grundsätzlich lesen. Empfehlung: ein eigener Schlüssel mit niedrigem Ausgabenlimit.
  - Im Repository liegt kein Schlüssel.
- **Übertragen werden nur Zahlen und Text, nie Audio:** Lautheit, True Peak, LRA, PLR, Stereo-Werte, das Terzband-Spektrum, ein grober Lautheitsverlauf, Dauer, Abtastrate, Song-Check-Befunde, aktuelle Einstellungen und der Wunschtext. Den Dateinamen überträgt die App nicht.

## Updates und Offline-Cache

- **App-Seite (`index.html`):** Der Service Worker lädt sie immer zuerst frisch aus dem Netz (`cache: 'no-cache'`), offline aus dem Cache. Neue Versionen erscheinen dadurch beim ersten Neustart.
- **Symbole und Schriften:** Sie kommen aus dem Cache und werden im Hintergrund aktualisiert.
- **Neue Version:** Bei jeder Änderung `VERSION` in `sw.js` erhöhen. Alte Caches werden dann automatisch gelöscht.
- **Einstellungen:** Gespeicherte Einstellungen (`localStorage`, Präfix `dsms.`) bleiben bei Updates erhalten.

## Änderungen 1.12.0 (Album-Review und Freigabe; Mein Stil lernt nur aus Bestätigtem)

- **Neuer Reiter „Album“:** Album-Projekt mit bis zu 12 Songs. Originale werden unverändert im Gerätespeicher abgelegt (IndexedDB), dekodiert wird immer nur der geöffnete Song.
- **Arbeitsversionen:** Vorschläge aus Assistent, Mein Stil, KI (Claude) oder einer Einstellungsdatei vom Chat „Mastering“ werden als Version gespeichert, eigene Änderungen mit „Als Version speichern“. Jede Version enthält Einstellungen, Bearbeitungen (z. B. Clean Song), Quelle und Modell, App-Version, Messwerte und Prüfergebnis. Jede frühere Version lässt sich wieder öffnen.
- **Review:** Trackliste mit Status („Nicht geprüft“, „Überarbeiten“, „Freigegeben“, „Technisch blockiert“), A/B-Vergleich über die vorhandene Original/Master-Umschaltung mit Pegelgleich, Kommentare mit Zeitbereich und Fehlertyp (als Markierung in der Wellenform), „Überarbeitungsauftrag kopieren“ für den Chat, „Mit KI überarbeiten“.
- **Technische Prüfung vor jeder Freigabe:** ungültige Samples, Clipping, True Peak gegen die Decke, Länge, stummer Kanal, Phase und Mono-Verträglichkeit im Bass, Gleichspannung, Abweichung vom Lautheitsziel, Hör-Vergleich gegen das Original. Blockierende Fehler verhindern die Freigabe.
- **Album-Lautheit:** Ziele mit Balance (die Hälfte der ursprünglichen Unterschiede bleibt, höchstens ±3 LU) oder alle gleich; Prüfung der Spanne mit Hinweisen statt Zwang.
- **Veröffentlichen:** Exportiert werden nur ausdrücklich freigegebene Songs, deren aktuelle Version die freigegebene ist. Am PC in einen gewählten Ordner („Album – Master“), sonst als Downloads, dazu ein Mastering-Protokoll. Fehlgeschlagene Exporte werden gemeldet, die übrigen laufen weiter.
- **Mein Stil lernt nur aus Bestätigtem:** Ein gemasterter Export ist jetzt nur ein Entwurf. Gelernt wird erst nach „Passt“ (in der Beispielliste) oder nach einer Freigabe im Album. „Passt nicht“ und „Überarbeiten“ werden als Negativbeispiel dokumentiert und nie nachgeahmt. Wird ein freigegebener Song geändert, zählt er bis zur erneuten Freigabe nicht mehr.
- **Album-Werkzeug:** höchstens 12 Songs, Clean-Stufen aus der App, Anpassungen pro Song (`"songs": {"3": {...}}`), `--nur 3,5` mastert nur einzelne Songs neu. Einstellungsdateien enthalten die Clean-Stufe und lassen sich im Album als Version laden.

## Änderungen 1.11.0 (Mein Stil: lernt aus deinen Masters)

- **Knopf „Mein Stil“** neben dem Assistenten. Jeder gemasterte Export wird automatisch ein Beispiel: wie der Song vorher klang (Klangbalance in 10 Bereichen, Lautheit, Lautheitsumfang, Abstand Spitze–Lautheit, Stereobreite, Stereo im Bass, Korrelation) und was du eingestellt hast (EQ, Dynamik, Sättigung, Stereo, Limiter, erreichte Lautheit). „Nur Schnitt“-Exporte zählen nicht, Kerben bleiben songbezogen.
- **Vorschlag für einen neuen Song:** Die fünf ähnlichsten Beispiele werden gesucht und ihre Einstellungen nach Ähnlichkeit gemischt (Frequenzen, Zeiten und Güten logarithmisch, Schalter per Mehrheit). Die Lautheit wird auf den Wert dieser Songs gebracht. Angezeigt werden die Vorbild-Songs mit Ähnlichkeit und eine Einschätzung, wie sicher der Vorschlag ist. Übernommen wird nur auf Knopfdruck, „Vorherige Einstellungen“ stellt zurück.
- **Lernt, was für dich zählt:** Ab 15 Beispielen gewichtet das Studio die Merkmale danach, wie stark sie mit deinen Entscheidungen zusammenhängen. In der Simulation sank der Fehler beim Höhen-Shelf von 1,03 dB (5 Beispiele) auf 0,35 dB (50) und 0,20 dB (1000), falsche Kompressor-Entscheidungen von 46 % auf 9 %.
- **Speicher nur auf dem Gerät** (IndexedDB). „Sicherung speichern/laden“ überträgt die Beispiele zwischen PC und Handy, einzelne Beispiele lassen sich entfernen, das Merken lässt sich abschalten.
- **Korrektur:** Die Farbe der Master-Kurve in den Legenden im Reiter Analyse und die Hervorhebungen im Hör-Vergleich waren unsichtbar (fehlende Farbvariable).

## Änderungen 1.10.1 (Equalizer: Punkte ziehen)

- **Hochziehen verschiebt die Frequenz nicht mehr:** Beim Ziehen eines EQ-Punkts wurden Frequenz und Pegel immer gleichzeitig aus der Zeigerposition gesetzt. Ein Zug senkrecht nach oben mit ein paar Pixeln Wackeln verschob Band 4 deshalb von 550 auf 567 Hz (Maus) bzw. 599 Hz (Finger). Außerdem sprang der Punkt beim Anfassen neben der Mitte auf die Zeigerposition. Gemeldet von einem Tester mit Studio- und DJ-Erfahrung.
  - Jetzt wird relativ gezogen: Der Punkt springt nicht mehr.
  - Jede Richtung reagiert erst nach einer kleinen Schwelle (Maus 10 px seitlich / 3 px hoch, Finger 18 / 6 px). Senkrecht ändert nur den Pegel, waagerecht nur die Frequenz, schräg beides.
  - Am PC hält Umschalt die Frequenz fest, Alt oder Strg den Pegel.
- **Hinweis im EQ:** Die Kurve zeigt die Summe aller Bänder. Nachbarbänder überlappen (bei Q 1 hebt +9 dB bei 550 Hz die Kurve bei 220 und 1400 Hz um etwa 1,8 dB mit an). Das ist normales EQ-Verhalten, die anderen Bänder selbst bleiben unverändert.

## Änderungen 1.10.0 (Spiel-Daten folgen schwankendem Tempo)

- **Beat-Verfolgung:** Die Spiel-Daten legten bisher immer ein streng gleichmäßiges Beat-Raster an. KI-Songs schwanken aber oft leicht im Tempo. Bei „Prologue: Awakening the Stars“ (Level 1) lief das Raster dadurch bis zu ±200 ms, also fast einen halben Beat, neben der Musik. Jetzt verfolgt das Studio die tatsächlichen Schläge (Kick und Breitband-Einsätze) und glättet sie. Bei festem Tempo bleibt das Raster exakt gleichmäßig wie bisher.
- **JSON:** neue Felder `track.steadyTempo` und `track.tempoRangeBpm`. Schwankt das Tempo, sind `beats[]` und `downbeats[]` immer enthalten (auch wenn „Beats und Takte“ abgewählt ist). `bpm` und `beatSec` sind dann Mittelwerte.
- **Godot-Code (`track_data.gd`):** `beat_index`, `bar_index` und `beat_phase` nutzen die Beat-Liste (Binärsuche), neu ist `beat_time(b)`. Ohne Liste rechnen sie wie bisher mit dem gleichmäßigen Raster. Geprüft in Godot 4.5.1. Die Codex-Anleitung sagt bei schwankendem Tempo ausdrücklich, dass `beats[]` zu verwenden ist.
- **Einrasten der Schläge** (hits) richtet sich nach den tatsächlichen Beats.

## Änderungen 1.9.3 (PC-Fassung: Audio-Module)

- **PC-Fassung lädt die Audio-Module ohne Umweg:** Edge lehnt bei direkt geöffneten Dateien (`file://`) das erste Ladeverfahren ab und meldete „AudioWorklet-Variante fehlgeschlagen … AbortError“. Das zweite Verfahren (data:) funktionierte, die Meldung war also harmlos. Die PC-Fassung nimmt jetzt gleich das passende Verfahren. Gewarnt wird nur noch, wenn wirklich keins klappt.
- **Rückmeldung:** Die technischen Daten nennen jetzt, ob das Audio-Modul (AudioWorklet) oder der Ersatz läuft.
- **Tests:** Der Browser-Testlauf öffnet zusätzlich die PC-Fassung aus der Datei und prüft, dass die Module ohne Warnung laden.

## Änderungen 1.9.2 (Korrekturen nach dem Prüfbericht 1.9.0)

- **Statuszeile nur noch als Text:** Meldungen mit Dateinamen oder Fehlertexten wurden als HTML gedeutet. Ein präparierter Dateiname hätte so HTML oder Skript-Code in die Seite bringen können. Jetzt wird alles als reiner Text angezeigt.
- **Hör-Vergleich veraltet nicht mehr unbemerkt:** Nach einer Änderung an EQ, Kompressor, Sättigung, Limiter oder am Song wird das alte Ergebnis ausgeblendet, stattdessen steht „Bitte neu vergleichen“. Wird während der Berechnung etwas geändert, wird das Ergebnis verworfen. Beim Vergleich „Original-Datei ↔ Bearbeitung“ zählen nur Änderungen am Song, weil das Mastering dort nicht beteiligt ist.
- **Hör-Vergleich klarer beschriftet:** „Klangunterschied, keine Qualitätsnote“ und „5 = kein Unterschied“. Eine feste Klangfarben-Änderung ab 1 dB wird im Text genannt und hervorgehoben. Ist sonst nichts hörbar, lautet das Urteil „Nur die Klangfarbe ist verändert“ statt „Kein Unterschied hörbar“.
- **KI-Anzeige:** Nach „Entfernen“ des API-Schlüssels steht wieder „nicht verbunden“ (vorher blieb „API-Schlüssel (Sitzung)“ stehen).
- **API-Schlüssel merken:** Der Hinweis sagt jetzt deutlich, dass der Schlüssel dann unverschlüsselt im Browser liegt.
- **Version an einer Stelle** (im Quell-Repository Deep-Structure-Mastering-Studio): Datei `VERSION`, `build.sh` überträgt sie überall hin.
- **Automatische Tests auf GitHub** bei jedem Push (GitHub Actions).

## Änderungen 1.9.1 (Wiedergabe auf dem Smartphone)

- **Weniger Rechenlast bei der Wiedergabe:** Auf schwachen Geräten konnte die Echtzeit-Kette zu viel Rechenzeit brauchen. Dann setzt das Audio kurz aus, das klingt wie Knackser und fehlende Teile, besonders hörbar am Gesang. Die exportierte Datei war davon nicht betroffen.
  - Der Limiter der Wiedergabe nutzt eine sparsame Spitzenerkennung (etwa 3,5-mal weniger Rechenzeit). Im Export bleibt die genaue True-Peak-Erkennung unverändert. Bei Musik weichen Vorschau und Export um weniger als −60 dB voneinander ab (Blueprint: −61,5 dB, Pegel 0,006 dB).
  - Der Kompressor rechnet etwa 2,3-mal schneller (gleiches Ergebnis).
  - Auf Smartphones und Geräten mit höchstens 4 Kernen wird die Messung nach einer Änderung nicht mehr während der Wiedergabe gerechnet, sondern beim Anhalten.
- **Kein Dauer-Ersatz mehr:** Lädt das Audio-Modul (AudioWorklet) erst nach den 5 Sekunden Wartezeit, wechselt das Studio jetzt nachträglich darauf, statt bis zum Neuladen den langsameren Ersatz zu nutzen. Der Ersatz selbst arbeitet mit größerem Puffer (weniger Aussetzer).

## Änderungen 1.9.0 (Hör-Vergleich, EQ-Kerben)

- **Hör-Vergleich** im Reiter „Analyse“ (Näherung an PEAQ und ViSQOL): vergleicht Original-Datei ↔ Master, Original-Datei ↔ Bearbeitung (z. B. Clean Song) oder Bearbeitung ↔ Master über ein Gehörmodell mit Verdeckung. Ergebnis: Zahl von 1 bis 5 mit Einordnung, feste Klangfarben-Unterschiede in sechs Bereichen, eine Karte, wo im Song und in welchem Frequenzbereich ein Unterschied hörbar ist (antippen spielt ab), und die deutlichsten Stellen zum Anhören.
- **Export:** Bei MP3 und OGG steht zusätzlich der „Hörbare Kodierverlust“ (Master gegen fertige Datei).
- **EQ-Kerben:** bis zu sechs sehr schmale Schnitte (Güte bis 300) gegen einzelne Störtöne, mit Marke in der EQ-Kurve. In der Clean-Song-Liste legt „Kerbe“ einen gefundenen Störton direkt als Kerbe an. Kerben bleiben bei Assistent, Presets und KI-Mastering erhalten.

## Änderungen 1.8.2 (Anleitung zum Herunterladen)

- **Knopf „Anleitung“** oben in der Kopfzeile: lädt die bebilderte Anleitung als PDF herunter (`Anleitung.pdf` liegt neben der App). In der PC-Fassung öffnet sie sich im PDF-Betrachter, weil Browser dort kein Nachladen aus Dateien erlauben.

## Änderungen 1.8.1 (Clean Song an Blueprint geschärft)

- **Feinere Störton-Suche:** doppelte Frequenzauflösung (5,9 Hz) und eine zusätzliche Regel für Töne, die sehr beständig, aber nicht ganz so laut sind. Dadurch wird der Störton bei 3453 Hz in Blueprint gefunden (in 83 % des Songs, im Intro bis +33 dB). Mit 1.8.0 rutschte er knapp unter der Schwelle durch.
- **Rauschteppich:** wird nur noch im gefundenen Frequenzbereich abgesenkt (vorher 5–16 kHz), damit Höhen außerhalb unberührt bleiben.

## Änderungen 1.8.0 (Clean Song)

- **Clean Song** in der Karte „KI-Artefakte“: findet stehende Störtöne (schmales Pfeifen oder Schleifen, das über den ganzen Song gleich bleibt) in Mitte und Seite und einen gleichbleibenden Rauschteppich in den Höhen. Jeder Ton steht mit Frequenz, Abstand zu den Nachbarfrequenzen und Anteil am Song in einer Liste, lässt sich einzeln anhören und abhaken. Ein Knopf entfernt alles in einem Schritt: angehakte Störtöne, Rauschteppich (Regler), Glitzern und Flattern an den markierten Stellen und Knackser. „Entferntes anhören“ spielt nur das, was entfernt wurde.
- Der Song-Check nennt gefundene Störtöne und den Rauschteppich mit Sprung zu Clean Song.
- Das bisherige Glätten bleibt unverändert. Es sucht kurze Ausreißer und konnte stehende Töne grundsätzlich nicht erfassen.
- **Start ohne Hänger:** Lädt ein Browser die Audio-Module (AudioWorklet) vor der ersten Berührung nicht, nutzt das Studio nach 5 Sekunden den eingebauten Ersatz, statt zu warten.
- **Laden:** Die Wellenform-Übersicht wird jetzt vor dem Audio-Start berechnet. Vorher konnte ein Neuzeichnen beim allerersten Laden abstürzen oder kurz die alte Wellenform zeigen.

## Änderungen 1.7.1 (Korrekturen nach dem Prüfbericht 1.7.0)

- **Original-Taste:** Nach einer Bearbeitung (Drum-Reparatur, Glätten, Pegel) spielt „Original“ jetzt synchron die geladene Datei. Vorher lief dort der bearbeitete Stand ohne Mastering, dadurch klang beides fast gleich. Nach einem Schnitt (andere Länge) zeigt die Taste „Ohne Mastering“, weil die Originaldatei dann nicht mehr deckungsgleich ist.
- **Kein falscher Song nach Wechsel:** Drum-Reparatur, Drum-Probe und Glätten verwerfen ihr Ergebnis, wenn der Song inzwischen gewechselt oder bearbeitet wurde.
- **Limiter aus = komplett umgangen,** auch der Drive. Vorher blieb die Drive-Verstärkung aktiv (Übersteuerungsfalle).
- **True-Peak-Sicherheitsstufe:** Spitzen ganz nah an der Nyquist-Frequenz sieht jeder endliche Interpolator etwas zu niedrig. Der Limiter schätzt diesen Anteil jetzt gesondert ab und regelt entsprechend mehr. Ergebnis: Die Decke hält auch unter idealer (unendlich langer) Rekonstruktion, im Grenzlasttest des Prüfberichts −1,08 statt −0,55 dBTP. Bei Musik kostet das nichts (gemessen „Dein Aber“: ideal −1,00 dBTP wie vorher), bei Vollband-Rauschen etwa 0,1 bis 0,5 dB Lautheit.
- **MP3-/OGG-Export:** Die angezeigten Werte stammen jetzt aus der fertigen, wieder dekodierten Datei. Die Werte vor der Kodierung stehen darunter. Kann ein Browser das Format nicht dekodieren, steht ausdrücklich „Messung vor der Kodierung“ da.
- **Mehrkanal-WAV:** Die Kanalmaske (WAVE_FORMAT_EXTENSIBLE) wird ausgewertet. Center und andere mittige Kanäle gehen gleich stark auf beide Seiten, LFE entfällt, Kanäle ohne bekannte Position werden mittig eingemischt und gemeldet. Ohne Maske gelten die üblichen Belegungen (3 = L R C, 4 = Quadro, 5 = L R C Ls Rs, 6 = 5.1, 7 = 6.1, 8 = 7.1).

## Änderungen 1.7.0 (eigener Kompressor, Drum-Klänge)

- **Eigener Kompressor** statt Browser-Kompressor: Er klingt in jedem Browser und im Export gleich und hebt nichts automatisch an.
  - Die Grundeinstellungen und Presets sind so kalibriert, dass die Wirkung der bisherigen entspricht (Schwellen 5 dB höher, LRA bei „Streaming klar“ auf −14 LUFS: vorher 6,4, jetzt 6,2 LU).
  - Eigene gespeicherte Kompressor-Einstellungen wirken jetzt stärker und ohne automatisches Anheben. Für die gleiche Wirkung die Schwelle etwa 4 bis 5 dB höher stellen.
- **Drum-Reparatur:** 6 Kick- und 7 Snare-Klänge zur Auswahl, „An Original angleichen“, „Im Song probehören“ mit Umschalten auf das Original.

## Änderungen 1.6.3 (MP3-Export)

- Export als **MP3** mit 320 oder 192 kbit/s. Die Datei ist lückenlos markiert (LAME-Info-Frame): Länge und Startzeit sind sample-genau wie beim WAV, geprüft mit FFmpeg und Chrome.
- MP3-, OGG- und FLAC-Dateien werden in ihrer Originalrate geladen. Eine 48-kHz-MP3 wurde vorher auf 44,1 kHz umgerechnet.

## Änderungen 1.6.2 (Korrekturen nach Codex-Prüfung, OGG wieder enthalten)

Eine Codex-Überarbeitung vom 23.10.2026 basierte auf 1.6.0. Ihr fehlte deshalb der OGG-Export. Übernommen wurde nur, was nachweislich besser war.

| Bereich | 1.6.1 | Codex-Stand | 1.6.2 |
|---|---|---|---|
| True Peak, weißes Rauschen +12 dB (ideale Rekonstruktion) | +0,9 dBTP | Ziel −1,2 dBTP, aber 8- bis 20-mal langsamer; überschätzt hohe Töne um bis zu 2,9 dB | +0,1 dBTP (FFmpeg: −0,9 statt −0,3). Musik und hohe Töne bleiben exakt auf der Decke. |
| Geschwindigkeit „Dein Aber“: Messung / Drive auf Ziel | 5,3 s / 5,2 s | 27,6 s / 44 s | 6,4 s / 6,5 s |
| WAV-Import | Größe 0 im Kopf ergab eine leere Datei | lehnte abgeschnittene Dateien und Streaming-WAVs ab | Liest alles Vorhandene mit Hinweis, NaN wird zu Stille, Mehrkanal wird heruntergemischt |
| Offline-Cache | löschte alle Caches der Domain | behielt alte Studio-Caches für immer | Eigener Namensraum, alte Studio-Versionen werden aufgeräumt, der OGG-Encoder wird übernommen |
| Einstellungen | einfache Prüfung | vollständige Prüfung, atomarer Import | übernommen |
| Ersatz-Limiter ohne AudioWorklet | Kompressor + falsch skalierte Decke | Limiter-Code per ScriptProcessor | übernommen |
| OGG-Export | vorhanden | fehlte | vorhanden |

## Änderungen 1.6.1 (OGG-Export)

- Export als **OGG Vorbis**: ca. 140 kbit/s für Spiele und Web, ca. 240 kbit/s für hohe Qualität. Gut für Godot.
- Länge und Startzeit sind sample-genau wie beim WAV (geprüft mit FFmpeg).

## Änderungen 1.6.0 (Drum-Reparatur)

- Neuer Reiter **Drums**:
  - Metallklang entfernen
  - Sand glätten
  - Abgehackte Ausklänge füllen
  - Punch
  - Saubere Kick/Snare unterlegen (eingebaut oder eigenes Sample)
- Kick-, Snare- und HiHat-Erkennung im fertigen Mix mit Marken in der Wellenform.
- Vorher/Nachher ohne Unterbrechung der Wiedergabe.
- Neue Tests: 8 DSP-Tests, 4 Browser-Tests. Bestehende Funktionen sind unverändert.

## Änderungen 1.5.0 (Spiel-Daten)

- Neuer Reiter **Spiel-Daten**: Tempo, Beat-Raster, Taktanfang, Abschnitte, Energie pro Beat und Takt, Bass/Mitten/Höhen pro Beat, Schläge mit Stärke, Lautheitsverlauf.
- Kopieren als JSON, Speichern als `.trackdata.json` (mit Level-Nummer im Dateinamen), GDScript für Godot 4, Anleitung für Codex.
- Metronom-Klick zum Prüfen des Rasters, Abschnittsmarken in der Wellenform.
- Bestehende Funktionen und Messwerte sind unverändert. Neue Tests: 15 DSP-Tests, 6 Browser-Tests.

## Änderungen 1.4.0 (Fehlerbehebung und Validierung)

| Bereich | Fehler | Korrektur |
|---|---|---|
| Sättigung | Der Pegel stieg bei eingeschalteter Sättigung um +12,04 dB, auch bei 0 % Mischung. Ursache: Die Kennlinie war für ±4 berechnet, aber der Vorverstärker fehlte. | Vorverstärker −12 dB (`SAT_PRE`) ergänzt. Bei 0 % Mischung wird das Modul umgangen. |
| Lautheitsziel | Der Knopf übergab das Klick-Ereignis als Zielwert. Folge: keine Änderung, aber Erfolgsmeldung („Ziel [object PointerEvent]“). | Zielwert wird aus dem Auswahlfeld gelesen und geprüft. Der gerundete Drive wird nachgemessen, unerreichbare Ziele werden klar gemeldet. |
| Spektrum | (L+R)/2 vor der FFT löschte gegenphasige Anteile (Testsignal: −200 dB). | L und R getrennt transformiert, Leistung gemittelt. Gilt auch für das Live-Spektrum und die Artefakt-Suche. |
| Preset „Neutral“ | Der Limiter war bei −1 dBTP aktiv. | Alle Module aus. Nulltest bestanden. |
| Song-Check | Klangliche Abweichungen wurden als „Schwäche“ dargestellt. Stumme Dateien erzeugten Fehlalarme (0/0). | Technische und klangliche Befunde getrennt, neutrale Wortwahl, Orientierungswert gekennzeichnet, stumme und zu kurze Dateien abgefangen. |
| Assistent und KI | Beide griffen auch bei sauberen Songs deutlich ein. | Totzone, kleinere Korrekturen, keine Kompression und Sättigung ohne Anlass. Die KI-Anweisung erlaubt ausdrücklich „nichts ändern“. |
| API-Schlüssel | Er wurde dauerhaft im `localStorage` gespeichert. | Standard ist jetzt nur die Sitzung. Speichern geschieht nur nach ausdrücklicher Wahl, mit Risiko-Hinweis und Liste der übertragenen Daten. |
| Service Worker | `fetch` konnte den 10-Minuten-HTTP-Cache von GitHub Pages treffen. | `cache: 'no-cache'` für die App-Seite, `cache: 'reload'` beim Installieren. Version 1.4.0. |

## Bekannte Einschränkungen

- Der Kompressor hat keine Vorschau (Lookahead). Sehr kurze Transienten können deshalb minimal durchrutschen, das fängt der Limiter ab.
- Die Sättigung ist bei kleinen Pegeln exakt pegelneutral. Laute Passagen werden bewusst weich begrenzt, sie werden also etwas leiser und nie lauter.
- Die Vergleichskurve des Song-Checks ist ein grober Durchschnitt. Für Genre-gerechte Aussagen eine Referenz laden.
- Die Artefakt-Suche bewertet relativ zum Song. Ein durchgehend artefaktbehafteter Song zeigt deshalb nicht jede Stelle.
- Die Echtzeit-Lautheitsanzeige ist eine Näherung (K-Filter aus Web-Audio-Biquads). Maßgeblich sind die Werte im Reiter Analyse, die exakt dem Export entsprechen.
- Die Wiedergabe-Vorschau des Limiters ist sparsamer als der Export. Bei Musik ist der Unterschied unhörbar (unter −60 dB), maßgeblich für True Peak sind die Werte im Reiter Analyse und die exportierte Datei.
- Auf Smartphones und Geräten mit höchstens 4 Kernen wird nach einer Änderung erst beim Anhalten neu gemessen.
