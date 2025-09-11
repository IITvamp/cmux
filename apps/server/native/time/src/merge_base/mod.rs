use gix::{hash::ObjectId, Repository};

pub mod git;
pub mod bfs;

#[derive(Copy, Clone, Debug)]
pub enum MergeBaseStrategy {
  Git,
  Bfs,
}

pub fn merge_base(
  repo_path: &str,
  repo: &Repository,
  a: ObjectId,
  b: ObjectId,
  strategy: MergeBaseStrategy,
) -> Option<ObjectId> {
  match strategy {
    // Only use git strategy in production; no BFS fallback
    MergeBaseStrategy::Git => git::merge_base_git(repo_path, a, b),
    MergeBaseStrategy::Bfs => bfs::merge_base_bfs(repo, a, b),
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use tempfile::tempdir;
  use std::fs;
  use std::process::Command;

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
  fn merge_base_correctness_small_repo() {
    let tmp = tempdir().unwrap();
    let repo_dir = tmp.path().join("repo");
    fs::create_dir_all(&repo_dir).unwrap();

    run(&repo_dir, "git init");
    run(&repo_dir, "git -c user.email=a@b -c user.name=test checkout -b main");
    fs::write(repo_dir.join("file.txt"), b"base\n").unwrap();
    run(&repo_dir, "git add .");
    run(&repo_dir, "git commit -m base");
    run(&repo_dir, "git checkout -b feature");
    fs::write(repo_dir.join("file.txt"), b"feat1\n").unwrap();
    run(&repo_dir, "git add .");
    run(&repo_dir, "git commit -m f1");
    run(&repo_dir, "git checkout main");
    fs::write(repo_dir.join("file.txt"), b"main1\n").unwrap();
    run(&repo_dir, "git add .");
    run(&repo_dir, "git commit -m m1");

    // Open repo with gix and get OIDs
    let repo = gix::open(&repo_dir).unwrap();
    let main_oid = repo.find_reference("refs/heads/main").unwrap().target().try_id().unwrap().to_owned();
    let feat_oid = repo.find_reference("refs/heads/feature").unwrap().target().try_id().unwrap().to_owned();
    // Expect merge-base to be the initial commit (base)
    let base_git = git::merge_base_git(&repo_dir.to_string_lossy(), main_oid, feat_oid).expect("git merge-base");
    let base_bfs = bfs::merge_base_bfs(&repo, main_oid, feat_oid).expect("bfs merge-base");
    assert_eq!(base_git, base_bfs);
  }
}
