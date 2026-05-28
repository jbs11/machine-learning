import os, re
website = os.path.dirname(os.path.abspath(__file__))
nav_line = '    <li><a href="treasury-yields.html" style="color:#fbbf24;font-weight:700;">&#128176; Treasury Yields</a></li>\n'
pat = re.compile(r'(SPX Correlations</a></li>\s*\n)(\s*<li><a href="vix-dashboard\.html")')
chip_pat = re.compile(r'(<a class="ql-chip" href="spx-correlations\.html">[^<]+</a>\s*\n)')
footer_pat = re.compile(r'(<a href="gex-profile\.html">GEX Profile[^<]*</a>\s*\|\s*\n)')
updated = []
for fn in os.listdir(website):
    if not fn.endswith('.html') or fn.startswith('_'):
        continue
    path = os.path.join(website, fn)
    with open(path, encoding='utf-8') as f:
        c = f.read()
    orig = c
    if 'treasury-yields.html' not in c and 'SPX Correlations</a></li>' in c:
        c, _ = pat.subn(r'\1' + nav_line + r'\2', c, count=1)
    if fn == 'summaries.html' and 'ql-chip" href="treasury-yields' not in c:
        c, _ = chip_pat.subn(r'\1    <a class="ql-chip" href="treasury-yields.html">&#128176; Treasury Yields</a>\n', c, count=1)
    if 'gex-profile.html">GEX Profile' in c and 'treasury-yields.html">Treasury' not in c:
        c, _ = footer_pat.subn(r'\1  <a href="treasury-yields.html">Treasury Yields &#128176;</a> |\n', c, count=1)
    if fn in ('live-flow.html', 'greeks.html') and 'treasury-yields' not in c:
        c = c.replace(
            '<li><a href="gamma-exposure.html">GEX</a></li>\n',
            '<li><a href="gamma-exposure.html">GEX</a></li>\n    <li><a href="treasury-yields.html" style="color:#fbbf24;font-weight:700;">&#128176; Treasury</a></li>\n',
            1,
        )
    if fn == 'trade-journal.html' and 'treasury-yields' not in c:
        c = re.sub(
            r'(<li><a href="spx-hub\.html"[^>]*>[^<]+</a></li>\s*\n)',
            r'\1    <li><a href="treasury-yields.html" style="color:#fbbf24;font-weight:700;">&#128176; Treasury Yields</a></li>\n',
            c,
            count=1,
        )
    if fn == 'spx-hub.html' and 'treasury-yields.html" style="color:#fbbf24' not in c:
        c, _ = pat.subn(r'\1' + nav_line + r'\2', c, count=1)
    if c != orig:
        with open(path, 'w', encoding='utf-8', newline='') as f:
            f.write(c)
        updated.append(fn)
print('Updated', len(updated), 'files')
for u in sorted(updated):
    print(u)
