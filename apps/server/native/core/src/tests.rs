use std::{
  collections::HashMap,
  fs,
  process::Command,
  sync::{Mutex, OnceLock},
};
use tempfile::tempdir;
use std::path::PathBuf;
use serde::Deserialize;
use crate::{
  diff::refs,
  repo::cache::{ensure_repo, resolve_repo_url},
  types::{GitDiffOptions, GitDiffWorkspaceOptions},
  util::run_git,
};

fn run(cwd: &std::path::Path, cmd: &str) {
  let status = if cfg!(target_os = "windows") {
    Command::new("cmd").arg("/C").arg(cmd).current_dir(cwd).status()
  } else {
    Command::new("sh").arg("-c").arg(cmd).current_dir(cwd).status()
  }
  .expect("spawn");
  assert!(status.success(), "command failed: {cmd}");
}

fn find_git_root(mut p: PathBuf) -> PathBuf {
  loop {
    if p.join(".git").exists() { return p; }
    if !p.pop() { break; }
  }
  panic!(".git not found from test cwd");
}

const LARGE_MAX_BYTES: i32 = 64 * 1024 * 1024;

#[derive(Debug, Deserialize)]
struct GroundTruthFile {
  #[allow(dead_code)]
  generated_at: String,
  repos: HashMap<String, Vec<PullRequestRecord>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PullRequestRecord {
  repo: String,
  number: u64,
  #[allow(dead_code)]
  is_merged: bool,
  merge_commit_sha: Option<String>,
  last_commit_sha: String,
  #[allow(dead_code)]
  base_sha: String,
  additions: i64,
  deletions: i64,
  changed_files: i64,
}

#[derive(Clone, Debug)]
struct CachedDiff {
  additions: i64,
  deletions: i64,
  changed_files: usize,
  debug: refs::DiffComputationDebug,
}

static GROUND_TRUTH: OnceLock<GroundTruthFile> = OnceLock::new();
static PULL_FETCH_CACHE: OnceLock<Mutex<HashMap<String, bool>>> = OnceLock::new();
static DIFF_CACHE: OnceLock<Mutex<HashMap<String, CachedDiff>>> = OnceLock::new();

fn ground_truth() -> &'static GroundTruthFile {
  GROUND_TRUTH.get_or_init(|| {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let repo_root = find_git_root(manifest_dir);
    let path = repo_root.join("data/github/pr-ground-truth.json");
    let json = fs::read_to_string(&path)
      .unwrap_or_else(|err| panic!("failed to read ground truth file {}: {err}", path.display()));
    serde_json::from_str(&json)
      .unwrap_or_else(|err| panic!("failed to parse ground truth file {}: {err}", path.display()))
  })
}

fn ensure_repo_with_pull_refs(repo_slug: &str) -> PathBuf {
  let url = resolve_repo_url(Some(repo_slug), None).expect("resolve repo url");
  let repo_path = ensure_repo(&url).expect("ensure repo path");
  let repo_path_str = repo_path.to_string_lossy().to_string();

  let cache = PULL_FETCH_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
  let already_fetched = {
    let map = cache.lock().expect("pull fetch cache lock");
    map.get(repo_slug).copied().unwrap_or(false)
  };

  if !already_fetched {
    run_git(&repo_path_str, &["fetch", "origin", "+refs/pull/*/head:refs/cmux-tests/pull/*"])
      .unwrap_or_else(|err| panic!("failed to fetch pull refs for {repo_slug}: {err}"));
    let mut map = cache.lock().expect("pull fetch cache lock");
    map.insert(repo_slug.to_string(), true);
  }

  repo_path
}

