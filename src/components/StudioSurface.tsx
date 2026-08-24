/**
 * Grok Studio chrome: empty mark + slogan, then Image/Video tools.
 * Image/Video is a sliding pill (CSS spring — no framer-motion).
 * Aspect / resolution / duration use the same solid menus as the rest of the app.
 */

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { createT, type Locale, type MessageKey } from "@/i18n";
import { GrokLogo } from "@/components/GrokLogo";
import {
  IconCheck,
  IconPhoto,
  IconQueue,
  IconSquare,
  IconVideo,
} from "@/components/icons";
import { useFloatingMenu } from "@/lib/floatingMenu";
import {
  STUDIO_ASPECTS,
  STUDIO_ASPECT_NAME_KEY,
  STUDIO_IMAGE_COUNTS,
  isStudioAspect,
  studioAspectBox,
  type StudioAspect,
  type StudioDuration,
  type StudioImageCount,
  type StudioKind,
  type StudioResolution,
} from "@/lib/studio";

const RESOLUTIONS: StudioResolution[] = ["480p", "720p", "1080p"];
const DURATIONS: StudioDuration[] = [6, 10, 15];

const RES_KEYS: Record<StudioResolution, MessageKey> = {
  "480p": "studio.res.480",
  "720p": "studio.res.720",
  "1080p": "studio.res.1080",
};

const DUR_KEYS: Record<StudioDuration, MessageKey> = {
  6: "studio.dur.6",
  10: "studio.dur.10",
  15: "studio.dur.15",
};

export function StudioStart({ locale }: { locale: Locale | string }) {
  const tr = useMemo(() => createT(locale as Locale), [locale]);
  return (
    <div className="studio-start">
      <GrokLogo size={56} />
      <h2 className="studio-start__slogan">{tr("studio.welcomeSlogan")}</h2>
    </div>
  );
}

export type StudioComposerToolsProps = {
  locale: Locale | string;
  kind: StudioKind;
  aspect: string;
  resolution: StudioResolution;
  duration: StudioDuration;
  count: StudioImageCount;
  onKind: (kind: StudioKind) => void;
  onAspect: (aspect: StudioAspect) => void;
  onResolution: (value: StudioResolution) => void;
  onDuration: (value: StudioDuration) => void;
  onCount: (value: StudioImageCount) => void;
};

type StudioMenu = "aspect" | "res" | "dur" | "count" | null;

export function StudioComposerTools({
  locale,
  kind,
  aspect,
  resolution,
  duration,
  count,
  onKind,
  onAspect,
  onResolution,
  onDuration,
  onCount,
}: StudioComposerToolsProps) {
  const tr = useMemo(() => createT(locale as Locale), [locale]);
  const [menu, setMenu] = useState<StudioMenu>(null);

  return (
    <div className="studio-tools">
      <StudioKindSeg
        kind={kind}
        imageLabel={tr("studio.image")}
        videoLabel={tr("studio.video")}
        groupLabel={tr("studio.kindGroup")}
        onKind={onKind}
      />
      <StudioListChip
        open={menu === "aspect"}
        onOpenChange={(open) => setMenu(open ? "aspect" : null)}
        label={aspect}
        ariaLabel={tr("studio.aspect", { ratio: aspect })}
        icon={<IconSquare size={12} />}
        wide
      >
        <StudioAspectPicker
          locale={locale}
          aspect={aspect}
          onAspect={(ratio) => {
            onAspect(ratio);
            setMenu(null);
          }}
        />
      </StudioListChip>
      {kind === "image" ? (
        <StudioListChip
          open={menu === "count"}
          onOpenChange={(open) => setMenu(open ? "count" : null)}
          label={String(count)}
          ariaLabel={tr("studio.count", { n: String(count) })}
          icon={<IconQueue size={12} />}
        >
          {STUDIO_IMAGE_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              role="menuitem"
              className={"studio-menu__opt" + (count === n ? " is-on" : "")}
              onClick={() => {
                onCount(n);
                setMenu(null);
              }}
            >
              <span>
                {n === 1
                  ? tr("studio.count.1")
                  : tr("studio.count.n", { n: String(n) })}
              </span>
              {count === n ? (
                <IconCheck className="studio-menu__check" size={14} />
              ) : null}
            </button>
          ))}
        </StudioListChip>
      ) : null}
      {kind === "video" ? (
        <>
          <StudioListChip
            open={menu === "res"}
            onOpenChange={(open) => setMenu(open ? "res" : null)}
            label={tr(RES_KEYS[resolution])}
            ariaLabel={tr("studio.resGroup")}
          >
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                type="button"
                role="menuitem"
                className={
                  "studio-menu__opt" + (resolution === r ? " is-on" : "")
                }
                onClick={() => {
                  onResolution(r);
                  setMenu(null);
                }}
              >
                <span>{tr(RES_KEYS[r])}</span>
                {resolution === r ? (
                  <IconCheck className="studio-menu__check" size={14} />
                ) : null}
              </button>
            ))}
          </StudioListChip>
          <StudioListChip
            open={menu === "dur"}
            onOpenChange={(open) => setMenu(open ? "dur" : null)}
            label={tr(DUR_KEYS[duration])}
            ariaLabel={tr("studio.durGroup")}
          >
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                role="menuitem"
                className={
                  "studio-menu__opt" + (duration === d ? " is-on" : "")
                }
                onClick={() => {
                  onDuration(d);
                  setMenu(null);
                }}
              >
                <span>{tr(DUR_KEYS[d])}</span>
                {duration === d ? (
                  <IconCheck className="studio-menu__check" size={14} />
                ) : null}
              </button>
            ))}
          </StudioListChip>
        </>
      ) : null}
    </div>
  );
}

