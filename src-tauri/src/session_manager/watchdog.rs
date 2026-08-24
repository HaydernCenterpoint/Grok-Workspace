//! Idle recycle + stream-stall watchdogs.

use std::sync::Arc;
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};

use crate::session_fsm::SessionState;
use crate::stream_stall::{
    effective_stall_seconds, is_maybe_done_candidate, is_stream_stalled, should_emit_soft_stall,
    stall_tier_from_evidence,
};

use super::*;

impl SessionManager {
    pub fn start_idle_watchdog(self: &Arc<Self>, app: AppHandle) {
        let mgr = Arc::clone(self);
        tauri::async_runtime::spawn(async move {
            loop {
                crate::host_runtime::touch_heartbeat();
                let recycle = mgr.needs_idle_recycle();
                if recycle {
                    mgr.tick_idle_recycle(&app).await;
                }
                // Prewarm processes left un-consumed expire after a few minutes.
                let prewarm = mgr.needs_prewarm_sweep();
                if prewarm {
                    mgr.sweep_expired_prewarm(Duration::from_secs(10 * 60))
                        .await;
                }
                tokio::time::sleep(Duration::from_secs(idle_watchdog_sleep_secs(
                    recycle, prewarm,
                )))
                .await;
            }
        });
    }

    /// Background stream stall detector (I06). Safe to call once from app setup.
    /// Also drives long-tool heartbeats on the same 5s tick.
    pub fn start_stream_stall_watchdog(self: &Arc<Self>, app: AppHandle) {
        let mgr = Arc::clone(self);
        tauri::async_runtime::spawn(async move {
            let mut first = true;
            loop {
                if !first {
                    let wait = stream_watchdog_sleep_secs(
                        mgr.needs_stream_watchdog(),
                        crate::session_api::persisted_queue_maybe_nonempty(),
                    );
                    tokio::time::sleep(Duration::from_secs(wait)).await;
                }
                first = false;
                if mgr.needs_stream_watchdog() {
                    mgr.tick_tool_heartbeats(&app);
                    mgr.tick_stream_stall(&app);
                }
                crate::session_api::schedule_drain_ready_external_queues(
                    app.clone(),
                    Arc::clone(&mgr),
                );
            }
        });
    }

    /// Skip prewarm reap when the slot is empty (typical idle).
    pub(super) fn needs_prewarm_sweep(&self) -> bool {
        !matches!(*self.prewarm.lock(), PrewarmState::None)
    }

    /// Skip the connect-lock recycle walk when no session is warm.
    pub(super) fn needs_idle_recycle(&self) -> bool {
        if !self.parked.lock().is_empty() {
            return true;
        }
        if !self.background.lock().is_empty() {
            return true;
        }
        self.inner.lock().is_some()
    }

    /// Skip stall / tool-heartbeat walks when nothing is streaming or mid-tool.
    pub(super) fn needs_stream_watchdog(&self) -> bool {
        let live_busy = {
            let guard = self.inner.lock();
            guard.as_ref().is_some_and(Self::session_needs_watchdog)
        };
        if live_busy {
            return true;
        }
        self.background
            .lock()
            .values()
            .any(Self::session_needs_watchdog)
    }

    fn session_needs_watchdog(s: &LiveSession) -> bool {
        s.fsm.state() == SessionState::Streaming
            || s.prompt_in_flight
            || !s.open_tool_ids.is_empty()
    }

    pub(super) fn tick_stream_stall(&self, app: &AppHandle) {
        let stall_secs = Self::stream_stall_seconds_from_settings();
        let now = Instant::now();

        // Heal live focus slot.
        let live_action = {
            let mut guard = self.inner.lock();
            guard
                .as_mut()
                .and_then(|s| Self::tick_stream_stall_on_session(s, Some(app), stall_secs, now))
        };
        self.apply_stall_tick_action(app, live_action);

        // Background busy turns: silent heal only. Soft banners still emit so
        // the user sees Keep waiting / End turn when they view that chat — we
        // never force-end a user task just because it is not focused.
        let bg_actions: Vec<StallTickAction> = {
            let mut bg = self.background.lock();
            bg.values_mut()
                .filter_map(|s| Self::tick_stream_stall_on_session(s, Some(app), stall_secs, now))
                .collect()
        };
        for a in bg_actions {
            self.apply_stall_tick_action(app, Some(a));
        }
    }

