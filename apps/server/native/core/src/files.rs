use anyhow::{anyhow, Result};
use fuzzy_matcher::skim::SkimMatcherV2;
use fuzzy_matcher::FuzzyMatcher;
use std::path::PathBuf;

use crate::repo::cache::{ensure_repo, resolve_repo_url};
use crate::types::{FileInfoNative, GitListRepoFilesOptions};
use crate::util::run_git;

fn detect_origin_head_branch(repo_path: &str) -> Option<String> {
  // Try: git symbolic-ref refs/remotes/origin/HEAD -> refs/remotes/origin/main
  if let Ok(out) = run_git(repo_path, &["symbolic-ref", "refs/remotes/origin/HEAD"]) {
    let s = out.trim();
    if let Some(short) = s.strip_prefix("refs/remotes/origin/") {
      if !short.is_empty() && short != "HEAD" {
        return Some(short.to_string());
      }
    }
  }
  // Fallback: try to get default branch from remote/origin HEAD name
  if let Ok(out) = run_git(repo_path, &["rev-parse", "--abbrev-ref", "origin/HEAD"]) {
    let s = out.trim();
    if let Some(short) = s.strip_prefix("origin/") {
      if !short.is_empty() && short != "HEAD" {
        return Some(short.to_string());
      }
    }
  }
  None
}

pub fn list_repo_files(opts: GitListRepoFilesOptions) -> Result<Vec<FileInfoNative>> {
  // Resolve local repo path
  let repo_path = if let Some(p) = &opts.originPathOverride {
    PathBuf::from(p)
  } else {
    let url = resolve_repo_url(opts.repoFullName.as_deref(), opts.repoUrl.as_deref())?;
    ensure_repo(&url)?
  };
  let cwd = repo_path.to_string_lossy().to_string();

  // Choose branch
  let branch = if let Some(b) = opts.branch.as_deref() {
    b.to_string()
  } else {
    detect_origin_head_branch(&cwd).unwrap_or_else(|| "main".to_string())
  };

  // Determine ref to list
  // Prefer remote tracking branch; fall back to local branch
  let mut refspec = format!("origin/{}", branch);
  if run_git(&cwd, &["rev-parse", "--verify", &format!("refs/remotes/{}", refspec)]).is_err() {
    // fallback to local
    refspec = branch.clone();
  }

  // List files at the ref
  // git ls-tree -r --name-only <ref>
  let out = run_git(&cwd, &["ls-tree", "-r", "--name-only", &refspec])
    .map_err(|e| anyhow!("git ls-tree failed for {}: {}", refspec, e))?;
  let mut files: Vec<FileInfoNative> = Vec::new();
  for line in out.lines() {
    let rel = line.trim();
    if rel.is_empty() { continue; }
    let pb = repo_path.join(rel);
    let name = PathBuf::from(rel)
      .file_name()
      .and_then(|s| s.to_str())
      .unwrap_or("")
      .to_string();
    files.push(FileInfoNative {
      path: pb.to_string_lossy().to_string(),
      name,
      isDirectory: false,
      relativePath: rel.to_string(),
    });
  }

  // If pattern provided, fuzzy match and sort by score desc, then by path asc
  if let Some(pat) = opts.pattern.as_deref() {
    let query = pat.trim();
    if !query.is_empty() {
      let matcher = SkimMatcherV2::default();
      let mut scored: Vec<(i64, FileInfoNative)> = files
        .into_iter()
        .filter_map(|f| matcher.fuzzy_match(&f.relativePath, query).map(|s| (s, f)))
        .collect();
      scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.relativePath.cmp(&b.1.relativePath)));
      return Ok(scored.into_iter().map(|(_, f)| f).collect());
    }
  }

  // Default sort: path asc
  files.sort_by(|a, b| a.relativePath.cmp(&b.relativePath));
  Ok(files)
}

#[cfg(test)]
mod tests {
  use super::*;
  use tempfile::tempdir;
  use std::fs;

