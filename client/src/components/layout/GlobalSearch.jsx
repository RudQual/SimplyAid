import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Boxes, Package, AlertTriangle, UserRound, CornerDownLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getBoxes, getInventoryItems, getIncidents, getUsers } from '../../services/api';
import { labelize } from '../../utils/format';
import { Spinner } from '../ui';

/** Ctrl/⌘+K command palette that searches kits, inventory, incidents and people. */
const GlobalSearch = ({ open, onClose }) => {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setQ(''); setResults([]); setSelected(0); setTimeout(() => inputRef.current?.focus(), 30); }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const term = q.trim();
    if (term.length < 2) { setResults([]); setLoading(false); return undefined; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const tasks = [
        getIncidents({ search: term, limit: 5 }).then((r) => r.data.data.map((i) => ({
          group: 'Incidents', icon: AlertTriangle, title: `${i.incidentId} · ${i.injuredPerson?.name || ''}`, sub: `${labelize(i.severity)} · ${i.location}`, to: `/incidents/${i._id}`
        })))
      ];
      if (can('manageInventory')) {
        tasks.unshift(
          getBoxes({ search: term, limit: 5, page: 1 }).then((r) => r.data.data.map((b) => ({
            group: 'First aid kits', icon: Boxes, title: b.boxId, sub: `${b.location} · ${b.department?.name || ''}`, to: `/kits/${b._id}`
          }))),
          getInventoryItems({ search: term, limit: 5, page: 1 }).then((r) => r.data.data.map((i) => ({
            group: 'Inventory', icon: Package, title: i.name, sub: `${labelize(i.category)} · ${i.stock.totalQty} ${i.unit} in stock`, to: `/inventory/${i._id}`
          })))
        );
      }
      if (can('viewUsers')) {
        tasks.push(getUsers({ search: term, limit: 5, page: 1 }).then((r) => r.data.data.map((u) => ({
          group: 'People', icon: UserRound, title: u.name, sub: `${labelize(u.role)} · ${u.employeeId || u.email}`, to: `/employees/${u._id}`
        }))));
      }
      const settled = await Promise.allSettled(tasks);
      if (cancelled) return;
      setResults(settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : [])));
      setSelected(0);
      setLoading(false);
    }, 220);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q, open, can]);

  const groups = useMemo(() => {
    const map = new Map();
    results.forEach((r, idx) => { if (!map.has(r.group)) map.set(r.group, []); map.get(r.group).push({ ...r, idx }); });
    return [...map.entries()];
  }, [results]);

  const go = (r) => { onClose(); navigate(r.to); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(results.length - 1, s + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(0, s - 1)); }
    if (e.key === 'Enter' && results[selected]) go(results[selected]);
    if (e.key === 'Escape') onClose();
  };

  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal search-modal" role="dialog" aria-label="Search">
        <div className="search-modal-input">
          <Search size={18} className="muted" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown} placeholder="Search kits, inventory, incidents, people…" />
          {loading ? <Spinner size="sm" /> : <span className="kbd">Esc</span>}
        </div>
        <div className="search-results">
          {q.trim().length < 2 && <p className="small muted" style={{ padding: 16 }}>Type at least 2 characters.</p>}
          {q.trim().length >= 2 && !loading && results.length === 0 && <p className="small muted" style={{ padding: 16 }}>No results for “{q}”.</p>}
          {groups.map(([group, list]) => (
            <div key={group}>
              <div className="search-group-title">{group}</div>
              {list.map((r) => (
                <button key={`${r.to}`} className={`search-result ${r.idx === selected ? 'selected' : ''}`} onMouseEnter={() => setSelected(r.idx)} onClick={() => go(r)}>
                  <span className="list-icon tone-slate"><r.icon size={16} /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="search-result-title truncate" style={{ display: 'block' }}>{r.title}</span>
                    <span className="search-result-sub truncate" style={{ display: 'block' }}>{r.sub}</span>
                  </span>
                  {r.idx === selected && <CornerDownLeft size={14} className="muted" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
