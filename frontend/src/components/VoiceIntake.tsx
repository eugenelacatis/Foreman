import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, X, Loader2, Check } from "lucide-react";
import type { WorkOrder } from "../api/client";

interface Message {
  role: "agent" | "user";
  text: string;
}

interface VoiceIntakeProps {
  onComplete: (wo: WorkOrder) => void;
  onClose: () => void;
}

type SessionState = "connecting" | "listening" | "processing" | "speaking" | "done" | "error";

export default function VoiceIntake({ onComplete, onClose }: VoiceIntakeProps) {
  const [state, setState] = useState<SessionState>("connecting");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingAudioRef = useRef<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  const addMessage = (role: "agent" | "user", text: string) =>
    setMessages((m) => [...m, { role, text }]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const sendEndTurn = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ event: "end_turn" }));
    setState("processing");
  }, []);

  const startRecording = useCallback(async () => {
    if (!streamRef.current) return;
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
        e.data.arrayBuffer().then((buf) => wsRef.current?.send(buf));
      }
    };

    recorder.onstop = () => {
      setTimeout(() => sendEndTurn(), 300);
    };

    recorder.start(100);
    setIsRecording(true);
    setState("listening");
  }, [sendEndTurn]);

  const playAudio = useCallback((data: ArrayBuffer) => {
    const blob = new Blob([data], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => { URL.revokeObjectURL(url); setState("listening"); };
    audio.onerror = () => { URL.revokeObjectURL(url); setState("listening"); };
    setState("speaking");
    audio.play().catch(() => setState("listening"));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch {
        if (!cancelled) { setErrorMsg("Microphone access denied."); setState("error"); }
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/work-orders/voice`);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        if (cancelled) { ws.close(); return; }
        setState("listening");
        addMessage("agent", "Hi! Describe the work order — location, issue, and any contract details you have.");
      };

      ws.onmessage = (event) => {
        if (cancelled) return;
        if (event.data instanceof ArrayBuffer) {
          if (pendingAudioRef.current) { pendingAudioRef.current = false; playAudio(event.data); }
          return;
        }
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(event.data as string); } catch { return; }
        const ev = msg.event as string;
        if (ev === "transcript") {
          addMessage("user", msg.text as string);
        } else if (ev === "retry") {
          addMessage("agent", msg.text as string);
          setState("listening");
        } else if (ev === "question") {
          addMessage("agent", msg.text as string);
          if (msg.has_audio) { pendingAudioRef.current = true; } else { setState("listening"); }
        } else if (ev === "complete") {
          doneRef.current = true;
          setState("done");
          setTimeout(() => onComplete(msg.work_order as WorkOrder), 800);
        } else if (ev === "error") {
          setErrorMsg(msg.text as string ?? "Voice session error.");
          setState("error");
        }
      };

      ws.onerror = () => {
        if (!cancelled) { setErrorMsg("Could not connect to voice server."); setState("error"); }
      };

      ws.onclose = () => {
        if (!cancelled && !doneRef.current) setState("error");
      };
    };

    connect();

    return () => {
      cancelled = true;
      wsRef.current?.send(JSON.stringify({ event: "done" }));
      wsRef.current?.close();
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      audioRef.current?.pause();
    };
  }, []);

  const handleMicClick = () => {
    if (isRecording) { stopRecording(); }
    else if (state === "listening") { startRecording(); }
  };

  const stateLabel: Record<SessionState, string> = {
    connecting: "Connecting…",
    listening: isRecording ? "Listening — click to send" : "Click mic and speak",
    processing: "Thinking…",
    speaking: "Agent speaking…",
    done: "Done — opening work order…",
    error: errorMsg ?? "Something went wrong.",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="w-full max-w-lg rounded-t-[20px] bg-white sm:rounded-[20px] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "85vh" }}>
        <div className="flex items-center justify-between border-b border-[var(--color-hairline)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
              <Mic size={14} strokeWidth={2} />
            </span>
            <span className="text-[14px] font-semibold text-[var(--color-ink)]">Voice intake</span>
          </div>
          <button type="button" onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full text-[var(--color-ink-3)] hover:bg-[#f1f3f7]">
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3 min-h-0">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={
                "max-w-[80%] rounded-[12px] px-3.5 py-2.5 text-[13.5px] leading-relaxed " +
                (m.role === "user" ? "bg-[var(--color-accent)] text-white" : "bg-[#f1f3f7] text-[var(--color-ink)]")
              }>
                {m.text}
              </div>
            </div>
          ))}
          {state === "processing" && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-[12px] bg-[#f1f3f7] px-3.5 py-2.5">
                <Loader2 size={13} strokeWidth={2} className="animate-spin text-[var(--color-accent)]" />
                <span className="text-[13px] text-[var(--color-ink-2)]">Thinking…</span>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-hairline)] px-5 py-4 flex flex-col items-center gap-3">
          <p className="text-[12.5px] text-[var(--color-ink-3)]">{stateLabel[state]}</p>
          {state === "error" ? (
            <button type="button" onClick={onClose} className="rounded-[8px] border border-[var(--color-hairline)] px-4 h-9 text-[13px] text-[var(--color-ink)] hover:bg-[#f1f3f7]">
              Close
            </button>
          ) : state === "done" ? (
            <span className="grid h-14 w-14 place-items-center rounded-full bg-green-100 text-green-600">
              <Check size={24} strokeWidth={2.5} />
            </span>
          ) : (
            <button
              type="button"
              onClick={handleMicClick}
              disabled={state === "connecting" || state === "processing" || state === "speaking"}
              className={
                "grid h-14 w-14 place-items-center rounded-full transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed " +
                (isRecording ? "bg-red-500 text-white scale-110 ring-4 ring-red-300" : "bg-[var(--color-accent)] text-white hover:bg-[#1d4fd1]")
              }
            >
              {isRecording ? <MicOff size={22} strokeWidth={2} /> : <Mic size={22} strokeWidth={2} />}
            </button>
          )}
          {isRecording && <p className="text-[12px] text-red-500 font-medium animate-pulse">Recording — click to send turn</p>}
        </div>
      </div>
    </div>
  );
}
