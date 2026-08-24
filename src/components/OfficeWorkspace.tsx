/**
 * Grok Office main column: document canvas above, command chat below.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as api from "@/lib/api";
import { startVisibleInterval } from "@/lib/visibleInterval";
import { createT, type Locale } from "@/i18n";
import { OfficeStart } from "@/components/OfficeStart";
import { OfficeArtifactPreview } from "@/components/OfficeArtifactPreview";
import { OfficeDocumentPreview } from "@/components/OfficeDocumentPreview";
import {
  blankOfficeDoc,
  findOfficeDocs,
  nextOfficeRel,
  officeStartToKind,
  pickLatestOfficeHit,
  serializeOfficeDoc,
} from "@/lib/officeCanvas";
import { isOfficeDocPath, parseOfficeDoc } from "@/lib/officeDoc";
import {
  isOfficePath,
  resolveOfficeWorkspaceLayout,
  type OfficeStartKind,
} from "@/lib/grokOffice";

export type OfficeWorkspaceProps = {
  locale: Locale;
  projectPath: string | null;
  projectName?: string | null;
  focusPath?: string | null;
  /** Build / Studio pass false — children only. */
  enabled?: boolean;
  /** Hide the command transcript so the start canvas can fill the stage. */
  showChat?: boolean;
  onStart: (kind: OfficeStartKind) => void;
  onOpenFile?: (path: string, name: string) => void;
  children: ReactNode;
};

type CanvasDoc = {
  relativePath: string;
  absolutePath: string;
  name: string;
  text: string;
  kind: string;
  mtimeMs: number;
};

export function OfficeWorkspace({
  enabled = true,
  ...props
}: OfficeWorkspaceProps) {
  if (!enabled) return props.children;
  return <OfficeWorkspaceActive {...props} />;
}

function OfficeWorkspaceActive({
  locale,
  projectPath,
  projectName = null,
  focusPath = null,
  showChat = true,
  onStart,
  onOpenFile,
  children,
}: OfficeWorkspaceProps) {
  const [hasDocument, setHasDocument] = useState(false);
  const layout = resolveOfficeWorkspaceLayout({ showChat, hasDocument });

  return (
    <div
      className={
        "office-workspace" +
        (layout === "start" ? " office-workspace--start" : "") +
        (layout === "chat-only" ? " office-workspace--chat-only" : "")
      }
      data-layout={layout}
      data-testid="office-workspace"
    >
      <div className="office-workspace__canvas">
        <OfficeCanvas
          locale={locale}
          projectPath={projectPath}
          projectName={projectName}
          focusPath={focusPath}
          showLanding={layout === "start"}
          onHasDocument={setHasDocument}
          onStart={onStart}
          onOpenFile={onOpenFile}
        />
      </div>
      {showChat ? (
        <div className="office-workspace__chat">{children}</div>
      ) : null}
    </div>
  );
}

type OfficeCanvasProps = Omit<
  OfficeWorkspaceProps,
  "children" | "enabled" | "showChat"
> & {
  showLanding: boolean;
  onHasDocument: (hasDocument: boolean) => void;
};

