# Prüfbericht Mastering Studio 1.4.0

Stand: 22.10.2026. Geprüft wurde `studio/index.html` mit `studio/sw.js` (Cache-Version `ds-studio-v1.4.0`).

## Zusammenfassung

- **Gemeldete Fehler:** Alle vier sind durch Tests vor der Korrektur reproduziert und danach behoben: Sättigung, Lautheitsziel, Spektrum, Preset „Neutral“.
- **Zusätzlich gefunden und behoben:**
  - Fehlalarme des Song-Checks bei stummen und sehr kurzen Dateien
  - Ein möglicher veralteter HTTP-Cache beim Laden der App
- **DSP-Tests:** 30 von 30 bestanden (`tests/dsp.test.mjs`).
- **Integrationstests im Browser:** 44 von 44 bestanden (`tests/index.html`).
- **Unabhängige FFmpeg-Gegenmessung:**
  - Lautheit ±0,05 LU, LRA ±0,1 LU, True Peak ±0,1 dB.
  - Der Export eines echten Songs entspricht exakt der Anzeige in der App.

## 1. Gefundene Fehler (vor der Korrektur nachgewiesen)

| # | Fehler | Nachweis vorher | Ursache |
|---|---|---|---|
| 1 | Sättigung hebt den Pegel um +12 dB, auch bei 0 % Mischung | Sinus 1 kHz: +12,04 dB bei Mix 0 %; +11,96 dB bei Drive 0 / Mix 100 % | Die Kennlinie war für Eingangspegel ±4 berechnet, der dazugehörige Vorverstärker (×0,25) fehlte. Die Ausgangskorrektur ×4 wirkte deshalb als Verstärkung. |
| 2 | „Drive auf Ziel einstellen“ ohne Wirkung, meldet trotzdem Erfolg | Statusmeldung „Lautheit eingestellt: −21.6 LUFS (Ziel [object PointerEvent])“, Drive unverändert | `addEventListener('click', setDriveToTarget)` übergab das Klick-Ereignis als Zielwert. Die Rechnung wurde dadurch NaN, die Schleife brach ab, gemeldet wurde trotzdem Erfolg. |
| 3 | Spektrum löscht gegenphasige Anteile aus | Gegenphasiges Rauschen: 1-kHz-Band −200 dB (gleichphasig: +29,8 dB) | (L+R)/2 wurde vor der FFT gebildet. Betroffen waren Song-Check, EQ-Angleich, KI-Messwerte, Artefakt-Suche und das Live-Spektrum. |
| 4 | Preset „Neutral“ war nicht neutral | Limiter aktiv mit Decke −1 dBTP | Das Preset nutzte die Grundeinstellung samt Sicherheitslimiter. |
| 5 | Song-Check: Fehlalarme bei stummen und sehr kurzen Dateien | Stille: „Stereo-Anteil im Bass 0,0 dB“ als Warnung; Sinuston 0,2 s: sechs Balance-Warnungen bis +49,8 dB | Bei stummem Material ergab 0/0 den Wert 0 dB, bei unter 0,4 s gibt es keine gültige Lautheitsmessung. |
| 6 | App-Seite konnte aus dem HTTP-Cache kommen | Netzwerk-zuerst ohne `cache`-Option | GitHub Pages sendet `max-age=600`. Der Browser durfte bis zu 10 Minuten die alte Seite liefern. |

## 2. Korrekturen

- **Sättigung:**
  - Vorverstärker `SAT_PRE` (−12 dB) ergänzt, die Kennlinie hat jetzt 8192 Stützstellen.
  - Die Ausgangsverstärkung ist `1/(SAT_PRE · Kleinsignalverstärkung)`.
  - Bei 0 % Mischung wird das Modul komplett umgangen, auch in der Struktur der Signalkette. Echtzeit und Export nutzen dieselbe Funktion `buildChain()`.
- **Lautheitsziel:**
  - Der Klick-Handler ruft jetzt `setDriveToTarget()` ohne Argument auf.
  - Der Zielwert wird geprüft (−30 bis −5 LUFS).
  - Die Iteration nutzt das Sekantenverfahren mit Grenzen (Drive −12 bis +24 dB).
  - Der gerundete Drive wird anschließend **erneut gemessen**.
  - Ein nicht erreichbares Ziel erscheint als Fehlermeldung mit Begründung (Decke bzw. maximaler Drive), statt Erfolg zu melden.
- **Spektrum:** L und R werden getrennt transformiert, die Leistung wird gemittelt. Das gilt für die Analyse, die Artefakt-Suche und das Live-Spektrum im EQ (vier getrennte Analyser).
- **Preset „Neutral“:** Alle Module (EQ, Kompressor, Sättigung, Stereo, Limiter) sind aus, Drive und Eingang stehen auf 0.
- **Song-Check:**
  - Kategorien Technik, Lautheit, Dynamik, Klangbalance, Stereo und KI-Artefakte.
  - Klangliche Abweichungen erscheinen nur als Hinweis, mit neutraler Wortwahl und dem Zusatz „kann je nach Genre gewollt sein“.
  - Die Punktzahl ist als heuristischer Orientierungswert gekennzeichnet und gewichtet technische Befunde stark, klangliche nur leicht.
  - Stumme und zu kurze Dateien werden gesondert behandelt.
  - Behebungen gibt es weiterhin nur per Klick.
- **Assistent und KI:**
  - Der Assistent korrigiert nur Abweichungen über ±2 dB, und zwar zur Hälfte des Überschusses, höchstens ±3 dB.
  - Kompression setzt er nur bei LRA über 10 LU und PLR über 10 dB ein, Sättigung nie, Bass-Mono nur bei Stereo-Anteil im Bass.
  - Liegt der Song schon nahe am Lautheitsziel, bleibt der Drive bei 0.
  - Die KI-Anweisung stellt klar, dass Abweichungen keine Fehler sind und neutrale Einstellungen erlaubt sind.
- **API-Schlüssel:**
  - Standard ist nur der Arbeitsspeicher. Dauerhaft gespeichert wird er nur mit dem Häkchen „Auf diesem Gerät merken“.
  - Die verbleibenden Risiken sind erklärt (ohne Backend kann der Browser keine Sicherheit garantieren).
  - Die App listet transparent auf, welche Daten an die KI gehen.
- **Service Worker:** Die App-Seite wird mit `cache: 'no-cache'` geladen, die Installation nutzt `cache: 'reload'`. Version 1.4.0.

## 3. Unabhängige Gegenmessung mit FFmpeg 6.1.1 `ebur128=peak=true`

| Testsignal | Sollwert | FFmpeg I / LRA / TP | Studio I / LRA / TP |
|---|---|---|---|
| Sinus 997 Hz, −20 dBFS, stereo, 48 kHz | −20,0 LUFS | −20,0 / 0,0 / −20,0 | −20,00 / 0,00 / −20,00 |
| Stufe −20/−30 dBFS (EBU 3342) | LRA 10 LU | −22,6 / 10,0 / −20,0 | −22,59 / 10,00 / −20,00 |
| Rosa Rauschen stereo, 48 kHz | – | −25,0 / 0,0 / −11,9 | −24,96 / 0,05 / −11,98 |
| Rosa Rauschen, 44,1 kHz | – | −21,9 / 0,1 / −7,9 | −21,92 / 0,08 / −7,82 |
| „3. DEIN ABER“ (Original, 48 kHz) | – | −16,0 / 8,0 / −4,4 | −15,95 / 7,98 / −4,37 |
| fs/4-Sinus 45°, Zwischenwert-Spitze 0 dBTP | 0,0 dBTP | 3,3 / 0,0 / **+0,6** | 3,34 / 0,00 / **0,00** |

Beim fs/4-Testsignal liegt der theoretisch exakte True Peak bei 0,0 dBTP (Amplitude 0,999). FFmpeg überschätzt ihn hier um 0,6 dB, ein bekanntes Verhalten seines Interpolationsfilters. Das Studio trifft den exakten Wert. Die Messalgorithmen wurden deshalb nicht verändert.

