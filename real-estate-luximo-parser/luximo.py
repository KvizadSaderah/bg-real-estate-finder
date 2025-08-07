#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Luximmo (BG) scraper.

This script does two things:
1) Collects property URLs via the public AJAX endpoint
   (/func/ajax/map_properties_ajax_responsive.php) by paging through results.
2) Visits each English property page on luximmo.com and extracts structured data.

Run with:
    python luximo.py

Output:
    - data/items.jsonl – one JSON object per property (404 pages skipped).
    - debug/map.html   – raw HTML of the first map page (for troubleshooting).
"""

import json
import time
import sys
import re
import pathlib
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Optional

import cloudscraper
from bs4 import BeautifulSoup

# --------------------------------------------------------------------------- #
# constants and paths

MAP_BASE  = "https://www.luximmo.bg"        # map and AJAX endpoints
PAGE_BASE = "https://www.luximmo.com"       # English property pages

OUT_DIR   = pathlib.Path("data")
DEBUG_DIR = pathlib.Path("debug")
OUT_DIR.mkdir(exist_ok=True)
DEBUG_DIR.mkdir(exist_ok=True)

scraper = cloudscraper.create_scraper()     # Cloudflare bypass
scraper.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    )
})

# --------------------------------------------------------------------------- #
# helper function to extract text safely

def _text(el: Optional[BeautifulSoup], selector: str) -> Optional[str]:
    """
    Safely extract stripped text for a CSS selector from a BeautifulSoup node.
    """
    sub = el.select_one(selector) if el else None
    return sub.get_text(strip=True) if sub else None

# --------------------------------------------------------------------------- #
# step 1 – get list of property URLs

def get_map_json(
    country: str = "bulgaria",
    lat1: float = 41.0,
    lat2: float = 44.0,
    lon1: float = 22.0,
    lon2: float = 30.0,
    max_pages: int = 500,
) -> List[Dict[str, str]]:
    """
    Collect property links by iterating the AJAX endpoint page by page.

    The site returns 40 items per page, but many entries are duplicates.
    We track new property IDs to avoid infinite loops. Paging stops when a new
    page yields no new properties or when max_pages is reached.

    Returns a list of dicts with a single key "url" for each unique property.
    """

    base_url = f"{PAGE_BASE}/func/ajax/map_properties_ajax_responsive.php"
    params = {
        "ajax": "1",
        "rwcountry": country,
        "lat1": lat1,
        "lat2": lat2,
        "lon1": lon1,
        "lon2": lon2,
    }

    seen_ids = set()      # track unique property numeric IDs
    items: List[Dict[str, str]] = []

    for page in range(1, max_pages + 1):
        try:
            params["page"] = page
            # progress indicator for list pages
            print(f"Fetching list page {page}...", file=sys.stderr)
            response = scraper.get(base_url, params=params, timeout=30)
            html_txt = response.text
            # Save the first page for debugging, if desired
            if page == 1:
                (DEBUG_DIR / "map.html").write_text(html_txt, "utf-8")

            # Parse all <a> tags that look like property links
            soup = BeautifulSoup(html_txt, "lxml")
            links = [
                a["href"]
                for a in soup.find_all("a", href=True)
                if "luximmo.com" in a["href"]
            ]

            new_count = 0
            for link in links:
                # Normalize URL and extract ID
                url = link.replace("//", "/").replace("https:/", "https://")
                id_match = re.search(r"-(\d+)-", url) or re.search(r"-(\d+)\.", url)
                if not id_match:
                    continue
                pid = id_match.group(1)
                if pid not in seen_ids:
                    seen_ids.add(pid)
                    items.append({"url": url})
                    new_count += 1

            # print running total after each page
            print(
                f"Found {len(items)} unique URLs so far (page {page}, +{new_count} new).",
                file=sys.stderr,
            )

            # Stop paging if no new properties were found on this page
            if new_count == 0:
                break
        except KeyboardInterrupt:
            # break on Ctrl+C without losing collected data
            print(
                "Page fetching interrupted by user – returning collected URLs.",
                file=sys.stderr,
            )
            break

    return items

# --------------------------------------------------------------------------- #
# step 2 – parse individual property pages

def parse_listing(url: str) -> Optional[Dict[str, Optional[str]]]:
    """
    Download and parse a single property page.

    Extracts common fields such as title, price, currency, location, area,
    bedrooms, bathrooms, agent name, phone and description. Missing fields
    are returned as None.

    Returns None if the page is a 404 ("The page has not been found").
    """
    html_txt = scraper.get(url, timeout=30).text
    soup = BeautifulSoup(html_txt, "lxml")

    # Skip pages that show "not found" messages (English/Bulgarian).
    title_tag = soup.find("title")
    if title_tag:
        title_str = title_tag.get_text().strip().lower()
        if "the page has not been found" in title_str \
           or "страницата не е намерена" in title_str:
            return None

    return {
        "url": url,
        "title": _text(soup, "h1"),
        "price": _text(soup, ".price strong"),
        "currency": _text(soup, ".price span:not([class])"),
        "location": _text(soup, "[itemprop='address']"),
        # Use :-soup-contains to avoid FutureWarning from soupsieve
        "area_m2": _text(soup, "li:-soup-contains('Area') span"),
        "bedrooms": _text(soup, "li:-soup-contains('Bedrooms') span"),
        "bathrooms": _text(soup, "li:-soup-contains('Bathrooms') span"),
        "agent": _text(soup, ".consultant-box .name"),
        "phone": _text(soup, ".consultant-box .phone"),
        "description": _text(soup, ".description"),
        "scraped_at": int(time.time()),
    }

# --------------------------------------------------------------------------- #
# main entry point

def main() -> None:
    """
    Orchestrates the scraping:
    1) Get all property URLs via map AJAX.
    2) Visit each URL concurrently and write to JSON lines,
       skipping pages that return 404.
    """
    try:
        # Step 1: gather property URLs
        items = get_map_json()
        print(f"Collected {len(items)} unique property URLs.", file=sys.stderr)
    except KeyboardInterrupt:
        # In case of interrupt during URL collection
        print("\nInterrupted during URL collection.", file=sys.stderr)
        return

    # Step 2: fetch details for each property
    urls = [item["url"] for item in items]
    total = len(urls)

    processed = 0
    try:
        with ThreadPoolExecutor(max_workers=10) as ex, \
             open(OUT_DIR / "items.jsonl", "w") as f:
            for data in ex.map(parse_listing, urls):
                processed += 1
                # progress indicator for detail pages
                if processed % 20 == 0 or processed == total:
                    print(f"Processed {processed}/{total} listings...", file=sys.stderr)
                if data is None:
                    continue  # skip 404 pages
                f.write(json.dumps(data, ensure_ascii=False) + "\n")
    except KeyboardInterrupt:
        print("\nInterrupted during detail scraping.", file=sys.stderr)

    print("Done – data/items.jsonl created.", file=sys.stderr)

# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    main()
