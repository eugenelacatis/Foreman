import { useEffect, useState } from "react";

interface ArmorIQBlockProps {
  action: string;
  reason: string;
  onDismiss: () => void;
}

export default function ArmorIQBlock({
  action,
  reason,
  onDismiss,
}: ArmorIQBlockProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger transition on mount
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  function handleDismiss() {
    setVisible(false);
    setTimeout(onDismiss, 300);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      style={{ backgroundColor: "rgba(185, 28, 28, 0.85)" }}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center transform transition-all duration-300 ${
          visible ? "scale-100 translate-y-0" : "scale-90 translate-y-4"
        }`}
      >
        {/* Shield icon */}
        <div className="flex justify-center mb-4">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-12 h-12 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016zM12 9v2m0 4h.01"
              />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-black text-red-700 tracking-tight mb-1 uppercase">
          Action Blocked by ArmorIQ
        </h2>
        <p className="text-sm text-red-500 font-semibold mb-6 uppercase tracking-widest">
          Safety enforcement active
        </p>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-left">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">
            Attempted action
          </p>
          <p className="text-sm text-gray-800 font-mono">{action}</p>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Reason
          </p>
          <p className="text-sm text-gray-700">{reason}</p>
        </div>

        <button
          onClick={handleDismiss}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
