use anyhow::Result;
use gix::bstr::ByteSlice;
use std::collections::HashMap;
use std::time::{Duration, Instant};

use crate::{
  repo::cache::{ensure_repo, resolve_repo_url},
  types::{DiffEntry, GitDiffRefsOptions},
};
use gix::{Repository, hash::ObjectId};
use similar::TextDiff;

fn oid_from_rev_parse(repo: &Repository, rev: &str) -> anyhow::Result<ObjectId> {
  // Try to resolve via reference paths first
  if let Ok(oid) = ObjectId::from_hex(rev.as_bytes()) { return Ok(oid); }
  let candidates = [
    rev.to_string(),
    format!("refs/remotes/origin/{}", rev),
    format!("refs/heads/{}", rev),
    format!("refs/tags/{}", rev),
  ];
  for cand in candidates {
    if let Ok(r) = repo.find_reference(&cand) {
      if let Some(id) = r.target().try_id() { return Ok(id.to_owned()); }
    }
  }
  // Try revision parser
  if let Ok(spec) = repo.rev_parse_single(rev) {
    if let Ok(obj) = spec.object() { return Ok(obj.id); }
  }
  Err(anyhow::anyhow!("could not resolve rev '{}'", rev))
}

// Fast merge-base resolution via `git merge-base` with BFS fallback
// Use the new merge_base module

fn is_binary(data: &[u8]) -> bool {
  data.iter().any(|&b| b == 0) || std::str::from_utf8(data).is_err()
}

fn collect_tree_blobs(repo: &Repository, tree_id: ObjectId, prefix: &str, out: &mut HashMap<String, ObjectId>) -> anyhow::Result<()> {
  let obj = repo.find_object(tree_id)?;
  let tree = obj.try_into_tree()?;
  for entry_res in tree.iter() {
    let entry = entry_res?;
    let name = entry.filename().to_str_lossy().into_owned();
    let full = if prefix.is_empty() { name.clone() } else { format!("{}/{}", prefix, name) };
    let mode = entry.mode();
    if mode.is_tree() {
      let id = entry.oid().to_owned();
      collect_tree_blobs(repo, id, &full, out)?;
    } else {
      let id = entry.oid().to_owned();
      out.insert(full, id);
    }
  }
  Ok(())
}

