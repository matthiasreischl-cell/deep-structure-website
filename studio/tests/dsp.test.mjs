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
const D = new Function(grab('LIM_SRC') + grab('ANA_SRC') + 'return {DSComp, handle, loudness, truePeak, applyLim, spectrum, encodeWav, smoothHF, artifacts, DSLimiter, gameData, drumDetect, drumRepair, fft, synthKick, synthSnare, toneMatch, KICKS, SNARES, cleanScan, cleanSong, hearCompare};')();

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
{ let worst = 0, wf = ''; for (const f of [12000, 16000, 18000, 20000, 21000]) for (const ph of [0.3, 1.1, 2.5]) { const n = 48000, L = new Float32Array(n), fd = 2400; for (let i = 0; i < n; i++) L[i] = 0.5 * Math.sin(2 * Math.PI * f * i / 48000 + ph) * Math.min(1, 0.5 - 0.5 * Math.cos(Math.PI * Math.min(i, n - 1 - i) / fd));
    const e = 20 * Math.log10(D.truePeak(L)) + 6.0206; if (Math.abs(e) > Math.abs(worst)) { worst = e; wf = f + ' Hz'; } }
  check('True Peak: hohe Töne 12–21 kHz genau (±0,05 dB, früher bis −0,22)', Math.abs(worst) <= 0.05, 'größte Abweichung ' + worst.toFixed(3) + ' dB bei ' + wf); }
{ let worst = -99, wf = ''; for (const f of [8000, 12000, 16000, 19000, 20000]) { const x = sine(48000, 2, f, 0.9), L = x.L.slice(), R = x.R.slice(), fd = 2400; for (let i = 0; i < L.length; i++) { const w = Math.min(1, 0.5 - 0.5 * Math.cos(Math.PI * Math.min(i, L.length - 1 - i) / fd)); L[i] *= w; R[i] *= w; }
    D.applyLim(L, R, 48000, { on: true, drive: 6, ceiling: -1, release: 80, isp: true });
    const t = 20 * Math.log10(Math.max(D.truePeak(L), D.truePeak(R))); if (t > worst) { worst = t; wf = f + ' Hz'; } }
  check('Limiter: hohe Töne mit +6 dB Drive bleiben unter der Decke (≤ −0,95 dBTP)', worst <= -0.95, 'höchster Wert ' + worst.toFixed(2) + ' dBTP bei ' + wf); }
/* Ideale Rekonstruktion (16-fach über FFT, periodisch) als unabhängige Referenz für den Rausch-Extremfall */
function idealTP(x) { const n = x.length, U = 16, N = n * U, re = new Float64Array(N), im = new Float64Array(N), a = new Float64Array(n), b = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = x[i]; D.fft(a, b); const h = n / 2;
  for (let k = 0; k < h; k++) { re[k] = a[k]; im[k] = b[k]; if (k) { re[N - k] = a[n - k]; im[N - k] = b[n - k]; } } re[h] = a[h] / 2; im[h] = b[h] / 2; re[N - h] = a[h] / 2; im[N - h] = -b[h] / 2;
  for (let k = 0; k < N; k++) im[k] = -im[k]; D.fft(re, im); let m = 0; for (let k = 300 * U; k < N - 300 * U; k++) m = Math.max(m, Math.abs(re[k] / n)); return 20 * Math.log10(m); }
{ const x = noise(48000, 1.5, 0.5, 7, 0), n = 65536, L = x.L.slice(0, n), R = x.R.slice(0, n); D.applyLim(L, R, 48000, { on: true, drive: 12, ceiling: -1, release: 80, isp: true });
  const own = 20 * Math.log10(Math.max(D.truePeak(L), D.truePeak(R))), ideal = Math.max(idealTP(L), idealTP(R));
  check('Limiter, Extremfall weißes Rauschen +12 dB: ideale Rekonstruktion hält die Decke −1 dBTP', ideal <= -0.99, 'eigene Anzeige ' + own.toFixed(2) + ', ideal ' + ideal.toFixed(2) + ' dBTP'); }
{ // Grenzlasttest aus dem Prüfbericht 1.7.0: Seed 92113, Amplitude 0,95, +12 dB, Decke −1, 48 kHz (hier 65536 Samples wegen FFT-Länge)
  let s = 92113; const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; }; const n = 65536, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = 0.95 * r(); R[i] = 0.95 * r(); } D.applyLim(L, R, 48000, { on: true, drive: 12, ceiling: -1, release: 80, isp: true });
  const ideal = Math.max(idealTP(L), idealTP(R)); check('Limiter, Grenzlasttest Prüfbericht (Seed 92113): ideale Rekonstruktion ≤ −1 dBTP', ideal <= -0.99, 'ideal ' + ideal.toFixed(3) + ' dBTP'); }
