import type { MemoryType } from '../types/api';

export const MEMORY_TYPE_OPTIONS: Array<{ value: MemoryType; label: string }> = [
  { value: 'preference', label: 'Preferences' },
  { value: 'approval', label: 'Approvals' },
  { value: 'rejection', label: 'Rejections' },
  { value: 'decision', label: 'Decisions' },
  { value: 'constraint', label: 'Constraints' },
  { value: 'outcome', label: 'Outcomes' },
  { value: 'preference_change', label: 'Preference changes' },
];
