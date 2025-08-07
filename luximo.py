#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Luximmo (BG) map scraper.
1) Тянет JSON с карты (luximmo.bg).
2) Заходит в англоязычные карточки (luximmo.com) и достаёт детали.
3) Результат пишет в data/items.jsonl  (по одной JSON-строке на объект).

Dependencies:
    pip install cloudscraper beautifulsoup4 lxml
"""

import json
import time
import re
import sys
import pathlib
import html as ihtml
from concurrent.futures import ThreadPoolExecutor

import cloudscraper
from bs4 import BeautifulSoup


# --------------------------------------------------------------------------- #
# constants

MAP_BASE  = "https://www.luximmo.bg"       # источник списка (карта)
PAGE_BASE = "https://www.luximmo.com"      # англоязычные карточки

OUT_DIR   = pathlib.Path("data")
DEBUG_DIR = pathlib.Path("debug")
OUT_DIR.mkdir(exist_ok=True)
DEBUG_DIR.mkdir(exist_ok=True)

scraper = cloudscraper.create_scraper()    # Cloudflare bypass
scraper.headers.update({
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/125.0.0.0 Safari/537.36"
})


# --------------------------------------------------------------------------- #
# step 1 – get map JSON

def get_map_json():
    """
    Download map-HTML (`map-advanced.html?ajax=1`) and extract embedded JSON.
    Handles three stable variants + fallback.
    """
    url = (f"{MAP_BASE}/map-advanced.html?ajax=1"
           "&country=bulgaria&lang=en&currency=EUR")
    html_txt = scraper.get(url, timeout=30).text

    # сохраняем сырец для диагностики
    (DEBUG_DIR / "map.html").write_text(html_txt, 'utf-8')

    # 1) data-attribute
    m = re.search(r'data-map-properties\s*=\s*["\']([^"\']+)["\']', html_txt, re.S)
    if m:
        raw = ihtml.unescape(m.group(1))
        return json.loads(raw)

    # 2) window.__INITIAL_DATA__
    m = re.search(r'window\.__INITIAL_DATA__\s*=\s*({.*?});', html_txt, re.S)
    if m:
        blob = json.loads(m.group(1))
        for k in ("propertiesList", "properties", "items"):
            if k in blob and isinstance(blob[k], list):
                return blob[k]

    # 3) <textarea id="propertiesJSON">[…]</textarea>
    m = re.search(r'<textarea[^>]*id=["\']propertiesJSON["\'][^>]*>(.*?)</textarea>',
                  html_txt, re.S)
    if m:
        return json.loads(m.group(1))

    # 4) грубый fallback: ищем массив с "lat"
    pos = html_txt.find('"lat"')
    if pos == -1:
        pos = html_txt.find("'lat'")
    if pos != -1:
        start = html_txt.rfind('[', 0, pos)
        end   = html_txt.find(']', pos) + 1
        try:
            return json.loads(html_txt[start:end])
        except Exception:
            pass

    raise ValueError("property JSON not found – см. debug/map.html для разбора")


# --------------------------------------------------------------------------- #
# step 2 – parse listing page

def parse_listing(url: str) -> dict:
    """Download single listing page and return structured dict."""
    html = scraper.get(url, timeout=30).text
    soup = BeautifulSoup(html, "lxml")

    def text(sel):
        el = soup.select_one(sel)
        return el.get_text(strip=True) if el else None

    item = {
        "url": url,
        "title": text("h1"),
        "price": text(".price strong"),
        "currency": text(".price span:not([class])"),  # avoid nested <span class>
        "location": text('[itemprop="address"]'),
        "area_m2": text("li:contains('Area') span"),
        "bedrooms": text("li:contains('Bedrooms') span"),
        "bathrooms": text("li:contains('Bathrooms') span"),
        "agent": text(".consultant-box .name"),
        "phone": text(".consultant-box .phone"),
        "description": text(".description"),
        "scraped_at": int(time.time()),
    }
    return item


# --------------------------------------------------------------------------- #
# main

def main() -> None:
    items = get_map_json()
    print(f"Map objects: {len(items)}", file=sys.stderr)

    urls = [PAGE_BASE + it["url"] for it in items]

    with ThreadPoolExecutor(max_workers=10) as ex, \
         open(OUT_DIR / "items.jsonl", "w") as f:
        for data in ex.map(parse_listing, urls):
            f.write(json.dumps(data, ensure_ascii=False) + "\n")

    print("Done – data/items.jsonl ready", file=sys.stderr)


if __name__ == "__main__":
    main()
