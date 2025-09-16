#!/usr/bin/env bash
set -euo pipefail

# Collect a filtered git patch of relevant changes.
# - Compares against the default branch on origin (origin/HEAD),
#   falling back to origin/main or origin/master when necessary.
# - Excludes lockfiles, build artifacts, vendor dirs, VCS, common binary/image types.
# - Skips very large files (> CMUX_DIFF_MAX_SIZE_BYTES, default 200000 bytes).
# - Includes modifications, additions, deletions, and renames.

# Force no pager to ensure full stdout output
export GIT_PAGER=cat
export PAGER=cat

MAX_SIZE=${CMUX_DIFF_MAX_SIZE_BYTES:-200000}
TARGET_PATH="${1:-$(pwd)}"

is_ignored_path() {
  local p="$1"
  case "$p" in
    # VCS/metadata
    .git/*|.git) return 0 ;;

    # Node/JS
    node_modules/*|pnpm-lock.yaml|yarn.lock|package-lock.json|*.map|dist/*|build/*|.next/*|out/*|.turbo/*) return 0 ;;

    # Python
    venv/*|.venv/*|__pycache__/*|Pipfile.lock|poetry.lock) return 0 ;;

    # Ruby/PHP
    Gemfile.lock|composer.lock|vendor/*) return 0 ;;

    # Rust
    target/*|Cargo.lock) return 0 ;;

    # Coverage/artifacts
    coverage/*|.nyc_output/*) return 0 ;;

    # Misc binaries and logs
    *.min.js|*.min.css|*.log|*.tmp|*.cache|.DS_Store) return 0 ;;

    # Images and common binaries
    *.png|*.jpg|*.jpeg|*.gif|*.svg|*.ico|*.webp|*.bmp|*.pdf|*.zip|*.tar|*.tar.gz|*.tgz|*.gz|*.xz|*.bz2|*.7z|*.mp4|*.mp3|*.avi) return 0 ;;
  esac
  return 1
}

# Determine the base ref on origin
determine_base_ref() {
  if [[ -n "${CMUX_DIFF_BASE:-}" ]]; then
    echo "${CMUX_DIFF_BASE}"
    return 0
  fi

  # Try to fetch origin quietly if present; ignore failures
  if git rev-parse --git-dir >/dev/null 2>&1 && git remote get-url origin >/dev/null 2>&1; then
    git fetch --quiet --prune origin 2>/dev/null || true
  fi

  # Resolve origin/HEAD -> e.g., origin/main
  local origin_head
  origin_head=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)
  if [[ -n "$origin_head" ]]; then
    echo "$origin_head"
    return 0
  fi

  # Fallbacks
  if git rev-parse --verify --quiet origin/main >/dev/null; then
    echo "origin/main"
    return 0
  fi
  if git rev-parse --verify --quiet origin/master >/dev/null; then
    echo "origin/master"
    return 0
  fi

  # No remote default found
  echo ""
}

collect_diff_for_repo() {
  local repo_root="$1"
  (
    cd "$repo_root"

    base_ref=$(determine_base_ref)

    if [[ -n "$base_ref" ]]; then
      # Compute merge-base and diff against it so staged and unstaged changes are included
      merge_base=$(git merge-base "$base_ref" HEAD 2>/dev/null || echo "")

      # Gather changed tracked files relative to merge-base
      changed_tracked=$(git --no-pager diff --name-only "$merge_base" || true)
      # Also gather untracked files
      untracked=$(git ls-files --others --exclude-standard || true)
      filtered_files=()
      OIFS="$IFS"; IFS=$'\n'
      for f in $changed_tracked; do
        [[ -n "$f" ]] || continue
        if is_ignored_path "$f"; then continue; fi
        size=0
        if [[ -f "$f" ]]; then
          size=$(wc -c <"$f" 2>/dev/null || echo 0)
        elif [[ -n "$merge_base" ]]; then
          # For deletions, look up the blob size at merge-base
          size=$(git cat-file -s "$merge_base:$f" 2>/dev/null || echo 0)
        fi
        case "$size" in
          ''|*[!0-9]*) size=0 ;;
        esac
        if [ "$size" -gt "$MAX_SIZE" ]; then continue; fi
        filtered_files+=("$f")
      done
      # Include untracked files after filtering
      for f in $untracked; do
        [[ -n "$f" ]] || continue
        if is_ignored_path "$f"; then continue; fi
        if [[ -f "$f" ]]; then
          size=$(wc -c <"$f" 2>/dev/null || echo 0)
          case "$size" in
            ''|*[!0-9]*) size=0 ;;
          esac
          if [ "$size" -gt "$MAX_SIZE" ]; then continue; fi
        fi
        filtered_files+=("$f")
      done
      IFS="$OIFS"

      if [ ${#filtered_files[@]} -eq 0 ]; then
        exit 0
      fi

      # Output the filtered diff against merge-base (includes staged + unstaged)
      git --no-pager diff -M --no-color "$merge_base" -- "${filtered_files[@]}" || true
      exit 0
    fi

    # Fallback: no suitable origin base found. Diff the working tree by staging
    # into a temporary index with filtering (original behavior).
    tracked=$(git --no-pager diff --name-only || true)
    staged_mods=$(git --no-pager diff --name-only --cached || true)
    untracked=$(git ls-files --others --exclude-standard || true)
    deleted_list=$( (git --no-pager diff --name-only --diff-filter=D; git ls-files --deleted) 2>/dev/null | sort -u || true )

    tmp_index=$(mktemp)
    rm -f "$tmp_index" || true
    trap 'rm -f "$tmp_index"' EXIT
    export GIT_INDEX_FILE="$tmp_index"

    {
      echo "$tracked"
      echo "$staged_mods"
      echo "$untracked"
    } | while IFS= read -r f; do
      [[ -n "$f" ]] || continue
      if is_ignored_path "$f"; then continue; fi
      if [[ -f "$f" ]]; then
        size=$(wc -c <"$f" 2>/dev/null || echo 0)
        case "$size" in
          ''|*[!0-9]*) size=0 ;;
        esac
        if [ "$size" -gt "$MAX_SIZE" ]; then continue; fi
      fi
      git add -- "$f" 2>/dev/null || true
    done

    echo "$deleted_list" | while IFS= read -r f; do
      [[ -n "$f" ]] || continue
      if is_ignored_path "$f"; then continue; fi
      git update-index --remove -- "$f" 2>/dev/null || true
    done

    git --no-pager diff --staged --no-color || true
  )
}

if git -C "$TARGET_PATH" rev-parse --show-toplevel >/dev/null 2>&1; then
  repo_root=$(git -C "$TARGET_PATH" rev-parse --show-toplevel)
  collect_diff_for_repo "$repo_root"
  exit 0
fi

if [[ ! -d "$TARGET_PATH" ]]; then
  echo "Not a git repository" >&2
  exit 1
fi

found_repos=()
while IFS= read -r candidate; do
  if git -C "$candidate" rev-parse --show-toplevel >/dev/null 2>&1; then
    repo_root=$(git -C "$candidate" rev-parse --show-toplevel 2>/dev/null || true)
    if [[ -n "$repo_root" ]]; then
      found_repos+=("$repo_root")
    fi
  fi
done < <(find "$TARGET_PATH" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null | sort)

if [ ${#found_repos[@]} -eq 0 ]; then
  echo "Not a git repository" >&2
  exit 1
fi

unique_repos=()
if [ ${#found_repos[@]} -gt 0 ]; then
  while IFS= read -r repo; do
    unique_repos+=("$repo")
  done < <(printf '%s\n' "${found_repos[@]}" | sort -u)
fi

first=1
for repo in "${unique_repos[@]}"; do
  diff_output=$(collect_diff_for_repo "$repo")
  repo_name=$(basename "$repo")
  if [[ $first -eq 0 ]]; then
    printf '\n'
  fi
  printf '===== Repository: %s =====\n' "$repo_name"
  if [[ -n "$diff_output" ]]; then
    printf '%s' "$diff_output"
    case "$diff_output" in
      *$'\n') ;;
      *) printf '\n' ;;
    esac
  else
    printf '(No relevant changes)\n'
  fi
  first=0
done