fn compute_diff_for_pr(pr: &PullRequestRecord) -> CachedDiff {
  let cache_key = format!("{}#{}", pr.repo, pr.number);
  let cache = DIFF_CACHE.get_or_init(|| Mutex::new(HashMap::new()));
  if let Some(entry) = cache.lock().expect("diff cache lock").get(&cache_key).cloned() {
    return entry;
  }

  let repo_path = ensure_repo_with_pull_refs(&pr.repo);
  let repo_path_str = repo_path.to_string_lossy().to_string();
  let diff = crate::diff::refs::diff_refs(GitDiffOptions {
    headRef: pr.last_commit_sha.clone(),
    baseRef: None,
    repoFullName: Some(pr.repo.clone()),
    repoUrl: None,
    teamSlugOrId: None,
    originPathOverride: Some(repo_path_str.clone()),
    includeContents: Some(true),
    maxBytes: Some(LARGE_MAX_BYTES),
  })
  .unwrap_or_else(|err| panic!("diff_refs failed for {}#{}: {err}", pr.repo, pr.number));

  let debug = refs::last_diff_debug()
    .unwrap_or_else(|| panic!("missing diff debug for {}#{}", pr.repo, pr.number));

  let additions: i64 = diff.iter().map(|entry| entry.additions as i64).sum();
  let deletions: i64 = diff.iter().map(|entry| entry.deletions as i64).sum();
  let changed_files = diff.len();

  let cached = CachedDiff { additions, deletions, changed_files, debug };
  cache
    .lock()
    .expect("diff cache lock")
    .insert(cache_key, cached.clone());
  cached
}

fn first_parent_sha(repo_path: &str, commit: &str) -> Option<String> {
  let rev = format!("{commit}^1");
  run_git(repo_path, &["rev-parse", &rev])
    .ok()
    .map(|out| out.trim().to_string())
}

#[test]
fn workspace_diff_basic() {
  let tmp = tempdir().unwrap();
  let work = tmp.path().join("work");
  fs::create_dir_all(&work).unwrap();
  run(&work, "git init");
  run(&work, "git -c user.email=a@b -c user.name=test checkout -b main");
  fs::write(work.join("a.txt"), b"a1\n").unwrap();
  run(&work, "git add .");
  run(&work, "git -c user.email=a@b -c user.name=test commit -m init");

  fs::write(work.join("a.txt"), b"a1\na2\n").unwrap();
  fs::create_dir_all(work.join("src")).unwrap();
  fs::write(work.join("src/new.txt"), b"x\ny\n").unwrap();

  let out = crate::diff::workspace::diff_workspace(GitDiffWorkspaceOptions{
    worktreePath: work.to_string_lossy().to_string(),
    includeContents: Some(true),
    maxBytes: Some(1024*1024),
  }).unwrap();

  let mut has_a = false;
  let mut has_new = false;
  for e in &out {
    if e.filePath == "a.txt" { has_a = true; }
    if e.filePath == "src/new.txt" { has_new = true; }
  }
  assert!(has_a && has_new, "expected modified and untracked files");
}

#[test]
fn workspace_diff_unborn_head_uses_remote_default() {
  let tmp = tempdir().unwrap();
  let root = tmp.path();

  // Create bare origin with a main branch and one file
  let origin_path = root.join("origin.git");
  fs::create_dir_all(&origin_path).unwrap();
  run(&root, &format!("git init --bare {}", origin_path.file_name().unwrap().to_str().unwrap()));

  // Seed repo to populate origin/main
  let seed = root.join("seed");
  fs::create_dir_all(&seed).unwrap();
  run(&seed, "git init");
  run(&seed, "git -c user.email=a@b -c user.name=test checkout -b main");
  fs::write(seed.join("a.txt"), b"one\n").unwrap();
  run(&seed, "git add .");
  run(&seed, "git -c user.email=a@b -c user.name=test commit -m init");

  // Point origin HEAD to main and push
  let origin_url = origin_path.to_string_lossy().to_string();
  run(&seed, &format!("git remote add origin {}", origin_url));
  // Ensure origin default branch is main
  run(&origin_path, "git symbolic-ref HEAD refs/heads/main");
  run(&seed, "git push -u origin main");

  // Create work repo with unborn HEAD, add remote, fetch only
  let work = root.join("work");
  fs::create_dir_all(&work).unwrap();
  run(&work, "git init");
  run(&work, &format!("git remote add origin {}", origin_url));
  run(&work, "git fetch origin");

  // Modify file relative to remote default without any local commit
  fs::write(work.join("a.txt"), b"one\ntwo\n").unwrap();

  let out = crate::diff::workspace::diff_workspace(GitDiffWorkspaceOptions{
    worktreePath: work.to_string_lossy().to_string(),
    includeContents: Some(true),
    maxBytes: Some(1024*1024),
  }).expect("diff workspace unborn");

  // Expect a diff against remote default: a.txt should be modified
  if !out.iter().any(|e| e.filePath == "a.txt") {
    eprintln!("entries: {:?}", out.iter().map(|e| format!("{}:{}", e.status, e.filePath)).collect::<Vec<_>>());
  }
  let row = out.iter().find(|e| e.filePath == "a.txt").expect("has a.txt");
  assert_eq!(row.status, "modified");
  assert_eq!(row.contentOmitted, Some(false));
  assert!(row.oldContent.as_deref() == Some("one\n"));
  assert!(row.newContent.as_deref() == Some("one\ntwo\n"));
  assert!(row.additions >= 1);
}

