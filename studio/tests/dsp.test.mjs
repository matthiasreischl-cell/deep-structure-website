#!/usr/bin/env node
/*
  Deep Structure Mastering Studio – DSP-Tests (ohne Abhängigkeiten)
  Aufruf:  node studio/tests/dsp.test.mjs            (aus dem Repository-Wurzelverzeichnis)
           node dsp.test.mjs ../index.html            (aus studio/tests)
  Liest den DSP-Code (Limiter, Messung, Export, Artefakt-Werkzeuge) direkt aus studio/index.html
  und prüft ihn mit synthetischen Signalen, deren Sollwerte bekannt sind.
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = process.argv[2] || path.join(here, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const grab = name => { const m = html.match(new RegExp('const ' + name + ' = String\\.raw`([\\s\\S]*?)`;')); if (!m) throw new Error(name + ' nicht gefunden'); return m[1]; };
const D = new Function(grab('LIM_SRC') + grab('ANA_SRC') + 'return {handle, loudness, truePeak, applyLim, spectrum, encodeWav, smoothHF, artifacts, DSLimiter, gameData};')();

let pass = 0, fail = 0; const rows = [];
function check(name, ok, detail) { rows.push([ok ? 'PASS' : 'FAIL', name, detail]); ok ? pass++ : fail++; }
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const db = x => 20 * Math.log10(Math.max(1e-12, x));
function sine(sr, sec, f, amp, phase = 0, ch2 = 1) { const n = Math.round(sr * sec), L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = amp * Math.sin(2 * Math.PI * f * i / sr + phase); R[i] = L[i] * ch2; } return { L, R, sr }; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 - 0.5; }; }
function noise(sr, sec, amp, seed = 3, corr = 0) { const r = rng(seed), r2 = rng(seed + 99), n = Math.round(sr * sec), L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = r() * 2, b = r2() * 2; L[i] = amp * a; R[i] = amp * (corr * a + (1 - Math.abs(corr)) * b); } return { L, R, sr }; }
function pink(sr, sec, amp, seed = 5) { const r = rng(seed), n = Math.round(sr * sec), L = new Float32Array(n), R = new Float32Array(n); let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) { const w = r() * 2; b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
    const p = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362; b6 = w * 0.115926; L[i] = R[i] = p * amp; } return { L, R, sr }; }
const meas = (x, opts = { tp: true }) => D.handle({ L: x.L.slice(), R: x.R.slice(), sr: x.sr, opts }).result;

/* 1  Lautheit nach ITU-R BS.1770 */
{ const r = meas(sine(48000, 20, 997, 0.1)); check('LUFS: 997-Hz-Sinus −20 dBFS stereo = −20,0 LUFS', near(r.I, -20, 0.1), r.I.toFixed(2)); }
{ const r = meas(sine(48000, 20, 1000, Math.pow(10, -23 / 20))); check('LUFS: 1-kHz-Sinus −23 dBFS stereo = −23,0 LUFS (EBU)', near(r.I, -23, 0.1), r.I.toFixed(2)); }
{ const r = meas(sine(48000, 20, 997, 0.1, 0, 0)); check('LUFS: nur ein Kanal −20 dBFS = −23,0 LUFS', near(r.I, -23.01, 0.1), r.I.toFixed(2)); }
for (const sr of [44100, 48000, 96000]) { const r = meas(sine(sr, 10, 997, 0.1)); check('LUFS bei ' + sr + ' Hz konsistent', near(r.I, -20, 0.1), r.I.toFixed(2)); }
/* 2  Loudness Range (EBU Tech 3342: 20 s −20 dBFS + 20 s −30 dBFS → 10 LU) */
{ const a = sine(48000, 20, 1000, 0.1), b = sine(48000, 20, 1000, Math.pow(10, -30 / 20)), L = new Float32Array(a.L.length * 2); L.set(a.L); L.set(b.L, a.L.length);
  const r = meas({ L, R: L.slice(), sr: 48000 }); check('LRA: Stufe −20/−30 dB = 10 LU', near(r.LRA, 10, 1), r.LRA.toFixed(2)); }
