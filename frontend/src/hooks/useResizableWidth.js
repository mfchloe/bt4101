import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Width of a side panel that the user can resize by dragging a
 * divider (see ResizeHandle).
 *
 * `edge` is the side of the panel the divider sits on:
 *   "right" – panel on the left, dragging right makes it wider
 *   "left"  – panel on the right, dragging left makes it wider
 *
 * Double-clicking the divider toggles between the default and max width.
 */
export default function useResizableWidth({
  initial,
  min,
  max,
  edge = "right",
}) {
  const [width, setWidth] = useState(initial);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);

  const clamp = useCallback(
    (value) => Math.min(max, Math.max(min, value)),
    [min, max],
  );

  const direction = edge === "right" ? 1 : -1;

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      const delta = (e.clientX - dragStart.current.x) * direction;
      setWidth(clamp(dragStart.current.width + delta));
    };
    const handleUp = () => setIsDragging(false);

    // Keep the resize cursor and stop text selection while dragging
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isDragging, clamp, direction]);

  const handleProps = {
    onPointerDown: (e) => {
      e.preventDefault();
      dragStart.current = { x: e.clientX, width };
      setIsDragging(true);
    },
    onDoubleClick: () => setWidth((w) => (w === max ? initial : max)),
    onKeyDown: (e) => {
      const step = e.shiftKey ? 64 : 16;
      if (e.key === "ArrowRight") setWidth(clamp(width + step * direction));
      else if (e.key === "ArrowLeft") setWidth(clamp(width - step * direction));
    },
    "aria-valuenow": width,
    "aria-valuemin": min,
    "aria-valuemax": max,
  };

  return { width, isDragging, handleProps };
}
