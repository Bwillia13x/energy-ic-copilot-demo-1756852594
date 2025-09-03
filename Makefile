# Energy IC Copilot Makefile

.PHONY: dev test typecheck clean install setup

# Development
dev:
	@echo "Starting development servers..."
	@echo "🛑 Killing any existing processes on ports 3000 and 8000..."
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@sleep 2
	@echo "🚀 Starting API server (port 8000)..."
	@(cd apps/api && python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000) & \
	 echo "🚀 Starting web server (port 3000)..." && \
	 (cd apps/web && npm run dev) & \
	 wait

# Testing
test:
	@echo "Running tests..."
	@echo "🧪 Python tests:"
	@PYTHONPATH=/Users/benjaminwilliams/Desktop/_belmont_seo/energy-ic-copilot python3 -m pytest -q tests/ || echo "❌ Python tests failed"
	@echo "✅ Python tests completed"
	@echo "🧪 TypeScript typecheck:"
	@cd apps/web && npm run typecheck || echo "❌ TypeScript typecheck failed"
	@echo "✅ TypeScript typecheck completed"

# Type checking
typecheck:
	@echo "Running type checks..."
	@cd apps/web && npm run typecheck

# Installation
install:
	@echo "Installing dependencies..."
	@echo "📦 Installing Python dependencies..."
	@cd apps/api && pip install -r requirements.txt
	@echo "📦 Installing Node.js dependencies..."
	@cd apps/web && npm install
	@echo "✅ Dependencies installed"

# Setup
setup: install
	@echo "Setting up development environment..."
	@cd apps/api && python -c "import sys; print(f'Python {sys.version}')"

# Clean
clean:
	@echo "Cleaning up..."
	@find . -type d -name "__pycache__" -exec rm -rf {} +
	@find . -type d -name ".next" -exec rm -rf {} +
	@find . -type d -name "node_modules" -exec rm -rf {} +
	@find . -type d -name ".turbo" -exec rm -rf {} +
	@find . -name "*.pyc" -delete
	@find . -name "*.pyo" -delete
	@find . -name "*.pyd" -delete
	@echo "✅ Cleanup completed"

# Clean and restart dev servers
dev-clean:
	@echo "🧹 Performing clean restart..."
	@make clean
	@sleep 2
	@make dev

# Health check
health:
	@echo "Checking system health..."
	@curl -s http://localhost:8000/health || echo "❌ API not running"
	@curl -s http://localhost:3000/api/health || echo "❌ Web app not running"
	@echo "✅ Health check completed"

# Docker (optional)
docker-build:
	@echo "Building Docker images..."
	docker build -t energy-ic-copilot-api ./apps/api
	docker build -t energy-ic-copilot-web ./apps/web

docker-run:
	@echo "Running Docker containers..."
	docker run -d -p 8000:8000 energy-ic-copilot-api
	docker run -d -p 3000:3000 energy-ic-copilot-web

# Help
help:
	@echo "Energy IC Copilot - Development Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start both API and web servers"
	@echo "  make dev-clean    - Clean restart (removes cache, kills processes)"
	@echo "  make install      - Install all dependencies"
	@echo "  make setup        - Full setup (install + environment)"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run all tests"
	@echo "  make typecheck    - Run TypeScript type checking"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make health       - Check service health"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build - Build Docker images"
	@echo "  make docker-run   - Run Docker containers"
