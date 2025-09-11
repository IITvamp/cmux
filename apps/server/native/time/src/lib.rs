#![deny(clippy::all)]

mod types;
mod util;
mod repo;
mod diff;

use napi::bindgen_prelude::*;
use napi_derive::napi;
use types::{DiffEntry, GitDiffRefsOptions, GitDiffWorkspaceOptions};

#[napi]
pub async fn get_time() -> String {
  use std::time::{SystemTime, UNIX_EPOCH};
  println!("[cmux_native_time] get_time invoked");
  let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
  now.as_millis().to_string()
}

#[napi]
pub async fn git_diff_workspace(opts: GitDiffWorkspaceOptions) -> Result<Vec<DiffEntry>> {
  println!(
    "[cmux_native_git] git_diff_workspace worktreePath={} includeContents={:?} maxBytes={:?}",
    opts.worktreePath,
    opts.includeContents,
    opts.maxBytes
  );
  tokio::task::spawn_blocking(move || diff::workspace::diff_workspace(opts))
    .await
    .map_err(|e| Error::from_reason(format!("Join error: {e}")))?
    .map_err(|e| Error::from_reason(format!("{e:#}")))
}

#[napi]
pub async fn git_diff_refs(opts: GitDiffRefsOptions) -> Result<Vec<DiffEntry>> {
  println!(
    "[cmux_native_git] git_diff_refs ref1={} ref2={} originPathOverride={:?} repoUrl={:?} repoFullName={:?} includeContents={:?} maxBytes={:?}",
    opts.ref1,
    opts.ref2,
    opts.originPathOverride,
    opts.repoUrl,
    opts.repoFullName,
    opts.includeContents,
    opts.maxBytes
  );
  tokio::task::spawn_blocking(move || diff::refs::diff_refs(opts))
    .await
    .map_err(|e| Error::from_reason(format!("Join error: {e}")))?
    .map_err(|e| Error::from_reason(format!("{e:#}")))
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::{fs, process::Command};
  use std::sync::{Mutex, OnceLock};
  use tempfile::tempdir;

  static SERIAL: OnceLock<Mutex<()>> = OnceLock::new();
  fn serial_guard() -> std::sync::MutexGuard<'static, ()> {
    SERIAL.get_or_init(|| Mutex::new(())).lock().unwrap()
  }

  fn run(cwd: &std::path::Path, cmd: &str) {
    let status = if cfg!(target_os = "windows") {
      Command::new("cmd").arg("/C").arg(cmd).current_dir(cwd).status()
    } else {
      Command::new("sh").arg("-c").arg(cmd).current_dir(cwd).status()
    }
    .expect("spawn");
    assert!(status.success(), "command failed: {cmd}");
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
    run(&work, "git commit -m init");

    // modify and add untracked
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
  fn refs_diff_basic_on_local_repo() {
    let tmp = tempdir().unwrap();
    let work = tmp.path().join("repo");
    std::fs::create_dir_all(&work).unwrap();
    run(&work, "git init");
    run(&work, "git -c user.email=a@b -c user.name=test checkout -b main");
    std::fs::write(work.join("a.txt"), b"a1\n").unwrap();
    run(&work, "git add .");
    run(&work, "git commit -m init");
    run(&work, "git checkout -b feature");
    std::fs::write(work.join("b.txt"), b"b\n").unwrap();
    run(&work, "git add .");
    run(&work, "git commit -m change");

    let out = crate::diff::refs::diff_refs(GitDiffRefsOptions{
      ref1: "main".into(),
      ref2: "feature".into(),
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

    // Init repo with main and one file
    run(&work, "git init");
    run(&work, "git -c user.email=a@b -c user.name=test checkout -b main");
    std::fs::write(work.join("file.txt"), b"base\n").unwrap();
    run(&work, "git add .");
    run(&work, "git commit -m base");

    // Create feature branch and add a change
    run(&work, "git checkout -b feature");
    std::fs::write(work.join("feat.txt"), b"feat\n").unwrap();
    run(&work, "git add .");
    run(&work, "git commit -m feature-change");

    // Merge feature into main
    run(&work, "git checkout main");
    run(&work, "git merge --no-ff feature -m merge-feature");

    // New commit on main after merge
    std::fs::write(work.join("main.txt"), b"main\n").unwrap();
    run(&work, "git add .");
    run(&work, "git commit -m main-after-merge");

    // Now diff refs: ref1=main, ref2=feature → merge-base should be feature tip; diff should be empty
    let out = crate::diff::refs::diff_refs(GitDiffRefsOptions{
      ref1: "main".into(),
      ref2: "feature".into(),
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
  fn refs_diff_real_repo_cmux_pr_259() {
    let _g = serial_guard();
    // Validates merge-base and diff stats against a real GitHub PR
    // https://github.com/manaflow-ai/cmux/pull/259
    // Branch: cmux/update-readme-to-bold-its-last-line-rpics
    // Expected change: README.md +2 -0
    let out = crate::diff::refs::diff_refs(GitDiffRefsOptions{
      ref1: "main".into(),
      ref2: "cmux/update-readme-to-bold-its-last-line-rpics".into(),
      repoFullName: Some("manaflow-ai/cmux".into()),
      repoUrl: None,
      teamSlugOrId: None,
      originPathOverride: None,
      includeContents: Some(true),
      maxBytes: Some(1024*1024),
    }).expect("diff on real repo");

    // Locate README.md entry and check stats
    let mut readme_add = None;
    let mut readme_del = None;
    for e in &out {
      if e.filePath == "README.md" {
        readme_add = Some(e.additions);
        readme_del = Some(e.deletions);
        break;
      }
    }
    assert!(readme_add.is_some(), "README.md entry not found in diffs: {:?}", out);
    assert_eq!(readme_add.unwrap(), 2, "Expected +2 additions in README.md");
    assert_eq!(readme_del.unwrap_or_default(), 0, "Expected -0 deletions in README.md");
  }

  #[test]
  fn refs_diff_real_repo_cmux_pr_259_totals() {
    let _g = serial_guard();
    let out = crate::diff::refs::diff_refs(GitDiffRefsOptions{
      ref1: "main".into(),
      ref2: "cmux/update-readme-to-bold-its-last-line-rpics".into(),
      repoFullName: Some("manaflow-ai/cmux".into()),
      repoUrl: None,
      teamSlugOrId: None,
      originPathOverride: None,
      includeContents: Some(true),
      maxBytes: Some(1024*1024),
    }).expect("diff on real repo");

    let total_add: i32 = out.iter().map(|e| e.additions).sum();
    let total_del: i32 = out.iter().map(|e| e.deletions).sum();

    println!("total_add={}", total_add);
    println!("total_del={}", total_del);
    println!("out={:?}", out);

    // Expect just README.md with +2/-0
    assert_eq!(total_add, 2, "expected total additions 2, got {}. out={:?}", total_add, out);
    assert_eq!(total_del, 0, "expected total deletions 0, got {}. out={:?}", total_del, out);
    assert_eq!(out.len(), 1, "expected single file changed, got {}. out={:?}", out.len(), out);
    assert_eq!(out[0].filePath, "README.md");
    assert_eq!(out[0].status, "modified");
  }

  #[test]
  fn refs_diff_real_repo_cmux_pr_259_commit_pair() {
    let _g = serial_guard();
    // PR head commit from patch: affb77a6d12ed571f1916f06fa1d6724d01d8014
    let head = "affb77a6d12ed571f1916f06fa1d6724d01d8014";
    // Clone the repo via cache and compute parent commit id using gix
    let repo_path = crate::repo::cache::ensure_repo("https://github.com/manaflow-ai/cmux.git").expect("ensure repo");
    let repo = gix::open(&repo_path).expect("open repo");
    let head_oid = gix::hash::ObjectId::from_hex(head.as_bytes()).expect("hex oid");
    let head_commit = repo.find_object(head_oid).expect("find head").try_into_commit().expect("as commit");
    let mut parents = head_commit.parent_ids();
    let first_parent = parents.next().expect("parent").detach();
    let base = first_parent.to_string();

    let out = crate::diff::refs::diff_refs(GitDiffRefsOptions{
      ref1: base,
      ref2: head.into(),
      repoFullName: Some("manaflow-ai/cmux".into()),
      repoUrl: None,
      teamSlugOrId: None,
      originPathOverride: None,
      includeContents: Some(true),
      maxBytes: Some(1024*1024),
    }).expect("diff on commit pair");

    let total_add: i32 = out.iter().map(|e| e.additions).sum();
    let total_del: i32 = out.iter().map(|e| e.deletions).sum();
    assert_eq!(total_add, 2, "expected total additions 2, got {}. out={:?}", total_add, out);
    assert_eq!(total_del, 0, "expected total deletions 0, got {}. out={:?}", total_del, out);
    assert_eq!(out.len(), 1, "expected single file changed, got {}. out={:?}", out.len(), out);
    assert_eq!(out[0].filePath, "README.md");
    assert_eq!(out[0].status, "modified");
  }

  #[test]
  fn refs_diff_real_repo_stackauth_quick_type_fix_totals() {
    let _g = serial_guard();
    // https://github.com/stack-auth/stack-auth/pull/854 branch quick-type-fix
    // Patch shows: 1 file changed, 1 deletion (-)
    let out = crate::diff::refs::diff_refs(GitDiffRefsOptions{
      ref1: "dev".into(),
      ref2: "quick-type-fix".into(),
      repoFullName: Some("stack-auth/stack-auth".into()),
      repoUrl: None,
      teamSlugOrId: None,
      originPathOverride: None,
      includeContents: Some(true),
      maxBytes: Some(1024*1024),
    }).expect("diff stack-auth quick-type-fix");

    let total_add: i32 = out.iter().map(|e| e.additions).sum();
    let total_del: i32 = out.iter().map(|e| e.deletions).sum();
    assert_eq!(total_add, 0, "expected total additions 0, got {}. out={:?}", total_add, out);
    assert_eq!(total_del, 1, "expected total deletions 1, got {}. out={:?}", total_del, out);
    assert_eq!(out.len(), 1, "expected single file changed, got {}. out={:?}", out.len(), out);
  }

  #[test]
  fn refs_diff_real_repo_stackauth_quick_type_fix_path() {
    let _g = serial_guard();
    let out = crate::diff::refs::diff_refs(GitDiffRefsOptions{
      ref1: "dev".into(),
      ref2: "quick-type-fix".into(),
      repoFullName: Some("stack-auth/stack-auth".into()),
      repoUrl: None,
      teamSlugOrId: None,
      originPathOverride: None,
      includeContents: Some(true),
      maxBytes: Some(1024*1024),
    }).expect("diff stack-auth quick-type-fix");

    let expected_path = "packages/template/src/lib/stack-app/apps/implementations/client-app-impl.ts";
    let ent = out.iter().find(|e| e.filePath == expected_path).unwrap_or_else(|| panic!("Expected path {} not found. out={:?}", expected_path, out));
    assert_eq!(ent.status, "modified");
    assert_eq!(ent.additions, 0);
    assert_eq!(ent.deletions, 1);
  }

  #[test]
  fn refs_diff_nonexistent_branch_returns_empty() {
    // Create a simple local repo with a single branch `main`
    let tmp = tempdir().unwrap();
    let work = tmp.path().join("repo");
    fs::create_dir_all(&work).unwrap();
    run(&work, "git init");
    run(&work, "git -c user.email=a@b -c user.name=test checkout -b main");
    fs::write(work.join("file.txt"), b"hello\n").unwrap();
    run(&work, "git add .");
    run(&work, "git commit -m init");

    // Now diff against a branch name that doesn't exist
    let out = crate::diff::refs::diff_refs(GitDiffRefsOptions{
      ref1: "main".into(),
      ref2: "this-branch-definitely-does-not-exist-123".into(),
      repoFullName: None,
      repoUrl: None,
      teamSlugOrId: None,
      originPathOverride: Some(work.to_string_lossy().to_string()),
      includeContents: Some(true),
      maxBytes: Some(1024*1024),
    }).expect("diff should succeed and be empty for nonexistent branch");

    assert!(out.is_empty(), "Expected empty diff when branch doesn't exist, got: {:?}", out);
  }
}
