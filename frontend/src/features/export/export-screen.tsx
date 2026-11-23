import { FileSpreadsheet, FileText, Loader2, Printer, Table2 } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useMonthCalendar } from '@/api/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useValidate } from '@/features/plan/use-validate'
import { useFormat } from '@/lib/format'
import { useProject } from '@/project/hooks'

import { downloadBytes, MIME } from './download'
import { buildOds } from './ods'
import { PrintView } from './print-view'
import { buildExportTable, exportFileName } from './table'
import { buildXlsx } from './xlsx'

export function ExportScreen() {
  const { t } = useTranslation()
  const format = useFormat()
  const project = useProject()
  const calendar = useMonthCalendar(project.month)
  const validate = useValidate(project)

  const table = useMemo(() => {
    if (!calendar.data || !validate.data || !project.plan) return null
    const stats = new Map(validate.data.stats.map((s) => [s.employeeId, s]))
    return buildExportTable(project, calendar.data.days, stats, t, format)
  }, [calendar.data, validate.data, project, t, format])

  if (!project.plan || project.plan.shifts.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
        <Table2 aria-hidden className="size-8 opacity-40" />
        <p className="font-medium text-foreground">{t('export.noPlanTitle')}</p>
        <p className="max-w-sm text-sm">{t('export.noPlanBody')}</p>
      </Card>
    )
  }

  const download = (kind: 'ods' | 'xlsx') => {
    if (!table) return
    const bytes =
      kind === 'ods'
        ? buildOds(table, t('export.sheetName'))
        : buildXlsx(table, t('export.sheetName'))
    const file = exportFileName(project, kind)
    downloadBytes(bytes, file, MIME[kind])
    toast.success(t('export.downloaded', { file }))
  }

  const people = new Set(project.plan.shifts.map((s) => s.employeeId)).size
  const ready = table !== null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('export.title')}</CardTitle>
        <CardDescription>{t('export.description')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <p className="text-sm">
          {t('export.summary', { count: project.plan.shifts.length, people })}
          {!ready && (
            <span className="ml-2 inline-flex items-center gap-1.5 text-muted-foreground">
              <Loader2 aria-hidden className="size-3.5 animate-spin" />
              {t('export.waiting')}
            </span>
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Button
            size="lg"
            variant="outline"
            disabled={!ready}
            onClick={() => window.print()}
            className="h-auto flex-col gap-1.5 py-4"
          >
            <Printer aria-hidden className="size-5" />
            {t('export.print')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={!ready}
            onClick={() => download('ods')}
            className="h-auto flex-col gap-1.5 py-4"
          >
            <FileText aria-hidden className="size-5" />
            {t('export.ods')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={!ready}
            onClick={() => download('xlsx')}
            className="h-auto flex-col gap-1.5 py-4"
          >
            <FileSpreadsheet aria-hidden className="size-5" />
            {t('export.xlsx')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('export.printHelp')}</p>
        {table && <PrintView table={table} />}
      </CardContent>
    </Card>
  )
}
