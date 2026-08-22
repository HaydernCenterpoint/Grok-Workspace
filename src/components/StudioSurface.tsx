/**
 * Grok Studio chrome on the normal chat: empty headline + Imagine pills.
 * Transcript / thinking stay in ConversationThread.
 */

import { useMemo } from "react";
import { createT, type Locale } from "@/i18n";
import { IconImagine, IconVideo } from "@/components/icons";
import type {
  StudioDuration,
  StudioKind,
  StudioResolution,
} from "@/lib/studio";

const RESOLUTIONS: StudioResolution[] = ["480p", "720p", "1080p"];
const DURATIONS: StudioDuration[] = [6, 10, 15];

export function StudioStart({
  locale,
  kind,
}: {
  locale: Locale | string;
  kind: StudioKind;
}) {
  const tr = useMemo(() => createT(locale as Locale), [locale]);
  return (
    <div className="studio-start">
      <h2 className="studio-start__title">
        {tr(kind === "video" ? "studio.headline.video" : "studio.headline.image")}
      </h2>
    </div>
  );
}

export type StudioComposerToolsProps = {
  locale: Locale | string;
  kind: StudioKind;
  aspect: string;
  resolution: StudioResolution;
  duration: StudioDuration;
  onKind: (kind: StudioKind) => void;
  onCycleAspect: () => void;
  onResolution: (value: StudioResolution) => void;
  onDuration: (value: StudioDuration) => void;
};

export function StudioComposerTools({
  locale,
  kind,
  aspect,
  resolution,
  duration,
  onKind,
  onCycleAspect,
  onResolution,
  onDuration,
}: StudioComposerToolsProps) {
  const tr = useMemo(() => createT(locale as Locale), [locale]);
  return (
    <div className="studio-tools">
      <span
        className="studio__pill is-on is-locked"
        aria-label={tr("studio.modelHint")}
      >
        <IconImagine size={16} />
        <span>{tr("studio.model")}</span>
      </span>
      <div className="studio__pills" role="group" aria-label={tr("studio.image")}>
        <button
          type="button"
          className={"studio__pill" + (kind === "image" ? " is-on" : "")}
          aria-pressed={kind === "image"}
          onClick={() => onKind("image")}
        >
          <IconImagine size={16} />
          <span>{tr("studio.image")}</span>
        </button>
        <button
          type="button"
          className={"studio__pill" + (kind === "video" ? " is-on" : "")}
          aria-pressed={kind === "video"}
          onClick={() => onKind("video")}
        >
          <IconVideo size={16} />
          <span>{tr("studio.video")}</span>
        </button>
      </div>
      {kind === "video" ? (
        <>
          <div className="studio__pills">
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                type="button"
                className={"studio__pill" + (resolution === r ? " is-on" : "")}
                aria-pressed={resolution === r}
                onClick={() => onResolution(r)}
              >
                {tr(
                  r === "480p"
                    ? "studio.res.480"
                    : r === "720p"
                      ? "studio.res.720"
                      : "studio.res.1080",
                )}
              </button>
            ))}
          </div>
          <div className="studio__pills">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                className={"studio__pill" + (duration === d ? " is-on" : "")}
                aria-pressed={duration === d}
                onClick={() => onDuration(d)}
              >
                {tr(
                  d === 6
                    ? "studio.dur.6"
                    : d === 10
                      ? "studio.dur.10"
                      : "studio.dur.15",
                )}
              </button>
            ))}
          </div>
        </>
      ) : null}
      <button
        type="button"
        className="studio__pill"
        onClick={onCycleAspect}
        title={tr("studio.aspect", { ratio: aspect })}
        aria-label={tr("studio.aspect", { ratio: aspect })}
      >
        {aspect}
      </button>
    </div>
  );
}
