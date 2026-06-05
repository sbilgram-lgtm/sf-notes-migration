import React, { useEffect, useState, useCallback } from 'react';
import { assessNotes, assessAttachments, assessFiles, assessLimits, assessCreationControls, getAuthStatus } from '../services/api';
import { AssessmentResult, AuthStatus, OBJECT_PREFIX_MAP } from '../types/assessment';
import { generateExcelReport } from '../utils/reportGenerator';
import { ReportPreview } from '../components/ReportPreview';
import { formatBytes, formatNumber, pct } from '../utils/format';

type LoadState = 'idle' | 'loading' | 'done' | 'error';

interface SectionState { state: LoadState; error?: string; }

const card: React.CSSProperties = {
  backgroundColor: 'white', borderRadius: '12px',
  padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  marginBottom: '20px'
};

const statBox: React.CSSProperties = {
  backgroundColor: '#f8fafc', borderRadius: '8px',
  padding: '16px 20px', flex: 1, minWidth: '160px'
};

function StatusBadge({ state }: { state: LoadState }) {
  const map: Record<LoadState, { label: string; color: string; bg: string }> = {
    idle:    { label: 'Pending',  color: '#7f8c8d', bg: '#f0f0f0' },
    loading: { label: 'Running…', color: '#2980b9', bg: '#eaf4fb' },
    done:    { label: 'Complete', color: '#27ae60', bg: '#eafaf1' },
    error:   { label: 'Error',    color: '#e74c3c', bg: '#fdf0ed' }
  };
  const s = map[state];
  return (
    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: s.color, backgroundColor: s.bg, padding: '3px 10px', borderRadius: '20px' }}>
      {s.label}
    </span>
  );
}

