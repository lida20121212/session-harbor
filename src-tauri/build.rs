fn main() {
    #[cfg(feature = "desktop")]
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "get_dashboard",
            "save_account",
            "delete_account",
            "inspect_environment",
            "prepare_handoff",
            "cancel_handoff",
        ]),
    ))
    .expect("failed to build desktop permissions");
}