function studioAspectNameKey(ratio: StudioAspect): MessageKey {
  return STUDIO_ASPECT_NAME_KEY[ratio] as MessageKey;
}

function StudioAspectPicker({
  locale,
  aspect,
  onAspect,
}: {
  locale: Locale | string;
  aspect: string;
  onAspect: (aspect: StudioAspect) => void;
}) {
  const tr = useMemo(() => createT(locale as Locale), [locale]);
  const selected = isStudioAspect(aspect) ? aspect : "2:3";

  return (
    <div className="studio-aspect">
      <div className="studio-aspect__preview" aria-hidden>
        {STUDIO_ASPECTS.map((ratio) => (
          <StudioAspectPreview
            key={ratio}
            ratio={ratio}
            caption={tr(studioAspectNameKey(ratio))}
            selected={ratio === selected}
          />
        ))}
      </div>
      <div className="studio-aspect__list" role="none">
        {STUDIO_ASPECTS.map((ratio) => {
          const name = tr(studioAspectNameKey(ratio));
          const on = selected === ratio;
          return (
            <button
              key={ratio}
              type="button"
              role="menuitem"
              data-ratio={ratio}
              className={"studio-menu__opt" + (on ? " is-on" : "")}
              onClick={() => onAspect(ratio)}
            >
              <span className="studio-menu__ratio">{ratio}</span>
              <span className="studio-menu__name">{name}</span>
              {on ? (
                <IconCheck className="studio-menu__check" size={14} />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StudioKindSeg({
  kind,
  imageLabel,
  videoLabel,
  groupLabel,
  onKind,
}: {
  kind: StudioKind;
  imageLabel: string;
  videoLabel: string;
  groupLabel: string;
  onKind: (kind: StudioKind) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLButtonElement>(null);
  const [thumb, setThumb] = useState({ x: 2, w: 0, ready: false });

  useLayoutEffect(() => {
    const track = trackRef.current;
    const imageBtn = imageRef.current;
    const videoBtn = videoRef.current;
    const btn = kind === "image" ? imageBtn : videoBtn;
    if (!track || !btn) return;

    const measure = () => {
      const next = kind === "image" ? imageRef.current : videoRef.current;
      if (!trackRef.current || !next) return;
      const tr = trackRef.current.getBoundingClientRect();
      const br = next.getBoundingClientRect();
      setThumb({ x: br.left - tr.left, w: br.width, ready: true });
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(track);
    ro.observe(btn);
    if (imageBtn && imageBtn !== btn) ro.observe(imageBtn);
    if (videoBtn && videoBtn !== btn) ro.observe(videoBtn);
    return () => ro.disconnect();
  }, [kind, imageLabel, videoLabel]);

  return (
    <div
      ref={trackRef}
      className="studio-seg"
      role="group"
      aria-label={groupLabel}
    >
      <span
        className={"studio-seg__thumb" + (thumb.ready ? " is-ready" : "")}
        aria-hidden
        style={{
          transform: `translateX(${thumb.x}px)`,
          width: thumb.w ? `${thumb.w}px` : undefined,
        }}
      />
      <button
        ref={imageRef}
        type="button"
        className={"studio-seg__btn" + (kind === "image" ? " is-on" : "")}
        aria-pressed={kind === "image"}
        onClick={() => onKind("image")}
      >
        <IconPhoto size={14} />
        <span>{imageLabel}</span>
      </button>
      <button
        ref={videoRef}
        type="button"
        className={"studio-seg__btn" + (kind === "video" ? " is-on" : "")}
        aria-pressed={kind === "video"}
        onClick={() => onKind("video")}
      >
        <IconVideo size={14} />
        <span>{videoLabel}</span>
      </button>
    </div>
  );
}

function StudioListChip({
  open,
  onOpenChange,
  label,
  ariaLabel,
  icon,
  wide,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  ariaLabel: string;
  icon?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const { pos, style } = useFloatingMenu({
    open,
    triggerRef,
    panelRef: popRef,
    roots: [rootRef],
    onClose: () => onOpenChange(false),
    placement: "up",
    align: "start",
    fitContent: true,
    minWidth: wide ? 280 : 140,
    estHeight: wide ? 280 : 180,
    gap: 8,
  });

  return (
    <div ref={rootRef} className="studio-chip">
      <button
        ref={triggerRef}
        type="button"
        className={"studio__pill" + (open ? " is-on" : "")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => onOpenChange(!open)}
      >
        {icon}
        <span>{label}</span>
      </button>
      {open && pos
        ? createPortal(
            <div
              ref={popRef}
              className="menu-panel context-menu studio-menu"
              role="menu"
              style={style as CSSProperties}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function StudioAspectPreview({
  ratio,
  caption,
  selected,
}: {
  ratio: string;
  caption: string;
  selected: boolean;
}) {
  const { w, h } = studioAspectBox(ratio);
  const max = 88;
  const scale = max / Math.max(w, h);
  return (
    <div
      className={
        "studio-aspect__pane" + (selected ? " is-selected" : "")
      }
      data-preview={ratio}
    >
      <div className="studio-aspect__stage">
        <span
          className="studio-aspect__frame"
          style={{ width: w * scale, height: h * scale }}
        />
      </div>
      <span className="studio-aspect__caption">{caption}</span>
    </div>
  );
}
