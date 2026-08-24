/**
 * First-run appearance step — ChatGPT-style theme / type / size before home.
 * Applies live through ThemeProvider + existing localStorage prefs.
 * Does not invent hex theme tokens; skins stay the accent palette.
 */
import { useMemo, useState } from "react";
import type { createT } from "@/i18n";
import { Select } from "@/components/Select";
import {
  CHAT_FONT_SCALES,
  chatFontScaleVars,
  loadChatFontScale,
  setChatFontScale,
  type ChatFontScale,
} from "@/lib/chatFontScale";
import {
  CODE_FONT_SCALES,
  codeFontScaleVars,
  loadCodeFontScale,
  setCodeFontScale,
  type CodeFontScale,
} from "@/lib/codeFontScalePref";
import { THEME_SKINS, type ThemeSkinId } from "@/lib/themeSkin";
import type { ThemePreference } from "@/lib/theme";
import {
  applyUiFontFamily,
  loadUiFontFamily,
  saveUiFontFamily,
} from "@/lib/uiFontPref";
import { resolveUiSansFamily, UI_SANS_STACK } from "@/lib/uiFontStack";
import { useThemeShell } from "@/providers/ThemeProvider";

type Tr = ReturnType<typeof createT>;

export const SETUP_UI_FONT_FAMILIES = [
  "Segoe UI",
  "system-ui",
  "Georgia",
  "Times New Roman",
  "Arial",
  "Verdana",
] as const;

export function setupUiFontOptions(
  current: string,
  systemLabel: string,
): { value: string; label: string }[] {
  const trimmed = current.trim();
  const extras =
    trimmed &&
    !SETUP_UI_FONT_FAMILIES.some(
      (family) => family.toLowerCase() === trimmed.toLowerCase(),
    )
      ? [trimmed]
      : [];
  return [
    { value: "", label: systemLabel },
    ...extras.map((family) => ({ value: family, label: family })),
    ...SETUP_UI_FONT_FAMILIES.map((family) => ({
      value: family,
      label: family,
    })),
  ];
}

const THEME_CHOICES: readonly ThemePreference[] = [
  "light",
  "dark",
  "system",
];

type Props = {
  tr: Tr;
  onContinue: () => void;
};

