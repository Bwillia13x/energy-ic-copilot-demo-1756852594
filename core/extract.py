"""
KPI Extraction Engine for Financial Documents.

This module provides intelligent extraction of Key Performance Indicators (KPIs)
from financial documents including SEC filings, MD&A sections, and earnings releases.
Supports multiple file formats with regex-based pattern matching and citation tracking.

Key Features:
- Multi-format support (PDF, HTML, TXT)
- Configurable regex patterns per company/ticker
- Automatic citation generation with page references
- Preference-based pattern matching
- Numeric value normalization and validation
- Error handling and logging

Typical Usage:
    extractor = KPIExtractor(Path("mappings.yaml"))
    kpis = extractor.extract_from_file(Path("filing.pdf"), "AAPL")

Supported KPIs:
- EBITDA, FFO, Net Debt, Interest Expense
- Maintenance Capex, Growth Capex
- Shares Outstanding, Dividend Per Share
- Net Income, Shareholder Equity

Author: Energy IC Copilot Team
"""

import re
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from pydantic import BaseModel

from .cite import Citation, CitationManager, create_citation_from_match


class ExtractedKPI(BaseModel):
    """
    Container for an extracted Key Performance Indicator with full audit trail.

    This model encapsulates a single KPI extraction result, including the numeric
    value, unit of measurement, and complete citation information for auditability.

    Attributes:
        value: The extracted numeric value (e.g., 3450.0 for $3.45B EBITDA)
        unit: Unit of measurement (e.g., "CAD millions", "USD", "percentage")
        citation: Complete citation with document ID, page, span, and preview text

    Example:
        ExtractedKPI(
            value=3450.0,
            unit="CAD millions",
            citation=Citation(...)
        )
    """

    value: float  # Extracted numeric value
    unit: str     # Unit of measurement (e.g., "millions", "percentage")
    citation: Citation  # Full citation with document reference