    /// Per-session stall tick decision (mutates session when healing).
    pub(super) fn tick_stream_stall_on_session(
        s: &mut LiveSession,
        app: Option<&AppHandle>,
        stall_secs: u32,
        now: Instant,
    ) -> Option<StallTickAction> {
        // Only pure streaming silence — not permission / plan / ask-user waits.
        if s.fsm.state() != SessionState::Streaming {
            return None;
        }
        s.streaming_message_id.as_ref()?;
        if s.pending_plan_rpc_id.is_some() || s.pending_ask_user_rpc_id.is_some() {
            return None;
        }
        // Deferred prompt_complete + orphan open tools: try silent heal without
        // waiting for stall silence. Tool heartbeat re-arms last_stream_progress
        // every 25s while open tools exist, so a leaked open id would otherwise
        // never reach the stall path and the UI stays "running" forever.
        // Normal mid-turn tools (journal not terminal, still young) are not pruned.
        if s.deferred_prompt_complete.is_some() && Self::heal_stuck_streaming_turn(s, app, now) {
            return Some(StallTickAction::Healed {
                session_id: s.app_session_id.clone(),
            });
        }
        let saw_model_this_turn = s.saw_model_output || !s.stream_buf.trim().is_empty();
        // Streamed CoT is this-turn progress even before visible body — do not
        // use the short pre-token window while thinking tokens are arriving.
        let saw_thought_this_turn = !s.stream_thought.trim().is_empty();
        let saw_tools = s.tools_this_turn > 0 || !s.open_tool_ids.is_empty();
        let stall_secs = effective_stall_seconds(
            stall_secs,
            saw_model_this_turn || saw_thought_this_turn,
            saw_tools,
        );
        // No silence yet — keep working.
        if !is_stream_stalled(s.last_stream_progress, stall_secs, now) {
            return None;
        }

        // 1) Silent heal (orphan tools + deferred complete + ready-eligible).
        if Self::heal_stuck_streaming_turn(s, app, now) {
            return Some(StallTickAction::Healed {
                session_id: s.app_session_id.clone(),
            });
        }

        // This-turn body only. Prior-turn journal must not upgrade a new send
        // to post_output — that painted “输出暂时停住了” during first-token wait
        // after an earlier answer in the same chat.
        if saw_model_this_turn {
            s.saw_model_output = true;
        }
        let saw_model_for_tier = saw_model_this_turn;
        // Maybe-done = this turn has body + tools idle. Used for UI copy only —
        // never force-ends; user chooses Keep waiting / End turn.
        let terminal_candidate = is_maybe_done_candidate(
            saw_model_this_turn,
            s.open_tool_ids.len(),
            s.deferred_prompt_complete.is_some(),
        );

        // 2) Soft banner only — never auto-cancel a user-initiated turn.
        // Re-prompt every full soft window while silence continues. Silent heal
        // above already covered truly finished FSM (RPC done, no open tools).
        if !should_emit_soft_stall(
            s.last_stream_progress,
            s.last_stall_emit,
            stall_secs,
            s.stall_soft_emits,
            now,
        ) {
            return None;
        }
        s.last_stall_emit = Some(now);
        s.stall_soft_emits = s.stall_soft_emits.saturating_add(1);
        let tier = stall_tier_from_evidence(saw_model_for_tier, saw_tools, terminal_candidate);
        Some(StallTickAction::SoftStall {
            session_id: s.app_session_id.clone(),
            stall_seconds: stall_secs,
            tier,
            saw_model_output: saw_model_for_tier,
            saw_tool_activity: saw_tools,
        })
    }