**Ende-zu-Ende mit echtem Song:**
- Ablauf: „3. DEIN ABER“ geladen, Assistent, Ziel −14 LUFS, Export WAV 24 Bit über den Export-Dialog.
- Anzeige in der App: −14,00 LUFS, TP −1,00 dBTP, LRA 7,57 LU.
- FFmpeg am exportierten WAV: −14,0 LUFS, TP −1,0 dBTP, LRA 7,6 LU. Das ist **identisch**.
- Eingriffe des zurückhaltenden Assistenten: Bass −0,8 dB, 3 kHz +0,3 dB, Bass-Mono 120 Hz, Drive +2,3 dB. Keine Kompression, keine Sättigung.

## 4. Automatisierte Tests

### DSP (`node studio/tests/dsp.test.mjs`): 30 von 30 bestanden

- **LUFS:** 997-Hz-Sinus −20 dBFS stereo ergibt −20,00. Mit −23 dBFS (EBU) ergibt er −22,99, einkanalig −23,01. Bei 44,1, 48 und 96 kHz ergibt er −20,00 bzw. −20,02.
- **LRA:** Stufe −20/−30 dB ergibt 10,00 LU.
- **True Peak:** fs/4-Sinus ergibt 0,01 dBTP (Samples −3,01), Sinus −6,02 dBFS ergibt −6,02 dBTP.
- **Spektrum:**
  - Gegenphasig und gleichphasig sind identisch (0,000 dB Abweichung).
  - Ein 1-kHz-Ton landet im 1-kHz-Terzband.
  - Rosa Rauschen ist flach (±0,87 dB).
  - Eine unkorrelierte Mischung verliert keinen Pegel (−0,02 dB).
- **Limiter:**
  - Sample-Peak ≤ −1 dB, True Peak −1,00 dBTP bei +12 dB Drive auf Rauschen.
  - Signal unter der Decke bitgenau unverändert.
  - Limiter aus bedeutet exakt unverändert.
  - Release 40 ms erholt sich schneller als 300 ms.
  - Transiente unter der Decke unverändert.
- **WAV:** 16 und 24 Bit innerhalb von 2 LSB (mit Dither), 32 Bit Float exakt. Kopfdaten korrekt, wiederholter Export bytegleich.
- **Sonderfälle:** Stille ohne Fehlalarm. Dateien mit 1, 100 und 4000 Samples ohne Absturz.
- **Glätter:**
  - STFT-Nulltest: max. Fehler 3,6·10⁻¹⁵.
  - Stärke 0 % verändert nichts.
  - Glitzern über 6 kHz wird gesenkt, Tiefen und Mitten bleiben ±0,00 dB.
- **Artefakt-Suche:** Ein sauberer Sinus erzeugt keinen Fehlalarm, 3 eingefügte Knackser werden gefunden.

### Browser (`tests/index.html`, automatisch per `tests/run-browser-tests.py`): 44 von 44 bestanden

- **Preset „Neutral“:**
  - Die Signalkette ist ein Nulltest: max. Abweichung 0, bei Spitzen bis −0,1 dBFS.
  - Export 32 Bit Float ist identisch, 24 Bit liegt innerhalb von 2 LSB.
- **Sättigung:**
  - Mix 0 % ergibt ±0,000 dB bei Drive 0, 50 und 100 und Pegeln von 0,05 bis 1,5.
  - Leise Signale bleiben unverändert (±0,02 dB), laute werden nie lauter (−2,2 bis −10,7 dB).
  - Ein/Aus ohne Pegelsprung.
- **EQ:**
  - Glocke +6 dB bei 1 kHz misst 6,00 dB. In der Ferne bleibt es bei ±0,07 dB.
  - Low Cut 100 Hz misst −2,97 dB an der Grenze und 0,00 dB im Durchlass.
- **Stereo:**
  - Bass-Mono senkt gegenphasigen 60-Hz-Bass im Seitensignal um 24,6 dB.
  - Gegenphasiger Bass bleibt im Spektrum sichtbar.
- **Lautheitsziel:**
  - Ein Klick-Ereignis als Argument wird ignoriert, das Ergebnis ist −14,06 LUFS.
  - Der Knopf funktioniert, der Master misst −14,06 LUFS bei TP −1,00.
  - Das unerreichbare Ziel (−5 LUFS bei Decke −6) wird als „NICHT erreicht“ gemeldet.
  - Ungültige Eingaben werden abgelehnt.
- **Export-Matrix:**
  - Geprüft bei 44,1, 48 und 96 kHz, jeweils mit 16, 24 und 32 Bit.
  - Format, Länge und Abtastrate stimmen. Die Lautheit der Datei entspricht der Anzeige, der TP liegt ≤ Decke.
  - Ein wiederholter Export ist bytegleich, das Original bleibt unverändert.
  - Die Wandlung von 44,1 auf 48 kHz erhält Länge und Lautheit.
- **Sonderfälle:** Stille (3 s), 0,2 s und 20 ms laden, analysieren und exportieren ohne Fehler.
- **API-Schlüssel:** Ohne Häkchen ist er nicht im `localStorage`, „Entfernen“ löscht ihn.

### Service Worker (separater Playwright-Test): bestanden

- Nach dem Update zeigt der erste Neustart die neue Version.
- Der alte Cache `v1.3.0` wird gelöscht, nur `v1.4.0` bleibt.
- Gespeicherte Einstellungen bleiben erhalten (Lautheitsziel −11).
- Offline startet die App mit der neuen Version.

## 5. Nicht oder nur eingeschränkt prüfbar

- **Echtzeit-Wiedergabe gegen Export am Ausgang:** Im Testsystem gibt es keine Audio-Hardware. Echtzeit und Export verwenden dieselbe Kettenfunktion `buildChain()` und denselben Limiter-Code (AudioWorklet bzw. Worker), das ist im Code geprüft. Klanglich hörbar ist es nur am echten Gerät prüfbar.
- **Andere Browser:** Getestet wurde in Chromium. Safari und Firefox wurden nicht automatisiert getestet. Ihr `DynamicsCompressor` kann geringfügig anders arbeiten.
- **Echte Handys und Windows-PC:** nicht automatisiert getestet. Der erste Praxistest liegt beim Nutzer.
- **KI-Mastering:** Die Verarbeitung der Antworten ist mit einer simulierten KI-Antwort getestet. Echte Anfragen an Anthropic sind aus der Testumgebung nicht möglich.
- **Hörqualität der Artefakt-Erkennung:** Die Erkennung ist technisch getestet (keine Fehlalarme bei sauberen Signalen, eingefügte Knackser werden gefunden). Ob markierte Stellen hörbar störende KI-Artefakte sind, müssen Hörtests mit Testern zeigen.

## 6. Offene Punkte

- Der Kompressor hängt vom Browser ab (Web-Audio-`DynamicsCompressor`). Ein eigener Kompressor im AudioWorklet würde browser-unabhängige, exakt reproduzierbare Ergebnisse liefern.
- Die Vergleichskurve des Song-Checks ist genre-neutral. Genre-Profile oder die Referenzfunktion sind für zielgerichtete Aussagen besser.
- Die Schwellen der Artefakt-Erkennung beruhen auf wenigen Songs und sollten mit Tester-Feedback nachjustiert werden.

## 7. Auswirkungen auf bereits erstellte Master-Dateien

- **Masters mit eingeschalteter Sättigung** (Presets „Laut & druckvoll“ und „Warm & analog“ oder manuell, Versionen 1.0 bis 1.3):
  - Das Signal lief etwa 12 dB zu heiß in den Limiter.
  - Folgen: deutlich stärkere Begrenzung, weniger Dynamik, mögliche Verzerrung. Die Lautheit lag wahrscheinlich über dem Ziel.
  - Die Decke (True Peak) wurde trotzdem eingehalten.
  - **Empfehlung: diese Songs neu exportieren.**
- **Masters, bei denen „Drive auf Ziel einstellen“ geklickt wurde:** Der Drive blieb unverändert, das Lautheitsziel wurde nicht eingestellt. Der Assistent und das KI-Mastering waren nicht betroffen, weil sie den Zielwert als Zahl übergeben haben.
- **Masters mit Preset „Neutral“:** Spitzen über −1 dBTP wurden leicht begrenzt. Für ein unverändertes Original neu exportieren.
- **Song-Check, EQ-Angleich und KI-Vorschläge bei sehr breiten oder gegenphasigen Mischungen:** Die Klangbalance konnte falsch bewertet worden sein. Bei typischen Mischungen ist der Unterschied gering.

