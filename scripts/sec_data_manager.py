#!/usr/bin/env python3
"""
SEC Data Manager CLI
Command-line interface for managing SEC financial data updates
Provides tools for updating, validating, and monitoring SEC filings
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional

# Add core module to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.data_manager import create_data_manager, DataUpdateResult
from core.config import FinancialConfig

class SECDataCLI:
    """Command-line interface for SEC data management"""

    def __init__(self):
        self.data_dir = Path(__file__).parent.parent / "data"
        self.manager = create_data_manager(self.data_dir)

    def status(self, args):
        """Show current data status"""
        print("🔍 SEC Data Status Report")
        print("=" * 40)

        status = self.manager.get_data_status()

        print(f"📊 Overview:")
        print(f"  Total companies tracked: {status['total_companies']}")
        print(f"  Companies with data: {status['companies_with_data']}")
        print(f"  Last status check: {status['last_update_check']}")
        print()

        print("🏢 Company Status:")
        for ticker, info in status['companies'].items():
            if info.get('has_data'):
                days_old = info.get('days_since_update', 'N/A')
                quality = info.get('data_quality', 'unknown')
                needs_update = "🔄" if info.get('needs_update') else "✅"
                print(f"  {needs_update} {ticker}: {info['filing_date']} ({days_old} days old, {quality})")
            else:
                print(f"  ❌ {ticker}: No data available")

        companies_needing_update = sum(1 for c in status['companies'].values()
                                     if c.get('needs_update', False))
        print()
        print(f"📈 Summary: {companies_needing_update} companies need updates")

    def update(self, args):
        """Update SEC data"""
        print("🔄 Updating SEC Financial Data")
        print("=" * 40)

        if args.company:
            print(f"Updating {args.company}...")
            result = self.manager.update_company_data(args.company, args.force)
            self._print_update_result(result)
        else:
            print("Updating all companies...")
            results = self.manager.update_all_companies(args.force)

            successful = sum(1 for r in results if r.success)
            failed = len(results) - successful
            total_metrics = sum(r.metrics_extracted for r in results if r.success)

            print("\n📊 Batch Update Summary:")
            print(f"  ✅ Successful: {successful}")
            print(f"  ❌ Failed: {failed}")
            print(f"  📈 Total metrics extracted: {total_metrics}")

            if args.verbose:
                print("\n📋 Detailed Results:")
                for result in results:
                    self._print_update_result(result, verbose=False)

    def quality(self, args):
        """Check data quality"""
        print("🔬 Data Quality Assessment")
        print("=" * 40)

        if args.company:
            companies = [args.company]
        else:
            companies = list(self.manager.sec_client.company_ciks.keys())

        total_quality_score = 0
        companies_analyzed = 0

        for ticker in companies:
            quality = self.manager.validate_data_quality(ticker)

            print(f"\n🏢 {ticker} Data Quality:")
            print(f"  Overall: {quality['overall_quality'].upper()}")
            print(f"  Total KPIs: {quality['metrics'].get('total_kpis', 0)}")
            print(f"  Days since filing: {quality['metrics'].get('days_since_filing', 'N/A')}")

            if quality['issues']:
                print("  Issues:")
                for issue in quality['issues']:
                    print(f"    ⚠️  {issue}")

            # Calculate quality score
            score_map = {'excellent': 5, 'good': 4, 'fair': 3, 'poor': 1, 'unknown': 0}
            score = score_map.get(quality['overall_quality'], 0)
            total_quality_score += score
            companies_analyzed += 1

        if companies_analyzed > 0:
            avg_score = total_quality_score / companies_analyzed
            quality_level = "excellent" if avg_score >= 4.5 else \
                          "good" if avg_score >= 3.5 else \
                          "fair" if avg_score >= 2.5 else "poor"

            print("\n📊 Overall Quality Summary:")
            print(f"  Average score: {avg_score:.1f}/5.0")
            print(f"  Quality level: {quality_level.upper()}")
            print(f"  Companies analyzed: {companies_analyzed}")

    def validate(self, args):
        """Run full validation"""
        print("✅ Running Complete Validation Suite")
        print("=" * 40)

        # Import validation script
        import subprocess
        result = subprocess.run([
            sys.executable,
            str(Path(__file__).parent / "validate_data_consistency.py")
        ], capture_output=True, text=True)

        print(result.stdout)
        if result.stderr:
            print("Warnings/Errors:")
            print(result.stderr)

        return result.returncode == 0

    def backup(self, args):
        """Create backup of current data"""
        print("💾 Creating Data Backup")
        print("=" * 40)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = self.data_dir / f"backup_{timestamp}"

        try:
            backup_dir.mkdir(parents=True, exist_ok=True)

            # Copy important files
            files_to_backup = [
                "default_financial_inputs.yaml",
                "mappings.yaml",
                "filing_metadata.json",
                "filings/"
            ]

            for file_path in files_to_backup:
                src = self.data_dir / file_path
                if src.exists():
                    if src.is_file():
                        import shutil
                        shutil.copy2(src, backup_dir / src.name)
                        print(f"✅ Backed up: {src.name}")
                    else:
                        # Copy directory
                        import shutil
                        shutil.copytree(src, backup_dir / src.name, dirs_exist_ok=True)
                        print(f"✅ Backed up: {src.name}/")

            print(f"\n💾 Backup created: {backup_dir}")
            print("To restore: cp -r backup_*/* data/")

        except Exception as e:
            print(f"❌ Backup failed: {e}")
            return False

        return True

    def _print_update_result(self, result: DataUpdateResult, verbose: bool = True):
        """Print formatted update result"""
        status_icon = "✅" if result.success else "❌"
        print(f"{status_icon} {result.ticker}")

        if verbose:
            if result.filing_date:
                print(f"    📅 Filing date: {result.filing_date}")
            if result.metrics_extracted > 0:
                print(f"    📊 Metrics extracted: {result.metrics_extracted}")
            if result.error_message:
                print(f"    ❌ Error: {result.error_message}")

def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="SEC Data Manager - Manage SEC financial filings and data updates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s status                    # Show current data status
  %(prog)s update                    # Update all companies
  %(prog)s update --company PPL      # Update specific company
  %(prog)s quality                   # Check data quality
  %(prog)s validate                  # Run full validation
  %(prog)s backup                    # Create data backup
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Status command
    status_parser = subparsers.add_parser('status', help='Show current data status')

    # Update command
    update_parser = subparsers.add_parser('update', help='Update SEC data')
    update_parser.add_argument('--company', '-c', help='Specific company ticker')
    update_parser.add_argument('--force', '-f', action='store_true',
                              help='Force update even if recent')
    update_parser.add_argument('--verbose', '-v', action='store_true',
                              help='Verbose output')

    # Quality command
    quality_parser = subparsers.add_parser('quality', help='Check data quality')
    quality_parser.add_argument('--company', '-c', help='Specific company ticker')

    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Run full validation')

    # Backup command
    backup_parser = subparsers.add_parser('backup', help='Create data backup')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    # Initialize CLI
    cli = SECDataCLI()

    # Execute command
    try:
        if args.command == 'status':
            cli.status(args)
        elif args.command == 'update':
            cli.update(args)
        elif args.command == 'quality':
            cli.quality(args)
        elif args.command == 'validate':
            success = cli.validate(args)
            sys.exit(0 if success else 1)
        elif args.command == 'backup':
            success = cli.backup(args)
            sys.exit(0 if success else 1)
        else:
            parser.print_help()

    except KeyboardInterrupt:
        print("\n⚠️  Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
