#!/usr/bin/env python3
"""
SEC Data Update Script
Automatically fetches latest financial filings from SEC EDGAR
Updates local financial data with newest available information
"""

import sys
import json
from pathlib import Path
from datetime import datetime
import argparse

# Add core module to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.data_manager import create_data_manager, update_all_financial_data

def main():
    """Main update script"""
    parser = argparse.ArgumentParser(description='Update SEC financial data')
    parser.add_argument('--force', action='store_true',
                       help='Force update all companies regardless of last update date')
    parser.add_argument('--companies', nargs='*',
                       help='Specific companies to update (default: all)')
    parser.add_argument('--output', type=str, default='data',
                       help='Output directory for data files')
    parser.add_argument('--user-agent', type=str,
                       default='EnergyICCopilot/1.0 (admin@energyiccopilot.com)',
                       help='SEC API user agent string')

    args = parser.parse_args()

    print("🔄 SEC Financial Data Update Script")
    print("=" * 50)
    print(f"Started: {datetime.now().isoformat()}")
    print(f"Force update: {args.force}")
    print(f"Output directory: {args.output}")
    print()

    try:
        # Create data manager
        data_dir = Path(__file__).parent.parent / args.output
        manager = create_data_manager(data_dir, args.user_agent)

        # Get initial status
        initial_status = manager.get_data_status()
        print("📊 Initial Status:")
        print(f"  Total companies: {initial_status['total_companies']}")
        print(f"  Companies with data: {initial_status['companies_with_data']}")
        print()

        # Update data
        if args.companies:
            print(f"🔄 Updating specific companies: {', '.join(args.companies)}")
            results = []
            for ticker in args.companies:
                result = manager.update_company_data(ticker, args.force)
                results.append(result)
        else:
            print("🔄 Updating all companies...")
            results = update_all_financial_data(args.force)

        # Process results
        successful_updates = 0
        failed_updates = 0
        total_metrics = 0

        print("\n📋 Update Results:")
        print("-" * 50)

        for result in results:
            status_icon = "✅" if result.success else "❌"
            print(f"{status_icon} {result.ticker}: {result.filing_date or 'N/A'}")

            if result.success:
                successful_updates += 1
                total_metrics += result.metrics_extracted
                if result.filing_date:
                    print(f"    📅 Filing date: {result.filing_date}")
                if result.metrics_extracted > 0:
                    print(f"    📊 Metrics extracted: {result.metrics_extracted}")
            else:
                failed_updates += 1
                if result.error_message:
                    print(f"    ❌ Error: {result.error_message}")

        print("\n📈 Summary:")
        print("-" * 30)
        print(f"✅ Successful updates: {successful_updates}")
        print(f"❌ Failed updates: {failed_updates}")
        print(f"📊 Total metrics extracted: {total_metrics}")
        print(f"📅 Completed: {datetime.now().isoformat()}")

        # Final status
        final_status = manager.get_data_status()
        companies_needing_update = sum(
            1 for company in final_status['companies'].values()
            if company.get('needs_update', False)
        )

        print("\n🎯 Final Status:")
        print(f"  Companies with fresh data: {final_status['companies_with_data']}")
        print(f"  Companies needing updates: {companies_needing_update}")

        # Save results to JSON
        results_file = data_dir / "update_results.json"
        results_data = {
            'timestamp': datetime.now().isoformat(),
            'force_update': args.force,
            'total_companies': len(results),
            'successful_updates': successful_updates,
            'failed_updates': failed_updates,
            'total_metrics': total_metrics,
            'results': [
                {
                    'ticker': r.ticker,
                    'success': r.success,
                    'filing_date': r.filing_date,
                    'metrics_extracted': r.metrics_extracted,
                    'error_message': r.error_message,
                    'last_updated': r.last_updated
                }
                for r in results
            ]
        }

        with open(results_file, 'w') as f:
            json.dump(results_data, f, indent=2)

        print(f"\n💾 Results saved to: {results_file}")

        # Exit with appropriate code
        if failed_updates > 0:
            print("\n⚠️  Some updates failed. Check logs for details.")
            sys.exit(1)
        else:
            print("\n🎉 All updates completed successfully!")
            sys.exit(0)

    except Exception as e:
        print(f"\n❌ Script failed with error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
