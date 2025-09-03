"""
Tests for XBRL companyfacts parsing (offline using synthetic sample).
"""

from core.xbrl_client import parse_core_metrics


def test_parse_core_metrics_minimal():
    sample = {
        "facts": {
            "us-gaap": {
                "NetIncomeLoss": {"units": {"USD": [{"end": "2024-06-30", "val": 1250000000, "form": "10-Q", "frame": "CY2024Q2YTD"}] }},
                "InterestExpense": {"units": {"USD": [{"end": "2024-06-30", "val": 380000000, "form": "10-Q", "frame": "CY2024Q2YTD"}] }},
                "StockholdersEquity": {"units": {"USD": [{"end": "2024-06-30", "val": 16750000000, "form": "10-Q"}] }},
                "Assets": {"units": {"USD": [{"end": "2024-06-30", "val": 36550000000, "form": "10-Q"}] }},
                "DebtCurrent": {"units": {"USD": [{"end": "2024-06-30", "val": 1000000000, "form": "10-Q"}] }},
                "LongTermDebt": {"units": {"USD": [{"end": "2024-06-30", "val": 18750000000, "form": "10-Q"}] }},
                "CashAndCashEquivalentsAtCarryingValue": {"units": {"USD": [{"end": "2024-06-30", "val": 1050000000, "form": "10-Q", "frame": "CY2024Q2QTD"}] }},
                "OperatingIncomeLoss": {"units": {"USD": [{"end": "2024-06-30", "val": 2600000000, "form": "10-Q", "frame": "CY2024Q2QTD"}] }},
                "DepreciationDepletionAndAmortization": {"units": {"USD": [{"end": "2024-06-30", "val": 850000000, "form": "10-Q", "frame": "CY2024Q2QTD"}] }},
            },
            "dei": {
                "EntityCommonStockSharesOutstanding": {"units": {"shares": [{"end": "2024-06-30", "val": 572000000, "form": "10-Q", "frame": "CY2024Q2QTD"}] }}
            }
        }
    }

    m = parse_core_metrics(sample)

    assert m["net_income"] == 1250.0
    assert m["interest_expense"] == 380.0
    assert m["shareholder_equity"] == 16750.0
    assert m["total_assets"] == 36550.0
    # total debt = 1,000 + 18,750 = 19,750; net debt = 19,750 - 1,050 = 18,700 (millions)
    assert round(m["total_debt"], 1) == 19750.0
    assert round(m["cash"], 1) == 1050.0
    assert round(m["net_debt"], 1) == 18700.0
    # EBITDA proxy = 2,600 + 850 = 3,450
    assert m["ebitda"] == 3450.0
    assert m["shares_outstanding"] == 572.0

def test_flow_frame_preference_qtd_vs_ytd():
    sample = {
        "facts": {
            "us-gaap": {
                "NetIncomeLoss": {
                    "units": {
                        "USD": [
                            {"end": "2024-06-30", "val": 200000000, "form": "10-Q", "frame": "CY2024Q2QTD"},
                            {"end": "2024-06-30", "val": 600000000, "form": "10-Q", "frame": "CY2024Q2YTD"},
                        ]
                    }
                }
            }
        }
    }

    # ANY prefers YTD-Q by heuristic
    m_any = parse_core_metrics(sample, flow_frame_pref="ANY")
    assert m_any["net_income"] == 600.0

    # QTD should select the quarterly-to-date value
    m_qtd = parse_core_metrics(sample, flow_frame_pref="QTD")
    assert m_qtd["net_income"] == 200.0

    # YTD should select the YTD value
    m_ytd = parse_core_metrics(sample, flow_frame_pref="YTD")
    assert m_ytd["net_income"] == 600.0

def test_parse_core_metrics_with_meta():
    sample = {
        "facts": {
            "us-gaap": {
                "NetIncomeLoss": {"units": {"USD": [{"end": "2024-06-30", "val": 100000000, "form": "10-Q", "frame": "CY2024Q2QTD"}] }},
            }
        }
    }

    from core.xbrl_client import parse_core_metrics_with_meta
    metrics, details = parse_core_metrics_with_meta(sample)
    assert metrics["net_income"] == 100.0
    assert details["net_income"]["form"] == "10-Q"
    assert details["net_income"]["frame"] == "CY2024Q2QTD"
