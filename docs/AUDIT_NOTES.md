Audit Notes: Financial Data, Math, and SEC Sources

Scope
- Ensures valuation math and extraction are accurate, reproducible, and verifiable.
- Uses two sources: (1) unstructured MD&A extraction with citations, and (2) structured SEC XBRL companyfacts.

Valuation Math (verified by tests)
- WACC = E/V×(Rf+β×MRP) + D/V×Rd×(1−T)
- EPV = (EBITDA − maintenance capex) × (1 − tax) × (1 − reinvestment) / WACC
- DCF: 5-year FCFF projection + Gordon terminal value (guard if WACC ≤ g)
- ROIC = NOPAT / (Net Debt + Shareholder Equity)
Tests: `tests/test_valuation.py` assert equality to derived values.

SEC Data Sources
- Filings/MD&A: `edgar_client.py` (submissions JSON + filing HTML), extracted KPIs via regex (`extract.py`) with page-level context.
- XBRL companyfacts: `xbrl_client.py` fetches standardized facts and parses core metrics in millions (USD), including EBITDA proxy.

Normalization & Units
- All text-extracted values normalized to millions; scale detection converts “billion”→×1000.
- Currency per issuer mapping (CAD for TSX:PPL, USD for US issuers). XBRL values are USD and converted to millions.

Reproducibility
- Run tests: `PYTHONPATH=energy-ic-copilot python3 -m pytest -q` (all pass)
- Live MD&A update: `python3 energy-ic-copilot/scripts/update_sec_data.py --companies KMI --output data --force`
- Structured XBRL metrics: API `GET /xbrl/{ticker}` or programmatic via `SECDataManager.get_latest_financials_xbrl`.

Known Limits
- Maintenance capex not reported in XBRL; sourced from MD&A.
- Adjusted EBITDA is non-GAAP; XBRL provides a GAAP proxy (Operating Income + D&A). Use MD&A patterns for Adjusted EBITDA when available.
- KPI recall depends on ticker-specific patterns; expanded for KMI/OKE/WMB/ET/TRGP.

Manual Verification Pointers
- Submissions JSON: `https://data.sec.gov/submissions/CIK{CIK_10d}.json`
- Filing doc: `https://www.sec.gov/Archives/edgar/data/{cik_numeric}/{accession_wo_dashes}/{primary_document}`
- XBRL companyfacts: `https://data.sec.gov/api/xbrl/companyfacts/CIK{CIK_10d}.json`

