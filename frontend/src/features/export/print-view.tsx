import { createPortal } from 'react-dom'

import type { ExportTable } from './table'

/**
 * The plan laid out for A4 landscape. Hidden on screen; when printing, the app is hidden
 * and only this is shown (see index.css @media print).
 */
export function PrintView({ table }: { table: ExportTable }) {
  return createPortal(
    <div className="print-only" data-testid="print-view">
      <h1>{table.title}</h1>
      <p className="print-subtitle">{table.subtitle}</p>
      <table>
        <thead>
          <tr>
            <th className="print-name">{table.nameHeader}</th>
            {table.days.map((d) => (
              <th key={d.day} className={d.shaded ? 'print-shaded' : undefined}>
                <span>{d.weekday}</span>
                <br />
                {d.day}
              </th>
            ))}
            {table.summaryHeaders.map((h) => (
              <th key={h} className="print-sum">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.name}>
              <th className="print-name">{row.name}</th>
              {row.cells.map((cell, i) => (
                <td key={i} className={table.days[i].shaded ? 'print-shaded' : undefined}>
                  {cell.split(', ').map((part) => {
                    const [start, end] = part.split('–')
                    return part ? (
                      <span key={part} className="print-shift">
                        {start}
                        <br />
                        {end}
                      </span>
                    ) : null
                  })}
                </td>
              ))}
              {row.summary.map((n, i) => (
                <td key={i} className="print-sum">
                  {n ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {table.footer.map((f) => (
            <tr key={f.label}>
              <th className="print-name">{f.label}</th>
              {f.values.map((v, i) => (
                <td key={i} className={table.days[i].shaded ? 'print-shaded' : undefined}>
                  {v}
                </td>
              ))}
              <td colSpan={table.summaryHeaders.length} />
            </tr>
          ))}
        </tfoot>
      </table>
      <ul className="print-legend">
        {table.legend.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>,
    document.body,
  )
}
