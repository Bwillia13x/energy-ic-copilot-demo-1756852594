"""
Financial valuation models for energy infrastructure companies.
Implements EPV (Enterprise Present Value) and DCF (Discounted Cash Flow) calculations.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel
import math


class ValuationInputs(BaseModel):
    """
    Input parameters for enterprise valuation calculations.

    This model encapsulates all financial metrics, risk parameters, and assumptions
    required to perform EPV (Enterprise Present Value) and DCF (Discounted Cash Flow)
    valuations for energy infrastructure companies.

    Attributes:
        ebitda: Earnings Before Interest, Taxes, Depreciation & Amortization (in millions)
        net_debt: Total debt minus cash and cash equivalents (in millions)
        maintenance_capex: Capital expenditures required to maintain operations (in millions)
        tax_rate: Effective corporate tax rate (default: 25%)
        reinvestment_rate: Percentage of NOPAT reinvested in the business (default: 15%)

        shares_outstanding: Total shares outstanding (optional, in millions)
        dividend_per_share: Annual dividend per share (optional)
        share_price: Current market price per share (optional)
        net_income: Net income after taxes (optional, required for ROE calculation)

        risk_free_rate: Risk-free rate (typically 10-year Treasury yield, default: 4%)
        market_risk_premium: Equity risk premium (default: 6%)
        beta: Company-specific risk measure (default: 0.8 for energy infrastructure)
        cost_of_debt: Pre-tax cost of debt (default: 5%)
        debt_weight: Proportion of debt in capital structure (default: 40%)
        equity_weight: Proportion of equity in capital structure (default: 60%)

        terminal_growth: Long-term growth rate for DCF terminal value (default: 2%)
        projection_years: Number of explicit projection years in DCF (default: 5)
    """

    # Core financial metrics (required)
    ebitda: float
    net_debt: float
    maintenance_capex: float

    # Tax and reinvestment assumptions
    tax_rate: float = 0.25
    reinvestment_rate: float = 0.15

    # Equity and dividend metrics (optional - enable enhanced analytics)
    shares_outstanding: Optional[float] = None  # millions of shares
    dividend_per_share: Optional[float] = None  # annual dividend per share
    share_price: Optional[float] = None  # current market price
    net_income: Optional[float] = None  # net income for ROE calculation
    shareholder_equity: Optional[float] = None  # shareholder equity for ROE calculation
    interest_expense: Optional[float] = None  # interest expense for coverage ratio

    # WACC (Weighted Average Cost of Capital) components
    risk_free_rate: float = 0.04  # typically 10-year Treasury yield
    market_risk_premium: float = 0.06  # equity risk premium
    beta: float = 0.8  # company-specific risk measure
    cost_of_debt: float = 0.05  # pre-tax cost of debt
    debt_weight: float = 0.4  # proportion of debt in capital structure
    equity_weight: float = 0.6  # proportion of equity in capital structure

    # DCF (Discounted Cash Flow) specific parameters
    terminal_growth: float = 0.02  # long-term growth rate
    projection_years: int = 5  # explicit projection period


class ValuationScenario(BaseModel):
    """
    Scenario inputs for sensitivity analysis and stress testing.

    This model defines the parameters for testing how changes in key assumptions
    affect valuation outcomes. Used for scenario planning and risk assessment.

    Attributes:
        rate_bps_change: Change in interest rates in basis points (+/- 200 typical)
        throughput_pct_change: Change in operational throughput as percentage (+/- 10% typical)
        ebitda_uplift: Direct adjustment to EBITDA as percentage (spread normalization)
    """

    rate_bps_change: int = 0  # +/- basis points (e.g., +200 = +2%)
    throughput_pct_change: float = 0.0  # +/- percentage (e.g., -0.05 = -5%)
    ebitda_uplift: float = 0.0  # percentage uplift/drag (e.g., 0.02 = +2%)


class ValuationResults(BaseModel):
    """
    Comprehensive results from enterprise valuation calculations.

    This model contains all valuation outputs including base case results,
    key financial ratios, additional performance metrics, and scenario analysis.

    Attributes:
        Core Valuation:
            epv: Enterprise Present Value (enterprise value in millions)
            dcf_value: Discounted Cash Flow value (enterprise value in millions)
            wacc: Weighted Average Cost of Capital (as decimal)
            cost_of_equity: Required return on equity (as decimal)
            cost_of_debt_after_tax: After-tax cost of debt (as decimal)

        Financial Ratios:
            ev_ebitda_ratio: Enterprise Value to EBITDA multiple
            net_debt_ebitda_ratio: Net Debt to EBITDA leverage ratio

        Enhanced Analytics:
            roic: Return on Invested Capital (NOPAT / Total Capital)
            roe: Return on Equity (Net Income / Shareholder Equity)
            payout_ratio: Dividend payout ratio (Dividends / Net Income)
            dividend_yield: Annual dividend yield (Dividend / Share Price)
            debt_to_equity: Leverage ratio (Total Debt / Shareholder Equity)
            interest_coverage: Interest coverage ratio (EBITDA / Interest Expense)

        Scenario Analysis:
            scenario_epv: EPV under scenario assumptions
            scenario_dcf: DCF under scenario assumptions

        DCF Details:
            dcf_components: Detailed DCF calculation components
    """

    # Core valuation results
    epv: float  # Enterprise Present Value (millions)
    dcf_value: float  # Discounted Cash Flow Value (millions)
    wacc: float  # Weighted Average Cost of Capital
    cost_of_equity: float  # Required return on equity
    cost_of_debt_after_tax: float  # After-tax cost of debt

    # Key financial ratios
    ev_ebitda_ratio: float  # Enterprise Value / EBITDA
    net_debt_ebitda_ratio: float  # Net Debt / EBITDA

    # Enhanced performance metrics (optional)
    roic: Optional[float] = None  # Return on Invested Capital
    roe: Optional[float] = None  # Return on Equity
    payout_ratio: Optional[float] = None  # Dividend payout ratio
    dividend_yield: Optional[float] = None  # Annual dividend yield
    debt_to_equity: Optional[float] = None  # Leverage ratio
    interest_coverage: Optional[float] = None  # Interest coverage ratio

    # Scenario analysis results
    scenario_epv: Optional[float] = None  # EPV under scenario
    scenario_dcf: Optional[float] = None  # DCF under scenario

    # Detailed DCF calculation components
    dcf_components: Dict[str, Any] = {}


class ValuationEngine:
    """
    Enterprise valuation engine implementing industry-standard financial models.

    This engine provides comprehensive valuation capabilities for energy infrastructure
    companies, including EPV, DCF, WACC calculations, and scenario analysis. All
    calculations follow financial best practices and include proper error handling.

    Key Features:
    - Enterprise Present Value (EPV) calculations
    - Discounted Cash Flow (DCF) with terminal value
    - Weighted Average Cost of Capital (WACC)
    - Enhanced analytics (ROIC, ROE, payout ratios)
    - Scenario analysis and stress testing
    - Comprehensive error handling and validation
    """

    def __init__(self):
        """Initialize the valuation engine with default settings."""
        pass

    def calculate_wacc(self, inputs: ValuationInputs) -> float:
        """
        Calculate Weighted Average Cost of Capital (WACC).

        WACC represents the average rate of return required by all investors
        (both debt and equity holders) in the company.

        Formula: WACC = (E/V × Re) + (D/V × Rd × (1-Tc))
        Where:
        - E/V = Proportion of equity in capital structure
        - D/V = Proportion of debt in capital structure
        - Re = Required return on equity (CAPM)
        - Rd = Cost of debt (pre-tax)
        - Tc = Corporate tax rate

        Args:
            inputs: ValuationInputs containing WACC components

        Returns:
            float: WACC as a decimal (e.g., 0.085 = 8.5%)

        Raises:
            No exceptions - all validation handled in input models
        """
        # Calculate cost of equity using CAPM
        cost_of_equity = inputs.risk_free_rate + (inputs.beta * inputs.market_risk_premium)

        # Calculate after-tax cost of debt
        cost_of_debt_after_tax = inputs.cost_of_debt * (1 - inputs.tax_rate)

        # Calculate WACC as weighted average
        wacc = (inputs.equity_weight * cost_of_equity) + \
               (inputs.debt_weight * cost_of_debt_after_tax)

        return wacc

    def calculate_epv(self, inputs: ValuationInputs) -> float:
        """
        Calculate Enterprise Present Value (EPV) using the single-stage DCF model.

        EPV represents the present value of a company's future free cash flows to all
        capital providers (both debt and equity holders). This simplified model assumes
        a stable growth rate and constant reinvestment rate.

        Formula: EPV = (Normalized EBIT × (1 - tax_rate) × (1 - reinvestment_rate)) / WACC
        Where:
        - Normalized EBIT = EBITDA - Maintenance Capex (sustainable operating profit)
        - NOPAT = Normalized EBIT × (1 - tax_rate) (net operating profit after tax)
        - Free Cash Flow = NOPAT × (1 - reinvestment_rate) (cash available to investors)
        - WACC = Weighted Average Cost of Capital (required return)

        This model is particularly useful for mature, stable companies with predictable
        cash flows, which is typical for energy infrastructure businesses.

        Args:
            inputs: ValuationInputs containing financial metrics and assumptions

        Returns:
            float: Enterprise Present Value in millions (negative values possible)

        Raises:
            ZeroDivisionError: If WACC is zero (handled by returning infinity)
        """
        normalized_ebit = inputs.ebitda - inputs.maintenance_capex
        nopat = normalized_ebit * (1 - inputs.tax_rate)
        free_cash_flow = nopat * (1 - inputs.reinvestment_rate)

        wacc = self.calculate_wacc(inputs)

        if wacc <= 0:
            return float('inf')  # Avoid division by zero

        epv = free_cash_flow / wacc
        return epv

    def calculate_dcf(self, inputs: ValuationInputs) -> Dict[str, Any]:
        """
        Calculate Discounted Cash Flow value.

        Projects free cash flows for 5 years + terminal value.
        """
        wacc = self.calculate_wacc(inputs)
        if wacc <= 0:
            return {"dcf_value": float('inf'), "components": {}}

        # FCFF using steady-state assumption where maintenance capex ≈ D&A
        # FCFF ≈ NOPAT when ΔNWC ~ 0 and D&A ≈ maintenance capex
        # NOPAT = (EBITDA - maintenance_capex) × (1 - tax_rate)
        normalized_ebit = inputs.ebitda - inputs.maintenance_capex
        fcff = normalized_ebit * (1 - inputs.tax_rate)

        # Project cash flows (simplified - constant growth)
        projected_fcffs = []
        for year in range(1, inputs.projection_years + 1):
            projected_fcff = fcff * (1 + inputs.terminal_growth) ** year
            pv_fcff = projected_fcff / (1 + wacc) ** year
            projected_fcffs.append(pv_fcff)

        # Terminal value using Gordon Growth Model
        # TV = FCFF_terminal / (WACC - g)
        # where FCFF_terminal = FCFF_current * (1 + g)
        if wacc <= inputs.terminal_growth:
            terminal_value = float('inf')
        else:
            terminal_value = (fcff * (1 + inputs.terminal_growth)) / (wacc - inputs.terminal_growth)

        # Present value of terminal value
        pv_terminal = terminal_value / (1 + wacc) ** inputs.projection_years

        dcf_value = sum(projected_fcffs) + pv_terminal

        return {
            "dcf_value": dcf_value,
            "components": {
                "projected_fcffs": projected_fcffs,
                "terminal_value": pv_terminal,
                "wacc": wacc
            }
        }

    def apply_scenario(self, inputs: ValuationInputs, scenario: ValuationScenario) -> ValuationInputs:
        """
        Apply scenario adjustments to valuation inputs.
        """
        adjusted_inputs = inputs.model_copy()

        # Apply rate changes (bps)
        rate_change = scenario.rate_bps_change / 10000  # Convert bps to decimal
        adjusted_inputs.risk_free_rate += rate_change
        adjusted_inputs.cost_of_debt += rate_change

        # Apply throughput changes (affects EBITDA)
        ebitda_change = scenario.throughput_pct_change / 100
        adjusted_inputs.ebitda *= (1 + ebitda_change)

        # Apply EBITDA uplift/drag
        adjusted_inputs.ebitda *= (1 + scenario.ebitda_uplift)

        return adjusted_inputs

    def calculate_valuation(self, inputs: ValuationInputs,
                          scenario: Optional[ValuationScenario] = None) -> ValuationResults:
        """
        Calculate complete valuation including scenarios.
        """
        # Apply scenario if provided
        valuation_inputs = inputs
        if scenario:
            valuation_inputs = self.apply_scenario(inputs, scenario)

        # Calculate valuations using scenario-adjusted inputs
        wacc = self.calculate_wacc(valuation_inputs)
        epv = self.calculate_epv(valuation_inputs)
        dcf_result = self.calculate_dcf(valuation_inputs)

        cost_of_equity = valuation_inputs.risk_free_rate + (valuation_inputs.beta * valuation_inputs.market_risk_premium)
        cost_of_debt_after_tax = valuation_inputs.cost_of_debt * (1 - valuation_inputs.tax_rate)

        # Ratios
        # EV/EBITDA = (Enterprise Value) / EBITDA = (EPV + Net Debt) / EBITDA
        enterprise_value = epv + valuation_inputs.net_debt
        ev_ebitda_ratio = enterprise_value / valuation_inputs.ebitda if valuation_inputs.ebitda != 0 else 0
        net_debt_ebitda_ratio = valuation_inputs.net_debt / valuation_inputs.ebitda if valuation_inputs.ebitda != 0 else 0

        # Additional metrics calculations
        roic = None
        roe = None
        payout_ratio = None
        dividend_yield = None
        debt_to_equity = None
        interest_coverage = None

        # Calculate additional metrics if we have the required data
        # ROIC = NOPAT / (Invested Capital). Use book-based proxy: Net Debt + Shareholder Equity.
        if valuation_inputs.ebitda and valuation_inputs.shareholder_equity is not None:
            normalized_ebit_roic = valuation_inputs.ebitda - valuation_inputs.maintenance_capex
            nopat_roic = normalized_ebit_roic * (1 - valuation_inputs.tax_rate)
            invested_capital = (valuation_inputs.net_debt or 0.0) + valuation_inputs.shareholder_equity
            roic = (nopat_roic / invested_capital) if invested_capital else None

        # ROE = Net Income / Shareholder Equity (use actual shareholder equity if available)
        if valuation_inputs.net_income and hasattr(valuation_inputs, 'shareholder_equity') and valuation_inputs.shareholder_equity:
            roe = valuation_inputs.net_income / valuation_inputs.shareholder_equity if valuation_inputs.shareholder_equity != 0 else None

        if valuation_inputs.dividend_per_share and valuation_inputs.net_income and valuation_inputs.shares_outstanding:
            # Payout Ratio = Dividends / Net Income
            annual_dividends = valuation_inputs.dividend_per_share * valuation_inputs.shares_outstanding
            payout_ratio = annual_dividends / valuation_inputs.net_income if valuation_inputs.net_income != 0 else None

        if valuation_inputs.dividend_per_share and valuation_inputs.share_price:
            # Dividend Yield = Annual Dividend / Share Price
            dividend_yield = valuation_inputs.dividend_per_share / valuation_inputs.share_price

        # Debt-to-Equity = Total Debt / Shareholder Equity
        # Use actual shareholder equity if available, otherwise calculate from market data
        if valuation_inputs.net_debt:
            if hasattr(valuation_inputs, 'shareholder_equity') and valuation_inputs.shareholder_equity and valuation_inputs.shareholder_equity > 0:
                # Use actual shareholder equity from financial data
                debt_to_equity = valuation_inputs.net_debt / valuation_inputs.shareholder_equity
            elif valuation_inputs.shares_outstanding and valuation_inputs.share_price and valuation_inputs.shares_outstanding > 0 and valuation_inputs.share_price > 0:
                # Fallback to market-based calculation
                shareholder_equity_market = valuation_inputs.shares_outstanding * valuation_inputs.share_price
                debt_to_equity = valuation_inputs.net_debt / shareholder_equity_market if shareholder_equity_market != 0 else None
            else:
                debt_to_equity = None

        # Interest Coverage = EBITDA / Interest Expense
        # Use actual interest expense if available (from financial data), otherwise approximate
        if valuation_inputs.ebitda:
            if hasattr(valuation_inputs, 'interest_expense') and valuation_inputs.interest_expense and valuation_inputs.interest_expense > 0:
                # Use actual interest expense from financial data
                interest_coverage = valuation_inputs.ebitda / valuation_inputs.interest_expense
            elif valuation_inputs.net_debt and valuation_inputs.cost_of_debt:
                # Fallback to approximation: cost_of_debt * net_debt
                interest_expense_approx = valuation_inputs.cost_of_debt * valuation_inputs.net_debt
                interest_coverage = valuation_inputs.ebitda / interest_expense_approx if interest_expense_approx != 0 else None
            else:
                interest_coverage = None

        results = ValuationResults(
            epv=epv,
            dcf_value=dcf_result["dcf_value"],
            wacc=wacc,
            cost_of_equity=cost_of_equity,
            cost_of_debt_after_tax=cost_of_debt_after_tax,
            ev_ebitda_ratio=ev_ebitda_ratio,
            net_debt_ebitda_ratio=net_debt_ebitda_ratio,
            roic=roic,
            roe=roe,
            payout_ratio=payout_ratio,
            dividend_yield=dividend_yield,
            debt_to_equity=debt_to_equity,
            interest_coverage=interest_coverage,
            dcf_components=dcf_result["components"]
        )

        # Apply scenario if provided
        if scenario:
            adjusted_inputs = self.apply_scenario(inputs, scenario)
            scenario_epv = self.calculate_epv(adjusted_inputs)
            scenario_dcf_result = self.calculate_dcf(adjusted_inputs)

            results.scenario_epv = scenario_epv
            results.scenario_dcf = scenario_dcf_result["dcf_value"]

        return results


def create_sample_inputs() -> ValuationInputs:
    """Create sample valuation inputs for testing using centralized configuration."""
    from .config import get_default_valuation_inputs
    return get_default_valuation_inputs()
