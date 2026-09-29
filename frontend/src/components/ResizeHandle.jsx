import { GripVertical } from "lucide-react";

/*
 * Vertical divider between two panels. Shows a grip on hover and can be
 * dragged to resize the neighbouring panel. Pair with useResizableWidth.
 */
export default function ResizeHandle({ isDragging, label, ...props }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      title="Drag to resize · double-click to expand"
      tabIndex={0}
      {...props}
      className="group relative z-10 w-px shrink-0 cursor-col-resize bg-slate-200 outline-none"
    >
      {/* Wider invisible hit area so the 1px line is easy to grab */}
      <span className="absolute inset-y-0 -left-2 -right-2" />

      <span
        className={`pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 transition-all ${
          isDragging
            ? "w-1 bg-indigo-500"
            : "w-px group-hover:w-1 group-hover:bg-indigo-400 group-focus-visible:w-1 group-focus-visible:bg-indigo-400"
        }`}
      />

      <span
        className={`pointer-events-none absolute left-1/2 top-1/2 flex h-9 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-300 bg-white shadow-sm transition-opacity ${
          isDragging
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
        }`}
      >
        <GripVertical size={12} className="text-slate-400" />
      </span>
    </div>
  );
}
