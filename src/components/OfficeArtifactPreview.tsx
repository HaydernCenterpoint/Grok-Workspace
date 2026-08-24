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
  /** When set, the canvas writes back into the IR. */
  onDocChange?: (doc: OfficeDoc) => void;
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
  onDocChange,
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
        <EditableText
          tag="h2"
          className="office-artifact__title"
          value={doc.title}
          edit={!!onDocChange}
          onChange={(title) => onDocChange?.({ ...doc, title })}
        />
        {doc.subtitle || onDocChange ? (
          <EditableText
            tag="p"
            className="office-artifact__sub"
            value={doc.subtitle ?? ""}
            edit={!!onDocChange}
            onChange={(subtitle) =>
              onDocChange?.({
                ...doc,
                subtitle: subtitle.trim() ? subtitle : undefined,
              })
            }
          />
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
      {doc.kind === "paper" ? (
        <PaperBody doc={doc} onDocChange={onDocChange} />
      ) : null}
      {doc.kind === "sheet" ? (
        <SheetBody doc={doc} onDocChange={onDocChange} />
      ) : null}
      {doc.kind === "deck" ? (
        <DeckBody doc={doc} tr={tr} onDocChange={onDocChange} />
      ) : null}
    </div>
  );
}

function patchBlock(
  doc: OfficeDoc,
  index: number,
  block: NonNullable<OfficeDoc["blocks"]>[number],
): OfficeDoc {
  const blocks = [...(doc.blocks ?? [])];
  blocks[index] = block;
  return { ...doc, blocks };
}

