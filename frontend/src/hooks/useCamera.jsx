import { useRef, useCallback } from 'react';

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
