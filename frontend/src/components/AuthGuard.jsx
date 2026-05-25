// frontend/src/components/AuthGuard.jsx
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { authApi } from '../lib/auth.js';

/**
 * Protège les routes enfants.
 * - needsSetup → /setup
 * - non authentifié → /login
 * - authentifié → render children
 */
export default function AuthGuard({ children }) {
  const { data, isLoading, isError } = useQuery({
    queryKey:           ['auth-status'],
    queryFn:            authApi.status,
    retry:              false,
    staleTime:          60_000,  // revalide toutes les minutes
  });

  if (isLoading) {
    // Écran blanc pendant la vérification — évite le flash de la page login
    return <div className="min-h-screen bg-bg-base" />;
  }

  if (isError || !data?.loggedIn) {
    if (data?.needsSetup) return <Navigate to="/setup" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}