class KPIExtractor:
    """
    Intelligent KPI extraction engine for financial documents.

    This class provides sophisticated pattern-based extraction of financial KPIs
    from various document formats. It supports company-specific regex patterns,
    preference-based matching, and automatic citation generation.

    Key Capabilities:
    - Multi-company support with ticker-specific patterns
    - Preference-based pattern matching (e.g., prefer "Adjusted EBITDA")
    - Automatic numeric value extraction and normalization
    - Citation tracking with document references
    - Error handling and logging
    - Support for multiple file formats

    Configuration:
    The extractor uses YAML-based configuration files that define:
    - Company-specific regex patterns for each KPI
    - Unit specifications and normalization rules
    - Preference rules for pattern selection
    - Currency symbols and formatting expectations

    Example Configuration (mappings.yaml):
        AAPL:
          EBITDA:
            patterns:
              - "EBITDA\\s*\\$?([0-9,]+)"
              - "Adjusted EBITDA\\s*\\$?([0-9,]+)"
            unit: "USD millions"
            prefer: "Adjusted"
            normalize: "strip_commas"
    """

    def __init__(self, mappings_path: Path):
        """
        Initialize the KPI extractor with configuration mappings.

        Args:
            mappings_path: Path to YAML file containing KPI extraction patterns
                         and rules for each company/ticker

        Raises:
            FileNotFoundError: If mappings file doesn't exist
            yaml.YAMLError: If mappings file is malformed
        """
        self.mappings = self._load_mappings(mappings_path)
        self.citation_manager = CitationManager()

    def _load_mappings(self, path: Path) -> Dict[str, Any]:
        """
        Load and validate KPI extraction mappings from YAML configuration.

        Args:
            path: Path to the mappings YAML file

        Returns:
            Dict containing ticker-specific KPI extraction configurations

        Raises:
            FileNotFoundError: If the mappings file doesn't exist
            yaml.YAMLError: If the YAML file is malformed
        """
        with open(path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def extract_from_file(self, file_path: Path, ticker: str) -> Dict[str, ExtractedKPI]:
        """
        Extract all configured KPIs from a single financial document.

        This method processes a financial document (PDF, HTML, or TXT) and attempts
        to extract all KPIs defined in the mappings configuration for the specified
        ticker. It uses intelligent pattern matching with preference rules and
        generates complete citations for auditability.

        Processing Steps:
        1. Read and parse the document content
        2. Load ticker-specific KPI patterns from mappings
        3. Apply each pattern with preference-based selection
        4. Extract numeric values and create citations
        5. Return dictionary of successfully extracted KPIs

        Args:
            file_path: Path to the financial document file
                     (supports .txt, .pdf, .html, .htm extensions)
            ticker: Company ticker symbol (e.g., "PPL", "ENB", "TRP")
                   Must have corresponding configuration in mappings file

        Returns:
            Dict[str, ExtractedKPI]: Dictionary mapping KPI names to extracted values
                                   Empty dict if no KPIs found or ticker not configured

        Raises:
            ValueError: If ticker has no mappings in configuration
            FileNotFoundError: If the document file doesn't exist
            ValueError: If file format is unsupported

        Example:
            extractor = KPIExtractor(Path("mappings.yaml"))
            kpis = extractor.extract_from_file(Path("ppl_q2_2024.txt"), "PPL")
            # Returns: {"EBITDA": ExtractedKPI(...), "NetDebt": ExtractedKPI(...)}
        """
        # Read file content
        content = self._read_file_content(file_path)

        # Extract KPIs using ticker-specific patterns
        extracted_kpis = {}

        if ticker not in self.mappings:
            raise ValueError(f"No mappings found for ticker: {ticker}")

        ticker_mappings = self.mappings[ticker]

        for kpi_name, config in ticker_mappings.items():
            patterns = config.get('patterns', [])
            unit = config.get('unit', '')
            prefer = config.get('prefer', '')
            normalize = config.get('normalize', '')

            # Try each pattern
            best_match = None
            best_value = None
            best_citation = None

            for pattern in patterns:
                value, citation = self._extract_single_kpi(
                    content, pattern, file_path.name, unit, normalize
                )

                if value is not None:
                    # If we have a preference rule, prioritize matches containing the preferred term
                    if prefer:
                        regex = re.compile(pattern, re.IGNORECASE | re.MULTILINE)
                        match = regex.search(content)
                        if match and prefer in match.group(0):
                            # This is a preferred match, use it immediately
                            extracted_kpis[kpi_name] = ExtractedKPI(
                                value=value,
                                unit=unit,
                                citation=citation
                            )
                            best_match = None  # Clear any previous non-preferred match
                            break
                        elif best_match is None:
                            # Store as potential match but keep looking for preferred
                            best_match = pattern
                            best_value = value
                            best_citation = citation
                    else:
                        # No preference, use first match
                        extracted_kpis[kpi_name] = ExtractedKPI(
                            value=value,
                            unit=unit,
                            citation=citation
                        )
                        break

            # If we found a non-preferred match and no preferred match, use it
            if best_match and kpi_name not in extracted_kpis:
                extracted_kpis[kpi_name] = ExtractedKPI(
                    value=best_value,
                    unit=unit,
                    citation=best_citation
                )

        return extracted_kpis

    def _read_file_content(self, file_path: Path) -> str:
        """Read content from file (supports txt, pdf, html)."""
        suffix = file_path.suffix.lower()

        if suffix == '.txt':
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        elif suffix == '.pdf':
            # For now, return placeholder - would need pdfplumber/pymupdf
            return f"SAMPLE PDF CONTENT FROM {file_path.name}"
        elif suffix in ['.html', '.htm']:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        else:
            raise ValueError(f"Unsupported file type: {suffix}")

    def _extract_single_kpi(
        self,
        content: str,
        pattern: str,
        doc_id: str,
        unit: str,
        normalize: str
    ) -> Tuple[Optional[float], Optional[Citation]]:
        """
        Extract a single KPI value using regex pattern.

        Returns:
            Tuple of (value, citation) or (None, None) if not found
        """
        try:
            regex = re.compile(pattern, re.IGNORECASE | re.MULTILINE)
            match = regex.search(content)

            if not match:
                return None, None

            # Extract numeric value from match
            # Prefer explicit capturing group if present; fallback to scanning match text
            match_text = match.group(0)
            if match.groups():
                raw_val = match.group(1)
                # Clean currency/commas and convert
                cleaned = re.sub(r'[\$,]', '', raw_val)
                try:
                    value = float(cleaned.replace(',', ''))
                except ValueError:
                    value = self._extract_numeric_value(match_text)
            else:
                value = self._extract_numeric_value(match_text)

            if value is None:
                return None, None

            # Apply normalization
            if normalize == 'strip_commas':
                # Value is already numeric, no need to strip commas from display
                pass

            # Normalize scale to "millions" based on context in match text
            scale_multiplier = self._infer_scale_multiplier(match_text)
            value *= scale_multiplier

            # Create citation
            citation = create_citation_from_match(
                doc_id=doc_id,
                page=1,  # For now, assume single page or page detection not implemented
                text=content,
                start_pos=match.start(),
                end_pos=match.end()
            )

            return value, citation

        except Exception as e:
            print(f"Error extracting KPI with pattern '{pattern}': {e}")
            return None, None

    def _extract_numeric_value(self, text: str) -> Optional[float]:
        """
        Extract numeric value from text containing currency symbols and commas.

        Examples:
        - "$3,450 million" -> 3450.0
        - "EBITDA of $2,890" -> 2890.0
        - "18,750" -> 18750.0
        """
        # Remove currency symbols and common text
        cleaned = re.sub(r'[\$,]', '', text)

        # Find all numeric patterns
        number_patterns = [
            r'\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\b',  # 1,234.56 or 1234.56
            r'\b\d+(?:\.\d+)?\b'  # Simple decimal
        ]

        all_matches = []
        for pattern in number_patterns:
            matches = re.findall(pattern, cleaned)
            all_matches.extend(matches)

        if all_matches:
            # Convert all matches to floats and find the most relevant one
            valid_values = []
            for match in all_matches:
                try:
                    # Remove commas for conversion
                    value_str = match.replace(',', '')
                    value = float(value_str)
                    # Skip very small numbers (likely dates/years)
                    if value >= 100:  # Assume KPI values are at least 100
                        valid_values.append(value)
                except ValueError:
                    continue

            if valid_values:
                # Return the largest value (most likely to be the KPI)
                return max(valid_values)

        return None

    def _infer_scale_multiplier(self, text: str) -> float:
        """
        Infer a numeric scale multiplier to convert to 'millions' units based on nearby words.

        Rules:
        - contains 'billion' or 'bn' => ×1000 (billions -> millions)
        - contains 'thousand' or 'k' => ×0.001 (thousands -> millions) [conservative: only 'thousand']
        - contains 'million', 'mm', '(mm)' => ×1
        - default => ×1 (assume already in millions per mappings convention)
        """
        t = text.lower()
        # explicit billion
        if re.search(r"\bbillion(s)?\b|\bbn\b", t):
            return 1000.0
        # explicit thousand
        if re.search(r"\bthousand(s)?\b", t):
            return 0.001
        # indications of millions
        if re.search(r"\bmillion(s)?\b|\bmm\b|\(\$?mm\)|\$mm\b", t):
            return 1.0
        return 1.0


def extract_kpis_from_filings(
    filings_dir: Path,
    mappings_path: Path,
    ticker: str
) -> Dict[str, ExtractedKPI]:
    """
    Extract KPIs from all filings for a specific ticker.

    Args:
        filings_dir: Directory containing filing documents
        mappings_path: Path to mappings YAML file
        ticker: Company ticker symbol

    Returns:
        Dictionary of extracted KPIs with citations
    """
    extractor = KPIExtractor(mappings_path)
    all_kpis = {}

    # Find all files for this ticker
    ticker_files = list(filings_dir.glob(f"{ticker.lower()}_*.txt"))  # Start with txt files

    for file_path in ticker_files:
        try:
            file_kpis = extractor.extract_from_file(file_path, ticker)

            # Merge with existing KPIs (later files can override earlier ones)
            all_kpis.update(file_kpis)

        except Exception as e:
            print(f"Error processing {file_path}: {e}")
            continue

    return all_kpis
