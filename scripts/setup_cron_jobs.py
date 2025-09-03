#!/usr/bin/env python3
"""
Cron Job Setup for SEC Data Updates
Creates and manages cron jobs for automated SEC filing updates
"""

import sys
import os
import subprocess
from pathlib import Path
from datetime import datetime

def create_cron_job(schedule_type="weekly", day="monday", time="09:00"):
    """
    Create a cron job for SEC data updates

    Args:
        schedule_type: 'daily', 'weekly', or 'monthly'
        day: Day of week for weekly updates (monday, tuesday, etc.)
        time: Time in HH:MM format (24-hour)
    """
    project_root = Path(__file__).parent.parent
    script_path = project_root / "scripts" / "update_sec_data.py"

    # Parse time
    hour, minute = time.split(":")

    # Create cron expression based on schedule type
    if schedule_type == "daily":
        cron_expression = f"{minute} {hour} * * *"
    elif schedule_type == "weekly":
        day_map = {
            "sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3,
            "thursday": 4, "friday": 5, "saturday": 6
        }
        day_num = day_map.get(day.lower(), 1)  # Default to Monday
        cron_expression = f"{minute} {hour} * * {day_num}"
    elif schedule_type == "monthly":
        cron_expression = f"{minute} {hour} 1 * *"  # 1st of each month
    else:
        print(f"❌ Invalid schedule type: {schedule_type}")
        return False

    # Create cron job command
    python_path = sys.executable
    command = f"{python_path} {script_path}"

    # Create cron job entry with comment
    cron_job = f"# Energy IC Copilot - SEC Data Updates ({schedule_type})\n"
    cron_job += f"{cron_expression} {command}"

    print("📋 Generated Cron Job:")
    print("=" * 50)
    print(cron_job)
    print("=" * 50)

    return cron_job

def install_cron_job(cron_job):
    """Install the cron job on the system"""
    try:
        # Get current crontab
        result = subprocess.run(['crontab', '-l'],
                              capture_output=True, text=True)

        current_crontab = result.stdout if result.returncode == 0 else ""

        # Check if our job is already installed
        if "Energy IC Copilot - SEC Data Updates" in current_crontab:
            print("⚠️  Cron job already exists. Updating...")
            # Remove existing job
            lines = current_crontab.split('\n')
            filtered_lines = []
            skip_next = False

            for line in lines:
                if "Energy IC Copilot - SEC Data Updates" in line:
                    skip_next = True
                    continue
                elif skip_next and line.strip() == "":
                    skip_next = False
                    continue
                elif skip_next:
                    continue
                else:
                    filtered_lines.append(line)

            current_crontab = '\n'.join(filtered_lines)

        # Add new job
        new_crontab = current_crontab.rstrip() + '\n\n' + cron_job + '\n'

        # Install new crontab
        process = subprocess.run(['crontab', '-'],
                               input=new_crontab, text=True,
                               capture_output=True)

        if process.returncode == 0:
            print("✅ Cron job installed successfully!")
            print("\n📅 Next scheduled run:")
            _show_next_run(cron_job)
            return True
        else:
            print("❌ Failed to install cron job:")
            print(process.stderr)
            return False

    except Exception as e:
        print(f"❌ Error installing cron job: {e}")
        return False

def remove_cron_job():
    """Remove the SEC data update cron job"""
    try:
        # Get current crontab
        result = subprocess.run(['crontab', '-l'],
                              capture_output=True, text=True)

        if result.returncode != 0:
            print("ℹ️  No crontab found")
            return True

        current_crontab = result.stdout

        # Check if our job exists
        if "Energy IC Copilot - SEC Data Updates" not in current_crontab:
            print("ℹ️  SEC update cron job not found")
            return True

        # Remove our job
        lines = current_crontab.split('\n')
        filtered_lines = []
        skip_next = False

        for line in lines:
            if "Energy IC Copilot - SEC Data Updates" in line:
                skip_next = True
                continue
            elif skip_next and (line.strip() == "" or line.startswith("#")):
                skip_next = False
                continue
            elif skip_next:
                continue
            else:
                filtered_lines.append(line)

        new_crontab = '\n'.join(filtered_lines)

        # Install updated crontab
        process = subprocess.run(['crontab', '-'],
                               input=new_crontab, text=True,
                               capture_output=True)

        if process.returncode == 0:
            print("✅ Cron job removed successfully!")
            return True
        else:
            print("❌ Failed to remove cron job:")
            print(process.stderr)
            return False

    except Exception as e:
        print(f"❌ Error removing cron job: {e}")
        return False

