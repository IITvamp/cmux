#![deny(clippy::all)]

mod types;
mod util;
mod repo;
mod diff;
mod merge_base;

use napi::bindgen_prelude::*;
use napi_derive::napi;
use types::{DiffEntry, GitDiffRefsOptions, GitDiffWorkspaceOptions};

#[napi]
pub async fn get_time() -> String {
  use std::time::{SystemTime, UNIX_EPOCH};
  #[cfg(debug_assertions)]
  println!("[cmux_native_time] get_time invoked");
  let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
  now.as_millis().to_string()
}

#[napi]
pub async fn git_diff_workspace(opts: GitDiffWorkspaceOptions) -> Result<Vec<DiffEntry>> {
  #[cfg(debug_assertions)]
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
  #[cfg(debug_assertions)]
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
mod tests;
