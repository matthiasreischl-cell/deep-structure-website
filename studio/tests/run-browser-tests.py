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
        await b.close()
    srv.shutdown(); sys.exit(1 if r['fail'] else 0)

asyncio.run(main())
