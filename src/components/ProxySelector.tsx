import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@project/components/ui/select';
import { Eye } from 'lucide-react';
import { GetRepsOutputType } from '@/lib/api';
import { useProxy } from '../contexts/ProxyContext';
import { useReps } from '../contexts/RepsContext';

type Pro = GetRepsOutputType['pros'][0];

interface ProxySelectorProps {
  isManager: boolean;
  /** @deprecated Use variant instead */
  darkHeader?: boolean;
  variant?: 'default' | 'sidebar';
}

export default function ProxySelector({ isManager, darkHeader, variant = 'default' }: ProxySelectorProps) {
  const { originalUser, currentUser, isProxying, setProxy, clearProxy } = useProxy();
  const { pros: allPros, loading } = useReps();

  const pros = allPros.filter(pro => pro.role !== 'Manager' && pro.proId !== originalUser?.proId);

  if (!isManager) return null;

  const handleProxyChange = (proId: string) => {
    if (proId === 'none') {
      clearProxy();
    } else {
      const selectedPro = pros.find(pro => pro.proId === proId);
      if (selectedPro) {
        setProxy({
          id: selectedPro.id,
          email: selectedPro.email || '',
          proId: selectedPro.proId || '',
          proName: selectedPro.proName || '',
          displayName: selectedPro.displayName || '',
          role: selectedPro.role || '',
        });
      }
    }
  };

  const isSidebar = variant === 'sidebar';

  return (
    <Select
      value={isProxying ? currentUser?.proId || '' : 'none'}
      onValueChange={handleProxyChange}
      disabled={loading}
    >
      <SelectTrigger
        className={
          isSidebar
            ? 'w-full h-8 text-xs border-[hsl(var(--header-border))] bg-[hsl(var(--header-bg))] text-[hsl(var(--header-foreground)/0.8)] hover:bg-[hsl(var(--header-border))]'
            : 'w-full h-9 text-sm border-border'
        }
      >
        <SelectValue placeholder="My View" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="font-medium">My View</span>
        </SelectItem>
        {pros.map(pro => (
          <SelectItem key={pro.proId} value={pro.proId || pro.id}>
            {pro.displayName || pro.proName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
