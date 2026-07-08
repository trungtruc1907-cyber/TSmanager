import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  X, 
  ArrowDownLeft, 
  Briefcase, 
  Package, 
  Layers, 
  Calendar, 
  User,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, increment, getDocs } from 'firebase/firestore';
import { InventoryTransaction, Equipment } from './types';

interface ExportReceiptsProps {
  transactions: InventoryTransaction[];
  equipment: Equipment[];
  onOpenDocument: (id: string, type: 'pn' | 'px' | 'dexuat' | 'muahang', label: string) => void;
  userId: string;
}

export default function ExportReceipts({ 
  transactions, 
  equipment, 
  onOpenDocument,
  userId
}: ExportReceiptsProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);

  // Db list
  const [projects, setProjects] = useState<any[]>([]);

  // Form State
  const [formProjectId, setFormProjectId] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formItems, setFormItems] = useState<Array<{ equipmentId: string, quantity: number }>>([]);

  // Fetch Projects for select
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Only get exports
  const exports = transactions.filter(t => t.type === 'export');

  // Filter exports
  const filteredExports = exports.filter(exp => {
    return (
      (exp.id || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (exp.partnerName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (exp.note || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );
  });

  // Pick items
  const handleAddItem = (equipmentId: string) => {
    if (formItems.some(item => item.equipmentId === equipmentId)) return;
    const eq = equipment.find(e => e.id === equipmentId);
    if ((eq?.stock || 0) <= 0) {
      alert('Sản phẩm này đã hết hàng trong kho, không thể chọn để xuất.');
      return;
    }
    setFormItems([...formItems, { equipmentId, quantity: 1 }]);
  };

  const handleRemoveItem = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handleQtyChange = (idx: number, qty: number, maxStock: number) => {
    if (qty < 1) return;
    if (qty > maxStock) {
      alert(`Chỉ có thể xuất tối đa ${maxStock} sản phẩm (đầy kho).`);
      return;
    }
    const newItems = [...formItems];
    newItems[idx].quantity = qty;
    setFormItems(newItems);
  };

  const calculateTotalValue = () => {
    return formItems.reduce((sum, item) => {
      const eq = equipment.find(e => e.id === item.equipmentId);
      return sum + (item.quantity * (eq?.unitPrice || 0));
    }, 0);
  };

  // Handle Form Submission
  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectId || formItems.length === 0) {
      alert('Vui lòng chọn công trình thi công và thêm ít nhất 1 vật tư.');
      return;
    }

    try {
      const selectedProj = projects.find(p => p.id === formProjectId);
      const projName = selectedProj ? `Hòa lưới ${selectedProj.systemSizeKWp || 5}kWp - ${selectedProj.customerName || 'KH'}` : 'Dự án Solar';
      
      // Generate unique Export ID with prefix PX
      const receiptId = 'PX' + Math.floor(100000 + Math.random() * 899999);
      
      const payload: InventoryTransaction = {
        id: receiptId,
        type: 'export',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        partnerId: formProjectId,
        partnerName: projName,
        totalValue: calculateTotalValue(),
        note: formNote.trim() || 'Xuất kho cấp phát thi công công trình solar',
        createdBy: userId,
        createdByName: 'Thủ kho Solar',
        items: formItems.map(item => {
          const eq = equipment.find(e => e.id === item.equipmentId);
          return {
            equipmentId: item.equipmentId,
            brand: eq?.brand || 'Chưa rõ',
            model: eq?.model || 'Vật tư',
            type: eq?.type || 'other',
            quantity: item.quantity,
            unitPrice: eq?.unitPrice || 2000000,
            unit: eq?.unit || 'Cái'
          };
        })
      };

      // 1. Write Transaction Slip
      await setDoc(doc(db, 'inventory_transactions', receiptId), payload);

      // 2. Decrement Stock
      for (const item of formItems) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(-item.quantity)
        });
      }

      setShowAddModal(false);
      setFormProjectId('');
      setFormNote('');
      setFormItems([]);
      alert(`Đã lập và xuất thành công Phiếu Xuất Kho #${receiptId}! Số lượng tồn kho đã được đồng bộ giảm.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search Header */}
      <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Tìm kiếm phiếu xuất kho theo mã phiếu, dự án thi công, ghi chú..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium text-xs text-slate-700"
          />
        </div>

        <button 
          onClick={() => {
            setFormProjectId('');
            setFormNote('');
            setFormItems([]);
            setShowAddModal(true);
          }}
          className="bg-[#0054a6] hover:bg-blue-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          Lập Phiếu Xuất Kho
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Mã phiếu</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Thi công dự án</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Thiết bị xuất kho</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Tổng giá trị xuất</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Ngày xuất</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {filteredExports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-slate-400 text-xs italic font-semibold">
                    Chưa có phiếu xuất kho nào được lập.
                  </td>
                </tr>
              ) : (
                filteredExports.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4 font-mono text-[10px] font-black text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <ArrowDownLeft className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                        <span>#{exp.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-xs text-slate-800">
                      <div className="flex items-center gap-1 bg-blue-50/50 border border-blue-100 px-2.5 py-1 rounded-xl w-fit">
                        <Briefcase className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span className="truncate max-w-[150px]">{exp.partnerName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {exp.items?.slice(0, 2).map((item, i) => (
                          <div key={i} className="text-[11px] font-bold text-slate-600">
                            • {item.brand} {item.model}: <span className="font-extrabold text-slate-800">{item.quantity} {item.unit}</span>
                          </div>
                        ))}
                        {exp.items?.length > 2 && (
                          <span className="text-[9px] font-black uppercase text-slate-400">Và {exp.items.length - 2} dòng thiết bị khác...</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-xs text-slate-800">
                      {formatCurrency(exp.totalValue)}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-400">{exp.date}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => onOpenDocument(exp.id, 'px', `${exp.id}`)}
                        className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                      >
                        Mở chi tiết phiếu
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Create Export Receipt */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col justify-between max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <ArrowDownLeft className="h-5 w-5 text-rose-600 animate-bounce" />
                Lập phiếu xuất kho thi công công trình
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitReceipt} className="p-8 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Công trình nhận vật tư *</label>
                  <select
                    required
                    value={formProjectId}
                    onChange={(e) => setFormProjectId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  >
                    <option value="">-- Chọn công trình thi công --</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.customerName || 'Khách hàng'} (Hòa lưới {p.systemSizeKWp || 5}kWp)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Ghi chú phiếu xuất</label>
                  <input 
                    type="text"
                    placeholder="Ví dụ: Xuất kho phục vụ lắp ráp tủ điện mặt trời..."
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
              </div>

              {/* Items picker container */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">Lựa chọn vật tư xuất kho</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Equipment selector */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Thiết bị có sẵn trong kho</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl divide-y divide-slate-50">
                      {equipment.map(eq => {
                        const hasStock = (eq.stock || 0) > 0;
                        return (
                          <div key={eq.id} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                            <div>
                              <span className="text-[9px] font-bold text-blue-600 block leading-none">{eq.brand}</span>
                              <span className="font-bold text-slate-800">{eq.model}</span>
                              <span className={`text-[9px] font-bold block ${hasStock ? 'text-emerald-600' : 'text-rose-500'}`}>
                                Tồn: {eq.stock || 0} {eq.unit}
                              </span>
                            </div>
                            <button
                              type="button"
                              disabled={!hasStock}
                              onClick={() => handleAddItem(eq.id)}
                              className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border transition-all active:scale-95 cursor-pointer ${
                                hasStock 
                                  ? 'border-blue-100 text-blue-600 hover:bg-blue-50' 
                                  : 'border-slate-100 text-slate-400 bg-slate-50 cursor-not-allowed'
                              }`}
                            >
                              Chọn
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Picked items with stock guard checks */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Danh sách xuất kho ({formItems.length})</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl p-2 space-y-2">
                      {formItems.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center text-slate-400 italic text-[11px] font-semibold">
                          Hãy chọn thiết bị bên trái để thêm vào phiếu xuất kho.
                        </div>
                      ) : (
                        formItems.map((item, idx) => {
                          const eq = equipment.find(e => e.id === item.equipmentId);
                          const maxStock = eq?.stock || 0;
                          return (
                            <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-2 text-xs">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-bold text-slate-800 line-clamp-1">{eq?.brand} {eq?.model}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Số lượng xuất</label>
                                  <div className="flex items-center gap-1.5">
                                    <input 
                                      type="number"
                                      min={1}
                                      max={maxStock}
                                      value={item.quantity}
                                      onChange={(e) => handleQtyChange(idx, Number(e.target.value), maxStock)}
                                      className="w-full px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs bg-white focus:outline-none"
                                    />
                                    <span className="text-[10px] font-bold text-slate-500 shrink-0">{eq?.unit || 'Cái'}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Giá trị vốn xuất</span>
                                  <span className="font-bold text-slate-800">{formatCurrency(item.quantity * (eq?.unitPrice || 0))}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {formItems.length > 0 && (
                <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-rose-800 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> Tổng trị giá vốn xuất kho ước tính
                  </span>
                  <span className="text-sm font-black text-rose-600">{formatCurrency(calculateTotalValue())}</span>
                </div>
              )}

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
                onClick={handleSubmitReceipt}
                className="bg-[#0054a6] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Duyệt & Xuất kho
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
