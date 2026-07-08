import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  X, 
  Check, 
  Building, 
  AlertTriangle, 
  RotateCcw, 
  Eye, 
  Layers,
  CheckCircle2,
  Settings,
  DollarSign
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, getDocs } from 'firebase/firestore';
import { PurchaseProposal, Equipment, WarehouseSupplier } from './types';

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

interface PurchaseProposalsProps {
  proposals: PurchaseProposal[];
  equipment: Equipment[];
  suppliers: WarehouseSupplier[];
  userRole: string;
  onOpenDocument: (id: string, type: 'pn' | 'px' | 'dexuat' | 'muahang', label: string) => void;
}

export default function PurchaseProposals({ 
  proposals, 
  equipment, 
  suppliers, 
  userRole, 
  onOpenDocument 
}: PurchaseProposalsProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'ordering' | 'completed' | 'cancelled'>('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formItems, setFormItems] = useState<Array<{ equipmentId: string, quantity: number, unitPrice: number }>>([]);

  // Filter proposals
  const filteredProposals = proposals.filter(prop => {
    const searchMatch = 
      (prop.supplierName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (prop.id || '').toLowerCase().includes((searchTerm || '').toLowerCase());

    const statusMatch = statusFilter === 'all' || prop.status === statusFilter;

    return searchMatch && statusMatch;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Add item to proposal list
  const handleAddItem = (equipmentId: string) => {
    if (formItems.some(item => item.equipmentId === equipmentId)) return;
    const eq = equipment.find(e => e.id === equipmentId);
    setFormItems([...formItems, { 
      equipmentId, 
      quantity: eq && eq.stock && eq.minStock ? Math.max(1, eq.minStock - eq.stock) : 10, 
      unitPrice: eq?.unitPrice || 2000000 
    }]);
  };

  const handleRemoveItem = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handleQtyChange = (idx: number, qty: number) => {
    if (qty < 1) return;
    const newItems = [...formItems];
    newItems[idx].quantity = qty;
    setFormItems(newItems);
  };

  const handlePriceChange = (idx: number, price: number) => {
    if (price < 0) return;
    const newItems = [...formItems];
    newItems[idx].unitPrice = price;
    setFormItems(newItems);
  };

  const calculateTotalCost = () => {
    return formItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  // Create Proposal
  const handleCreateProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplierId || formItems.length === 0) {
      alert('Vui lòng chọn nhà cung cấp và lập danh sách vật tư cần mua.');
      return;
    }

    try {
      const selectedSup = suppliers.find(s => s.id === formSupplierId);
      const supName = selectedSup ? selectedSup.name : 'Nhà cung cấp';
      
      const propId = 'MH-' + Math.floor(1000 + Math.random() * 9000);
      
      const payload: PurchaseProposal = {
        id: propId,
        supplierId: formSupplierId,
        supplierName: supName,
        reason: formReason.trim() || 'Nhập bổ sung kho định kỳ',
        totalCost: calculateTotalCost(),
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
            unitPrice: item.unitPrice,
            unit: eq?.unit || 'Cái'
          };
        })
      };

      await setDoc(doc(db, 'purchase_proposals', propId), payload);
      setShowAddModal(false);
      setFormSupplierId('');
      setFormReason('');
      setFormItems([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'purchase_proposals');
    }
  };

  // Quick State Transition
  const handleUpdateStatus = async (propId: string, newStatus: 'approved' | 'ordering' | 'completed' | 'cancelled') => {
    try {
      await updateDoc(doc(db, 'purchase_proposals', propId), {
        status: newStatus
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'purchase_proposals');
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
            placeholder="Tìm kiếm theo tên nhà cung cấp, mã đơn hàng..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium text-xs text-slate-700"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex border border-slate-200 bg-slate-50 rounded-2xl p-1 shrink-0 overflow-x-auto max-w-[320px] sm:max-w-none">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'pending', label: 'Chờ duyệt' },
              { id: 'ordering', label: 'Đặt hàng' },
              { id: 'completed', label: 'Hoàn thành' }
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
            Lập Đề Xuất Mua
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Mã đơn mua</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Nhà cung cấp</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Vật tư dự kiến mua</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Tổng chi phí dự kiến</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Ngày lập</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Trạng thái</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {filteredProposals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 text-xs italic font-semibold">
                    Không tìm thấy đề xuất mua hàng nào.
                  </td>
                </tr>
              ) : (
                filteredProposals.map((prop) => (
                  <tr key={prop.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4 font-mono text-[10px] font-black text-slate-400">#{prop.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-700">
                          <Building className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        <span className="text-xs font-black text-slate-800">{prop.supplierName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {prop.items?.slice(0, 2).map((item, i) => (
                          <div key={i} className="text-[11px] font-bold text-slate-600">
                            • {item.brand} {item.model}: <span className="font-extrabold text-slate-800">{item.quantity} {item.unit}</span>
                          </div>
                        ))}
                        {prop.items?.length > 2 && (
                          <span className="text-[9px] font-black uppercase text-slate-400">Và {prop.items.length - 2} sản phẩm khác...</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-xs text-slate-800">
                      {formatCurrency(prop.totalCost)}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-400">{getSafeISOString(prop.createdAt).substring(0, 10)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border tracking-wider ${
                        prop.status === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        prop.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        prop.status === 'ordering' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                        prop.status === 'completed' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                        'bg-rose-50 border-rose-200 text-rose-700'
                      }`}>
                        {prop.status === 'pending' ? '🟡 Chờ duyệt' : 
                         prop.status === 'approved' ? '🟢 Đã duyệt' : 
                         prop.status === 'ordering' ? '🔵 Đang giao' : 
                         prop.status === 'completed' ? '🟣 Hoàn thành' : '🔴 Hủy bỏ'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => onOpenDocument(prop.id, 'muahang', `${prop.id}`)}
                          className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                        >
                          Xem chi tiết
                        </button>
                        {prop.status === 'pending' && (userRole === 'admin' || userRole === 'manager') && (
                          <button
                            onClick={() => handleUpdateStatus(prop.id, 'approved')}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                          >
                            Duyệt mua
                          </button>
                        )}
                        {prop.status === 'approved' && (
                          <button
                            onClick={() => handleUpdateStatus(prop.id, 'ordering')}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                          >
                            Đặt hàng
                          </button>
                        )}
                        {prop.status === 'ordering' && (
                          <button
                            onClick={() => handleUpdateStatus(prop.id, 'completed')}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                          >
                            Hoàn tất mua
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

      {/* MODAL 1: Create Purchase Proposal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col justify-between max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-600 animate-bounce" />
                Lập đề xuất mua hàng bổ sung kho
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProposal} className="p-8 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Nhà cung cấp phân phối *</label>
                  <select
                    required
                    value={formSupplierId}
                    onChange={(e) => setFormSupplierId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  >
                    <option value="">-- Chọn Nhà cung cấp --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} (Nợ: {formatCurrency(s.debt)})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Lý do / Căn cứ nhập hàng</label>
                  <input 
                    type="text"
                    placeholder="Ví dụ: Nhập dự phòng pin lưu trữ mùa mưa bão..."
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
              </div>

              {/* Items picker box */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">Chọn thiết bị cần thu mua</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Equipment selector */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Thiết bị có trong danh mục</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl divide-y divide-slate-50">
                      {equipment.map(eq => (
                        <div key={eq.id} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-blue-600 block leading-none">{eq.brand}</span>
                            <span className="font-bold text-slate-800">{eq.model}</span>
                            <span className={`text-[9px] font-bold block mt-0.5 ${
                              (eq.stock || 0) <= (eq.minStock || 5) ? 'text-rose-600' : 'text-slate-400'
                            }`}>
                              Tồn: {eq.stock || 0} / Định mức: {eq.minStock || 5}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddItem(eq.id)}
                            className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50 active:scale-95 cursor-pointer"
                          >
                            Thêm
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Picked items ledger list with price inputs */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Danh sách thu mua ({formItems.length})</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl p-2 space-y-2">
                      {formItems.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center text-slate-400 italic text-[11px] font-semibold">
                          Hãy chọn thiết bị bên trái để thêm vào đơn mua hàng.
                        </div>
                      ) : (
                        formItems.map((item, idx) => {
                          const eq = equipment.find(e => e.id === item.equipmentId);
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
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Số lượng mua</label>
                                  <input 
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                                    className="w-full px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Giá mua ước tính</label>
                                  <input 
                                    type="number"
                                    min={0}
                                    value={item.unitPrice}
                                    onChange={(e) => handlePriceChange(idx, Number(e.target.value))}
                                    className="w-full px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs bg-white"
                                  />
                                </div>
                              </div>
                              <p className="text-[9px] text-right font-black text-slate-400 uppercase">Thành tiền: <span className="text-slate-700">{formatCurrency(item.quantity * item.unitPrice)}</span></p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {formItems.length > 0 && (
                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider">Tổng giá trị đơn hàng ước tính</span>
                  <span className="text-sm font-black text-[#0054a6]">{formatCurrency(calculateTotalCost())}</span>
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
                onClick={handleCreateProposal}
                className="bg-[#0054a6] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Tạo đề xuất mua
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
