'use client';

import { Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ROLES, TIME_FILTERS } from '@/core/constants';
import type { RoleContext } from '@/core/constants';
import { Button } from '@/components/ui/button';

interface FilterBarProps {
  selectedRole: RoleContext | 'all';
  onRoleChange: (role: RoleContext | 'all') => void;
  selectedTime: string;
  onTimeChange: (t: string) => void;
  extraFilters?: React.ReactNode;
}

export function FilterBar({ selectedRole, onRoleChange, selectedTime, onTimeChange, extraFilters }: FilterBarProps) {
  const hasActiveFilter = selectedRole !== 'all' || selectedTime !== 'all';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        <span>Filter:</span>
      </div>

      {/* Role filter */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
        <button
          onClick={() => onRoleChange('all')}
          className={cn(
            'rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all',
            selectedRole === 'all'
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-muted-foreground'
          )}
        >
          Semua
        </button>
        {(Object.keys(ROLES) as RoleContext[]).map((role) => (
          <button
            key={role}
            onClick={() => onRoleChange(role)}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all',
              selectedRole === role
                ? cn('text-foreground', ROLES[role].bgClass)
                : 'text-muted-foreground hover:text-muted-foreground'
            )}
          >
            {ROLES[role].icon} {ROLES[role].label}
          </button>
        ))}
      </div>

      {/* Time filter */}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
        {TIME_FILTERS.map((tf) => (
          <button
            key={tf.value}
            onClick={() => onTimeChange(tf.value)}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all',
              selectedTime === tf.value
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-muted-foreground'
            )}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Extra filters */}
      {extraFilters}

      {/* Clear all */}
      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { onRoleChange('all'); onTimeChange('all'); }}
          className="h-7 text-[11px] text-muted-foreground hover:text-muted-foreground"
        >
          <X className="h-3 w-3 mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
}