/* 3  True Peak (Zwischenwerte) */
{ const n = 48000 * 3, L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = Math.sin(2 * Math.PI * i / 4 + Math.PI / 4);
  const r = meas({ L, R: L.slice(), sr: 48000 }); check('True Peak: fs/4-Sinus 45° = 0,0 dBTP (Samples −3,01)', near(r.TP, 0, 0.2) && near(r.peak, -3.01, 0.05), 'TP ' + r.TP.toFixed(2) + ', Sample-Peak ' + r.peak.toFixed(2)); }
{ const r = meas(sine(48000, 5, 1000, 0.5)); check('True Peak: 1-kHz-Sinus −6,02 dBFS = −6,0 dBTP', near(r.TP, -6.02, 0.05), r.TP.toFixed(2)); }
/* 4  Spektrum: L und R getrennt, keine Auslöschung */
{ const x = noise(48000, 4, 0.2, 11, 1), anti = { L: x.L, R: x.L.map(v => -v), sr: 48000 };
  const a = D.spectrum(x.L, x.L, 48000), b = D.spectrum(anti.L, anti.R, 48000); let maxd = 0; for (let i = 3; i < a.length; i++) maxd = Math.max(maxd, Math.abs(a[i] - b[i]));
  check('Spektrum: gegenphasiges Signal = gleichphasiges Signal', maxd < 0.01, 'max. Abweichung ' + maxd.toFixed(3) + ' dB'); }
{ const x = sine(48000, 4, 1000, 0.3), s = D.spectrum(x.L, x.R, 48000), m = s.indexOf(Math.max(...s));
  check('Spektrum: 1-kHz-Sinus landet im 1-kHz-Terzband', m === 17, 'Band ' + m); }
{ const x = pink(48000, 30, 0.1), s = D.spectrum(x.L, x.R, 48000).slice(5, 27), mean = s.reduce((a, b) => a + b, 0) / s.length, dev = Math.max(...s.map(v => Math.abs(v - mean)));
  check('Spektrum: rosa Rauschen in Terzbändern flach (63 Hz – 8 kHz, ±2 dB)', dev < 2, 'max. Abweichung ' + dev.toFixed(2) + ' dB'); }
{ const x = noise(48000, 4, 0.2, 21, 0), w = D.spectrum(x.L, x.R, 48000), m = D.spectrum(x.L, x.L, 48000);
  check('Spektrum: stark breite Mischung (unkorreliert) ohne Pegelverlust', near(w[17], m[17], 1.0), (w[17] - m[17]).toFixed(2) + ' dB'); }
/* 5  Limiter */
{ const x = noise(48000, 10, 0.5, 7, 0.6), L = x.L.slice(), R = x.R.slice(); D.applyLim(L, R, 48000, { on: true, drive: 12, ceiling: -1, release: 80, isp: true });
  const r = D.handle({ L, R, sr: 48000, opts: { tp: true } }).result;
  check('Limiter: Sample-Peak ≤ Decke (−1 dB) bei +12 dB Drive', r.peak <= -1 + 1e-4, r.peak.toFixed(3) + ' dBFS');
  check('Limiter: True Peak ≤ Decke + 0,2 dB (Rauschen, extrem)', r.TP <= -0.8, r.TP.toFixed(2) + ' dBTP'); }
{ const x = pink(48000, 10, 0.08), L = x.L.slice(), R = x.R.slice(), g = D.applyLim(L, R, 48000, { on: true, drive: 0, ceiling: -1, release: 80, isp: true }); let maxd = 0;
  for (let i = 0; i < L.length; i++) maxd = Math.max(maxd, Math.abs(L[i] - x.L[i]));
  check('Limiter: Signal unter der Decke bleibt unverändert (latenzkorrigiert)', maxd < 1e-6 && g === 1, 'max. Abweichung ' + maxd.toExponential(1)); }
{ const x = pink(48000, 5, 0.3), L = x.L.slice(), R = x.R.slice(); D.applyLim(L, R, 48000, { on: false, drive: 0, ceiling: -1, release: 80, isp: true }); let maxd = 0;
  for (let i = 0; i < L.length; i++) maxd = Math.max(maxd, Math.abs(L[i] - x.L[i])); check('Limiter aus + Drive 0 = exakt unverändert', maxd === 0, String(maxd)); }
{ // Release: nach einer kurzen Spitze erholt sich die Verstärkung je nach Release-Zeit unterschiedlich schnell
  const sr = 48000, n = sr * 2, L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = 0.25 * Math.sin(2 * Math.PI * 200 * i / sr);
  for (let i = sr * 0.5; i < sr * 0.5 + 240; i++) L[i] = 0.99 * Math.sin(2 * Math.PI * 200 * i / sr) / 0.25 * 0.25 + Math.sign(L[i]) * 0.7;
  const rmsAt = (x, t) => { const a = Math.round(sr * t), w = 480; let e = 0; for (let i = a; i < a + w; i++) e += x[i] * x[i]; return Math.sqrt(e / w); };
  const res = {}; for (const rel of [40, 300]) { const a = L.slice(), b = L.slice(); D.applyLim(a, b, sr, { on: true, drive: 6, ceiling: -1, release: rel, isp: true });
    res[rel] = db(rmsAt(a, 0.58) / (rmsAt(L, 0.58) * Math.pow(10, 6 / 20))); }
  check('Limiter: Release wirkt (40 ms erholt sich schneller als 300 ms)', res[40] > res[300] + 0.5 && res[40] > -1, '80 ms nach der Spitze: 40 ms → ' + res[40].toFixed(2) + ' dB, 300 ms → ' + res[300].toFixed(2) + ' dB Verstärkungsabweichung'); }
{ // Transienten: kurzer Schlag unter der Decke bleibt erhalten
  const sr = 48000, n = sr, L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = 0.05 * Math.sin(2 * Math.PI * 100 * i / sr); for (let i = 24000; i < 24048; i++) L[i] += 0.8 * Math.exp(-(i - 24000) / 10);
  const a = L.slice(), b = L.slice(); D.applyLim(a, b, sr, { on: true, drive: 0, ceiling: -1, release: 80, isp: true }); let m1 = 0, m2 = 0; for (let i = 23990; i < 24060; i++) { m1 = Math.max(m1, Math.abs(L[i])); m2 = Math.max(m2, Math.abs(a[i])); }
  check('Limiter: Transiente unter der Decke unverändert', near(m1, m2, 1e-6), db(m2).toFixed(2) + ' dBFS'); }