def list_cron_jobs():
    """List current cron jobs"""
    try:
        result = subprocess.run(['crontab', '-l'],
                              capture_output=True, text=True)

        if result.returncode != 0:
            print("ℹ️  No crontab found")
            return

        lines = result.stdout.split('\n')
        found_jobs = []

        for i, line in enumerate(lines):
            if "Energy IC Copilot - SEC Data Updates" in line:
                # Include the next line (the actual command)
                job_info = line
                if i + 1 < len(lines):
                    job_info += '\n' + lines[i + 1]
                found_jobs.append(job_info)

        if found_jobs:
            print("📋 Current SEC Update Cron Jobs:")
            print("=" * 50)
            for job in found_jobs:
                print(job)
                print()
        else:
            print("ℹ️  No SEC update cron jobs found")

    except Exception as e:
        print(f"❌ Error listing cron jobs: {e}")

def _show_next_run(cron_job):
    """Show when the next cron job will run"""
    try:
        # Extract cron expression from job
        lines = cron_job.split('\n')
        cron_line = None
        for line in lines:
            if line.strip() and not line.startswith('#'):
                cron_line = line.split()[0:5]  # First 5 fields are cron expression
                break

        if cron_line:
            cron_expr = ' '.join(cron_line)
            print(f"Cron expression: {cron_expr}")

            # Use 'at' command to show next run (if available)
            try:
                result = subprocess.run(['at', 'now + 1 minute'],
                                      input=f'echo "Next run: $(date)"',
                                      capture_output=True, text=True)
            except:
                pass

    except Exception as e:
        print(f"Could not determine next run time: {e}")

def test_cron_job():
    """Test the cron job by running it immediately"""
    print("🧪 Testing SEC Data Update Script")
    print("=" * 40)

    project_root = Path(__file__).parent.parent
    script_path = project_root / "scripts" / "update_sec_data.py"

    try:
        result = subprocess.run([
            sys.executable, str(script_path),
            "--companies", "PPL",  # Test with just one company
            "--output", str(project_root / "data")
        ], capture_output=True, text=True)

        print("📋 Test Results:")
        print("─" * 20)
        print(result.stdout)

        if result.stderr:
            print("⚠️  Warnings/Errors:")
            print(result.stderr)

        if result.returncode == 0:
            print("✅ Test completed successfully!")
        else:
            print(f"❌ Test failed with exit code: {result.returncode}")

        return result.returncode == 0

    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        return False

def main():
    """Main cron job setup script"""
    import argparse

    parser = argparse.ArgumentParser(
        description="Setup cron jobs for SEC data updates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s install --schedule weekly --day monday --time 09:00
  %(prog)s remove
  %(prog)s list
  %(prog)s test
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Install command
    install_parser = subparsers.add_parser('install', help='Install cron job')
    install_parser.add_argument('--schedule', choices=['daily', 'weekly', 'monthly'],
                               default='weekly', help='Update frequency')
    install_parser.add_argument('--day', default='monday',
                               help='Day of week for weekly updates')
    install_parser.add_argument('--time', default='09:00',
                               help='Time for updates (HH:MM)')

    # Remove command
    remove_parser = subparsers.add_parser('remove', help='Remove cron job')

    # List command
    list_parser = subparsers.add_parser('list', help='List current cron jobs')

    # Test command
    test_parser = subparsers.add_parser('test', help='Test the update script')

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    try:
        if args.command == 'install':
            cron_job = create_cron_job(args.schedule, args.day, args.time)
            if cron_job and install_cron_job(cron_job):
                print("\n🎉 SEC data updates are now automated!")
                print("💡 The system will automatically fetch latest SEC filings")
                print("   and update financial data according to your schedule.")

        elif args.command == 'remove':
            if remove_cron_job():
                print("✅ SEC update cron job removed")

        elif args.command == 'list':
            list_cron_jobs()

        elif args.command == 'test':
            if test_cron_job():
                print("✅ Test successful! Cron job is ready to be installed.")
            else:
                print("❌ Test failed. Please check the configuration.")

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
