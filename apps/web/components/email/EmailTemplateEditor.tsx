"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../Button";
import {
  BLOCK_CATALOG,
  BRAND_PALETTE,
  DEFAULT_EMAIL_BRAND,
  applyPreviewVars,
  compileEmailHtml,
  compileEmailText,
  newBlock,
  parseEmailHtml,
  type EmailBlock,
  type EmailBlockType,
} from "../../lib/email-blocks";

export interface EmailTemplateEditorProps {
  /** Changes when a different template is selected / loaded */
  templateKey: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  onSubjectChange: (v: string) => void;
  onCompiledChange: (html: string, text: string) => void;
  onSave: () => void;
  onSendTest: () => void;
  saving?: boolean;
  testBusy?: boolean;
}

export function EmailTemplateEditor({
  templateKey,
  subject,
  htmlBody,
  onSubjectChange,
  onCompiledChange,
  onSave,
  onSendTest,
  saving,
  testBusy,
}: EmailTemplateEditorProps) {
  const [blocks, setBlocks] = useState<EmailBlock[]>(() =>
    parseEmailHtml(htmlBody),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const [showSampleVars, setShowSampleVars] = useState(true);
  const loadedKeyRef = useRef(templateKey);
  const onCompiledRef = useRef(onCompiledChange);
  onCompiledRef.current = onCompiledChange;

  // Re-parse only when template identity changes
  useEffect(() => {
    if (loadedKeyRef.current === templateKey) return;
    loadedKeyRef.current = templateKey;
    const parsed = parseEmailHtml(htmlBody);
    setBlocks(parsed);
    setSelectedId(parsed[0]?.id ?? null);
  }, [templateKey, htmlBody]);

  const compiledHtml = useMemo(
    () => compileEmailHtml(blocks, DEFAULT_EMAIL_BRAND),
    [blocks],
  );
  const compiledText = useMemo(() => compileEmailText(blocks), [blocks]);

  useEffect(() => {
    onCompiledRef.current(compiledHtml, compiledText);
  }, [compiledHtml, compiledText]);
  const previewSrc = useMemo(() => {
    const html = showSampleVars
      ? applyPreviewVars(compiledHtml)
      : compiledHtml;
    return html;
  }, [compiledHtml, showSampleVars]);

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  const updateBlock = (id: string, patch: Partial<EmailBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const addBlock = (type: EmailBlockType) => {
    const b = newBlock(type);
    setBlocks((prev) => [...prev, b]);
    setSelectedId(b.id);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      if (i < 0) return prev;
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[i]!;
      next[i] = next[j]!;
      next[j] = tmp;
      return next;
    });
  };

  return (
    <div className="email-editor">
      <div className="email-editor-toolbar">
        <div className="field" style={{ flex: 1, margin: 0 }}>
          <label htmlFor="ee-subj">Subject</label>
          <input
            id="ee-subj"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
            placeholder="[StockSentry] {{incidentTitle}}"
          />
        </div>
        <div className="email-editor-actions">
          <label className="field-check" style={{ margin: 0 }}>
            <input
              type="checkbox"
              checked={showSampleVars}
              onChange={(e) => setShowSampleVars(e.target.checked)}
            />
            <span>Preview sample vars</span>
          </label>
          <div className="seg">
            <button
              type="button"
              className={previewMode === "desktop" ? "on" : undefined}
              onClick={() => setPreviewMode("desktop")}
            >
              Desktop
            </button>
            <button
              type="button"
              className={previewMode === "mobile" ? "on" : undefined}
              onClick={() => setPreviewMode("mobile")}
            >
              Mobile
            </button>
          </div>
          <Button disabled={testBusy} onClick={onSendTest}>
            {testBusy ? "Sending…" : "Send test"}
          </Button>
          <Button variant="primary" disabled={saving} onClick={onSave}>
            {saving ? "Saving…" : "Save template"}
          </Button>
        </div>
      </div>

      <div className="email-editor-layout">
        <aside className="email-editor-blocks">
          <div className="ee-sec-title">Structure</div>
          <div className="ee-block-list">
            {blocks.map((b, idx) => (
              <button
                key={b.id}
                type="button"
                className={`ee-block-item${selectedId === b.id ? " on" : ""}`}
                onClick={() => setSelectedId(b.id)}
              >
                <span>{BLOCK_CATALOG.find((c) => c.type === b.type)?.label ?? b.type}</span>
                <span className="m">{idx + 1}</span>
              </button>
            ))}
          </div>
          <div className="ee-sec-title" style={{ marginTop: 14 }}>
            Add block
          </div>
          <div className="ee-add-grid">
            {BLOCK_CATALOG.map((c) => (
              <button
                key={c.type}
                type="button"
                className="ee-add"
                onClick={() => addBlock(c.type)}
                title={c.hint}
              >
                {c.label}
              </button>
            ))}
          </div>
        </aside>

        <div className="email-editor-preview">
          <div
            className={`ee-frame ${previewMode === "mobile" ? "mobile" : "desktop"}`}
          >
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={previewSrc}
            />
          </div>
        </div>

        <aside className="email-editor-inspector">
          <div className="ee-sec-title">Properties</div>
          {!selected ? (
            <p className="m">Select a block to edit its properties.</p>
          ) : (
            <div className="ee-props">
              <div className="ee-prop-actions">
                <Button onClick={() => moveBlock(selected.id, -1)}>↑</Button>
                <Button onClick={() => moveBlock(selected.id, 1)}>↓</Button>
                <Button onClick={() => removeBlock(selected.id)}>Remove</Button>
              </div>

              {selected.type === "customHtml" ? (
                <div className="field">
                  <label>Custom HTML</label>
                  <textarea
                    rows={12}
                    value={selected.html ?? ""}
                    onChange={(e) =>
                      updateBlock(selected.id, { html: e.target.value })
                    }
                  />
                </div>
              ) : null}

              {selected.type === "header" ||
              selected.type === "heading" ||
              selected.type === "body" ||
              selected.type === "footer" ? (
                <div className="field">
                  <label>Text</label>
                  <textarea
                    rows={selected.type === "body" || selected.type === "footer" ? 5 : 2}
                    value={selected.text ?? ""}
                    onChange={(e) =>
                      updateBlock(selected.id, { text: e.target.value })
                    }
                  />
                </div>
              ) : null}

              {selected.type === "button" ? (
                <>
                  <div className="field">
                    <label>Button label</label>
                    <input
                      value={selected.buttonLabel ?? ""}
                      onChange={(e) =>
                        updateBlock(selected.id, {
                          buttonLabel: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Button URL</label>
                    <input
                      value={selected.buttonUrl ?? ""}
                      onChange={(e) =>
                        updateBlock(selected.id, { buttonUrl: e.target.value })
                      }
                    />
                  </div>
                </>
              ) : null}

              {selected.type === "header" ? (
                <div className="field">
                  <label>Logo URL (optional)</label>
                  <input
                    value={selected.logoUrl ?? ""}
                    onChange={(e) =>
                      updateBlock(selected.id, { logoUrl: e.target.value })
                    }
                    placeholder="https://…"
                  />
                </div>
              ) : null}

              {(selected.type === "header" ||
                selected.type === "button" ||
                selected.type === "heading" ||
                selected.type === "body" ||
                selected.type === "footer") && (
                <div className="field">
                  <label>Text color</label>
                  <div className="ee-swatches">
                    {BRAND_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={`ee-swatch${selected.color === c ? " on" : ""}`}
                        style={{ background: c }}
                        title={c}
                        onClick={() => updateBlock(selected.id, { color: c })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {(selected.type === "header" || selected.type === "button") && (
                <div className="field">
                  <label>Background</label>
                  <div className="ee-swatches">
                    {BRAND_PALETTE.map((c) => (
                      <button
                        key={`bg-${c}`}
                        type="button"
                        className={`ee-swatch${selected.background === c ? " on" : ""}`}
                        style={{ background: c }}
                        title={c}
                        onClick={() =>
                          updateBlock(selected.id, { background: c })
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
