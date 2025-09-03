"""
Tests for valuation math correctness and robustness.
"""

from core.valuation import ValuationEngine
from core.config import FinancialConfig


def test_wacc_epv_and_dcf_math():
    config = FinancialConfig()
    inputs = config.get_valuation_inputs()
    engine = ValuationEngine()

    # WACC
    wacc = engine.calculate_wacc(inputs)

    # Expected WACC = E/V*Re + D/V*Rd*(1-T)
    expected_re = inputs.risk_free_rate + inputs.beta * inputs.market_risk_premium
    expected_rd_at = inputs.cost_of_debt * (1 - inputs.tax_rate)
    expected_wacc = inputs.equity_weight * expected_re + inputs.debt_weight * expected_rd_at

    assert abs(wacc - expected_wacc) < 1e-9

    # EPV = (EBITDA - maintenance_capex)*(1 - tax)*(1 - reinvestment) / WACC
    normalized_ebit = inputs.ebitda - inputs.maintenance_capex
    nopat = normalized_ebit * (1 - inputs.tax_rate)
    fcf_epv = nopat * (1 - inputs.reinvestment_rate)
    expected_epv = fcf_epv / wacc if wacc > 0 else float('inf')

    epv = engine.calculate_epv(inputs)
    assert abs(epv - expected_epv) / expected_epv < 1e-9

    # DCF components check
    dcf = engine.calculate_dcf(inputs)
    dcf_value = dcf["dcf_value"]
    g = inputs.terminal_growth

    if wacc > 0:
        # FCFF used in model
        fcff = nopat
        # PV of explicit period
        pv_sum = 0.0
        for year in range(1, inputs.projection_years + 1):
            projected = fcff * (1 + g) ** year
            pv = projected / (1 + wacc) ** year
            pv_sum += pv

        # Terminal value
        if wacc > g:
            tv = (fcff * (1 + g)) / (wacc - g)
            pv_tv = tv / (1 + wacc) ** inputs.projection_years
        else:
            pv_tv = float('inf')

        expected_dcf = pv_sum + pv_tv
        # Allow tiny numerical tolerance
        if expected_dcf != float('inf'):
            assert abs(dcf_value - expected_dcf) / expected_dcf < 1e-9
        else:
            assert dcf_value == float('inf')

