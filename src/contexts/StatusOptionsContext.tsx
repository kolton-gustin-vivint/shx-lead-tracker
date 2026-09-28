import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStatusOptions, GetStatusOptionsOutputType } from '@/lib/api';

interface StatusOptionsContextType {
  statusOptions: string[];
  loading: boolean;
  error: string | null;
  refreshStatusOptions: () => Promise<void>;
}

const StatusOptionsContext = createContext<StatusOptionsContextType | undefined>(undefined);

export const useStatusOptions = () => {
  const context = useContext(StatusOptionsContext);
  if (context === undefined) {
    throw new Error('useStatusOptions must be used within a StatusOptionsProvider');
  }
  return context;
};

interface StatusOptionsProviderProps {
  children: ReactNode;
}

export const StatusOptionsProvider: React.FC<StatusOptionsProviderProps> = ({ children }) => {
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatusOptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getStatusOptions({});
      // Filter out legacy "REMOVE | Unassign Lead" status
      const filteredOptions = (result?.statusOptions || []).filter(
        status => status !== 'REMOVE | Unassign Lead'
      );
      setStatusOptions(filteredOptions);
    } catch (err) {
      console.error('Failed to fetch status options:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch status options');
      // Fallback to common status options if API fails
      setStatusOptions([
        'NEW',
        'IN-PROGRESS | No Answer',
        'IN-PROGRESS | Follow-Up',
        'IN-PROGRESS | Appointment Set',
        'CLOSED | Not Interested',
        'CLOSED | Blocked by Objection(s)',
        'CLOSED | Appointment Set, No Sale',
        'CLOSED | Missing Contact Info',
        'CLOSED | Already Sold',
        'CLOSED | Sold/Scheduled',
        'CLOSED | Installed',
        'CLOSED | Lead Outside Market'
      ]);
    } finally {
      setLoading(false);
    }
  };

  const refreshStatusOptions = async () => {
    await fetchStatusOptions();
  };

  useEffect(() => {
    fetchStatusOptions();
  }, []);

  const value: StatusOptionsContextType = {
    statusOptions,
    loading,
    error,
    refreshStatusOptions,
  };

  return (
    <StatusOptionsContext.Provider value={value}>
      {children}
    </StatusOptionsContext.Provider>
  );
};

export default StatusOptionsProvider;
