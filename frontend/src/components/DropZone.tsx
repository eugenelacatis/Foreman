import { useRef, useState } from "react";
import type { DragEvent as ReactDragEvent, KeyboardEvent as ReactKeyboardEvent } from "react";
import { UploadCloud } from "lucide-react";

const ACCEPT = ".pdf,.txt,.eml,.png,.jpg,.jpeg,.m4a,.mp3";

interface DropZoneProps {
  onFile?: (file: File) => void;
}

export default function DropZone({ onFile }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCount = useRef(0); // robust against child elements firing dragenter/leave
  const [isDragging, setIsDragging] = useState(false);

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
    // must preventDefault so the browser doesn't just open the file
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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={onKeyDown}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label="Drop emails, call transcripts, or voice notes — or click to browse"
      className={
        'group flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed py-10 text-center transition-colors outline-none focus-visible:border-[var(--color-accent)] focus-visible:bg-[var(--color-accent-tint)] ' +
        (isDragging
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-tint)]'
          : 'border-[#9aa3af] bg-[#f7f8fa] hover:border-[var(--color-accent)] hover:bg-[#f1f3f7]')
      }
    >
      <span
        className={
          'grid h-10 w-10 place-items-center rounded-full transition-colors ' +
          (isDragging
            ? 'bg-white text-[var(--color-accent)]'
            : 'bg-white text-[var(--color-ink-2)] group-hover:bg-[var(--color-accent-tint)] group-hover:text-[var(--color-accent)]')
        }
      >
        <UploadCloud size={20} strokeWidth={1.75} />
      </span>
      <p className="text-[14px] text-[var(--color-ink)]">
        {isDragging
          ? 'Drop to start the work order'
          : 'Drop emails, call transcripts, or voice notes'}
      </p>
      {!isDragging ? (
        <p className="text-[13px] text-[var(--color-ink-2)]">
          or <span className="text-[var(--color-accent)] font-medium">click to browse</span>
        </p>
      ) : null}

      {/* Hidden picker */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          handleFile(file)
          // reset so picking the same file again still fires onChange
          e.target.value = ''
        }}
      />
    </div>
  )
}