## 8. Nachtrag 1.5.0: Spiel-Daten

| Prüfung | Ergebnis |
|---|---|
| Synthetische Songs 75, 90, 128, 140, 174 BPM (Intro, Hauptteil, Break, Drop, Outro) | Tempo exakt. Beat-Abweichung im Median 0,0–0,3 ms. Erste „1“ richtig. Alle 4 Abschnittswechsel auf den Beat genau gefunden. |
| Krummes Tempo 123,4 BPM, 48 kHz, 3,2 s Stille am Anfang | 123,4 BPM, 0,1 ms |
| Eingetragenes Tempo (127,5 BPM) | Exakt übernommen |
| Taktanfang verschieben | Funktioniert |
| Rauschen ohne Rhythmus | Raster als „unsicher“ markiert (Sicherheit 0,00) |
| Zu kurzer Song | Verständliche Meldung statt Fehler |
| Browser: 120-BPM-Klickspur mit Akzent auf der 1 | 120 BPM, erste „1“ bei 0,501 s, JSON gültig, Typ-Änderung landet im JSON, Dateiname mit Level |
| „3. DEIN ABER“ (207,6 s) | 173,94 BPM (halb: 86,97), Sicherheit 0,89, 13 Abschnitte, deren Pegelsprünge mit der Wellenform übereinstimmen. Analyse etwa 3,5 s. |

Nicht automatisch prüfbar: Ob das erkannte Tempo dem entspricht, was der Musiker als Grundschlag empfindet (halb oder doppelt), und ob die Abschnittsnamen musikalisch passen. Dafür gibt es ÷ 2, × 2, das Tempo-Eingabefeld, die Taktverschiebung und den Metronom-Klick. Der GDScript-Code wurde nicht in Godot ausgeführt (keine Godot-Installation in der Testumgebung).

## 9. Nachtrag 1.6.0: Drum-Reparatur

| Prüfung | Ergebnis |
|---|---|
| Testmix 80/96/128 BPM (Kick mit Tonhöhenabfall, Snare mit metallischem Nachklingen bei 3,4 und 5,9 kHz, HiHats, Bass-Töne, Ton mit Vibrato wie Gesang) | Kicks 100 % gefunden und 100 % richtig. Bass-Töne werden nicht als Kick gezählt. Snares 100 % gefunden und 96–100 % richtig. |
| Dasselbe bei 174 BPM (als 87 erkannt) | Kicks 100 %. Snares 75 % gefunden und 100 % richtig. |
| Reiner Drum-Loop ohne andere Instrumente | 16 von 16 Kicks, 16 von 16 Snares |
| Metall-Entferner (60 %) | Nachklingen −5,5 dB, Obertöne des Gesangstons ±0,11 dB |
| Kick unterlegen, Original normal und mit gedrehter Polarität | +3,4 dB bzw. +3,1 dB im Kick-Bereich, keine Auslöschung |
| Alle Regler aus | Bitgenau unverändert |
| Nur Auswahl | Außerhalb bitgenau unverändert |
| Ton ohne Schläge, Metall und Sand auf 100 % | Unverändert (STFT verlustfrei) |
| Browser: Suchen, Anwenden, erneut Anwenden, Vorher/Nachher, Rückgängig | Funktioniert. Erneutes Anwenden ersetzt den Schritt. Rückgängig führt exakt zum Original. |
| „3. DEIN ABER“ | 200 Kicks und 101 Snares, in festen Rasterpositionen, also ein plausibles Drum-Muster. Suche etwa 14 s, Reparatur etwa 20 s. Mit den Grundeinstellungen ändern sich die Höhen über 3 kHz deutlich (Differenz 12 dB unter den Höhen), ihr Pegel bleibt gleich (+0,2 dB). |

Nicht automatisch prüfbar: ob die Reparatur besser *klingt*. Das entscheidet der Hörvergleich mit „Vorher/Nachher“. Die Snare-Erkennung bei sehr schnellen Songs (über 160 BPM) findet nicht jeden Schlag.

## 10. Nachtrag 1.6.1: OGG-Vorbis-Export

| Prüfung | Ergebnis |
|---|---|
| Export „3. DEIN ABER“ als OGG (Standard) im Browser | 9,5 s Kodierzeit, 3,5 MB, 140 kbit/s. Fortschrittsanzeige läuft, die Oberfläche bleibt bedienbar. |
| FFmpeg-Gegenprüfung | Codec Vorbis, 48 kHz, Stereo, Dauer 207,600 s (sample-genau gleich wie das Original). −16,0 LUFS und 8,0 LU wie in der App angezeigt. |
| Zeitversatz zum Original (Kreuzkorrelation bei 1:00) | 0 Samples. Die Spiel-Daten passen also auch zur OGG-Datei. |
| Testton 1 kHz, Klick bei 5 s | Klick-Versatz 0 Samples, Länge exakt |
| Browser-Test: Encoder nachladen und gültige Ogg-Datei erzeugen | Bestanden („OggS“-Kopf) |

## 11. Nachtrag 1.6.2: True Peak, Import, Offline-Cache

Referenz für True Peak ist eine ideale Rekonstruktion (16-fach über FFT, ohne Ränder).

| Prüfung | 1.6.1 | 1.6.2 |
|---|---|---|
| Sinustöne 12–21 kHz, je 3 Phasen | bis −0,22 dB zu niedrig | ±0,012 dB |
| Limiter, Töne 8–20 kHz mit +6 dB Drive, Decke −1 | −1,00 dBTP | −1,00 dBTP |
| Limiter, weißes Rauschen +12 dB (Extremfall) | +0,90 dBTP ideal, FFmpeg −0,3 | +0,12 dBTP ideal, FFmpeg −0,9 |
| „Dein Aber“ mit +6 dB Drive | ideal −0,97 dBTP | ideal −1,00 dBTP |
| Mastering auf −14 LUFS, Export WAV 24 Bit (FFmpeg) | – | −14,0 LUFS, −1,0 dBTP, LRA 7,6 |
| Dasselbe als OGG Vorbis (FFmpeg) | – | −14,1 LUFS, −1,2 dBFS Peak, 141 kbit/s |
| Zeit: eine Master-Messung / „Drive auf Ziel“ (Browser, ganzer Song) | 5,3 s / 5,2 s | 6,4 s / 6,5 s (Codex-Stand: 27,6 s / 44 s) |
| WAV mit Größe 0xFFFFFFFF, Größe 0, abgeschnitten, NaN-Floats, 5.1 | teils leer oder still verworfen | alle geladen bzw. bereinigt, mit Hinweis |
| Ungültige Einstellungsdatei | konnte Teile übernehmen | abgelehnt, nichts verändert |
| Offline-Cache mit altem Studio-Cache und fremdem Cache „radio-v3“ | löschte beide | alter Studio-Cache entfernt, fremder bleibt, offline startet 1.6.2 |

Gesamt: 56 von 56 DSP-Tests, 65 von 65 Browser-Tests. Die Codex-Prüfung vom 23.10.2026 hat zwei echte Fehler gefunden: die Rausch-Überschreitung und den Ersatz-Limiter. Beide sind behoben.

## 12. Nachtrag 1.6.3: MP3-Export

| Prüfung | Ergebnis |
|---|---|
| „Dein Aber“, auf −14 LUFS gemastert, als MP3 320 kbit/s | 7,9 MB. Kodierzeit im Test-Browser ca. 36 s (am Handy länger), mit Fortschrittsanzeige. |
| FFmpeg-Gegenprüfung | −14,0 LUFS, LRA 8,0. Dekodierte Länge 9.964.800 Samples (= WAV), Zeitversatz 0 Samples. |
| MP3 192 kbit/s | 4,8 MB, −14,2 LUFS |
| Chrome dekodiert die MP3 (Testton mit Klick) | Länge exakt, Klick auf das Sample genau |
| MP3 ohne Lückenlos-Angabe (zum Vergleich) | +1105 Samples Versatz, +1152 Samples Länge. Deshalb setzt die App den Info-Frame. |
| Import einer 48-kHz-MP3 | jetzt 48 kHz, 9.964.800 Samples (vorher auf 44,1 kHz umgerechnet) |