  #[test]
  fn lists_and_fuzzy_sorts_files_for_branch() {
    let tmp = tempdir().expect("tempdir");
    let root = tmp.path();

    // Create bare origin
    let origin_path = root.join("origin.git");
    fs::create_dir_all(&origin_path).unwrap();
    run_git(root.to_str().unwrap(), &["init", "--bare", origin_path.file_name().unwrap().to_str().unwrap()]).expect("init bare");

    // Seed repo with files and branches
    let seed = root.join("seed");
    fs::create_dir_all(&seed).unwrap();
    run_git(seed.to_str().unwrap(), &["init"]).unwrap();
    run_git(seed.to_str().unwrap(), &["config", "user.name", "Test"]).unwrap();
    run_git(seed.to_str().unwrap(), &["config", "user.email", "test@example.com"]).unwrap();
    // main branch
    run_git(seed.to_str().unwrap(), &["checkout", "-b", "main"]).unwrap();
    fs::create_dir_all(seed.join("src")).unwrap();
    fs::create_dir_all(seed.join("docs")).unwrap();
    fs::write(seed.join("README.md"), b"readme").unwrap();
    fs::write(seed.join("src").join("main.ts"), b"console.log()").unwrap();
    fs::write(seed.join("docs").join("guide.md"), b"guide").unwrap();
    run_git(seed.to_str().unwrap(), &["add", "."]).unwrap();
    run_git(seed.to_str().unwrap(), &["commit", "-m", "init main"]).unwrap();
    // feature branch adds a file
    run_git(seed.to_str().unwrap(), &["checkout", "-b", "feature"]).unwrap();
    fs::create_dir_all(seed.join("src").join("feature")).unwrap();
    fs::write(seed.join("src").join("feature").join("util.ts"), b"util").unwrap();
    run_git(seed.to_str().unwrap(), &["add", "."]).unwrap();
    run_git(seed.to_str().unwrap(), &["commit", "-m", "add feature util"]).unwrap();

    // Push to origin
    let origin_url = origin_path.to_string_lossy().to_string();
    run_git(seed.to_str().unwrap(), &["remote", "add", "origin", &origin_url]).unwrap();
    run_git(seed.to_str().unwrap(), &["push", "-u", "origin", "main"]).unwrap();
    run_git(seed.to_str().unwrap(), &["push", "-u", "origin", "feature"]).unwrap();

    // Fresh clone to get refs/remotes/origin/* locally
    let clone = root.join("clone");
    run_git(root.to_str().unwrap(), &["clone", &origin_url, clone.file_name().unwrap().to_str().unwrap()]).unwrap();

    // List files on main
    let list_main = list_repo_files(GitListRepoFilesOptions {
      repoFullName: None,
      repoUrl: None,
      originPathOverride: Some(clone.to_string_lossy().to_string()),
      branch: Some("main".to_string()),
      pattern: None,
    }).expect("list main");
    let names_main: Vec<String> = list_main.iter().map(|f| f.relativePath.clone()).collect();
    assert!(names_main.contains(&"README.md".to_string()));
    assert!(names_main.contains(&"src/main.ts".to_string()));
    assert!(names_main.contains(&"docs/guide.md".to_string()));
    assert!(!names_main.contains(&"src/feature/util.ts".to_string()));

    // List files on feature
    let list_feat = list_repo_files(GitListRepoFilesOptions {
      repoFullName: None,
      repoUrl: None,
      originPathOverride: Some(clone.to_string_lossy().to_string()),
      branch: Some("feature".to_string()),
      pattern: None,
    }).expect("list feature");
    let names_feat: Vec<String> = list_feat.iter().map(|f| f.relativePath.clone()).collect();
    assert!(names_feat.contains(&"src/feature/util.ts".to_string()));

    // Fuzzy search should rank README.md for pattern "rdme"
    let fuzzy = list_repo_files(GitListRepoFilesOptions {
      repoFullName: None,
      repoUrl: None,
      originPathOverride: Some(clone.to_string_lossy().to_string()),
      branch: Some("main".to_string()),
      pattern: Some("rdme".to_string()),
    }).expect("fuzzy list");
    assert!(!fuzzy.is_empty());
    assert_eq!(fuzzy[0].relativePath, "README.md");
  }
}