function OfficeCanvas({
  locale,
  projectPath,
  projectName,
  focusPath,
  showLanding,
  onHasDocument,
  onStart,
  onOpenFile,
}: OfficeCanvasProps) {
  const tr = useMemo(() => createT(locale), [locale]);
  const [doc, setDoc] = useState<CanvasDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const mtimeRef = useRef(0);
  const docRef = useRef<CanvasDoc | null>(null);
  docRef.current = doc;

  const loadPath = useCallback(
    async (path: string) => {
      if (!projectPath && !path) return;
      try {
        const read = await api.fsOpenPath(path, projectPath);
        if (read.error) {
          setError(read.error);
          return;
        }
        mtimeRef.current = read.mtimeMs ?? 0;
        setError(null);
        setDoc({
          relativePath: read.relativePath,
          absolutePath: read.absolutePath,
          name: read.name,
          text: read.text ?? "",
          kind: read.kind,
          mtimeMs: read.mtimeMs ?? 0,
        });
      } catch (e) {
        setError(String(e));
      }
    },
    [projectPath],
  );

  const refresh = useCallback(async () => {
    if (focusPath) {
      await loadPath(focusPath);
      return;
    }
    if (!projectPath) {
      setDoc(null);
      return;
    }
    const hits = await findOfficeDocs(projectPath);
    const latest = pickLatestOfficeHit(hits);
    if (!latest) {
      setDoc(null);
      return;
    }
    const current = docRef.current;
    if (
      current &&
      current.relativePath === latest.relativePath &&
      latest.mtimeMs <= mtimeRef.current
    ) {
      return;
    }
    await loadPath(latest.relativePath);
  }, [focusPath, loadPath, projectPath]);

  useEffect(() => {
    void refresh();
  }, [focusPath, projectPath]); // eslint-disable-line react-hooks/exhaustive-deps -- load on bind/focus only

  useEffect(() => {
    if (!projectPath) return;
    return startVisibleInterval(() => {
      void refresh();
    }, 2500);
  }, [projectPath, refresh]);

  useEffect(() => {
    onHasDocument(!!doc);
  }, [doc, onHasDocument]);

  const persist = useCallback(
    (text: string) => {
      if (!projectPath || !doc?.relativePath) return;
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        void api
          .fsWriteFile(projectPath, doc.relativePath, text, mtimeRef.current)
          .then((out) => {
            mtimeRef.current = out.mtimeMs;
            setDoc((prev) =>
              prev ? { ...prev, text, mtimeMs: out.mtimeMs } : prev,
            );
          })
          .catch((e) => setError(String(e)));
      }, 400);
    },
    [doc?.relativePath, projectPath],
  );

  const createAndOpen = useCallback(
    async (kind: OfficeStartKind) => {
      onStart(kind);
      if (!projectPath) return;
      const irKind = officeStartToKind(kind);
      const title =
        irKind === "paper"
          ? tr("office.canvas.blankPaper")
          : irKind === "sheet"
            ? tr("office.canvas.blankSheet")
            : tr("office.canvas.blankDeck");
      const hits = await findOfficeDocs(projectPath);
      const rel = nextOfficeRel(
        irKind,
        hits.map((h) => h.relativePath),
      );
      const text = serializeOfficeDoc(blankOfficeDoc(irKind, title));
      const written = await api.fsWriteFile(projectPath, rel, text);
      mtimeRef.current = written.mtimeMs;
      setDoc({
        relativePath: written.relativePath,
        absolutePath: written.absolutePath,
        name: written.relativePath.split("/").pop() ?? rel,
        text,
        kind: "json",
        mtimeMs: written.mtimeMs,
      });
      onOpenFile?.(written.absolutePath, written.relativePath.split("/").pop() ?? rel);
    },
    [onOpenFile, onStart, projectPath, tr],
  );

  const parsed = doc && isOfficeDocPath(doc.name || doc.relativePath)
    ? parseOfficeDoc(doc.text)
    : null;
  const binaryOffice =
    doc &&
    !isOfficeDocPath(doc.name || doc.relativePath) &&
    isOfficePath(doc.absolutePath || doc.name);

  return (
    <div
      className="office-canvas"
      data-testid="office-canvas"
      data-surface={doc ? "doc" : showLanding ? "landing" : "empty"}
    >
      {!doc && showLanding ? (
        <OfficeStart
          locale={locale}
          projectName={projectName}
          onStart={(kind) => void createAndOpen(kind)}
        />
      ) : !doc ? null : parsed ? (
        <OfficeArtifactPreview
          text={doc.text}
          name={doc.name}
          locale={locale}
          projectPath={projectPath}
          relativePath={doc.relativePath}
          onDocChange={(next) => {
            const text = serializeOfficeDoc(next);
            setDoc((prev) => (prev ? { ...prev, text } : prev));
            persist(text);
          }}
        />
      ) : binaryOffice ? (
        <OfficeDocumentPreview
          kind={doc.kind}
          absolutePath={doc.absolutePath}
          name={doc.name}
          locale={locale}
          textFallback={doc.text || null}
          errorFromHost={error}
        />
      ) : (
        <p className="office-canvas__empty">{tr("office.canvas.empty")}</p>
      )}
      {error ? (
        <p className="office-artifact__err" role="status">
          {error}
        </p>
      ) : null}
    </div>
  );
}
