import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { api } from '../lib/api.js';
import NoteCard from '../components/NoteCard.jsx';
import FAB from '../components/FAB.jsx';

export default function Home() {
  const navigate = useNavigate();
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: api.getNotes,
  });

  return (
    <div className="min-h-screen pb-28">
      {/* Header sticky avec blur au scroll */}
      <header className={[
        'sticky top-0 z-10',
        'px-4 pt-4 pb-3',
        'backdrop-blur-glass',
        'bg-bg-base/80',
        'border-b border-black/[0.06] dark:border-white/[0.06]',
      ].join(' ')}>
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Scrip
          </h1>
          <button
            onClick={() => navigate('/settings')}
            className="text-text-secondary p-2 -mr-2"
            aria-label="Paramètres"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Liste des cours */}
      <main className="px-4 pt-4 max-w-2xl mx-auto space-y-3">
        {isLoading && (
          <p className="text-text-tertiary text-sm text-center pt-8">
            Chargement...
          </p>
        )}
        {!isLoading && notes.length === 0 && (
          <div className="text-center pt-20 space-y-2">
            <p className="text-4xl">📸</p>
            <p className="text-text-secondary text-sm">
              Aucun cours — capture ta première photo !
            </p>
          </div>
        )}
        {notes.map(note => (
          <NoteCard key={note.id} note={note} />
        ))}
      </main>

      <FAB />
    </div>
  );
}
