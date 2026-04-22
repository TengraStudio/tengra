use crate::tools::ToolDispatchResponse;
/**
 * Tengra - Your Personal AI Assistant
 * Copyright (c) 2026 TengraStudio
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
use git2::{BlameOptions, DiffOptions, Repository, StatusOptions};
use serde_json::{json, Value};
use std::path::Path;

pub async fn handle_action(action: &str, args: Value) -> ToolDispatchResponse {
    match action {
        "status" => status(args).await,
        "diff" => diff(args).await,
        "blame" => blame(args).await,
        "log" => log(args).await,
        "add" => add(args).await,
        "commit" => commit(args).await,
        "push" => push(args).await,
        "pull" => pull(args).await,
        "checkout" => checkout(args).await,
        "branches" => branches(args).await,
        _ => ToolDispatchResponse {
            success: false,
            result: None,
            error: Some(format!("Unknown git action: {}", action)),
        },
    }
}

async fn status(arguments: Value) -> ToolDispatchResponse {
    let path = arguments
        .get("path")
        .or_else(|| arguments.get("cwd"))
        .and_then(|v| v.as_str())
        .unwrap_or(".");
    let repo = match Repository::open(path) {
        Ok(r) => r,
        Err(e) => return error_response(&format!("Failed to open repo: {}", e)),
    };

    let mut opts = StatusOptions::new();
    opts.include_untracked(true);
    let statuses = match repo.statuses(Some(&mut opts)) {
        Ok(s) => s,
        Err(e) => return error_response(&format!("Failed to get status: {}", e)),
    };

    let mut results = Vec::new();
    for entry in statuses.iter() {
        results.push(json!({
            "file": entry.path().unwrap_or(""),
            "status": format!("{:?}", entry.status()),
        }));
    }

    ToolDispatchResponse {
        success: true,
        result: Some(json!(results)),
        error: None,
    }
}

async fn diff(arguments: Value) -> ToolDispatchResponse {
    let path = arguments
        .get("path")
        .or_else(|| arguments.get("cwd"))
        .and_then(|v| v.as_str())
        .unwrap_or(".");
    let file = arguments.get("file").and_then(|v| v.as_str());

    let repo = match Repository::open(path) {
        Ok(r) => r,
        Err(e) => return error_response(&format!("Failed to open repo: {}", e)),
    };

    let mut opts = DiffOptions::new();
    if let Some(f) = file {
        opts.pathspec(f);
    }

    let diff = match repo.diff_index_to_workdir(None, Some(&mut opts)) {
        Ok(d) => d,
        Err(e) => return error_response(&format!("Failed to get diff: {}", e)),
    };

    let mut diff_text = String::new();
    let _ = diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        diff_text.push(line.origin());
        diff_text.push_str(std::str::from_utf8(line.content()).unwrap_or(""));
        true
    });

    ToolDispatchResponse {
        success: true,
        result: Some(json!(diff_text)),
        error: None,
    }
}

async fn blame(arguments: Value) -> ToolDispatchResponse {
    let file = match arguments.get("file").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_response("Missing 'file' argument"),
    };
    let path = arguments
        .get("cwd")
        .or_else(|| arguments.get("repo_path"))
        .and_then(|v| v.as_str())
        .unwrap_or(".");

    let repo = match Repository::open(path) {
        Ok(r) => r,
        Err(e) => return error_response(&format!("Failed to open repo: {}", e)),
    };

    let mut opts = BlameOptions::new();
    let blame = match repo.blame_file(Path::new(file), Some(&mut opts)) {
        Ok(b) => b,
        Err(e) => return error_response(&format!("Failed to get blame: {}", e)),
    };

    let mut results = Vec::new();
    for hunk in blame.iter() {
        results.push(json!({
            "final_commit_id": hunk.final_commit_id().to_string(),
            "final_signature": hunk.final_signature().name().unwrap_or(""),
            "lines": format!("{}-{}", hunk.final_start_line(), hunk.final_start_line() + hunk.lines_in_hunk() - 1),
        }));
    }

    ToolDispatchResponse {
        success: true,
        result: Some(json!(results)),
        error: None,
    }
}

async fn log(args: Value) -> ToolDispatchResponse {
    let path = match args
        .get("cwd")
        .or_else(|| args.get("path"))
        .and_then(|v| v.as_str())
    {
        Some(p) => p,
        None => return error_response("Missing 'cwd' or 'path' argument"),
    };
    let count = args.get("count").and_then(|v| v.as_u64()).unwrap_or(10) as usize;

    match Repository::open(path) {
        Ok(repo) => {
            let mut revwalk = match repo.revwalk() {
                Ok(walk) => walk,
                Err(e) => return error_response(&format!("Failed to create revwalk: {}", e)),
            };
            if let Err(e) = revwalk.push_head() {
                return error_response(&format!("Failed to read repository HEAD: {}", e));
            }

            let mut commits = Vec::new();
            for oid in revwalk.take(count) {
                if let Ok(oid) = oid {
                    if let Ok(commit) = repo.find_commit(oid) {
                        commits.push(json!({
                            "id": oid.to_string(),
                            "message": commit.message().unwrap_or(""),
                            "author": commit.author().name().unwrap_or(""),
                            "time": commit.time().seconds(),
                        }));
                    }
                }
            }

            ToolDispatchResponse {
                success: true,
                result: Some(json!({ "commits": commits })),
                error: None,
            }
        }
        Err(e) => error_response(&format!("Failed to open repository: {}", e)),
    }
}

async fn add(args: Value) -> ToolDispatchResponse {
    let path = match args.get("cwd").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_response("Missing 'cwd' argument"),
    };
    let files = args.get("files").and_then(|v| v.as_str()).unwrap_or(".");

    match Repository::open(path) {
        Ok(repo) => {
            let mut index = match repo.index() {
                Ok(index) => index,
                Err(e) => return error_response(&format!("Failed to open git index: {}", e)),
            };
            if files == "." {
                if let Err(e) = index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None) {
                    return error_response(&format!("Failed to add files: {}", e));
                }
            } else if let Err(e) = index.add_path(Path::new(files)) {
                return error_response(&format!("Failed to add file '{}': {}", files, e));
            }
            if let Err(e) = index.write() {
                return error_response(&format!("Failed to write git index: {}", e));
            }

            ToolDispatchResponse {
                success: true,
                result: Some(json!({ "success": true })),
                error: None,
            }
        }
        Err(e) => error_response(&format!("Failed to open repository: {}", e)),
    }
}

async fn commit(args: Value) -> ToolDispatchResponse {
    let path = match args.get("cwd").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_response("Missing 'cwd' argument"),
    };
    let message = match args.get("message").and_then(|v| v.as_str()) {
        Some(m) => m,
        None => return error_response("Missing 'message' argument"),
    };

    match Repository::open(path) {
        Ok(repo) => {
            let mut index = match repo.index() {
                Ok(index) => index,
                Err(e) => return error_response(&format!("Failed to open git index: {}", e)),
            };
            let oid = match index.write_tree() {
                Ok(oid) => oid,
                Err(e) => return error_response(&format!("Failed to write git tree: {}", e)),
            };
            let tree = match repo.find_tree(oid) {
                Ok(tree) => tree,
                Err(e) => return error_response(&format!("Failed to read git tree: {}", e)),
            };
            let sig = match repo.signature() {
                Ok(sig) => sig,
                Err(e) => return error_response(&format!("Failed to create git signature: {}", e)),
            };
            let parent_commit = match repo.head() {
                Ok(head) => match head.peel_to_commit() {
                    Ok(commit) => Some(commit),
                    Err(e) => return error_response(&format!("Failed to read HEAD commit: {}", e)),
                },
                Err(_) => None,
            };

            let parents = if let Some(ref p) = parent_commit {
                vec![p]
            } else {
                vec![]
            };

            if let Err(e) = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents) {
                return error_response(&format!("Failed to create commit: {}", e));
            }

            ToolDispatchResponse {
                success: true,
                result: Some(json!({ "success": true })),
                error: None,
            }
        }
        Err(e) => error_response(&format!("Failed to create commit: {}", e)),
    }
}

async fn checkout(args: Value) -> ToolDispatchResponse {
    let path = match args.get("cwd").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_response("Missing 'cwd' argument"),
    };
    let branch = match args.get("branch").and_then(|v| v.as_str()) {
        Some(b) => b,
        None => return error_response("Missing 'branch' argument"),
    };

    match Repository::open(path) {
        Ok(repo) => {
            let obj = match repo.revparse_single(branch) {
                Ok(obj) => obj,
                Err(e) => return error_response(&format!("Failed to resolve branch '{}': {}", branch, e)),
            };
            if let Err(e) = repo.checkout_tree(&obj, None) {
                return error_response(&format!("Failed to checkout tree for '{}': {}", branch, e));
            }
            if let Err(e) = repo.set_head(&format!("refs/heads/{}", branch)) {
                return error_response(&format!("Failed to set HEAD to '{}': {}", branch, e));
            }

            ToolDispatchResponse {
                success: true,
                result: Some(json!({ "success": true })),
                error: None,
            }
        }
        Err(e) => error_response(&format!("Failed to checkout: {}", e)),
    }
}

async fn branches(args: Value) -> ToolDispatchResponse {
    let path = match args.get("cwd").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_response("Missing 'cwd' argument"),
    };

    match Repository::open(path) {
        Ok(repo) => {
            let branches_iter = match repo.branches(None) {
                Ok(branches) => branches,
                Err(e) => return error_response(&format!("Failed to list branches: {}", e)),
            };
            let mut branches = Vec::new();
            for branch in branches_iter {
                let (branch, _) = match branch {
                    Ok(branch) => branch,
                    Err(e) => return error_response(&format!("Failed to read branch: {}", e)),
                };
                let name = match branch.name() {
                    Ok(name) => name.unwrap_or("").to_string(),
                    Err(e) => return error_response(&format!("Failed to read branch name: {}", e)),
                };
                branches.push(name);
            }

            ToolDispatchResponse {
                success: true,
                result: Some(json!({ "branches": branches })),
                error: None,
            }
        }
        Err(e) => error_response(&format!("Failed to list branches: {}", e)),
    }
}

async fn push(args: Value) -> ToolDispatchResponse {
    shell_git(args, &["push"]).await
}

async fn pull(args: Value) -> ToolDispatchResponse {
    shell_git(args, &["pull"]).await
}

async fn shell_git(args: Value, git_args: &[&str]) -> ToolDispatchResponse {
    let path = match args.get("cwd").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return error_response("Missing 'cwd' argument"),
    };

    let output = match std::process::Command::new("git")
        .args(git_args)
        .current_dir(path)
        .output()
    {
        Ok(o) => o,
        Err(e) => return error_response(&format!("Failed to execute git: {}", e)),
    };

    if output.status.success() {
        ToolDispatchResponse {
            success: true,
            result: Some(json!({ "output": String::from_utf8_lossy(&output.stdout) })),
            error: None,
        }
    } else {
        error_response(&String::from_utf8_lossy(&output.stderr))
    }
}

fn error_response(msg: &str) -> ToolDispatchResponse {
    ToolDispatchResponse {
        success: false,
        result: None,
        error: Some(msg.into()),
    }
}