Gesamt: 56 von 56 DSP-Tests, 67 von 67 Browser-Tests.

## 13. Nachtrag 1.7.0: eigener Kompressor, Drum-Klänge

| Prüfung | Ergebnis |
|---|---|
| Kompressor: Signal unter der Schwelle | bitgenau unverändert |
| Kennlinie −10 dBFS, Schwelle −20, Ratio 2:1 / 4:1 | −15,00 / −17,49 dBFS (Soll −15 / −17,5) |
| Attack 20 ms, nach 60 ms | 7,1 von 7,5 dB eingeregelt |
| Stereo-Kopplung (Signal links laut, rechts leise) | beide Kanäle −9,32 dB |
| Offline-Render (Export) mit eigenem Kompressor | −15,00 dBFS, gleiche Kennlinie wie in Echtzeit |
| Latenz | 2 Samples (nur Frequenzweichen, wird ausgeglichen). Der Browser-Kompressor hatte 6 ms Vorschau. |
| „Dein Aber“, Preset „Streaming klar“, auf −14 LUFS | 1.6.3: LRA 6,4 LU. 1.7.0: −14,1 LUFS, −1,0 dBTP, LRA 6,2 LU. FFmpeg bestätigt −14,1 LUFS, LRA 6,2, Peak −1,0. |
| Drum-Klangbibliothek | 6 Kicks und 7 Snares erzeugen gültige Klänge |
| „An Original angleichen“ (Testsnare dunkel, Ersatz hell) | Klangabstand 17,3 → 12,0 dB |
| „Im Song probehören“, „Dein Aber“ ab 2:01 | erste Probe 2,3 s, Klangwechsel 0,7–1,0 s, Original-Taste wechselt ohne Unterbrechung, Song bleibt unverändert bis „Anwenden“ |

Gesamt: 63 von 63 DSP-Tests, 70 von 70 Browser-Tests.

## 14. Nachtrag 1.7.1: Korrekturen nach dem Prüfbericht 1.7.0

| Prüfung | Ergebnis |
|---|---|
| Original-Taste nach Bearbeitung (ganzer Song −12 dB) | Original −13,8 dB, Master −25,7 dB, Anzeige „Original-Datei“ (vorher gleich laut) |
| Original-Taste nach Schnitt / nach Rückgängig | „Ohne Mastering“ / wieder „Original“ |
| Songwechsel während Drum-Reparatur, Drum-Probe, Glätten | Ergebnis wird verworfen, Hinweis statt falschem Song |
| Limiter aus, Drive +12 dB | Signal unverändert (Drive ebenfalls umgangen) |
| Grenzlasttest Prüfbericht (weißes Rauschen, Seed 92113, 0,95, +12 dB, Decke −1) | ideale FFT-Rekonstruktion 1.7.0: −0,55 dBTP · 1.7.1: −1,08 dBTP |
| Weitere Härtefälle 44,1/48 kHz (5 Rausch-Seeds, Sinus 0,45–0,499 × Rate, Sweep, Rechteck) | ungünstigster Wert ideal −1,07 dBTP, alle ≤ Decke |
| Rosa Rauschen +10 dB | ohne Sicherheitsstufe −0,88, mit −1,10 dBTP |
| „Dein Aber“, Drive +6 / +12 dB | ideal −1,00 / −1,00 dBTP, also keine zusätzliche Absenkung bei Musik |
| Rechenzeit (Messung ganzer Song) | ca. 4 s statt 2,3 s (genaueres Filter + Sicherheitsstufe); Echtzeit unkritisch |
| MP3 320 / OGG Q8, „Dein Aber“ auf −14 LUFS | Anzeige der fertigen Datei: MP3 −13,9 LUFS / −2,1 dBTP (FFmpeg −14,0 / −2,1), OGG −13,9 / −2,2 (FFmpeg −14,0 / −2,3); vor der Kodierung −14,0 / −2,4 |
| WAV 3 Kanäle, Maske 0x7, nur Center | links 0,207, rechts 0,207 (vorher links 0,25, rechts 0) |
| WAV Quadro 0x33 / 5.1 Seite 0x60F / Maske ohne Position | richtig zugeordnet / LFE weggelassen und gemeldet / mittig eingemischt und gemeldet |

Hinweis zur True-Peak-Anzeige: Die Messung selbst entspricht weiter der Norm (BS.1770, wie FFmpeg) und ist genauer als diese. Bei extremem Vollband-Rauschen kann eine unendlich lange ideale Rekonstruktion bis etwa 0,5 dB höher liegen als die Anzeige. Die Sicherheitsstufe sitzt im Limiter, damit die Decke in der fertigen Datei auch dann gilt.

Gesamt: 67 von 67 DSP-Tests, 78 von 78 Browser-Tests.

## 15. Nachtrag 1.8.0: Clean Song

| Prüfung | Ergebnis |
|---|---|
| Synthetische Störung in „Dein Aber“ (60 s): Störtöne 3455 Hz (Mitte), 2883 Hz (Mitte+Seite), 9100 Hz (Seite), Rauschteppich 7–11,5 kHz | alle drei Töne und der Teppich (6,1–12,3 kHz) gefunden; ohne Störung: nichts gefunden |
| Absenkung der Störtöne | 3455 Hz −21 dB, 2883 Hz −20 dB (Mitte) / −26 dB (Seite), 9100 Hz −32 dB |
| Rauschteppich, Regler 100 % | leiseste 25 % des Songs: +10 dB durch die Störung, nach Clean Song 22 dB darunter; laute Passagen −0,2 dB |
| Unveränderter Song (ohne Teppich) mit Regler 100 % | Höhen 5–16 kHz −0,2 dB, 1–5 kHz −0,01 dB |
| Echte Songs (5 Suno-Titel) | keine Störtöne im hörbaren Bereich; Linien über 19 kHz in 3 Titeln (je ca. 1,5 kHz Abstand, typische Codec-/KI-Linien) |
| Rechenzeit, 5:27-Song | Suche 3,0 s, Clean Song 10,4 s |
| Rosa Rauschen + 2 Störtöne (DSP-Test) | gefunden, −18,9 / −70 dB, übrige Frequenzen ±0,000 dB, ohne Auswahl bitgenau |
| Browser: Testsong mit Störtönen | gefunden, −29,5 dB (Mitte) / −97 dB (Seite), Akkordton 220 Hz unverändert, ein Rückgängig-Schritt, „Entferntes anhören“ verfügbar |
| Laden: Neuzeichnen während des Audio-Starts | kein Absturz mehr |

Gesamt (1.8.0): 72 von 72 DSP-Tests, 84 von 84 Browser-Tests.

## 16. Nachtrag 1.8.1: Praxistest mit „Blueprint“

Verglichen wurden das ungemasterte Original, eine Fassung, die mit Gemini in vier Stems getrennt, bereinigt, wieder zusammengesetzt und gemastert wurde („Studio Stem-Mix (Master)“), und Clean Song auf das Original (Störton angehakt, Rauschteppich 60 %).

| Prüfung | Original | Stem-Mix | Clean Song |
|---|---:|---:|---:|
| Störton 3453 Hz über den Nachbarn (Mittel über 2-s-Blöcke) | +11,9 dB | +0,9 dB | −2,0 dB |
| … im Intro (0–2 s) | +33,1 dB | +6,3 dB | +2,6 dB |
| Störton 2883 Hz | nicht vorhanden (max. +4 dB, 12 % der Zeit) | – | – |
| Klangbalance gegenüber Original (normiert, 3,15 / 4 / 8 kHz) | – | −4,8 / −3,5 / −3,0 dB | −1,0 / 0,0 / 0,0 dB |
| Stereo (Seite zu Mitte, Korrelation) | −9,9 dB, 0,81 | −11,2 dB, 0,86 | −9,9 dB, 0,81 |
| Neue Störlinie | – | 22.050 Hz, −73 dBFS (Umrechnung 44,1 → 48 kHz) | – |
| Rauschteppich 8,5–11,5 kHz, leiseste 20 % | – | – | −0,4 dB |