function PaperBody({
  doc,
  onDocChange,
}: {
  doc: OfficeDoc;
  onDocChange?: (doc: OfficeDoc) => void;
}) {
  const edit = !!onDocChange;
  return (
    <article className="office-artifact__paper">
      {(doc.blocks ?? []).map((block, i) => {
        switch (block.type) {
          case "h": {
            const Tag = block.level === 1 ? "h2" : block.level === 2 ? "h3" : "h4";
            return (
              <EditableText
                key={i}
                tag={Tag}
                value={block.text}
                edit={edit}
                onChange={(text) =>
                  onDocChange?.(patchBlock(doc, i, { ...block, text }))
                }
              />
            );
          }
          case "p":
            return (
              <EditableText
                key={i}
                tag="p"
                value={block.text}
                edit={edit}
                onChange={(text) =>
                  onDocChange?.(patchBlock(doc, i, { ...block, text }))
                }
              />
            );
          case "ul":
          case "ol":
            return (
              <ListEdit
                key={i}
                tag={block.type}
                items={block.items}
                edit={edit}
                onChange={(items) =>
                  onDocChange?.(patchBlock(doc, i, { ...block, items }))
                }
              />
            );
          case "table":
            return (
              <MiniTable
                key={i}
                headers={block.headers}
                rows={block.rows}
                edit={edit}
                onChange={(headers, rows) =>
                  onDocChange?.(patchBlock(doc, i, { ...block, headers, rows }))
                }
              />
            );
          case "callout":
            return (
              <EditableText
                key={i}
                tag="blockquote"
                className="office-artifact__callout"
                value={block.text}
                edit={edit}
                onChange={(text) =>
                  onDocChange?.(patchBlock(doc, i, { ...block, text }))
                }
              />
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

function SheetBody({
  doc,
  onDocChange,
}: {
  doc: OfficeDoc;
  onDocChange?: (doc: OfficeDoc) => void;
}) {
  return (
    <div className="office-artifact__sheets">
      {(doc.sheets ?? []).map((sheet, si) => (
        <section key={`${sheet.name}-${si}`} className="office-artifact__sheet">
          <EditableText
            tag="h3"
            value={sheet.name}
            edit={!!onDocChange}
            onChange={(name) => {
              const sheets = [...(doc.sheets ?? [])];
              sheets[si] = { ...sheet, name };
              onDocChange?.({ ...doc, sheets });
            }}
          />
          <MiniTable
            headers={sheet.columns.map((c) => c.label)}
            rows={sheet.rows.map((row) =>
              sheet.columns.map((c) =>
                row[c.key] == null ? "" : String(row[c.key]),
              ),
            )}
            edit={!!onDocChange}
            onChange={(headers, rows) => {
              const columns = sheet.columns.map((c, i) => ({
                ...c,
                label: headers[i] ?? c.label,
              }));
              const nextRows = rows.map((row) => {
                const rec: Record<string, string> = {};
                columns.forEach((c, i) => {
                  rec[c.key] = row[i] ?? "";
                });
                return rec;
              });
              const sheets = [...(doc.sheets ?? [])];
              sheets[si] = { ...sheet, columns, rows: nextRows };
              onDocChange?.({ ...doc, sheets });
            }}
          />
        </section>
      ))}
    </div>
  );
}

function DeckBody({
  doc,
  tr,
  onDocChange,
}: {
  doc: OfficeDoc;
  tr: (key: "office.doc.slideN", vars?: { n: string }) => string;
  onDocChange?: (doc: OfficeDoc) => void;
}) {
  const edit = !!onDocChange;
  return (
    <ol className="office-artifact__deck">
      {(doc.slides ?? []).map((slide, i) => (
        <li key={i} className="office-artifact__slide">
          <p className="office-artifact__slide-k">
            {tr("office.doc.slideN", { n: String(i + 1) })}
          </p>
          <EditableText
            tag="h3"
            value={slide.title}
            edit={edit}
            onChange={(title) => {
              const slides = [...(doc.slides ?? [])];
              slides[i] = { ...slide, title };
              onDocChange?.({ ...doc, slides });
            }}
          />
          {slide.bullets?.length || edit ? (
            <ListEdit
              tag="ul"
              items={slide.bullets ?? []}
              edit={edit}
              onChange={(bullets) => {
                const slides = [...(doc.slides ?? [])];
                slides[i] = { ...slide, bullets };
                onDocChange?.({ ...doc, slides });
              }}
            />
          ) : null}
          {slide.left?.length || slide.right?.length ? (
            <div className="office-artifact__cols">
              <ListEdit
                tag="ul"
                items={slide.left ?? []}
                edit={edit}
                onChange={(left) => {
                  const slides = [...(doc.slides ?? [])];
                  slides[i] = { ...slide, left };
                  onDocChange?.({ ...doc, slides });
                }}
              />
              <ListEdit
                tag="ul"
                items={slide.right ?? []}
                edit={edit}
                onChange={(right) => {
                  const slides = [...(doc.slides ?? [])];
                  slides[i] = { ...slide, right };
                  onDocChange?.({ ...doc, slides });
                }}
              />
            </div>
          ) : null}
          {slide.table ? (
            <MiniTable
              headers={slide.table.headers}
              rows={slide.table.rows}
              edit={edit}
              onChange={(headers, rows) => {
                const slides = [...(doc.slides ?? [])];
                slides[i] = { ...slide, table: { headers, rows } };
                onDocChange?.({ ...doc, slides });
              }}
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function MiniTable({
  headers,
  rows,
  edit = false,
  onChange,
}: {
  headers: string[];
  rows: string[][];
  edit?: boolean;
  onChange?: (headers: string[], rows: string[][]) => void;
}) {
  const cols = headers.length ? headers : ["—"];
  return (
    <div className="office-artifact__table-wrap">
      <table>
        <thead>
          <tr>
            {cols.map((h, j) => (
              <th key={j}>
                {edit ? (
                  <input
                    className="office-artifact__cell"
                    value={h}
                    onChange={(e) => {
                      const next = [...cols];
                      next[j] = e.target.value;
                      onChange?.(next, rows);
                    }}
                  />
                ) : (
                  h
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((_, j) => (
                <td key={j}>
                  {edit ? (
                    <input
                      className="office-artifact__cell"
                      value={row[j] ?? ""}
                      onChange={(e) => {
                        const next = rows.map((r) => [...r]);
                        next[i] = next[i] ?? [];
                        next[i][j] = e.target.value;
                        onChange?.(cols, next);
                      }}
                    />
                  ) : (
                    row[j] ?? ""
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListEdit({
  tag: Tag,
  items,
  edit,
  onChange,
}: {
  tag: "ul" | "ol";
  items: string[];
  edit: boolean;
  onChange: (items: string[]) => void;
}) {
  const list = items.length ? items : edit ? [""] : [];
  return (
    <Tag>
      {list.map((item, j) => (
        <li key={j}>
          {edit ? (
            <input
              className="office-artifact__cell"
              value={item}
              onChange={(e) => {
                const next = [...list];
                next[j] = e.target.value;
                onChange(next);
              }}
            />
          ) : (
            item
          )}
        </li>
      ))}
    </Tag>
  );
}

function EditableText({
  tag: Tag,
  value,
  edit,
  onChange,
  className,
}: {
  tag: "h2" | "h3" | "h4" | "p" | "blockquote";
  value: string;
  edit: boolean;
  onChange: (value: string) => void;
  className?: string;
}) {
  if (!edit) {
    return <Tag className={className}>{value}</Tag>;
  }
  return (
    <Tag
      className={className}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent ?? "")}
    >
      {value}
    </Tag>
  );
}
