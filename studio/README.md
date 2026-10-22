# Deep Structure Mastering Studio

Installierbare Web-App (PWA) unter `deepstructure.world/studio/`: Audio-Editor, Song-Check, KI-Artefakt-Suche und Mastering-Kette. Die gesamte Audioverarbeitung läuft lokal im Browser. Audiodateien verlassen das Gerät nie.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Die komplette App (HTML, CSS, JavaScript in einer Datei, ohne Build-Schritt) |
| `sw.js` | Service Worker: Offline-Start und Updates |
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

**True-Peak-Limiter:** gleitendes Minimum plus Kastenglättung, dadurch ist der Attack gleich der Vorschauzeit. Der Release ist exponentiell. Die Spitzenerkennung erfasst auch Zwischenwerte (4-fach Polyphasen-FIR mit 16 Taps je Phase). Eine harte Sicherheitsgrenze sitzt auf Sample-Ebene. Signale unterhalb der Decke laufen bitgenau durch (latenzkorrigiert).

**Export:**
- Der Export rendert die Kette mit `OfflineAudioContext`. Die Latenz wird per Klick-Test kompensiert.
- Limiter, Messung und WAV-Kodierung laufen im Web Worker, mit demselben Limiter-Code wie in der Echtzeit-Wiedergabe (AudioWorklet).
- Formate: WAV 16 und 24 Bit (TPDF-Dither, deterministisch) sowie 32 Bit Float.

**Messung:**

| Messgröße | Verfahren |
|---|---|
| Lautheit | ITU-R BS.1770-4: K-Filter nach libebur128, Gating −70 LUFS absolut und −10 LU relativ |
| Kurzzeit-Lautheit | Fenster 3 s |
| Loudness Range | EBU Tech 3342: Perzentile 10 und 95, relatives Gate −20 LU |
| True Peak | 4-fach Oversampling |

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
