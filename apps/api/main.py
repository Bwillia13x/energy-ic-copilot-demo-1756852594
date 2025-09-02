"""
FastAPI backend for Energy IC Copilot.
Provides endpoints for KPI extraction, valuation calculations, and data management.
"""

import sys
from pathlib import Path
from typing import Dict, List, Optional, Any
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yaml
import tempfile
import os

# Add the parent directory to Python path to import core modules
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Import core modules
from core.extract import KPIExtractor, extract_kpis_from_filings, ExtractedKPI
from core.valuation import ValuationEngine, ValuationInputs, ValuationScenario, ValuationResults
from core.cite import Citation

# Configuration
PROJECT_ROOT = Path(__file__).parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
FILINGS_DIR = DATA_DIR / "filings"
MAPPINGS_PATH = DATA_DIR / "mappings.yaml"
COMPANIES_PATH = DATA_DIR / "companies.yaml"

app = FastAPI(
    title="Energy IC Copilot API",
    description="Backend API for energy infrastructure company analysis and valuation",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models for API
class CompanyInfo(BaseModel):
    name: str
    ticker: str
    currency: str
    fiscal_year_end: str
    sector: str
    country: str

class KPISummary(BaseModel):
    ticker: str
    kpis: Dict[str, Dict[str, Any]]
    extracted_at: str

class ValuationRequest(BaseModel):
    ticker: str
    inputs: ValuationInputs
    scenario: Optional[ValuationScenario] = None

# Global instances
valuation_engine = ValuationEngine()

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "Energy IC Copilot API", "status": "healthy"}

@app.get("/companies", response_model=Dict[str, CompanyInfo])
async def get_companies():
    """Get all available companies."""
    try:
        with open(COMPANIES_PATH, 'r') as f:
            companies_data = yaml.safe_load(f)

        companies = {}
        for ticker, info in companies_data.items():
            companies[ticker] = CompanyInfo(**info)

        return companies
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading companies: {str(e)}")

@app.get("/companies/{ticker}", response_model=CompanyInfo)
async def get_company(ticker: str):
    """Get information for a specific company."""
    try:
        with open(COMPANIES_PATH, 'r') as f:
            companies_data = yaml.safe_load(f)

        if ticker not in companies_data:
            raise HTTPException(status_code=404, detail=f"Company {ticker} not found")

        return CompanyInfo(**companies_data[ticker])
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Companies data not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading company: {str(e)}")

@app.post("/ingest")
async def ingest_document(file: UploadFile = File(...), ticker: str = None):
    """
    Ingest a document and extract KPIs.
    For now, saves to temporary location and processes.
    """
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker parameter required")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = Path(temp_file.name)

        # Extract KPIs
        extractor = KPIExtractor(MAPPINGS_PATH)
        extracted_kpis = extractor.extract_from_file(temp_file_path, ticker)

        # Clean up temp file
        os.unlink(temp_file_path)

        # Convert to response format
        response_kpis = {}
        for kpi_name, kpi_data in extracted_kpis.items():
            response_kpis[kpi_name] = {
                "value": kpi_data.value,
                "unit": kpi_data.unit,
                "citation": kpi_data.citation.to_dict()
            }

        return {
            "ticker": ticker,
            "kpis": response_kpis,
            "doc_id": file.filename,
            "status": "processed"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")

@app.get("/kpis/{ticker}", response_model=KPISummary)
async def get_kpis(ticker: str):
    """Get latest KPIs for a company from sample filings."""
    try:
        # Extract from sample filings
        extracted_kpis = extract_kpis_from_filings(FILINGS_DIR, MAPPINGS_PATH, ticker)

        # Convert to response format
        response_kpis = {}
        for kpi_name, kpi_data in extracted_kpis.items():
            response_kpis[kpi_name] = {
                "value": kpi_data.value,
                "unit": kpi_data.unit,
                "citation": kpi_data.citation.to_dict()
            }

        import datetime
        return KPISummary(
            ticker=ticker,
            kpis=response_kpis,
            extracted_at=datetime.datetime.now().isoformat()
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting KPIs: {str(e)}")

@app.post("/valuation/{ticker}", response_model=ValuationResults)
async def calculate_valuation(ticker: str, request: ValuationRequest):
    """Calculate valuation for a company."""
    try:
        # Validate ticker matches
        if request.ticker != ticker:
            raise HTTPException(status_code=400, detail="Ticker mismatch")

        # Calculate valuation
        results = valuation_engine.calculate_valuation(
            inputs=request.inputs,
            scenario=request.scenario
        )

        return results

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating valuation: {str(e)}")

@app.get("/mappings/{ticker}")
async def get_mappings(ticker: str):
    """Get KPI extraction mappings for a company."""
    try:
        with open(MAPPINGS_PATH, 'r') as f:
            mappings = yaml.safe_load(f)

        if ticker not in mappings:
            raise HTTPException(status_code=404, detail=f"No mappings found for {ticker}")

        return mappings[ticker]

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Mappings file not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading mappings: {str(e)}")

# Health check for individual services
@app.get("/health")
async def health_check():
    """Comprehensive health check."""
    health_status = {
        "api": "healthy",
        "data_files": {},
        "core_modules": {}
    }

    # Check data files
    data_files = [
        ("companies", COMPANIES_PATH),
        ("mappings", MAPPINGS_PATH),
        ("filings_dir", FILINGS_DIR)
    ]

    for name, path in data_files:
        if path.exists():
            health_status["data_files"][name] = "exists"
        else:
            health_status["data_files"][name] = "missing"

    # Check core modules
    core_modules = ["extract", "valuation", "cite"]
    for module in core_modules:
        try:
            __import__(f"core.{module}")
            health_status["core_modules"][module] = "loaded"
        except ImportError:
            health_status["core_modules"][module] = "missing"

    return health_status

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