pub fn diff_refs(opts: GitDiffRefsOptions) -> Result<Vec<DiffEntry>> {
  let include = opts.includeContents.unwrap_or(true);
  let max_bytes = opts.maxBytes.unwrap_or(950*1024) as usize;
  let t_total = Instant::now();

  let t_repo_path = Instant::now();
  let repo_path = if let Some(p) = &opts.originPathOverride { std::path::PathBuf::from(p) } else {
    let url = resolve_repo_url(opts.repoFullName.as_deref(), opts.repoUrl.as_deref())?;
    ensure_repo(&url)?
  };
  let d_repo_path = t_repo_path.elapsed();
  let cwd = repo_path.to_string_lossy().to_string();

  // Resolve refs to OIDs using gitoxide only
  // SWR fetch: if originPathOverride provided, do SWR(5s); else ensure_repo handled fetch.
  let d_fetch = if opts.originPathOverride.is_some() {
    let t_fetch = Instant::now();
    let _ = crate::repo::cache::swr_fetch_origin_all_path(std::path::Path::new(&cwd), 5_000);
    t_fetch.elapsed()
  } else { Duration::from_millis(0) };

  let t_open = Instant::now();
  let repo = gix::open(&cwd)?;
  let d_open = t_open.elapsed();
  // If either ref can't be resolved, treat as no diff
  let t_r1 = Instant::now();
  let r1_oid = match oid_from_rev_parse(&repo, &opts.ref1) {
    Ok(oid) => oid,
    Err(_) => {
      let d_r1 = t_r1.elapsed();
      #[cfg(debug_assertions)]
      println!(
        "[cmux_native_git] git_diff_refs timings: total={}ms resolve_r1={}ms (failed to resolve); cwd={}",
        t_total.elapsed().as_millis(),
        d_r1.as_millis(),
        cwd,
      );
      return Ok(Vec::new());
    },
  };
  let d_r1 = t_r1.elapsed();
  let t_r2 = Instant::now();
  let r2_oid = match oid_from_rev_parse(&repo, &opts.ref2) {
    Ok(oid) => oid,
    Err(_) => {
      let d_r2 = t_r2.elapsed();
      #[cfg(debug_assertions)]
      println!(
        "[cmux_native_git] git_diff_refs timings: total={}ms resolve_r1={}ms resolve_r2={}ms (failed to resolve); cwd={}",
        t_total.elapsed().as_millis(),
        d_r1.as_millis(),
        d_r2.as_millis(),
        cwd,
      );
      return Ok(Vec::new());
    }
  };
  let d_r2 = t_r2.elapsed();
  let t_merge_base = Instant::now();
  let base_oid = crate::merge_base::merge_base(&cwd, &repo, r1_oid, r2_oid, crate::merge_base::MergeBaseStrategy::Git)
    .unwrap_or(r1_oid);
  let d_merge_base = t_merge_base.elapsed();

  // Build tree maps of path -> blob id
  let t_tree_ids = Instant::now();
  let base_commit = repo.find_object(base_oid)?.try_into_commit()?;
  let base_tree_id = base_commit.tree_id()?.detach();
  let head_commit = repo.find_object(r2_oid)?.try_into_commit()?;
  let head_tree_id = head_commit.tree_id()?.detach();
  let d_tree_ids = t_tree_ids.elapsed();

  let mut base_map: HashMap<String, ObjectId> = HashMap::new();
  let mut head_map: HashMap<String, ObjectId> = HashMap::new();
  let t_collect_base = Instant::now();
  collect_tree_blobs(&repo, base_tree_id, "", &mut base_map)?;
  let d_collect_base = t_collect_base.elapsed();
  let t_collect_head = Instant::now();
  collect_tree_blobs(&repo, head_tree_id, "", &mut head_map)?;
  let d_collect_head = t_collect_head.elapsed();

  let mut out: Vec<DiffEntry> = Vec::new();
  let mut num_added: usize = 0;
  let mut num_modified: usize = 0;
  let mut num_deleted: usize = 0;
  let mut num_binary: usize = 0;
  let mut total_scanned_bytes: usize = 0;
  let mut blob_read_ns: u128 = 0;
  let mut textdiff_ns: u128 = 0;
  let mut textdiff_count: usize = 0;
  let mut max_diff_ns: u128 = 0;
  let mut max_diff_path: Option<String> = None;

  // Additions and modifications
  let t_loop_add_mod = Instant::now();
  for (path, new_id) in &head_map {
    match base_map.get(path) {
      None => {
        let t_bl = Instant::now();
        let new_blob = repo.find_object(*new_id)?.try_into_blob()?;
        let new_data = &new_blob.data;
        blob_read_ns += t_bl.elapsed().as_nanos();
        let bin = is_binary(new_data);
        let mut e = DiffEntry{ filePath: path.clone(), status: "added".into(), additions: 0, deletions: 0, isBinary: bin, ..Default::default() };
        if include && !bin {
          let new_str = String::from_utf8_lossy(new_data).into_owned();
          let new_sz = new_str.as_bytes().len();
          e.newSize = Some(new_sz as i32);
          e.oldSize = Some(0);
          if new_sz <= max_bytes {
            e.oldContent = Some(String::new());
            e.newContent = Some(new_str.clone());
            e.contentOmitted = Some(false);
            e.additions = new_str.lines().count() as i32;
            total_scanned_bytes += new_sz;
          } else { e.contentOmitted = Some(true); }
        } else { e.contentOmitted = Some(false); }
        out.push(e);
        num_added += 1;
        if bin { num_binary += 1; }
      }
      Some(old_id) => {
        if old_id == new_id { continue; }
        let t_bl1 = Instant::now();
        let old_blob = repo.find_object(*old_id)?.try_into_blob()?;
        let new_blob = repo.find_object(*new_id)?.try_into_blob()?;
        blob_read_ns += t_bl1.elapsed().as_nanos();
        let old_data = &old_blob.data;
        let new_data = &new_blob.data;
        let bin = is_binary(old_data) || is_binary(new_data);
        let mut e = DiffEntry{ filePath: path.clone(), status: "modified".into(), additions: 0, deletions: 0, isBinary: bin, ..Default::default() };
        if include && !bin {
          let old_str = String::from_utf8_lossy(old_data).into_owned();
          let new_str = String::from_utf8_lossy(new_data).into_owned();
          let old_sz = old_str.as_bytes().len();
          let new_sz = new_str.as_bytes().len();
          e.oldSize = Some(old_sz as i32);
          e.newSize = Some(new_sz as i32);
          if old_sz + new_sz <= max_bytes {
            let t_diff = Instant::now();
            let diff = TextDiff::from_lines(&old_str, &new_str);
            let mut adds = 0i32; let mut dels = 0i32;
            for op in diff.ops() {
              let tag = op.tag();
              for change in diff.iter_changes(op) {
                match (tag, change.tag()) {
                  (similar::DiffTag::Insert, _) => adds += 1,
                  (similar::DiffTag::Delete, _) => dels += 1,
                  _ => {}
                }
              }
            }
            let d_diff = t_diff.elapsed().as_nanos();
            textdiff_ns += d_diff;
            textdiff_count += 1;
            total_scanned_bytes += old_sz + new_sz;
            if d_diff > max_diff_ns { max_diff_ns = d_diff; max_diff_path = Some(path.clone()); }
            e.additions = adds; e.deletions = dels;
            e.oldContent = Some(old_str);
            e.newContent = Some(new_str);
            e.contentOmitted = Some(false);
          } else { e.contentOmitted = Some(true); }
        } else { e.contentOmitted = Some(false); }
        if include && e.status == "modified" && !e.isBinary && e.additions == 0 && e.deletions == 0 { continue; }
        out.push(e);
        num_modified += 1;
        if bin { num_binary += 1; }
      }
    }
  }
  let d_loop_add_mod = t_loop_add_mod.elapsed();

  // Deletions
  let t_loop_del = Instant::now();
  for (path, old_id) in &base_map {
    if head_map.contains_key(path) { continue; }
    let t_bl = Instant::now();
    let old_blob = repo.find_object(*old_id)?.try_into_blob()?;
    let old_data = &old_blob.data;
    blob_read_ns += t_bl.elapsed().as_nanos();
    let bin = is_binary(old_data);
    let mut e = DiffEntry{ filePath: path.clone(), status: "deleted".into(), additions: 0, deletions: 0, isBinary: bin, ..Default::default() };
    if include && !bin {
      let old_str = String::from_utf8_lossy(old_data).into_owned();
      let old_sz = old_str.as_bytes().len();
      e.oldSize = Some(old_sz as i32);
      if old_sz <= max_bytes {
        e.oldContent = Some(old_str);
        e.newContent = Some(String::new());
        e.contentOmitted = Some(false);
        e.deletions = e.oldContent.as_ref().unwrap().lines().count() as i32;
        total_scanned_bytes += old_sz;
      } else { e.contentOmitted = Some(true); }
    } else { e.contentOmitted = Some(false); }
    out.push(e);
    num_deleted += 1;
    if bin { num_binary += 1; }
  }
  let d_loop_del = t_loop_del.elapsed();

  let d_total = t_total.elapsed();
  #[cfg(debug_assertions)]
  println!(
    "[cmux_native_git] git_diff_refs timings: total={}ms repo_path={}ms fetch={}ms open_repo={}ms resolve_r1={}ms resolve_r2={}ms merge_base={}ms tree_ids={}ms collect_base={}ms collect_head={}ms add_mod_loop={}ms del_loop={}ms blob_read={}ms textdiff={}ms textdiff_count={} scanned_bytes={} files: +{} ~{} -{} (binary={}) max_textdiff={{path: {:?}, ms: {}}} cwd={}",
    d_total.as_millis(),
    d_repo_path.as_millis(),
    d_fetch.as_millis(),
    d_open.as_millis(),
    d_r1.as_millis(),
    d_r2.as_millis(),
    d_merge_base.as_millis(),
    d_tree_ids.as_millis(),
    d_collect_base.as_millis(),
    d_collect_head.as_millis(),
    d_loop_add_mod.as_millis(),
    d_loop_del.as_millis(),
    (blob_read_ns as f64 / 1_000_000.0) as i64,
    (textdiff_ns as f64 / 1_000_000.0) as i64,
    textdiff_count,
    total_scanned_bytes,
    num_added,
    num_modified,
    num_deleted,
    num_binary,
    max_diff_path,
    (max_diff_ns as f64 / 1_000_000.0) as i64,
    cwd,
  );

  Ok(out)
}
