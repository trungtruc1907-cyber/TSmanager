import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  X, 
  Check, 
  AlertTriangle, 
  Calendar, 
  Users, 
  Briefcase, 
  CheckCircle2, 
  Package, 
  Box,
  Cpu,
  Battery
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, getDocs, onSnapshot, query, orderBy } from 'firebase/firestore';
import { MaterialRequest, Equipment } from './types';

const getSafeISOString = (dateVal: any): string => {
  if (!dateVal) return '';
  if (typeof dateVal.toDate === 'function') {
    try {
      return dateVal.toDate().toISOString();
    } catch (e) {
      return '';
    }
  }
  if (typeof dateVal === 'object' && dateVal.seconds !== undefined) {
    try {
      return new Date(dateVal.seconds * 1000).toISOString();
    } catch (e) {
      return '';
    }
  }
  if (dateVal instanceof Date) {
    try {
      return dateVal.toISOString();
    } catch (e) {
      return '';
    }
  }
  if (typeof dateVal === 'string') {
    return dateVal;
  }
  try {
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  } catch (e) {}
  return String(dateVal);
};

interface MaterialRequestsProps {
  requests: MaterialRequest[];
  equipment: Equipment[];
  userRole: string;
  onOpenDocument: (id: string, type: 'pn' | 'px' | 'dexuat' | 'muahang', label: string) => void;
}

