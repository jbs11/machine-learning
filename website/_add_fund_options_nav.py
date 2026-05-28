"""Add fundamentals-options-dashboard.html link to every ML website HTML page."""
import os
import re

website = os.path.dirname(os.path.abspath(__file__))

PAGE_NAV_LINK = (
    '  <span class="page-nav-sep">|</span>\n'
    '  <a href="fundamentals-options-dashboard.html" style="color:#22d3ee;font-weight:700;">'
    '&#128200; Fund + Options</a>\n'
)
NAV_LI_LINK = (
    '    <li><a href="fundamentals-options-dashboard.html" style="color:#22d3ee;font-weight:700;">'
    '&#128200; Fund + Options</a></li>\n'
)
REPORT_TAB_LINK = (
    '  <a href="fundamentals-options-dashboard.html" style="color:#22d3ee;font-weight:700;'
    'font-size:.82rem;text-decoration:none;">&#128200; Fund + Options Dashboard</a>\n'
)


def add_links(content: str, filename: str) -> tuple[str, bool]:
    if "fundamentals-options-dashboard.html" in content:
        return content, False

    changed = False
    c = content

    pat_after_fund = re.compile(
        r'(<a href="fundamentals\.html"[^>]*>Fundamentals[^<]*</a>\s*\n)'
        r"(?!\s*<a href=\"fundamentals-options-dashboard)",
    )
    c2, n = pat_after_fund.subn(r"\1" + PAGE_NAV_LINK, c, count=1)
    if n:
        c, changed = c2, True

    pat_live = re.compile(
        r'(<li><a href="live-trading\.html"[^>]*>[^<]*</a></li>\s*\n)'
        r"(?!\s*<li><a href=\"fundamentals-options-dashboard)",
    )
    c2, n = pat_live.subn(r"\1" + NAV_LI_LINK, c, count=1)
    if n:
        c, changed = c2, True

    if "fundamentals-options-dashboard.html" not in c:
        pat_asset = re.compile(
            r'(<li><a href="asset-details\.html"[^>]*>[^<]*</a></li>\s*\n)'
            r"(?!\s*<li><a href=\"fundamentals-options-dashboard)",
        )
        c2, n = pat_asset.subn(r"\1" + NAV_LI_LINK, c, count=1)
        if n:
            c, changed = c2, True

    if "fundamentals-options-dashboard.html" not in c and '<ul class="nav-links">' in c:

        def nav_links_repl(match: re.Match) -> str:
            body = match.group(1)
            if "fundamentals-options-dashboard" in body:
                return match.group(0)
            return body + NAV_LI_LINK + match.group(2)

        c2, n = re.subn(
            r"(<ul class=\"nav-links\">)(.*?)(  </ul>\s*\n</nav>)",
            nav_links_repl,
            c,
            count=1,
            flags=re.DOTALL,
        )
        if n and "fundamentals-options-dashboard.html" in c2:
            c, changed = c2, True

    if "fundamentals-options-dashboard.html" not in c and 'class="page-nav"' in c:

        def page_nav_repl(match: re.Match) -> str:
            body = match.group(2)
            if "fundamentals-options-dashboard" in body:
                return match.group(0)
            return match.group(1) + body + PAGE_NAV_LINK + match.group(3)

        c2, n = re.subn(
            r"(<nav class=\"page-nav\">)(.*?)(</nav>)",
            page_nav_repl,
            c,
            count=1,
            flags=re.DOTALL,
        )
        if n and "fundamentals-options-dashboard.html" in c2:
            c, changed = c2, True

    if filename == "summaries.html" and 'ql-chip" href="fundamentals-options-dashboard' not in c:
        chip_pat = re.compile(r'(<a class="ql-chip" href="fundamentals\.html">[^<]+</a>\s*\n)')
        c2, n = chip_pat.subn(
            r"\1"
            '    <a class="ql-chip" href="fundamentals-options-dashboard.html">'
            "&#128200; Fund + Options</a>\n",
            c,
            count=1,
        )
        if n:
            c, changed = c2, True

    if filename in ("report.html", "report-ms.html", "report-tg.html"):
        if 'id="rpt-tabs"' in c:
            c2, n = re.subn(
                r"(<div id=\"rpt-tabs\">\s*\n)",
                r"\1" + REPORT_TAB_LINK,
                c,
                count=1,
            )
            if n:
                c, changed = c2, True
        elif 'id="rpt-loading"' in c:
            c2, n = re.subn(
                r'(<div id="rpt-loading">\s*\n)',
                r'\1  <p style="margin-bottom:.5rem;">'
                r'<a href="fundamentals-options-dashboard.html" style="color:#22d3ee;">'
                r"&#128200; Fund + Options Dashboard</a></p>\n",
                c,
                count=1,
            )
            if n:
                c, changed = c2, True

    return c, changed


def main() -> None:
    updated: list[str] = []
    missing: list[str] = []

    for fn in sorted(os.listdir(website)):
        if not fn.endswith(".html") or fn.startswith("_"):
            continue
        path = os.path.join(website, fn)
        with open(path, encoding="utf-8") as f:
            original = f.read()

        new_content, did_change = add_links(original, fn)
        if did_change:
            with open(path, "w", encoding="utf-8", newline="") as f:
                f.write(new_content)
            updated.append(fn)

        with open(path, encoding="utf-8") as f:
            final = f.read()
        if "fundamentals-options-dashboard.html" not in final and fn != "fundamentals-options-dashboard.html":
            missing.append(fn)

    print("Updated", len(updated), "files")
    for name in updated:
        print(" ", name)
    if missing:
        print("Still missing link:", len(missing))
        for name in missing:
            print(" ", name)


if __name__ == "__main__":
    main()
