"""
SEC XBRL Company Facts client and parser.

Fetches standardized financial facts from SEC "companyfacts" API and parses
core metrics into a normalized structure (in millions, where applicable).

Notes:
- EBITDA is approximated as OperatingIncomeLoss + DepreciationDepletionAndAmortization
  (a common proxy). Non-GAAP reported EBITDA isn't standardized in XBRL.
- Net Debt is computed as Total Debt (current + long-term) minus cash & equivalents.
- Maintenance capex is not available in XBRL; caller should source separately.
"""

from __future__ import annotations

import requests
from typing import Any, Dict, List, Optional, Tuple
from datetime import datetime


class XBRLClient:
    BASE_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"

    def __init__(self, user_agent: str = "EnergyICCopilot/1.0 (admin@energyiccopilot.com)"):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": user_agent,
            "Accept-Encoding": "gzip, deflate",
        })

    def _get(self, url: str) -> Dict[str, Any]:
        resp = self.session.get(url, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def get_company_facts(self, cik: str) -> Dict[str, Any]:
        """Fetch companyfacts JSON for a CIK (string of digits, may include leading zeros)."""
        cik10 = str(cik).zfill(10)
        url = self.BASE_URL.format(cik=cik10)
        return self._get(url)


def _latest_unit_item(
    items: List[Dict[str, Any]],
    prefer_quarterly: bool = True,
    frame_preference: str = "ANY",  # 'ANY' | 'QTD' | 'YTD' | 'FY'
) -> Optional[Dict[str, Any]]:
    """Return the most recent item by period end date with simple preference heuristics.

    Heuristics:
    - Prefer 10-Q/10-K forms
    - For flow metrics (prefer_quarterly=True), prefer frames containing 'Q' and 'YTD', then 'Q', then 'FY'
    - For stock/BS metrics (prefer_quarterly=False), frame preference has lower impact; end date dominates
    """
    if not items:
        return None

    def frame_rank(frame: Optional[str]) -> int:
        if not frame:
            return 3
        f = frame.upper()
        # Specific preferences
        if frame_preference == 'YTD':
            if 'YTD' in f and 'Q' in f:
                return 0
            if 'QTD' in f or ('Q' in f and 'QTD' in f):
                return 1
            if 'FY' in f or 'CY' in f:
                return 2
            return 3
        if frame_preference == 'QTD':
            if 'QTD' in f or ('Q' in f and 'QTD' in f):
                return 0
            if 'YTD' in f and 'Q' in f:
                return 1
            if 'FY' in f or 'CY' in f:
                return 2
            return 3
        if frame_preference == 'FY':
            if 'FY' in f or 'CY' in f:
                return 0
            if 'YTD' in f and 'Q' in f:
                return 1
            if 'QTD' in f or 'Q' in f:
                return 2
            return 3
        # ANY (default) heuristic
        if 'Q' in f and 'YTD' in f:
            return 0
        if 'QTD' in f or 'Q' in f:
            return 1
        if 'FY' in f or 'CY' in f:
            return 2
        return 3

    # Convert end date and add ranking
    def key(item: Dict[str, Any]) -> Tuple[datetime, int, int]:
        end = item.get("end") or item.get("filed") or "0001-01-01"
        try:
            dt = datetime.fromisoformat(end)
        except Exception:
            try:
                dt = datetime.strptime(end, "%Y-%m-%d")
            except Exception:
                dt = datetime(1, 1, 1)
        form = (item.get("form") or "").upper()
        form_rank = 0 if form in ("10-Q", "10-K") else 1
        fr_rank = frame_rank(item.get("frame")) if prefer_quarterly else 2
        # Convert ranks so higher is better under reverse=True
        form_score = 1 - form_rank  # 1 for preferred, 0 otherwise
        frame_score = 100 - fr_rank  # higher for better frame preference
        return (dt, form_score, frame_score)

    return sorted(items, key=key, reverse=True)[0]


def _get_fact(
    facts: Dict[str, Any],
    taxonomy: str,
    tag: str,
    units_preference: List[str],
    prefer_quarterly: bool = True,
    frame_preference: str = "ANY",
) -> Optional[float]:
    """Extract the most recent numeric value for a tag in preferred units."""
    t = facts.get(taxonomy, {}).get(tag)
    if not t:
        return None
    units = t.get("units", {})
    for unit in units_preference:
        lst = units.get(unit)
        if not lst:
            continue
        item = _latest_unit_item(lst, prefer_quarterly=prefer_quarterly, frame_preference=frame_preference)
        if item and "val" in item:
            try:
                return float(item["val"])  # raw unit value
            except Exception:
                continue
    return None

def _get_fact_with_item(
    facts: Dict[str, Any],
    taxonomy: str,
    tag: str,
    units_preference: List[str],
    prefer_quarterly: bool = True,
    frame_preference: str = "ANY",
) -> Tuple[Optional[float], Optional[Dict[str, Any]], Optional[str]]:
    """Like _get_fact but also returns the chosen item metadata and unit label."""
    t = facts.get(taxonomy, {}).get(tag)
    if not t:
        return None, None, None
    units = t.get("units", {})
    for unit in units_preference:
        lst = units.get(unit)
        if not lst:
            continue
        item = _latest_unit_item(lst, prefer_quarterly=prefer_quarterly, frame_preference=frame_preference)
        if item and "val" in item:
            try:
                val = float(item["val"])  # raw units
                return val, item, unit
            except Exception:
                continue
    return None, None, None


def parse_core_metrics(companyfacts: Dict[str, Any], flow_frame_pref: str = "ANY") -> Dict[str, Any]:
    """Parse a subset of standardized metrics (return values mostly in millions)."""
    facts = companyfacts.get("facts", {})

    def usd(tag: str, prefer_quarterly: bool = True, frame_pref: str = "ANY") -> Optional[float]:
        v = _get_fact(facts, "us-gaap", tag, ["USD"], prefer_quarterly=prefer_quarterly, frame_preference=frame_pref)
        return (v / 1_000_000.0) if v is not None else None

    # Core GAAP facts (in millions where applicable)
    net_income = usd("NetIncomeLoss", prefer_quarterly=True, frame_pref=flow_frame_pref)
    interest_expense = usd("InterestExpense", prefer_quarterly=True, frame_pref=flow_frame_pref)
    shareholder_equity = (usd("StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest")
                          or usd("StockholdersEquity"))
    total_assets = usd("Assets", prefer_quarterly=False)

    # Debt components
    debt_current = usd("DebtCurrent", prefer_quarterly=False) or 0.0
    debt_longterm = (usd("LongTermDebtNoncurrent")
                     or usd("LongTermDebt", prefer_quarterly=False)
                     or 0.0)
    total_debt = (debt_current or 0.0) + (debt_longterm or 0.0)
    cash = usd("CashAndCashEquivalentsAtCarryingValue", prefer_quarterly=False) or 0.0
    net_debt = (total_debt - cash) if (total_debt is not None and cash is not None) else None

    # EBITDA proxy: Operating Income + D&A
    operating_income = usd("OperatingIncomeLoss", prefer_quarterly=True, frame_pref=flow_frame_pref)
    dda = usd("DepreciationDepletionAndAmortization", prefer_quarterly=True, frame_pref=flow_frame_pref)
    ebitda = None
    if operating_income is not None and dda is not None:
        ebitda = operating_income + dda

    # Shares outstanding (in millions)
    shares = _get_fact(facts, "dei", "EntityCommonStockSharesOutstanding", ["shares"]) or \
             _get_fact(facts, "us-gaap", "CommonStockSharesOutstanding", ["shares"]) or None
    shares_outstanding = (shares / 1_000_000.0) if shares is not None else None

    return {
        "ebitda": ebitda,  # millions
        "net_debt": net_debt,  # millions
        "net_income": net_income,  # millions
        "shareholder_equity": shareholder_equity,  # millions
        "interest_expense": interest_expense,  # millions
        "total_assets": total_assets,  # millions
        "shares_outstanding": shares_outstanding,  # millions of shares
        "cash": cash,  # millions
        "total_debt": total_debt,  # millions
    }

def parse_core_metrics_with_meta(companyfacts: Dict[str, Any], flow_frame_pref: str = "ANY") -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Return metrics in millions and per-tag metadata (form, end, frame, unit, raw)."""
    facts = companyfacts.get("facts", {})

    def usd_item(tag: str, prefer_quarterly: bool = True):
        return _get_fact_with_item(facts, "us-gaap", tag, ["USD"], prefer_quarterly, frame_preference=flow_frame_pref)

    def to_millions(v: Optional[float]) -> Optional[float]:
        return (v / 1_000_000.0) if v is not None else None

    # Pull raw values + meta
    ni_v, ni_item, ni_unit = usd_item("NetIncomeLoss", True)
    ie_v, ie_item, ie_unit = usd_item("InterestExpense", True)
    eq_v, eq_item, eq_unit = usd_item("StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", False)
    if eq_v is None:
        eq_v, eq_item, eq_unit = usd_item("StockholdersEquity", False)
    as_v, as_item, as_unit = usd_item("Assets", False)

    dc_v, dc_item, dc_unit = usd_item("DebtCurrent", False)
    ld_v, ld_item, ld_unit = usd_item("LongTermDebtNoncurrent", False)
    if ld_v is None:
        ld_v, ld_item, ld_unit = usd_item("LongTermDebt", False)
    td_v = (dc_v or 0.0) + (ld_v or 0.0) if (dc_v is not None or ld_v is not None) else None
    td_item = ld_item or dc_item
    td_unit = ld_unit or dc_unit

    ca_v, ca_item, ca_unit = usd_item("CashAndCashEquivalentsAtCarryingValue", False)
    nd_v = (td_v - (ca_v or 0.0)) if (td_v is not None) else None

    oi_v, oi_item, oi_unit = usd_item("OperatingIncomeLoss", True)
    da_v, da_item, da_unit = usd_item("DepreciationDepletionAndAmortization", True)
    eb_v = (oi_v + da_v) if (oi_v is not None and da_v is not None) else None

    sh_v, sh_item, sh_unit = _get_fact_with_item(facts, "dei", "EntityCommonStockSharesOutstanding", ["shares"], True)
    if sh_v is None:
        sh_v, sh_item, sh_unit = _get_fact_with_item(facts, "us-gaap", "CommonStockSharesOutstanding", ["shares"], True)

    metrics = {
        "ebitda": to_millions(eb_v),
        "net_debt": to_millions(nd_v),
        "net_income": to_millions(ni_v),
        "shareholder_equity": to_millions(eq_v),
        "interest_expense": to_millions(ie_v),
        "total_assets": to_millions(as_v),
        "shares_outstanding": (sh_v / 1_000_000.0) if sh_v is not None else None,
        "cash": to_millions(ca_v),
        "total_debt": to_millions(td_v),
    }

    def meta(item, unit, raw):
        if not item:
            return None
        return {
            "form": item.get("form"),
            "end": item.get("end"),
            "frame": item.get("frame"),
            "filed": item.get("filed"),
            "unit": unit,
            "raw_value": raw,
        }

    details = {
        "net_income": meta(ni_item, ni_unit, ni_v),
        "interest_expense": meta(ie_item, ie_unit, ie_v),
        "shareholder_equity": meta(eq_item, eq_unit, eq_v),
        "total_assets": meta(as_item, as_unit, as_v),
        "debt_current": meta(dc_item, dc_unit, dc_v),
        "debt_longterm": meta(ld_item, ld_unit, ld_v),
        "total_debt": meta(td_item, td_unit, td_v),
        "cash": meta(ca_item, ca_unit, ca_v),
        "operating_income": meta(oi_item, oi_unit, oi_v),
        "dda": meta(da_item, da_unit, da_v),
        "ebitda": meta(oi_item, "USD+USD", eb_v),
        "shares_outstanding": meta(sh_item, sh_unit, sh_v),
    }

    return metrics, details
