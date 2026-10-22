# Tests für das Mastering Studio

Alle Tests prüfen die Datei `../index.html` direkt, die App bleibt also unverändert.

## 1. DSP-Tests (ohne Installation)

```bash
node studio/tests/dsp.test.mjs
```

Benötigt nur Node.js ab Version 18. Geprüft werden:
- **Lautheit und Messung:** LUFS (BS.1770), LRA (EBU 3342), True Peak, alles mit Sollwerten und bei 44,1/48/96 kHz
- **Spektrum:** gegenphasig, rosa Rauschen, breite Mischungen
- **Limiter:** Decke, True Peak, Nulltest unter der Decke, Release, Transienten
- **WAV-Kodierung:** 16, 24 und 32 Bit, wiederholter Export bytegleich
- **Sonderfälle:** Stille und sehr kurze Dateien
- **Artefakt-Werkzeuge:** STFT-Nulltest, keine Fehlalarme, Knackser-Erkennung

## 2. Integrationstests im Browser

Sie testen die echte App: Signalkette, Presets, Sättigung, EQ, Stereo, Lautheitsziel, Export-Matrix, Sonderfälle und API-Schlüssel.

- **Manuell:** `https://deepstructure.world/studio/tests/` öffnen und „Tests starten“ klicken. Lokal geht das über einen Webserver, zum Beispiel `python3 -m http.server` im Repository-Ordner, dann `http://localhost:8000/studio/tests/`.
- **Automatisch** (Python 3 und Playwright nötig, im Ordner `studio/`):
  ```bash
  python3 tests/run-browser-tests.py
  ```

## 3. Unabhängige Gegenmessung exportierter Dateien mit FFmpeg

```bash
sh studio/tests/ffmpeg-check.sh Master.wav Original.wav
```

Gibt die integrierte Lautheit, die LRA und den True Peak nach FFmpeg `ebur128` aus. Diese Werte sollten den Angaben im Reiter „Analyse“ und im Export-Dialog entsprechen (Toleranz ±0,1 LU bzw. dB).