export function SetupAppearance({ tr, onContinue }: Props) {
  const { themePreference, applyThemeChoice, skin, applySkinChoice } =
    useThemeShell();
  const [uiFont, setUiFont] = useState(() => loadUiFontFamily());
  const [chatScale, setChatScale] = useState<ChatFontScale>(() =>
    loadChatFontScale(),
  );
  const [codeScale, setCodeScale] = useState<CodeFontScale>(() =>
    loadCodeFontScale(),
  );

  const fontOptions = useMemo(
    () => setupUiFontOptions(uiFont, tr("setup.appearance.uiFontSystem")),
    [tr, uiFont],
  );

  const chatPreview = chatFontScaleVars(chatScale);
  const codePreview = codeFontScaleVars(codeScale);
  const previewFont = uiFont.trim()
    ? `${JSON.stringify(resolveUiSansFamily(uiFont) || uiFont)}, ${UI_SANS_STACK}`
    : undefined;

  const pickTheme = (next: ThemePreference) => {
    applyThemeChoice(next);
  };

  const pickSkin = (next: ThemeSkinId) => {
    applySkinChoice(next, { applyPreferredTheme: false });
  };

  const pickUiFont = (next: string) => {
    setUiFont(next);
    saveUiFontFamily(next);
    applyUiFontFamily(next);
  };

  const pickChatScale = (next: ChatFontScale) => {
    setChatScale(next);
    setChatFontScale(next);
  };

  const pickCodeScale = (next: CodeFontScale) => {
    setCodeScale(next);
    setCodeFontScale(next);
  };

  return (
    <div className="setup-look" data-testid="setup-appearance">
      <div
        className="setup-look-themes"
        role="radiogroup"
        aria-label={tr("settings.theme")}
      >
        {THEME_CHOICES.map((choice) => {
          const on = themePreference === choice;
          const label =
            choice === "light"
              ? tr("settings.themeLight")
              : choice === "dark"
                ? tr("settings.themeDark")
                : tr("settings.themeSystem");
          return (
            <button
              key={choice}
              type="button"
              role="radio"
              aria-checked={on}
              className={"setup-look-theme" + (on ? " is-on" : "")}
              onClick={() => pickTheme(choice)}
            >
              <span
                className="setup-look-theme__stage"
                data-theme-preview={choice}
                aria-hidden
              >
                {choice === "system" ? (
                  <>
                    <span className="setup-look-theme__half is-light">
                      <span className="setup-look-theme__rail" />
                      <span className="setup-look-theme__pane">
                        <span className="setup-look-theme__line" />
                        <span className="setup-look-theme__line is-short" />
                      </span>
                    </span>
                    <span className="setup-look-theme__half is-dark">
                      <span className="setup-look-theme__rail" />
                      <span className="setup-look-theme__pane">
                        <span className="setup-look-theme__line" />
                        <span className="setup-look-theme__line is-short" />
                      </span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="setup-look-theme__rail" />
                    <span className="setup-look-theme__pane">
                      <span className="setup-look-theme__line" />
                      <span className="setup-look-theme__line is-short" />
                    </span>
                  </>
                )}
              </span>
              <span className="setup-look-theme__label">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="setup-look-card">
        <div className="setup-look-row">
          <span className="setup-look-row__label">
            {tr("setup.appearance.accent")}
          </span>
          <div
            className="setup-look-swatches"
            role="listbox"
            aria-label={tr("setup.appearance.accent")}
          >
            {THEME_SKINS.map((pack) => {
              const selected = skin === pack.id;
              const name = tr(
                `settings.skin.${pack.id}` as "settings.skin.default",
              );
              return (
                <button
                  key={pack.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={name}
                  title={name}
                  className={
                    "setup-look-swatch" + (selected ? " is-on" : "")
                  }
                  onClick={() => pickSkin(pack.id)}
                >
                  <span
                    className="setup-look-swatch__fill"
                    style={{
                      background: `linear-gradient(135deg, ${pack.swatch} 0%, ${pack.swatchAlt} 100%)`,
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        <div className="setup-look-row">
          <span className="setup-look-row__label">{tr("settings.uiFont")}</span>
          <div className="setup-look-row__control">
            <Select
              value={uiFont}
              onChange={pickUiFont}
              options={fontOptions}
              aria-label={tr("settings.uiFont")}
            />
          </div>
        </div>

        <div className="setup-look-row">
          <span className="setup-look-row__label">
            {tr("settings.chatFontScale")}
          </span>
          <div
            className="setup-look-seg"
            role="radiogroup"
            aria-label={tr("settings.chatFontScale")}
          >
            {CHAT_FONT_SCALES.map((scale) => (
              <button
                key={scale}
                type="button"
                role="radio"
                aria-checked={chatScale === scale}
                className={
                  "setup-look-seg__btn" + (chatScale === scale ? " is-on" : "")
                }
                onClick={() => pickChatScale(scale)}
              >
                {tr(`settings.chatFontScale.${scale}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="setup-look-row">
          <span className="setup-look-row__label">
            {tr("settings.codeFontScale")}
          </span>
          <div
            className="setup-look-seg"
            role="radiogroup"
            aria-label={tr("settings.codeFontScale")}
          >
            {CODE_FONT_SCALES.map((scale) => (
              <button
                key={scale}
                type="button"
                role="radio"
                aria-checked={codeScale === scale}
                className={
                  "setup-look-seg__btn" + (codeScale === scale ? " is-on" : "")
                }
                onClick={() => pickCodeScale(scale)}
              >
                {tr(`settings.codeFontScale.${scale}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="setup-look-preview">
          <span className="setup-look-preview__kicker">
            {tr("setup.appearance.preview")}
          </span>
          <p
            className="setup-look-preview__body"
            style={{
              fontSize: `${chatPreview.fs}px`,
              fontFamily: previewFont,
            }}
          >
            {tr("setup.appearance.previewBody")}
          </p>
          <code
            className="setup-look-preview__code"
            style={{ fontSize: `${codePreview.fs}px` }}
          >
            {tr("setup.appearance.previewCode")}
          </code>
        </div>
      </div>

      <button
        type="button"
        className="btn btn--primary setup-btn-primary"
        onClick={onContinue}
      >
        {tr("setup.continue")}
      </button>
    </div>
  );
}
