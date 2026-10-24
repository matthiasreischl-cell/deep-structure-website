#!/usr/bin/env python3
"""Startet die Integrationstests (tests/index.html) automatisch in Chromium.
Voraussetzung: Python 3 + Playwright (pip install playwright && playwright install chromium).
Aufruf aus dem Ordner studio/:  python3 tests/run-browser-tests.py
"""
import asyncio, http.server, threading, functools, os, sys, json
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../studio

def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=os.path.dirname(ROOT))
    h.log_message = lambda *a: None
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

async def main():
    srv = serve(); port = srv.server_address[1]; base = os.path.basename(ROOT)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'http://127.0.0.1:{port}/{base}/tests/index.html#auto')
        await pg.wait_for_function('window.__results', timeout=900000)
        r = await pg.evaluate('window.__results')
        for s, n, d in r['rows']: print(('  ✔ ' if s == 'PASS' else '  ✘ ') + n + '   ' + d)
        print(f"\n{r['pass']} bestanden, {r['fail']} fehlgeschlagen")
        if errs: print('Seitenfehler:', errs)
        fail = r['fail']
        # PC-Fassung wie unter Windows direkt aus der Datei (file://) öffnen: Audio-Module müssen ohne Warnung laden.
        desk = os.path.join(ROOT, 'desktop', 'Deep Structure Mastering Studio.html')
        if os.path.exists(desk):
            dp = await b.new_page(); warns = []
            dp.on('console', lambda m: warns.append(m.text) if m.type in ('warning', 'error') and 'ERR_' not in m.text else None)
            dp.on('pageerror', lambda e: warns.append(str(e)))
            await dp.goto('file://' + desk.replace(' ', '%20'))
            await dp.wait_for_function('typeof S !== "undefined" && S.master && !S.measuring', timeout=120000)
            st = await dp.evaluate('({ ok: S.workletOK, url: workletUrlOK, ver: document.querySelector(".brand .ver").textContent })')
            for n, ok, d in [('PC-Fassung (file://): Audio-Module geladen, data: zuerst', st['ok'] and st['url'] == 1, json.dumps(st)),
                             ('PC-Fassung (file://): keine Warnungen beim Start', not warns, '; '.join(warns)[:200] or 'keine')]:
                print(('  ✔ ' if ok else '  ✘ ') + n + '   ' + d); fail += 0 if ok else 1
            print(f"PC-Fassung: {'bestanden' if fail == r['fail'] else 'fehlgeschlagen'}")
        await b.close()
    srv.shutdown(); sys.exit(1 if fail else 0)

asyncio.run(main())
