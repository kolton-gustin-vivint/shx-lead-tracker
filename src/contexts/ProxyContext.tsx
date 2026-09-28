import React, { createContext, useContext, useState, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  proId?: string;
  proName: string;
  displayName: string;
  role: string;
}

interface ProxyContextType {
  originalUser: User | null;
  currentUser: User | null;
  isProxying: boolean;
  setProxy: (user: User | null) => void;
  clearProxy: () => void;
}

const ProxyContext = createContext<ProxyContextType | undefined>(undefined);

interface ProxyProviderProps {
  children: ReactNode;
  user: User;
}

export function ProxyProvider({ children, user }: ProxyProviderProps) {
  const [proxyUser, setProxyUser] = useState<User | null>(null);

  const setProxy = (targetUser: User | null) => {
    setProxyUser(targetUser);
  };

  const clearProxy = () => {
    setProxyUser(null);
  };

  const value: ProxyContextType = {
    originalUser: user,
    currentUser: proxyUser || user,
    isProxying: !!proxyUser,
    setProxy,
    clearProxy
  };

  return (
    <ProxyContext.Provider value={value}>
      {children}
    </ProxyContext.Provider>
  );
}

export function useProxy() {
  const context = useContext(ProxyContext);
  if (context === undefined) {
    throw new Error('useProxy must be used within a ProxyProvider');
  }
  return context;
}
