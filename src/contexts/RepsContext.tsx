import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { getReps, GetRepsOutputType } from '@/lib/api';

type Pro = GetRepsOutputType['pros'][0];

interface RepsContextType {
  pros: Pro[];
  loading: boolean;
  reload: () => Promise<void>;
}

const RepsContext = createContext<RepsContextType | undefined>(undefined);

export function RepsProvider({ children, autoLoad = true }: { children: ReactNode; autoLoad?: boolean }) {
  const [pros, setPros] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);

  const loadReps = async () => {
    // Guard against concurrent fetches
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const result = await getReps({});
      setPros(result.pros);
    } catch (error) {
      console.error('Error loading reps:', error);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (autoLoad) loadReps();
  }, []);

  return (
    <RepsContext.Provider value={{ pros, loading, reload: loadReps }}>
      {children}
    </RepsContext.Provider>
  );
}

export function useReps() {
  const context = useContext(RepsContext);
  if (!context) throw new Error('useReps must be used within a RepsProvider');
  return context;
}
