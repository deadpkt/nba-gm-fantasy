import { useEffect, useMemo, useRef, useState } from "react";
import { createCroppedImage } from "../lib/imageCrop";
import { PROFILE_CROP_OUTPUTS } from "../lib/profileMedia";
import { getUserFriendlyError } from "../lib/clientErrors";

function clamp(value) {
  return Math.max(-1, Math.min(1, value)); 
}

function ImageCropEditor({ file, type, onCancel, onConfirm }) {
  const viewportRef = useRef(null);
  const dragRef = useRef(null);
  const config = PROFILE_CROP_OUTPUTS[type];
  const source = useMemo(() => URL.createObjectURL(file), [file]);
  const [dimensions, setDimensions] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [, setViewportVersion] = useState(0);

  useEffect(() => () => URL.revokeObjectURL(source), [source]);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() =>
      setViewportVersion((value) => value + 1),
    );
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  function displayPlacement() {
    const viewport = viewportRef.current?.getBoundingClientRect();
    if (!viewport || !dimensions) return null;
    const scale =
      Math.max(
        viewport.width / dimensions.width,
        viewport.height / dimensions.height,
      ) * zoom;
    const width = dimensions.width * scale;
    const height = dimensions.height * scale;
    return {
      width,
      height,
      x: (position.x * Math.max(0, width - viewport.width)) / 2,
      y: (position.y * Math.max(0, height - viewport.height)) / 2,
      overflowX: Math.max(0, width - viewport.width),
      overflowY: Math.max(0, height - viewport.height),
    };
  }

  function startDrag(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const placement = displayPlacement();
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      position,
      placement,
    };
  }

  function moveDrag(event) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    setPosition({
      x: drag.placement.overflowX
        ? clamp(drag.position.x + (dx * 2) / drag.placement.overflowX)
        : 0,
      y: drag.placement.overflowY
        ? clamp(drag.position.y + (dy * 2) / drag.placement.overflowY)
        : 0,
    });
  }

  async function confirm() {
    setSaving(true);
    setError("");
    try {
      const cropped = await createCroppedImage(file, {
        ...config,
        zoom,
        position,
        quality: type === "avatar" ? 0.92 : 0.9,
      });
      onConfirm(cropped);
    } catch (nextError) {
      setError(
        getUserFriendlyError(nextError, "Could not prepare that image."),
      );
      setSaving(false);
    }
  }

  const placement = displayPlacement();
  return (
    <div
      className="crop-editor-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Crop ${config.label}`}
    >
      <section className={`crop-editor crop-editor--${type}`}>
        <header>
          <div>
            <span>IMAGE POSITION</span>
            <h2>Crop {config.label}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel image crop"
          >
            ×
          </button>
        </header>
        <p>
          Drag the image to reposition it. Use zoom to frame the exact area that
          will be saved.
        </p>
        <div
          className={`crop-editor__viewport crop-editor__viewport--${type}`}
          ref={viewportRef}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
        >
          <img
            src={source}
            alt="Crop preview"
            draggable="false"
            onLoad={(event) =>
              setDimensions({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
            style={
              placement
                ? {
                    width: placement.width,
                    height: placement.height,
                    transform: `translate(calc(-50% + ${placement.x}px), calc(-50% + ${placement.y}px))`,
                  }
                : undefined
            }
          />
          <i aria-hidden="true" />
        </div>
        <label className="crop-editor__zoom">
          <span>ZOOM</span>
          <input
            type="range"
            min="1"
            max="3"
            step="0.01"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
          />
          <b>{zoom.toFixed(2)}×</b>
        </label>
        {error && (
          <p className="crop-editor__error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button
            type="button"
            className="button-secondary"
            disabled={saving}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button-primary"
            disabled={saving || !dimensions}
            onClick={confirm}
          >
            {saving ? "Preparing..." : "Use This Crop"}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default ImageCropEditor;
