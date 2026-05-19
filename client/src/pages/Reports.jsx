import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getComplianceStatus, getDepartmentSummary, getAccidentRegister } from '../../services/api';
import { ShieldCheck, CheckCircle, XCircle, Download, FileText } from 'lucide-react';

const Reports = () => {
  const { t } = useAuth();
  const [tab, setTab] = useState('compliance');
  const [compliance, setCompliance] = useState(null);
  const [deptSummary, setDeptSummary] = useState([]);
  const [accidents, setAccidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [tab]);
  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'compliance') { const r = await getComplianceStatus(); setCompliance(r.data.data); }
      else if (tab === 'department') { const r = await getDepartmentSummary(); setDeptSummary(r.data.data); }
      else { const r = await getAccidentRegister({}); setAccidents(r.data.data); }
    } catch(e){} finally { setLoading(false); }
  };

  const exportCSV = (data, filename) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">{t('nav.reports')}</h1><p className="page-subtitle">Compliance status and regulatory reports</p></div>
      </div>

      <div style={{display:'flex',gap:4,marginBottom:24,background:'var(--bg-secondary)',padding:4,borderRadius:10,width:'fit-content'}}>
        {[{key:'compliance',label:'Compliance'},{key:'department',label:'Department Summary'},{key:'accidents',label:'Accident Register'}].map(tb => (
          <button key={tb.key} className={`btn btn-sm ${tab===tb.key?'btn-primary':'btn-ghost'}`} onClick={() => setTab(tb.key)} style={{borderRadius:8}}>{tb.label}</button>
        ))}
      </div>

      {loading ? <div className="page-loader"><div className="spinner"></div></div> : (
        <>
          {tab === 'compliance' && compliance && (
            <div>
              <div className="card" style={{marginBottom:24,textAlign:'center',padding:40}}>
                <div style={{width:120,height:120,borderRadius:'50%',border:`6px solid ${compliance.overallCompliance>=80?'var(--success)':compliance.overallCompliance>=50?'var(--warning)':'var(--danger)'}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',flexDirection:'column'}}>
                  <div style={{fontSize:'2.2rem',fontWeight:800}}>{compliance.overallCompliance}%</div>
                </div>
                <h2 style={{fontSize:'1.2rem',fontWeight:700}}>Overall Compliance Score</h2>
                <p style={{color:'var(--text-secondary)',marginTop:4}}>Based on Factories Act, 1948 requirements</p>
              </div>
              <div className="card">
                <h3 className="card-title" style={{marginBottom:16}}>Compliance Checks</h3>
                <div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {compliance.checks.map((c, i) => (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:16,padding:'12px 16px',background:'var(--bg-tertiary)',borderRadius:8}}>
                      {c.compliant ? <CheckCircle size={20} color="var(--success)" /> : <XCircle size={20} color="var(--danger)" />}
                      <div style={{flex:1}}><div style={{fontWeight:600,fontSize:'0.9rem'}}>{c.rule}</div><div style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>{c.section}</div></div>
                      <div style={{textAlign:'right',fontSize:'0.85rem'}}><span style={{color:c.compliant?'var(--success)':'var(--danger)',fontWeight:700}}>{c.actual}</span> / {c.required}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'department' && (
            <div>
              <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
                <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(deptSummary.map(d=>({Department:d.department.name,Incidents:d.incidentCount,Open:d.openCases,Boxes:d.boxCount,NeedsAttention:d.boxesNeedingAttention,Certified:d.certifiedCount})),'dept_summary.csv')}><Download size={14} /> Export CSV</button>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Department</th><th>Risk</th><th>Workers</th><th>Incidents</th><th>Open Cases</th><th>FA Boxes</th><th>Boxes Needing Attention</th><th>Certified Staff</th></tr></thead>
                  <tbody>{deptSummary.map(d => (
                    <tr key={d.department._id}>
                      <td style={{fontWeight:600}}>{d.department.name}</td>
                      <td><span className={`badge badge-${d.department.riskLevel==='low'?'minor':d.department.riskLevel==='medium'?'moderate':'serious'}`}>{d.department.riskLevel}</span></td>
                      <td>{d.workerCount}</td><td>{d.incidentCount}</td><td>{d.openCases}</td><td>{d.boxCount}</td>
                      <td style={{color:d.boxesNeedingAttention>0?'var(--danger)':'var(--success)'}}>{d.boxesNeedingAttention}</td>
                      <td>{d.certifiedCount}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'accidents' && (
            <div>
              <div style={{display:'flex',justifyContent:'flex-end',marginBottom:16}}>
                <button className="btn btn-ghost btn-sm" onClick={() => exportCSV(accidents.map(a=>({ID:a.incidentId,Date:new Date(a.dateTime).toLocaleDateString(),Person:a.injuredPerson?.name,Severity:a.severity,DaysLost:a.daysLost,Outcome:a.outcome})),'accident_register.csv')}><Download size={14} /> Export CSV</button>
              </div>
              <div className="card" style={{marginBottom:16,padding:'12px 16px',background:'rgba(239,68,68,0.05)',border:'1px solid rgba(239,68,68,0.15)'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,fontSize:'0.85rem',color:'var(--danger)'}}><FileText size={16} /> Showing reportable incidents only (Section 88 — death or 48+ hrs disability)</div>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Incident ID</th><th>Date</th><th>Injured Person</th><th>Department</th><th>Severity</th><th>Days Lost</th><th>Outcome</th><th>Form 18</th></tr></thead>
                  <tbody>{accidents.length === 0 ? <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>No reportable incidents</td></tr> : accidents.map(a => (
                    <tr key={a._id}>
                      <td style={{fontWeight:600,color:'var(--accent)'}}>{a.incidentId}</td>
                      <td>{new Date(a.dateTime).toLocaleDateString()}</td>
                      <td>{a.injuredPerson?.name}</td><td>{a.department?.name}</td>
                      <td><span className={`badge badge-${a.severity}`}>{a.severity}</span></td>
                      <td>{a.daysLost}</td><td style={{textTransform:'capitalize'}}>{a.outcome?.replace(/_/g,' ')}</td>
                      <td>{a.form18Generated ? <CheckCircle size={16} color="var(--success)" /> : <span style={{color:'var(--warning)',fontSize:'0.8rem'}}>Pending</span>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
