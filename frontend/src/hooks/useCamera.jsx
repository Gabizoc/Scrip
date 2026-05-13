// frontend/src/hooks/useCamera.js
import { useRef, useCallback } from 'react';

/**
 * Gère la capture photo via l'input file natif.
 * - Sur mobile : ouvre la caméra arrière (capture="environment")
 * - Sur desktop : ouvre l'explorateur de fichiers
 *
 * Retourne :
 * - trigger()    : ouvre le sélecteur de fichier
 * - CameraInput  : composant <input hidden> à placer dans le DOM
 */
export function useCamera({ onCapture }) {
  const inputRef = useRef(null);

  function trigger() {
    inputRef.current?.click();
  }

  const handleChange = useCallback(function handleChange(e) {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
    // Reset pour permettre de re-sélectionner le même fichier
    e.target.value = '';
  }, [onCapture]);

  const CameraInput = useCallback(function CameraInput() {
    return (
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
      />
    );
  }, []); // inputRef et handleChange sont des refs stables

  return { trigger, CameraInput };
}
