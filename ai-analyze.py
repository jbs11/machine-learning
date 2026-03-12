#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ai-analyze.py — ML Trading Dashboard AI code analysis tool.

Model  : claude-haiku-4-5-20251001 (fast, low cost)
Caching: prompt caching on large file content (saves ~90% on repeated runs)
Usage  : py ai-analyze.py [question]
         py ai-analyze.py "why are charts not rendering?"
         py ai-analyze.py "fix the report loading"
"""
import os, re, json, sys
import anthropic

# Fix Windows console UTF-8 output
sys.stdout.reconfigure(encoding='utf-8')

# ── Config ────────────────────────────────────────────────────────────────────
API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL   = "claude-haiku-4-5-20251001"
WEBSITE = os.path.join(os.path.dirname(__file__), 'website')
SERVER  = os.path.join(os.path.dirname(__file__), 'live-server.py')

client = anthropic.Anthropic(api_key=API_KEY)

# ── Read project files ────────────────────────────────────────────────────────
def read(path, max_chars=40000):
    try:
        with open(path, encoding='utf-8') as f:
            content = f.read()
        return content[:max_chars] if len(content) > max_chars else content
    except FileNotFoundError:
        return f'[File not found: {path}]'

def read_server_routes(path, max_chars=8000):
    """Extract just the API route definitions to keep tokens low."""
    src = read(path, max_chars=200000)
    routes = re.findall(r'@app\.route\(.*?(?=@app\.route|\Z)', src, re.DOTALL)
    return ''.join(routes)[:max_chars]

# Build the large cached content block
ms_html       = read(os.path.join(WEBSITE, 'report-ms.html'))
tg_html       = read(os.path.join(WEBSITE, 'report-tg.html'))
rpt_html      = read(os.path.join(WEBSITE, 'report.html'))
server_routes = read_server_routes(SERVER)

CACHED_CONTEXT = f"""=== report-ms.html ===
{ms_html}

=== report-tg.html ===
{tg_html}

=== report.html ===
{rpt_html}

=== live-server.py API routes ===
{server_routes}
"""

# ── System prompt (cached) ────────────────────────────────────────────────────
SYSTEM = """You are an expert debugger for a Flask + HTML/JS ML trading dashboard.

Key facts:
- Flask server on port 3000, serving static files from website/ and API endpoints
- API responses: gamma-exposure and option-flows return {assets:[...]} (NOT etfs/futures/flows)
- Charts must be drawn AFTER body is visible (display:block) — clientWidth=0 when hidden
- 'use strict' mode — all variables must be declared with let/const/var
- API timeout: 60 seconds (market-summary takes 17-28s cold)
- Report pages: report-ms.html (Market Summary), report-tg.html (Trading Guide), report.html (tabbed)

When providing fixes, format them as a JSON array:
[{"file": "filename", "old": "exact string to replace", "new": "replacement string"}]

Be concise. Only fix real bugs."""

# ── Main ──────────────────────────────────────────────────────────────────────
def analyze(question: str):
    print(f"Model   : {MODEL}")
    print(f"Caching : enabled (system prompt + file content cached for 5 min)")
    print(f"Question: {question}\n")

    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": SYSTEM,
                "cache_control": {"type": "ephemeral"}       # cache system prompt
            }
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": CACHED_CONTEXT,
                        "cache_control": {"type": "ephemeral"}  # cache large file context
                    },
                    {
                        "type": "text",
                        "text": question
                    }
                ]
            }
        ]
    )

    text  = response.content[0].text
    usage = response.usage

    print("=== RESPONSE ===")
    print(text)

    # Token usage + cache savings
    print("\n=== TOKEN USAGE ===")
    print(f"  Input tokens       : {usage.input_tokens:,}")
    print(f"  Output tokens      : {usage.output_tokens:,}")
    cache_write = getattr(usage, 'cache_creation_input_tokens', 0)
    cache_read  = getattr(usage, 'cache_read_input_tokens', 0)
    if cache_write:
        print(f"  Cache write tokens : {cache_write:,}  (one-time cost)")
    if cache_read:
        print(f"  Cache read tokens  : {cache_read:,}  (90% cheaper than normal)")
        saved_pct = int(cache_read / max(usage.input_tokens + cache_read, 1) * 90)
        print(f"  Estimated savings  : ~{saved_pct}% cost reduction vs no caching")

    # Extract and apply fixes if present
    json_match = re.search(r'```json\s*(\[.*?\])\s*```', text, re.DOTALL)
    if json_match:
        fixes = json.loads(json_match.group(1))
        print(f"\n=== {len(fixes)} FIX(ES) FOUND ===")
        apply = input("Apply fixes? (y/n): ").strip().lower()
        if apply == 'y':
            file_map = {
                'report-ms.html': os.path.join(WEBSITE, 'report-ms.html'),
                'report-tg.html': os.path.join(WEBSITE, 'report-tg.html'),
                'report.html':    os.path.join(WEBSITE, 'report.html'),
                'live-server.py': SERVER,
            }
            contents = {}
            for k, v in file_map.items():
                try:
                    with open(v, encoding='utf-8') as f:
                        contents[k] = f.read()
                except Exception:
                    pass

            applied = 0
            for fix in fixes:
                fname = fix.get('file', '')
                old   = fix.get('old', '')
                new   = fix.get('new', '')
                if fname in contents and old in contents[fname]:
                    contents[fname] = contents[fname].replace(old, new, 1)
                    print(f"  APPLIED [{fname}]: {repr(old[:70])}")
                    applied += 1
                else:
                    print(f"  SKIP    [{fname}]: not found — {repr(old[:70])}")

            for fname, path in file_map.items():
                if fname in contents:
                    with open(path, 'w', encoding='utf-8') as f:
                        f.write(contents[fname])
            print(f"\nApplied {applied}/{len(fixes)} fixes.")

    return text

if __name__ == '__main__':
    question = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else \
        "Review all three report pages and identify any remaining bugs with data loading, chart rendering, or JS errors."
    analyze(question)
