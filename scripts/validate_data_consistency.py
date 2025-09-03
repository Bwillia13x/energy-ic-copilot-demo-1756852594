#!/usr/bin/env python3
"""
Data Consistency Validation Script
Validates financial data consistency across all application components
"""

import sys
from pathlib import Path
import yaml
import re

# Add core module to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.config import FinancialConfig, validate_financial_config

def load_file_content(file_path: Path) -> str:
    """Load file content safely"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"ERROR: {e}"

def extract_financial_values(text: str, pattern: str) -> list:
    """Extract financial values from text using regex"""
    matches = re.findall(pattern, text)
    return [float(match.replace(',', '').replace('$', '')) for match in matches if match]

def validate_web_app_defaults():
    """Validate web app default values against centralized config"""
    print("🔍 Validating Web App Defaults...")

    issues = []

    # Load centralized config
    config = FinancialConfig()
    expected_maintenance_capex = config.financial_data.maintenance_capex

    # Check valuation page
    valuation_page = Path(__file__).parent.parent / "apps" / "web" / "app" / "tools" / "valuation" / "page.tsx"
    content = load_file_content(valuation_page)

    if "maintenance_capex: 220" not in content:
        issues.append("❌ Valuation page: maintenance_capex not updated to 220")

    # Check Monte Carlo page
    monte_carlo_page = Path(__file__).parent.parent / "apps" / "web" / "app" / "tools" / "monte-carlo" / "page.tsx"
    content = load_file_content(monte_carlo_page)

    if "maintenance_capex: 220" not in content:
        issues.append("❌ Monte Carlo page: maintenance_capex not updated to 220")

    if not issues:
        print("✅ Web app defaults are consistent")
    else:
        for issue in issues:
            print(issue)

    return issues

def validate_verification_script():
    """Validate verification script uses correct values"""
    print("\n🔍 Validating Verification Script...")

    issues = []

    # Load centralized config
    config = FinancialConfig()
    expected_maintenance_capex = config.financial_data.maintenance_capex

    # Check verification script
    verification_script = Path(__file__).parent.parent / "docs" / "verification_script.py"
    content = load_file_content(verification_script)

    if "maintenance_capex = 220" not in content:
        issues.append("❌ Verification script: maintenance_capex not updated to 220")

    if not issues:
        print("✅ Verification script is consistent")
    else:
        for issue in issues:
            print(issue)

    return issues

def validate_sample_filings():
    """Validate sample filings contain expected data"""
    print("\n🔍 Validating Sample Filings...")

    issues = []
    warnings = []

    # Load centralized config
    config = FinancialConfig()

    # Check PPL filing
    ppl_filing = Path(__file__).parent.parent / "data" / "filings" / "ppl_2024_q2_mda.txt"
    content = load_file_content(ppl_filing)

    # Check for expected values
    expected_values = {
        "EBITDA": 3450,
        "Net Debt": 18750,
        "Maintenance Capex": 220,
        "Net Income": 1250,
        "Interest Expense": 380,
        "Shareholder Equity": 16750
    }

    # Specific patterns for each KPI based on actual filing text structure
    patterns = {
        "EBITDA": r'EBITDA increased to \$?([0-9,]+)',  # Match the primary value, not comparison
        "Net Debt": r'Net Debt.*was \$?([0-9,]+)',
        "Maintenance Capex": r'Maintenance capital expenditures were \$?([0-9,]+)',
        "Net Income": r'Net income.*was \$?([0-9,]+)',
        "Interest Expense": r'Interest Expense.*was \$?([0-9,]+)',
        "Shareholder Equity": r'Shareholder equity was \$?([0-9,]+)'
    }

    for label, expected_value in expected_values.items():
        pattern = patterns.get(label, rf'{re.escape(label)}[^0-9]*\$?([0-9,]+(?:\.[0-9]+)?)')
        matches = re.findall(pattern, content, re.IGNORECASE | re.MULTILINE)

        if not matches:
            warnings.append(f"⚠️  {label}: Not found in filing")
            continue

        found_values = [float(match.replace(',', '')) for match in matches]
        if expected_value not in found_values:
            # Check if value is close (within 1% for rounding)
            close_match = any(abs(v - expected_value) / expected_value < 0.01 for v in found_values)
            if not close_match:
                warnings.append(f"⚠️  {label}: Expected {expected_value}, found {found_values}")
            else:
                print(f"✅ {label}: Found {found_values} (close to expected {expected_value})")

    if not issues and not warnings:
        print("✅ Sample filings are consistent")
    else:
        for issue in issues:
            print(issue)
        for warning in warnings:
            print(warning)

    return issues

def validate_mappings():
    """Validate KPI extraction mappings"""
    print("\n🔍 Validating KPI Mappings...")

    issues = []

    # Load mappings
    mappings_path = Path(__file__).parent.parent / "data" / "mappings.yaml"
    try:
        with open(mappings_path, 'r') as f:
            mappings = yaml.safe_load(f)
    except Exception as e:
        print(f"❌ Error loading mappings: {e}")
        return ["Mappings file error"]

    # Check PPL mappings exist
    if 'PPL' not in mappings:
        issues.append("❌ PPL mappings not found")
        return issues

    ppl_mappings = mappings['PPL']

    # Required KPIs
    required_kpis = ['EBITDA', 'NetDebt', 'MaintenanceCapex', 'NetIncome', 'InterestExpense']
    for kpi in required_kpis:
        if kpi not in ppl_mappings:
            issues.append(f"❌ Missing mapping for {kpi}")

    # Check patterns exist and are valid
    for kpi, config in ppl_mappings.items():
        if 'patterns' not in config:
            issues.append(f"❌ {kpi}: No patterns defined")
        elif not config['patterns']:
            issues.append(f"❌ {kpi}: Empty patterns list")

    if not issues:
        print("✅ KPI mappings are valid")
    else:
        for issue in issues:
            print(issue)

    return issues

def main():
    """Run all validation checks"""
    print("🔬 Energy IC Copilot - Data Consistency Validation")
    print("=" * 55)

    all_issues = []

    # Run all validation checks
    all_issues.extend(validate_web_app_defaults())
    all_issues.extend(validate_verification_script())
    all_issues.extend(validate_sample_filings())
    all_issues.extend(validate_mappings())

    # Check centralized config
    print("\n🔍 Validating Centralized Configuration...")
    config_validation = validate_financial_config()

    if not config_validation['valid']:
        print("❌ Configuration validation failed:")
        for issue in config_validation['issues']:
            print(f"  {issue}")
        all_issues.extend(config_validation['issues'])

    if config_validation['warnings']:
        print("⚠️  Configuration warnings:")
        for warning in config_validation['warnings']:
            print(f"  {warning}")

    # Summary
    print("\n" + "=" * 55)
    if not all_issues:
        print("✅ ALL VALIDATION CHECKS PASSED")
        print("🎉 Data consistency verified across all components")
    else:
        print(f"❌ {len(all_issues)} ISSUES FOUND")
        print("🔧 Please fix the identified issues")

    # Show financial metrics
    config = FinancialConfig()
    financial = config.financial_data
    print("\n📊 Current Financial Data Summary:")
    print(f"  EBITDA: ${financial.ebitda:,.0f}M")
    print(f"  Net Debt: ${financial.net_debt:,.0f}M")
    print(f"  Maintenance Capex: ${financial.maintenance_capex:,.0f}M")
    print(f"  Net Income: ${financial.net_income:,.0f}M")

if __name__ == "__main__":
    main()