Einordnung: Der Stem-Mix entfernt den Störton ebenfalls weitgehend, ist aber zusätzlich gemastert, deutlich dunkler in den oberen Mitten und schmaler im Stereobild. Clean Song verändert außer dem Störton praktisch nichts. Der von Gemini gemeldete „Schleifteppich“ ist messbar, aber schwach. Der zweite gemeldete Ton bei 2883 Hz ließ sich nicht nachweisen. Mit 1.8.0 wurde der 3453-Hz-Ton noch nicht gemeldet (Mittel 10,4 dB bei 4096 Punkten, Schwelle 12 dB), deshalb die feinere Suche in 1.8.1. Auf den fünf übrigen Test-Songs meldet 1.8.1 im hörbaren Bereich nur eine unsichere Linie bei 850 Hz (zwei Songs, nicht angehakt; sie taucht in mehreren Suno-Titeln mit unterschiedlicher Tonart auf).

Gesamt: 72 von 72 DSP-Tests, 84 von 84 Browser-Tests.

## 17. Nachtrag 1.8.2: Anleitung

| Prüfung | Ergebnis |
|---|---|
| Knopf „Anleitung“ in der Kopfzeile, Desktop und Handy | sichtbar neben Feedback |
| PDF liegt neben der App und ist gültig | Browser-Test bestanden |

## 18. Nachtrag 1.9.0: Hör-Vergleich und EQ-Kerben

| Prüfung | Ergebnis |
|---|---|
| Kerbe 3455 Hz, Güte 290 (offline gerendert wie im Export) | 3455 Hz −145,8 dB, 3300 Hz −0,01 dB, 1 kHz 0,00 dB |
| Kerben in Einstellungsdateien | mit und ohne Kerben gültig, fehlerhafte abgelehnt; bleiben beim Preset-Wechsel erhalten |
| Hör-Vergleich: identische Fassungen / 20 ms versetzt / reine EQ-Änderung (+2 dB Höhen) | 5,0 / 4,99 (Versatz 20,00 ms erkannt) / 4,98 mit gemeldeter Klangfarbe |
| Rauschen 30 dB unter tonaler Musik / weißes Rauschen in rosa Rauschen (−25 dB) | 1,0 (100 % hörbar) / > 4,5 (verdeckt) |
| Kalibrierung (3 Songs, je 30 s) | MP3 320/192/128/96/64: 4,9 / 4,75 / 4,5 / 3,3–3,9 / 1,5–1,9; Vorbis q8/q5/q2/q0: 4,8 / 4,6 / 4,2–4,4 / 2,6–3,6; Tiefpass 16/11/7 kHz: 5,0 / 3,6 / 1,9–2,6 |
| Blueprint: Original ↔ Clean Song / ↔ Stem-Mix des Freundes | 4,6 (hörbar v. a. der entfernte Störton und der Rauschteppich am Songende) / 3,8 (Präsenz −3 dB als Klangfarbe getrennt gemeldet) |
| Blueprint in der App: Clean Song + Kerbe + Assistent, Original ↔ Master | 3,4 in 8,6 s, Unterschiede vor allem im Bass (Bass-Mono, Kompression) |
| Export MP3 320 von Blueprint | Hörbarer Kodierverlust 4,9 von 5 |

Gesamt: 77 von 77 DSP-Tests, 90 von 90 Browser-Tests.

## 19. Nachtrag 1.9.1: Wiedergabe auf dem Smartphone

Anlass: Nach dem Mastering klang der Track auf dem Smartphone schlechter (fehlende Teile am Gesang, neue Knackser).

| Prüfung | Ergebnis |
|---|---|
| Export auf emuliertem Smartphone (Clean Song + Assistent + WAV), Vergleich mit dem Original | keine neuen Knackser, Gesangsbereich unverändert; nur leise Intro- und Outro-Höhen verändert (Rauschteppich, gewollt) |
| Rechenzeit Limiter Wiedergabe (sparsam) gegen Export (genau) | etwa 3,5-mal geringer |
| Rechenzeit Kompressor 1.9.1 gegen 1.9.0 | etwa 2,3-mal geringer, Ergebnis gleich |
| Vorschau gegen Export, Blueprint | Unterschied −61,5 dB, Pegel 0,006 dB |
| Vorschau gegen Export, synthetisches Testsignal (Grenzfall mit vielen Spitzen nahe der Decke) | Unterschied −33,3 dB (Testschwelle −30 dB) |
| AudioWorklet lädt verspätet | Studio wechselt nachträglich vom Ersatz auf das Worklet, Wiedergabe läuft weiter |

Schlussfolgerung: Die fertige Datei ist sauber. Die Störungen entstehen bei der Echtzeit-Wiedergabe, wenn das Gerät die Kette nicht rechtzeitig schafft. Diese Last ist jetzt deutlich kleiner.

Gesamt: 78 von 78 DSP-Tests, 90 von 90 Browser-Tests.

## 20. Nachtrag 1.9.2: Prüfbericht zu 1.9.0 (ChatGPT, 24.10.2026)

Jeder Befund wurde zuerst am Stand 1.9.1 nachgeprüft. Die neuen Tests schlagen am Stand 1.9.1 fehl (6 von 95) und bestehen mit 1.9.2.

| Befund | Am Stand 1.9.1 | Ergebnis 1.9.2 |
|---|---|---|
| H1 Statuszeile deutet Text als HTML | bestätigt: `status()` setzte `innerHTML`; Dateiname mit `<img onerror>` ergab ein echtes Bild-Element | nur noch Text (`textContent`), Kreisel als eigenes Element; die übrigen 42 `innerHTML`-Stellen geprüft: sie setzen nur feste Texte oder Zahlen ein |
| H2 Hör-Vergleich nach Änderung veraltet | bestätigt: nach EQ-Änderung und bei Änderung während der Berechnung blieb das alte Ergebnis sichtbar | Ergebnis an Song-Stand und Einstellungsstand gebunden, wird bei Änderung ausgeblendet mit Hinweis „Bitte neu vergleichen“ |
| M1 KI-Anzeige nach Trennung | bestätigt: `else` hing an der Checkbox-Prüfung | korrigiert, Test prüft „nicht verbunden“ |
| M2 Zahl als Qualitätsnote missverständlich | berechtigt | Beschriftung „Klangunterschied, keine Qualitätsnote“, Klangfarbe ab 1 dB im Text und hervorgehoben, Urteil „Nur die Klangfarbe ist verändert“ |
| M3 API-Schlüssel im Browser | bekannt und dokumentiert; Standard nur Arbeitsspeicher | Warnung „unverschlüsselt“ an der Merken-Option. Ein Proxy oder OAuth bräuchte einen eigenen Server und ist ohne laufende Kosten nicht umsetzbar; bleibt bewusst offen |
| M4 Keine CI, Version verteilt | bestätigt | GitHub Actions (Build-Vergleich, Versionsprüfung, DSP- und Browser-Tests), Version nur in `VERSION` |

Zum Hinweis im Bericht, 1.9.1 fehle: Der Bericht prüfte Commit `0d1c243` (1.9.0). 1.9.1 kam danach mit Pull Request #6 (`f4799ed`) auf `main`.

Gesamt: 78 von 78 DSP-Tests, 95 von 95 Browser-Tests.

## 21. Nachtrag 1.9.3: PC-Fassung und Audio-Module

Anlass: In der PC-Fassung (Edge, aus der Datei geöffnet) stand in der Konsole „AudioWorklet-Variante fehlgeschlagen AbortError: Unable to load a worklet's module.“

Ursache: Die App lädt ihre Audio-Module zuerst über eine blob:-Adresse, bei Ablehnung über eine data:-Adresse. Edge lehnt blob: bei `file://`-Seiten ab. Die zweite Variante lief, die Meldung war eine Warnung ohne Folgen. Wären beide gescheitert, hätte die App beim Start den Hinweis auf den Ersatz-Limiter gezeigt.

