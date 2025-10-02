#!/usr/bin/env bash
set -euo pipefail

# Collect a filtered git patch between two refs with ignore rules.
# - Compares against the default branch on origin (origin/HEAD),
#   or CMUX_DIFF_BASE when provided.
# - Allows overriding the head ref via CMUX_DIFF_HEAD_REF (default HEAD).
# - Excludes lockfiles, build artifacts, vendor dirs, VCS, common binary/image types.
# - Skips very large files (> CMUX_DIFF_MAX_SIZE_BYTES, default 200000 bytes).
# - Includes modifications, additions, deletions, and renames.

export GIT_PAGER=cat
export PAGER=cat

MAX_SIZE=${CMUX_DIFF_MAX_SIZE_BYTES:-200000}

# Detect git repository location
# First try current directory
echo "[collect-crown-diff] Starting in directory: ${PWD}" >&2
echo "[collect-crown-diff] Environment variables:" >&2
echo "[collect-crown-diff]   CMUX_DIFF_BASE=${CMUX_DIFF_BASE:-<not set>}" >&2
echo "[collect-crown-diff]   CMUX_DIFF_HEAD_REF=${CMUX_DIFF_HEAD_REF:-<not set>}" >&2
echo "[collect-crown-diff]   CMUX_DIFF_MAX_SIZE_BYTES=${CMUX_DIFF_MAX_SIZE_BYTES:-<not set>}" >&2

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)