    pub(super) fn apply_stall_tick_action(&self, app: &AppHandle, action: Option<StallTickAction>) {
        let Some(action) = action else {
            return;
        };
        match action {
            StallTickAction::Healed { session_id } => {
                tracing::info!(
                    target: "session",
                    session = %session_id,
                    "stream stall heal succeeded — turn Ready"
                );
                Self::emit_runtime(
                    app,
                    &SessionSnapshot {
                        session_id: Some(session_id),
                        agent_session_id: None,
                        state: SessionState::Ready,
                        last_error: None,
                        streaming_message_id: None,
                        backend: Self::backend_name(),
                        model_id: None,
                        project_path: None,
                        title: String::new(),
                    },
                );
                Self::emit_state(app, &self.snapshot());
            }
            StallTickAction::HardEnded {
                session_id,
                stall_seconds,
                reason,
            } => {
                tracing::warn!(
                    target: "session",
                    session = %session_id,
                    stall_seconds,
                    reason,
                    "stream stall — force-ended turn, journal kept (cancel hung prompt)"
                );
                // Unblock the agent: force_end only cleared Host FSM; without cancel
                // the CLI stays blocked on model inference and refuses the next send.
                if let Some((Some(acp), agent_sid)) = self.with_session_mut(&session_id, |s| {
                    (s.acp.clone(), s.meta.agent_session_id.clone())
                }) {
                    let msg = format!("stream stall recovery ({reason})");
                    acp.abort_pending_prompts(&msg);
                    let sid = agent_sid;
                    tauri::async_runtime::spawn(async move {
                        // Target the session explicitly (shared process safety).
                        let _ = match sid {
                            Some(sid) => acp.cancel_for(&sid).await,
                            None => acp.cancel().await,
                        };
                    });
                }
                Self::emit_runtime(
                    app,
                    &SessionSnapshot {
                        session_id: Some(session_id.clone()),
                        agent_session_id: None,
                        state: SessionState::Ready,
                        last_error: None,
                        streaming_message_id: None,
                        backend: Self::backend_name(),
                        model_id: None,
                        project_path: None,
                        title: String::new(),
                    },
                );
                let _ = app.emit(
                    "session://stream_stall_hard_end",
                    serde_json::json!({
                        "sessionId": session_id,
                        "stallSeconds": stall_seconds,
                        "code": "STREAM_STALL_HARD_END",
                        "reason": reason,
                    }),
                );
                Self::emit_state(app, &self.snapshot());
            }
            StallTickAction::SoftStall {
                session_id,
                stall_seconds,
                tier,
                saw_model_output,
                saw_tool_activity,
            } => {
                tracing::warn!(
                    target: "session",
                    session = %session_id,
                    stall_seconds,
                    tier = tier.as_str(),
                    "stream soft stall — emitting keep-waiting prompt"
                );
                Self::emit_stream_stall(
                    app,
                    &session_id,
                    stall_seconds,
                    tier,
                    saw_model_output,
                    saw_tool_activity,
                );
            }
        }
    }
}

/// Fully idle: 90s heartbeat. Warm session or prewarm slot: 30s.
pub(super) fn idle_watchdog_sleep_secs(recycle: bool, prewarm: bool) -> u64 {
    if recycle || prewarm {
        30
    } else {
        90
    }
}

/// Idle host: 30s. Live stream / leftover session-API queue: 5s.
pub(super) fn stream_watchdog_sleep_secs(busy: bool, queue_maybe: bool) -> u64 {
    if busy || queue_maybe {
        5
    } else {
        30
    }
}

#[cfg(test)]
mod sleep_tests {
    use super::{
        idle_watchdog_sleep_secs, stream_watchdog_sleep_secs, PrewarmState, SessionManager,
    };
    use std::time::Instant;

    #[test]
    fn idle_sleep_is_slower() {
        assert_eq!(stream_watchdog_sleep_secs(false, false), 30);
        assert_eq!(stream_watchdog_sleep_secs(true, false), 5);
        assert_eq!(stream_watchdog_sleep_secs(false, true), 5);
        assert_eq!(stream_watchdog_sleep_secs(true, true), 5);
    }

    #[test]
    fn idle_watchdog_sleeps_longer_when_cold() {
        assert_eq!(idle_watchdog_sleep_secs(false, false), 90);
        assert_eq!(idle_watchdog_sleep_secs(true, false), 30);
        assert_eq!(idle_watchdog_sleep_secs(false, true), 30);
    }

    #[test]
    fn needs_prewarm_sweep_skips_empty_slot() {
        let mgr = SessionManager::new();
        assert!(!mgr.needs_prewarm_sweep());
        *mgr.prewarm.lock() = PrewarmState::Spawning {
            since: Instant::now(),
        };
        assert!(mgr.needs_prewarm_sweep());
        *mgr.prewarm.lock() = PrewarmState::None;
        assert!(!mgr.needs_prewarm_sweep());
    }
}
