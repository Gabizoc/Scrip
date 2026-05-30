import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

function OptionIcon({ icon }) {
  if (!icon) return null;
  if (icon.startsWith('data:')) {
    return <img src={icon} alt="" className="w-4 h-4 rounded-sm object-cover shrink-0" />;
  }
  return <span className="shrink-0 leading-none text-[15px]">{icon}</span>;
}

export default function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Choisir…',
  className = '',
  fullWidth = false,
}) {
  const [open, setOpen]   = useState(false);
  const [rect, setRect]   = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const selected = options.find(o => o.value === value);

  function toggle() {
    if (!open) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(v => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (
        !triggerRef.current?.contains(e.target) &&
        !panelRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function update() { setRect(triggerRef.current?.getBoundingClientRect()); }
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  const menuWidth = rect ? Math.max(rect.width, 160) : 160;
  const menuLeft = rect ? Math.min(rect.left, window.innerWidth - menuWidth - 8) : 0;
  const menuTop = rect ? rect.bottom + 6 : 0;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={[
          'flex items-center gap-2 text-left transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
          fullWidth ? 'w-full' : '',
          className,
        ].join(' ')}
      >
        <span className="flex-1 flex items-center gap-2 truncate min-w-0">
          {selected?.icon && <OptionIcon icon={selected.icon} />}
          {selected ? <span className="truncate">{selected.label}</span> : <span className="text-text-tertiary">{placeholder}</span>}
        </span>
        <ChevronDown
          size={13}
          className={['text-text-tertiary flex-shrink-0 transition-transform duration-200', open ? 'rotate-180' : ''].join(' ')}
        />
      </button>

      {open && rect && createPortal(
        <>
          <div
            ref={panelRef}
            className="dropdown-panel fixed z-[9991] pt-1 pb-1.5 rounded-xl overflow-hidden
              animate-[scaleIn_0.15s_cubic-bezier(0.16,1,0.3,1)_both] origin-top"
            style={{ top: menuTop, left: menuLeft, width: menuWidth }}
          >
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={[
                  'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-left',
                  'transition-colors duration-100 rounded-lg mx-1 my-0.5',
                  'focus:outline-none',
                  o.value === value
                    ? 'text-accent bg-accent/[0.10]'
                    : 'text-text-primary hover:bg-black/[0.05] dark:hover:bg-white/[0.07]',
                ].join(' ')}
                style={{ width: 'calc(100% - 8px)' }}
              >
                <Check
                  size={12}
                  className={['flex-shrink-0 transition-opacity text-accent', o.value === value ? 'opacity-100' : 'opacity-0'].join(' ')}
                />
                {o.icon && <OptionIcon icon={o.icon} />}
                <span className="truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
