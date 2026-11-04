pub mod environment;
pub mod store;

#[cfg(feature = "desktop")]
mod desktop {
    use super::{
        environment,
        store::{Account, AccountInput, Dashboard, Handoff, Store},
    };
    use std::sync::Mutex;
    use tauri::{Manager, State};
    struct AppState(Mutex<Store>);
    fn locked<'a>(
        state: &'a State<'_, AppState>,
    ) -> Result<std::sync::MutexGuard<'a, Store>, String> {
        state
            .0
            .lock()
            .map_err(|_| "本地数据库不可用，请重新启动应用。".into())
    }
    #[tauri::command]
    fn get_dashboard(state: State<'_, AppState>) -> Result<Dashboard, String> {
        let store = locked(&state)?;
        store.dashboard()
    }
    #[tauri::command]
    fn save_account(state: State<'_, AppState>, input: AccountInput) -> Result<Account, String> {
        let mut store = locked(&state)?;
        store.save_account(input)
    }
    #[tauri::command]
    fn delete_account(state: State<'_, AppState>, id: String) -> Result<(), String> {
        let mut store = locked(&state)?;
        store.delete_account(&id)
    }
    #[tauri::command]
    fn inspect_environment() -> environment::EnvironmentReport {
        environment::inspect_environment()
    }
    #[tauri::command]
    fn prepare_handoff(
        state: State<'_, AppState>,
        target_account_id: String,
    ) -> Result<Handoff, String> {
        let mut store = locked(&state)?;
        store.prepare_handoff(&target_account_id)
    }
    #[tauri::command]
    fn cancel_handoff(state: State<'_, AppState>, id: String) -> Result<(), String> {
        let mut store = locked(&state)?;
        store.cancel_handoff(&id)
    }
    pub fn run() {
        tauri::Builder::default()
            .setup(|app| {
                let directory = app
                    .path()
                    .app_data_dir()
                    .map_err(|_| std::io::Error::other("应用数据位置不可用。"))?;
                std::fs::create_dir_all(&directory)
                    .map_err(|_| std::io::Error::other("无法创建应用数据目录。"))?;
                let store = Store::open(&directory.join("session-harbor.sqlite3"))
                    .map_err(std::io::Error::other)?;
                app.manage(AppState(Mutex::new(store)));
                Ok(())
            })
            .invoke_handler(tauri::generate_handler![
                get_dashboard,
                save_account,
                delete_account,
                inspect_environment,
                prepare_handoff,
                cancel_handoff
            ])
            .run(tauri::generate_context!())
            .expect("Session Harbor 无法启动；本地数据未被替换");
    }
}
#[cfg(feature = "desktop")]
pub use desktop::run;
