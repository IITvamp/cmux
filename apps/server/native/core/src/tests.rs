use super::*;
use std::{fs, process::Command};
use tempfile::tempdir;

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
