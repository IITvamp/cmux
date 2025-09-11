use gix::{hash::ObjectId, Repository};
use std::collections::{HashMap, VecDeque};

// Optimized true bidirectional BFS to find a common ancestor minimizing sum of depths.
pub fn merge_base_bfs(repo: &Repository, a: ObjectId, b: ObjectId) -> Option<ObjectId> {
  if a == b { return Some(a); }

  let mut dist_a: HashMap<ObjectId, usize> = HashMap::new();
  let mut dist_b: HashMap<ObjectId, usize> = HashMap::new();
  let mut qa: VecDeque<ObjectId> = VecDeque::new();
  let mut qb: VecDeque<ObjectId> = VecDeque::new();
  qa.push_back(a);
  qb.push_back(b);
  dist_a.insert(a, 0);
  dist_b.insert(b, 0);

  let mut best: Option<(ObjectId, usize)> = None; // (id, cost)

  // Helper to expand one frontier step
  let expand = |from_a: bool,
                    repo: &Repository,
                    qa: &mut VecDeque<ObjectId>,
                    qb: &mut VecDeque<ObjectId>,
                    dist_a: &mut HashMap<ObjectId, usize>,
                    dist_b: &mut HashMap<ObjectId, usize>,
                    best: &mut Option<(ObjectId, usize)>| -> anyhow::Result<bool> {
    let (this_q, this_d, other_d) = if from_a { (qa, dist_a, dist_b) } else { (qb, dist_b, dist_a) };
    if let Some(cur) = this_q.pop_front() {
      let d = *this_d.get(&cur).unwrap();
      // If we already have a best and d is greater than current best/2, we can early stop
      if let Some((_, best_cost)) = best.as_ref() {
        if d > *best_cost { return Ok(false); }
      }
      let obj = repo.find_object(cur)?;
      let commit = obj.try_into_commit()?;
      for p in commit.parent_ids() {
        let pid = p.detach();
        if !this_d.contains_key(&pid) {
          this_d.insert(pid, d + 1);
          this_q.push_back(pid);
          if let Some(od) = other_d.get(&pid) {
            let cost = (d + 1) + *od;
            match best {
              None => *best = Some((pid, cost)),
              Some((_, c)) if cost < *c => *best = Some((pid, cost)),
              _ => {}
            }
          }
        }
      }
      return Ok(true);
    }
    Ok(false)
  };

  // Alternate expanding the smaller frontier for performance.
  loop {
    let next_from_a = qa.len() <= qb.len();
    let progressed = expand(next_from_a, repo, &mut qa, &mut qb, &mut dist_a, &mut dist_b, &mut best)
      .unwrap_or(false)
      || expand(!next_from_a, repo, &mut qa, &mut qb, &mut dist_a, &mut dist_b, &mut best)
        .unwrap_or(false);
    if !progressed { break; }
  }

  best.map(|(id, _)| id).or(Some(a))
}

#[cfg(test)]
mod tests {
  use super::*;
  use tempfile::tempdir;
  use std::{fs, time::Instant};
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
  fn bench_merge_base_bfs_vs_git_local_repo() {
    let tmp = tempdir().unwrap();
    let repo_dir = tmp.path().join("repo");
    fs::create_dir_all(&repo_dir).unwrap();

    run(&repo_dir, "git init");
    run(&repo_dir, "git -c user.email=a@b -c user.name=test checkout -b main");
    fs::write(repo_dir.join("file.txt"), b"0\n").unwrap();
    run(&repo_dir, "git add .");
    run(&repo_dir, "git commit -m c0");
    // Diverge into two branches with N commits each
    let n = 60; // keep tests fast
    run(&repo_dir, "git checkout -b feature");
    for i in 1..=n {
      fs::write(repo_dir.join("file.txt"), format!("f{}\n", i)).unwrap();
      run(&repo_dir, "git add .");
      run(&repo_dir, &format!("git commit -m f{}", i));
    }
    run(&repo_dir, "git checkout main");
    for i in 1..=n {
      fs::write(repo_dir.join("file.txt"), format!("m{}\n", i)).unwrap();
      run(&repo_dir, "git add .");
      run(&repo_dir, &format!("git commit -m m{}", i));
    }

    let repo = gix::open(&repo_dir).unwrap();
    let main_oid = repo.find_reference("refs/heads/main").unwrap().target().try_id().unwrap().to_owned();
    let feat_oid = repo.find_reference("refs/heads/feature").unwrap().target().try_id().unwrap().to_owned();

    // correctness
    let via_git = crate::merge_base::git::merge_base_git(&repo_dir.to_string_lossy(), main_oid, feat_oid).unwrap();
    let via_bfs = merge_base_bfs(&repo, main_oid, feat_oid).unwrap();
    assert_eq!(via_git, via_bfs, "merge-base mismatch");

    // quick micro-benchmark
    let iters = 20;

    let t1 = Instant::now();
    let mut last = None;
    for _ in 0..iters { last = crate::merge_base::git::merge_base_git(&repo_dir.to_string_lossy(), main_oid, feat_oid); }
    let d_git = t1.elapsed();
    assert_eq!(last, Some(via_git));

    let t2 = Instant::now();
    let mut last2 = None;
    for _ in 0..iters { last2 = merge_base_bfs(&repo, main_oid, feat_oid); }
    let d_bfs = t2.elapsed();
    assert_eq!(last2, Some(via_bfs));

    println!(
      "merge_base bench: git={}ms total ({} iters), bfs={}ms total ({} iters)",
      d_git.as_millis(), iters, d_bfs.as_millis(), iters
    );
  }
}
