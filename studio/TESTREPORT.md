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
