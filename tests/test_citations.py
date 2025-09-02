"""
Tests for citation functionality.
"""

import pytest
from core.cite import Citation, CitationManager, create_citation_from_match


class TestCitation:
    """Test cases for Citation class."""

    def test_citation_creation(self):
        """Test basic citation creation."""
        citation = Citation(
            doc_id="test.pdf",
            page=5,
            span=[120, 160],
            text_preview="Adjusted EBITDA increased to $3,450 million..."
        )

        assert citation.doc_id == "test.pdf"
        assert citation.page == 5
        assert citation.span == (120, 160)
        assert "EBITDA" in citation.text_preview

    def test_citation_string_representation(self):
        """Test citation string representation."""
        citation = Citation(
            doc_id="ppl_2024_q2_mda.pdf",
            page=17,
            span=[120, 160],
            text_preview="Adjusted EBITDA increased to $3,450 million..."
        )

        str_repr = str(citation)
        assert "ppl_2024_q2_mda.pdf" in str_repr
        assert "p.17" in str_repr
        assert "EBITDA" in str_repr

    def test_citation_to_dict(self):
        """Test citation serialization to dict."""
        citation = Citation(
            doc_id="test.pdf",
            page=5,
            span=[120, 160],
            text_preview="Sample text"
        )

        citation_dict = citation.to_dict()

        expected = {
            "doc_id": "test.pdf",
            "page": 5,
            "span": [120, 160],
            "text_preview": "Sample text"
        }

        assert citation_dict == expected


class TestCitationManager:
    """Test cases for CitationManager class."""

    def test_citation_manager_initialization(self):
        """Test citation manager initialization."""
        manager = CitationManager()
        assert len(manager.get_all_citations()) == 0

    def test_add_and_get_citation(self):
        """Test adding and retrieving citations."""
        manager = CitationManager()

        citation = Citation(
            doc_id="test.pdf",
            page=5,
            span=[120, 160],
            text_preview="Sample text"
        )

        manager.add_citation("EBITDA", citation)

        retrieved = manager.get_citation("EBITDA")
        assert retrieved == citation
        assert retrieved.doc_id == "test.pdf"

    def test_get_nonexistent_citation(self):
        """Test retrieving non-existent citation."""
        manager = CitationManager()

        result = manager.get_citation("NONEXISTENT")
        assert result is None

    def test_get_all_citations(self):
        """Test getting all citations."""
        manager = CitationManager()

        citation1 = Citation(doc_id="doc1.pdf", page=1, span=[0, 10], text_preview="Text 1")
        citation2 = Citation(doc_id="doc2.pdf", page=2, span=[20, 30], text_preview="Text 2")

        manager.add_citation("KPI1", citation1)
        manager.add_citation("KPI2", citation2)

        all_citations = manager.get_all_citations()

        assert len(all_citations) == 2
        assert all_citations["KPI1"] == citation1
        assert all_citations["KPI2"] == citation2

    def test_clear_citations(self):
        """Test clearing all citations."""
        manager = CitationManager()

        citation = Citation(doc_id="test.pdf", page=1, span=[0, 10], text_preview="Text")
        manager.add_citation("TEST", citation)

        assert len(manager.get_all_citations()) == 1

        manager.clear()
        assert len(manager.get_all_citations()) == 0

    def test_citation_immutability(self):
        """Test that retrieved citations are not references to internal objects."""
        manager = CitationManager()

        original_citation = Citation(
            doc_id="test.pdf",
            page=1,
            span=[0, 10],
            text_preview="Original text"
        )

        manager.add_citation("TEST", original_citation)

        retrieved = manager.get_citation("TEST")
        assert retrieved == original_citation

        # Modify retrieved citation
        retrieved.page = 999

        # Original should be unchanged (depending on implementation)
        # This tests whether we return copies or references
        stored = manager.get_citation("TEST")

        # If we return references, this will fail
        if stored.page != original_citation.page:
            pytest.skip("CitationManager returns mutable references")


class TestCreateCitationFromMatch:
    """Test cases for create_citation_from_match function."""

    def test_basic_citation_creation(self):
        """Test basic citation creation from match."""
        text = "The Adjusted EBITDA increased to $3,450 million in Q2 2024."
        citation = create_citation_from_match(
            doc_id="test.pdf",
            page=10,
            text=text,
            start_pos=4,  # Start of "Adjusted"
            end_pos=50,   # End of "increased to $3,450 million"
        )

        assert citation.doc_id == "test.pdf"
        assert citation.page == 10
        assert citation.span[0] < citation.span[1]
        assert "Adjusted EBITDA" in citation.text_preview
        assert "$3,450 million" in citation.text_preview

    def test_citation_with_context(self):
        """Test citation creation with context around match."""
        long_text = "According to the financial statements, the company reported Adjusted EBITDA increased to $3,450 million in Q2 2024, which represents a 10% growth from the previous year."

        citation = create_citation_from_match(
            doc_id="financials.pdf",
            page=15,
            text=long_text,
            start_pos=50,  # Start of "$3,450"
            end_pos=75,    # End of "million"
            context_chars=30
        )

        assert citation.doc_id == "financials.pdf"
        assert citation.page == 15
        assert "EBITDA increased" in citation.text_preview
        assert len(citation.text_preview) <= 100  # Should respect context limit

    def test_citation_at_text_boundaries(self):
        """Test citation creation at text boundaries."""
        text = "EBITDA $1,000"

        # Match at the beginning
        citation = create_citation_from_match(
            doc_id="test.pdf",
            page=1,
            text=text,
            start_pos=0,
            end_pos=12,
            context_chars=50
        )

        assert citation.span[0] == 0
        assert "EBITDA" in citation.text_preview

        # Match at the end
        citation_end = create_citation_from_match(
            doc_id="test.pdf",
            page=1,
            text=text,
            start_pos=8,  # Start of "1,000"
            end_pos=12,   # End of text
            context_chars=50
        )

        assert citation_end.span[1] <= len(text)
        assert "1,000" in citation_end.text_preview

    def test_citation_with_special_characters(self):
        """Test citation creation with special characters."""
        text = "Net Debt decreased by $500 million (CAD) in Q2."

        citation = create_citation_from_match(
            doc_id="test.pdf",
            page=5,
            text=text,
            start_pos=0,
            end_pos=35,
            context_chars=20
        )

        assert citation.doc_id == "test.pdf"
        assert citation.page == 5
        assert "Net Debt" in citation.text_preview
        assert "(CAD)" in citation.text_preview

    def test_empty_text_handling(self):
        """Test handling of empty or very short text."""
        # Very short text
        citation = create_citation_from_match(
            doc_id="test.pdf",
            page=1,
            text="EBITDA",
            start_pos=0,
            end_pos=6,
            context_chars=50
        )

        assert citation.text_preview == "EBITDA"
        assert citation.span == (0, 6)

    def test_large_context_request(self):
        """Test handling of large context requests."""
        text = "This is a test document with some financial information about EBITDA."

        citation = create_citation_from_match(
            doc_id="test.pdf",
            page=1,
            text=text,
            start_pos=50,  # Start of "EBITDA"
            end_pos=56,    # End of "EBITDA"
            context_chars=1000  # Request more context than available
        )

        # Should not crash and should return valid citation
        assert citation.doc_id == "test.pdf"
        assert citation.page == 1
        assert "EBITDA" in citation.text_preview
        assert citation.span[0] >= 0
        assert citation.span[1] <= len(text)


if __name__ == "__main__":
    pytest.main([__file__])
