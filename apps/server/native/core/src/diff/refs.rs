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
use std::collections::BTreeMap;

fn oid_from_rev_parse(repo: &Repository, rev: &str) -> anyhow::Result<ObjectId> {
  // 1) Direct SHA
  if let Ok(oid) = ObjectId::from_hex(rev.as_bytes()) { return Ok(oid); }

  // 2) If caller passed a fully qualified ref (e.g., refs/remotes/origin/HEAD), use it
  if rev.starts_with("refs/") || rev == "HEAD" {
    if let Ok(r) = repo.find_reference(rev) {
      if let Some(id) = r.target().try_id() { return Ok(id.to_owned()); }
    }
  }

  // 3) Prefer remote-tracking ref for bare names (avoid stale local branches)
  //    Also handle inputs like "origin/main" by normalizing to refs/remotes/origin/main
  if let Some(rest) = rev.strip_prefix("origin/") {
    let cand = format!("refs/remotes/origin/{}", rest);
    if let Ok(r) = repo.find_reference(&cand) { if let Some(id) = r.target().try_id() { return Ok(id.to_owned()); } }
  }

  let remote_cand = format!("refs/remotes/origin/{}", rev);
  if let Ok(r) = repo.find_reference(&remote_cand) {
    if let Some(id) = r.target().try_id() { return Ok(id.to_owned()); }
  }

  // 4) Try git-style rev-parse (may resolve tags, HEAD^, origin/main, etc.)
  if let Ok(spec) = repo.rev_parse_single(rev) {
    if let Ok(obj) = spec.object() { return Ok(obj.id); }
  }

  // 5) Fall back to local branch and tag namespaces
  let local_head = format!("refs/heads/{}", rev);
  if let Ok(r) = repo.find_reference(&local_head) {
    if let Some(id) = r.target().try_id() { return Ok(id.to_owned()); }
  }
  let tag = format!("refs/tags/{}", rev);
  if let Ok(r) = repo.find_reference(&tag) {
    if let Some(id) = r.target().try_id() { return Ok(id.to_owned()); }
  }

  Err(anyhow::anyhow!("could not resolve rev '{}'", rev))
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
  let t_total = Instant::now();

  let t_repo_path = Instant::now();
  let repo_path = if let Some(p) = &opts.originPathOverride { std::path::PathBuf::from(p) } else {
    let url = resolve_repo_url(opts.repoFullName.as_deref(), opts.repoUrl.as_deref())?;
    ensure_repo(&url)?
  };
  let _d_repo_path = t_repo_path.elapsed();
  let cwd = repo_path.to_string_lossy().to_string();

  let _d_fetch = if opts.originPathOverride.is_some() {
    let t_fetch = Instant::now();
    let _ = crate::repo::cache::swr_fetch_origin_all_path(
      std::path::Path::new(&cwd),
      crate::repo::cache::fetch_window_ms(),
    );
    t_fetch.elapsed()
  } else { Duration::from_millis(0) };

  let t_open = Instant::now();
  let repo = gix::open(&cwd)?;
  let _d_open = t_open.elapsed();
  let t_r1 = Instant::now();
  let r1_oid = match oid_from_rev_parse(&repo, &opts.ref1) {
    Ok(oid) => oid,
    Err(_) => {
      let _d_r1 = t_r1.elapsed();
      #[cfg(debug_assertions)]
      println!(
        "[cmux_native_git] git_diff_refs timings: total={}ms resolve_r1={}ms (failed to resolve); cwd={}",
        t_total.elapsed().as_millis(),
        _d_r1.as_millis(),
        cwd,
      );
      return Ok(Vec::new());
    },
  };
  let _d_r1 = t_r1.elapsed();
  let t_r2 = Instant::now();
  let r2_oid = match oid_from_rev_parse(&repo, &opts.ref2) {
    Ok(oid) => oid,
    Err(_) => {
      let _d_r2 = t_r2.elapsed();
      #[cfg(debug_assertions)]
      println!(
        "[cmux_native_git] git_diff_refs timings: total={}ms resolve_r1={}ms resolve_r2={}ms (failed to resolve); cwd={}",
        t_total.elapsed().as_millis(),
        _d_r1.as_millis(),
        _d_r2.as_millis(),
        cwd,
      );
      return Ok(Vec::new());
    }
  };
  let _d_r2 = t_r2.elapsed();
  let t_merge_base = Instant::now();
  let base_oid = crate::merge_base::merge_base(&cwd, &repo, r1_oid, r2_oid, crate::merge_base::MergeBaseStrategy::Git)
    .unwrap_or(r1_oid);
  let _d_merge_base = t_merge_base.elapsed();

  let t_tree_ids = Instant::now();
  let base_commit = repo.find_object(base_oid)?.try_into_commit()?;
  let base_tree_id = base_commit.tree_id()?.detach();
  let head_commit = repo.find_object(r2_oid)?.try_into_commit()?;
  let head_tree_id = head_commit.tree_id()?.detach();
  let _d_tree_ids = t_tree_ids.elapsed();

  // Build tree path->blob maps to read content quickly
  let mut base_map: HashMap<String, ObjectId> = HashMap::new();
  let mut head_map: HashMap<String, ObjectId> = HashMap::new();
  let t_collect_base = Instant::now();
  collect_tree_blobs(&repo, base_tree_id, "", &mut base_map)?;
  let _d_collect_base = t_collect_base.elapsed();
  let t_collect_head = Instant::now();
  collect_tree_blobs(&repo, head_tree_id, "", &mut head_map)?;
  let _d_collect_head = t_collect_head.elapsed();

  // Get authoritative change list via git with rename detection and canonical counts via numstat
  let base_spec = base_oid.to_string();
  let head_spec = r2_oid.to_string();
  let name_status = crate::util::run_git(
    &cwd,
    &["diff", "--name-status", "-z", "--find-renames", &format!("{}..{}", base_spec, head_spec)],
  ).unwrap_or_default();

  // Parse NUL-delimited name-status output
  #[derive(Debug)]
  struct Item { status: String, path: String, old_path: Option<String> }
  let mut items: Vec<Item> = Vec::new();
  let mut toks = name_status.split('\0').filter(|s| !s.is_empty());
  while let Some(code) = toks.next() {
    if code.starts_with('R') || code.starts_with('C') {
      let oldp = toks.next().unwrap_or("");
      let newp = toks.next().unwrap_or("");
      if !oldp.is_empty() && !newp.is_empty() {
        items.push(Item{ status: "R".into(), path: newp.to_string(), old_path: Some(oldp.to_string()) });
      }
    } else {
      let p = toks.next().unwrap_or("");
      if !p.is_empty() {
        items.push(Item{ status: code.to_string(), path: p.to_string(), old_path: None });
      }
    }
  }

  // Build numstat map for accurate line counts matching Git
  let numstat_out = crate::util::run_git(
    &cwd,
    &["diff", "--numstat", "--find-renames", &format!("{}..{}", base_spec, head_spec)],
  ).unwrap_or_default();
  let mut num_map: BTreeMap<String, (i32, i32, bool)> = BTreeMap::new();
  for line in numstat_out.lines() {
    if line.trim().is_empty() { continue; }
    // Format: added\tdeleted\tpath
    // Note: path may contain tabs; split only first two
    let mut parts = line.splitn(3, '\t');
    let a = parts.next().unwrap_or("");
    let d = parts.next().unwrap_or("");
    let p = parts.next().unwrap_or("");
    if p.is_empty() { continue; }
    let is_bin = a == "-" || d == "-";
    let adds = if is_bin { 0 } else { a.parse::<i32>().unwrap_or(0) };
    let dels = if is_bin { 0 } else { d.parse::<i32>().unwrap_or(0) };
    num_map.insert(p.to_string(), (adds, dels, is_bin));
  }

  let mut out: Vec<DiffEntry> = Vec::new();
  let mut _num_added: usize = 0;
  let mut _num_modified: usize = 0;
  let mut _num_deleted: usize = 0;
  let mut _num_binary: usize = 0;
  let mut _total_scanned_bytes: usize = 0;
  let mut _blob_read_ns: u128 = 0;
  let mut _textdiff_ns: u128 = 0;
  let mut _textdiff_count: usize = 0;
  let mut _max_diff_ns: u128 = 0;
  let mut _max_diff_path: Option<String> = None;

  let t_loop_add_mod = Instant::now();
  for it in &items {
    match it.status.as_str() {
      "A" => {
        if let Some(new_id) = head_map.get(&it.path) {
          let t_bl = Instant::now();
          let new_blob = repo.find_object(*new_id)?.try_into_blob()?;
          let new_data = &new_blob.data;
          _blob_read_ns += t_bl.elapsed().as_nanos();
          let bin = is_binary(new_data) || num_map.get(&it.path).map(|t| t.2).unwrap_or(false);
          let mut e = DiffEntry{ filePath: it.path.clone(), status: "added".into(), additions: 0, deletions: 0, isBinary: bin, ..Default::default() };
          if let Some((adds, dels, _)) = num_map.get(&it.path) { e.additions = *adds; e.deletions = *dels; }
          if include && !bin {
            let new_str = String::from_utf8_lossy(new_data).into_owned();
            let new_sz = new_str.as_bytes().len();
            e.newSize = Some(new_sz as i32);
            e.oldSize = Some(0);
            if new_sz <= max_bytes { e.oldContent = Some(String::new()); e.newContent = Some(new_str.clone()); e.contentOmitted = Some(false); _total_scanned_bytes += new_sz; } else { e.contentOmitted = Some(true) }
          } else { e.contentOmitted = Some(false) }
          out.push(e); _num_added += 1; if bin { _num_binary += 1; }
        }
      }
      "M" => {
        if let (Some(old_id), Some(new_id)) = (base_map.get(&it.path), head_map.get(&it.path)) {
          if old_id == new_id { continue; }
          let t_bl = Instant::now();
          let old_blob = repo.find_object(*old_id)?.try_into_blob()?;
          let new_blob = repo.find_object(*new_id)?.try_into_blob()?;
          _blob_read_ns += t_bl.elapsed().as_nanos();
          let old_data = &old_blob.data; let new_data = &new_blob.data;
          let bin = is_binary(old_data) || is_binary(new_data) || num_map.get(&it.path).map(|t| t.2).unwrap_or(false);
          let mut e = DiffEntry{ filePath: it.path.clone(), status: "modified".into(), additions: 0, deletions: 0, isBinary: bin, ..Default::default() };
          if let Some((adds, dels, _)) = num_map.get(&it.path) { e.additions = *adds; e.deletions = *dels; }
          if include && !bin {
            let old_str = String::from_utf8_lossy(old_data).into_owned();
            let new_str = String::from_utf8_lossy(new_data).into_owned();
            let old_sz = old_str.as_bytes().len(); let new_sz = new_str.as_bytes().len();
            e.oldSize = Some(old_sz as i32); e.newSize = Some(new_sz as i32);
            if old_sz + new_sz <= max_bytes {
              // We keep TextDiff only to include contents; counts come from numstat
              let t_diff = Instant::now();
              let diff = TextDiff::from_lines(&old_str, &new_str);
              for op in diff.ops() { let _ = op; /* noop, just to measure cost if needed */ }
              let d_diff = t_diff.elapsed().as_nanos();
              _textdiff_ns += d_diff; _textdiff_count += 1; _total_scanned_bytes += old_sz + new_sz;
              if d_diff > _max_diff_ns { _max_diff_ns = d_diff; _max_diff_path = Some(it.path.clone()); }
              e.oldContent = Some(old_str); e.newContent = Some(new_str); e.contentOmitted = Some(false);
            } else { e.contentOmitted = Some(true) }
          } else { e.contentOmitted = Some(false) }
          if include && !e.isBinary && e.additions==0 && e.deletions==0 { continue; }
          out.push(e); _num_modified += 1; if bin { _num_binary += 1; }
        }
      }
      "D" => {
        if let Some(old_id) = base_map.get(&it.path) {
          let t_bl = Instant::now();
          let old_blob = repo.find_object(*old_id)?.try_into_blob()?;
          let old_data = &old_blob.data;
          _blob_read_ns += t_bl.elapsed().as_nanos();
          let bin = is_binary(old_data) || num_map.get(&it.path).map(|t| t.2).unwrap_or(false);
          let mut e = DiffEntry{ filePath: it.path.clone(), status: "deleted".into(), additions: 0, deletions: 0, isBinary: bin, ..Default::default() };
          if let Some((adds, dels, _)) = num_map.get(&it.path) { e.additions = *adds; e.deletions = *dels; }
          if include && !bin {
            let old_str = String::from_utf8_lossy(old_data).into_owned();
            let old_sz = old_str.as_bytes().len(); e.oldSize = Some(old_sz as i32);
            if old_sz <= max_bytes { e.oldContent = Some(old_str); e.newContent = Some(String::new()); e.contentOmitted = Some(false); _total_scanned_bytes += old_sz; } else { e.contentOmitted = Some(true) }
          } else { e.contentOmitted = Some(false) }
          out.push(e); _num_deleted += 1; if bin { _num_binary += 1; }
        }
      }
      // Treat renames: classify as renamed and attach oldPath; counts from numstat (on new path)
      "R" => {
        let newp = &it.path;
        let oldp = it.old_path.as_deref().unwrap_or("");
        let (old_id_opt, new_id_opt) = (base_map.get(newp).or_else(|| base_map.get(oldp)), head_map.get(newp));
        if let Some(new_id) = new_id_opt {
          let t_bl = Instant::now();
          let new_blob = repo.find_object(*new_id)?.try_into_blob()?;
          let new_data = &new_blob.data; _blob_read_ns += t_bl.elapsed().as_nanos();
          let bin = is_binary(new_data) || num_map.get(newp).map(|t| t.2).unwrap_or(false);
          let mut e = DiffEntry{ filePath: newp.clone(), status: "renamed".into(), additions: 0, deletions: 0, isBinary: bin, ..Default::default() };
          e.oldPath = Some(oldp.to_string());
          if let Some((adds, dels, _)) = num_map.get(newp) { e.additions = *adds; e.deletions = *dels; }
          if include && !bin {
            // For small text, include new content; attempt old content if we can resolve old id
            let new_str = String::from_utf8_lossy(new_data).into_owned();
            let mut old_str = String::new();
            let mut old_sz = 0usize;
            if let Some(oid) = old_id_opt { if let Ok(ob) = repo.find_object(*oid)?.try_into_blob() { let s = String::from_utf8_lossy(&ob.data).into_owned(); old_sz = s.as_bytes().len(); old_str = s; } }
            let new_sz = new_str.as_bytes().len();
            e.oldSize = Some(old_sz as i32); e.newSize = Some(new_sz as i32);
            if old_sz + new_sz <= max_bytes { e.oldContent = Some(old_str); e.newContent = Some(new_str); e.contentOmitted = Some(false); _total_scanned_bytes += old_sz + new_sz; } else { e.contentOmitted = Some(true) }
          } else { e.contentOmitted = Some(false) }
          out.push(e);
        }
      }
      _ => {}
    }
  }
  let _d_loop_add_mod = t_loop_add_mod.elapsed();

  // Deleted files already covered via name-status handling above; measure del loop as zero
  let _d_loop_del = Duration::from_millis(0);

  let _d_total = t_total.elapsed();
  #[cfg(debug_assertions)]
  println!(
    "[cmux_native_git] git_diff_refs timings: total={}ms repo_path={}ms fetch={}ms open_repo={}ms resolve_r1={}ms resolve_r2={}ms merge_base={}ms tree_ids={}ms collect_base={}ms collect_head={}ms add_mod_loop={}ms del_loop={}ms blob_read={}ms textdiff={}ms textdiff_count={} scanned_bytes={} files: +{} ~{} -{} (binary={}) max_textdiff={{path: {:?}, ms: {}}} cwd={}",
    _d_total.as_millis(),
    _d_repo_path.as_millis(),
    _d_fetch.as_millis(),
    _d_open.as_millis(),
    _d_r1.as_millis(),
    _d_r2.as_millis(),
    _d_merge_base.as_millis(),
    _d_tree_ids.as_millis(),
    _d_collect_base.as_millis(),
    _d_collect_head.as_millis(),
    _d_loop_add_mod.as_millis(),
    _d_loop_del.as_millis(),
    (_blob_read_ns as f64 / 1_000_000.0) as i64,
    (_textdiff_ns as f64 / 1_000_000.0) as i64,
    _textdiff_count,
    _total_scanned_bytes,
    _num_added,
    _num_modified,
    _num_deleted,
    _num_binary,
    _max_diff_path,
    (_max_diff_ns as f64 / 1_000_000.0) as i64,
    cwd,
  );

  Ok(out)
}