for (const f of [0.49, 0.499]) { // Sinus knapp unter der Nyquist-Frequenz: der schwierigste Fall für endliche Interpolatoren
  const n = 65536, L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i++) { L[i] = 0.9 * Math.sin(2 * Math.PI * f * i + 0.3); R[i] = 0.9 * Math.sin(2 * Math.PI * f * (i + 7) + 0.3); }
  D.applyLim(L, R, 44100, { on: true, drive: 12, ceiling: -1, release: 80, isp: true });
  const ideal = Math.max(idealTP(L), idealTP(R)); check('Limiter, Sinus bei ' + String(f).replace('.', ',') + ' × Abtastrate: ideale Rekonstruktion ≤ −1 dBTP', ideal <= -0.99, 'ideal ' + ideal.toFixed(2) + ' dBTP'); }
{ // Rosa Rauschen (ohne Sicherheitsstufe ideal −0,88 dBTP, also über der Decke): jetzt gehalten, Zusatzabsenkung höchstens 0,2 dB
  const x = pink(48000, 1.4, 0.3), n = 65536, L = x.L.slice(0, n), R = x.R.slice(0, n); const g = D.applyLim(L, R, 48000, { on: true, drive: 10, ceiling: -1, release: 80, isp: true });
  const ideal = Math.max(idealTP(L), idealTP(R)); check('Limiter, rosa Rauschen +10 dB: ideale Rekonstruktion ≤ −1 dBTP, Zusatzabsenkung ≤ 0,2 dB', ideal <= -0.99 && ideal >= -1.2, 'ideal ' + ideal.toFixed(3) + ' dBTP'); }
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
  const sr = 48000, n = sr, L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = 0.05 * Math.sin(2 * Math.PI * 100 * i / sr); for (let i = 24000; i < 24048; i++) L[i] += 0.78 * Math.exp(-(i - 24000) / 10); // True Peak ideal ca. −1,2 dBTP, also klar unter der Decke
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

