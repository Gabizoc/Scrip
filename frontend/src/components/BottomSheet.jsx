import { motion, AnimatePresence } from 'motion/react';

const SPRING = { type: 'spring', stiffness: 380, damping: 32, mass: 1 };

/**
 * Sheet animée qui monte du bas.
 * Overlay cliquable pour fermer, radius xl en haut.
 */
export default function BottomSheet({ open, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING}
            className={[
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-bg-elevated',
              'rounded-t-xl',
              'max-h-[90vh] overflow-y-auto',
            ].join(' ')}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
