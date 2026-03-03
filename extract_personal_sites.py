#!/usr/bin/env python3

import argparse
import csv
import re
from pathlib import Path
from urllib.parse import urlparse

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
HN_HTML_DIR = PIPELINE_ROOT / "fetch" / "hn" / "sites" / "hn"
OUTPUTS_DIR = Path(__file__).resolve().parent / "outputs"
PERSONAL_SITES_TXT = OUTPUTS_DIR / "hn_personal_sites.txt"
PERSONAL_SITES_CSV = OUTPUTS_DIR / "hn_personal.csv"

HREF_RE = re.compile(r'href\s*=\s*["\']([^"\']+)["\']')

EXCLUDE_DOMAINS = {
    "news.ycombinator.com", "hn.algolia.com",
    "github.com", "youtube.com", "youtu.be",
    "google.com", "chrome.google.com", "play.google.com",
    "web.archive.org", "archive.org",
    "twitter.com", "x.com", "facebook.com", "linkedin.com",
    "medium.com", "substack.com", "wordpress.com",
    "amazon.com", "wikipedia.org", "wikimedia.org",
    "reddit.com", "stackoverflow.com", "npmjs.com",
    "paste.maxleiter.com", "pastebin.com",
    "browserstack.com", "holloway.com",
    "openocd.org", "tcl-lang.org", "indieweb.org",
}


def extract_urls(html: str) -> list[str]:
    return HREF_RE.findall(html)


def is_personal_site(url: str) -> bool:
    if not url.startswith(("http://", "https://")):
        return False
    try:
        parsed = urlparse(url)
        host = parsed.netloc.lower().lstrip("www.")
        if not host or host in EXCLUDE_DOMAINS:
            return False
        for excl in EXCLUDE_DOMAINS:
            if host == excl or host.endswith("." + excl):
                return False
        return True
    except Exception:
        return False


def root_url(url: str) -> str:
    parsed = urlparse(url)
    netloc = parsed.netloc.lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return f"{parsed.scheme}://{netloc}"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--html-dir", type=Path, default=HN_HTML_DIR, help="Directory containing HN HTML files")
    parser.add_argument("--out-csv", type=Path, default=PERSONAL_SITES_CSV, help="Output CSV path")
    args = parser.parse_args()

    html_dir = args.html_dir
    if not html_dir.exists():
        raise SystemExit(f"HTML dir not found: {html_dir}")

    urls = []
    html_files = sorted(html_dir.glob("*.html"))
    for path in html_files:
        try:
            html = path.read_text(encoding="utf-8", errors="replace")
            urls.extend(extract_urls(html))
        except Exception as e:
            print(f"Error reading {path}: {e}")

    personal = [u for u in urls if is_personal_site(u)]
    roots = {root_url(u) for u in personal}
    result = sorted(roots, key=lambda x: urlparse(x).netloc.lower())

    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    PERSONAL_SITES_TXT.write_text("\n".join(result), encoding="utf-8")
    with open(args.out_csv, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["url"])
        for u in result:
            writer.writerow([u])

    print(f"Extracted {len(result)} unique personal sites from {len(html_files)} files", flush=True)
    print(f"Wrote {PERSONAL_SITES_TXT} and {args.out_csv}", flush=True)


if __name__ == "__main__":
    main()
