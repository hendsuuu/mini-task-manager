const pad = (n: number) => String(n).padStart(2, '0');

/** Local time as "2025-01-01 10:00:00". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
