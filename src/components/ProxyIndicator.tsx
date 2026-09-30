import React from 'react';
import { Button } from '@project/components/ui/button';
import { Eye, X } from 'lucide-react';
import { useProxy } from '../contexts/ProxyContext';

export default function ProxyIndicator() {
  const { currentUser, originalUser, isProxying, clearProxy } = useProxy();

  if (!isProxying || !currentUser || !originalUser) return null;

  return (
    <div className="bg-[hsl(var(--warning-bg))] border-b border-[hsl(var(--warning-border))] px-4 sm:px-6 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Eye className="h-4 w-4 text-[hsl(var(--warning-text))] shrink-0" />
          <span className="text-sm font-medium text-[hsl(var(--warning-text))] truncate">
            Proxy Mode — viewing as{' '}
            <span className="font-semibold">{currentUser.displayName || currentUser.proName}</span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearProxy}
          className="h-7 px-2.5 gap-0.5 text-xs text-[hsl(var(--warning-text))] hover:text-[hsl(var(--warning-text)/0.75)] hover:bg-[hsl(var(--warning-border)/0.5)] shrink-0"
        >
          <X className="h-3.5 w-3.5 mr-0.2" />
          Exit
        </Button>
      </div>
    </div>
  );
}