export default function MaterialRequests({ requests, equipment, userRole, onOpenDocument }: MaterialRequestsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<MaterialRequest | null>(null);

  // Database lists
  const [projects, setProjects] = useState<any[]>([]);

  // Create Request Form State
  const [formProjectId, setFormProjectId] = useState('');
  const [formTechnicianName, setFormTechnicianName] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formItems, setFormItems] = useState<Array<{ equipmentId: string, quantity: number }>>([]);

  // Review Form State
  const [reviewAdminNote, setReviewAdminNote] = useState('');

  // Load Projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const snap = await getDocs(collection(db, 'projects'));
        setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('Error fetching projects:', err);
      }
    };
    fetchProjects();
  }, []);

  // Filter Requests
  const filteredRequests = requests.filter(req => {
    const searchMatch = 
      (req.technicianName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (req.projectName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (req.id || '').toLowerCase().includes((searchTerm || '').toLowerCase());

    const statusMatch = statusFilter === 'all' || req.status === statusFilter;

    return searchMatch && statusMatch;
  });

  // Items handling for new request
  const handleAddFormItem = (equipmentId: string) => {
    if (formItems.some(item => item.equipmentId === equipmentId)) return;
    setFormItems([...formItems, { equipmentId, quantity: 1 }]);
  };

  const handleRemoveFormItem = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handleQtyChange = (idx: number, qty: number) => {
    if (qty < 1) return;
    const newItems = [...formItems];
    newItems[idx].quantity = qty;
    setFormItems(newItems);
  };

  // Create Material Request
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectId || !formTechnicianName || formItems.length === 0) {
      alert('Vui lòng nhập đầy đủ thông tin dự án, kỹ thuật viên và ít nhất 1 vật tư yêu cầu.');
      return;
    }

    try {
      const selectedProj = projects.find(p => p.id === formProjectId);
      const projName = selectedProj ? `Hòa Lưới ${selectedProj.systemSizeKWp || 5}kWp - ${selectedProj.customerName || 'KH'}` : 'Dự án Solar';
      
      const reqId = 'DX-' + Math.floor(1000 + Math.random() * 9000);
      
      const payload: MaterialRequest = {
        id: reqId,
        projectId: formProjectId,
        projectName: projName,
        technicianId: 'TECH_' + Math.floor(10 + Math.random() * 90),
        technicianName: formTechnicianName.trim(),
        reason: formReason.trim() || 'Cấp phát thi công công trình solar',
        status: 'pending',
        createdAt: new Date().toISOString(),
        items: formItems.map(item => {
          const eq = equipment.find(e => e.id === item.equipmentId);
          return {
            equipmentId: item.equipmentId,
            brand: eq?.brand || 'Chưa rõ',
            model: eq?.model || 'Vật tư',
            type: eq?.type || 'other',
            quantity: item.quantity,
            unit: eq?.unit || 'Cái'
          };
        })
      };

      await setDoc(doc(db, 'material_requests', reqId), payload);
      setShowAddModal(false);
      setFormProjectId('');
      setFormTechnicianName('');
      setFormReason('');
      setFormItems([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'material_requests');
    }
  };

  // Approve Request
  const handleApprove = async () => {
    if (!reviewingRequest) return;
    try {
      await updateDoc(doc(db, 'material_requests', reviewingRequest.id), {
        status: 'approved',
        adminNote: reviewAdminNote.trim() || 'Đã phê duyệt đề xuất cấp vật tư.'
      });
      setReviewingRequest(null);
      setReviewAdminNote('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'material_requests');
    }
  };

  // Reject Request
  const handleReject = async () => {
    if (!reviewingRequest) return;
    try {
      await updateDoc(doc(db, 'material_requests', reviewingRequest.id), {
        status: 'rejected',
        adminNote: reviewAdminNote.trim() || 'Từ chối đề xuất cấp vật tư.'
      });
      setReviewingRequest(null);
      setReviewAdminNote('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'material_requests');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search and Filters Header */}
      <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Tìm kiếm theo tên kỹ thuật, dự án, mã đề xuất..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium text-xs text-slate-700"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex border border-slate-200 bg-slate-50 rounded-2xl p-1 shrink-0">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'pending', label: 'Chờ duyệt' },
              { id: 'approved', label: 'Đã duyệt' },
              { id: 'rejected', label: 'Từ chối' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === tab.id 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-[#0054a6] hover:bg-blue-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Tạo Đề Xuất Cấp
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Mã đề xuất</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Kỹ thuật viên</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Thi công dự án</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Vật tư yêu cầu</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Ngày đề xuất</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Trạng thái</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 text-xs italic font-semibold">
                    Không có đề xuất cấp vật tư nào được tìm thấy.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4 font-mono text-[10px] font-black text-slate-400">#{req.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-700">
                          {req.technicianName?.substring(0, 1).toUpperCase()}
                        </div>
                        <span className="text-xs font-black text-slate-800">{req.technicianName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl w-fit">
                        <Briefcase className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                        <span className="truncate max-w-[150px]">{req.projectName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {req.items?.slice(0, 2).map((item, i) => (
                          <div key={i} className="text-[11px] font-bold text-slate-600">
                            • {item.brand} {item.model}: <span className="font-extrabold text-slate-800">{item.quantity} {item.unit}</span>
                          </div>
                        ))}
                        {req.items?.length > 2 && (
                          <span className="text-[9px] font-black uppercase text-slate-400">Và {req.items.length - 2} thiết bị khác...</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-400">{getSafeISOString(req.createdAt).substring(0, 10)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border tracking-wider ${
                        req.status === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        req.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        'bg-rose-50 border-rose-200 text-rose-700'
                      }`}>
                        {req.status === 'pending' ? '🟡 Chờ duyệt' : 
                         req.status === 'approved' ? '🟢 Đã duyệt' : '🔴 Từ chối'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onOpenDocument(req.id, 'dexuat', `${req.id}`)}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                        >
                          Mở chi tiết
                        </button>
                        {req.status === 'pending' && (userRole === 'admin' || userRole === 'manager' || userRole === 'accountant') && (
                          <button
                            onClick={() => {
                              setReviewingRequest(req);
                              setReviewAdminNote('');
                            }}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                          >
                            Duyệt phiếu
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Create Material Request */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col justify-between max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600 animate-pulse" />
                Lập đề xuất cấp phát vật tư thi công
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-8 space-y-5 overflow-y-auto flex-1">
              {/* Form header details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Công trình thi công *</label>
                  <select
                    required
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  >
                    <option value="">-- Chọn công trình thi công --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.customerName || 'Khách hàng'} (Hòa lưới {p.systemSizeKWp || 5}kWp)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Kỹ thuật viên lập đề xuất *</label>
                  <input 
                    type="text"
                    required
                    placeholder="Nhập họ tên kỹ thuật chịu trách nhiệm..."
                    value={formTechnicianName}
                    onChange={(e) => setFormTechnicianName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Mục đích cấp phát / Lý do</label>
                <input 
                  type="text"
                  placeholder="Ví dụ: Lắp đặt giàn khung và tấm pin giai đoạn 1, hoặc lắp tủ điện hòa lưới..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                />
              </div>

              {/* Items Picker */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">Lựa chọn vật tư thiết bị</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Equipment selector */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Danh mục vật tư có trong kho</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl divide-y divide-slate-50">
                      {equipment.map(eq => (
                        <div key={eq.id} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-blue-600 block leading-none">{eq.brand}</span>
                            <span className="font-bold text-slate-800">{eq.model}</span>
                            <span className="text-[9px] font-semibold text-slate-400 block mt-0.5">Tồn kho: {eq.stock || 0} {eq.unit}</span>
                          </div>
                          <button
                            type="button"
                            disabled={(eq.stock || 0) <= 0}
                            onClick={() => handleAddFormItem(eq.id)}
                            className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all active:scale-95 cursor-pointer ${
                              (eq.stock || 0) <= 0 
                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100'
                            }`}
                          >
                            {(eq.stock || 0) <= 0 ? 'Hết hàng' : 'Chọn'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Picked list and quantities */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Vật tư yêu cầu cấp ({formItems.length})</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl divide-y divide-slate-50 p-2 space-y-2">
                      {formItems.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center text-slate-400 italic text-[11px] font-semibold">
                          Hãy chọn thiết bị bên trái để lập danh sách.
                        </div>
                      ) : (
                        formItems.map((item, idx) => {
                          const eq = equipment.find(e => e.id === item.equipmentId);
                          return (
                            <div key={idx} className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex items-center justify-between text-xs gap-2">
                              <div className="min-w-0">
                                <span className="font-bold text-slate-800 truncate block leading-tight">{eq?.brand} {eq?.model}</span>
                                <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Kho có: {eq?.stock} {eq?.unit}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <input 
                                  type="number"
                                  min={1}
                                  max={eq?.stock || 9999}
                                  value={item.quantity}
                                  onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                                  className="w-14 px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs"
                                />
                                <span className="text-[10px] font-bold text-slate-500">{eq?.unit || 'Cái'}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFormItem(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-all cursor-pointer"
                                >
                                  <X className="h-4.5 w-4.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </form>

            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleCreateRequest}
                className="bg-[#0054a6] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Đề xuất cấp phát
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Review/Approve Request */}
      {reviewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-indigo-600 animate-bounce" />
                Phê duyệt phiếu cấp phát #{reviewingRequest.id}
              </h3>
              <button 
                onClick={() => setReviewingRequest(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-8 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Thông tin đề xuất</p>
                <p className="font-bold text-slate-800">Kỹ thuật viên: <span className="font-extrabold">{reviewingRequest.technicianName}</span></p>
                <p className="font-bold text-slate-800 mt-1">Dự án: <span className="font-extrabold">{reviewingRequest.projectName}</span></p>
                <p className="font-bold text-slate-800 mt-1">Lý do đề xuất: <span className="italic font-medium">"{reviewingRequest.reason}"</span></p>

                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mt-4 mb-2">Chi tiết thiết bị yêu cầu</p>
                <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                  {reviewingRequest.items?.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">{item.brand} {item.model}</span>
                      <span className="font-extrabold text-slate-900">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Ghi chú duyệt phiếu (Gửi đến thủ kho & kỹ thuật)</label>
                <textarea 
                  rows={3}
                  required
                  placeholder="Nhập ghi chú duyệt, ví dụ: 'Đồng ý xuất, thủ kho kiểm tra tình trạng đóng gói kỹ càng.' hoặc lý do từ chối..."
                  value={reviewAdminNote}
                  onChange={(e) => setReviewAdminNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                />
              </div>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-between gap-3">
              <button
                type="button"
                onClick={handleReject}
                className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Từ chối cấp phát
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewingRequest(null)}
                  className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                >
                  Đồng ý & Duyệt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
