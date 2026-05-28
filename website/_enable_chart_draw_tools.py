#!/usr/bin/env py
"""Ensure chart-draw-tools.js?v=6 is loaded on dashboard pages."""
from __future__ import annotations

import re
from pathlib import Path

WEB = Path(__file__).resolve().parent
CDT = '<script src="chart-draw-tools.js?v=6"></script>'
LWC = '<script src="lightweight-charts.min.js"></script>'

TARGETS = [
    "gex-profile.html",
    "spx-hub.html",
    "summaries.html",
    "vix-dashboard.html",
    "forecast.html",
    "the-edge.html",
    "option-flows.html",
    "greeks.html",
    "live-flow.html",
    "asset-details.html",
    "fundamentals-options-dashboard.html",
    "trade-journal.html",
]

CDT_RE = re.compile(r'<script\s+src="chart-draw-tools\.js[^"]*"></script>', re.I)


def ensure_cdt(text: str) -> tuple[str, bool]:
    if CDT_RE.search(text):
        new = CDT_RE.sub(CDT, text)
        return new, new != text
    if LWC in text:
        return text.replace(LWC, LWC + "\n  " + CDT, 1), True
    if "</head>" in text:
        return text.replace("</head>", "  " + CDT + "\n</head>", 1), True
    return text, False


def main() -> None:
    changed = []
    for name in TARGETS:
        path = WEB / name
        if not path.is_file():
            print("skip missing", name)
            continue
        raw = path.read_text(encoding="utf-8")
        new, ok = ensure_cdt(raw)
        if ok and new != raw:
            path.write_text(new, encoding="utf-8")
            changed.append(name)
            print("updated", name)
        else:
            print("ok", name)
    print("done:", len(changed), "files")


if __name__ == "__main__":
    main()