/* 10  Drum-Reparatur: Testmix mit Kick, Snare (mit metallischem Nachklingen), HiHats, Bass-Tönen und gesangsähnlichem Ton */
function drumMix(bpm = 96, bars = 12, sign = 1) {
  const sr = 48000, beat = 60 / bpm, n = Math.round((bars * 4 * beat + 1) * sr), L = new Float32Array(n), r = rng(5), kicks = [], snares = [];
  const add = (t, len, f) => { const i0 = Math.round(t * sr); for (let i = 0; i < len && i0 + i < n; i++) L[i0 + i] += f(i, i / sr); };
  let ph = 0; for (let i = Math.round(4 * beat * sr); i < n; i++) { const t = i / sr; ph += 220 * (1 + 0.01 * Math.sin(2 * Math.PI * 5 * t)) / sr; let v = 0; for (let h = 1; h <= 20; h++) v += Math.sin(2 * Math.PI * h * ph) / h; L[i] += 0.04 * v; }
  for (let b = 0; b < bars * 4; b++) { const t = 0.3 + b * beat;
    if (b % 2 === 0) { kicks.push(t); let p = 0; add(t, sr * 0.4, (i, s) => { p += 2 * Math.PI * 55 * (1 + 2 * Math.exp(-s / 0.02)) / sr; return sign * 0.6 * Math.sin(p) * Math.exp(-s / 0.15); }); }
    else { snares.push(t); add(t, sr * 0.25, (i, s) => 0.25 * Math.sin(2 * Math.PI * 190 * s) * Math.exp(-s / 0.04) + 0.3 * r() * 2 * Math.exp(-s / 0.07) + 0.06 * (Math.sin(2 * Math.PI * 3400 * s) + Math.sin(2 * Math.PI * 5900 * s)) * Math.exp(-s / 0.12)); }
    for (const hh of [0, 0.5]) { let p1 = 0, p2 = 0; add(t + hh * beat, sr * 0.08, (i, s) => { const w = r() * 2, d1 = w - p1; p1 = w; const d2 = d1 - p2; p2 = d1; return 0.05 * d2 * Math.exp(-s / 0.02); }); }
    add(t, Math.round(beat * sr * 0.9), (i, s) => 0.15 * Math.sin(2 * Math.PI * (b % 4 < 2 ? 73 : 82) * s) * Math.min(1, s / 0.01) * Math.max(0, 1 - s / (beat * 0.9))); }
  return { L, R: L.slice(), sr, kicks, snares, beat };
}
const goertzel = (x, sr, f, wins) => { let e = 0; for (const [a, b] of wins) { const c = 2 * Math.cos(2 * Math.PI * f / sr); let s1 = 0, s2 = 0; for (let i = Math.round(a * sr); i < Math.round(b * sr); i++) { const s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; } e += s1 * s1 + s2 * s2 - c * s1 * s2; } return 10 * Math.log10(e + 1e-20); };
const hitRate = (det, tru) => [tru.filter(t => det.some(d => Math.abs(d.t - t) < 0.02)).length / tru.length, det.length ? det.filter(d => tru.some(t => Math.abs(d.t - t) < 0.02)).length / det.length : 0];
{ const x = drumMix(), g = gd(x), d = D.drumDetect(x.L, x.R, x.sr, { sens: 0.5, beats: g.beats }), k = hitRate(d.kicks, x.kicks), s = hitRate(d.snares, x.snares);
  check('Drums: Kick-Erkennung im Mix (Trefferquote ≥ 85 %, keine Bass-Töne)', k[0] >= 0.85 && k[1] >= 0.95, 'gefunden ' + (k[0] * 100).toFixed(0) + ' %, richtig ' + (k[1] * 100).toFixed(0) + ' %');
  check('Drums: Snare-Erkennung im Mix (≥ 90 % gefunden, ≥ 85 % richtig)', s[0] >= 0.9 && s[1] >= 0.85, 'gefunden ' + (s[0] * 100).toFixed(0) + ' %, richtig ' + (s[1] * 100).toFixed(0) + ' %');
  const off = D.drumRepair(x.L, x.R, x.sr, { det: d }); check('Drums: alles aus → bitgenau unverändert', off.L.every((v, i) => v === x.L[i]), off.report.changed ? 'verändert' : 'unverändert');
  const r = D.drumRepair(x.L, x.R, x.sr, { det: d, metal: { on: true, amt: 0.6 } }), sw = x.snares.filter(t => t > 2.6).map(t => [t + 0.03, t + 0.15]), all = [[2.6, x.L.length / x.sr - 0.1]];
  const ring = Math.min(goertzel(x.L, x.sr, 3400, sw) - goertzel(r.L, x.sr, 3400, sw), goertzel(x.L, x.sr, 5900, sw) - goertzel(r.L, x.sr, 5900, sw));
  const voc = Math.max(...[1540, 2200, 2860].map(f => Math.abs(goertzel(r.L, x.sr, f, all) - goertzel(x.L, x.sr, f, all))));
  check('Drums: Metall-Entferner senkt Nachklingen um ≥ 4 dB, Gesangs-Obertöne bleiben (±0,3 dB)', ring >= 4 && voc <= 0.3, 'Nachklingen −' + ring.toFixed(1) + ' dB, Gesang ±' + voc.toFixed(2) + ' dB, gefunden: ' + r.report.metalFreqs.join(', ') + ' Hz');
  const lowE = (y, wins) => { let e = 0; const lp = y; for (const [a, b] of wins) for (let i = Math.round(a * x.sr); i < Math.round(b * x.sr); i++) e += lp[i] * lp[i]; return 10 * Math.log10(e); };
  for (const sign of [1, -1]) { const y = sign === 1 ? x : drumMix(96, 12, -1), dy = sign === 1 ? d : D.drumDetect(y.L, y.R, y.sr, { sens: 0.5, beats: g.beats }), ry = D.drumRepair(y.L, y.R, y.sr, { det: dy, kick: { on: true, amt: 0.5 } }), kw = y.kicks.map(t => [t, t + 0.08]);
    const gain = lowE(ry.L, kw) - lowE(y.L, kw); check('Drums: Kick unterlegen verstärkt statt auszulöschen (Polarität ' + (sign > 0 ? 'normal' : 'gedreht') + ')', gain > 1.5 && gain < 6, '+' + gain.toFixed(1) + ' dB im Kick-Bereich'); }
  const rr = D.drumRepair(x.L, x.R, x.sr, { det: d, metal: { on: true, amt: 1 }, sand: { on: true, amt: 1 }, fill: { on: true, amt: 0.5 }, snare: { on: true, amt: 0.5 }, regions: [[3, 5]] });
  let outside = 0; for (let i = 0; i < x.L.length; i++) { const t = i / x.sr; if (t < 2.9 || t > 5.1) outside = Math.max(outside, Math.abs(rr.L[i] - x.L[i])); }
  check('Drums: „Nur Auswahl“ lässt den Rest unverändert', outside === 0, 'max. Abweichung außerhalb ' + outside); }
{ const bandsOf = (x, a, sr) => { const N = 4096, re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = a + i < x.length ? x[a + i] : 0; D.fft(re, im); const out = []; for (let f = 200; f <= 10000; f *= Math.pow(2, 1 / 3)) { let e = 0; for (let k = Math.floor(f / 1.12 * N / sr); k <= Math.ceil(f * 1.12 * N / sr); k++) e += re[k] * re[k] + im[k] * im[k]; out.push(10 * Math.log10(e + 1e-20)); } return out; };
  const dist = (A, B) => { const d = A.map((v, i) => v - B[i]), m = d.reduce((a, b) => a + b, 0) / d.length; return Math.sqrt(d.reduce((a, b) => a + (b - m) * (b - m), 0) / d.length); };
  const sr = 48000, n = sr * 6, src = new Float64Array(n), r = rng(31), pos = [];
  for (let k = 0; k < 10; k++) { const p0 = Math.round((0.3 + k * 0.5) * sr); pos.push(p0); let lp = 0; for (let i = 0; i < sr * 0.2; i++) { const t = i / sr; lp += 0.08 * ((r() * 2) - lp); src[p0 + i] += (0.3 * Math.sin(2 * Math.PI * 230 * t) * Math.exp(-t / 0.05) + 1.2 * lp * Math.exp(-t / 0.08)); } }
  const orig = pos.map(p => bandsOf(src, p, sr)).reduce((a, b) => a.map((v, i) => v + b[i] / pos.length)), sn = D.synthSnare(sr, 230, 0.5, 0.4, 'bright');
  const d0 = dist(bandsOf(sn, 0, sr), orig), d1 = dist(bandsOf(D.toneMatch(sn, src, pos, sr, 150, 12000, 1), 0, sr), orig);
  check('Drums: „An Original angleichen“ bringt den Ersatz-Klang deutlich näher an die Original-Snare (≥ 25 %)', d1 < d0 * 0.75, 'Klangabstand ' + d0.toFixed(1) + ' → ' + d1.toFixed(1) + ' dB'); }
{ const sr = 48000, ok = Object.keys(D.KICKS).every(id => { const x = D.synthKick(sr, 52, 0.4, id); return x.length > 1000 && x.every(Number.isFinite) && Math.max(...x.map(Math.abs)) > 0.99; }) && Object.keys(D.SNARES).every(id => { const x = D.synthSnare(sr, 200, 0.5, 0.4, id); return x.length > 1000 && x.every(Number.isFinite); });
  check('Drums: Klangbibliothek (' + Object.keys(D.KICKS).length + ' Kicks, ' + Object.keys(D.SNARES).length + ' Snares) erzeugt gültige Klänge', ok, Object.keys(D.KICKS).join(', ') + ' / ' + Object.keys(D.SNARES).join(', ')); }
{ const n = 48000 * 4, L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = 0.3 * Math.sin(2 * Math.PI * 1000 * i / 48000);
  const r = D.drumRepair(L, L.slice(), 48000, { det: { kicks: [], snares: [], hats: [] }, metal: { on: true, amt: 1 }, sand: { on: true, amt: 1 } }); let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(r.L[i] - L[i]));
  check('Drums: Ohne Schläge bleibt ein Ton unverändert (STFT verlustfrei)', m < 1e-5, 'max. Abweichung ' + (20 * Math.log10(m + 1e-12)).toFixed(0) + ' dBFS'); }

