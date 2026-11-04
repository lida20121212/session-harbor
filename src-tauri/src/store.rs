use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{path::Path, time::Duration};

pub type Result<T> = std::result::Result<T, String>;
fn db_error(_: rusqlite::Error) -> String {
    "本地数据库操作失败，未替换任何数据。".into()
}
pub fn now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AccountInput {
    pub id: Option<String>,
    pub name: String,
    pub description: String,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub status: &'static str,
    pub source: Option<String>,
    pub observed_at: Option<String>,
    pub remaining_percent: Option<f64>,
    pub reset_at: Option<String>,
}
#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Handoff {
    pub id: String,
    pub target_account_id: String,
    pub target_name: String,
    pub status: String,
    pub reason: String,
    pub created_at: String,
}
#[derive(Debug, Serialize)]
pub struct Dashboard {
    pub accounts: Vec<Account>,
    pub usage: Usage,
    pub handoffs: Vec<Handoff>,
}

pub struct Store {
    conn: Connection,
}
impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let mut conn = Connection::open(path).map_err(db_error)?;
        conn.busy_timeout(Duration::from_secs(5))
            .map_err(db_error)?;
        conn.pragma_update(None, "foreign_keys", "ON")
            .map_err(db_error)?;
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .map_err(db_error)?;
        if version > 1 {
            return Err("数据库版本高于当前应用支持的版本。".into());
        }
        if version == 0 {
            let tx = conn.transaction().map_err(db_error)?;
            tx.execute_batch("CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, description TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
                CREATE TABLE handoffs (id TEXT PRIMARY KEY, target_account_id TEXT NOT NULL, target_name TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('blocked','cancelled')), reason TEXT NOT NULL, created_at TEXT NOT NULL);
                CREATE INDEX handoffs_target ON handoffs(target_account_id, status);
                PRAGMA user_version = 1;").map_err(db_error)?;
            tx.commit().map_err(db_error)?;
        }
        Ok(Self { conn })
    }
    pub fn dashboard(&self) -> Result<Dashboard> {
        let mut stmt = self.conn.prepare("SELECT id,name,description,created_at,updated_at FROM accounts ORDER BY created_at,rowid").map_err(db_error)?;
        let accounts = stmt
            .query_map([], account_row)
            .map_err(db_error)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(db_error)?;
        let mut stmt = self.conn.prepare("SELECT id,target_account_id,target_name,status,reason,created_at FROM handoffs ORDER BY rowid DESC LIMIT 20").map_err(db_error)?;
        let handoffs = stmt
            .query_map([], handoff_row)
            .map_err(db_error)?
            .collect::<rusqlite::Result<Vec<_>>>()
            .map_err(db_error)?;
        Ok(Dashboard {
            accounts,
            handoffs,
            usage: Usage {
                status: "unknown",
                source: None,
                observed_at: None,
                remaining_percent: None,
                reset_at: None,
            },
        })
    }
    pub fn save_account(&mut self, input: AccountInput) -> Result<Account> {
        // Reject controls before trimming, including newlines and tabs.
        if input.name.chars().any(char::is_control)
            || input.description.chars().any(char::is_control)
        {
            return Err("名称和备注不能包含控制字符。".into());
        }
        let name = input.name.trim().to_owned();
        let description = input.description.trim().to_owned();
        if !(1..=40).contains(&name.chars().count()) {
            return Err("名称须包含 1–40 个字符。".into());
        }
        if description.chars().count() > 160 {
            return Err("备注不能超过 160 个字符。".into());
        }
        if let Some(id) = &input.id {
            validate_id(id)?;
        }
        let tx = self.conn.transaction().map_err(db_error)?;
        let existing = match &input.id {
            Some(id) => Some(
                tx.query_row(
                    "SELECT id,name,description,created_at,updated_at FROM accounts WHERE id=?1",
                    [id],
                    account_row,
                )
                .optional()
                .map_err(db_error)?
                .ok_or("账号记录不存在或已被删除。")?,
            ),
            None => None,
        };
        let duplicate: Option<String> = tx
            .query_row(
                "SELECT id FROM accounts WHERE name_key=?1",
                [name.to_lowercase()],
                |r| r.get(0),
            )
            .optional()
            .map_err(db_error)?;
        if duplicate.is_some() && duplicate != input.id {
            return Err("已存在同名账号，请使用其他名称。".into());
        }
        let timestamp = now();
        let result = Account {
            id: input.id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
            name,
            description,
            created_at: existing
                .map(|v| v.created_at)
                .unwrap_or_else(|| timestamp.clone()),
            updated_at: timestamp,
        };
        tx.execute("INSERT INTO accounts(id,name,name_key,description,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_key=excluded.name_key,description=excluded.description,updated_at=excluded.updated_at",
            params![result.id,result.name,result.name.to_lowercase(),result.description,result.created_at,result.updated_at]).map_err(db_error)?;
        tx.commit().map_err(db_error)?;
        Ok(result)
    }
    pub fn delete_account(&mut self, id: &str) -> Result<()> {
        validate_id(id)?;
        let tx = self.conn.transaction().map_err(db_error)?;
        if tx
            .execute("DELETE FROM accounts WHERE id=?1", [id])
            .map_err(db_error)?
            == 0
        {
            return Err("账号记录不存在或已被删除。".into());
        }
        tx.execute("UPDATE handoffs SET status='cancelled',reason='目标账号记录已删除。未对 Desktop 执行任何操作。' WHERE target_account_id=?1 AND status='blocked'", [id]).map_err(db_error)?;
        tx.commit().map_err(db_error)
    }
    pub fn prepare_handoff(&mut self, target: &str) -> Result<Handoff> {
        validate_id(target)?;
        let tx = self.conn.transaction().map_err(db_error)?;
        let name: String = tx
            .query_row("SELECT name FROM accounts WHERE id=?1", [target], |r| {
                r.get(0)
            })
            .optional()
            .map_err(db_error)?
            .ok_or("目标账号记录不存在或已被删除。")?;
        if let Some(pending) = tx.query_row("SELECT id,target_account_id,target_name,status,reason,created_at FROM handoffs WHERE target_account_id=?1 AND status='blocked' ORDER BY rowid DESC LIMIT 1", [target], handoff_row).optional().map_err(db_error)? { return Ok(pending); }
        let result = Handoff { id:uuid::Uuid::new_v4().to_string(),target_account_id:target.into(),target_name:name,status:"blocked".into(),reason:"尚未核验 Desktop 身份、运行中的工具、项目与工作树及原会话接续能力。未执行登录、切换或启动操作。".into(),created_at:now() };
        tx.execute("INSERT INTO handoffs(id,target_account_id,target_name,status,reason,created_at) VALUES(?1,?2,?3,?4,?5,?6)", params![result.id,result.target_account_id,result.target_name,result.status,result.reason,result.created_at]).map_err(db_error)?;
        tx.commit().map_err(db_error)?;
        Ok(result)
    }
    pub fn cancel_handoff(&mut self, id: &str) -> Result<()> {
        validate_id(id)?;
        if self.conn.execute("UPDATE handoffs SET status='cancelled',reason='已在本地取消。未对 Desktop 执行任何操作。' WHERE id=?1 AND status='blocked'", [id]).map_err(db_error)? != 1 { return Err("接续记录不存在或已取消。".into()); }
        Ok(())
    }
}
fn validate_id(id: &str) -> Result<()> {
    uuid::Uuid::parse_str(id)
        .map(|_| ())
        .map_err(|_| "记录标识无效。".into())
}
fn account_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Account> {
    Ok(Account {
        id: r.get(0)?,
        name: r.get(1)?,
        description: r.get(2)?,
        created_at: r.get(3)?,
        updated_at: r.get(4)?,
    })
}
fn handoff_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Handoff> {
    Ok(Handoff {
        id: r.get(0)?,
        target_account_id: r.get(1)?,
        target_name: r.get(2)?,
        status: r.get(3)?,
        reason: r.get(4)?,
        created_at: r.get(5)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn input(name: &str) -> AccountInput {
        AccountInput {
            id: None,
            name: name.into(),
            description: String::new(),
        }
    }
    #[test]
    fn persistence_validation_and_sql_literals() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.sqlite3");
        let mut db = Store::open(&path).unwrap();
        let a = db.save_account(input("  Work  ")).unwrap();
        assert_eq!(a.name, "Work");
        assert!(db.save_account(input("wORK")).is_err());
        let changed = db
            .save_account(AccountInput {
                id: Some(a.id.clone()),
                name: "Personal".into(),
                description: "  local alias only  ".into(),
            })
            .unwrap();
        assert_eq!(changed.created_at, a.created_at);
        assert_eq!(changed.description, "local alias only");
        assert!(db.save_account(input("PERSONAL")).is_err());
        for name in ["", "  ", "bad\nname", &"名".repeat(41)] {
            assert!(db.save_account(input(name)).is_err());
        }
        assert!(db
            .save_account(AccountInput {
                description: "x".repeat(161),
                ..input("other")
            })
            .is_err());
        assert!(db
            .save_account(AccountInput {
                id: Some(uuid::Uuid::new_v4().to_string()),
                ..input("missing")
            })
            .is_err());
        db.save_account(input("'; DROP TABLE accounts; --"))
            .unwrap();
        drop(db);
        let db = Store::open(&path).unwrap();
        let snapshot = db.dashboard().unwrap();
        assert_eq!(snapshot.accounts.len(), 2);
        assert_eq!(snapshot.accounts[0].id, a.id);
        assert_eq!(snapshot.usage.status, "unknown");
        assert!(snapshot.usage.remaining_percent.is_none());
        assert!(snapshot.usage.source.is_none());
        assert!(snapshot.usage.observed_at.is_none());
        assert!(snapshot.usage.reset_at.is_none());
    }
    #[test]
    fn state_history_and_delete_are_safe() {
        let dir = tempfile::tempdir().unwrap();
        let mut db = Store::open(&dir.path().join("db")).unwrap();
        let a = db.save_account(input("A")).unwrap();
        let first = db.prepare_handoff(&a.id).unwrap();
        assert_eq!(first.status, "blocked");
        assert_eq!(db.prepare_handoff(&a.id).unwrap().id, first.id);
        db.cancel_handoff(&first.id).unwrap();
        assert!(db.cancel_handoff(&first.id).is_err());
        for _ in 0..22 {
            let h = db.prepare_handoff(&a.id).unwrap();
            db.cancel_handoff(&h.id).unwrap();
        }
        let pending = db.prepare_handoff(&a.id).unwrap();
        db.delete_account(&a.id).unwrap();
        let snapshot = db.dashboard().unwrap();
        assert!(snapshot.accounts.is_empty());
        assert_eq!(snapshot.handoffs.len(), 20);
        assert_eq!(snapshot.handoffs[0].id, pending.id);
        assert_eq!(snapshot.handoffs[0].status, "cancelled");
        assert_eq!(snapshot.handoffs[0].target_name, "A");
        assert!(db.prepare_handoff(&a.id).is_err());
        assert!(db.delete_account(&a.id).is_err());
    }
    #[test]
    fn unsupported_schema_fails_without_reset() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("db");
        let conn = Connection::open(&path).unwrap();
        conn.pragma_update(None, "user_version", 99).unwrap();
        drop(conn);
        assert!(Store::open(&path).is_err());
        let conn = Connection::open(path).unwrap();
        assert_eq!(
            conn.pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
                .unwrap(),
            99
        );
    }
    #[test]
    fn database_errors_do_not_become_empty_dashboards() {
        let dir = tempfile::tempdir().unwrap();
        let db = Store::open(&dir.path().join("db")).unwrap();
        db.conn.execute("DROP TABLE accounts", []).unwrap();
        assert!(db.dashboard().is_err());
        assert!(Store::open(dir.path()).is_err());
    }
}
