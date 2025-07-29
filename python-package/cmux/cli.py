#!/usr/bin/env python3
"""
cmux CLI - Python wrapper for downloading and running the cmux binary
"""

import os
import sys
import subprocess
import tempfile
import shutil
import platform
import requests
from pathlib import Path

# Package version
VERSION = "0.1.0"

# GitHub release URLs
GITHUB_REPO = "lawrencecchen/cmux"
BASE_URL = f"https://github.com/{GITHUB_REPO}/releases/latest/download"

def get_platform():
    """Get the current platform identifier"""
    system = platform.system().lower()
    machine = platform.machine().lower()
    
    if system == "darwin":
        if machine in ("x86_64", "amd64"):
            return "darwin-x64"
        elif machine in ("arm64", "aarch64"):
            return "darwin-arm64"
    elif system == "linux":
        if machine in ("x86_64", "amd64"):
            return "linux-x64"
        elif machine in ("arm64", "aarch64"):
            return "linux-arm64"
    elif system == "windows":
        if machine in ("x86_64", "amd64"):
            return "win32-x64"
        elif machine in ("arm64", "aarch64"):
            return "win32-arm64"
    
    raise RuntimeError(f"Unsupported platform: {system}-{machine}")

def get_binary_name():
    """Get the binary name for the current platform"""
    platform_id = get_platform()
    if platform_id.startswith("win32"):
        return "cmux-cli.exe"
    else:
        return "cmux-cli"

def get_cmux_dir():
    """Get the cmux directory in user's home"""
    home = Path.home()
    cmux_dir = home / ".cmux"
    cmux_dir.mkdir(exist_ok=True)
    return cmux_dir

def download_binary(url, dest_path):
    """Download the binary from URL to destination path"""
    print(f"Downloading cmux from {url}...")
    
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Write to temporary file first
        temp_path = dest_path.with_suffix(dest_path.suffix + ".tmp")
        with open(temp_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        # Move to final destination
        temp_path.replace(dest_path)
        
        # Make executable on Unix-like systems
        if platform.system().lower() != "windows":
            dest_path.chmod(0o755)
            
        print(f"Downloaded cmux to {dest_path}")
        return True
        
    except Exception as e:
        print(f"Error downloading cmux: {e}")
        if dest_path.exists():
            dest_path.unlink()
        return False

def get_installed_binary_path():
    """Get the path to the installed cmux binary"""
    cmux_dir = get_cmux_dir()
    binary_name = get_binary_name()
    return cmux_dir / binary_name

def ensure_binary():
    """Ensure the cmux binary is downloaded and available"""
    binary_path = get_installed_binary_path()
    
    # Check if binary exists and is valid
    if binary_path.exists():
        try:
            # Try to get version
            result = subprocess.run(
                [str(binary_path), "--version"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                return binary_path
        except (subprocess.TimeoutExpired, subprocess.SubprocessError):
            pass
    
    # Download binary
    binary_name = get_binary_name()
    platform_id = get_platform()
    download_url = f"{BASE_URL}/{binary_name}"
    
    if not download_binary(download_url, binary_path):
        print("Failed to download cmux binary")
        sys.exit(1)
    
    return binary_path

def main():
    """Main entry point"""
    # If no arguments or --help, show help
    if len(sys.argv) == 1 or "--help" in sys.argv or "-h" in sys.argv:
        print("cmux - Open source Claude Code manager")
        print("")
        print("Usage: cmux [COMMAND] [OPTIONS]")
        print("")
        print("This is a Python wrapper for the cmux binary.")
        print("The first run will download the latest cmux binary.")
        print("")
        print("For more information, visit: https://github.com/lawrencecchen/cmux")
        return
    
    # Show version if requested
    if "--version" in sys.argv or "-v" in sys.argv:
        print(f"cmux Python wrapper v{VERSION}")
        binary_path = get_installed_binary_path()
        if binary_path.exists():
            try:
                result = subprocess.run(
                    [str(binary_path), "--version"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                if result.returncode == 0:
                    print(f"Binary: {result.stdout.strip()}")
            except (subprocess.TimeoutExpired, subprocess.SubprocessError):
                pass
        return
    
    # Ensure binary is available
    binary_path = ensure_binary()
    
    # Run the binary with all arguments
    try:
        cmd = [str(binary_path)] + sys.argv[1:]
        os.execv(str(binary_path), cmd)
    except Exception as e:
        print(f"Error running cmux: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()