/* 11  Eigener Kompressor (DSComp, läuft im AudioWorklet in Echtzeit und Export) */
const compRun = (L, R, o, sr = 48000) => { const c = new D.DSComp(sr); c.set(o); const l = Float32Array.from(L), r = Float32Array.from(R); for (let i = 0; i < l.length; i += 128) c.process(l.subarray(i, i + 128), r.subarray(i, i + 128), Math.min(128, l.length - i)); return { L: l, R: r }; };
const pkDb = (x, a, b) => { let m = 0; for (let i = a; i < b; i++) m = Math.max(m, Math.abs(x[i])); return 20 * Math.log10(m); };
{ const x = sine(48000, 2, 1000, Math.pow(10, -30 / 20)), y = compRun(x.L, x.R, { th: -20, ratio: 4, att: 10, rel: 100, knee: 6 });
  check('Kompressor: Signal unter der Schwelle bleibt bitgenau (kein automatisches Anheben)', y.L.every((v, i) => v === x.L[i]), 'unverändert'); }
for (const [ratio, want] of [[2, -15], [4, -17.5]]) { const x = sine(48000, 3, 1000, Math.pow(10, -10 / 20)), y = compRun(x.L, x.R, { th: -20, ratio, att: 10, rel: 150, knee: 6 }), got = pkDb(y.L, 96000, 144000);
  check('Kompressor: Kennlinie −10 dBFS, Schwelle −20, Ratio ' + ratio + ':1 → ' + String(want).replace('.', ',') + ' dBFS', near(got, want, 0.3), got.toFixed(2) + ' dBFS'); }
{ const n = 48000, L = new Float32Array(n); for (let i = 0; i < n; i++) L[i] = (i < 24000 ? 0.0316 : 0.316) * Math.sin(2 * Math.PI * 1000 * i / 48000);
  const y = compRun(L, L, { th: -20, ratio: 4, att: 20, rel: 150, knee: 0 }), gr = t => pkDb(L, t, t + 480) - pkDb(y.L, t, t + 480), fin = gr(40000), at3 = gr(24000 + 2880);
  check('Kompressor: Attack 20 ms regelt nach 3 Zeitkonstanten zu > 85 % ein', at3 / fin > 0.85 && fin > 7, 'nach 60 ms ' + at3.toFixed(1) + ' von ' + fin.toFixed(1) + ' dB'); }
{ const x = sine(48000, 2, 500, Math.pow(10, -6 / 20)), R = x.L.map(v => v * 0.1), y = compRun(x.L, R, { th: -20, ratio: 3, att: 10, rel: 150, knee: 6 }), gl = pkDb(y.L, 60000, 90000) - pkDb(x.L, 60000, 90000), gr2 = pkDb(y.R, 60000, 90000) - pkDb(R, 60000, 90000);
  check('Kompressor: Stereo gekoppelt (beide Kanäle gleich abgesenkt, Stereobild bleibt)', near(gl, gr2, 0.01) && gl < -5, 'L ' + gl.toFixed(2) + ' dB, R ' + gr2.toFixed(2) + ' dB'); }

