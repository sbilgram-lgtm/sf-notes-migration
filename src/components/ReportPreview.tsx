import React from 'react';
import { AssessmentResult, OBJECT_PREFIX_MAP } from '../types/assessment';
import { formatBytes, formatNumber, pct } from '../utils/format';
import { generateExcelReport } from '../utils/reportGenerator';

interface Props {
  result: AssessmentResult;
  meta: { orgName: string | null; orgId: string | null; instanceUrl: string | null; isSandbox: boolean; instanceName: string | null; };
  onClose: () => void;
}

function objectLabel(prefix: string): string {
  return OBJECT_PREFIX_MAP[prefix] || `Object (${prefix})`;
}

function Flag({ text, color }: { text: string; color: string }) {
  return (
    <span style={{ fontSize: '0.75rem', color, fontWeight: 600, marginLeft: '8px' }}>⚠ {text}</span>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 style={{ margin: '24px 0 10px', color: '#1a2f4e', borderBottom: '2px solid #1a2f4e', paddingBottom: '4px', fontSize: '1rem' }}>
      {title}
    </h3>
  );
}

function DataRow({ label, value, flag }: { label: string; value: string; flag?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.88rem' }}>
      <span style={{ color: '#444' }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#1a2f4e' }}>{value}{flag}</span>
    </div>
  );
}

export const ReportPreview: React.FC<Props> = ({ result, meta, onClose }) => {
  const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const totalLegacy = (result.notes?.total || 0) + (result.attachments?.total || 0);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.6)', overflowY: 'auto' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-container { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; max-width: 100% !important; }
          body { background: white !important; }
        }
      `}</style>

      {/* Toolbar */}
      <div className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#1a2f4e',
        padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <span style={{ color: 'white', fontWeight: 600, fontSize: '0.95rem' }}>Report Preview</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => generateExcelReport(result, meta)}
            style={{ backgroundColor: '#27ae60', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Export Excel
          </button>
          <button
            onClick={() => window.print()}
            style={{ backgroundColor: '#e74c3c', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Save / Print PDF
          </button>
          <button
            onClick={onClose}
            style={{ backgroundColor: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.4)', padding: '8px 18px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Report content */}
      <div className="print-container" style={{ maxWidth: '800px', margin: '32px auto 64px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.15)', padding: '48px' }}>

        {/* Report header */}
        <div style={{ textAlign: 'center', marginBottom: '32px', paddingBottom: '24px', borderBottom: '3px solid #1a2f4e' }}>
          <h1 style={{ margin: '0 0 4px', color: '#1a2f4e', fontSize: '1.4rem' }}>
            SF Notes &amp; Attachments
          </h1>
          <h2 style={{ margin: '0 0 12px', color: '#1a2f4e', fontSize: '1rem', fontWeight: 400 }}>
            Phase 1 — Inventory &amp; Assessment
          </h2>
          <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#7f8c8d' }}>Generated: {now}</p>
          {meta.orgName && <p style={{ margin: '0 0 2px', fontSize: '0.85rem', color: '#555', fontWeight: 600 }}>{meta.orgName} {meta.isSandbox ? <span style={{ color: '#f39c12' }}>(Sandbox)</span> : <span style={{ color: '#e74c3c' }}>(Production)</span>}</p>}
          {meta.orgId && <p style={{ margin: '0 0 2px', fontSize: '0.78rem', color: '#95a5a6' }}>Org ID: {meta.orgId}</p>}
          {meta.instanceUrl && <p style={{ margin: '0 0 2px', fontSize: '0.78rem', color: '#95a5a6' }}>{meta.instanceUrl}</p>}
          {meta.instanceName && <p style={{ margin: 0, fontSize: '0.78rem', color: '#95a5a6' }}>Instance: {meta.instanceName}</p>}
        </div>

        {/* Summary */}
        <SectionHeader title="Summary" />
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {[
            { label: 'Legacy Notes', value: formatNumber(result.notes?.total || 0) },
            { label: 'Legacy Attachments', value: formatNumber(result.attachments?.total || 0) },
            { label: 'Total Legacy Records', value: formatNumber(totalLegacy) },
            { label: 'Modern Files', value: formatNumber(result.files?.total || 0) },
          ].map(s => (
            <div key={s.label} style={{ flex: 1, minWidth: '140px', backgroundColor: '#f8fafc', borderRadius: '8px', padding: '14px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a2f4e' }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#7f8c8d', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Notes */}
        <SectionHeader title="Legacy Notes" />
        <DataRow label="Total Notes" value={formatNumber(result.notes?.total || 0)} />
        <DataRow label="Private Notes" value={formatNumber(result.notes?.privateCount || 0)}
          flag={result.notes?.privateCount ? <Flag text="Requires handling decision before migration" color="#e67e22" /> : undefined} />
        <DataRow label="Notes > 32KB" value={formatNumber(result.notes?.largeCount || 0)}
          flag={result.notes?.largeCount ? <Flag text="ContentNote body limit" color="#e74c3c" /> : undefined} />

        {result.notes?.parentBreakdown && Object.keys(result.notes.parentBreakdown).length > 0 && (
          <>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', margin: '14px 0 6px' }}>By Parent Object (sample)</p>
            {Object.entries(result.notes.parentBreakdown).sort((a, b) => b[1] - a[1]).map(([prefix, count]) => (
              <DataRow key={prefix} label={objectLabel(prefix)} value={formatNumber(count)} />
            ))}
          </>
        )}

        {/* Attachments */}
        <SectionHeader title="Legacy Attachments" />
        <DataRow label="Total Attachments" value={formatNumber(result.attachments?.total || 0)} />
        <DataRow label="Total Size" value={formatBytes(result.attachments?.totalBytes || 0)} />
        <DataRow label="Attachments > 25MB" value={formatNumber(result.attachments?.largeCount || 0)}
          flag={result.attachments?.largeCount ? <Flag text="Cannot migrate via standard REST API" color="#e74c3c" /> : undefined} />

        {result.attachments?.parentBreakdown && Object.keys(result.attachments.parentBreakdown).length > 0 && (
          <>
            <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', margin: '14px 0 6px' }}>By Parent Object (sample)</p>
            {Object.entries(result.attachments.parentBreakdown).sort((a, b) => b[1] - a[1]).map(([prefix, count]) => (
              <DataRow key={prefix} label={objectLabel(prefix)} value={formatNumber(count)} />
            ))}
          </>
        )}

        {/* Modern Files */}
        <SectionHeader title="Modern Salesforce Files (Baseline)" />
        <DataRow label="ContentDocuments (Files)" value={formatNumber(result.files?.total || 0)} />
        <DataRow label="Total Files Storage Used" value={formatBytes(result.files?.totalBytes || 0)} />

        {/* Org Limits */}
        <SectionHeader title="Org Limits" />
        {result.limits && (() => {
          const l = result.limits!;
          return (
            <>
              <DataRow label="File Storage" value={`${formatNumber(l.fileStorageUsedMB)} / ${formatNumber(l.fileStorageMaxMB)} MB (${pct(l.fileStorageUsedMB, l.fileStorageMaxMB)}%)`}
                flag={pct(l.fileStorageUsedMB, l.fileStorageMaxMB) >= 85 ? <Flag text="Critical" color="#e74c3c" /> : pct(l.fileStorageUsedMB, l.fileStorageMaxMB) >= 65 ? <Flag text="Warning" color="#f39c12" /> : undefined} />
              <DataRow label="Data Storage" value={`${formatNumber(l.dataStorageUsedMB)} / ${formatNumber(l.dataStorageMaxMB)} MB (${pct(l.dataStorageUsedMB, l.dataStorageMaxMB)}%)`}
                flag={pct(l.dataStorageUsedMB, l.dataStorageMaxMB) >= 85 ? <Flag text="Critical" color="#e74c3c" /> : undefined} />
              <DataRow label="API Requests Remaining Today" value={`${formatNumber(l.apiRequestsRemaining)} of ${formatNumber(l.apiRequestsMax)}`}
                flag={pct(l.apiRequestsUsed, l.apiRequestsMax) >= 80 ? <Flag text="Low" color="#e74c3c" /> : undefined} />
            </>
          );
        })()}

        {/* Creation Controls */}
        <SectionHeader title="Creation Controls" />
        {result.creationControls && (() => {
          const cc = result.creationControls!;
          const notePerms = cc.permissions.filter(p => p.sObjectType === 'Note');
          const attachPerms = cc.permissions.filter(p => p.sObjectType === 'Attachment');
          return (
            <>
              <DataRow label="Legacy Notes — Org Setting" value={cc.noteCreateable ? 'Still Createable' : 'Creation Disabled'}
                flag={cc.noteCreateable ? <Flag text="New Notes can still be created" color="#e74c3c" /> : undefined} />
              <DataRow label="Attachments — Org Setting" value={cc.attachCreateable ? 'Still Createable' : 'Creation Disabled'}
                flag={cc.attachCreateable ? <Flag text="New Attachments can still be created" color="#e74c3c" /> : undefined} />

              {cc.permissions.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: '#27ae60', margin: '10px 0 0' }}>✓ No Profiles or Permission Sets grant Create on Notes or Attachments.</p>
              ) : (
                <>
                  {[{ label: 'Notes — Create Permission', perms: notePerms }, { label: 'Attachments — Create Permission', perms: attachPerms }].map(({ label, perms }) =>
                    perms.length > 0 && (
                      <div key={label} style={{ marginTop: '12px' }}>
                        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e74c3c', margin: '0 0 6px' }}>{label}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {perms.map((p, i) => (
                            <span key={i} style={{
                              backgroundColor: p.type === 'Profile' ? '#fdf0ed' : '#fef9e7',
                              color: p.type === 'Profile' ? '#c0392b' : '#7d6608',
                              border: `1px solid ${p.type === 'Profile' ? '#f5c6c0' : '#f0e68c'}`,
                              borderRadius: '4px', fontSize: '0.75rem', padding: '3px 8px', fontWeight: 500
                            }}>
                              {p.type === 'Profile' ? '👤' : '🔑'} {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </>
              )}
            </>
          );
        })()}

        {/* Footer */}
        <div style={{ marginTop: '40px', paddingTop: '16px', borderTop: '1px solid #eee', textAlign: 'center', fontSize: '0.75rem', color: '#bdc3c7' }}>
          SF Notes &amp; Attachments Phase 1 Inventory &amp; Assessment &nbsp;|&nbsp; Read-only — no changes were made to your org
        </div>
      </div>
    </div>
  );
};