/* 6  WAV-Export */
for (const bits of [16, 24, 32]) { const x = sine(48000, 1, 440, 0.5), buf = D.encodeWav(x.L.slice(), x.R.slice(), 48000, bits), v = new DataView(buf);
  const fmt = v.getUint16(20, true), br = v.getUint16(34, true), sr = v.getUint32(24, true), len = v.getUint32(40, true) / (bits / 8 * 2);
  let maxe = 0; for (let i = 0; i < 2000; i++) { let s; const o = 44 + i * 2 * bits / 8;
    if (bits === 32) s = v.getFloat32(o, true); else if (bits === 16) s = v.getInt16(o, true) / 32768; else { let k = v.getUint8(o) | v.getUint8(o + 1) << 8 | v.getUint8(o + 2) << 16; if (k & 0x800000) k -= 0x1000000; s = k / 8388608; }
    maxe = Math.max(maxe, Math.abs(s - x.L[i])); }
  const lsb = bits === 32 ? 1e-7 : 2 / Math.pow(2, bits - 1);
  check('WAV ' + bits + ' Bit: Kopf korrekt, Rundreise-Fehler ≤ ' + (bits === 32 ? 'Float-Genauigkeit' : '2 LSB (mit Dither)'), fmt === (bits === 32 ? 3 : 1) && br === bits && sr === 48000 && len === 48000 && maxe <= lsb, 'max. Fehler ' + maxe.toExponential(2)); }
{ const x = pink(44100, 2, 0.2), a = new Uint8Array(D.encodeWav(x.L.slice(), x.R.slice(), 44100, 24)), b = new Uint8Array(D.encodeWav(x.L.slice(), x.R.slice(), 44100, 24));
  let same = a.length === b.length; for (let i = 0; same && i < a.length; i++) if (a[i] !== b[i]) same = false;
  check('WAV: wiederholter Export liefert identische Bytes', same, a.length + ' Bytes'); }
/* 7  Stille und sehr kurze Dateien */
{ let ok = true, info = ''; try { const z = { L: new Float32Array(48000 * 3), R: new Float32Array(48000 * 3), sr: 48000 }; const r = D.handle({ L: z.L, R: z.R, sr: 48000, opts: { tp: true, spectrum: true, diag: true } }).result;
    const a = D.artifacts(z.L, z.R, 48000); info = 'I=' + r.I + ', Regionen ' + a.regions.length + ', Knackser ' + a.clicks.length; ok = r.I === -Infinity && a.regions.length === 0 && a.clicks.length === 0; } catch (e) { ok = false; info = e.message; }
  check('Stille: keine Fehler, keine Fehlalarme', ok, info); }
{ let ok = true, info = ''; try { for (const n of [1, 100, 4000]) { const L = new Float32Array(n).fill(0.1), r = D.handle({ L, R: L.slice(), sr: 48000, opts: { tp: true, spectrum: true, diag: true } }).result; const A = L.slice(), B = L.slice(); D.applyLim(A, B, 48000, { on: true, drive: 6, ceiling: -1, release: 80, isp: true }); D.artifacts(L, L, 48000); info += n + ':ok '; } } catch (e) { ok = false; info += e.message; }
  check('Sehr kurze Dateien (1, 100, 4000 Samples) ohne Absturz', ok, info); }