{ // Clean Song: stehende Störtöne in rosa Rauschen (Musik-Ersatz) finden und entfernen
  const sr = 48000, x = pink(sr, 12, 0.2, 21), n = x.L.length, L = x.L.slice(), R = x.R.slice();
  for (let i = 0; i < n; i++) { const t = i / sr, a = 0.06 * Math.sin(2 * Math.PI * 3455 * t), b = 0.003 * Math.sin(2 * Math.PI * 9100 * t); L[i] += a + b; R[i] += a - b; }
  const sc0 = D.cleanScan(x.L, x.R, sr), sc = D.cleanScan(L, R, sr), f = sc.lines.map(l => l.f);
  check('Clean Song: ohne Störung keine Störtöne gefunden', sc0.lines.length === 0, sc0.lines.length + ' gefunden');
  check('Clean Song: 3455 Hz (Mitte) und 9100 Hz (Seite) gefunden', f.some(v => Math.abs(v - 3455) < 6) && f.some(v => Math.abs(v - 9100) < 6) && sc.lines.length === 2, f.join(', ') + ' Hz');
  const o = D.cleanSong(L, R, sr, { lines: sc.lines }), amp = (X, Y, fq, side) => { let re = 0, im = 0, c = 0; for (let i = sr; i < n - sr; i++) { const v = side ? (X[i] - Y[i]) / 2 : (X[i] + Y[i]) / 2; re += v * Math.cos(2 * Math.PI * fq * i / sr); im += v * Math.sin(2 * Math.PI * fq * i / sr); c++; } return 2 * Math.hypot(re, im) / c; };
  const d1 = db(amp(L, R, 3455, false) / amp(o.L, o.R, 3455, false)), d2 = db(amp(L, R, 9100, true) / amp(o.L, o.R, 9100, true));
  check('Clean Song: Störtöne um mehr als 15 dB abgesenkt', d1 > 15 && d2 > 15, '3455 Hz −' + d1.toFixed(1) + ' dB, 9100 Hz −' + d2.toFixed(1) + ' dB');
  let e0 = 0, e1 = 0; const sp = (X, a, b) => { const N = 65536, re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < N; i++) re[i] = X[sr * 2 + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); D.fft(re, im); let e = 0; for (let k = Math.round(a * N / sr); k <= Math.round(b * N / sr); k++) e += re[k] * re[k] + im[k] * im[k]; return e; };
  const band = [[200, 3300], [3700, 8800], [9400, 16000]].map(([a, b]) => db(Math.sqrt(sp(o.L, a, b) / sp(L, a, b))));
  check('Clean Song: Musik abseits der Störtöne unverändert (±0,1 dB)', band.every(v => Math.abs(v) < 0.1), band.map(v => v.toFixed(3)).join(' / ') + ' dB');
  const z = D.cleanSong(L, R, sr, { lines: [], carpet: 0 }); let md = 0; for (let i = 0; i < n; i++) md = Math.max(md, Math.abs(z.L[i] - L[i]));
  check('Clean Song: nichts ausgewählt = bitgenau unverändert', md === 0, String(md));
}
{ // Hör-Vergleich (Näherung an PEAQ/ViSQOL)
  const sr = 48000, x = pink(sr, 12, 0.25, 31), n = x.L.length;
  const same = D.hearCompare(x.L, x.R, x.L.slice(), x.R.slice(), sr, {});
  check('Hör-Vergleich: identische Fassungen = 5,0', same.mos > 4.99 && same.relDist === 0, same.mos.toFixed(2));
  // tonale Musik (Akkorde) + Rauschen 30 dB darunter: in Pausen und zwischen den Tönen hörbar
  const tL = new Float32Array(n), tR = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr, f0 = [220, 247, 196, 262][Math.floor(t / 1.5) % 4]; tL[i] = tR[i] = 0.25 * (Math.sin(2 * Math.PI * f0 * t) + 0.5 * Math.sin(2 * Math.PI * f0 * 2.01 * t) + 0.3 * Math.sin(2 * Math.PI * f0 * 3 * t)) * (0.55 + 0.45 * Math.cos(2 * Math.PI * t / 1.5)); }
  const r = rng(77), nL = tL.slice(), nR = tR.slice(); let e = 0; for (let i = 0; i < n; i++) e += tL[i] * tL[i]; const a = Math.sqrt(e / n) * Math.pow(10, -30 / 20) * 3.46;
  for (let i = 0; i < n; i++) { nL[i] += a * r(); nR[i] += a * r(); }
  const noisy = D.hearCompare(tL, tR, nL, nR, sr, {}), ok3 = D.hearCompare(tL, tR, tL.slice(), tR.slice(), sr, {});
  check('Hör-Vergleich: Rauschen 30 dB unter tonaler Musik wird als störend erkannt (< 3,5)', noisy.mos < 3.5 && noisy.relDist > 0.2 && ok3.mos > 4.99, noisy.mos.toFixed(2) + ', ' + Math.round(noisy.relDist * 100) + ' % hörbar');
  check('Hör-Vergleich: Rauschen in Rauschen ist verdeckt (rosa Rauschen + weißes −25 dB > 4,5)', (() => { const r2 = rng(78), mL = x.L.slice(), mR = x.R.slice(); let e2 = 0; for (let i = 0; i < n; i++) e2 += x.L[i] * x.L[i]; const a2 = Math.sqrt(e2 / n) * Math.pow(10, -25 / 20) * 3.46; for (let i = 0; i < n; i++) { mL[i] += a2 * r2(); mR[i] += a2 * r2(); } return D.hearCompare(x.L, x.R, mL, mR, sr, {}).mos > 4.5; })(), 'Verdeckung');
  const sh = x.L.slice(), sh2 = x.R.slice(); let p1 = 0, p2 = 0; const c = Math.exp(-2 * Math.PI * 4000 / sr);
  for (let i = 0; i < n; i++) { const hp1 = x.L[i] - p1, hp2 = x.R[i] - p2; p1 = c * p1 + (1 - c) * x.L[i]; p2 = c * p2 + (1 - c) * x.R[i]; sh[i] += hp1; sh2[i] += hp2; }
  const eq = D.hearCompare(x.L, x.R, sh, sh2, sr, {}), hi = eq.eqDb.slice(26).reduce((s2, v) => s2 + v, 0) / 6;
  check('Hör-Vergleich: reine EQ-Änderung wird als Klangfarbe gemeldet, nicht als Störung', eq.mos > 4.7 && hi > 2, 'Zahl ' + eq.mos.toFixed(2) + ', Höhen ' + hi.toFixed(1) + ' dB');
  const sft = 960, dL = new Float32Array(n), dR = new Float32Array(n); for (let i = sft; i < n; i++) { dL[i] = x.L[i - sft]; dR[i] = x.R[i - sft]; }
  const lagd = D.hearCompare(x.L, x.R, dL, dR, sr, {});
  check('Hör-Vergleich: zeitlicher Versatz (20 ms) wird ausgeglichen', Math.abs(lagd.lagMs - 20) < 0.1 && lagd.mos > 4.9, lagd.lagMs.toFixed(2) + ' ms, Zahl ' + lagd.mos.toFixed(2));
}
const w = Math.max(...rows.map(r => r[1].length));
console.log('\nDeep Structure Mastering Studio – DSP-Tests (' + path.basename(htmlPath) + ')\n');
for (const [s, n, d] of rows) console.log((s === 'PASS' ? '  ✔ ' : '  ✘ ') + n.padEnd(w) + '  ' + d);
console.log('\n' + pass + ' bestanden, ' + fail + ' fehlgeschlagen\n');
process.exit(fail ? 1 : 0);
