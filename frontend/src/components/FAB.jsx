// frontend/src/components/FAB.jsx
import { Camera } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

/**
 * Floating Action Button — bouton caméra centré en bas d'écran.
 * 72×72px, radius full, pouce-friendly.
 */
export default function FAB() {
  const navigate = useNavigate();
  return (
    <motion.button
      onClick={() => navigate('/capture')}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.1 }}
      aria-label="Capturer un cours"
      className={[
        'fixed bottom-6 left-1/2 -translate-x-1/2',
        'w-[72px] h-[72px] rounded-full',
        'bg-accent',
        'text-white dark:text-bg-base',
        'flex items-center justify-center',
        'shadow-[0_4px_24px_rgb(var(--accent)/0.4)]',
        'z-50',
      ].join(' ')}
    >
      <Camera size={28} />
    </motion.button>
  );
}
