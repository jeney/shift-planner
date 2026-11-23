/** Same palette as the backend's demo project. */
export const EMPLOYEE_COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ea580c',
  '#4f46e5',
]

export function nextColor(used: string[]): string {
  return (
    EMPLOYEE_COLORS.find((c) => !used.includes(c)) ??
    EMPLOYEE_COLORS[used.length % EMPLOYEE_COLORS.length]
  )
}
