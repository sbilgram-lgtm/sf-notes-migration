import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AssessmentResult, OBJECT_PREFIX_MAP } from '../types/assessment';
import { formatBytes, formatNumber, pct } from './format';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface ReportMeta {
  orgName: string | null;
  orgId: string | null;
  instanceUrl: string | null;
  isSandbox: boolean;
  instanceName: string | null;
}

function objectLabel(prefix: string): string {
  return OBJECT_PREFIX_MAP[prefix] || `Object (${prefix})`;
}

// ── PDF ───────────────────────────────────────────────────────────────────────

export function generatePDFReport(result: AssessmentResult, meta: ReportMeta): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Header
  doc.setFillColor(26, 47, 78);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('SF Notes & Attachments — Phase 1 Inventory & Assessment', pageWidth / 2, 16, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(168, 196, 224);
  doc.text(`Generated: ${now}`, pageWidth / 2, 24, { align: 'center' });

  const orgParts = [
    meta.orgName ? `Org: ${meta.orgName}${meta.isSandbox ? ' (Sandbox)' : ' (Production)'}` : null,
    meta.orgId ? `Org ID: ${meta.orgId}` : null,
    meta.instanceUrl ? `URL: ${meta.instanceUrl}` : null,
    meta.instanceName ? `Instance: ${meta.instanceName}` : null,
  ].filter(Boolean) as string[];

  doc.setTextColor(200, 220, 240);
  let hy = 30;
  orgParts.forEach(line => { doc.text(line, pageWidth / 2, hy, { align: 'center' }); hy += 5; });

  let y = 48;

  // Summary row
  const totalNotes = result.notes?.total || 0;
  const totalAttach = result.attachments?.total || 0;
  const totalLegacy = totalNotes + totalAttach;
  const totalFiles = result.files?.total || 0;

  doc.setFontSize(13);
  doc.setTextColor(26, 47, 78);
  doc.text('Summary', 14, y);
  y += 6;

  doc.autoTable({
    startY: y,
    head: [['Metric', 'Value']],
    body: [
      ['Total Legacy Notes', formatNumber(totalNotes)],
      ['Total Legacy Attachments', formatNumber(totalAttach)],
      ['Total Legacy Records', formatNumber(totalLegacy)],
      ['Modern Files (ContentDocuments)', formatNumber(totalFiles)],
      ['Attachment Storage', formatBytes(result.attachments?.totalBytes || 0)],
      ['Modern Files Storage', formatBytes(result.files?.totalBytes || 0)],
    ],
    theme: 'grid',
    headStyles: { fillColor: [26, 47, 78], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Notes detail
  doc.setFontSize(13);
  doc.setTextColor(26, 47, 78);
  doc.text('Legacy Notes Detail', 14, y);
  y += 6;

  doc.autoTable({
    startY: y,
    head: [['Check', 'Count', 'Flag']],
    body: [
      ['Total Notes', formatNumber(result.notes?.total || 0), ''],
      ['Private Notes', formatNumber(result.notes?.privateCount || 0), result.notes?.privateCount ? '⚠ Requires handling decision' : '✓ None'],
      ['Notes > 32KB', formatNumber(result.notes?.largeCount || 0), result.notes?.largeCount ? '⚠ ContentNote body limit' : result.notes?.total && result.notes.total > 5000 ? 'Not sampled (>5000 records)' : '✓ None'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [26, 47, 78], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  if (result.notes?.parentBreakdown && Object.keys(result.notes.parentBreakdown).length > 0) {
    doc.autoTable({
      startY: y,
      head: [['Notes by Parent Object', 'Count']],
      body: Object.entries(result.notes.parentBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([prefix, count]) => [objectLabel(prefix), formatNumber(count)]),
      theme: 'striped',
      headStyles: { fillColor: [52, 152, 219], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Attachments detail
  if (y > 220) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.setTextColor(26, 47, 78);
  doc.text('Legacy Attachments Detail', 14, y);
  y += 6;

  doc.autoTable({
    startY: y,
    head: [['Check', 'Value', 'Flag']],
    body: [
      ['Total Attachments', formatNumber(result.attachments?.total || 0), ''],
      ['Total Size', formatBytes(result.attachments?.totalBytes || 0), ''],
      ['Attachments > 25MB', formatNumber(result.attachments?.largeCount || 0), result.attachments?.largeCount ? '⚠ Cannot migrate via REST API' : '✓ None'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [26, 47, 78], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  if (result.attachments?.parentBreakdown && Object.keys(result.attachments.parentBreakdown).length > 0) {
    doc.autoTable({
      startY: y,
      head: [['Attachments by Parent Object', 'Count']],
      body: Object.entries(result.attachments.parentBreakdown)
        .sort((a, b) => b[1] - a[1])
        .map(([prefix, count]) => [objectLabel(prefix), formatNumber(count)]),
      theme: 'striped',
      headStyles: { fillColor: [52, 152, 219], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Org Limits
  if (y > 200) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.setTextColor(26, 47, 78);
  doc.text('Org Limits', 14, y);
  y += 6;

  if (result.limits) {
    const l = result.limits;
    doc.autoTable({
      startY: y,
      head: [['Limit', 'Used', 'Max', 'Usage %']],
      body: [
        ['File Storage (MB)', formatNumber(l.fileStorageUsedMB), formatNumber(l.fileStorageMaxMB), `${pct(l.fileStorageUsedMB, l.fileStorageMaxMB)}%`],
        ['Data Storage (MB)', formatNumber(l.dataStorageUsedMB), formatNumber(l.dataStorageMaxMB), `${pct(l.dataStorageUsedMB, l.dataStorageMaxMB)}%`],
        ['API Requests (Today)', formatNumber(l.apiRequestsUsed), formatNumber(l.apiRequestsMax), `${pct(l.apiRequestsUsed, l.apiRequestsMax)}%`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [26, 47, 78], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Creation Controls
  if (y > 200) { doc.addPage(); y = 20; }
  doc.setFontSize(13);
  doc.setTextColor(26, 47, 78);
  doc.text('Creation Controls', 14, y);
  y += 6;

  if (result.creationControls) {
    const cc = result.creationControls;
    doc.autoTable({
      startY: y,
      head: [['Object', 'Org-Level Creation', 'Status']],
      body: [
        ['Legacy Notes', cc.noteCreateable ? 'Still Createable' : 'Disabled', cc.noteCreateable ? '⚠ New Notes can still be created' : '✓ Creation blocked'],
        ['Attachments', cc.attachCreateable ? 'Still Createable' : 'Disabled', cc.attachCreateable ? '⚠ New Attachments can still be created' : '✓ Creation blocked'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [26, 47, 78], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    if (cc.permissions.length > 0) {
      doc.autoTable({
        startY: y,
        head: [['Profile / Permission Set', 'Type', 'Grants Create On']],
        body: cc.permissions.map(p => [p.name, p.type, p.sObjectType]),
        theme: 'striped',
        headStyles: { fillColor: [231, 76, 60], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });
    } else {
      y = (doc as any).lastAutoTable.finalY + 4;
      doc.setFontSize(9);
      doc.setTextColor(39, 174, 96);
      doc.text('✓ No Profiles or Permission Sets grant Create on Notes or Attachments.', 14, y);
    }
  }

  // Footer on each page
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`SF Notes & Attachments Phase 1 Assessment  |  Page ${i} of ${pageCount}`, pageWidth / 2, 290, { align: 'center' });
  }

  const orgSlug = (meta.orgName || 'org').replace(/\s+/g, '-').toLowerCase();
  doc.save(`notes-assessment-${orgSlug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Excel ─────────────────────────────────────────────────────────────────────

export function generateExcelReport(result: AssessmentResult, meta: ReportMeta): void {
  const wb = XLSX.utils.book_new();
  const now = new Date().toLocaleString();

  // Summary sheet
  const summaryRows = [
    ['SF Notes & Attachments — Phase 1 Inventory & Assessment'],
    ['Generated', now],
    ['Org', meta.orgName || ''],
    ['Org ID', meta.orgId || ''],
    ['URL', meta.instanceUrl || ''],
    ['Sandbox', meta.isSandbox ? 'Yes' : 'No'],
    ['Instance', meta.instanceName || ''],
    [],
    ['SUMMARY', ''],
    ['Total Legacy Notes', result.notes?.total || 0],
    ['Total Legacy Attachments', result.attachments?.total || 0],
    ['Total Legacy Records', (result.notes?.total || 0) + (result.attachments?.total || 0)],
    ['Modern Files (ContentDocuments)', result.files?.total || 0],
    ['Attachment Total Size', formatBytes(result.attachments?.totalBytes || 0)],
    ['Modern Files Total Size', formatBytes(result.files?.totalBytes || 0)],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Notes sheet
  const notesRows = [
    ['Check', 'Count', 'Flag'],
    ['Total Notes', result.notes?.total || 0, ''],
    ['Private Notes', result.notes?.privateCount || 0, result.notes?.privateCount ? 'Requires handling decision before migration' : ''],
    ['Notes > 32KB', result.notes?.largeCount || 0, result.notes?.largeCount ? 'ContentNote body limit — will be flagged at migration' : ''],
    [],
    ['Parent Object Breakdown (sample)', ''],
    ['Object', 'Note Count'],
    ...Object.entries(result.notes?.parentBreakdown || {})
      .sort((a, b) => b[1] - a[1])
      .map(([prefix, count]) => [objectLabel(prefix), count]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(notesRows), 'Notes');

  // Attachments sheet
  const attachRows = [
    ['Check', 'Value', 'Flag'],
    ['Total Attachments', result.attachments?.total || 0, ''],
    ['Total Size', formatBytes(result.attachments?.totalBytes || 0), ''],
    ['Attachments > 25MB', result.attachments?.largeCount || 0, result.attachments?.largeCount ? 'Cannot migrate via standard REST API' : ''],
    [],
    ['Parent Object Breakdown (sample)', ''],
    ['Object', 'Attachment Count'],
    ...Object.entries(result.attachments?.parentBreakdown || {})
      .sort((a, b) => b[1] - a[1])
      .map(([prefix, count]) => [objectLabel(prefix), count]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attachRows), 'Attachments');

  // Org Limits sheet
  if (result.limits) {
    const l = result.limits;
    const limitsRows = [
      ['Limit', 'Used', 'Max', 'Usage %'],
      ['File Storage (MB)', l.fileStorageUsedMB, l.fileStorageMaxMB, `${pct(l.fileStorageUsedMB, l.fileStorageMaxMB)}%`],
      ['Data Storage (MB)', l.dataStorageUsedMB, l.dataStorageMaxMB, `${pct(l.dataStorageUsedMB, l.dataStorageMaxMB)}%`],
      ['API Requests (Today)', l.apiRequestsUsed, l.apiRequestsMax, `${pct(l.apiRequestsUsed, l.apiRequestsMax)}%`],
      ['API Requests Remaining', l.apiRequestsRemaining, l.apiRequestsMax, ''],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(limitsRows), 'Org Limits');
  }

  // Creation Controls sheet
  if (result.creationControls) {
    const cc = result.creationControls;
    const ccRows = [
      ['Object', 'Org-Level Creation', 'Status'],
      ['Legacy Notes', cc.noteCreateable ? 'Still Createable' : 'Disabled', cc.noteCreateable ? 'New Notes can still be created' : 'Creation blocked'],
      ['Attachments', cc.attachCreateable ? 'Still Createable' : 'Disabled', cc.attachCreateable ? 'New Attachments can still be created' : 'Creation blocked'],
      [],
      ['Profile / Permission Set', 'Type', 'Grants Create On'],
      ...cc.permissions.map(p => [p.name, p.type, p.sObjectType]),
    ];
    if (cc.permissions.length === 0) {
      ccRows.push(['No Profiles or Permission Sets grant Create on Notes or Attachments', '', '']);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ccRows), 'Creation Controls');
  }

  const orgSlug = (meta.orgName || 'org').replace(/\s+/g, '-').toLowerCase();
  XLSX.writeFile(wb, `notes-assessment-${orgSlug}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