# If not found, search in subdirectories (for environment mode where repo is in /root/workspace/cmux)
if [[ -z "${repo_root}" ]]; then
  echo "[collect-crown-diff] No git repo in current directory, searching subdirectories..." >&2
  workspace_root="${PWD}"
  echo "[collect-crown-diff] Workspace root: ${workspace_root}" >&2

  # List what we're checking
  echo "[collect-crown-diff] Checking subdirectories:" >&2
  ls -la "${workspace_root}/" 2>&1 | head -20 >&2 || true

  # Check if .git exists in any immediate subdirectory
  for dir in "${workspace_root}"/*/; do
    echo "[collect-crown-diff] Checking directory: ${dir}" >&2
    if [[ -d "${dir}.git" ]]; then
      echo "[collect-crown-diff] Found .git in ${dir}" >&2
      cd "${dir}"
      repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
      if [[ -n "${repo_root}" ]]; then
        echo "[collect-crown-diff] Found git repository in subdirectory: ${repo_root}" >&2
        break
      else
        echo "[collect-crown-diff] Could not get repo root from ${dir}" >&2
      fi
    fi
  done
fi

if [[ -z "${repo_root}" ]]; then
  echo "[collect-crown-diff] ERROR: Not a git repository" >&2
  echo "[collect-crown-diff] Attempted to search from: ${PWD}" >&2
  exit 1
fi

cd "${repo_root}"
echo "[collect-crown-diff] Using git repository at: ${repo_root}" >&2

is_ignored_path() {
  local p="$1"
  case "$p" in
    .git/*|.git) return 0 ;;
    node_modules/*|pnpm-lock.yaml|yarn.lock|package-lock.json|*.map|dist/*|build/*|.next/*|out/*|.turbo/*) return 0 ;;
    venv/*|.venv/*|__pycache__/*|Pipfile.lock|poetry.lock) return 0 ;;
    Gemfile.lock|composer.lock|vendor/*) return 0 ;;
    target/*|Cargo.lock) return 0 ;;
    coverage/*|.nyc_output/*) return 0 ;;
    *.min.js|*.min.css|*.log|*.tmp|*.cache|.DS_Store) return 0 ;;
    *.png|*.jpg|*.jpeg|*.gif|*.svg|*.ico|*.webp|*.bmp|*.pdf|*.zip|*.tar|*.tar.gz|*.tgz|*.gz|*.xz|*.bz2|*.7z|*.mp4|*.mp3|*.avi) return 0 ;;
  esac
  return 1
}

# Determine the base ref on origin
determine_base_ref() {
  if [[ -n "${CMUX_DIFF_BASE:-}" ]]; then
    echo "[collect-crown-diff] Using CMUX_DIFF_BASE: ${CMUX_DIFF_BASE}" >&2
    echo "${CMUX_DIFF_BASE}"
    return 0
  fi

  echo "[collect-crown-diff] No CMUX_DIFF_BASE set, attempting to detect default branch" >&2

  if git rev-parse --git-dir >/dev/null 2>&1 && git remote get-url origin >/dev/null 2>&1; then
    echo "[collect-crown-diff] Git repository detected, fetching from origin" >&2
    if git fetch --quiet --prune origin 2>/dev/null; then
      echo "[collect-crown-diff] Successfully fetched from origin" >&2
    else
      echo "[collect-crown-diff] Failed to fetch from origin" >&2
    fi
  else
    echo "[collect-crown-diff] No git repository or origin remote found" >&2
  fi

  local origin_head
  origin_head=$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null || true)
  if [[ -n "$origin_head" ]]; then
    echo "[collect-crown-diff] Found origin/HEAD: ${origin_head}" >&2
    echo "$origin_head"
    return 0
  fi

  echo "[collect-crown-diff] Could not determine default branch" >&2
  echo ""
}

base_ref=$(determine_base_ref)
head_ref=${CMUX_DIFF_HEAD_REF:-HEAD}

echo "[collect-crown-diff] Base ref: ${base_ref:-none}, Head ref: ${head_ref}" >&2

if [[ -n "$base_ref" ]]; then
  if [[ "$base_ref" == origin/* ]]; then
    echo "[collect-crown-diff] Fetching base branch: ${base_ref#origin/}" >&2
    if git fetch --quiet origin "${base_ref#origin/}" 2>&1; then
      echo "[collect-crown-diff] Successfully fetched ${base_ref#origin/}" >&2
    else
      echo "[collect-crown-diff] Failed to fetch ${base_ref#origin/}" >&2
    fi
  fi
  if [[ "$head_ref" == origin/* ]]; then
    echo "[collect-crown-diff] Fetching head branch: ${head_ref#origin/}" >&2
    if git fetch --quiet origin "${head_ref#origin/}" 2>&1; then
      echo "[collect-crown-diff] Successfully fetched ${head_ref#origin/}" >&2
    else
      echo "[collect-crown-diff] Failed to fetch ${head_ref#origin/}" >&2
    fi
  fi

  echo "[collect-crown-diff] Computing merge-base between ${base_ref} and ${head_ref}" >&2
  merge_base=$(git merge-base "$base_ref" "$head_ref" 2>&1 || echo "")
  if [[ -z "$merge_base" ]]; then
    echo "[collect-crown-diff] ERROR: Could not determine merge-base between ${base_ref} and ${head_ref}" >&2
    echo "[collect-crown-diff] Available refs:" >&2
    git show-ref 2>&1 | head -20 >&2 || true
    exit 1
  fi
  echo "[collect-crown-diff] Merge-base: ${merge_base}" >&2

  if [[ "$head_ref" == HEAD ]]; then
    has_uncommitted=false
    if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
      has_uncommitted=true
    fi

    echo "[collect-crown-diff] Collecting diff for HEAD (has_uncommitted=${has_uncommitted})" >&2
    echo "[collect-crown-diff] Current HEAD: $(git rev-parse HEAD 2>/dev/null || echo '<unknown>')" >&2

    if [[ "$has_uncommitted" == true ]]; then
      echo "[collect-crown-diff] Detecting changed and untracked files" >&2
      changed_tracked=$(git --no-pager diff --name-only "$merge_base" || true)
      untracked=$(git ls-files --others --exclude-standard || true)
      echo "[collect-crown-diff] Found $(echo "$changed_tracked" | wc -l) changed tracked files and $(echo "$untracked" | wc -l) untracked files" >&2
      filtered_files=()
      OIFS="$IFS"; IFS=$'\n'
      for f in $changed_tracked; do
        [[ -n "$f" ]] || continue
        if is_ignored_path "$f"; then continue; fi
        size=0
        if [[ -f "$f" ]]; then
          size=$(wc -c <"$f" 2>/dev/null || echo 0)
        elif [[ -n "$merge_base" ]]; then
          size=$(git cat-file -s "$merge_base:$f" 2>/dev/null || echo 0)
        fi
        case "$size" in
          ''|*[!0-9]*) size=0 ;;
        esac
        if [[ "$size" -gt "$MAX_SIZE" ]]; then continue; fi
        filtered_files+=("$f")
      done
      for f in $untracked; do
        [[ -n "$f" ]] || continue
        if is_ignored_path "$f"; then continue; fi
        if [[ -f "$f" ]]; then
          size=$(wc -c <"$f" 2>/dev/null || echo 0)
          case "$size" in
            ''|*[!0-9]*) size=0 ;;
          esac
          if [[ "$size" -gt "$MAX_SIZE" ]]; then continue; fi
        fi
        filtered_files+=("$f")
      done
      IFS="$OIFS"

      echo "[collect-crown-diff] Filtered to ${#filtered_files[@]} files after size/ignore checks" >&2
      if [[ ${#filtered_files[@]} -eq 0 ]]; then
        echo "[collect-crown-diff] No files to diff, exiting" >&2
        exit 0
      fi

      tmp_index=$(mktemp)
      rm -f "$tmp_index" || true
      trap 'rm -f "$tmp_index"' EXIT
      export GIT_INDEX_FILE="$tmp_index"
      echo "[collect-crown-diff] Creating temporary index at: ${tmp_index}" >&2
      git read-tree HEAD
      for f in "${filtered_files[@]}"; do
        if [[ -f "$f" ]]; then
          git add -- "$f" 2>/dev/null || true
        fi
      done
      echo "[collect-crown-diff] Generating diff against merge-base ${merge_base}" >&2
      diff_output=$(git --no-pager diff --staged -M --no-color "$merge_base")
      if [[ $? -ne 0 ]]; then
        echo "[collect-crown-diff] ERROR: git diff failed for staged changes against $merge_base" >&2
        exit 1
      fi
      diff_lines=$(echo "$diff_output" | wc -l)
      diff_size=$(echo "$diff_output" | wc -c)
      echo "[collect-crown-diff] Diff generated successfully: ${diff_lines} lines, ${diff_size} bytes" >&2
      echo "$diff_output"
      unset GIT_INDEX_FILE
    else
      echo "[collect-crown-diff] No uncommitted changes, comparing HEAD to merge-base" >&2
      changed_files=$(git --no-pager diff --name-only "$merge_base" HEAD || true)
      echo "[collect-crown-diff] Found $(echo "$changed_files" | wc -l) changed files between merge-base and HEAD" >&2
      filtered_files=()
      OIFS="$IFS"; IFS=$'\n'
      for f in $changed_files; do
        [[ -n "$f" ]] || continue
        if is_ignored_path "$f"; then continue; fi
        size=0
        if git cat-file -e "HEAD:$f" 2>/dev/null; then
          size=$(git cat-file -s "HEAD:$f" 2>/dev/null || echo 0)
        elif git cat-file -e "$merge_base:$f" 2>/dev/null; then
          size=$(git cat-file -s "$merge_base:$f" 2>/dev/null || echo 0)
        fi
        case "$size" in
          ''|*[!0-9]*) size=0 ;;
        esac
        if [[ "$size" -gt "$MAX_SIZE" ]]; then continue; fi
        filtered_files+=("$f")
      done
      IFS="$OIFS"

      echo "[collect-crown-diff] Filtered to ${#filtered_files[@]} files after size/ignore checks" >&2
      if [[ ${#filtered_files[@]} -eq 0 ]]; then
        echo "[collect-crown-diff] No files to diff, exiting" >&2
        exit 0
      fi

      echo "[collect-crown-diff] Generating diff between ${merge_base} and HEAD" >&2
      diff_output=$(git --no-pager diff -M --no-color "$merge_base" HEAD -- "${filtered_files[@]}")
      if [[ $? -ne 0 ]]; then
        echo "[collect-crown-diff] ERROR: git diff failed for HEAD against $merge_base" >&2
        exit 1
      fi
      diff_lines=$(echo "$diff_output" | wc -l)
      diff_size=$(echo "$diff_output" | wc -c)
      echo "[collect-crown-diff] Diff generated successfully: ${diff_lines} lines, ${diff_size} bytes" >&2
      echo "$diff_output"
    fi
  else
    echo "[collect-crown-diff] Collecting diff between ${merge_base} and ${head_ref}" >&2
    changed_files=$(git --no-pager diff --name-only "$merge_base" "$head_ref" || true)
    echo "[collect-crown-diff] Found $(echo "$changed_files" | wc -l) changed files between merge-base and ${head_ref}" >&2
    filtered_files=()
    OIFS="$IFS"; IFS=$'\n'
    for f in $changed_files; do
      [[ -n "$f" ]] || continue
      if is_ignored_path "$f"; then continue; fi
      size=0
      if git cat-file -e "$head_ref:$f" 2>/dev/null; then
        size=$(git cat-file -s "$head_ref:$f" 2>/dev/null || echo 0)
      elif git cat-file -e "$merge_base:$f" 2>/dev/null; then
        size=$(git cat-file -s "$merge_base:$f" 2>/dev/null || echo 0)
      fi
      case "$size" in
        ''|*[!0-9]*) size=0 ;;
      esac
      if [[ "$size" -gt "$MAX_SIZE" ]]; then continue; fi
      filtered_files+=("$f")
    done
    IFS="$OIFS"

    echo "[collect-crown-diff] Filtered to ${#filtered_files[@]} files after size/ignore checks" >&2
    if [[ ${#filtered_files[@]} -eq 0 ]]; then
      echo "[collect-crown-diff] No files to diff, exiting" >&2
      exit 0
    fi

    echo "[collect-crown-diff] Generating diff between ${merge_base} and ${head_ref}" >&2
    diff_output=$(git --no-pager diff -M --no-color "$merge_base" "$head_ref" -- "${filtered_files[@]}")
    if [[ $? -ne 0 ]]; then
      echo "[collect-crown-diff] ERROR: git diff failed for $head_ref against $merge_base" >&2
      exit 1
    fi
    diff_lines=$(echo "$diff_output" | wc -l)
    diff_size=$(echo "$diff_output" | wc -c)
    echo "[collect-crown-diff] Diff generated successfully: ${diff_lines} lines, ${diff_size} bytes" >&2
    echo "$diff_output"
  fi

  exit 0
fi

echo "[collect-crown-diff] No base ref found, collecting all working directory changes" >&2
tracked=$(git --no-pager diff --name-only || true)
staged_mods=$(git --no-pager diff --name-only --cached || true)
untracked=$(git ls-files --others --exclude-standard || true)
deleted_list=$( (git --no-pager diff --name-only --diff-filter=D; git ls-files --deleted) 2>/dev/null | sort -u || true )
echo "[collect-crown-diff] Found tracked: $(echo "$tracked" | wc -l), staged: $(echo "$staged_mods" | wc -l), untracked: $(echo "$untracked" | wc -l), deleted: $(echo "$deleted_list" | wc -l)" >&2

tmp_index=$(mktemp)
rm -f "$tmp_index" || true
trap 'rm -f "$tmp_index"' EXIT
export GIT_INDEX_FILE="$tmp_index"
echo "[collect-crown-diff] Creating temporary index at: ${tmp_index}" >&2

files_added=0
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
    if [[ "$size" -gt "$MAX_SIZE" ]]; then continue; fi
  fi
  if git add -- "$f" 2>/dev/null; then
    ((files_added++)) || true
  fi
done

echo "[collect-crown-diff] Added ${files_added} files to temporary index" >&2

echo "$deleted_list" | while IFS= read -r f; do
  [[ -n "$f" ]] || continue
  if is_ignored_path "$f"; then continue; fi
  git update-index --remove -- "$f" 2>/dev/null || true
done

echo "[collect-crown-diff] Generating final diff" >&2
diff_output=$(git --no-pager diff --staged --no-color)
if [[ $? -ne 0 ]]; then
  echo "[collect-crown-diff] ERROR: git diff --staged failed" >&2
  exit 1
fi
diff_lines=$(echo "$diff_output" | wc -l)
diff_size=$(echo "$diff_output" | wc -c)
echo "[collect-crown-diff] Diff generated successfully: ${diff_lines} lines, ${diff_size} bytes" >&2
echo "$diff_output"