#[test]
fn refs_diff_basic_on_local_repo() {
  let tmp = tempdir().unwrap();
  let work = tmp.path().join("repo");
  std::fs::create_dir_all(&work).unwrap();
  run(&work, "git init");
  run(&work, "git -c user.email=a@b -c user.name=test checkout -b main");
  std::fs::write(work.join("a.txt"), b"a1\n").unwrap();
  run(&work, "git add .");
  run(&work, "git -c user.email=a@b -c user.name=test commit -m init");
  run(&work, "git checkout -b feature");
  std::fs::write(work.join("b.txt"), b"b\n").unwrap();
  run(&work, "git add .");
  run(&work, "git -c user.email=a@b -c user.name=test commit -m change");

  let out = crate::diff::refs::diff_refs(GitDiffOptions{
    baseRef: Some("main".into()),
    headRef: "feature".into(),
    repoFullName: None,
    repoUrl: None,
    teamSlugOrId: None,
    originPathOverride: Some(work.to_string_lossy().to_string()),
    includeContents: Some(true),
    maxBytes: Some(1024*1024),
  }).unwrap();

  assert!(out.iter().any(|e| e.filePath == "b.txt"));
}

#[test]
fn refs_merge_base_after_merge_is_branch_tip() {
  let tmp = tempdir().unwrap();
  let work = tmp.path().join("repo");
  fs::create_dir_all(&work).unwrap();

  run(&work, "git init");
  run(&work, "git -c user.email=a@b -c user.name=test checkout -b main");
  std::fs::write(work.join("file.txt"), b"base\n").unwrap();
  run(&work, "git add .");
  run(&work, "git -c user.email=a@b -c user.name=test commit -m base");

  run(&work, "git checkout -b feature");
  std::fs::write(work.join("feat.txt"), b"feat\n").unwrap();
  run(&work, "git add .");
  run(&work, "git -c user.email=a@b -c user.name=test commit -m feature-change");

  run(&work, "git checkout main");
  run(&work, "git -c user.email=a@b -c user.name=test merge --no-ff feature -m merge-feature");

  std::fs::write(work.join("main.txt"), b"main\n").unwrap();
  run(&work, "git add .");
  run(&work, "git -c user.email=a@b -c user.name=test commit -m main-after-merge");

  let out = crate::diff::refs::diff_refs(GitDiffOptions{
    baseRef: Some("main".into()),
    headRef: "feature".into(),
    repoFullName: None,
    repoUrl: None,
    teamSlugOrId: None,
    originPathOverride: Some(work.to_string_lossy().to_string()),
    includeContents: Some(true),
    maxBytes: Some(1024*1024),
  }).unwrap();
  assert_eq!(out.len(), 0, "Expected no differences after merge, got: {:?}", out);
}

#[test]
fn refs_diff_numstat_matches_known_pairs() {
  // Ensure we run against the repo root so refs are available
  let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  let repo_root = find_git_root(manifest_dir);
  // Proactively fetch to make sure remote-only commits are present locally
  run(&repo_root, "git fetch --all --tags --prune");

  let cases = vec![
    ("63f3bf66676b5bc7d495f6aaacabe75895ff2045", "0ae5f5b2098b4d7c5f3185943251fba8ee791575", 6, 30),
    ("7a985028c3ecc57f110d91191a4d000c39f0a63e", "5f7d671ca484360df34e363511a0dd60ebe25c79", 294, 255),
    ("4a886e5e769857b9af000224a33460f96fa66545", "08db1fe57536b2832a75b8eff5c1955e735157e6", 512, 232),
    ("2f5f387feee44af6d540da544a0501678dcc2538", "2b292770f68d8c097420bd70fd446ca22a88ec62", 3, 3),
  ];

  for (from, to, exp_adds, exp_dels) in cases {
    let out = crate::diff::refs::diff_refs(GitDiffOptions{
      baseRef: Some(from.into()),
      headRef: to.into(),
      repoFullName: None,
      repoUrl: None,
      teamSlugOrId: None,
      originPathOverride: Some(repo_root.to_string_lossy().to_string()),
      includeContents: Some(true),
      maxBytes: Some(10*1024*1024),
    }).expect("diff refs");
    let adds: i32 = out.iter().map(|e| e.additions).sum();
    let dels: i32 = out.iter().map(|e| e.deletions).sum();
    assert_eq!((adds, dels), (exp_adds, exp_dels), "mismatch for {}..{} entries={}", from, to, out.len());
  }
}

