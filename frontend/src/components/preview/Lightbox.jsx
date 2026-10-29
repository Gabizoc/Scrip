import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const MIN_ZOOM = 1, MAX_ZOOM = 8;

export default function Lightbox({ sources, index, onClose, onPrev, onNext }) {
  const [zoom, setZoom]             = useState(1);
  const [pan, setPan]               = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const didDrag = useRef(false);
  const lastPinchDist = useRef(null);

  useEffect(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, [index]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape')      onClose();
      if (e.key === 'ArrowLeft')   onPrev?.();
      if (e.key === 'ArrowRight')  onNext?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext]);

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
  }

  function onDblClick(e) {
    e.stopPropagation();
    if (zoom > 1) { setZoom(1); setPan({ x: 0, y: 0 }); }
    else setZoom(2.5);
  }

  function onPointerDown(e) {
    if (zoom <= 1) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    setIsDragging(true);
    didDrag.current = false;
    lastPos.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e) {
    if (!isDraggingRef.current) return;
    e.preventDefault();
    didDrag.current = true;
    setPan(p => ({
      x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y, }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerUp(e) {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    if (didDrag.current) e.stopPropagation();
  }

  function onTouchStart(e) {
    if (e.touches.length === 1)
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.touches.length === 2)
      lastPinchDist.current = null;
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY, );
      if (lastPinchDist.current !== null) {
        setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * dist / lastPinchDist.current)));
      }
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1 && zoom > 1) {
      const t = e.touches[0];
      setPan(p => ({
        x: p.x + t.clientX - lastPos.current.x, y: p.y + t.clientY - lastPos.current.y, }));
      lastPos.current = { x: t.clientX, y: t.clientY };
    }
  }
  function onTouchEnd() { lastPinchDist.current = null; }

  const isZoomed = zoom > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center select-none"
      onClick={() => { if (!isZoomed && !didDrag.current) onClose(); }}
    >
      <div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 z-10"
        onClick={e => e.stopPropagation()}
      >
        <p className="text-white/50 text-xs font-mono tabular-nums">
          {sources.length > 1 ? `${index + 1} / ${sources.length}` : ''}
        </p>
        <div className="flex items-center gap-2">
          {isZoomed && (
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="text-[11px] text-white/60 bg-white/10 hover:bg-white/20
                px-2 py-1 rounded font-mono transition-colors"
            >
              {Math.round(zoom * 100)}% · reset
            </button>
          )}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 text-white
              flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div
        className="w-full h-full flex items-center justify-center overflow-hidden"
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'none' }}
      >
        <img
          src={sources[index]?.url}
          alt={`Photo ${index + 1}`}
          draggable={false}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onDoubleClick={onDblClick}
          onClick={e => { if (didDrag.current) e.stopPropagation(); }}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center', transition: isDragging ? 'none' : 'transform 0.12s ease', cursor: isDragging ? 'grabbing' : isZoomed ? 'grab' : 'zoom-in', maxHeight: '100vh', maxWidth: '100vw', objectFit: 'contain', userSelect: 'none', pointerEvents: 'auto', }}
        />
      </div>

      {!isZoomed && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2
          text-white/25 text-[11px] pointer-events-none">
          double-clic ou molette pour zoomer
        </p>
      )}

      {sources.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); onPrev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2
              w-10 h-10 rounded-full bg-white/10 text-white text-xl
              flex items-center justify-center hover:bg-white/20 transition-colors z-10"
          >‹</button>
          <button
            onClick={e => { e.stopPropagation(); onNext(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2
              w-10 h-10 rounded-full bg-white/10 text-white text-xl
              flex items-center justify-center hover:bg-white/20 transition-colors z-10"
          >›</button>
        </>
      )}
    </div>, document.body, );
}
