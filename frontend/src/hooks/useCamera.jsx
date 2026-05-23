// frontend/src/hooks/useCamera.jsx
import { useRef, useCallback } from 'react';

/**
 * Retourne deux déclencheurs :
 * - triggerCamera  : ouvre directement la caméra (capture="environment")
 * - triggerGallery : ouvre la galerie / explorateur de fichiers
 * - CameraInputs   : les deux <input> cachés à monter dans le DOM
 *
 * @param {{ onCapture: (files: File[]) => void, multiple?: boolean }} opts
 */
export function useCamera({ onCapture, multiple = false }) {
  const cameraRef  = useRef(null);
  const galleryRef = useRef(null);

  const triggerCamera  = useCallback(() => cameraRef.current?.click(),  []);
  const triggerGallery = useCallback(() => galleryRef.current?.click(), []);

  const handleChange = useCallback((e) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onCapture(files);
    e.target.value = '';
  }, [onCapture]);

  const CameraInputs = useCallback(function CameraInputs() {
    return (
      <>
        {/* Ouvre directement la caméra arrière */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
          aria-hidden="true"
        />
        {/* Ouvre la galerie / explorateur */}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
          aria-hidden="true"
        />
      </>
    );
  }, [multiple, handleChange]);

  return { triggerCamera, triggerGallery, CameraInputs };
}
