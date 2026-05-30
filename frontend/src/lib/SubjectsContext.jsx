import { createContext, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api.js';

const SubjectsContext = createContext(new Map());

export function SubjectsProvider({ children }) {
  const { data = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn:  () => api.getSubjects(),
    staleTime: 30_000,
  });

  const map = useMemo(() => new Map(data.map(s => [s.name, s])), [data]);

  return (
    <SubjectsContext.Provider value={map}>
      {children}
    </SubjectsContext.Provider>
  );
}

export function useSubjectByName(name) {
  return useContext(SubjectsContext).get(name);
}
