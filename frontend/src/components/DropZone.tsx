import { useRef, useState } from "react";
import type { DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { ChevronRight, FileText, Loader2, UploadCloud } from "lucide-react";

const ACCEPT = ".pdf,.txt,.eml,.png,.jpg,.jpeg,.m4a,.mp3";

type InputMode = "upload" | "paste";

interface DropZoneProps {
  onFile?: (file: File) => void;
  onText?: (text: string) => void;
  loading?: boolean;
}

export default function DropZone({ onFile, onText, loading = false }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCount = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<InputMode>("upload");
  const [pasteText, setPasteText] = useState("");

  const openPicker = () => inputRef.current?.click();

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    onFile?.(file);
  };

  const onDragEnter = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCount.current += 1;
    setIsDragging(true);
  };
  const onDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCount.current = Math.max(0, dragCount.current - 1);
    if (dragCount.current === 0) setIsDragging(false);
  };
  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCount.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  const handleSubmitText = () => {
    const trimmed = pasteText.trim();
    if (!trimmed) return;
    onText?.(trimmed);
  };

  return (
    <div className="overflow-hidden rounded-[10px] border border-[var(--color-hairline)] bg-white">
      {/* Mode toggle */}
      <div className="flex border-b border-[var(--color-hairline)]">
        {(["upload", "paste"] as InputMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={
              "flex-1 py-2.5 text-[12.5px] font-medium transition-colors " +
              (mode === m
                ? "border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]"
                : "text-[var(--color-ink-3)] hover:text-[var(--color-ink)]")
            }
            style={mode === m ? { marginBottom: -1 } : undefined}
          >
            {m === "upload" ? "Upload file" : "Paste text"}
          </button>
        ))}
      </div>

      {mode === "upload" ? (
        <div
          role={loading ? undefined : "button"}
          tabIndex={loading ? undefined : 0}
          onClick={loading ? undefined : openPicker}
          onKeyDown={loading ? undefined : onKeyDown}
          onDragEnter={loading ? undefined : onDragEnter}
          onDragOver={loading ? undefined : onDragOver}
          onDragLeave={loading ? undefined : onDragLeave}
          onDrop={loading ? undefined : onDrop}
          aria-label="Drop emails, call transcripts, or voice notes — or click to browse"
          className={
            "group flex w-full flex-col items-center justify-center gap-2 py-8 text-center transition-colors outline-none " +
            (loading
              ? "cursor-default"
              : "cursor-pointer focus-visible:bg-[var(--color-accent-tint)] " +
                (isDragging ? "bg-[var(--color-accent-tint)]" : "hover:bg-[#fafbfd]"))
          }
        >
          {loading ? (
            <>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f7f8fa] text-[var(--color-accent)]">
                <Loader2 size={18} strokeWidth={1.75} className="animate-spin" />
              </span>
              <p className="text-[13.5px] text-[var(--color-ink-2)]">Processing…</p>
            </>
          ) : (
            <>
              <span
                className={
                  "grid h-9 w-9 place-items-center rounded-full transition-colors " +
                  (isDragging
                    ? "bg-[var(--color-accent-tint)] text-[var(--color-accent)]"
                    : "bg-[#f7f8fa] text-[var(--color-ink-3)] group-hover:text-[var(--color-ink-2)]")
                }
              >
                <UploadCloud size={18} strokeWidth={1.75} />
              </span>
              <p className="text-[13.5px] text-[var(--color-ink-2)]">
                {isDragging
                  ? "Drop to start the work order"
                  : "Drop emails, call transcripts, or voice notes"}
              </p>
              {!isDragging ? (
                <p className="text-[12.5px] text-[var(--color-ink-3)]">
                  or click to browse · PDF, TXT, EML, audio
                </p>
              ) : null}
            </>
          )}

          {!loading && (
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                handleFile(file);
                e.target.value = "";
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste an email, voice note transcript, or any work-order description…"
            rows={6}
            className="w-full resize-none rounded-[8px] border border-[var(--color-hairline)] bg-[#fafbfd] px-3 py-2.5 text-[13.5px] leading-relaxed text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] outline-none transition-colors focus:border-[var(--color-ink-3)] focus:bg-white"
            onKeyDown={(e) => {
              if (!loading && e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmitText();
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-[var(--color-ink-3)]">
              <FileText size={11} strokeWidth={2} className="mr-1 inline-block" />
              ⌘ Enter to submit
            </span>
            <button
              type="button"
              onClick={loading ? undefined : handleSubmitText}
              disabled={!pasteText.trim() || loading}
              className="inline-flex items-center gap-1.5 rounded-[8px] bg-[var(--color-accent)] px-3.5 h-9 text-[13px] font-medium text-white transition-colors hover:bg-[#1d4fd1] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 size={13} strokeWidth={2} className="animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  Start work order
                  <ChevronRight size={13} strokeWidth={2.25} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
