"""
Tests for KPI extraction functionality.
"""

import pytest
import tempfile
from pathlib import Path
from core.extract import KPIExtractor, extract_kpis_from_filings


class TestKPIExtractor:
    """Test cases for KPI extraction."""

    def setup_method(self):
        """Set up test fixtures."""
        self.mappings_path = Path(__file__).parent.parent / "data" / "mappings.yaml"
        self.sample_text = """
        PEMBINA PIPELINE CORPORATION
        Management's Discussion and Analysis
        For the three and six months ended June 30, 2024

        FINANCIAL HIGHLIGHTS

        Adjusted EBITDA increased to $3,450 million for the six months ended June 30, 2024,
        compared to $3,120 million in the prior year period.

        Funds From Operations were $2,890 million for the six months ended June 30, 2024,
        up from $2,650 million in the prior year.

        Net Debt at June 30, 2024 was $18,750 million, compared to $17,920 million at December 31, 2023.

        Interest Expense for the six months was $380 million, compared to $360 million in the prior year.

        Maintenance capital expenditures were $220 million for the quarter.
        """

    def test_extractor_initialization(self):
        """Test extractor initialization with mappings."""
        extractor = KPIExtractor(self.mappings_path)
        assert extractor.mappings is not None
        assert "PPL" in extractor.mappings

    def test_extract_ebitda(self):
        """Test EBITDA extraction."""
        extractor = KPIExtractor(self.mappings_path)

        # Create temporary file with sample content
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(self.sample_text)
            temp_path = Path(f.name)

        try:
            kpis = extractor.extract_from_file(temp_path, "PPL")

            assert "EBITDA" in kpis
            assert kpis["EBITDA"].value == 3450.0
            assert kpis["EBITDA"].unit == "CAD millions"
            assert kpis["EBITDA"].citation.doc_id == temp_path.name
            assert kpis["EBITDA"].citation.page == 1

        finally:
            temp_path.unlink()

    def test_extract_net_debt(self):
        """Test Net Debt extraction."""
        extractor = KPIExtractor(self.mappings_path)

        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(self.sample_text)
            temp_path = Path(f.name)

        try:
            kpis = extractor.extract_from_file(temp_path, "PPL")

            assert "NetDebt" in kpis
            assert kpis["NetDebt"].value == 18750.0
            assert kpis["NetDebt"].unit == "CAD millions"

        finally:
            temp_path.unlink()

    def test_extract_multiple_kpis(self):
        """Test extraction of multiple KPIs from single document."""
        extractor = KPIExtractor(self.mappings_path)

        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(self.sample_text)
            temp_path = Path(f.name)

        try:
            kpis = extractor.extract_from_file(temp_path, "PPL")

            expected_kpis = ["EBITDA", "FFO", "NetDebt", "InterestExpense", "MaintenanceCapex"]
            found_kpis = [kpi for kpi in expected_kpis if kpi in kpis]

            assert len(found_kpis) >= 3  # Should find at least some KPIs

        finally:
            temp_path.unlink()

    def test_numeric_value_extraction(self):
        """Test numeric value extraction from various formats."""
        extractor = KPIExtractor(self.mappings_path)

        test_cases = [
            ("EBITDA of $2,890 million", 2890.0),
            ("Net Debt $18,750", 18750.0),
            ("Interest expense 380 million", 380.0),
            ("FFO increased to $2,650", 2650.0),
            ("Maintenance capex $220 million", 220.0),
        ]

        for text, expected in test_cases:
            value = extractor._extract_numeric_value(text)
            assert value == expected, f"Failed to extract {expected} from '{text}'"

    def test_scale_normalization_billion(self):
        """Values expressed in billions are normalized to millions."""
        extractor = KPIExtractor(self.mappings_path)

        content = "Adjusted EBITDA was $4.2 billion for the quarter."
        pattern = r"Adjusted EBITDA was \$?([0-9,]+(?:\.[0-9]+)?)\s*(?:billion|million)"

        value, citation = extractor._extract_single_kpi(
            content=content,
            pattern=pattern,
            doc_id="test.txt",
            unit="USD millions",
            normalize="strip_commas",
        )

        assert value == 4200.0
        assert citation is not None

    def test_us_interest_expense_net_billion(self):
        """US issuer interest expense, net in billions normalizes to millions."""
        extractor = KPIExtractor(self.mappings_path)

        sample = (
            "KINDER MORGAN, INC.\n"
            "Interest expense, net was $1.8 billion for the period."
        )

        import tempfile
        from pathlib import Path
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(sample)
            p = Path(f.name)

        try:
            kpis = extractor.extract_from_file(p, "KMI")
            assert "InterestExpense" in kpis
            assert kpis["InterestExpense"].value == 1800.0
            assert kpis["InterestExpense"].unit == "USD millions"
        finally:
            p.unlink()

    def test_citation_creation(self):
        """Test citation creation."""
        extractor = KPIExtractor(self.mappings_path)

        text = "Adjusted EBITDA increased to $3,450 million"
        from core.cite import create_citation_from_match
        citation = create_citation_from_match(
            "test.pdf", 1, text, 30, 45
        )

        assert citation.doc_id == "test.pdf"
        assert citation.page == 1
        assert citation.span[0] < citation.span[1]
        assert "EBITDA" in citation.text_preview

    def test_deterministic_extraction(self):
        """Test that extraction is deterministic (same input = same output)."""
        extractor = KPIExtractor(self.mappings_path)

        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(self.sample_text)
            temp_path = Path(f.name)

        try:
            # Extract multiple times
            results = []
            for _ in range(3):
                kpis = extractor.extract_from_file(temp_path, "PPL")
                results.append(kpis)

            # All results should be identical
            for i in range(1, len(results)):
                assert results[0] == results[i], f"Non-deterministic result at iteration {i}"

        finally:
            temp_path.unlink()

    def test_missing_mappings(self):
        """Test handling of missing ticker mappings."""
        extractor = KPIExtractor(self.mappings_path)

        # Create a dummy file first
        dummy_path = Path("dummy.txt")
        dummy_path.write_text("Some dummy content")

        try:
            with pytest.raises(ValueError, match="No mappings found for ticker"):
                extractor.extract_from_file(dummy_path, "NONEXISTENT")
        finally:
            dummy_path.unlink()  # Clean up

    def test_file_not_found(self):
        """Test handling of missing files."""
        extractor = KPIExtractor(self.mappings_path)

        with pytest.raises(FileNotFoundError):
            extractor.extract_from_file(Path("nonexistent_file.txt"), "PPL")

    def test_empty_file(self):
        """Test handling of empty files."""
        extractor = KPIExtractor(self.mappings_path)

        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("")  # Empty file
            temp_path = Path(f.name)

        try:
            kpis = extractor.extract_from_file(temp_path, "PPL")
            assert len(kpis) == 0  # Should return empty dict

        finally:
            temp_path.unlink()


class TestExtractKpisFromFilings:
    """Test the high-level extraction function."""

    def test_extract_from_filings_directory(self):
        """Test extraction from a directory of filings."""
        # This would require setting up a test filings directory
        # For now, just test that the function exists and can be called
        filings_dir = Path(__file__).parent.parent / "data" / "filings"
        mappings_path = Path(__file__).parent.parent / "data" / "mappings.yaml"

        if filings_dir.exists() and mappings_path.exists():
            kpis = extract_kpis_from_filings(filings_dir, mappings_path, "PPL")
            assert isinstance(kpis, dict)
        else:
            pytest.skip("Test data files not available")


if __name__ == "__main__":
    pytest.main([__file__])
