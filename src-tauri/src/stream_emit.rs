//! Host-side stream emit backpressure (coalesce `session://stream` IPC).
//!
//! Every token used to `app.emit` immediately, which flooded the WebView on
//! long answers. Buffer per turn and flush on a short timer, char budget,
//! phase boundary, or terminal `done`.

#![allow(dead_code)] // residual-clippy: normalize bounds helpers
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

/// Default coalesce window (ms) before a non-forced flush.
pub const DEFAULT_STREAM_EMIT_MS: u64 = 40;
/// Unfocused main window — fewer WebView IPC wakes; buffer still flushes on
/// char budget, phase, or `done`.
pub const BACKGROUND_STREAM_EMIT_MS: u64 = 160;
/// Flush once pending text reaches this many UTF-8 bytes (approx chars).
pub const DEFAULT_STREAM_EMIT_MAX_CHARS: usize = 600;
/// Unfocused: the 160ms timer is useless if 600 bytes still force-flush
/// every few tokens. Keep IPC; wait for the interval unless the buffer
/// is large or `done` / phase forces.
pub const BACKGROUND_STREAM_EMIT_MAX_CHARS: usize = 2400;
pub const MIN_STREAM_EMIT_MS: u64 = 8;
pub const MAX_STREAM_EMIT_MS: u64 = 250;

static MAIN_WINDOW_FOCUSED: AtomicBool = AtomicBool::new(true);

/// FE parks wallpaper / deferred stream paint on this (per-window emit).
pub const WINDOW_FOCUSED_EVENT: &str = "app://window-focused";

pub fn set_main_window_focused(focused: bool) {
    MAIN_WINDOW_FOCUSED.store(focused, Ordering::Relaxed);
}

pub fn main_window_focused() -> bool {
    MAIN_WINDOW_FOCUSED.load(Ordering::Relaxed)
}

/// Live flush cadence: snappy while the user is watching, cheaper when not.
pub fn stream_emit_interval_ms() -> u64 {
    if main_window_focused() {
        DEFAULT_STREAM_EMIT_MS
    } else {
        BACKGROUND_STREAM_EMIT_MS
    }
}

/// Char budget follows focus the same way as the timer.
pub fn stream_emit_max_chars() -> usize {
    if main_window_focused() {
        DEFAULT_STREAM_EMIT_MAX_CHARS
    } else {
        BACKGROUND_STREAM_EMIT_MAX_CHARS
    }
}

pub fn normalize_stream_emit_ms(raw: u64) -> u64 {
    raw.clamp(MIN_STREAM_EMIT_MS, MAX_STREAM_EMIT_MS)
}

/// Whether a buffered stream emit should flush now.
pub fn should_flush_stream_emit(
    first_buffered_at: Instant,
    pending_chars: usize,
    now: Instant,
    force: bool,
    max_chars: usize,
    interval: Duration,
) -> bool {
    if force {
        return true;
    }
    if pending_chars == 0 {
        return false;
    }
    if pending_chars >= max_chars {
        return true;
    }
    now.saturating_duration_since(first_buffered_at) >= interval
}

/// Kind/message identity change or phase open must not merge into the buffer.
pub fn stream_emit_can_merge(
    pending_kind: &str,
    pending_message_id: &str,
    next_kind: &str,
    next_message_id: &str,
    next_thought_phase: &str,
) -> bool {
    if pending_kind != next_kind {
        return false;
    }
    if pending_message_id != next_message_id {
        return false;
    }
    let phase = next_thought_phase.to_ascii_lowercase();
    // New thought block must start a fresh emit so the UI can open a phase.
    if phase == "new" || phase == "open" {
        return false;
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn force_and_char_budget_flush() {
        let t0 = Instant::now();
        assert!(!should_flush_stream_emit(
            t0,
            10,
            t0,
            false,
            600,
            Duration::from_millis(40)
        ));
        assert!(should_flush_stream_emit(
            t0,
            600,
            t0,
            false,
            600,
            Duration::from_millis(40)
        ));
        assert!(should_flush_stream_emit(
            t0,
            1,
            t0,
            true,
            600,
            Duration::from_millis(40)
        ));
    }

    #[test]
    fn background_interval_is_slower() {
        const { assert!(BACKGROUND_STREAM_EMIT_MS > DEFAULT_STREAM_EMIT_MS) };
        const { assert!(BACKGROUND_STREAM_EMIT_MS <= MAX_STREAM_EMIT_MS) };
        set_main_window_focused(true);
        assert_eq!(stream_emit_interval_ms(), DEFAULT_STREAM_EMIT_MS);
        set_main_window_focused(false);
        assert_eq!(stream_emit_interval_ms(), BACKGROUND_STREAM_EMIT_MS);
        set_main_window_focused(true);
    }

    #[test]
    fn background_char_budget_is_looser() {
        const { assert!(BACKGROUND_STREAM_EMIT_MAX_CHARS > DEFAULT_STREAM_EMIT_MAX_CHARS) };
        set_main_window_focused(true);
        assert_eq!(stream_emit_max_chars(), DEFAULT_STREAM_EMIT_MAX_CHARS);
        set_main_window_focused(false);
        assert_eq!(stream_emit_max_chars(), BACKGROUND_STREAM_EMIT_MAX_CHARS);
        let t0 = Instant::now();
        assert!(!should_flush_stream_emit(
            t0,
            600,
            t0,
            false,
            BACKGROUND_STREAM_EMIT_MAX_CHARS,
            Duration::from_millis(BACKGROUND_STREAM_EMIT_MS)
        ));
        assert!(should_flush_stream_emit(
            t0,
            BACKGROUND_STREAM_EMIT_MAX_CHARS,
            t0,
            false,
            BACKGROUND_STREAM_EMIT_MAX_CHARS,
            Duration::from_millis(BACKGROUND_STREAM_EMIT_MS)
        ));
        set_main_window_focused(true);
    }

    #[test]
    fn interval_flush() {
        let t0 = Instant::now();
        let later = t0 + Duration::from_millis(40);
        assert!(should_flush_stream_emit(
            t0,
            8,
            later,
            false,
            600,
            Duration::from_millis(40)
        ));
    }

    #[test]
    fn merge_rules() {
        assert!(stream_emit_can_merge(
            "assistant",
            "m1",
            "assistant",
            "m1",
            "none"
        ));
        assert!(stream_emit_can_merge(
            "thought", "m1", "thought", "m1", "continue"
        ));
        assert!(!stream_emit_can_merge(
            "thought", "m1", "thought", "m1", "new"
        ));
        assert!(!stream_emit_can_merge(
            "assistant",
            "m1",
            "thought",
            "m1",
            "none"
        ));
        assert!(!stream_emit_can_merge(
            "assistant",
            "m1",
            "assistant",
            "m2",
            "none"
        ));
    }

    #[test]
    fn window_focused_event_name_is_stable() {
        assert_eq!(WINDOW_FOCUSED_EVENT, "app://window-focused");
    }
}