#[test]
fn refs_diff_handles_binary_files() {
  let tmp = tempdir().unwrap();
  let work = tmp.path().join("repo");
  std::fs::create_dir_all(&work).unwrap();
  run(&work, "git init");
  run(&work, "git -c user.email=a@b -c user.name=test checkout -b main");

  // Commit an initial binary file with NUL bytes
  let bin1: Vec<u8> = vec![0, 159, 146, 150, 0, 1, 2, 3, 4, 5];
  std::fs::write(work.join("bin.dat"), &bin1).unwrap();
  run(&work, "git add .");
  run(&work, "git -c user.email=a@b -c user.name=test commit -m init");
  let c1 = String::from_utf8(Command::new(if cfg!(target_os = "windows") {"cmd"} else {"sh"})
    .arg(if cfg!(target_os = "windows") {"/C"} else {"-c"})
    .arg("git rev-parse HEAD")
    .current_dir(&work)
    .output().unwrap().stdout).unwrap();
  let c1 = c1.trim().to_string();

  // Modify the binary file
  let mut bin2 = bin1.clone();
  bin2.extend_from_slice(&[6,7,8,9,0]);
  std::fs::write(work.join("bin.dat"), &bin2).unwrap();
  run(&work, "git add .");
  run(&work, "git -c user.email=a@b -c user.name=test commit -m update");
  let c2 = String::from_utf8(Command::new(if cfg!(target_os = "windows") {"cmd"} else {"sh"})
    .arg(if cfg!(target_os = "windows") {"/C"} else {"-c"})
    .arg("git rev-parse HEAD")
    .current_dir(&work)
    .output().unwrap().stdout).unwrap();
  let c2 = c2.trim().to_string();

  let out = crate::diff::refs::diff_refs(GitDiffOptions{
    baseRef: Some(c1.clone()),
    headRef: c2.clone(),
    repoFullName: None,
    repoUrl: None,
    teamSlugOrId: None,
    originPathOverride: Some(work.to_string_lossy().to_string()),
    includeContents: Some(true),
    maxBytes: Some(1024*1024),
  }).expect("diff refs binary");

  let bin_entry = out.iter().find(|e| e.filePath == "bin.dat").expect("binary entry");
  assert!(bin_entry.isBinary, "binary file should be detected");
  assert_eq!(bin_entry.additions, 0);
  assert_eq!(bin_entry.deletions, 0);
}

#[test]
fn fuzz_merge_commit_inference_matches_github() {
  let truth = ground_truth();
  for prs in truth.repos.values() {
    for pr in prs {
      let cached = compute_diff_for_pr(pr);
      if let Some(merge_sha) = &pr.merge_commit_sha {
        let parent = first_parent_sha(&cached.debug.repo_path, merge_sha)
          .unwrap_or_else(|| panic!("failed to resolve parent for merge commit {} in {}#{}", merge_sha, pr.repo, pr.number));
        assert_eq!(
          cached.debug.compare_base_oid,
          parent,
          "merge-base mismatch for {}#{} (mergeCommitSha={merge_sha})",
          pr.repo,
          pr.number,
        );
      }
    }
  }
}

#[test]
fn fuzz_diff_stats_match_github_ground_truth() {
  let truth = ground_truth();
  for prs in truth.repos.values() {
    for pr in prs {
      let cached = compute_diff_for_pr(pr);
      assert_eq!(
        cached.additions,
        pr.additions,
        "additions mismatch for {}#{}",
        pr.repo,
        pr.number,
      );
      assert_eq!(
        cached.deletions,
        pr.deletions,
        "deletions mismatch for {}#{}",
        pr.repo,
        pr.number,
      );
      assert_eq!(
        cached.changed_files as i64,
        pr.changed_files,
        "changed files mismatch for {}#{}",
        pr.repo,
        pr.number,
      );
    }
  }
}
