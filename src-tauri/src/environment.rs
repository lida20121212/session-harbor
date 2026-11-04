use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
pub struct Detection {
    pub status: &'static str,
    pub detail: &'static str,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentReport {
    pub platform: &'static str,
    pub desktop: Detection,
    pub cli: Detection,
    pub checked_at: String,
}

fn inspect_paths(paths: &[PathBuf]) -> Detection {
    if paths.is_empty() {
        return Detection {
            status: "unknown",
            detail: "无法确定标准安装位置。",
        };
    }
    let mut inaccessible = false;
    for path in paths {
        match std::fs::metadata(path) {
            Ok(meta) if meta.is_file() || meta.is_dir() => {
                return Detection {
                    status: "detected",
                    detail: "在标准位置发现候选安装。版本、账号身份和可用状态尚未核验。",
                }
            }
            Ok(_) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(_) => inaccessible = true,
        }
    }
    if inaccessible {
        Detection {
            status: "unknown",
            detail: "无法检查某个标准安装位置。",
        }
    } else {
        Detection {
            status: "not_detected",
            detail: "在已检查的标准位置未发现安装，其他位置仍可能存在安装。",
        }
    }
}

#[cfg(target_os = "windows")]
fn inspect_windows_packages() -> Detection {
    let Some(program_files) = std::env::var_os("ProgramFiles") else {
        return Detection {
            status: "unknown",
            detail: "无法确定应用包安装位置。",
        };
    };
    let entries = match std::fs::read_dir(PathBuf::from(program_files).join("WindowsApps")) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return Detection {
                status: "not_detected",
                detail: "未找到应用包安装位置。",
            }
        }
        Err(_) => {
            return Detection {
                status: "unknown",
                detail: "无法检查应用包，安装状态仍未核验。",
            }
        }
    };
    for (index, entry) in entries.enumerate() {
        if index >= 128 {
            return Detection {
                status: "unknown",
                detail: "已达到应用包检查数量上限，安装状态仍未核验。",
            };
        }
        let Ok(entry) = entry else {
            return Detection {
                status: "unknown",
                detail: "无法检查某个应用包条目。",
            };
        };
        let name = entry.file_name().to_string_lossy().to_lowercase();
        if (name.starts_with("claude_")
            || name.starts_with("anthropic.claude_")
            || name.starts_with("claude.claude_"))
            && entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false)
        {
            return Detection {
                status: "detected",
                detail: "发现 Claude 候选应用包。版本、账号身份和可用状态尚未核验。",
            };
        }
    }
    Detection {
        status: "not_detected",
        detail: "在限定范围内未发现已知的 Claude 候选应用包。",
    }
}

pub fn inspect_environment() -> EnvironmentReport {
    let mut desktop_paths = Vec::new();
    let mut cli_paths = Vec::new();
    #[cfg(target_os = "windows")]
    {
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            desktop_paths.push(PathBuf::from(&local).join("Programs/Claude/Claude.exe"));
            let packages = PathBuf::from(local).join("Microsoft/WindowsApps");
            desktop_paths.push(packages.join("Claude.exe"));
        }
        if let Some(home) = std::env::var_os("USERPROFILE") {
            cli_paths.push(PathBuf::from(home).join(".local/bin/claude.exe"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        desktop_paths.push(PathBuf::from("/Applications/Claude.app"));
        if let Some(home) = std::env::var_os("HOME") {
            desktop_paths.push(PathBuf::from(&home).join("Applications/Claude.app"));
            cli_paths.push(PathBuf::from(home).join(".local/bin/claude"));
        }
        cli_paths.push(PathBuf::from("/usr/local/bin/claude"));
        cli_paths.push(PathBuf::from("/opt/homebrew/bin/claude"));
    }
    let supported = cfg!(any(target_os = "windows", target_os = "macos"));
    let desktop = inspect_paths(&desktop_paths);
    #[cfg(target_os = "windows")]
    let desktop = if desktop.status == "detected" {
        desktop
    } else {
        let package = inspect_windows_packages();
        if package.status == "not_detected" {
            desktop
        } else {
            package
        }
    };
    EnvironmentReport {
        platform: std::env::consts::OS,
        desktop: if supported {
            desktop
        } else {
            Detection {
                status: "unsupported",
                detail: "当前平台不支持安装检测。",
            }
        },
        cli: if supported {
            inspect_paths(&cli_paths)
        } else {
            Detection {
                status: "unsupported",
                detail: "当前平台不支持安装检测。",
            }
        },
        checked_at: super::store::now(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn discovery_is_honest_and_redacted() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(inspect_paths(&[]).status, "unknown");
        assert_eq!(
            inspect_paths(&[dir.path().join("missing")]).status,
            "not_detected"
        );
        let file = dir.path().join("candidate");
        std::fs::write(&file, b"not executed").unwrap();
        let found = inspect_paths(&[file]);
        assert_eq!(found.status, "detected");
        assert!(!found
            .detail
            .contains(&dir.path().to_string_lossy().to_string()));
    }
}
