"""
Citation handling for extracted KPIs.
Provides deterministic citation tracking with document, page, and text span information.
"""

from typing import Optional
from pydantic import BaseModel


class Citation(BaseModel):
    """Citation structure for extracted KPI values."""

    doc_id: str
    page: int
    span: tuple[int, int]  # character positions [start, end]
    text_preview: str

    def __str__(self) -> str:
        """String representation for display."""
        return f"{self.doc_id} (p.{self.page}): {self.text_preview[:50]}..."

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "doc_id": self.doc_id,
            "page": self.page,
            "span": list(self.span),
            "text_preview": self.text_preview
        }


class CitationManager:
    """Manages citations for extracted KPIs."""

    def __init__(self):
        self._citations: dict[str, Citation] = {}

    def add_citation(self, kpi_key: str, citation: Citation) -> None:
        """Add a citation for a specific KPI."""
        self._citations[kpi_key] = citation

    def get_citation(self, kpi_key: str) -> Optional[Citation]:
        """Get citation for a specific KPI."""
        return self._citations.get(kpi_key)

    def get_all_citations(self) -> dict[str, Citation]:
        """Get all citations."""
        return self._citations.copy()

    def clear(self) -> None:
        """Clear all citations."""
        self._citations.clear()


def create_citation_from_match(
    doc_id: str,
    page: int,
    text: str,
    start_pos: int,
    end_pos: int,
    context_chars: int = 100
) -> Citation:
    """
    Create a citation from text match information.

    Args:
        doc_id: Document identifier
        page: Page number (1-indexed)
        text: Full text content
        start_pos: Start character position of the match
        end_pos: End character position of the match
        context_chars: Number of characters to include in preview

    Returns:
        Citation object with preview text
    """
    # Extract preview with context around the match
    preview_start = max(0, start_pos - context_chars // 2)
    preview_end = min(len(text), end_pos + context_chars // 2)

    preview = text[preview_start:preview_end].strip()

    # Adjust span relative to preview
    adjusted_span = (start_pos - preview_start, end_pos - preview_start)

    return Citation(
        doc_id=doc_id,
        page=page,
        span=adjusted_span,
        text_preview=preview
    )
