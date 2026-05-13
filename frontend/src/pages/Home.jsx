// frontend/src/pages/Home.jsx
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import NoteCard from '../components/NoteCard.jsx';

export default function Home() {
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: api.getNotes,
  });

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">Mes cours</h1>
        <p className="text-sm text-text-secondary mt-1">
          {notes.length > 0
            ? `${notes.length} cours ingéré${notes.length > 1 ? 's' : ''}`
            : 'Aucun cours pour l\'instant'}
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-black/[0.04] dark:bg-white/[0.04] animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
            <span className="text-3xl">📸</span>
          </div>
          <p className="text-text-primary font-medium mb-1">Aucun cours</p>
          <p className="text-text-secondary text-sm">Capture ta première photo pour commencer</p>
        </div>
      )}

      {notes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {notes.map(note => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
