import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useScanner } from '../contexts/ScannerContext';
import { getBoxes, inspectBox, updateBoxItemStocks } from '../services/api';
import { Package, MapPin, User, Calendar, CheckCircle, AlertTriangle, XCircle, Filter, Edit2, Clock, ChevronDown, ChevronUp, Save, Minus, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const statusIcon = { adequate: <CheckCircle size={16} />, needs_replenishment: <AlertTriangle size={16} />, overdue_inspection: <XCircle size={16} /> };

const Inventory = () => {
  const { t, requireAuth } = useAuth();
  const { selectedScanner } = useScanner();
  const navigate = useNavigate();
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  // Inline edit state
  const [editingItem, setEditingItem] = useState(null); // { boxId, itemIndex }
  const [editQty, setEditQty] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);

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

  // Inline quick-edit: save updated quantity for a single item
  const handleQuickSave = async (box, itemIndex) => {
    const item = box.items[itemIndex];
    if (!item) return;
    setSavingEdit(true);
    try {
      // Build updated stocks — if stocks exist, scale the first batch; otherwise create one
      const existingStocks = item.stocks?.length ? JSON.parse(JSON.stringify(item.stocks)) : [];
      if (existingStocks.length > 0) {
        // Adjust first stock batch to match new total
        const otherTotal = existingStocks.slice(1).reduce((sum, s) => sum + (s.quantity || 0), 0);
        existingStocks[0].quantity = Math.max(0, editQty - otherTotal);
      } else {
        existingStocks.push({ batchNumber: 'MANUAL-UPDATE', quantity: editQty, expiryDate: null, supplier: 'Manual Update' });
      }
      await updateBoxItemStocks(box._id, item.item._id || item.item, { stocks: existingStocks });
      toast.success('Quantity updated');
      setEditingItem(null);
      loadBoxes();
    } catch (e) {
      toast.error('Failed to update');
    } finally {
      setSavingEdit(false);
    }
  };

  const startEditing = (boxId, itemIndex, currentQty) => {
    setEditingItem({ boxId, itemIndex });
    setEditQty(currentQty);
  };

  // Get expiry info for an item
  const getExpiryInfo = (item) => {
    const nearestStock = item.stocks?.reduce((nearest, s) => {
      if (!s.expiryDate) return nearest;
      if (!nearest) return s;
      return new Date(s.expiryDate) < new Date(nearest.expiryDate) ? s : nearest;
    }, null);
    const nearestExp = nearestStock?.expiryDate || item.expiryDate;
    if (!nearestExp) return { label: null, color: null };
    const daysLeft = Math.ceil((new Date(nearestExp) - new Date()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: 'Expired', color: 'red' };
    if (daysLeft <= 7) return { label: `${daysLeft}d left`, color: 'red' };
    if (daysLeft <= 30) return { label: `${daysLeft}d left`, color: 'amber' };
    if (daysLeft <= 90) return { label: `${daysLeft}d left`, color: 'blue' };
    return { label: 'OK', color: 'green' };
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
        {boxes.map(box => {
          const isExpanded = selected?._id === box._id;
          return (
          <div key={box._id} className="card" style={{cursor:'pointer',position:'relative',overflow:'hidden'}} onClick={() => setSelected(isExpanded ? null : box)}>
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

            {/* Action Buttons */}
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="btn btn-primary btn-sm" style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6}} onClick={e => {e.stopPropagation(); navigate(`/inventory/boxes/scan/${box.boxId}`)}}>
                <Edit2 size={14} /> Manage Items
              </button>
              <button className="btn btn-ghost btn-sm" style={{flex:1}} onClick={e => {e.stopPropagation(); handleInspect(box._id)}}>Log Inspection</button>
            </div>

            {/* Expand/Collapse indicator */}
            <div style={{display:'flex',justifyContent:'center',marginTop:12,color:'var(--text-muted)'}}>
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>

            {/* Expanded item list with expiry info and quick edit */}
            {isExpanded && box.items?.length > 0 && (
              <div style={{marginTop:12,paddingTop:16,borderTop:'1px solid var(--border-color)'}} onClick={e => e.stopPropagation()}>
                <h4 style={{fontSize:'0.85rem',fontWeight:700,marginBottom:10,color:'var(--text-main)',display:'flex',alignItems:'center',gap:6}}>
                  <Package size={14} /> Items ({box.items.length})
                </h4>
                {box.items.map((item, i) => {
                  const pct = item.requiredQty > 0 ? (item.currentQty / item.requiredQty) * 100 : 100;
                  const expiry = getExpiryInfo(item);
                  const isEditingThis = editingItem?.boxId === box._id && editingItem?.itemIndex === i;

                  return (
                    <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,fontSize:'0.82rem',padding:'6px 8px',borderRadius:8,background: isEditingThis ? 'rgba(99,102,241,0.05)' : 'transparent',transition:'background 0.2s'}}>
                      <span style={{flex:1,color:'var(--text-secondary)',fontWeight:500}}>{item.item?.name || 'Item'}</span>
                      
                      {/* Expiry badge */}
                      {expiry.label && (
                        <span className={`badge badge-${expiry.color}`} style={{fontSize:'0.7rem',padding:'1px 6px'}}>
                          <Clock size={10} style={{marginRight:2}} />{expiry.label}
                        </span>
                      )}

                      {/* Quantity — inline edit or display */}
                      {isEditingThis ? (
                        <div style={{display:'flex',alignItems:'center',gap:4}} onClick={e => e.stopPropagation()}>
                          <button 
                            style={{width:24,height:24,borderRadius:6,border:'1px solid var(--border-color)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',background:'var(--bg-hover)'}}
                            onClick={() => setEditQty(Math.max(0, editQty - 1))}
                          ><Minus size={12} /></button>
                          <input 
                            type="number" 
                            value={editQty} 
                            onChange={e => setEditQty(Math.max(0, parseInt(e.target.value) || 0))}
                            style={{width:44,textAlign:'center',padding:'2px 4px',borderRadius:6,border:'1px solid var(--accent)',fontSize:'0.82rem',fontWeight:700}}
                          />
                          <button 
                            style={{width:24,height:24,borderRadius:6,border:'1px solid var(--border-color)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',background:'var(--bg-hover)'}}
                            onClick={() => setEditQty(editQty + 1)}
                          ><Plus size={12} /></button>
                          <span style={{color:'var(--text-muted)',fontSize:'0.75rem'}}>/{item.requiredQty}</span>
                          <button 
                            className="btn btn-primary btn-sm" 
                            style={{padding:'2px 8px',fontSize:'0.75rem',minHeight:'auto'}}
                            onClick={() => handleQuickSave(box, i)}
                            disabled={savingEdit}
                          >
                            {savingEdit ? '...' : <Save size={12} />}
                          </button>
                          <button 
                            style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:'0.75rem',padding:'2px 4px'}}
                            onClick={() => setEditingItem(null)}
                          >✕</button>
                        </div>
                      ) : (
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{color:pct<50?'var(--red-600)':pct<100?'var(--orange-500)':'var(--green-500)',fontWeight:600,minWidth:50,textAlign:'right'}}>{item.currentQty}/{item.requiredQty}</span>
                          <div style={{width:48,height:4,borderRadius:2,background:'var(--border-color)'}}>
                            <div style={{width:`${Math.min(pct,100)}%`,height:'100%',borderRadius:2,background:pct<50?'var(--red-600)':pct<100?'var(--orange-500)':'var(--green-500)',transition:'width 0.3s ease'}}></div>
                          </div>
                          <button 
                            style={{background:'none',border:'none',color:'var(--accent)',cursor:'pointer',padding:2,display:'flex',alignItems:'center'}} 
                            title="Quick edit quantity"
                            onClick={(e) => { e.stopPropagation(); startEditing(box._id, i, item.currentQty); }}
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )})}
      </div>
      {boxes.length === 0 && <div className="empty-state"><Package size={48} /><p>No first aid boxes found</p></div>}
    </div>
  );
};

export default Inventory;