function StorageBar({ used, max, label }: { used: number; max: number; label: string }) {
  const p = pct(used, max);
  const color = p >= 85 ? '#e74c3c' : p >= 65 ? '#f39c12' : '#27ae60';
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#555', marginBottom: '4px' }}>
        <span>{label}</span>
        <span>{used.toLocaleString()} / {max.toLocaleString()} MB ({p}%)</span>
      </div>
      <div style={{ height: '8px', backgroundColor: '#eee', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(p, 100)}%`, backgroundColor: color, borderRadius: '4px', transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

function ParentBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!entries.length) return null;
  const maxVal = entries[0][1];
  return (
    <div style={{ marginTop: '16px' }}>
      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '8px' }}>By Parent Object</p>
      {entries.map(([prefix, count]) => {
        const name = OBJECT_PREFIX_MAP[prefix] || `Object (${prefix})`;
        const w = pct(count, maxVal);
        return (
          <div key={prefix} style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#555', marginBottom: '2px' }}>
              <span>{name}</span><span>{formatNumber(count)}</span>
            </div>
            <div style={{ height: '6px', backgroundColor: '#eee', borderRadius: '3px' }}>
              <div style={{ height: '100%', width: `${w}%`, backgroundColor: '#3498db', borderRadius: '3px' }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const DashboardPage: React.FC = () => {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [result, setResult] = useState<AssessmentResult>({ notes: null, attachments: null, files: null, limits: null, creationControls: null });
  const [sections, setSections] = useState<Record<string, SectionState>>({
    notes: { state: 'idle' }, attachments: { state: 'idle' },
    files: { state: 'idle' }, limits: { state: 'idle' }, creationControls: { state: 'idle' }
  });
  const [running, setRunning] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    getAuthStatus().then(setAuthStatus).catch(() => {});
  }, []);

  const setSection = useCallback((key: string, state: LoadState, error?: string) => {
    setSections(prev => ({ ...prev, [key]: { state, error } }));
  }, []);

  const runAssessment = async () => {
    setRunning(true);
    setSections({ notes: { state: 'idle' }, attachments: { state: 'idle' }, files: { state: 'idle' }, limits: { state: 'idle' }, creationControls: { state: 'idle' } });
    setResult({ notes: null, attachments: null, files: null, limits: null, creationControls: null });

    // Run all four in parallel
    const run = async (key: string, fn: () => Promise<any>, setter: (v: any) => void) => {
      setSection(key, 'loading');
      try {
        const data = await fn();
        setter(data);
        setSection(key, 'done');
      } catch (e: any) {
        setSection(key, 'error', e.message);
      }
    };

    await Promise.all([
      run('notes',            assessNotes,            (v) => setResult(r => ({ ...r, notes: v }))),
      run('attachments',      assessAttachments,      (v) => setResult(r => ({ ...r, attachments: v }))),
      run('files',            assessFiles,            (v) => setResult(r => ({ ...r, files: v }))),
      run('limits',           assessLimits,           (v) => setResult(r => ({ ...r, limits: v }))),
      run('creationControls', assessCreationControls, (v) => setResult(r => ({ ...r, creationControls: v }))),
    ]);

    setRunning(false);
  };

  const isProduction = authStatus && !authStatus.isSandbox;
  const allDone = Object.values(sections).every(s => s.state === 'done' || s.state === 'error');
  const anyRun = Object.values(sections).some(s => s.state !== 'idle');

  const totalLegacy = (result.notes?.total || 0) + (result.attachments?.total || 0);
  const estimatedMinutes = Math.ceil(totalLegacy / 200 * 0.5); // rough: 200 records/batch, ~30s/batch

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '32px 20px' }}>

      {/* Production warning */}
      {isProduction && (
        <div style={{
          backgroundColor: '#fff3cd', border: '1px solid #f39c12', borderRadius: '8px',
          padding: '14px 18px', marginBottom: '24px', fontSize: '0.88rem', color: '#856404'
        }}>
          <strong>⚠️ Production Org</strong> — This org is identified as a production environment. Assessment is read-only and safe, but review all flags carefully before any future migration.
        </div>
      )}

      {/* Org info + Run button */}
      <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#1a2f4e', fontSize: '1.2rem' }}>
            {authStatus?.orgName || 'Connected Org'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#7f8c8d' }}>
            {authStatus?.instanceUrl} &middot; {authStatus?.instanceName}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={runAssessment}
            disabled={running}
            style={{
              backgroundColor: running ? '#95a5a6' : '#1a2f4e', color: 'white', border: 'none',
              padding: '12px 28px', borderRadius: '8px', fontSize: '0.95rem',
              fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer'
            }}
          >
            {running ? 'Running Assessment…' : anyRun ? 'Re-run Assessment' : 'Run Assessment'}
          </button>
          {allDone && anyRun && (
            <button
              onClick={() => setShowPreview(true)}
              style={{
                backgroundColor: '#8e44ad', color: 'white', border: 'none',
                padding: '12px 20px', borderRadius: '8px', fontSize: '0.95rem',
                fontWeight: 600, cursor: 'pointer'
              }}
            >
              Preview &amp; Export
            </button>
          )}
        </div>
      </div>

      {/* Summary row — only after all done */}
      {allDone && anyRun && (
        <div style={{ ...card, backgroundColor: '#1a2f4e', color: 'white' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '1rem', opacity: 0.85 }}>Assessment Summary</h3>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { label: 'Legacy Notes', value: formatNumber(result.notes?.total || 0), flag: result.notes?.privateCount ? `${result.notes.privateCount} private` : null },
              { label: 'Attachments', value: formatNumber(result.attachments?.total || 0), flag: result.attachments?.largeCount ? `${result.attachments.largeCount} >25MB` : null },
              { label: 'Total Legacy', value: formatNumber(totalLegacy) },
              { label: 'Modern Files', value: formatNumber(result.files?.total || 0) },
              { label: 'Est. Migration Time', value: totalLegacy > 0 ? `~${estimatedMinutes} min` : 'N/A' },
            ].map(s => (
              <div key={s.label} style={{ ...statBox, backgroundColor: 'rgba(255,255,255,0.08)', flex: '1', minWidth: '130px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: '0.78rem', opacity: 0.7, marginTop: '2px' }}>{s.label}</div>
                {s.flag && <div style={{ fontSize: '0.72rem', color: '#f39c12', marginTop: '4px' }}>⚠️ {s.flag}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes section */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#1a2f4e' }}>Legacy Notes</h3>
          <StatusBadge state={sections.notes.state} />
        </div>
        {sections.notes.state === 'error' && (
          <p style={{ color: '#e74c3c', fontSize: '0.85rem' }}>Error: {sections.notes.error}</p>
        )}
        {result.notes && (
          <>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={statBox}><div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a2f4e' }}>{formatNumber(result.notes.total)}</div><div style={{ fontSize: '0.78rem', color: '#7f8c8d' }}>Total Notes</div></div>
              <div style={statBox}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: result.notes.privateCount > 0 ? '#e67e22' : '#27ae60' }}>{formatNumber(result.notes.privateCount)}</div>
                <div style={{ fontSize: '0.78rem', color: '#7f8c8d' }}>Private Notes</div>
                {result.notes.privateCount > 0 && <div style={{ fontSize: '0.72rem', color: '#e67e22', marginTop: '4px' }}>Requires handling decision before migration</div>}
              </div>
              <div style={statBox}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: result.notes.largeCount > 0 ? '#e74c3c' : '#27ae60' }}>{formatNumber(result.notes.largeCount)}</div>
                <div style={{ fontSize: '0.78rem', color: '#7f8c8d' }}>Notes &gt;32KB</div>
                {result.notes.largeCount > 0 && <div style={{ fontSize: '0.72rem', color: '#e74c3c', marginTop: '4px' }}>ContentNote body limit — will be flagged at migration</div>}
              </div>
            </div>
            <ParentBreakdown breakdown={result.notes.parentBreakdown} />
          </>
        )}
        {sections.notes.state === 'idle' && <p style={{ color: '#bdc3c7', fontSize: '0.85rem', margin: 0 }}>Click Run Assessment to begin.</p>}
        {sections.notes.state === 'loading' && <p style={{ color: '#3498db', fontSize: '0.85rem', margin: 0 }}>Querying Notes…</p>}
      </div>

      {/* Attachments section */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#1a2f4e' }}>Legacy Attachments</h3>
          <StatusBadge state={sections.attachments.state} />
        </div>
        {sections.attachments.state === 'error' && (
          <p style={{ color: '#e74c3c', fontSize: '0.85rem' }}>Error: {sections.attachments.error}</p>
        )}
        {result.attachments && (
          <>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={statBox}><div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a2f4e' }}>{formatNumber(result.attachments.total)}</div><div style={{ fontSize: '0.78rem', color: '#7f8c8d' }}>Total Attachments</div></div>
              <div style={statBox}><div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a2f4e' }}>{formatBytes(result.attachments.totalBytes)}</div><div style={{ fontSize: '0.78rem', color: '#7f8c8d' }}>Total Size</div></div>
              <div style={statBox}>
                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: result.attachments.largeCount > 0 ? '#e74c3c' : '#27ae60' }}>{formatNumber(result.attachments.largeCount)}</div>
                <div style={{ fontSize: '0.78rem', color: '#7f8c8d' }}>Attachments &gt;25MB</div>
                {result.attachments.largeCount > 0 && <div style={{ fontSize: '0.72rem', color: '#e74c3c', marginTop: '4px' }}>Exceed REST API limit — cannot be migrated via standard API</div>}
              </div>
            </div>
            <ParentBreakdown breakdown={result.attachments.parentBreakdown} />
          </>
        )}
        {sections.attachments.state === 'idle' && <p style={{ color: '#bdc3c7', fontSize: '0.85rem', margin: 0 }}>Click Run Assessment to begin.</p>}
        {sections.attachments.state === 'loading' && <p style={{ color: '#3498db', fontSize: '0.85rem', margin: 0 }}>Querying Attachments…</p>}
      </div>

      {/* Modern Files section */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#1a2f4e' }}>Modern Salesforce Files</h3>
          <StatusBadge state={sections.files.state} />
        </div>
        {sections.files.state === 'error' && (
          <p style={{ color: '#e74c3c', fontSize: '0.85rem' }}>Error: {sections.files.error}</p>
        )}
        {result.files && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={statBox}><div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#27ae60' }}>{formatNumber(result.files.total)}</div><div style={{ fontSize: '0.78rem', color: '#7f8c8d' }}>ContentDocuments (Files)</div></div>
            <div style={statBox}><div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#27ae60' }}>{formatBytes(result.files.totalBytes)}</div><div style={{ fontSize: '0.78rem', color: '#7f8c8d' }}>Total Files Storage Used</div></div>
          </div>
        )}
        {sections.files.state === 'idle' && <p style={{ color: '#bdc3c7', fontSize: '0.85rem', margin: 0 }}>Click Run Assessment to begin.</p>}
        {sections.files.state === 'loading' && <p style={{ color: '#3498db', fontSize: '0.85rem', margin: 0 }}>Querying ContentDocuments…</p>}
      </div>

      {/* Org Limits section */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#1a2f4e' }}>Org Limits</h3>
          <StatusBadge state={sections.limits.state} />
        </div>
        {sections.limits.state === 'error' && (
          <p style={{ color: '#e74c3c', fontSize: '0.85rem' }}>Error: {sections.limits.error}</p>
        )}
        {result.limits && (
          <>
            <StorageBar used={result.limits.fileStorageUsedMB} max={result.limits.fileStorageMaxMB} label="File Storage" />
            <StorageBar used={result.limits.dataStorageUsedMB} max={result.limits.dataStorageMaxMB} label="Data Storage" />
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px' }}>
              <div style={statBox}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: pct(result.limits.apiRequestsUsed, result.limits.apiRequestsMax) > 80 ? '#e74c3c' : '#1a2f4e' }}>
                  {formatNumber(result.limits.apiRequestsRemaining)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#7f8c8d' }}>API Requests Remaining Today</div>
                <div style={{ fontSize: '0.72rem', color: '#95a5a6', marginTop: '2px' }}>{formatNumber(result.limits.apiRequestsMax)} daily limit</div>
              </div>
            </div>
          </>
        )}
        {sections.limits.state === 'idle' && <p style={{ color: '#bdc3c7', fontSize: '0.85rem', margin: 0 }}>Click Run Assessment to begin.</p>}
        {sections.limits.state === 'loading' && <p style={{ color: '#3498db', fontSize: '0.85rem', margin: 0 }}>Checking limits…</p>}
      </div>

      {/* Creation Controls section */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, color: '#1a2f4e' }}>Creation Controls</h3>
          <StatusBadge state={sections.creationControls.state} />
        </div>
        {sections.creationControls.state === 'error' && (
          <p style={{ color: '#e74c3c', fontSize: '0.85rem' }}>Error: {sections.creationControls.error}</p>
        )}
        {result.creationControls && (() => {
          const cc = result.creationControls!;
          const notePerms = cc.permissions.filter(p => p.sObjectType === 'Note');
          const attachPerms = cc.permissions.filter(p => p.sObjectType === 'Attachment');
          return (
            <>
              {/* Org-level createable flags */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div style={{ ...statBox, flex: 1 }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: cc.noteCreateable ? '#e74c3c' : '#27ae60' }}>
                    {cc.noteCreateable ? 'Still Createable' : 'Creation Disabled'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#7f8c8d', marginTop: '2px' }}>Legacy Notes — Org Setting</div>
                  {cc.noteCreateable && <div style={{ fontSize: '0.72rem', color: '#e74c3c', marginTop: '4px' }}>New Notes can still be created in this org</div>}
                </div>
                <div style={{ ...statBox, flex: 1 }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: cc.attachCreateable ? '#e74c3c' : '#27ae60' }}>
                    {cc.attachCreateable ? 'Still Createable' : 'Creation Disabled'}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#7f8c8d', marginTop: '2px' }}>Attachments — Org Setting</div>
                  {cc.attachCreateable && <div style={{ fontSize: '0.72rem', color: '#e74c3c', marginTop: '4px' }}>New Attachments can still be created in this org</div>}
                </div>
              </div>

              {/* Profiles / Permission Sets with Create permission */}
              {cc.permissions.length === 0 ? (
                <div style={{ backgroundColor: '#eafaf1', borderRadius: '8px', padding: '12px 16px', fontSize: '0.85rem', color: '#27ae60' }}>
                  No Profiles or Permission Sets grant Create on Notes or Attachments.
                </div>
              ) : (
                <>
                  <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#555', margin: '0 0 10px' }}>
                    Profiles &amp; Permission Sets with Create permission
                  </p>
                  {[{ label: 'Notes', perms: notePerms }, { label: 'Attachments', perms: attachPerms }].map(({ label, perms }) =>
                    perms.length > 0 && (
                      <div key={label} style={{ marginBottom: '14px' }}>
                        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e74c3c', margin: '0 0 6px' }}>{label}</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {perms.map((p, i) => (
                            <span key={i} style={{
                              backgroundColor: p.type === 'Profile' ? '#fdf0ed' : '#fef9e7',
                              color: p.type === 'Profile' ? '#c0392b' : '#7d6608',
                              border: `1px solid ${p.type === 'Profile' ? '#f5c6c0' : '#f0e68c'}`,
                              borderRadius: '4px', fontSize: '0.75rem',
                              padding: '3px 8px', fontWeight: 500
                            }}>
                              {p.type === 'Profile' ? '👤' : '🔑'} {p.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                  <p style={{ fontSize: '0.72rem', color: '#95a5a6', margin: '8px 0 0' }}>
                    👤 Profile &nbsp;|&nbsp; 🔑 Permission Set — review these in Setup → Profiles / Permission Sets to remove Create access.
                  </p>
                </>
              )}
            </>
          );
        })()}
        {sections.creationControls.state === 'idle' && <p style={{ color: '#bdc3c7', fontSize: '0.85rem', margin: 0 }}>Click Run Assessment to begin.</p>}
        {sections.creationControls.state === 'loading' && <p style={{ color: '#3498db', fontSize: '0.85rem', margin: 0 }}>Checking creation controls…</p>}
      </div>

      {showPreview && (
        <ReportPreview
          result={result}
          meta={{
            orgName: authStatus?.orgName || null,
            orgId: authStatus?.orgId || null,
            instanceUrl: authStatus?.instanceUrl || null,
            isSandbox: authStatus?.isSandbox || false,
            instanceName: authStatus?.instanceName || null,
          }}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
};
