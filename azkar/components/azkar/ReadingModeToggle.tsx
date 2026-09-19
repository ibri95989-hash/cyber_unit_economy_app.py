'use client';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { ReadingMode } from '@/types/settings';

const OPTIONS = [
  { value: 'list' as const, label: 'Список' },
  { value: 'single' as const, label: 'По одному' },
];

interface ReadingModeToggleProps {
  value: ReadingMode;
  onChange: (mode: ReadingMode) => void;
  className?: string;
}

export function ReadingModeToggle({ value, onChange, className }: ReadingModeToggleProps) {
  return (
    <SegmentedControl
      label="Режим чтения"
      value={value}
      options={OPTIONS}
      onChange={onChange}
      {...(className ? { className } : {})}
    />
  );
}
