//! OS light/dark probe + live Windows Personalize watch.
//!
//! Boot locks WebView2 to a concrete theme (form chrome). That freezes
//! `prefers-color-scheme`, so Settings → Personalization flips never reach
//! matchMedia. On Windows **one** host thread waits on the `Personalize` key
//! via `RegNotifyChangeKeyValue` (no 1s registry poll) and fans out:
//! - `AppsUseLightTheme` → `os-theme://changed` for the frontend `data-theme`
//! - tray taskbar-badge listener (`SystemUsesLightTheme`) when registered
//!
//! App and taskbar themes stay independent; tray `set_icon` still hops to the
//! main thread (#735). The tray module must not spawn a second notify waiter.

use tauri::AppHandle;

/// After a failed registry notify, back off (not a 1s poll).
/// Shared by the single Personalize waiter (app theme + tray badge).
pub const OS_THEME_NOTIFY_RETRY_SECS: u64 = 30;

/// Host → frontend when Windows default *app* mode changes.
#[cfg_attr(not(windows), allow(dead_code))]
pub const OS_THEME_CHANGED_EVENT: &str = "os-theme://changed";

/// `AppsUseLightTheme` DWORD: `0` = dark apps, `1` = light. Missing → dark.
#[cfg_attr(not(test), allow(dead_code))]
pub fn apps_prefer_dark_from_dword(apps: Option<u32>) -> bool {
    apps.is_none_or(|v| v == 0)
}

/// Best-effort OS dark/light probe (no extra deps).
pub fn os_prefers_dark() -> bool {
    #[cfg(target_os = "macos")]
    {
        // AppleInterfaceStyle is set only in dark mode; missing → light.
        let out = crate::process_util::command("defaults")
            .args(["read", "-g", "AppleInterfaceStyle"])
            .output();
        if let Ok(o) = out {
            let s = String::from_utf8_lossy(&o.stdout).to_ascii_lowercase();
            return s.contains("dark");
        }
        true
    }
    #[cfg(target_os = "windows")]
    {
        apps_prefer_dark()
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        // GNOME etc. — soft default dark when unknown
        true
    }
}

#[cfg(windows)]
fn apps_prefer_dark() -> bool {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let apps = hkcu
        .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize")
        .ok()
        .and_then(|key| key.get_value::<u32, _>("AppsUseLightTheme").ok());
    apps_prefer_dark_from_dword(apps)
}

pub fn resolved_os_theme() -> &'static str {
    if os_prefers_dark() {
        "dark"
    } else {
        "light"
    }
}

#[tauri::command]
pub fn os_theme_current() -> String {
    resolved_os_theme().to_string()
}

/// After one Personalize notify, which consumers should refresh?
///
/// App (`AppsUseLightTheme`) and taskbar (`SystemUsesLightTheme`) stay
/// independent — a flip of one DWORD must not restyle the other.
#[cfg_attr(not(test), allow(dead_code))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct PersonalizeFanout {
    pub app_theme: bool,
    pub tray_badge: bool,
}

#[cfg_attr(not(test), allow(dead_code))]
pub(crate) fn personalize_fanout(
    prev_app_theme: &str,
    next_app_theme: &str,
    prev_taskbar_light: bool,
    next_taskbar_light: bool,
) -> PersonalizeFanout {
    PersonalizeFanout {
        app_theme: app_theme_changed(prev_app_theme, next_app_theme),
        tray_badge: tray_badge_changed(prev_taskbar_light, next_taskbar_light),
    }
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(crate) fn app_theme_changed(prev: &str, next: &str) -> bool {
    prev != next
}

#[cfg_attr(not(any(test, windows)), allow(dead_code))]
pub(crate) fn tray_badge_changed(prev_light: bool, next_light: bool) -> bool {
    prev_light != next_light
}

/// Watch Windows app mode. No-op on other OS (matchMedia / Tauri theme-changed).
///
/// Starts the shared Personalize waiter. Tray should register its listener
/// first (`setup_tray` already runs before this in `lib.rs`).
pub fn watch(app: &AppHandle) {
    #[cfg(windows)]
    watch_apps_theme(app.clone());
    #[cfg(not(windows))]
    let _ = app;
}

/// Block until `Personalize` values change, or return an error to back off.
///
/// Same key holds `AppsUseLightTheme` (in-app follow-system) and
/// `SystemUsesLightTheme` (taskbar / tray badge).
#[cfg(windows)]
fn wait_personalize_change() -> Result<(), String> {
    use windows::core::w;
    use windows::Win32::Foundation::ERROR_SUCCESS;
    use windows::Win32::System::Registry::{
        RegCloseKey, RegNotifyChangeKeyValue, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER, KEY_NOTIFY,
        REG_NOTIFY_CHANGE_LAST_SET,
    };

    let mut hkey = HKEY::default();
    let open = unsafe {
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            w!(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"),
            None,
            KEY_NOTIFY,
            &mut hkey,
        )
    };
    if open != ERROR_SUCCESS {
        return Err(format!("RegOpenKeyExW {open:?}"));
    }
    let notify =
        unsafe { RegNotifyChangeKeyValue(hkey, false, REG_NOTIFY_CHANGE_LAST_SET, None, false) };
    let _ = unsafe { RegCloseKey(hkey) };
    if notify != ERROR_SUCCESS {
        return Err(format!("RegNotifyChangeKeyValue {notify:?}"));
    }
    Ok(())
}

#[cfg(windows)]
type PersonalizeListener = std::sync::Arc<dyn Fn() + Send + Sync>;

#[cfg(windows)]
struct PersonalizeListeners {
    app_theme: Option<PersonalizeListener>,
    tray_badge: Option<PersonalizeListener>,
}

#[cfg(windows)]
fn personalize_listeners() -> &'static std::sync::Mutex<PersonalizeListeners> {
    static LISTENERS: std::sync::OnceLock<std::sync::Mutex<PersonalizeListeners>> =
        std::sync::OnceLock::new();
    LISTENERS.get_or_init(|| {
        std::sync::Mutex::new(PersonalizeListeners {
            app_theme: None,
            tray_badge: None,
        })
    })
}

