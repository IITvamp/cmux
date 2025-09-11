use anyhow::Result;
use gix::bstr::ByteSlice;
use std::collections::HashMap;

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

fn merge_base_oid(repo: &Repository, a: ObjectId, b: ObjectId) -> anyhow::Result<ObjectId> {
  use std::collections::{HashMap, VecDeque};
  let mut dist_a: HashMap<ObjectId, usize> = HashMap::new();
  let mut qa: VecDeque<(ObjectId, usize)> = VecDeque::new();
  qa.push_back((a, 0));
  while let Some((id, d)) = qa.pop_front() {
    if dist_a.contains_key(&id) { continue; }
    dist_a.insert(id, d);
    let obj = repo.find_object(id)?;
    let commit = obj.try_into_commit()?;
    for parent in commit.parent_ids() { qa.push_back((parent.detach(), d + 1)); }
  }

  let mut best: Option<(ObjectId, usize)> = None; // (id, cost)
  let mut qb: VecDeque<(ObjectId, usize)> = VecDeque::new();
  let mut seen_b: HashMap<ObjectId, usize> = HashMap::new();
  qb.push_back((b, 0));
  while let Some((id, d)) = qb.pop_front() {
    if seen_b.contains_key(&id) { continue; }
    seen_b.insert(id, d);
    if let Some(da) = dist_a.get(&id) {
      let cost = *da + d;
      match best {
        None => best = Some((id, cost)),
        Some((_, c)) if cost < c => best = Some((id, cost)),
        _ => {}
      }
    }
    let obj = repo.find_object(id)?;
    let commit = obj.try_into_commit()?;
    for parent in commit.parent_ids() { qb.push_back((parent.detach(), d + 1)); }
  }
  Ok(best.map(|(id, _)| id).unwrap_or(a))
}

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

  let repo_path = if let Some(p) = &opts.originPathOverride { std::path::PathBuf::from(p) } else {
    let url = resolve_repo_url(opts.repoFullName.as_deref(), opts.repoUrl.as_deref())?;
    ensure_repo(&url)?
  };
  let cwd = repo_path.to_string_lossy().to_string();

  // Resolve refs to OIDs using gitoxide only
  // Always fetch latest from origin to ensure up-to-date refs (best-effort)
  let _ = crate::repo::cache::fetch_origin_all_path(std::path::Path::new(&cwd));
  let repo = gix::open(&cwd)?;
  // If either ref can't be resolved, treat as no diff
  let r1_oid = match oid_from_rev_parse(&repo, &opts.ref1) {
    Ok(oid) => oid,
    Err(_) => return Ok(Vec::new()),
  };
  let r2_oid = match oid_from_rev_parse(&repo, &opts.ref2) {
    Ok(oid) => oid,
    Err(_) => return Ok(Vec::new()),
  };
  let base_oid = merge_base_oid(&repo, r1_oid, r2_oid).unwrap_or(r1_oid);

  // Build tree maps of path -> blob id
  let base_commit = repo.find_object(base_oid)?.try_into_commit()?;
  let base_tree_id = base_commit.tree_id()?.detach();
  let head_commit = repo.find_object(r2_oid)?.try_into_commit()?;
  let head_tree_id = head_commit.tree_id()?.detach();

  let mut base_map: HashMap<String, ObjectId> = HashMap::new();
  let mut head_map: HashMap<String, ObjectId> = HashMap::new();
  collect_tree_blobs(&repo, base_tree_id, "", &mut base_map)?;
  collect_tree_blobs(&repo, head_tree_id, "", &mut head_map)?;

  let mut out: Vec<DiffEntry> = Vec::new();

  // Additions and modifications
  for (path, new_id) in &head_map {
    match base_map.get(path) {
      None => {
        let new_blob = repo.find_object(*new_id)?.try_into_blob()?;
        let new_data = &new_blob.data;
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
          } else { e.contentOmitted = Some(true); }
        } else { e.contentOmitted = Some(false); }
        out.push(e);
      }
      Some(old_id) => {
        if old_id == new_id { continue; }
        let old_blob = repo.find_object(*old_id)?.try_into_blob()?;
        let new_blob = repo.find_object(*new_id)?.try_into_blob()?;
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
            e.additions = adds; e.deletions = dels;
            e.oldContent = Some(old_str);
            e.newContent = Some(new_str);
            e.contentOmitted = Some(false);
          } else { e.contentOmitted = Some(true); }
        } else { e.contentOmitted = Some(false); }
        if include && e.status == "modified" && !e.isBinary && e.additions == 0 && e.deletions == 0 { continue; }
        out.push(e);
      }
    }
  }

  // Deletions
  for (path, old_id) in &base_map {
    if head_map.contains_key(path) { continue; }
    let old_blob = repo.find_object(*old_id)?.try_into_blob()?;
    let old_data = &old_blob.data;
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
      } else { e.contentOmitted = Some(true); }
    } else { e.contentOmitted = Some(false); }
    out.push(e);
  }

  Ok(out)
}
