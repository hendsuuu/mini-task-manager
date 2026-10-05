import type { User } from '@mtm/shared';

/** Predefined users (no auth, as the brief allows). The id is what the audit log records. */
export const USERS: readonly User[] = [
  { id: 'john.doe', name: 'John Doe' },
  { id: 'jane.smith', name: 'Jane Smith' },
  { id: 'budi.santoso', name: 'Budi Santoso' },
  { id: 'siti.rahma', name: 'Siti Rahma' },
];
