import { Camera } from 'lucide-react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export default function FAB() {
  const navigate = useNavigate();
  return (
    <motion.button
      onClick={() => navigate('/capture')}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.1 }}
      aria-label="Capturer un cours"
      className={[
        'md:hidden',
        'fixed bottom-20 right-5',
        'w-14 h-14 rounded-full',
        'bg-accent text-white dark:text-bg-base',
        'flex items-center justify-center',
        'shadow-[0_4px_24px_rgb(var(--accent)/0.4)]',
        'z-30',
      ].join(' ')}
    >
      <Camera size={24} />
    </motion.button>
  );
}
