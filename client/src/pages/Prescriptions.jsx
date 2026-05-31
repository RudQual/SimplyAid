import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPrescriptions, createPrescription, consumePrescription, getUsers, getInventoryItems, getBoxes } from '../services/api';
import { Pill, Plus, CheckCircle, Clock, X, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const Prescriptions = () => {
  const { user, hasRole, t } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTakeModal, setShowTakeModal] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);

  // Form states
  const [workers, setWorkers] = useState([]);
  const [items, setItems] = useState([]);
  const [boxes, setBoxes] = useState([]);

  const isDoctor = hasRole('admin', 'safety_officer', 'first_aider');

  useEffect(() => {
    fetchPrescriptions();
    if (isDoctor) {
      loadDoctorData();
    }
  }, [isDoctor]);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      const { data } = await getPrescriptions();
      setPrescriptions(data.data);
    } catch (error) {
      toast.error('Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const loadDoctorData = async () => {
    try {
      const [usersRes, itemsRes] = await Promise.all([
        getUsers({ role: 'employee' }),
        getInventoryItems()
      ]);
      setWorkers(usersRes.data.data);
      setItems(itemsRes.data.data);
    } catch (error) {
      toast.error('Failed to load form data');
    }
  };

  const openTakeModal = async (prescription) => {
    setSelectedPrescription(prescription);
    setShowTakeModal(true);
    try {
      const { data } = await getBoxes();
      setBoxes(data.data);
    } catch (error) {
      toast.error('Failed to load first aid boxes');
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      worker: formData.get('worker'),
      item: formData.get('item'),
      prescribedQty: parseInt(formData.get('prescribedQty')),
      instructions: formData.get('instructions')
    };

    try {
      await createPrescription(data);
      toast.success('Prescription added successfully');
      setShowAddModal(false);
      fetchPrescriptions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add prescription');
    }
  };

  const handleTakeSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const qty = parseInt(formData.get('qty'));
    const firstAidBoxId = formData.get('firstAidBoxId');

    try {
      await consumePrescription(selectedPrescription._id, { firstAidBoxId, qty });
      toast.success(`Successfully recorded taking ${qty} unit(s)`);
      setShowTakeModal(false);
      fetchPrescriptions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to record consumption');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="header-title">
          <h1>Prescriptions</h1>
          <p>Manage first aid item prescriptions</p>
        </div>
        <div className="header-actions">
          {isDoctor && (
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={18} /> Add Prescription
            </button>
          )}
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="page-loader"><div className="spinner"></div></div>
        ) : prescriptions.length === 0 ? (
          <div className="empty-state">
            <Pill size={48} className="empty-icon" />
            <h3>No Prescriptions Found</h3>
            <p>You have no prescriptions to display.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  {isDoctor && <th>Worker</th>}
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Consumed</th>
                  <th>Status</th>
                  <th>Instructions</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map(p => (
                  <tr key={p._id}>
                    {isDoctor && <td>{p.worker?.name}</td>}
                    <td>{p.item?.name}</td>
                    <td>{p.prescribedQty} {p.item?.unit}</td>
                    <td>{p.consumedQty} {p.item?.unit}</td>
                    <td>
                      <span className={`badge badge-${p.status === 'completed' ? 'success' : p.status === 'active' ? 'primary' : 'warning'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>{p.instructions}</td>
                    <td>
                      {p.status === 'active' && user._id === p.worker?._id && (
                        <button className="btn btn-sm btn-primary" onClick={() => openTakeModal(p)}>
                          Take Dose
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && isDoctor && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>New Prescription</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <form id="add-form" onSubmit={handleAddSubmit}>
                <div className="form-group">
                  <label>Select Worker</label>
                  <select name="worker" required className="form-control">
                    <option value="">-- Choose Employee --</option>
                    {workers.map(w => <option key={w._id} value={w._id}>{w.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Select Item</label>
                  <select name="item" required className="form-control">
                    <option value="">-- Choose Item --</option>
                    {items.map(i => <option key={i._id} value={i._id}>{i.name} ({i.category})</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Prescribed Quantity</label>
                  <input type="number" name="prescribedQty" min="1" required className="form-control" />
                </div>
                <div className="form-group">
                  <label>Instructions / Notes</label>
                  <textarea name="instructions" rows="3" className="form-control" placeholder="e.g. Take 1 tablet after meals"></textarea>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button type="submit" form="add-form" className="btn btn-primary">Save Prescription</button>
            </div>
          </div>
        </div>
      )}

      {/* Take Modal */}
      {showTakeModal && selectedPrescription && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Take {selectedPrescription.item?.name}</h2>
              <button className="close-btn" onClick={() => setShowTakeModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info" style={{marginBottom: '1rem'}}>
                <AlertCircle size={18} />
                <span>You can take up to <strong>{selectedPrescription.prescribedQty - selectedPrescription.consumedQty}</strong> more unit(s).</span>
              </div>
              <form id="take-form" onSubmit={handleTakeSubmit}>
                <div className="form-group">
                  <label>Select First Aid Box (Source)</label>
                  <select name="firstAidBoxId" required className="form-control">
                    <option value="">-- Choose Box --</option>
                    {boxes.filter(b => b.status !== 'inactive').map(b => (
                      <option key={b._id} value={b._id}>{b.boxId} ({b.location})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Quantity to Take</label>
                  <input type="number" name="qty" min="1" max={selectedPrescription.prescribedQty - selectedPrescription.consumedQty} required className="form-control" defaultValue="1" />
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowTakeModal(false)}>Cancel</button>
              <button type="submit" form="take-form" className="btn btn-primary">Confirm Take</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Prescriptions;
