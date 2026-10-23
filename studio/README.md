# Deep Structure Mastering Studio

Installierbare Web-App (PWA) unter `deepstructure.world/studio/`: Audio-Editor, Song-Check, KI-Artefakt-Suche, Mastering-Kette, Drum-Reparatur und Spiel-Daten-Export. Die gesamte Audioverarbeitung läuft lokal im Browser. Audiodateien verlassen das Gerät nie.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Die komplette App (HTML, CSS, JavaScript in einer Datei, ohne Build-Schritt) |
| `sw.js` | Service Worker: Offline-Start und Updates |
| `vorbis-encoder.js` | OGG-Vorbis-Encoder, wird nur beim OGG-Export nachgeladen (Lizenzen im Dateikopf) |
| `lame.min.js` | MP3-Encoder [LAME](https://lame.sourceforge.io) als JavaScript ([lamejs](https://github.com/zhuker/lamejs), LGPL), unverändert, wird nur beim MP3-Export nachgeladen |
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
- Limiter, Messung und WAV-Kodierung laufen im Web Worker, mit demselben Limiter-Code wie in der Echtzeit-Wiedergabe (AudioWorklet).
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

**Spiel-Daten** (Reiter „Spiel-Daten“, für Rhythmus- und Musikspiele, z. B. in Godot):
- Onset-Hüllkurve aus logarithmischem Spektral-Fluss (STFT 2048, Hop 512, L und R getrennt).
- Tempo: Autokorrelation mit metrischer Bewertung (Beat, halber und ganzer Takt) plus Bass-Periodizität. Eine sanfte Vorliebe für 60–200 BPM um 120 entscheidet Grenzfälle. Halbes oder doppeltes Tempo ist musikalisch oft gleichwertig, deshalb gibt es ÷ 2 und × 2 und ein Eingabefeld für ein bekanntes Tempo.
- Beat-Raster: gleichmäßig (konstantes Tempo). Periode und Phase werden fein gesucht, sodass möglichst viele Einsätze getroffen werden. Ganzzahlige Tempi werden eingerastet, wenn sie innerhalb von 0,04 BPM liegen. Genauigkeit an Testsignalen: unter 1 ms.
- Taktanfang (4/4): deutliche Bass-Akzente entscheiden. Fehlen sie, zählen Abschnittswechsel, die meist auf der „1“ liegen. Mit ‹ 1 und 1 › verschiebbar.
- Abschnitte: Neuheitskurve über Takt-Merkmale (Pegel, Bass, Mitten, Höhen, Einsatzstärke) mit etwa 5,5 s Kontext, unabhängig davon, ob halbes oder doppeltes Tempo gewählt ist. Die Typen (Intro, Aufbau, Hauptteil, Höhepunkt, Drop, Ruhephase, Outro) leitet eine Heuristik aus dem Energieverlauf ab. Sie sind frei umbenennbar.
- Schläge: adaptive Spitzensuche im Fluss je Band (Bass 30–150 Hz, Mitten 150–2500 Hz, Höhen 5–16 kHz) mit Stärke 0–1. Wahlweise auf 1/16 eingerastet.
- Export: JSON im Format `deepstructure.trackdata.v1`. Dazu gibt es GDScript (`TrackData`-Klasse mit `song_time()` nach Godot-Empfehlung) und eine Anleitung zum Einfügen in Codex. Mit „Klick“ läuft beim Abspielen ein Metronom am Mastering vorbei, um das Raster zu prüfen.
- Grenzen: Tempowechsel innerhalb eines Songs werden nicht verfolgt (das Raster ist gleichmäßig). Die Abschnittstypen sind Vorschläge, kein Songtext-Verständnis.

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