/// Tray taskbar-badge listener. Does **not** start a second notify thread.
#[cfg(windows)]
pub(crate) fn on_personalize_tray_badge(f: impl Fn() + Send + Sync + 'static) {
    personalize_listeners()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .tray_badge = Some(std::sync::Arc::new(f));
}

#[cfg(windows)]
fn fire_personalize_listeners() {
    let (app, tray) = {
        let g = personalize_listeners()
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        (g.app_theme.clone(), g.tray_badge.clone())
    };
    if let Some(f) = app {
        f();
    }
    if let Some(f) = tray {
        f();
    }
}

#[cfg(windows)]
fn ensure_personalize_watcher() {
    use std::sync::atomic::{AtomicBool, Ordering};
    static STARTED: AtomicBool = AtomicBool::new(false);
    if STARTED.swap(true, Ordering::SeqCst) {
        return;
    }
    std::thread::Builder::new()
        .name("grok-os-theme".into())
        .spawn(|| {
            // Sync once in case Personalize flipped between tray register and
            // waiter start. Listeners no-op when their DWORD is unchanged.
            fire_personalize_listeners();
            loop {
                if let Err(e) = wait_personalize_change() {
                    tracing::debug!(error = %e, "os_theme: registry notify failed; backing off");
                    std::thread::sleep(std::time::Duration::from_secs(OS_THEME_NOTIFY_RETRY_SECS));
                }
                fire_personalize_listeners();
            }
        })
        .ok();
}

#[cfg(windows)]
fn watch_apps_theme(app: AppHandle) {
    use std::sync::Mutex;
    use tauri::Emitter;

    let last = Mutex::new(resolved_os_theme());
    personalize_listeners()
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .app_theme = Some(std::sync::Arc::new(move || {
        let now = resolved_os_theme();
        let mut last = last.lock().unwrap_or_else(|e| e.into_inner());
        if !app_theme_changed(*last, now) {
            return;
        }
        *last = now;
        let _ = app.emit(OS_THEME_CHANGED_EVENT, serde_json::json!({ "theme": now }));
    }));
    ensure_personalize_watcher();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn apps_dword_zero_is_dark() {
        assert!(apps_prefer_dark_from_dword(Some(0)));
        assert!(!apps_prefer_dark_from_dword(Some(1)));
        assert!(apps_prefer_dark_from_dword(None));
    }

    #[test]
    fn resolved_theme_matches_probe() {
        let t = resolved_os_theme();
        assert!(t == "light" || t == "dark");
        assert_eq!(t == "dark", os_prefers_dark());
    }

    #[test]
    fn theme_watch_retry_is_not_one_second_poll() {
        const { assert!(OS_THEME_NOTIFY_RETRY_SECS >= 15) };
        assert_ne!(OS_THEME_NOTIFY_RETRY_SECS, 1);
    }

    #[test]
    fn personalize_fanout_keeps_app_and_taskbar_independent() {
        assert_eq!(
            personalize_fanout("dark", "dark", true, true),
            PersonalizeFanout {
                app_theme: false,
                tray_badge: false
            }
        );
        assert_eq!(
            personalize_fanout("dark", "light", true, true),
            PersonalizeFanout {
                app_theme: true,
                tray_badge: false
            }
        );
        assert_eq!(
            personalize_fanout("dark", "dark", true, false),
            PersonalizeFanout {
                app_theme: false,
                tray_badge: true
            }
        );
        assert_eq!(
            personalize_fanout("light", "dark", false, true),
            PersonalizeFanout {
                app_theme: true,
                tray_badge: true
            }
        );
        assert!(!app_theme_changed("dark", "dark"));
        assert!(tray_badge_changed(true, false));
    }
}