| Prüfung | Ergebnis |
|---|---|
| PC-Fassung über `file://` in Chromium | Module geladen, data: als erstes Verfahren, keine Warnung |
| Website-Fassung (https) | unverändert blob: zuerst |

Gesamt: 78 von 78 DSP-Tests, 95 von 95 Browser-Tests plus 2 Prüfungen der PC-Fassung.

## 22. Nachtrag 1.10.0: Praxistest „Lvl 1 Prologue: Awakening the Stars“ (OGG-Master) und Spiel-Daten

**Master (OGG Vorbis, 48 kHz, 256 kbit/s nominal, 5:22,8), nachgemessen mit FFmpeg:**

| Messung | Ergebnis |
|---|---|
| Integrierte Lautheit / LRA | −10,6 LUFS / 3,2 LU |
| True Peak (FFmpeg, 4-fach) | −1,1 dBTP, kein Clipping (Flat factor 0) |
| DC-Versatz | < 0,00001 |
| Knackser-Suche (2. Ableitung, Hochton-Dauer) | keine Knackser; die stärksten Kandidaten sind HiHat- und Perkussions-Einsätze mit normalem Ausklang |
| Spektrum | Höhen bis etwa 20 kHz (Vorbis-Grenze), viel Energie unter 60 Hz |
| Songende | endet bei −26,5 dBFS ohne Ausblenden (letzte 100 ms gleich laut) |

**Spiel-Daten:** Die unabhängige Prüfung (eigene Onset-Kurve, Autokorrelation, Beat-Verfolgung in numpy) ergab: Das Tempo steigt über den Song leicht von etwa 134,0 auf 135,5 BPM. Das gleichmäßige Raster aus 1.9.3 (134,37 BPM, Sicherheit 0,14) lag bis zu ±200 ms neben den Schlägen. Die Einsatzstärke auf dem Raster war 1,1-mal so hoch wie der Mittelwert, also praktisch Zufall.

| Raster | Einsatzstärke Breitband / Kick (× Mittelwert) |
|---|---|
| 1.9.3, gleichmäßig | 3,35 / 2,00 (zeitlich optimal verschoben) |
| 1.10.0, verfolgt | 8,15 / 3,78 |
| unabhängige Referenz-Verfolgung | 8,59 / 3,70 |

**Godot 4.5.1 (headless, echte Spiel-Daten dieses Songs, neuer `track_data.gd`):** JSON lädt; `beat_index` trifft alle 723 Beats; `beat_time`, `beat_phase` (0,5 genau zwischen zwei Beats), `bar_index` und `is_downbeat` (180 Takte), `section_at` (15 Abschnitte) und `intensity_at` (0–1) sind über den ganzen Song korrekt. Die OGG lädt in Godot, die Länge stimmt mit den Daten überein. Bei der Wiedergabe ab 1:00 löste die MusicClock in 8 s 18 Beats aus, im Median 4,2 ms (höchstens 6,0 ms) nach dem Beat. Zum Vergleich: Ein gleichmäßiges Raster mit dem mittleren Tempo läge bis zu 330 ms daneben.

Gesamt: 81 von 81 DSP-Tests, 97 von 97 Browser-Tests.

## 23. Nachtrag 1.10.1: Equalizer-Bedienung

Anlass: Ein Tester (DJ, eigenes Studio) meldete, dass sich beim Hochziehen eines EQ-Punkts die Frequenz mitverändert und andere Bänder „mitgezogen“ werden.

| Prüfung (Chromium, echte Maus bzw. echte Touch-Ereignisse, 1280 px bzw. Handy 390 px) | 1.10.0 | 1.10.1 |
|---|---|---|
| Band 4 senkrecht hochziehen, 5 px neben der Mitte angesetzt, ±3 px Wackeln | Maus 550 → 567 Hz, Finger 550 → 599 Hz | 550 Hz bleibt, +7,6 / +9,2 dB |
| Band 5 waagerecht ziehen | – | nur Frequenz (1400 → 2405 / 5208 Hz), 0 dB bleibt |
| Band 3 schräg ziehen | – | Frequenz und Pegel |
| Punkt antippen (5 px neben der Mitte) | Punkt springt | keine Änderung |
| Andere Bänder beim Ziehen | unverändert | unverändert |
| Zuordnung Band ↔ Filter im Audio-Pfad (auch mit abgeschalteten Bändern) | korrekt | korrekt |

Überlappung (RBJ-Glockenfilter, +9 dB bei 550 Hz): bei Q 1 +1,8 dB bei 220 Hz und +1,7 dB bei 1400 Hz, bei Q 2 +0,6 / +0,5 dB, bei Q 4 +0,1 / +0,1 dB. Das ist normales EQ-Verhalten und steht jetzt als Hinweis im EQ.

Gesamt: 81 von 81 DSP-Tests, 101 von 101 Browser-Tests (neu: vier EQ-Zieh-Tests).

## 24. Nachtrag 1.11.0: Mein Stil

| Prüfung | Ergebnis |
|---|---|
| Drei Beispiele (dunkel, hell, mittel) merken, neuer dunkler Song | ähnlichstes Beispiel „Dunkel A“ (100 %), „Mitte C“ 10 %, „Hell B“ 0 % |
| Vorschlag übernehmen | Höhen-Shelf +4,0 dB und Kompressor wie beim Vorbild, Ziel −9 LUFS, erreicht −9,1 LUFS |
| „Vorherige Einstellungen“ | stellt den Stand vor dem Vorschlag wieder her |
| Sicherung speichern → alles löschen → laden | 3 von 3 Beispielen zurück; fremde Datei abgelehnt, nichts verloren |
| Export „Nur Schnitt“ / „Gemastert“ | kein Beispiel / ein Beispiel |

Lernkurve mit simuliertem Nutzer (seine Methode: Höhen- und Bass-Shelf hängen von der Klangbalance ab, Kompressor und Lautheit vom Lautheitsumfang; dazu zufällige Abweichungen), 300 Testsongs:

| Beispiele | Fehler Höhen-Shelf | Fehler Bass-Shelf | Kompressor falsch | Fehler Lautheit |
|---|---|---|---|---|
| 5 | 1,03 dB | 0,95 dB | 46 % | 1,14 LU |
| 20 | 0,57 dB | 0,48 dB | 37 % | 1,05 LU |
| 50 | 0,35 dB | 0,26 dB | 24 % | 0,85 LU |
| 200 | 0,23 dB | 0,24 dB | 17 % | 0,67 LU |
| 1000 | 0,20 dB | 0,20 dB | 9 % | 0,43 LU |

Ohne gelernte Merkmalsgewichte (nur feste Gewichte) lagen die Werte bei 1000 Beispielen bei 0,57 dB / 0,52 dB / 23 % / 0,86 LU. Immer dieselbe Durchschnittseinstellung: 1,03 dB.

Gesamt: 81 von 81 DSP-Tests, 109 von 109 Browser-Tests.

## 25. Nachtrag 1.12.0: Album-Review, Freigabe und Mein Stil (technischer Testbericht)

Programmstand: Deep Structure Mastering Studio 1.12.0 (`web/index.html`, `desktop/…html`), Chromium (Playwright) ohne Fenster. Testsignale: 10 bzw. 13 künstliche Songs (Rauschen mit Bass-Schlag, 6 s, 44,1 kHz, Pegel von −1 bis −12 dB gestaffelt).

