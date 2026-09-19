'use client';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { ThemePreference } from '@/types/settings';

const OPTIONS = [
  { value: 'auto' as const, label: 'Авто', ariaLabel: 'Тема как в системе' },
  { value: 'light' as const, label: 'Светлая' },
  { value: 'dark' as const, label: 'Тёмная' },
];

interface ThemeToggleProps {
  value: ThemePreference;
  onChange: (value: ThemePreference) => void;
}

export function ThemeToggle({ value, onChange }: ThemeToggleProps) {
  return (
    <div className="px-4 py-3.5">
      <p className="mb-2 text-[0.9375rem] font-semibold text-ink">Тема оформления</p>
      <SegmentedControl label="Тема оформления" value={value} options={OPTIONS} onChange={onChange} />
    </div>
  );
}