/* 8  Artefakt-Werkzeuge */
{ const x = pink(48000, 6, 0.1), o = D.smoothHF(x.L, x.R, 48000, { strength: 0.5, freq: 30000 }); let e = 0, m = 0; for (let i = 0; i < x.L.length; i++) { const d = o.L[i] - x.L[i]; e += d * d; m = Math.max(m, Math.abs(d)); }
  check('Glätter: STFT-Rekonstruktion ohne Eingriff verlustfrei (Nulltest)', m < 1e-5, 'max. Fehler ' + m.toExponential(2)); }
{ const x = pink(48000, 3, 0.1), o = D.smoothHF(x.L, x.R, 48000, { strength: 0, freq: 6000 }); let m = 0; for (let i = 0; i < x.L.length; i++) m = Math.max(m, Math.abs(o.L[i] - x.L[i]));
  check('Glätter: Stärke 0 % verändert nichts', m === 0, 'max. Abweichung ' + m); }
{ const x = pink(48000, 6, 0.1), L = x.L.slice(), R = x.R.slice(), r = rng(9); for (let k = 0; k < 40; k++) { const c = Math.floor((r() + 0.5) * (L.length - 900)), f = 10000 + (r() + 0.5) * 3000; for (let j = 0; j < 600; j++) { const v = 0.04 * Math.sin(2 * Math.PI * f * j / 48000) * Math.sin(Math.PI * j / 600); L[c + j] += v; R[c + j] += v; } }
  const o = D.smoothHF(L, R, 48000, { strength: 0.8, freq: 6000 }), lo = D.spectrum(o.L, o.R, 48000), li = D.spectrum(L, R, 48000), ls = D.spectrum(x.L, x.R, 48000);
  const lowDiff = Math.max(...[10, 12, 14, 16, 18].map(i => Math.abs(lo[i] - li[i]))), hfCut = li[28] - lo[28];
  check('Glätter: senkt Glitzern über 6 kHz, lässt Tiefen/Mitten unverändert', lowDiff < 0.1 && hfCut > 0.3, 'Tiefen/Mitten ±' + lowDiff.toFixed(2) + ' dB, 12,5 kHz −' + hfCut.toFixed(2) + ' dB'); }
{ const x = sine(48000, 8, 440, 0.3), a = D.artifacts(x.L, x.R, 48000); check('Artefakt-Suche: sauberer Sinus ohne Fehlalarm', a.regions.length === 0 && a.clicks.length === 0, a.regions.length + ' Regionen, ' + a.clicks.length + ' Knackser'); }
{ const x = sine(48000, 8, 440, 0.2), L = x.L, R = x.R; for (const t of [2, 4.5, 6]) { const i = Math.round(t * 48000); L[i] += 0.5; R[i] += 0.5; }
  const a = D.artifacts(L, R, 48000); check('Artefakt-Suche: 3 eingefügte Knackser werden gefunden', a.clicks.length === 3, a.clicks.map(c => c.toFixed(2)).join(', ')); }

