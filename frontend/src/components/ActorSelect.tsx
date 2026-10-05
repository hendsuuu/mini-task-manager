import type { User } from '@mtm/shared';

interface Props {
  users: User[];
  value: string;
  onChange: (actor: string) => void;
}

/** Stands in for login: every change is recorded under the user picked here. */
export function ActorSelect({ users, value, onChange }: Props) {
  return (
    <label className="actor">
      Acting as
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.id})
          </option>
        ))}
      </select>
    </label>
  );
}
