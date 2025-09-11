use anyhow::{anyhow, Result};
use dirs_next::cache_dir;
use std::{fs, path::PathBuf};

use crate::util::run_git;

const MAX_CACHE_REPOS: usize = 20;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct CacheIndexEntry {
  slug: String,
  path: String,
  last_access_ms: u128,
}

#[derive(Default, Debug, Clone, serde::Serialize, serde::Deserialize)]
struct CacheIndex {
  entries: Vec<CacheIndexEntry>,
}

fn default_cache_root() -> PathBuf {
  if let Ok(dir) = std::env::var("CMUX_RUST_GIT_CACHE") { return PathBuf::from(dir); }
  if let Some(mut d) = cache_dir() { d.push("cmux-git-cache"); return d; }
  std::env::temp_dir().join("cmux-git-cache")
}

fn slug_from_url(url: &str) -> String {
  let clean = url.trim_end_matches(".git");
  let name = clean.split('/').rev().take(2).collect::<Vec<_>>();
  if name.len() == 2 { format!("{}__{}", name[1], name[0]) } else { clean.replace(['/', ':', '@', '\\'], "_") }
}

pub fn ensure_repo(url: &str) -> Result<PathBuf> {
  let root = default_cache_root();
  fs::create_dir_all(&root)?;
  let path = root.join(slug_from_url(url));
  // If path exists but doesn't look like a valid git repo, remove and reclone
  let git_dir = path.join(".git");
  let head = git_dir.join("HEAD");
  if path.exists() && (!git_dir.exists() || !head.exists()) {
    let _ = fs::remove_dir_all(&path);
  }
  if !path.exists() {
    fs::create_dir_all(&path)?;
    // Clone full history (no depth) for simplicity and future merge-base queries
    run_git(
      root.to_string_lossy().as_ref(),
      &["clone", "--no-single-branch", url, path.file_name().unwrap().to_str().unwrap()]
    )?;
  } else {
    // Best-effort fetch to update refs, tags, and prune using gix
    let _ = fetch_origin_all_path(&path);
  }
  // If shallow, unshallow to have full history locally
  let shallow = path.join(".git").join("shallow");
  if shallow.exists() {
    let _ = run_git(path.to_string_lossy().as_ref(), &["fetch", "--unshallow", "--tags"]);
  }

  // Update LRU cache metadata and evict old repos beyond capacity
  update_cache_index(&root, &path)?;
  enforce_cache_limit(&root)?;
  Ok(path)
}

pub fn resolve_repo_url(repo_full_name: Option<&str>, repo_url: Option<&str>) -> Result<String> {
  if let Some(u) = repo_url { return Ok(u.to_string()); }
  if let Some(full) = repo_full_name { return Ok(format!("https://github.com/{}.git", full)); }
  Err(anyhow!("repoUrl or repoFullName required"))
}

fn load_index(root: &PathBuf) -> CacheIndex {
  let idx_path = root.join("cache-index.json");
  if let Ok(data) = fs::read(&idx_path) {
    if let Ok(idx) = serde_json::from_slice::<CacheIndex>(&data) {
      return idx;
    }
  }
  CacheIndex::default()
}

fn save_index(root: &PathBuf, idx: &CacheIndex) -> Result<()> {
  let idx_path = root.join("cache-index.json");
  let data = serde_json::to_vec_pretty(idx)?;
  fs::write(idx_path, data)?;
  Ok(())
}

fn update_cache_index(root: &PathBuf, repo_path: &PathBuf) -> Result<()> {
  let mut idx = load_index(root);
  let slug = repo_path
    .file_name()
    .and_then(|s| s.to_str())
    .unwrap_or("")
    .to_string();
  let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap()
    .as_millis();

  if let Some(e) = idx.entries.iter_mut().find(|e| e.slug == slug) {
    e.last_access_ms = now;
    e.path = repo_path.to_string_lossy().to_string();
  } else {
    idx.entries.push(CacheIndexEntry {
      slug,
      path: repo_path.to_string_lossy().to_string(),
      last_access_ms: now,
    });
  }
  // Keep unique by slug
  idx.entries.sort_by(|a, b| b.last_access_ms.cmp(&a.last_access_ms));
  idx.entries.dedup_by(|a, b| a.slug == b.slug);
  save_index(root, &idx)?;
  Ok(())
}

pub fn fetch_origin_all_path(path: &std::path::Path) -> Result<()> {
  let cwd = path.to_string_lossy().to_string();
  let _ = run_git(&cwd, &["fetch", "--all", "--tags", "--prune"]);
  Ok(())
}

fn enforce_cache_limit(root: &PathBuf) -> Result<()> {
  let mut idx = load_index(root);
  if idx.entries.len() <= MAX_CACHE_REPOS { return Ok(()); }
  idx.entries.sort_by(|a, b| b.last_access_ms.cmp(&a.last_access_ms));
  let survivors = idx.entries[..MAX_CACHE_REPOS].to_vec();
  let victims = idx.entries[MAX_CACHE_REPOS..].to_vec();
  // Remove victim directories from disk
  for v in &victims {
    let p = PathBuf::from(&v.path);
    let _ = fs::remove_dir_all(&p);
  }
  idx.entries = survivors;
  save_index(root, &idx)?;
  Ok(())
}
