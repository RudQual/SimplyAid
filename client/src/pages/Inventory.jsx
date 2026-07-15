import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useScanner } from '../contexts/ScannerContext';
import { getBoxes, inspectBox } from '../services/api';
import { Package, MapPin, User, Calendar, CheckCircle, AlertTriangle, XCircle, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

const statusIcon = { adequate: <CheckCircle size={16} />, needs_replenishment: <AlertTriangle size={16} />, overdue_inspection: <XCircle size={16} /> };

const Inventory = () => {
  const { t, requireAuth } = useAuth();
  const { selectedScanner } = useScanner();
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => { loadBoxes(); }, [selectedScanner]);
  const loadBoxes = async () => { 
    setLoading(true);
    try { 
      let query = {};
      if (selectedScanner) {
        if (selectedScanner.department) query.department = typeof selectedScanner.department === 'string' ? selectedScanner.department : selectedScanner.department._id;
        if (selectedScanner.location) query.location = selectedScanner.location;
      }
      const r = await getBoxes(query); 
      setBoxes(r.data.data); 
    } catch(e){} 
    finally { setLoading(false); } 
  };

  const handleInspect = async (boxId) => {
    requireAuth(async () => {
      try { await inspectBox(boxId, { status: 'adequate', notes: 'Routine inspection - all items adequate' }); toast.success('Inspection logged'); loadBoxes(); }
      catch(e) { toast.error('Failed to log inspection'); }
    });
  };

  if (loading) return <div className="page-loader"><div className="spinner"></div></div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <div><h1 className="page-title">{t('inventory.title')}</h1><p className="page-subtitle">Manage first aid boxes per Factories Act Section 45</p></div>
      </div>

      {selectedScanner && (
        <div style={{ marginBottom: 24, padding: '12px 16px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Filter size={18} color="#6366f1" />
          <span style={{ fontSize: '0.9rem', color: '#4b5563' }}>
            Filtered by active scanner: <strong>{selectedScanner.location}</strong>
          </span>
        </div>
      )}

      <div className="grid-3">
        {boxes.map(box => (
          <div key={box._id} className="card" style={{cursor:'pointer',position:'relative',overflow:'hidden'}} onClick={() => setSelected(selected?._id === box._id ? null : box)}>
            <div style={{position:'absolute',top:0,right:0,width:80,height:80,background:`${box.status==='adequate'?'var(--green-50)':box.status==='needs_replenishment'?'var(--orange-50)':'var(--red-50)'}`,borderRadius:'0 0 0 80px'}}></div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:40,height:40,borderRadius:'var(--radius-md)',background:'var(--blue-50)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--blue-600)'}}><Package size={20} /></div>
                <div><div style={{fontWeight:700,color:'var(--text-main)'}}>{box.boxId}</div><div style={{fontSize:'0.78rem',color:'var(--text-muted)'}}>Class {box.classType}</div></div>
              </div>
              <span className={`badge badge-${box.status}`}>{statusIcon[box.status]} {t(`inventory.${box.status}`)}</span>
            </div>
            <div style={{fontSize:'0.85rem',color:'var(--text-secondary)',display:'flex',flexDirection:'column',gap:6}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}><MapPin size={14} /> {box.location}</div>
              <div style={{display:'flex',alignItems:'center',gap:6}}><User size={14} /> {box.inCharge?.name || 'Unassigned'}</div>
              <div style={{display:'flex',alignItems:'center',gap:6}}><Calendar size={14} /> Next inspection: {box.nextInspectionDue ? new Date(box.nextInspectionDue).toLocaleDateString() : 'Not set'}</div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="btn btn-ghost btn-sm" style={{flex:1}} onClick={e => {e.stopPropagation(); handleInspect(box._id)}}>Log Inspection</button>
            </div>

            {/* Expanded item list */}
            {selected?._id === box._id && box.items?.length > 0 && (
              <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid var(--border-color)'}}>
                <h4 style={{fontSize:'0.85rem',fontWeight:700,marginBottom:8,color:'var(--text-main)'}}>Items ({box.items.length})</h4>
                {box.items.map((item, i) => {
                  const pct = item.requiredQty > 0 ? (item.currentQty / item.requiredQty) * 100 : 100;
                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,fontSize:'0.82rem'}}>
                      <span style={{flex:1,color:'var(--text-secondary)'}}>{item.item?.name || 'Item'}</span>
                      <span style={{color:pct<50?'var(--red-600)':pct<100?'var(--orange-500)':'var(--green-500)',fontWeight:600,minWidth:50,textAlign:'right'}}>{item.currentQty}/{item.requiredQty}</span>
                      <div style={{width:60,height:4,borderRadius:2,background:'var(--border-color)'}}>
                        <div style={{width:`${Math.min(pct,100)}%`,height:'100%',borderRadius:2,background:pct<50?'var(--red-600)':pct<100?'var(--orange-500)':'var(--green-500)',transition:'width 0.3s ease'}}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      {boxes.length === 0 && <div className="empty-state"><Package size={48} /><p>No first aid boxes found</p></div>}
    </div>
  );
};

export default Inventory;
