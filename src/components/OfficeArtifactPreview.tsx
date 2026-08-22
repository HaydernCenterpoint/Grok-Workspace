/**
 * Preview + export for `*.office.json` (paper / sheet / deck IR).
 */

import { useMemo, useState } from "react";
import { createT, type Locale } from "@/i18n";
import {
  exportFormatsFor,
  exportOfficeDoc,
  parseOfficeDoc,
  type OfficeDoc,
  type OfficeExportFormat,
  type OfficeKind,
} from "@/lib/officeDoc";

export type OfficeArtifactPreviewProps = {
  text: string;
  name: string;
  locale: Locale;
  projectPath?: string | null;
  relativePath?: string | null;
};

const KIND_KEY = {
  paper: "office.doc.kind.paper",
  sheet: "office.doc.kind.sheet",
  deck: "office.doc.kind.deck",
} as const;

const FORMAT_KEY: Record<OfficeExportFormat, "office.doc.exportMd" | "office.doc.exportCsv" | "office.doc.exportDocx" | "office.doc.exportXlsx" | "office.doc.exportPptx"> = {
  md: "office.doc.exportMd",
  csv: "office.doc.exportCsv",
  docx: "office.doc.exportDocx",
  xlsx: "office.doc.exportXlsx",
  pptx: "office.doc.exportPptx",
};

function kindLabelKey(kind: OfficeKind): (typeof KIND_KEY)[OfficeKind] {
  return KIND_KEY[kind];
}

export function OfficeArtifactPreview({
  text,
  name,
  locale,
  projectPath = null,
  relativePath = null,
}: OfficeArtifactPreviewProps) {
  const tr = useMemo(() => createT(locale), [locale]);
  const parsed = useMemo(() => parseOfficeDoc(text), [text]);
  const [busy, setBusy] = useState<OfficeExportFormat | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function onExport(format: OfficeExportFormat, doc: OfficeDoc) {
    const root = (projectPath ?? "").trim();
    const rel = (relativePath ?? "").trim();
    if (!root || !rel) {
      setNote(tr("office.doc.exportFail", { name }));
      return;
    }
    setBusy(format);
    setNote(null);
    try {
      const out = await exportOfficeDoc({
        projectPath: root,
        sourceRelative: rel,
        doc,
        format,
      });
      const saved = out.relativePath.split("/").pop() ?? out.relativePath;
      setNote(tr("office.doc.exportOk", { name: saved }));
    } catch (e) {
      setNote(tr("office.doc.exportFail", { name: String(e ?? name) }));
    } finally {
      setBusy(null);
    }
  }

  if (!parsed.ok) {
    return (
      <div className="office-artifact">
        <p className="office-artifact__err">{tr("office.doc.invalid")}</p>
        <pre className="office-artifact__raw">{text.slice(0, 800)}</pre>
      </div>
    );
  }

  const doc = parsed.doc;
  const formats = exportFormatsFor(doc.kind);

  return (
    <div className="office-artifact" data-kind={doc.kind}>
      <header className="office-artifact__head">
        <p className="office-artifact__kind">{tr(kindLabelKey(doc.kind))}</p>
        <h2 className="office-artifact__title">{doc.title}</h2>
        {doc.subtitle ? (
          <p className="office-artifact__sub">{doc.subtitle}</p>
        ) : null}
        {projectPath && relativePath ? (
          <div className="office-artifact__actions">
            {formats.map((fmt) => (
              <button
                key={fmt}
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={busy != null}
                onClick={() => void onExport(fmt, doc)}
              >
                {busy === fmt ? tr("resources.saving") : tr(FORMAT_KEY[fmt])}
              </button>
            ))}
          </div>
        ) : null}
        {note ? (
          <p className="office-artifact__note" role="status">
            {note}
          </p>
        ) : null}
      </header>
      {doc.kind === "paper" ? <PaperBody doc={doc} /> : null}
      {doc.kind === "sheet" ? <SheetBody doc={doc} /> : null}
      {doc.kind === "deck" ? <DeckBody doc={doc} tr={tr} /> : null}
    </div>
  );
}

function PaperBody({ doc }: { doc: OfficeDoc }) {
  return (
    <article className="office-artifact__paper">
      {(doc.blocks ?? []).map((block, i) => {
        switch (block.type) {
          case "h":
            if (block.level === 1) return <h2 key={i}>{block.text}</h2>;
            if (block.level === 2) return <h3 key={i}>{block.text}</h3>;
            return <h4 key={i}>{block.text}</h4>;
          case "p":
            return <p key={i}>{block.text}</p>;
          case "ul":
            return (
              <ul key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ol>
            );
          case "table":
            return <MiniTable key={i} headers={block.headers} rows={block.rows} />;
          case "callout":
            return (
              <blockquote key={i} className="office-artifact__callout">
                {block.text}
              </blockquote>
            );
          case "hr":
            return <hr key={i} />;
          default: {
            const _never: never = block;
            return <span key={i}>{String(_never)}</span>;
          }
        }
      })}
    </article>
  );
}

function SheetBody({ doc }: { doc: OfficeDoc }) {
  return (
    <div className="office-artifact__sheets">
      {(doc.sheets ?? []).map((sheet) => (
        <section key={sheet.name} className="office-artifact__sheet">
          <h3>{sheet.name}</h3>
          <MiniTable
            headers={sheet.columns.map((c) => c.label)}
            rows={sheet.rows.map((row) =>
              sheet.columns.map((c) =>
                row[c.key] == null ? "" : String(row[c.key]),
              ),
            )}
          />
        </section>
      ))}
    </div>
  );
}

function DeckBody({
  doc,
  tr,
}: {
  doc: OfficeDoc;
  tr: (key: "office.doc.slideN", vars?: { n: string }) => string;
}) {
  return (
    <ol className="office-artifact__deck">
      {(doc.slides ?? []).map((slide, i) => (
        <li key={i} className="office-artifact__slide">
          <p className="office-artifact__slide-k">
            {tr("office.doc.slideN", { n: String(i + 1) })}
          </p>
          <h3>{slide.title}</h3>
          {slide.bullets?.length ? (
            <ul>
              {slide.bullets.map((b, j) => (
                <li key={j}>{b}</li>
              ))}
            </ul>
          ) : null}
          {slide.left?.length || slide.right?.length ? (
            <div className="office-artifact__cols">
              <ul>
                {(slide.left ?? []).map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
              <ul>
                {(slide.right ?? []).map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {slide.table ? (
            <MiniTable headers={slide.table.headers} rows={slide.table.rows} />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function MiniTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  const cols = headers.length ? headers : ["—"];
  return (
    <div className="office-artifact__table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((_, j) => (
                <td key={j}>{row[j] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
