"""
SEC EDGAR API Client for fetching latest financial filings
Provides automated retrieval of 10-K, 10-Q, and 8-K filings from SEC EDGAR database
"""

import requests
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import re
import logging
from urllib.parse import urljoin

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SECEdgarClient:
    """
    SEC EDGAR API Client for automated filing retrieval
    Fetches latest 10-K, 10-Q, and 8-K filings for energy infrastructure companies
    """

    BASE_URL = "https://www.sec.gov"
    EDGAR_API_BASE = "https://data.sec.gov"

    # Rate limiting: SEC allows 10 requests per second, 100 per minute
    REQUEST_DELAY = 0.15  # 150ms delay between requests

    def __init__(self, user_agent: str = "EnergyICCopilot/1.0"):
        """
        Initialize SEC EDGAR client

        Args:
            user_agent: User agent string for SEC API requests (required by SEC)
        """
        self.user_agent = user_agent
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': self.user_agent,
            'Accept-Encoding': 'gzip, deflate'
        })

        # Company CIK mappings for energy infrastructure companies
        self.company_ciks = {
            'PPL': '0000922224',   # Pembina Pipeline Corporation
            'ENB': '0000895728',   # Enbridge Inc.
            'TRP': '0000867962',   # TC Energy Corporation
            'KEY': '0000315293',   # Keyera Corp.
            'MMP': '0001126975',   # Magellan Midstream Partners, L.P.
            'KMI': '0001506307',   # Kinder Morgan, Inc.
            'OKE': '0001039684',   # ONEOK, Inc.
            'WMB': '0000107263',   # The Williams Companies, Inc.
            'ET': '0001276187',    # Energy Transfer LP
            'TRGP': '0001389170'   # Targa Resources Corp.
        }

        self._last_request_time = None

    def _rate_limit(self):
        """Implement rate limiting for SEC API requests"""
        if self._last_request_time:
            elapsed = time.time() - self._last_request_time
            if elapsed < self.REQUEST_DELAY:
                time.sleep(self.REQUEST_DELAY - elapsed)
        self._last_request_time = time.time()

    def _make_request(self, url: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Make a rate-limited request to SEC API

        Args:
            url: API endpoint URL
            params: Query parameters

        Returns:
            JSON response data
        """
        self._rate_limit()

        try:
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()

            # SEC API returns JSON
            return response.json()

        except requests.exceptions.RequestException as e:
            logger.error(f"SEC API request failed: {e}")
            raise

    def get_company_filings(self, ticker: str, form_types: List[str] = None,
                          start_date: Optional[str] = None,
                          end_date: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get company filings from SEC EDGAR

        Args:
            ticker: Company ticker symbol
            form_types: List of form types to retrieve (default: ['10-K', '10-Q'])
            start_date: Start date in YYYY-MM-DD format (default: 1 year ago)
            end_date: End date in YYYY-MM-DD format (default: today)

        Returns:
            List of filing metadata
        """
        if ticker not in self.company_ciks:
            raise ValueError(f"Unknown ticker: {ticker}. Available: {list(self.company_ciks.keys())}")

        if form_types is None:
            form_types = ['10-K', '10-Q']

        if start_date is None:
            start_date = (datetime.now() - timedelta(days=365)).strftime('%Y-%m-%d')

        if end_date is None:
            end_date = datetime.now().strftime('%Y-%m-%d')

        cik = self.company_ciks[ticker]

        # SEC EDGAR submissions API
        url = f"{self.EDGAR_API_BASE}/submissions/CIK{cik.zfill(10)}.json"

        try:
            data = self._make_request(url)

            filings = []
            recent_filings = data.get('filings', {}).get('recent', {})

            if recent_filings:
                forms = recent_filings.get('form', [])
                dates = recent_filings.get('filingDate', [])
                primary_docs = recent_filings.get('primaryDocument', [])
                accession_numbers = recent_filings.get('accessionNumber', [])

                for i, form in enumerate(forms):
                    if form in form_types:
                        filing_date = dates[i] if i < len(dates) else None
                        if filing_date and start_date <= filing_date <= end_date:
                            filings.append({
                                'form_type': form,
                                'filing_date': filing_date,
                                'accession_number': accession_numbers[i] if i < len(accession_numbers) else None,
                                'primary_document': primary_docs[i] if i < len(primary_docs) else None,
                                'company': ticker,
                                'cik': cik
                            })

            return sorted(filings, key=lambda x: x['filing_date'], reverse=True)

        except Exception as e:
            logger.error(f"Failed to get filings for {ticker}: {e}")
            return []

    def get_filing_content(self, accession_number: str, document_name: str) -> Optional[str]:
        """
        Download filing content from SEC EDGAR

        Args:
            accession_number: Filing accession number
            document_name: Primary document name

        Returns:
            Filing content as text
        """
        if not accession_number or not document_name:
            return None

        # Extract numeric CIK and cleaned accession number per EDGAR URL structure
        try:
            cik_padded = accession_number.split('-')[0]
            cik_numeric = str(int(cik_padded))  # drop leading zeros
        except Exception:
            cik_numeric = accession_number[:10].lstrip('0') or accession_number[:10]

        clean_accession = accession_number.replace('-', '')

        # Construct filing URL: /Archives/edgar/data/{CIK}/{ACCESSION_NO_NO_DASHES}/{PRIMARY_DOC}
        url = f"{self.BASE_URL}/Archives/edgar/data/{cik_numeric}/{clean_accession}/{document_name}"

        try:
            self._rate_limit()
            response = self.session.get(url, timeout=30)
            response.raise_for_status()

            # Convert to text (usually HTML, but we'll extract text content)
            content = response.text

            # Basic HTML cleaning for text extraction
            # Remove scripts and styles
            content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.DOTALL | re.IGNORECASE)
            content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.DOTALL | re.IGNORECASE)

            # Extract text from HTML
            content = re.sub(r'<[^>]+>', ' ', content)
            content = re.sub(r'\s+', ' ', content).strip()

            return content

        except Exception as e:
            logger.error(f"Failed to download filing content: {e}")
            return None

    def get_latest_10q(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Get the latest 10-Q filing for a company

        Args:
            ticker: Company ticker symbol

        Returns:
            Latest 10-Q filing metadata or None
        """
        filings = self.get_company_filings(ticker, ['10-Q'])
        return filings[0] if filings else None

    def get_latest_10k(self, ticker: str) -> Optional[Dict[str, Any]]:
        """
        Get the latest 10-K filing for a company

        Args:
            ticker: Company ticker symbol

        Returns:
            Latest 10-K filing metadata or None
        """
        filings = self.get_company_filings(ticker, ['10-K'])
        return filings[0] if filings else None

    def get_latest_mdna(self, ticker: str) -> Optional[str]:
        """
        Get the latest Management's Discussion and Analysis section

        Args:
            ticker: Company ticker symbol

        Returns:
            MD&A content as text or None
        """
        # Try 10-Q first (more recent), then 10-K
        filing = self.get_latest_10q(ticker) or self.get_latest_10k(ticker)

        if not filing:
            return None

        content = self.get_filing_content(
            filing['accession_number'],
            filing['primary_document']
        )

        if content:
            # Extract MD&A section (basic pattern matching)
            mda_pattern = r'(?i)(?:MANAGEMENT.?S DISCUSSION AND ANALYSIS|MD&A)(.*?)(?:QUANTITATIVE AND QUALITATIVE|FINANCIAL STATEMENTS|CHANGES IN)'
            match = re.search(mda_pattern, content, re.DOTALL)

            if match:
                return match.group(1).strip()
            else:
                # Return full content if MD&A section not clearly identified
                return content

        return None

    def update_company_filings(self, ticker: str, output_dir: Path) -> bool:
        """
        Update local filings for a company with latest from SEC

        Args:
            ticker: Company ticker symbol
            output_dir: Directory to save filing files

        Returns:
            True if successful, False otherwise
        """
        try:
            logger.info(f"Updating filings for {ticker}")

            # Get latest 10-Q (most recent)
            latest_filing = self.get_latest_10q(ticker)

            if not latest_filing:
                logger.warning(f"No recent filings found for {ticker}")
                return False

            # Download content
            content = self.get_filing_content(
                latest_filing['accession_number'],
                latest_filing['primary_document']
            )

            if not content:
                logger.error(f"Failed to download content for {ticker}")
                return False

            # Save to file
            output_dir.mkdir(parents=True, exist_ok=True)
            filename = f"{ticker.lower()}_{latest_filing['filing_date'].replace('-', '_')}_mda.txt"
            filepath = output_dir / filename

            with open(filepath, 'w', encoding='utf-8') as f:
                # Add header information
                f.write(f"{ticker.upper()} CORPORATION\n")
                f.write("Management's Discussion and Analysis\n")
                f.write(f"For the period ended {latest_filing['filing_date']}\n")
                f.write("Downloaded from SEC EDGAR\n\n")
                f.write(content)

            logger.info(f"Updated {ticker} filing: {filepath}")
            return True

        except Exception as e:
            logger.error(f"Failed to update filings for {ticker}: {e}")
            return False

    def update_all_companies(self, output_dir: Path) -> Dict[str, bool]:
        """
        Update filings for all tracked companies

        Args:
            output_dir: Directory to save filing files

        Returns:
            Dictionary mapping ticker to success status
        """
        results = {}

        for ticker in self.company_ciks.keys():
            try:
                success = self.update_company_filings(ticker, output_dir)
                results[ticker] = success
                time.sleep(1)  # Additional delay between companies
            except Exception as e:
                logger.error(f"Error updating {ticker}: {e}")
                results[ticker] = False

        return results

    def get_filing_metadata(self, ticker: str) -> Dict[str, Any]:
        """
        Get comprehensive filing metadata for a company

        Args:
            ticker: Company ticker symbol

        Returns:
            Dictionary with filing metadata
        """
        filings_10q = self.get_company_filings(ticker, ['10-Q'], start_date='2023-01-01')
        filings_10k = self.get_company_filings(ticker, ['10-K'], start_date='2023-01-01')

        return {
            'company': ticker,
            'cik': self.company_ciks.get(ticker),
            'latest_10q': filings_10q[0] if filings_10q else None,
            'latest_10k': filings_10k[0] if filings_10k else None,
            'total_filings': len(filings_10q) + len(filings_10k),
            'last_updated': datetime.now().isoformat()
        }


# Convenience functions
def get_sec_client(user_agent: str = "EnergyICCopilot/1.0 (contact@example.com)") -> SECEdgarClient:
    """
    Get configured SEC EDGAR client

    Args:
        user_agent: User agent string (include contact email as required by SEC)

    Returns:
        Configured SEC EDGAR client
    """
    return SECEdgarClient(user_agent)


def update_all_filings(output_dir: Path, user_agent: str = None) -> Dict[str, bool]:
    """
    Update all company filings from SEC EDGAR

    Args:
        output_dir: Directory to save filings
        user_agent: User agent string for SEC API

    Returns:
        Dictionary mapping ticker to update success
    """
    if user_agent is None:
        user_agent = "EnergyICCopilot/1.0 (admin@energyiccopilot.com)"

    client = get_sec_client(user_agent)
    return client.update_all_companies(output_dir)


if __name__ == "__main__":
    # Example usage
    client = get_sec_client()

    # Test with PPL
    print("Testing PPL filings...")
    filings = client.get_company_filings('PPL', ['10-Q', '10-K'])
    print(f"Found {len(filings)} filings for PPL")

    if filings:
        latest = filings[0]
        print(f"Latest filing: {latest['form_type']} on {latest['filing_date']}")

        # Get MD&A content
        mda_content = client.get_latest_mdna('PPL')
        if mda_content:
            print(f"MD&A content length: {len(mda_content)} characters")
            print("MD&A preview:")
            print(mda_content[:500] + "...")
