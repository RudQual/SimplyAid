import { useState, useEffect } from 'react';
import { getCompanyCompliance, getDepartmentCompliance, runComplianceCheck } from '../services/api';
import { ShieldCheck, AlertTriangle, CheckCircle, XCircle, RefreshCw, Users, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import './ComplianceDashboard.css';

const ComplianceDashboard = () => {
  const [company, setCompany] = useState(null);
  const [departments, setDepartments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [compRes, deptRes] = await Promise.all([
        getCompanyCompliance().catch(() => ({ data: { data: null } })),
        getDepartmentCompliance().catch(() => ({ data: { data: null } }))
      ]);
      setCompany(compRes.data.data);
      setDepartments(deptRes.data.data);
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleCheck = async () => {
    try {
      setChecking(true);
      const res = await runComplianceCheck();
      toast.success(res.data.message);
      loadData();
    } catch (e) { toast.error('Failed to run compliance check'); }
    finally { setChecking(false); }
  };

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  const statusIcon = (status) => {
    if (status === 'green') return <CheckCircle size={18} className="compliance-icon green" />;
    if (status === 'yellow') return <AlertTriangle size={18} className="compliance-icon amber" />;
    return <XCircle size={18} className="compliance-icon red" />;
  };

  const scoreColor = (score) => score >= 80 ? 'green' : score >= 50 ? 'amber' : 'red';

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Compliance Dashboard</h1>
          <p className="page-subtitle">Automated compliance evaluation — Factories Act Section 45</p>
        </div>
        <button className="btn btn-primary" onClick={handleCheck} disabled={checking}>
          <RefreshCw size={18} className={checking ? 'spinning' : ''} />{checking ? 'Checking...' : 'Run Compliance Check'}
        </button>
      </div>

      {company && (
        <>
          {/* Overall Score */}
          <div className="compliance-score-card" style={{ marginBottom: 24 }}>
            <div className={`score-circle ${scoreColor(company.overallCompliance)}`}>
              <span className="score-value">{company.overallCompliance}%</span>
              <span className="score-label">Overall</span>
            </div>
            <div className="score-details">
              <h3>Company Compliance Status</h3>
              <p className={`status-text ${company.overallStatus}`}>
                {company.overallStatus === 'green' ? 'Fully Compliant' : company.overallStatus === 'yellow' ? 'Near Compliance' : 'Non-Compliant'}
              </p>
              <div className="score-summary-grid">
                <div className="score-summary-item"><Users size={16} /><span>{company.summary.totalWorkers} Workers</span></div>
                <div className="score-summary-item"><Package size={16} /><span>{company.summary.activeBoxes}/{company.summary.requiredBoxes} Boxes</span></div>
                <div className="score-summary-item"><ShieldCheck size={16} /><span>{company.summary.certifiedPersons} Certified</span></div>
              </div>
            </div>
          </div>

          {/* Compliance Checks */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>Compliance Checks</h3>
            <div className="compliance-checks">
              {company.checks.map((check, i) => (
                <div key={i} className={`compliance-check-row ${check.compliant ? 'pass' : 'fail'}`}>
                  {statusIcon(check.status)}
                  <div className="check-info">
                    <div className="check-rule">{check.rule}</div>
                    <div className="check-section">{check.section}</div>
                  </div>
                  <div className="check-values">
                    <span className="check-actual">{check.actual}</span>
                    <span className="check-separator">/</span>
                    <span className="check-required">{check.required}</span>
                  </div>
                  <span className={`badge badge-${check.status === 'green' ? 'green' : check.status === 'yellow' ? 'amber' : 'red'}`}>
                    {check.compliant ? 'Pass' : 'Fail'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Actions */}
          {company.pendingActions.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <h3 className="card-title" style={{ marginBottom: 16 }}>Pending Actions</h3>
              {company.pendingActions.map((action, i) => (
                <div key={i} className="pending-action">
                  <AlertTriangle size={16} color="var(--warning)" />
                  <span>{action}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Department Compliance */}
      {departments && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Department Rankings</h3>
            {departments.riskAreas.length > 0 && (
              <span className="badge badge-red">{departments.riskAreas.length} Risk Area(s)</span>
            )}
          </div>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr><th>Department</th><th>Score</th><th>Employees</th><th>Boxes</th><th>Required</th><th>Inspections</th><th>Status</th></tr>
              </thead>
              <tbody>
                {departments.departments.map((d, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{d.department.name}</td>
                    <td><div className="score-bar"><div className={`score-bar-fill ${scoreColor(d.complianceScore)}`} style={{ width: `${d.complianceScore}%` }}></div><span>{d.complianceScore}%</span></div></td>
                    <td>{d.employeeCount}</td>
                    <td>{d.availableBoxes}</td>
                    <td>{d.requiredBoxes}</td>
                    <td>{d.overdueInspections > 0 ? <span className="badge badge-red">{d.overdueInspections} overdue</span> : <span className="badge badge-green">OK</span>}</td>
                    <td><span className={`badge badge-${d.status === 'green' ? 'green' : d.status === 'yellow' ? 'amber' : 'red'}`}>{d.status === 'green' ? 'Compliant' : d.status === 'yellow' ? 'Warning' : 'Critical'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComplianceDashboard;
