"""
Centralized Configuration Module for Financial Data
Provides consistent financial inputs across all application components
"""

import yaml
from pathlib import Path
from typing import Dict, Any
from pydantic import BaseModel

class FinancialData(BaseModel):
    """PPL Corporation financial data structure"""
    ebitda: float
    net_debt: float
    maintenance_capex: float
    net_income: float
    shareholder_equity: float
    interest_expense: float
    total_assets: float
    shares_outstanding: float

class MarketAssumptions(BaseModel):
    """Market assumptions for valuation calculations"""
    risk_free_rate: float
    market_risk_premium: float
    beta: float
    cost_of_debt: float
    tax_rate: float
    reinvestment_rate: float
    terminal_growth: float

class CapitalStructure(BaseModel):
    """Capital structure assumptions"""
    debt_weight: float
    equity_weight: float

class SimulationDefaults(BaseModel):
    """Monte Carlo simulation defaults"""
    ebitda_volatility: float
    beta_volatility: float
    risk_premium_volatility: float
    terminal_growth_volatility: float
    num_simulations: int
    confidence_level: float

class FinancialConfig:
    """
    Centralized financial configuration management.
    Loads data from YAML and provides consistent access across components.
    """

    def __init__(self, config_path: Path = None):
        if config_path is None:
            # Default path relative to this file
            config_path = Path(__file__).parent.parent / "data" / "default_financial_inputs.yaml"

        self.config_path = config_path
        self._config = None
        self._load_config()

    def _load_config(self) -> None:
        """Load configuration from YAML file"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self._config = yaml.safe_load(f)
        except FileNotFoundError:
            raise FileNotFoundError(f"Configuration file not found: {self.config_path}")
        except yaml.YAMLError as e:
            raise ValueError(f"Error parsing configuration file: {e}")

    @property
    def financial_data(self) -> FinancialData:
        """Get PPL financial data"""
        return FinancialData(**self._config['ppl_financial_data'])

    @property
    def market_assumptions(self) -> MarketAssumptions:
        """Get market assumptions"""
        return MarketAssumptions(**self._config['market_assumptions'])

    @property
    def capital_structure(self) -> CapitalStructure:
        """Get capital structure"""
        return CapitalStructure(**self._config['capital_structure'])

    @property
    def simulation_defaults(self) -> SimulationDefaults:
        """Get simulation defaults"""
        return SimulationDefaults(**self._config['simulation_defaults'])

    @property
    def metadata(self) -> Dict[str, Any]:
        """Get configuration metadata"""
        return self._config.get('metadata', {})

    def get_valuation_inputs(self):
        """
        Get complete valuation inputs combining financial data and market assumptions.
        This provides a single source of truth for valuation calculations.
        """
        from .valuation import ValuationInputs

        financial = self.financial_data
        market = self.market_assumptions
        capital = self.capital_structure

        return ValuationInputs(
            ebitda=financial.ebitda,
            net_debt=financial.net_debt,
            maintenance_capex=financial.maintenance_capex,
            tax_rate=market.tax_rate,
            reinvestment_rate=market.reinvestment_rate,
            risk_free_rate=market.risk_free_rate,
            market_risk_premium=market.market_risk_premium,
            beta=market.beta,
            cost_of_debt=market.cost_of_debt,
            debt_weight=capital.debt_weight,
            equity_weight=capital.equity_weight,
            terminal_growth=market.terminal_growth,
            # Include financial data needed for ratios calculations
            net_income=financial.net_income,
            shareholder_equity=financial.shareholder_equity,
            interest_expense=financial.interest_expense,
            # Note: shares_outstanding, share_price, dividend_per_share would need to be added to financial data
        )

    def validate_consistency(self) -> Dict[str, Any]:
        """
        Validate data consistency and return validation results.
        Checks for logical consistency in financial relationships.
        """
        issues = []
        warnings = []

        financial = self.financial_data
        capital = self.capital_structure

        # Check capital structure consistency
        total_weight = capital.debt_weight + capital.equity_weight
        if abs(total_weight - 1.0) > 0.01:
            issues.append(f"Capital structure weights don't sum to 1.0: {total_weight}")

        # Check debt-to-equity ratio consistency
        calculated_debt_weight = financial.net_debt / (financial.net_debt + financial.shareholder_equity)
        if abs(calculated_debt_weight - capital.debt_weight) > 0.01:
            warnings.append(f"Debt weight mismatch: calculated {calculated_debt_weight:.2f}, configured {capital.debt_weight:.2f}")

        # Check EBITDA coverage of interest
        interest_coverage = (financial.ebitda / financial.interest_expense
                             if financial.interest_expense else float('inf'))
        if interest_coverage < 3:
            warnings.append(f"Low interest coverage: {interest_coverage:.1f}x (< 3x)")

        # Check maintenance capex as percentage of EBITDA
        capex_ratio = (financial.maintenance_capex / financial.ebitda
                       if financial.ebitda else 0.0)
        if capex_ratio > 0.15:  # More than 15% of EBITDA
            warnings.append(f"High maintenance capex ratio: {capex_ratio:.1%} (> 15%)")

        return {
            'valid': len(issues) == 0,
            'issues': issues,
            'warnings': warnings,
            'metrics': {
                'total_capital': financial.net_debt + financial.shareholder_equity,
                'debt_to_equity': financial.net_debt / financial.shareholder_equity,
                'interest_coverage': interest_coverage,
                'capex_ratio': capex_ratio
            }
        }


# Global instance for easy access
config = FinancialConfig()

# Convenience functions for common use cases
def get_default_valuation_inputs():
    """Get default valuation inputs from centralized config"""
    return config.get_valuation_inputs()

def get_financial_data():
    """Get PPL financial data from centralized config"""
    return config.financial_data

def validate_financial_config():
    """Validate the financial configuration for consistency"""
    return config.validate_consistency()
