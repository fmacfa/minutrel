#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// SPDX-License-Identifier: AGPL-3.0-or-later
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
    time::Duration,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tokio::io::AsyncWriteExt;
use url::Url;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Preferences {
    server_url: String,
    #[serde(default)]
    member_id: Option<String>,
    #[serde(default)]
    local: bool,
    #[serde(default)]
    language: String,
}
struct Credentials {
    server_url: String,
    token: Option<String>,
    persistent: bool,
    member_id: Option<String>,
    local: bool,
    language: String,
}
struct NativeState {
    credentials: Mutex<Credentials>,
    event_task: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    client: reqwest::Client,
    config: PathBuf,
    offline_lock: Mutex<()>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Connection {
    server_url: String,
    authenticated: bool,
    persistent: bool,
    widget: bool,
    local: bool,
}
#[derive(Serialize)]
struct ApiResponse {
    status: u16,
    body: String,
}
fn valid_server(value: &str) -> Result<String, String> {
    let url = Url::parse(value).map_err(|_| "Adresse du serveur invalide.")?;
    let local = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if !(url.scheme() == "https" || url.scheme() == "http" && local)
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || !matches!(url.path(), "" | "/")
    {
        return Err("Utilisez l’adresse HTTPS du serveur, sans chemin. HTTP est accepté uniquement sur cet ordinateur.".into());
    }
    Ok(url.origin().ascii_serialization())
}
fn valid_path(path: &str) -> bool {
    path.starts_with("/api/v1/")
        && path.len() <= 4096
        && !path.contains(['\\', '#', '\r', '\n'])
        && !path.contains("..")
        && !path.to_ascii_lowercase().contains("%2e")
        && !path.to_ascii_lowercase().contains("%2f")
}
fn vault(server: &str) -> Result<keyring::Entry, keyring::Error> {
    keyring::Entry::new("app.minutrel.desktop", server)
}
fn credentials(state: &NativeState) -> Result<(String, Option<String>), String> {
    let c = state
        .credentials
        .lock()
        .map_err(|_| "Session indisponible.")?;
    Ok((c.server_url.clone(), c.token.clone()))
}
fn abort_events(state: &NativeState) {
    if let Ok(mut task) = state.event_task.lock() {
        if let Some(task) = task.take() {
            task.abort();
        }
    }
}
async fn forget(app: &AppHandle, state: &NativeState) -> Result<(), String> {
    let (server, had_token) = {
        let mut c = state
            .credentials
            .lock()
            .map_err(|_| "Session indisponible.")?;
        (c.server_url.clone(), c.token.take().is_some())
    };
    abort_events(state);
    if had_token {
        let _ = tauri::async_runtime::spawn_blocking(move || {
            if let Ok(entry) = vault(&server) {
                let _ = entry.delete_credential();
            }
        })
        .await;
        let _ = app.emit("session-changed", ());
    }
    Ok(())
}
#[tauri::command]
fn get_connection(
    window: WebviewWindow,
    state: State<'_, NativeState>,
) -> Result<Connection, String> {
    let c = state
        .credentials
        .lock()
        .map_err(|_| "Session indisponible.")?;
    Ok(Connection {
        server_url: c.server_url.clone(),
        authenticated: c.token.is_some(),
        persistent: c.persistent,
        widget: window.label() == "quick",
        local: c.local,
    })
}
#[tauri::command]
async fn configure_server(
    app: AppHandle,
    state: State<'_, NativeState>,
    server_url: String,
) -> Result<(), String> {
    let server = valid_server(server_url.trim())?;
    let language = state
        .credentials
        .lock()
        .map_err(|_| "Session indisponible.")?
        .language
        .clone();
    {
        let c = state
            .credentials
            .lock()
            .map_err(|_| "Session indisponible.")?;
        if c.token.is_some() {
            return Err("Déconnectez-vous avant de changer de serveur.".into());
        }
    }
    let stored_server = server.clone();
    let (token, persistent) =
        tauri::async_runtime::spawn_blocking(move || match vault(&stored_server) {
            Ok(entry) => match entry.get_password() {
                Ok(token) => (Some(token), true),
                Err(keyring::Error::NoEntry) => (None, true),
                Err(_) => (None, false),
            },
            Err(_) => (None, false),
        })
        .await
        .map_err(|_| "Le trousseau ne répond pas.")?;
    let prefs = Preferences {
        server_url: server.clone(),
        member_id: None,
        local: false,
        language: language.clone(),
    };
    fs::write(
        &state.config,
        serde_json::to_vec(&prefs).map_err(|_| "Préférences invalides.")?,
    )
    .map_err(|_| "Impossible d’enregistrer l’adresse du serveur.")?;
    *state
        .credentials
        .lock()
        .map_err(|_| "Session indisponible.")? = Credentials {
        server_url: server,
        token,
        persistent,
        member_id: None,
        local: false,
        language,
    };
    let _ = app.emit("session-changed", ());
    Ok(())
}
#[tauri::command]
async fn clear_session(app: AppHandle, state: State<'_, NativeState>) -> Result<(), String> {
    forget(&app, &state).await
}

#[tauri::command]
async fn api_request(
    app: AppHandle,
    state: State<'_, NativeState>,
    path: String,
    method: String,
    body: Option<String>,
    idempotency_key: String,
) -> Result<ApiResponse, String> {
    if !valid_path(&path)
        || !matches!(method.as_str(), "GET" | "POST" | "PATCH" | "DELETE")
        || body.as_ref().is_some_and(|s| s.len() > 1024 * 1024)
    {
        return Err("Requête Minutrel invalide.".into());
    }
    let (server, token) = credentials(&state)?;
    let request_token = token.clone();
    let mut req = state
        .client
        .request(
            method.parse().map_err(|_| "Méthode invalide.")?,
            format!("{server}{path}"),
        )
        .header("Idempotency-Key", idempotency_key)
        .timeout(Duration::from_secs(75));
    let login = method == "POST" && matches!(path.as_str(), "/api/v1/auth/login" | "/api/v1/setup");
    if let Some(body) = body {
        let mut json: Value = serde_json::from_str(&body).map_err(|_| "Données JSON invalides.")?;
        if login {
            json.as_object_mut()
                .ok_or("Données JSON invalides.")?
                .insert("native".into(), Value::Bool(true));
        }
        req = req.json(&json);
    }
    if let Some(token) = token {
        req = req.bearer_auth(token);
    }
    let response = req
        .send()
        .await
        .map_err(|_| "Serveur injoignable. Vérifiez votre connexion et l’adresse du serveur.")?;
    let status = response.status().as_u16();
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| "La réponse du serveur a été interrompue.")?;
        if bytes.len() + chunk.len() > 16 * 1024 * 1024 {
            return Err("La réponse du serveur est trop volumineuse.".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let mut json: Value = serde_json::from_slice(&bytes)
        .map_err(|_| "Le serveur a renvoyé une réponse illisible.")?;
    if !login {
        let c = state
            .credentials
            .lock()
            .map_err(|_| "Session indisponible.")?;
        if c.server_url != server || c.token != request_token {
            return Ok(ApiResponse {
                status: 401,
                body: "{\"message\":\"Le compte actif a changé.\"}".into(),
            });
        }
    }
    if login && (200..300).contains(&status) {
        let token = json
            .as_object_mut()
            .and_then(|o| o.remove("token"))
            .and_then(|v| v.as_str().map(str::to_string))
            .ok_or("La session reçue est invalide.")?;
        let to_store = token.clone();
        let destination = server.clone();
        let persistent = tauri::async_runtime::spawn_blocking(move || {
            vault(&destination)
                .and_then(|entry| entry.set_password(&to_store))
                .is_ok()
        })
        .await
        .unwrap_or(false);
        abort_events(&state);
        {
            let mut c = state
                .credentials
                .lock()
                .map_err(|_| "Session indisponible.")?;
            c.token = Some(token);
            c.persistent = persistent;
            c.member_id = json["member"]["id"].as_str().map(str::to_string);
            c.local = false;
            save_preferences(&state, &c)?;
        }
        let _ = app.emit("session-changed", ());
    }
    if path == "/api/v1/me" && status == 200 {
        let mut c = state
            .credentials
            .lock()
            .map_err(|_| "Session indisponible.")?;
        c.member_id = json["member"]["id"].as_str().map(str::to_string);
        save_preferences(&state, &c)?;
    }
    if status == 401 || method == "POST" && path == "/api/v1/auth/logout" && status == 200 {
        forget(&app, &state).await?;
    }
    Ok(ApiResponse {
        status,
        body: json.to_string(),
    })
}

fn save_preferences(state: &NativeState, c: &Credentials) -> Result<(), String> {
    let prefs = Preferences {
        server_url: c.server_url.clone(),
        member_id: c.member_id.clone(),
        local: c.local,
        language: c.language.clone(),
    };
    fs::write(
        &state.config,
        serde_json::to_vec(&prefs).map_err(|_| "Préférences invalides.")?,
    )
    .map_err(|_| "Impossible d’enregistrer les préférences.".into())
}
#[derive(Serialize, Deserialize)]
struct LocalEnvelope {
    revision: u64,
    data: Value,
}
fn offline_path(state: &NativeState, personal: bool) -> Result<PathBuf, String> {
    let c = state
        .credentials
        .lock()
        .map_err(|_| "Session indisponible.")?;
    let scope = if personal {
        "personal".to_string()
    } else {
        if c.token.is_none() {
            return Err("Reconnectez-vous pour ouvrir cet espace d’équipe.".into());
        }
        format!(
            "{}:{}",
            c.server_url,
            c.member_id
                .as_deref()
                .ok_or("Une première connexion en ligne est nécessaire.")?
        )
    };
    Ok(state.config.with_file_name(format!(
        "offline-{:x}.json",
        Sha256::digest(scope.as_bytes())
    )))
}
fn read_local_file(path: &Path) -> Result<LocalEnvelope, String> {
    for candidate in [path.to_path_buf(), path.with_extension("bak")] {
        if !candidate.exists() {
            continue;
        }
        if fs::metadata(&candidate)
            .map_err(|_| "Cache local illisible.")?
            .len()
            > 16 * 1024 * 1024
        {
            return Err("Le cache local est trop volumineux.".into());
        }
        if let Ok(bytes) = fs::read(&candidate) {
            if let Ok(value) = serde_json::from_slice(&bytes) {
                return Ok(value);
            }
        }
    }
    if path.exists() || path.with_extension("bak").exists() {
        return Err(
            "Le cache local est endommagé. Conservez ses fichiers pour récupération.".into(),
        );
    }
    Ok(LocalEnvelope {
        revision: 0,
        data: Value::Null,
    })
}
#[tauri::command]
fn offline_read(state: State<'_, NativeState>, personal: bool) -> Result<LocalEnvelope, String> {
    let _lock = state.offline_lock.lock().map_err(|_| "Cache occupé.")?;
    read_local_file(&offline_path(&state, personal)?)
}
#[tauri::command]
fn offline_write(
    app: AppHandle,
    state: State<'_, NativeState>,
    personal: bool,
    revision: u64,
    data: Value,
    notify: bool,
) -> Result<LocalEnvelope, String> {
    let _lock = state.offline_lock.lock().map_err(|_| "Cache occupé.")?;
    if !personal {
        let c = state
            .credentials
            .lock()
            .map_err(|_| "Session indisponible.")?;
        if data["session"]["member"]["id"].as_str() != c.member_id.as_deref() {
            return Err("Le compte actif a changé. Réessayez.".into());
        }
    }
    let path = offline_path(&state, personal)?;
    let old = read_local_file(&path)?;
    if old.revision != revision {
        return Err("LOCAL_CONFLICT".into());
    }
    if old.data == data {
        return Ok(old);
    }
    let result = LocalEnvelope {
        revision: revision + 1,
        data,
    };
    let bytes = serde_json::to_vec(&result).map_err(|_| "Données locales invalides.")?;
    if bytes.len() > 16 * 1024 * 1024 {
        return Err("Le stockage local dépasse 16 Mio. Exportez vos archives.".into());
    }
    let part = path.with_extension("part");
    let mut options = fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(&part)
        .map_err(|_| "Impossible de créer le journal local.")?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "Impossible d’enregistrer le journal local.")?;
    drop(file);
    let backup = path.with_extension("bak");
    if path.exists() {
        let valid = fs::read(&path)
            .ok()
            .and_then(|v| serde_json::from_slice::<LocalEnvelope>(&v).ok())
            .is_some();
        if valid {
            if backup.exists() {
                fs::remove_file(&backup).map_err(|_| "Sauvegarde locale occupée.")?;
            }
            fs::rename(&path, &backup)
                .map_err(|_| "Impossible de protéger la copie précédente.")?;
        } else {
            fs::remove_file(&path).map_err(|_| "Impossible de remplacer le cache endommagé.")?;
        }
    }
    fs::rename(&part, &path).map_err(|_| "Impossible de finaliser le journal local.")?;
    if notify {
        let _ = app.emit("local-change", ());
    }
    Ok(result)
}
#[tauri::command]
fn set_local_mode(
    app: AppHandle,
    state: State<'_, NativeState>,
    local: bool,
) -> Result<(), String> {
    {
        let mut c = state
            .credentials
            .lock()
            .map_err(|_| "Session indisponible.")?;
        c.local = local;
        save_preferences(&state, &c)?;
    }
    abort_events(&state);
    let _ = app.emit("session-changed", ());
    Ok(())
}
#[tauri::command]
async fn save_local_file(filename: String, bytes: Vec<u8>) -> Result<(), String> {
    if filename.len() > 120
        || filename.contains(['/', '\\', '\r', '\n'])
        || bytes.len() > 32 * 1024 * 1024
    {
        return Err("Fichier local invalide.".into());
    }
    let Some(file) = rfd::AsyncFileDialog::new()
        .set_file_name(&filename)
        .save_file()
        .await
    else {
        return Ok(());
    };
    file.write(&bytes)
        .await
        .map_err(|_| "Impossible d’enregistrer le fichier local.".into())
}
#[tauri::command]
async fn watch_events(app: AppHandle, state: State<'_, NativeState>) -> Result<(), String> {
    let mut task = state
        .event_task
        .lock()
        .map_err(|_| "Connexion indisponible.")?;
    if task.as_ref().is_some_and(|t| !t.inner().is_finished()) {
        return Ok(());
    }
    let (server, token) = credentials(&state)?;
    let token = token.ok_or("Connectez-vous pour synchroniser le chronomètre.")?;
    let client = state.client.clone();
    *task = Some(tauri::async_runtime::spawn(async move {
        let mut wait = 2;
        loop {
            let result = client
                .get(format!("{server}/api/v1/events"))
                .bearer_auth(&token)
                .header("Accept", "text/event-stream")
                .send()
                .await;
            if let Ok(response) = result {
                if response.status() == reqwest::StatusCode::UNAUTHORIZED {
                    let _ = app.emit("session-changed", ());
                    break;
                }
                if response.status().is_success() {
                    wait = 2;
                    let _ = app.emit("server-connection", true);
                    let _ = app.emit("server-change", ());
                    let mut stream = response.bytes_stream();
                    let mut buffer = String::new();
                    while let Some(Ok(chunk)) = stream.next().await {
                        buffer.push_str(&String::from_utf8_lossy(&chunk));
                        if buffer.len() > 65536 {
                            break;
                        }
                        while let Some(end) = buffer.find("\n\n") {
                            let event: String = buffer.drain(..end + 2).collect();
                            if event.contains("event: change") {
                                let _ = app.emit("server-change", ());
                            }
                        }
                    }
                }
            }
            let _ = app.emit("server-connection", false);
            tokio::time::sleep(Duration::from_secs(wait)).await;
            wait = (wait * 2).min(30);
        }
    }));
    Ok(())
}
#[tauri::command]
async fn download_file(
    state: State<'_, NativeState>,
    path: String,
    filename: String,
) -> Result<(), String> {
    if !valid_path(&path) || filename.len() > 120 || filename.contains(['/', '\\', '\r', '\n']) {
        return Err("Téléchargement invalide.".into());
    }
    let (server, token) = credentials(&state)?;
    let token = token.ok_or("Reconnectez-vous pour télécharger ce fichier.")?;
    let Some(file) = rfd::AsyncFileDialog::new()
        .set_file_name(&filename)
        .save_file()
        .await
    else {
        return Ok(());
    };
    let target = file.path();
    let response = state
        .client
        .get(format!("{server}{path}"))
        .bearer_auth(token)
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .map_err(|_| "Le serveur est injoignable.")?;
    if !response.status().is_success() {
        let error: Value = response.json().await.unwrap_or(Value::Null);
        return Err(error["message"]
            .as_str()
            .unwrap_or("Le téléchargement a échoué.")
            .into());
    }
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| "Horloge invalide.")?
        .as_nanos();
    let temporary = target.with_extension(format!("minutrel-{nonce}.part"));
    let result = async {
        let mut output = tokio::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .await
            .map_err(|_| "Impossible de créer le fichier.")?;
        let mut stream = response.bytes_stream();
        let mut size = 0;
        while let Some(chunk) = stream.next().await {
            let chunk = chunk.map_err(|_| "Téléchargement interrompu.")?;
            size += chunk.len();
            if size > 64 * 1024 * 1024 {
                return Err("L’export dépasse 64 Mio. Réduisez la sélection.".to_string());
            }
            output
                .write_all(&chunk)
                .await
                .map_err(|_| "Impossible d’écrire le fichier.")?;
        }
        output
            .flush()
            .await
            .map_err(|_| "Impossible de finaliser le fichier.")?;
        drop(output);
        if cfg!(target_os = "windows") && target.exists() {
            tokio::fs::remove_file(target)
                .await
                .map_err(|_| "Impossible de remplacer le fichier sélectionné.")?;
        }
        tokio::fs::rename(&temporary, target)
            .await
            .map_err(|_| "Impossible de finaliser le téléchargement.")?;
        Ok(())
    }
    .await;
    if result.is_err() {
        let _ = tokio::fs::remove_file(&temporary).await;
    }
    result
}
fn open_main(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Fenêtre principale indisponible.")?;
    window.show().map_err(|_| "Impossible d’ouvrir Minutrel.")?;
    let _ = window.unminimize();
    let _ = window.set_focus();
    Ok(())
}
#[tauri::command]
fn show_main(app: AppHandle) -> Result<(), String> {
    open_main(&app)
}
fn widget(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("quick") {
        window
            .destroy()
            .map_err(|_| "Impossible de masquer le widget.")?;
        return Ok(());
    }
    let language = app
        .state::<NativeState>()
        .credentials
        .lock()
        .map_err(|_| "Session indisponible.")?
        .language
        .clone();
    WebviewWindowBuilder::new(app, "quick", WebviewUrl::App("index.html".into()))
        .title(match language.as_str() {
            "en" => "Minutrel — Mini timer",
            "de" => "Minutrel — Mini-Zeitmessung",
            _ => "Minutrel — Mini chrono",
        })
        .inner_size(365.0, 332.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .build()
        .map_err(|_| "Impossible d’ouvrir le mini chronomètre.")?;
    Ok(())
}
#[tauri::command]
fn toggle_widget(app: AppHandle) -> Result<(), String> {
    widget(&app)
}
#[tauri::command]
fn resize_widget(window: WebviewWindow, height: f64) -> Result<(), String> {
    if window.label() != "quick" || !height.is_finite() {
        return Err("Cette commande est réservée au mini chronomètre.".into());
    }
    window
        .set_size(tauri::LogicalSize::new(365.0, height.clamp(210.0, 440.0)))
        .map_err(|_| "Impossible d’ajuster le mini chronomètre.".into())
}
fn tray_menu(app: &AppHandle, language: &str) -> Result<Menu<tauri::Wry>, tauri::Error> {
    let labels = match language {
        "en" => [
            "Open Minutrel",
            "Show / hide mini timer",
            "Quit (time is preserved)",
        ],
        "de" => [
            "Minutrel öffnen",
            "Mini-Zeitmessung anzeigen / ausblenden",
            "Beenden (Zeit bleibt erhalten)",
        ],
        _ => [
            "Ouvrir Minutrel",
            "Afficher / masquer le mini chrono",
            "Quitter (le temps reste enregistré)",
        ],
    };
    let open = MenuItem::with_id(app, "open", labels[0], true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "quick", labels[1], true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", labels[2], true, None::<&str>)?;
    Menu::with_items(app, &[&open, &quick, &quit])
}
#[tauri::command]
fn set_language(
    app: AppHandle,
    state: State<'_, NativeState>,
    language: String,
) -> Result<(), String> {
    if !matches!(language.as_str(), "fr" | "en" | "de") {
        return Err("Langue invalide.".into());
    }
    {
        let mut c = state
            .credentials
            .lock()
            .map_err(|_| "Session indisponible.")?;
        c.language = language.clone();
        save_preferences(&state, &c)?;
    }
    if let Some(tray) = app.tray_by_id("minutrel") {
        tray.set_menu(Some(
            tray_menu(&app, &language).map_err(|_| "Menu indisponible.")?,
        ))
        .map_err(|_| "Menu indisponible.")?;
    }
    Ok(())
}
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = open_main(app);
        }))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let _ = widget(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let config_dir = app.path().app_config_dir()?;
            fs::create_dir_all(&config_dir)?;
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                fs::set_permissions(&config_dir, fs::Permissions::from_mode(0o700))?;
            }
            let config = config_dir.join("connection.json");
            let prefs = fs::read(&config)
                .ok()
                .and_then(|v| serde_json::from_slice::<Preferences>(&v).ok());
            let server = prefs
                .as_ref()
                .and_then(|p| valid_server(&p.server_url).ok())
                .unwrap_or_else(|| "http://127.0.0.1:8080".into());
            let restore_server = server.clone();
            app.manage(NativeState {
                credentials: Mutex::new(Credentials {
                    server_url: server,
                    token: None,
                    persistent: true,
                    member_id: prefs.as_ref().and_then(|p| p.member_id.clone()),
                    local: prefs.as_ref().is_some_and(|p| p.local),
                    language: prefs
                        .as_ref()
                        .map(|p| p.language.clone())
                        .unwrap_or_default(),
                }),
                event_task: Mutex::new(None),
                config,
                offline_lock: Mutex::new(()),
                client: reqwest::Client::builder()
                    .redirect(reqwest::redirect::Policy::none())
                    .connect_timeout(Duration::from_secs(10))
                    .user_agent("Minutrel/0.1.0")
                    .build()?,
            });
            let language = prefs.as_ref().map(|p| p.language.as_str()).unwrap_or("fr");
            let menu = tray_menu(app.handle(), language)?;
            TrayIconBuilder::with_id("minutrel")
                .icon(app.default_window_icon().ok_or("Icône manquante")?.clone())
                .tooltip("Minutrel — Votre temps par projet")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        let _ = open_main(app);
                    }
                    "quick" => {
                        let _ = widget(app);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            let _ = app.global_shortcut().register("CommandOrControl+Alt+M");
            // L’espace autonome ne consulte jamais le trousseau. La reprise d’un
            // compte d’équipe ne doit pas bloquer la boucle d’interface système.
            if prefs
                .as_ref()
                .is_some_and(|p| !p.local && p.member_id.is_some())
            {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let lookup_server = restore_server.clone();
                    let (token, persistent) =
                        tauri::async_runtime::spawn_blocking(move || match vault(&lookup_server) {
                            Ok(entry) => match entry.get_password() {
                                Ok(token) => (Some(token), true),
                                Err(keyring::Error::NoEntry) => (None, true),
                                Err(_) => (None, false),
                            },
                            Err(_) => (None, false),
                        })
                        .await
                        .unwrap_or((None, false));
                    let state = handle.state::<NativeState>();
                    if let Ok(mut c) = state.credentials.lock() {
                        if c.server_url == restore_server && !c.local && c.token.is_none() {
                            c.token = token;
                            c.persistent = persistent;
                            drop(c);
                            let _ = handle.emit("session-changed", ());
                        }
                    };
                });
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_connection,
            configure_server,
            clear_session,
            api_request,
            watch_events,
            download_file,
            show_main,
            toggle_widget,
            resize_widget,
            offline_read,
            offline_write,
            set_local_mode,
            save_local_file,
            set_language
        ])
        .run(tauri::generate_context!())
        .expect("Impossible de démarrer Minutrel");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restricts_server_origins_and_routes() {
        assert_eq!(
            valid_server("https://temps.example.com/").unwrap(),
            "https://temps.example.com"
        );
        assert!(valid_server("http://127.0.0.1:8080").is_ok());
        for url in [
            "http://192.168.1.3",
            "https://user:pass@example.com",
            "https://example.com/mcp",
            "file:///etc/passwd",
            "https://example.com/?token=secret",
        ] {
            assert!(valid_server(url).is_err());
        }
        assert!(valid_path("/api/v1/time-entries?memberId=me"));
        for path in [
            "https://example.com",
            "/api/v1/../secret",
            "/api/v1/%2e%2e/secret",
            "/api/v1/auth\nHeader: value",
            "/mcp",
        ] {
            assert!(!valid_path(path));
        }
    }
    #[test]
    fn recovers_previous_local_state_and_rejects_corrupted_files() {
        let dir = std::env::temp_dir().join(format!("minutrel-journal-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("state.json");
        fs::write(&path, b"interrupted write").unwrap();
        fs::write(
            path.with_extension("bak"),
            br#"{"revision":8,"data":{"entries":["saved"]}}"#,
        )
        .unwrap();
        let restored = read_local_file(&path).unwrap();
        assert_eq!(restored.revision, 8);
        assert_eq!(restored.data["entries"][0], "saved");
        fs::remove_file(path.with_extension("bak")).unwrap();
        assert!(read_local_file(&path).is_err());
        fs::remove_file(&path).unwrap();
        assert_eq!(read_local_file(&path).unwrap().revision, 0);
        fs::remove_dir(&dir).unwrap();
    }
}
