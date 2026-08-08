import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { fileToResizedDataUrl } from "../lib/image";

// Photo picker with preview. Emits a resized JPEG data URL via onChange.
export default function PhotoInput({ value, onChange, error }) {
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      onChange(await fileToResizedDataUrl(file));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-slate-200">
          <img
            src={value}
            alt="Reported issue"
            className="max-h-56 w-full object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            aria-label="Remove photo"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={
            "flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm transition-colors " +
            (error
              ? "border-red-300 bg-red-50 text-red-600"
              : "border-slate-300 text-slate-500 hover:border-slate-400")
          }
        >
          <Camera size={22} />
          {loading ? "Processing photo…" : "Tap to add a photo"}
        </button>
      )}
    </div>
  );
}
