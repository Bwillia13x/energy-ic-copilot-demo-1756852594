"""
Tests for valuation calculations.
"""

import pytest
from core.valuation import ValuationEngine, ValuationInputs, ValuationScenario, create_sample_inputs


class TestValuationEngine:
    """Test cases for valuation calculations."""

    def setup_method(self):
        """Set up test fixtures."""
        self.engine = ValuationEngine()
        self.sample_inputs = create_sample_inputs()

    def test_calculate_wacc(self):
        """Test WACC calculation."""
        wacc = self.engine.calculate_wacc(self.sample_inputs)

        # Expected calculation:
        # Cost of equity = 4% + 0.8 * 6% = 8.8%
        # Cost of debt after tax = 5% * (1 - 25%) = 3.75%
        # WACC = 60% * 8.8% + 40% * 3.75% = 6.48%
        expected_wacc = 0.6 * 0.088 + 0.4 * 0.0375

        assert abs(wacc - expected_wacc) < 0.0001
        assert 0 < wacc < 1  # Should be between 0% and 100%

    def test_calculate_epv(self):
        """Test Enterprise Present Value calculation."""
        epv = self.engine.calculate_epv(self.sample_inputs)

        # Expected calculation:
        # Normalized EBIT = 3450 - 220 = 3230
        # NOPAT = 3230 * (1 - 0.25) = 2422.5
        # Free cash flow = 2422.5 * (1 - 0.15) = 2059.125
        # EPV = 2059.125 / 0.0648 ≈ 31774

        assert epv > 0
        assert epv < 100000  # Reasonable upper bound

    def test_calculate_dcf(self):
        """Test DCF calculation."""
        dcf_result = self.engine.calculate_dcf(self.sample_inputs)

        assert "dcf_value" in dcf_result
        assert "components" in dcf_result
        assert dcf_result["dcf_value"] > 0

        components = dcf_result["components"]
        assert "projected_fcffs" in components
        assert "terminal_value" in components
        assert "wacc" in components

    def test_apply_scenario_rate_change(self):
        """Test scenario with rate changes."""
        scenario = ValuationScenario(rate_bps_change=200)  # +200 bps
        adjusted_inputs = self.engine.apply_scenario(self.sample_inputs, scenario)

        # Risk-free rate should increase by 2%
        assert adjusted_inputs.risk_free_rate == self.sample_inputs.risk_free_rate + 0.02
        assert adjusted_inputs.cost_of_debt == self.sample_inputs.cost_of_debt + 0.02

    def test_apply_scenario_throughput_change(self):
        """Test scenario with throughput changes."""
        scenario = ValuationScenario(throughput_pct_change=10.0)  # +10%
        adjusted_inputs = self.engine.apply_scenario(self.sample_inputs, scenario)

        # EBITDA should increase by 10%
        expected_ebitda = self.sample_inputs.ebitda * 1.1
        assert adjusted_inputs.ebitda == expected_ebitda

    def test_calculate_valuation_complete(self):
        """Test complete valuation calculation."""
        results = self.engine.calculate_valuation(self.sample_inputs)

        required_fields = [
            "epv", "dcf_value", "wacc", "cost_of_equity",
            "cost_of_debt_after_tax", "ev_ebitda_ratio", "net_debt_ebitda_ratio"
        ]

        for field in required_fields:
            assert hasattr(results, field)
            assert getattr(results, field) is not None

    def test_calculate_valuation_with_scenario(self):
        """Test valuation calculation with scenario."""
        scenario = ValuationScenario(rate_bps_change=100, throughput_pct_change=5.0)
        results = self.engine.calculate_valuation(self.sample_inputs, scenario)

        # Should have scenario results
        assert results.scenario_epv is not None
        assert results.scenario_dcf is not None

        # Scenario results should be different from base case
        assert results.scenario_epv != results.epv

    def test_edge_cases(self):
        """Test edge cases and boundary conditions."""

        # Test with zero WACC (should handle gracefully)
        inputs_zero_wacc = self.sample_inputs.model_copy()
        inputs_zero_wacc.risk_free_rate = 0
        inputs_zero_wacc.cost_of_debt = 0

        results = self.engine.calculate_valuation(inputs_zero_wacc)
        assert results.epv is not None  # Should not crash

        # Test with very high beta
        inputs_high_beta = self.sample_inputs.model_copy()
        inputs_high_beta.beta = 5.0

        results = self.engine.calculate_valuation(inputs_high_beta)
        assert results.wacc > self.sample_inputs.market_risk_premium  # Should be higher

    def test_valuation_inputs_validation(self):
        """Test that valuation inputs are properly validated."""
        # This would be more comprehensive with Pydantic validation
        # For now, just test that the model can be created
        inputs = ValuationInputs(
            ebitda=1000,
            net_debt=500,
            maintenance_capex=50,
        )

        assert inputs.ebitda == 1000
        assert inputs.net_debt == 500
        assert inputs.maintenance_capex == 50

        # Test defaults are applied
        assert inputs.tax_rate == 0.25
        assert inputs.reinvestment_rate == 0.15


if __name__ == "__main__":
    pytest.main([__file__])
