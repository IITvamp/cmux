#!/usr/bin/env python3
"""cmux CLI entry point"""

import subprocess
import sys
import os
import platform
from pathlib import Path


def main():
    """Main entry point for cmux CLI"""
    try:
        # Check if we're in a development environment
        workspace_root = Path(__file__).parent.parent
        
        # Look for the Node.js version of cmux
        node_cmux_path = workspace_root / "packages" / "cmux" / "dist" / "cli.js"
        
        if node_cmux_path.exists():
            # We're in development, use the Node.js version
            result = subprocess.run(["node", str(node_cmux_path)] + sys.argv[1:])
            sys.exit(result.returncode)
        else:
            # Check platform compatibility
            current_platform = platform.system().lower()
            current_arch = platform.machine().lower()
            
            if current_platform == "linux" and "arm" in current_arch:
                print("Warning: cmux is primarily designed for macOS. Linux ARM64 support is experimental.", file=sys.stderr)
            
            # Check if npx/bunx is available and use the published version
            for cmd in ["bunx", "npx"]:
                try:
                    result = subprocess.run([cmd, "cmux@latest"] + sys.argv[1:], check=False)
                    sys.exit(result.returncode)
                except FileNotFoundError:
                    continue
            
            # If no Node.js runtime is available, provide helpful instructions
            print("cmux requires Node.js to run the main application.", file=sys.stderr)
            print("", file=sys.stderr)
            print("Install Node.js and try one of these commands:", file=sys.stderr)
            print("  npx cmux@latest", file=sys.stderr)
            print("  bunx cmux@latest", file=sys.stderr)
            print("", file=sys.stderr)
            print("Or install via npm/pnpm/yarn:", file=sys.stderr)
            print("  npm install -g cmux", file=sys.stderr)
            print("  pnpm add -g cmux", file=sys.stderr)
            print("  yarn global add cmux", file=sys.stderr)
            sys.exit(1)
            
    except KeyboardInterrupt:
        sys.exit(1)
    except Exception as e:
        print(f"Error running cmux: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
