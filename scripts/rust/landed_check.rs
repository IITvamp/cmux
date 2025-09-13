use std::env;
use std::path::PathBuf;
use std::process::{Command, Stdio};

fn sh(cwd: &str, cmd: &str) -> Result<String, String> {
    let shell = if cfg!(windows) { "cmd" } else { "sh" };
    let args: Vec<&str> = if cfg!(windows) { vec!["/C", cmd] } else { vec!["-c", cmd] };
    let out = Command::new(shell)
        .args(&args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("spawn failed: {}", e))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).into_owned())
    }
}

fn rev(cwd: &str, r: &str) -> Option<String> {
    sh(cwd, &format!("git rev-parse {}", r)).ok().map(|s| s.trim().to_string())
}

fn is_ancestor(cwd: &str, anc: &str, desc: &str) -> bool {
    let shell = if cfg!(windows) { "cmd" } else { "sh" };
    let cmd = if cfg!(windows) {
        format!("git merge-base --is-ancestor {} {}", anc, desc)
    } else {
        format!("git merge-base --is-ancestor {} {}", anc, desc)
    };
    let args: Vec<&str> = if cfg!(windows) { vec!["/C", &cmd] } else { vec!["-c", &cmd] };
    let status = Command::new(shell).args(&args).current_dir(cwd).status();
    status.map(|s| s.success()).unwrap_or(false)
}

fn find_merge(cwd: &str, base_tip: &str, head_tip: &str) -> Option<(String, String)> {
    let list = sh(cwd, &format!("git rev-list --first-parent {} -n 5000", base_tip)).ok()?;
    for c in list.lines() {
        let line = sh(cwd, &format!("git rev-list --parents -n 1 {}", c)).ok()?;
        let mut parts = line.split_whitespace();
        let _m = parts.next()?;
        let p1 = parts.next();
        let p2 = parts.next();
        if let (Some(p1), Some(p2)) = (p1, p2) {
            if is_ancestor(cwd, p2, head_tip) {
                return Some((p1.to_string(), c.to_string()));
            }
        }
    }
    None
}

fn main() {
    let mut args = env::args().skip(1).collect::<Vec<_>>();
    if args.len() < 3 {
        eprintln!("Usage: landed_check <repo_path> <base_ref> <head_ref> [b0_ref]");
        std::process::exit(2);
    }
    let repo = PathBuf::from(&args[0]);
    let repo = repo.canonicalize().unwrap_or(repo);
    let base_ref = &args[1];
    let head_ref = &args[2];
    let b0_ref = args.get(3).map(|s| s.as_str());
    let cwd = repo.to_string_lossy();

    let base_tip = match rev(&cwd, base_ref) { Some(s) => s, None => { eprintln!("failed to resolve base_ref"); return; } };
    let head_tip = match rev(&cwd, head_ref) { Some(s) => s, None => { eprintln!("failed to resolve head_ref"); return; } };
    let mb = sh(&cwd, &format!("git merge-base {} {}", base_tip, head_tip)).ok().unwrap_or_default().trim().to_string();
    println!("MB({}, {}) = {}", base_ref, head_ref, mb);
    if mb == head_tip {
        println!("Latest MB..HEAD has no changes (already merged)");
    } else {
        let ns = sh(&cwd, &format!("git diff -M50% --name-status {} {}", mb, head_tip)).unwrap_or_default();
        let count = ns.lines().filter(|l| !l.trim().is_empty()).count();
        println!("Latest changed files: {}", count);
    }

    // Landed detection
    let (r1, r2) = if let Some(b0) = b0_ref {
        let c1 = sh(&cwd, &format!("git rev-list --ancestry-path --first-parent {} ^{} --reverse | head -n 1", base_tip, b0))
            .ok()
            .and_then(|s| s.lines().next().map(|x| x.to_string()));
        if let Some(c1) = c1 {
            let parents = sh(&cwd, &format!("git rev-list --parents -n 1 {}", c1)).ok().unwrap_or_default();
            let mut parts = parents.split_whitespace();
            let _m = parts.next();
            let p1 = parts.next();
            let p2 = parts.next();
            if p1.is_some() && p2.is_some() {
                (p1.unwrap().to_string(), c1)
            } else if is_ancestor(&cwd, &c1, &head_tip) {
                let block = sh(&cwd, &format!("git rev-list --ancestry-path --first-parent {} ^{}", base_tip, b0)).ok().unwrap_or_default();
                let mut h0 = c1.clone();
                for id in block.lines() {
                    if is_ancestor(&cwd, id, &head_tip) { h0 = id.to_string(); break; }
                }
                (b0.to_string(), h0)
            } else {
                (b0.to_string(), c1)
            }
        } else {
            println!("Could not find C1 after B0");
            return;
        }
    } else {
        if let Some((p1, m)) = find_merge(&cwd, &base_tip, &head_tip) {
            (p1, m)
        } else {
            println!("No integrating merge found on base first-parent");
            return;
        }
    };

    println!("Landed diff ({} -> {}):", r1, r2);
    let ns = sh(&cwd, &format!("git diff -M50% --name-status {} {}", r1, r2)).unwrap_or_default();
    for line in ns.lines() {
        println!("{}", line);
    }
}

