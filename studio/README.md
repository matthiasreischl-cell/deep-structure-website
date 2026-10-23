# Deep Structure Mastering Studio

Installierbare Web-App (PWA) unter `deepstructure.world/studio/`: Audio-Editor, Song-Check, KI-Artefakt-Suche, Mastering-Kette, Drum-Reparatur und Spiel-Daten-Export. Die gesamte Audioverarbeitung läuft lokal im Browser. Audiodateien verlassen das Gerät nie.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Die komplette App (HTML, CSS, JavaScript in einer Datei, ohne Build-Schritt) |
| `sw.js` | Service Worker: Offline-Start und Updates |
| `vorbis-encoder.js` | OGG-Vorbis-Encoder, wird nur beim OGG-Export nachgeladen (Lizenzen im Dateikopf) |
| `manifest.webmanifest`, `icon-*.png`, `favicon.png`, `apple-touch-icon.png` | Installation als App |
| `tests/` | Automatisierte Tests (siehe `tests/README.md`) |
| `TESTREPORT.md` | Ergebnisse der letzten Prüfung inklusive FFmpeg-Gegenmessung |

## Technik

**Signalkette** (Echtzeit-Wiedergabe und Export nutzen denselben Aufbau, `buildChain()`):

1. **Eingang**
2. **8-Band-EQ:** Web-Audio-Biquads (RBJ). Low/High Cut sind Butterworth 2. Ordnung, die Q-Umrechnung in dB ist berücksichtigt.
3. **3-Band-Kompressor:** Linkwitz-Riley-Weichen 4. Ordnung mit Allpass-Ausgleich im Bassband. Web-Audio-`DynamicsCompressor` je Band, Soft-Knee 6 dB.
4. **Sättigung:** tanh-Kennlinie, 4-fach überabgetastet, auf Kleinsignal-Verstärkung 1,0 normiert. Bei 0 % Mischung wird das Modul umgangen.
5. **Stereo:** M/S-Breite. Bass-Mono über einen Hochpass 4. Ordnung auf dem Seitensignal.
6. **Limiter:** True-Peak-Limiter mit 5 ms Vorschau (Details unten).

**True-Peak-Limiter:** gleitendes Minimum plus Kastenglättung, dadurch ist der Attack gleich der Vorschauzeit. Der Release ist exponentiell. Die Spitzenerkennung erfasst auch Zwischenwerte: ein schneller 16-Tap-Vorfilter entscheidet, wo es eng wird (ab 1,4 dB unter der Decke). Dort rechnet ein 4-fach-Polyphasen-FIR mit 48 Taps je Phase (Kaiser) plus Parabel-Feinbestimmung zwischen den Rasterpunkten. Eine harte Sicherheitsgrenze sitzt auf Sample-Ebene. Signale unterhalb der Decke laufen bitgenau durch (latenzkorrigiert).

**Export:**
- Der Export rendert die Kette mit `OfflineAudioContext`. Die Latenz wird per Klick-Test kompensiert.
- Limiter, Messung und WAV-Kodierung laufen im Web Worker, mit demselben Limiter-Code wie in der Echtzeit-Wiedergabe (AudioWorklet).
- Formate: WAV 16 und 24 Bit (TPDF-Dither, deterministisch), 32 Bit Float sowie OGG Vorbis (ca. 140 oder 240 kbit/s, VBR).
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
- Unterlegen: Eingebaute Kick und Snare oder eigenes Sample, Tonhöhe aus dem Song gemessen. Die Kick wird per Kreuzkorrelation zeitlich und in der Polarität ausgerichtet. Der Pegel folgt jedem einzelnen Schlag.
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

- Der Kompressor nutzt den Web-Audio-`DynamicsCompressor`. Dessen Kennlinie (automatische Aufholverstärkung, feste Vorschau von 6 ms) ist durch den Browser vorgegeben und kann sich zwischen Browsern minimal unterscheiden.
- Die Sättigung ist bei kleinen Pegeln exakt pegelneutral. Laute Passagen werden bewusst weich begrenzt, sie werden also etwas leiser und nie lauter.
- Die Vergleichskurve des Song-Checks ist ein grober Durchschnitt. Für Genre-gerechte Aussagen eine Referenz laden.
- Die Artefakt-Suche bewertet relativ zum Song. Ein durchgehend artefaktbehafteter Song zeigt deshalb nicht jede Stelle.
- Die Echtzeit-Lautheitsanzeige ist eine Näherung (K-Filter aus Web-Audio-Biquads). Maßgeblich sind die Werte im Reiter Analyse, die exakt dem Export entsprechen.