/* 9  Spiel-Daten: Tempo, Beat-Raster, Taktanfang, Abschnitte (synthetischer Song mit bekannten Werten) */
function song(bpm, sr = 44100, pre = 0.5) {
  const plan = [['intro', 8, { hat: 1 }], ['main', 16, { kick: 1, snare: 1, hat: 1, bass: 1 }], ['break', 8, { pad: 1 }], ['drop', 16, { kick: 1, snare: 1, hat: 1, bass: 1, loud: 1 }], ['outro', 4, { hat: 1 }]];
  const beat = 60 / bpm, total = plan.reduce((a, p) => a + p[1], 0) * 4 * beat + pre + 1, n = Math.round(total * sr), L = new Float32Array(n), r = rng(7), secs = [];
  const add = (t, len, f) => { const i0 = Math.round(t * sr); for (let i = 0; i < len && i0 + i < n; i++) L[i0 + i] += f(i); };
  let t0 = pre;
  for (const [name, bars, o] of plan) { secs.push(t0);
    for (let b = 0; b < bars * 4; b++) { const t = t0 + b * beat, g = o.loud ? 1.4 : 1;
      if (o.kick) add(t, sr * 0.3, i => g * 0.8 * Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-i / sr * 30)) * i / sr) * Math.exp(-i / sr * 8));
      if (o.snare && b % 2 === 1) add(t, sr * 0.2, i => g * (0.35 * r() * 2 * Math.exp(-i / sr * 20) + 0.2 * Math.sin(2 * Math.PI * 200 * i / sr) * Math.exp(-i / sr * 25)));
      if (o.hat) { add(t + beat / 2, sr * 0.05, i => 0.12 * r() * 2 * Math.exp(-i / sr * 60)); if (!o.kick) add(t, sr * 0.05, i => 0.12 * r() * 2 * Math.exp(-i / sr * 60)); }
      if (o.bass) { const f = 55 * (b % 8 < 4 ? 1 : 1.335); add(t, beat * sr, i => g * 0.25 * Math.sin(2 * Math.PI * f * i / sr) * Math.min(1, i / 200) * Math.max(0, 1 - i / (beat * sr * 0.95))); }
      if (o.pad && b % 4 === 0) add(t, 4 * beat * sr, i => 0.15 * (Math.sin(2 * Math.PI * 220 * i / sr) + Math.sin(2 * Math.PI * 277 * i / sr)) * Math.min(1, i / 2000)); }
    t0 += bars * 4 * beat; }
  return { L, R: L.slice(), sr, secs, beat, pre };
}
const gd = (x, opts = {}) => D.handle({ cmd: 'gamedata', L: x.L.slice(), R: x.R.slice(), sr: x.sr, opts }).result;
for (const bpm of [75, 90, 128, 140, 174]) {
  const x = song(bpm), g = gd(x), err = g.beats.map(b => { const k = Math.round((b - x.pre) / x.beat); return Math.abs(b - x.pre - k * x.beat) * 1000; }).sort((a, b) => a - b);
  const med = err[err.length >> 1], down = g.beats[g.downbeatPhase], downOk = Math.abs(((down - x.pre) / (4 * x.beat)) - Math.round((down - x.pre) / (4 * x.beat))) < 0.02;
  check('Spiel-Daten ' + bpm + ' BPM: Tempo, Beat-Raster (Median < 6 ms) und Taktanfang', g.bpm === bpm && med < 6 && downOk, g.bpm + ' BPM, Abweichung ' + med.toFixed(1) + ' ms, erste „1“ ' + down.toFixed(3) + ' s');
  const st = g.sections.slice(1).map(s => g.beats[s.startBeat]), hit = x.secs.slice(1).filter(t => st.some(s => Math.abs(s - t) < x.beat * 0.5)).length;
  check('Spiel-Daten ' + bpm + ' BPM: Abschnittswechsel gefunden (4 von 4)', hit === 4 && st.length <= 5, st.map(t => t.toFixed(2)).join(', ') + ' s'); }
{ const x = song(123.4, 48000, 3.2), g = gd(x), err = g.beats.filter(b => b > x.pre).map(b => { const k = Math.round((b - x.pre) / x.beat); return Math.abs(b - x.pre - k * x.beat) * 1000; }).sort((a, b) => a - b);
  check('Spiel-Daten: krummes Tempo (123,4 BPM), 48 kHz, 3,2 s Stille am Anfang', Math.abs(g.bpm - 123.4) < 0.02 && err[err.length >> 1] < 6, g.bpm + ' BPM, Abweichung ' + err[err.length >> 1].toFixed(1) + ' ms'); }
{ const x = song(128), g = gd(x, { bpm: 127.5 }); check('Spiel-Daten: eingetragenes Tempo wird exakt übernommen', g.bpm === 127.5 && Math.abs(g.beatSec - 60 / 127.5) < 1e-9, g.bpm + ' BPM, Beat ' + g.beatSec.toFixed(6) + ' s'); }
{ const x = song(128), g = gd(x, { bpm: 128, downbeatPhase: 2 }); check('Spiel-Daten: Taktanfang lässt sich verschieben', g.downbeatPhase === 2, 'Phase ' + g.downbeatPhase); }
{ const x = noise(44100, 30, 0.2, 11), g = gd(x); check('Spiel-Daten: Rauschen ohne Rhythmus → Raster als unsicher markiert', g.bpmConfidence < 0.3, 'Sicherheit ' + g.bpmConfidence.toFixed(2)); }
{ const g = gd(sine(44100, 2, 440, 0.1)); check('Spiel-Daten: zu kurzer Song → verständliche Meldung statt Fehler', typeof g.error === 'string', g.error || '–'); }

const w = Math.max(...rows.map(r => r[1].length));
console.log('\nDeep Structure Mastering Studio – DSP-Tests (' + path.basename(htmlPath) + ')\n');
for (const [s, n, d] of rows) console.log((s === 'PASS' ? '  ✔ ' : '  ✘ ') + n.padEnd(w) + '  ' + d);
console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen\n');
process.exit(fail ? 1 : 0);