| Prüfung | Erwartung | Ergebnis |
|---|---|---|
| 10 Songs importieren, dann 3 weitere | höchstens 12 pro Album | 10 + 2 übernommen, 13. abgelehnt |
| „Alle berechnen“, nach 3 Songs anhalten | Fertiges bleibt gespeichert | 4 von 10 berechnet und gespeichert |
| Neustart simuliert (Datenbank geschlossen, neu eingelesen), fortsetzen | nichts doppelt | 4 gespeichert, danach 6 berechnet, je genau 1 Version |
| Neustart echt (Seite neu geladen) mitten im Album | Projekt und Version noch da, Rest fortgesetzt | vorher [1, 0], nachher [1, 1] Versionen |
| Unterschiedliche Lautheit | ausgleichen, nicht gleich machen | Spanne vorher 11,0 LU, nachher 4,4 LU |
| Kommentar mit Zeitbereich und Typ | im Überarbeitungsauftrag | „0:01.0–0:02.5 · Höhen zu scharf: Becken klirren“ |
| Wiederholte Überarbeitungen, zurück zu Version 2 | alle Versionen bleiben | 3 Versionen, aktuell v2, Status „Nicht geprüft“, Einstellungen identisch mit v2 |
| Übersteuerung (Limiter aus, +18 dB) freigeben | technisch blockiert | blockiert: Clipping 0 dBFS, True Peak +11,1 dBTP |
| Drei Songs freigeben | Prüfung bestanden | 3 × freigegeben |
| Mein Stil nach Freigaben | nur Freigegebene positiv | 3 bestätigt, 1 „passt nicht“ (Überarbeiten), blockierter Song nie positiv |
| Mein-Stil-Vorschlag | stützt sich nur auf Freigegebene | Vorbilder: Track 5, 4, 3 |
| Neue Version nach Freigabe | wieder ungeprüft, nicht exportierbar, kein positives Beispiel | Status neu, bestätigt 2 |
| Erneute Freigabe | genau ein positives Beispiel pro Song | bestätigt 3 |
| Einstellungsdatei aus dem Chat laden | neue Version mit Clean-Stufe, ungeprüft | v2, Clean Song: Rauschteppich 30 % |
| Mehrere Chat-Vorschläge auf einmal | Zuordnung über den Namen | 2 zugeordnet, 1 unbekannte Datei gemeldet |
| PC-Fassung (file://): Album anlegen, Seite neu laden | Projekt noch da | ja |
| Veröffentlichen | nur Freigegebene, Rest gesperrt | 3 Songs versucht, 7 gesperrt |
| Fehlgeschlagener Export (Renderfehler bei einem Song) | gemeldet, übrige laufen weiter | 2 exportiert, 1 Fehler gemeldet, Protokoll geschrieben |
| Exportierter Master | volle Länge, Decke gehalten | 6,0 s, Spitze −4,2 dBFS |
| Veröffentlichen ohne Freigabe | verweigert | „Kein Song freigegeben …“ |
| Original im Speicher | unverändert | gleiche Dateigröße |
| Mein Stil: Export ohne „Passt“ | nur Entwurf, kein Vorschlag | 3 Entwürfe, kein Vorschlag; nach „Passt“ wie bisher |
| Album-Werkzeug: Nachbessern `--nur 2` mit Anpassung | nur Song 2 neu, Song 1 bleibt | Ziel −15, Anpassung übernommen, Einstellungsdatei mit Clean-Stufe |
| Album-Werkzeug mit 13 Songs | abgelehnt | „höchstens 12“ |

Bewusst nicht automatisch getestet: die Ordnerauswahl am PC (File System Access API braucht eine Nutzeraktion; getestet über einen gleichwertigen Ordner-Ersatz) und das KI-Überarbeiten (braucht eine Verbindung zu Claude; der Weg nutzt das vorhandene, bereits getestete KI-Mastering mit den Kommentaren als Wunsch).

Gesamt: 81 von 81 DSP-Tests, 129 von 129 Browser-Tests, PC-Fassung, Neustart-Test, Album-Werkzeug-Test.

## 26. Nachtrag: MCP-Server 1.0

Test über das echte Protokoll (`mcp/test.mjs`: startet den Server wie Claude Desktop oder Gemini CLI über stdio). Testsignale: Album mit 2 Songs (−19,3 und −29,4 LUFS), Ordner mit 13 Songs, Ordner außerhalb der Freigabe.

| Prüfung | Ergebnis |
|---|---|
| initialize (2025-06-18 und 2024-11-05), ping, unbekannte Methode | angenommen / angenommen / −32601 |
| Werkzeugliste | 8 Werkzeuge, kein Löschen, keine Freigabe |
| Zugriff außerhalb (absoluter Pfad, `..`, Systemordner, Verknüpfung nach außen) | alle abgelehnt |
| 13 Songs / unbekannte Konfiguration | abgelehnt mit verständlicher Meldung |
| analyze_album (relativer Pfad) | Messung und Album-Ziele (−11,5 / −16,5 LUFS) |
| master_album, zweiter Auftrag gleichzeitig | startet sofort / abgelehnt |
| Ergebnis | −11,5 und −16,5 LUFS genau getroffen, True Peak −1,1 / −2,4 dBTP, WAV und OGG, Einstellungsdateien mit Clean-Stufe, Bericht |
| Netzwerk der Studio-Seite | 1 Versuch (Schriften) blockiert, nichts durchgelassen |
| Originale | Prüfsumme unverändert, im Albumordner nichts Neues |
| remaster_songs Song 2 mit Anpassung (Ziel −16, Luft −1) | nur Song 2 neu (−16 LUFS), Song 1 aus dem ersten Lauf |
| stdout | nur Protokoll-Nachrichten |
| PC-Ordnerstruktur (`MCP/` im Studio-Ordner) | Studio gefunden, alle Prüfungen bestanden |

Nicht automatisch getestet: die Windows-Einrichtung (`install.ps1`, hier keine PowerShell verfügbar) und der Betrieb in Claude Desktop und Gemini CLI selbst. Das wird beim Einrichten auf dem PC geprüft (die Einrichtung endet mit einer Kurzprüfung).

## 27. Prüfbericht: Einrichtung des MCP-Servers auf dem Windows-PC (25.10.2026)

Rechner „Reverto“, Windows 11 (NT 10.0.26200, x64), Windows PowerShell 5.1. Ausgangslage: Studio 1.12.0 im Ordner `C:\App Entwicklung\Audio tool\DeepStructure_Mastering_Studio`, Node.js **nicht** installiert, Claude Desktop und Gemini CLI ohne MCP-Server.

**Ablauf:** MCP-Dateien in `…\DeepStructure_Mastering_Studio\MCP\` kopiert, „Installieren (Musik-Ordner).cmd“ per Doppelklick gestartet (ohne Rückfragen, Freigabe nur `C:\Users\matth\Music`). Danach `Pruefen.cmd` (neu, `mcp/pruefung.mjs`). Protokolle: `MCP\Einrichtung.log`, `MCP\Pruefung.log`.

### Einrichtung (install.ps1), 17:13–17:19

| Schritt | Ergebnis |
|---|---|
| 1/5 Node.js | fehlte → per winget installiert: Node.js LTS 24.22.1 (Prüfsumme des Installers bestätigt, Windows-Administratorabfrage vom Nutzer bestätigt) |
| 2/5 Pakete | `added 21 packages in 3m` (playwright-core 1.64.1, ffmpeg-static 5.3.0); Edge gefunden; Studio gefunden |
| 3/5 Musikordner | `C:\Users\matth\Music` freigegeben (`config.json`) |
| 4/5 Eintragen | Claude Desktop: `%APPDATA%\Claude\claude_desktop_config.json`; Gemini CLI: `%USERPROFILE%\.gemini\settings.json` (trust = false, Zeitlimit 10 min) |
| 5/5 Kurzprüfung | bestanden (Exit-Code 0, sonst bricht das Skript ab); die Ausgabe fehlte im Protokoll → behoben (`| Out-Host`) |

Dauer gesamt etwa 6 Minuten, davon 3 Minuten Paket-Download.

### Prüfung nach der Einrichtung (pruefung.mjs, 17:27): 22 von 22 bestanden

| Bereich | Prüfung | Ergebnis |
|---|---|---|
| Umgebung | Node.js ≥ 18, playwright-core, ffmpeg-static, Edge, Studio-Datei, Musikordner | 24.22.1 · 1.64.1 · 5.3.0 · `C:\Program Files (x86)\Microsoft\Edge\…\msedge.exe` · Studio 1.12.0 · `C:\Users\matth\Music` |
| Einträge | Claude Desktop: gültiges JSON ohne BOM, Eintrag zeigt auf vorhandenes `node.exe` und `MCP\server.mjs` | OK (keine weiteren MCP-Server in der Datei) |
| | Gemini CLI: wie oben, dazu trust = false und Zeitlimit ≥ 10 min | OK |
| Protokoll | initialize (2025-06-18), Server 1.0.0 | OK |
| | Werkzeugliste: genau 8, keines zum Löschen, Freigeben, Veröffentlichen oder Hochladen | OK |
| | studio_info: Studio, FFmpeg, Browser, Ordner | alles gefunden |
| | list_albums | 5 Ordner mit Audiodateien (3–6 Songs) |
| Schutz | Systemordner `C:\WINDOWS` | abgelehnt |
| | Ausbruch mit `..` (→ `C:\Users`) | abgelehnt |
| | Mastering im Temp-Ordner (außerhalb der Freigabe) | abgelehnt |
| | ungültige Songnummer (99) | abgelehnt („1–3“) |
| | unbekanntes Werkzeug `delete_album` | abgelehnt |
| | kein Auftrag gestartet, nichts in den Musikordnern geschrieben | OK |
| | stdout nur Protokoll (keine Fremdzeilen) | OK |
| Probe-Mastering | 2 künstliche Songs im Temp-Ordner, Edge ohne Fenster, WAV 24 + OGG | Ziel −12 → **−12,1 LUFS**, TP −1,0 dBTP · Ziel −16 → **−16,0 LUFS**, TP −2,3 dBTP · 49 s (20 s + 14 s pro 6-s-Song plus Start) |
| | Netzwerk der Studio-Seite | 1 Versuch (Google-Schriften) blockiert, nichts durchgelassen |
| | Temp-Ordner danach gelöscht | OK |

### Bewertung

- Die Einrichtung läuft auf einem Windows-PC ohne Node.js vollständig per Doppelklick durch; einzige Nutzeraktion war die Administratorabfrage der Node.js-Installation.
- Mastering-Ergebnis identisch zu den Container- und CI-Tests (§ 26): gleiche Messwerte auf 0,1 LU, gleiche True-Peak-Werte.
- Die Rechenzeit am Laptop ist etwa 3–4× so lang wie im Testcontainer; für echte Songs (3–4 min) sind 1–2 Minuten pro Song realistisch, wie in der Werkzeugbeschreibung angegeben. Am echten Album noch zu bestätigen.
- Gefundene und behobene Mängel: Ausgabe der Kurzprüfung fehlte in `Einrichtung.log` (jetzt `| Out-Host`). Neu: `Pruefen.cmd` / `pruefung.mjs` zum jederzeitigen Nachprüfen (verändert nichts).

### Hinweise und offene Punkte

- **Freigegeben ist nur `Musik`.** Darin liegen derzeit ein Hörspiel und Serato-Beispielordner, aber keine Deep-Structure-Alben. Liegen die Alben woanders (z. B. auf Laufwerk D:), `Installieren.cmd` erneut starten und diese Ordner zusätzlich wählen – oder die Alben in `Musik` verschieben.
- **Noch nicht im echten Client getestet:** Claude Desktop muss ganz beendet (auch im Infobereich) und neu gestartet werden; danach erscheint „deep-structure-mastering“ unter „Suchen und Werkzeuge“. Gemini CLI ist auf dem PC noch zu installieren bzw. zu starten (`gemini`, dann `/mcp`); der Eintrag ist bereits vorhanden.
- Rückgängig machen: Eintrag `deep-structure-mastering` in beiden Einstellungsdateien löschen; vor dem Eintragen existierende Dateien wurden als `*.vor-deep-structure.bak` gesichert.

## 28. Nachtrag 1.13.0: Oberfläche auf Englisch, Anleitung Deutsch und Englisch

**Umfang:** neue Module `src/15_lang_en.js` (Wörterbuch, 1087 Einträge, 7 Muster) und `src/16_i18n.js` (Übersetzungsschicht, Umschalter). Geändert an bestehenden Modulen nur, was die Sprache braucht: Anleitung-Knopf wählt `Guide.pdf` (09_art), KI-Prompt bittet bei Englisch um englische Antworten (08_check), dazu ein Fehlerschutz beim Album-Knopf „Überarbeitungsauftrag kopieren“ (14_album).

### Browser-Tests (tests/index.html, Chromium): 137 von 137 bestanden

Die bisherigen 128 Tests laufen jetzt fest auf Deutsch (der Test setzt die Sprache vorher), neu ist der Block „Sprache“:

| Prüfung | Ergebnis |
|---|---|
| Englisch: Knöpfe, Reiter, Tooltips, Platzhalter, `lang`-Attribut | „Open song“, „Song check“, „Undo (Ctrl+Z)“, „e.g. drum & bass …“; 483 sichtbare Texte übersetzt |
| Zusammengesetzte Meldung mit Zahlen | „Lautheit eingestellt: −14,0 LUFS (Ziel −14)“ → „Loudness set: −14.0 LUFS (target −14)“ |
| Canvas-Beschriftung | „Höhen“ wird gemessen und gezeichnet wie „Highs“ |
| Inhalte bleiben | JSON-Feld der Spiel-Daten unverändert; Songname „Floodline – Entwurf 03.wav“ im Namenfeld und in einer Meldung unverändert |
| KI-Prompt | enthält bei Englisch die Bitte um englische Zusammenfassung |
| Wahl gemerkt | `localStorage` `dsms-lang` = `en` |
| Zurück auf Deutsch | alle 483 übersetzten Texte exakt wiederhergestellt, Titel und `lang` wieder deutsch |
| Einstellungen | nach mehrfachem Umschalten identisch (Klang unberührt) |

Dazu bestanden: DSP-Tests (`tests/dsp.test.mjs`, 81 von 81), PC-Fassung über `file://` ohne Warnungen.

### Abdeckung im Ablauf (eigener Scan mit Chromium, Oberfläche Englisch)

Alle 12 Reiter geöffnet, in jedem alle sichtbaren Knöpfe einmal gedrückt (Song-Check-Vorschläge, Clean Song, Limiter-Ziel, Drums suchen/probehören/anwenden, Bereichs-Werkzeuge, Hör-Vergleich, Spiel-Daten …), Album mit 2 Songs angelegt, berechnet, geprüft, freigegeben, kommentiert, zur Überarbeitung markiert, dazu Export-, Feedback- und Mein-Stil-Fenster. Jeder angezeigte Text wurde mitgeschrieben und auf deutsche Reste geprüft.

| Ergebnis | |
|---|---|
| Deutsche Reste in Oberfläche und Meldungen | 0 (übrig nur der eigene Kommentartext „zu scharf“, eine Nutzereingabe) |
| Englische Reste nach Rückschalten auf Deutsch | 0 |
| Seitenfehler | 0 |

Während der Entwicklung gefundene und behobene Fälle: aus Teilen zusammengesetzte Sätze („Mehr Bass als …“, „Der Master ist mit … lauter als das Ziel“, „Steht … dB über …“), Bindestrich-Begriffe aus Listen („Stereo-Flattern“, „KI-Artefakt“), Namen in „…“ (werden nicht mehr übersetzt), Zahlen in „…“ („Erste „1“ bei“).

### Bewusst nicht übersetzt

Song-, Album- und Dateinamen, Nutzereingaben, das JSON der Spiel-Daten (Abschnittsnamen ohne eigenen Namen behalten die deutsche Vorgabe, z. B. „Aufbau“), kopierte Texte für Chat, Codex und Godot, Mastering-Protokoll und Feedback-Mail-Vorlage.

### Anleitung

`Anleitung.pdf` und `Guide.pdf`, je 32 Seiten, Version 1.13.0: neue Kapitel „Mein Stil“ und „Album“, Sprachumschalter, alle 25 Bilder neu aus 1.13.0 (jeweils in der passenden Sprache, Song „3. DEIN ABER“). Seitenzahlen im Inhaltsverzeichnis aus dem fertigen PDF ermittelt. Sichtprüfung aller Seiten.

### Offen

- Echte Geräte (Android-Handy, Windows-PC) mit englischer Oberfläche noch nicht von Hand geprüft; der Tester meldet über „Feedback“.
- Die Übersetzung ist ein Wörterbuch: Neue deutsche Texte brauchen einen Eintrag in `src/15_lang_en.js`, sonst erscheinen sie auf Deutsch.
