"""
Data Management System for SEC Financial Filings
Manages automatic updates of financial data from latest SEC filings
Integrates with existing configuration and KPI extraction systems
"""

import json
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass

from .edgar_client import SECEdgarClient, get_sec_client
from .xbrl_client import XBRLClient, parse_core_metrics, parse_core_metrics_with_meta
from .extract import KPIExtractor
from .config import FinancialConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class FilingMetadata:
    """Metadata for a SEC filing"""
    ticker: str
    form_type: str
    filing_date: str
    accession_number: str
    last_updated: str
    data_quality: str  # 'excellent', 'good', 'fair', 'poor'

@dataclass
class DataUpdateResult:
    """Result of a data update operation"""
    ticker: str
    success: bool
    filing_date: Optional[str]
    metrics_extracted: int
    error_message: Optional[str]
    last_updated: str

class SECDataManager:
    """
    Manages SEC financial data updates and integration
    Provides automated retrieval, validation, and integration of latest filings
    """

    def __init__(self, data_dir: Path = None, user_agent: str = None):
        """
        Initialize data manager

        Args:
            data_dir: Base data directory (default: project data directory)
            user_agent: SEC API user agent string
        """
        if data_dir is None:
            data_dir = Path(__file__).parent.parent / "data"

        self.data_dir = data_dir
        self.filings_dir = data_dir / "filings"
        self.metadata_file = data_dir / "filing_metadata.json"
        self.config_file = data_dir / "default_financial_inputs.yaml"

        # Initialize SEC client
        if user_agent is None:
            user_agent = "EnergyICCopilot/1.0 (admin@energyiccopilot.com)"
        self.sec_client = get_sec_client(user_agent)
        self.xbrl_client = XBRLClient(user_agent)

        # Initialize KPI extractor
        mappings_path = data_dir / "mappings.yaml"
        if mappings_path.exists():
            self.kpi_extractor = KPIExtractor(mappings_path)
        else:
            self.kpi_extractor = None
            logger.warning("KPI mappings file not found")

        # Load existing metadata
        self.metadata = self._load_metadata()

    def _load_metadata(self) -> Dict[str, FilingMetadata]:
        """Load filing metadata from JSON file"""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r') as f:
                    data = json.load(f)
                    return {
                        ticker: FilingMetadata(**meta)
                        for ticker, meta in data.items()
                    }
            except Exception as e:
                logger.error(f"Failed to load metadata: {e}")

        return {}

    def _save_metadata(self):
        """Save filing metadata to JSON file"""
        try:
            data = {
                ticker: {
                    'ticker': meta.ticker,
                    'form_type': meta.form_type,
                    'filing_date': meta.filing_date,
                    'accession_number': meta.accession_number,
                    'last_updated': meta.last_updated,
                    'data_quality': meta.data_quality
                }
                for ticker, meta in self.metadata.items()
            }

            with open(self.metadata_file, 'w') as f:
                json.dump(data, f, indent=2)

        except Exception as e:
            logger.error(f"Failed to save metadata: {e}")

    def check_for_updates(self, ticker: str, days_threshold: int = 30) -> bool:
        """
        Check if a company's data needs updating

        Args:
            ticker: Company ticker symbol
            days_threshold: Days since last update to trigger refresh

        Returns:
            True if update is needed
        """
        if ticker not in self.metadata:
            return True

        last_update = datetime.fromisoformat(self.metadata[ticker].last_updated)
        days_since_update = (datetime.now() - last_update).days

        return days_since_update >= days_threshold

    def update_company_data(self, ticker: str, force: bool = False) -> DataUpdateResult:
        """
        Update financial data for a specific company

        Args:
            ticker: Company ticker symbol
            force: Force update even if recent data exists

        Returns:
            Update result with success status and details
        """
        try:
            logger.info(f"Updating data for {ticker}")

            # Check if update is needed
            if not force and not self.check_for_updates(ticker):
                return DataUpdateResult(
                    ticker=ticker,
                    success=True,
                    filing_date=self.metadata[ticker].filing_date,
                    metrics_extracted=0,
                    error_message="Data is current",
                    last_updated=datetime.now().isoformat()
                )

            # Get latest filing from SEC
            latest_filing = self.sec_client.get_latest_10q(ticker) or self.sec_client.get_latest_10k(ticker)

            if not latest_filing:
                return DataUpdateResult(
                    ticker=ticker,
                    success=False,
                    filing_date=None,
                    metrics_extracted=0,
                    error_message="No recent filings found",
                    last_updated=datetime.now().isoformat()
                )

            # Download filing content (prefer MD&A section for KPI accuracy)
            content = self.sec_client.get_latest_mdna(ticker)
            if not content:
                content = self.sec_client.get_filing_content(
                    latest_filing['accession_number'],
                    latest_filing['primary_document']
                )

            if not content:
                return DataUpdateResult(
                    ticker=ticker,
                    success=False,
                    filing_date=latest_filing['filing_date'],
                    metrics_extracted=0,
                    error_message="Failed to download filing content",
                    last_updated=datetime.now().isoformat()
                )

            # Extract KPIs if extractor is available
            metrics_extracted = 0
            if self.kpi_extractor:
                try:
                    # Save content to temporary file for extraction
                    temp_file = self.filings_dir / f"{ticker.lower()}_temp.txt"
                    with open(temp_file, 'w', encoding='utf-8') as f:
                        f.write(content)

                    kpis = self.kpi_extractor.extract_from_file(temp_file, ticker)
                    metrics_extracted = len(kpis)

                    # Clean up temp file
                    temp_file.unlink(missing_ok=True)

                except Exception as e:
                    logger.warning(f"KPI extraction failed for {ticker}: {e}")

            # Update metadata
            self.metadata[ticker] = FilingMetadata(
                ticker=ticker,
                form_type=latest_filing['form_type'],
                filing_date=latest_filing['filing_date'],
                accession_number=latest_filing['accession_number'],
                last_updated=datetime.now().isoformat(),
                data_quality='excellent' if metrics_extracted > 5 else 'good'
            )

            self._save_metadata()

            return DataUpdateResult(
                ticker=ticker,
                success=True,
                filing_date=latest_filing['filing_date'],
                metrics_extracted=metrics_extracted,
                error_message=None,
                last_updated=datetime.now().isoformat()
            )

        except Exception as e:
            logger.error(f"Failed to update {ticker}: {e}")
            return DataUpdateResult(
                ticker=ticker,
                success=False,
                filing_date=None,
                metrics_extracted=0,
                error_message=str(e),
                last_updated=datetime.now().isoformat()
            )

    def update_all_companies(self, force: bool = False) -> List[DataUpdateResult]:
        """
        Update financial data for all tracked companies

        Args:
            force: Force update for all companies regardless of last update date

        Returns:
            List of update results
        """
        results = []

        for ticker in self.sec_client.company_ciks.keys():
            try:
                result = self.update_company_data(ticker, force)
                results.append(result)

                # Small delay to respect SEC rate limits
                import time
                time.sleep(0.5)

            except Exception as e:
                logger.error(f"Error updating {ticker}: {e}")
                results.append(DataUpdateResult(
                    ticker=ticker,
                    success=False,
                    filing_date=None,
                    metrics_extracted=0,
                    error_message=str(e),
                    last_updated=datetime.now().isoformat()
                ))

        return results

    def get_data_status(self) -> Dict[str, Any]:
        """
        Get comprehensive status of financial data

        Returns:
            Dictionary with data status information
        """
        status = {
            'total_companies': len(self.sec_client.company_ciks),
            'companies_with_data': len(self.metadata),
            'last_update_check': datetime.now().isoformat(),
            'companies': {}
        }

        for ticker in self.sec_client.company_ciks.keys():
            if ticker in self.metadata:
                meta = self.metadata[ticker]
                days_since_update = (datetime.now() - datetime.fromisoformat(meta.last_updated)).days

                status['companies'][ticker] = {
                    'has_data': True,
                    'filing_date': meta.filing_date,
                    'form_type': meta.form_type,
                    'last_updated': meta.last_updated,
                    'days_since_update': days_since_update,
                    'data_quality': meta.data_quality,
                    'needs_update': days_since_update > 30
                }
            else:
                status['companies'][ticker] = {
                    'has_data': False,
                    'needs_update': True
                }

        return status

    def get_latest_financial_data(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Get the latest financial data for a company

        Args:
            ticker: Company ticker symbol

        Returns:
            Dictionary with latest financial data or None
        """
        if ticker not in self.metadata:
            return None

        try:
            # Get latest filing
            filing = self.sec_client.get_latest_10q(ticker) or self.sec_client.get_latest_10k(ticker)

            if not filing:
                return None

            # Get content and extract KPIs (prefer MD&A)
            content = self.sec_client.get_latest_mdna(ticker)
            if not content:
                content = self.sec_client.get_filing_content(
                    filing['accession_number'],
                    filing['primary_document']
                )

            if not content or not self.kpi_extractor:
                return None

            # Extract KPIs
            temp_file = self.filings_dir / f"{ticker.lower()}_latest.txt"
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(content)

            kpis = self.kpi_extractor.extract_from_file(temp_file, ticker)
            temp_file.unlink(missing_ok=True)

            return {
                'ticker': ticker,
                'filing_date': filing['filing_date'],
                'form_type': filing['form_type'],
                'kpis': {
                    name: {
                        'value': kpi.value,
                        'unit': kpi.unit,
                        'citation': kpi.citation.to_dict()
                    }
                    for name, kpi in kpis.items()
                },
                'extracted_at': datetime.now().isoformat()
            }

        except Exception as e:
            logger.error(f"Failed to get latest data for {ticker}: {e}")
            return None

    def get_latest_financials_xbrl(self, ticker: str, period: str = "any") -> Optional[Dict[str, Any]]:
        """
        Fetch standardized metrics from SEC XBRL companyfacts for the given ticker.
        Returns values normalized to millions where applicable.
        """
        try:
            if ticker not in self.sec_client.company_ciks:
                return None
            cik = self.sec_client.company_ciks[ticker]
            facts = self.xbrl_client.get_company_facts(cik)
            # Map period to frame preference for flow metrics
            period_map = {"ytd": "YTD", "qtd": "QTD", "quarter": "QTD", "any": "ANY"}
            flow_pref = period_map.get((period or "any").lower(), "ANY")
            metrics, details = parse_core_metrics_with_meta(facts, flow_frame_pref=flow_pref)

            return {
                'ticker': ticker,
                'cik': cik,
                'metrics_millions': metrics,
                'source': 'SEC XBRL companyfacts',
                'retrieved_at': datetime.now().isoformat(),
                'facts_meta': details,
                'period_preference': flow_pref
            }
        except Exception as e:
            logger.error(f"XBRL fetch/parse failed for {ticker}: {e}")
            return None

    def validate_data_quality(self, ticker: str) -> Dict[str, Any]:
        """
        Validate the quality of financial data for a company

        Args:
            ticker: Company ticker symbol

        Returns:
            Dictionary with quality metrics
        """
        quality_report = {
            'ticker': ticker,
            'overall_quality': 'unknown',
            'metrics': {},
            'issues': []
        }

        try:
            # Get latest data
            data = self.get_latest_financial_data(ticker)

            if not data:
                quality_report['issues'].append('No data available')
                quality_report['overall_quality'] = 'poor'
                return quality_report

            kpis = data['kpis']
            quality_report['metrics']['total_kpis'] = len(kpis)

            # Check for key financial metrics
            required_metrics = ['EBITDA', 'NetDebt', 'NetIncome']
            found_metrics = sum(1 for metric in required_metrics if metric in kpis)

            quality_report['metrics']['required_metrics_found'] = found_metrics
            quality_report['metrics']['required_metrics_total'] = len(required_metrics)

            # Assess data completeness
            if found_metrics == len(required_metrics):
                if len(kpis) >= 5:
                    quality_report['overall_quality'] = 'excellent'
                else:
                    quality_report['overall_quality'] = 'good'
            elif found_metrics >= 2:
                quality_report['overall_quality'] = 'fair'
            else:
                quality_report['overall_quality'] = 'poor'
                quality_report['issues'].append('Missing key financial metrics')

            # Check data freshness
            filing_date = datetime.fromisoformat(data['filing_date'])
            days_old = (datetime.now() - filing_date).days

            if days_old > 90:
                quality_report['issues'].append(f'Data is {days_old} days old')
                quality_report['overall_quality'] = 'fair'

            quality_report['metrics']['days_since_filing'] = days_old

        except Exception as e:
            quality_report['issues'].append(f'Quality check failed: {str(e)}')
            quality_report['overall_quality'] = 'poor'

        return quality_report


# Convenience functions
def create_data_manager(data_dir: Path = None, user_agent: str = None) -> SECDataManager:
    """
    Create and configure a SEC data manager

    Args:
        data_dir: Data directory path
        user_agent: SEC API user agent string

    Returns:
        Configured SEC data manager
    """
    return SECDataManager(data_dir, user_agent)


def update_all_financial_data(force: bool = False) -> List[DataUpdateResult]:
    """
    Update financial data for all companies

    Args:
        force: Force update for all companies

    Returns:
        List of update results
    """
    manager = create_data_manager()
    return manager.update_all_companies(force)


if __name__ == "__main__":
    # Example usage
    manager = create_data_manager()

    print("=== SEC Data Manager Test ===")

    # Check data status
    status = manager.get_data_status()
    print(f"Total companies: {status['total_companies']}")
    print(f"Companies with data: {status['companies_with_data']}")

    # Update PPL data
    print("\n=== Updating PPL Data ===")
    result = manager.update_company_data('PPL')
    print(f"Success: {result.success}")
    print(f"Filing date: {result.filing_date}")
    print(f"Metrics extracted: {result.metrics_extracted}")

    # Check data quality
    print("\n=== PPL Data Quality ===")
    quality = manager.validate_data_quality('PPL')
    print(f"Overall quality: {quality['overall_quality']}")
    print(f"Metrics: {quality['metrics']}")
    if quality['issues']:
        print(f"Issues: {quality['issues']}")
