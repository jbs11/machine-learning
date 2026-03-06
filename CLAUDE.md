# ML Trading Dashboard — Claude Code Instructions

## Project Overview
Live ML trading dashboard with Flask backend serving a 22-page HTML website.
Real-time market data via yfinance (IBKR when connected), ML signals, GEX, option flows, PDF reports.

## Server
- **Start**: `py live-server.py`
- **Port**: 3000
- **URL**: http://localhost:3000/live-trading.html
- Flask serves both static HTML (`website/`) and all API endpoints
- IBKR optional — falls back to yfinance automatically (15-20 min delayed)

## Key Files
- `live-server.py` — Flask server, all 6 API endpoints, IBKR integration
- `website/` — 22 HTML dashboard pages + report pages
- `website/live-trading.html` — main dashboard entry point
- `website/report-ms.html` — standalone Market Summary Report (PDF-printable)
- `website/report-tg.html` — standalone Trading Guide Report (PDF-printable)
- `website/report.html` — combined report with two tabs
- `website/style.css` — shared styles
- `website/ibkr-widget.js` — IBKR connection widget (shared across pages)
- `website/search.js` — in-page search widget (shared across pages)

## API Endpoints (all GET unless noted)
| Endpoint | Response keys |
|---|---|
| `/api/market-summary` | `market_direction`, `sentiment`, `ml_ranking`, `by_group`, `top_activity`, `top_magnitude`, `world_events` |
| `/api/gamma-exposure` | `assets[]` (each: `symbol`, `strikes[]`, `gex[]`, `spot`, `gamma_wall`, `put_wall`, `flip_level`, `regime`) |
| `/api/option-flows` | `assets[]` (each: `symbol`, `strikes[]`, `call_vol[]`, `put_vol[]`, `call_prem_k[]`, `put_prem_k[]`, `flow_sentiment`, `spot`) |
| `/api/options-strategy` | strategy data |
| `/api/0dte` | 0DTE trade data |
| `/api/fundamentals` | fundamental data per asset |
| `/api/health` | server health check |

## Important: File Editing
- Use Python scripts written to `C:/tmp/` and run with `py "C:/tmp/script.py"` for all HTML edits
- The Edit tool fails on Windows paths with spaces — always use the Python script approach
- Run scripts: `py "C:/tmp/script.py"` (not `python` or `py /tmp/...`)

## Report Pages — Known Architecture
- `report-ms.html`: 6 API fetch → render sections → show body → `requestAnimationFrame` draws charts
- Charts use `gex.assets[]` (not `gex.etfs`/`gex.futures`) and `flows.assets[]` (not `flows.flows`)
- GEX chart: `drawGexChartReport(asset, canvas, height)` — requires `asset.strikes[]` and `asset.gex[]`
- Tornado chart: `drawTornadoReport(asset, canvas, height)` — requires `asset.strikes[]`, `asset.call_vol[]`, `asset.put_vol[]`
- Charts MUST be drawn after body is visible (`display:block`) — otherwise `clientWidth=0`
- `'use strict'` mode is active — all variables must be declared with `let`/`const`/`var`

## Development Workflow
1. Start server: `py live-server.py` (port 3000)
2. Open Chrome: `start chrome "http://localhost:3000/live-trading.html"`
3. Kill server: `taskkill //F //IM python.exe`
4. Clear Chrome cache: delete `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache`
5. Flask sends `no-cache` headers for HTML/JS — browser always fetches fresh files

## Nav Structure
- All 22 pages have two report buttons in the top nav:
  - `📊 Market Report` (cyan) → `report-ms.html`
  - `📖 Trading Guide` (purple) → `report-tg.html`
- Three nav structural patterns exist across pages (see `fix_skipped_navs.py` history)

## Git / GitHub
- Remote: `https://github.com/jbs11/machine-learning.git`
- Branch: `master`
- Commit and push after significant changes

## Anthropic API
- Model IDs: `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`
- Extended thinking: `thinking={"type": "adaptive"}` (not "enabled" — deprecated)
- SDK: `anthropic` Python package (installed)
