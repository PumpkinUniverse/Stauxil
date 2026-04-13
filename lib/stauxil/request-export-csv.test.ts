import { describe, expect, it } from 'vitest'
import { buildRequestsCsv, escapeCsvValue } from '@/lib/stauxil/request-export-csv'

describe('escapeCsvValue', () => {
  it('neutralizes spreadsheet formulas', () => {
    expect(escapeCsvValue('=SUM(A1:A2)')).toBe(`"'=SUM(A1:A2)"`)
    expect(escapeCsvValue('@cmd')).toBe(`"'@cmd"`)
  })

  it('quotes embedded double quotes and normalizes newlines', () => {
    expect(escapeCsvValue('hello "team"\nthere')).toBe('"hello ""team"" there"')
  })
})

describe('buildRequestsCsv', () => {
  it('preserves ordinary text while sanitizing dangerous cells', () => {
    const csv = buildRequestsCsv([
      {
        caseId: 'REQ-123456',
        title: '=2+2',
        requesterLabel: 'Jane Example',
        requesterEmail: 'jane@example.com',
        requestTypeLabel: 'Access',
        statusLabel: 'Received',
        verificationStatusLabel: 'Pending',
        dueAt: 1_700_000_000_000,
        createdAt: 1_700_000_000_000,
        closedAt: null,
        notesSummary: 'Normal note',
        emailSummary: null,
        timelineSummary: 'Line 1\nLine 2',
      },
    ])

    expect(csv).toContain(`"'=2+2"`)
    expect(csv).toContain('"Normal note"')
    expect(csv).toContain('"Line 1 Line 2"')
  })
})
