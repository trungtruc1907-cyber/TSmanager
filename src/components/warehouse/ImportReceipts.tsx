import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  X, 
  ArrowUpRight, 
  Building, 
  Package, 
  Layers, 
  Calendar, 
  User,
  CheckCircle2
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { InventoryTransaction, Equipment, WarehouseSupplier } from './types';

interface ImportReceiptsProps {
  transactions: InventoryTransaction[];
  equipment: Equipment[];
  suppliers: WarehouseSupplier[];
  onOpenDocument: (id: string, type: 'pn' | 'px' | 'dexuat' | 'muahang', label: string) => void;
  userId: string;
}

export default function ImportReceipts({ 
  transactions, 
  equipment, 
  suppliers, 
  onOpenDocument,
  userId
}: ImportReceiptsProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formPaidAmount, setFormPaidAmount] = useState(0);
  const [formItems, setFormItems] = useState<Array<{ equipmentId: string, quantity: number, unitPrice: number }>>([]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Only get imports
  const imports = transactions.filter(t => t.type === 'import');

  // Filter list
  const filteredImports = imports.filter(imp => {
    return (
      (imp.id || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (imp.partnerName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (imp.note || '').toLowerCase().includes((searchTerm || '').toLowerCase())
    );
  });

  // Pick items
  const handleAddItem = (equipmentId: string) => {
    if (formItems.some(item => item.equipmentId === equipmentId)) return;
    const eq = equipment.find(e => e.id === equipmentId);
    setFormItems([...formItems, { 
      equipmentId, 
      quantity: 10, 
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

  const calculateTotalValue = () => {
    return formItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  // Handle Form Submission
  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplierId || formItems.length === 0) {
      alert('Vui lòng chọn nhà cung cấp và thêm ít nhất 1 vật tư.');
      return;
    }

    try {
      const selectedSup = suppliers.find(s => s.id === formSupplierId);
      const supName = selectedSup ? selectedSup.name : 'Nhà cung cấp';
      
      // Generate unique Receipt ID with standard format
      const receiptId = 'PN' + Math.floor(200000 + Math.random() * 799999);
      
      const totalVal = calculateTotalValue();
      const debtVal = Math.max(0, totalVal - formPaidAmount);

      const payload: InventoryTransaction = {
        id: receiptId,
        type: 'import',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        partnerId: formSupplierId,
        partnerName: supName,
        totalValue: totalVal,
        paidAmount: formPaidAmount,
        debtAmount: debtVal,
        note: formNote.trim() || 'Nhập kho lô vật tư thiết bị solar mới',
        createdBy: userId,
        createdByName: 'Thủ kho Solar',
        items: formItems.map(item => {
          const eq = equipment.find(e => e.id === item.equipmentId);
          return {
            equipmentId: item.equipmentId,
            brand: eq?.brand || 'Chưa rõ',
            model: eq?.model || 'Thiết bị',
            type: eq?.type || 'other',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unit: eq?.unit || 'Cái'
          };
        })
      };

      // 1. Write the Transaction Slip
      await setDoc(doc(db, 'inventory_transactions', receiptId), payload);

      // 2. Loop & increment stock of equipment in Firestore
      for (const item of formItems) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(item.quantity)
        });
      }

      // 3. Update Supplier liabilities debt if any remaining
      if (debtVal > 0) {
        const supRef = doc(db, 'suppliers', formSupplierId);
        await updateDoc(supRef, {
          debt: increment(debtVal)
        });
      }

      setShowAddModal(false);
      setFormSupplierId('');
      setFormNote('');
      setFormPaidAmount(0);
      setFormItems([]);
      alert(`Đã lập và duyệt thành công Phiếu Nhập Kho #${receiptId}! Số lượng tồn kho đã được đồng bộ tăng.`);
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
            placeholder="Tìm kiếm phiếu nhập kho theo mã phiếu, nhà cung cấp, ghi chú..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium text-xs text-slate-700"
          />
        </div>

        <button 
          onClick={() => {
            setFormSupplierId('');
            setFormNote('');
            setFormPaidAmount(0);
            setFormItems([]);
            setShowAddModal(true);
          }}
          className="bg-[#0054a6] hover:bg-blue-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="h-4 w-4" />
          Lập Phiếu Nhập Kho
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Mã phiếu</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Nhà cung cấp</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Thiết bị nhập kho</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Tổng giá trị nhập</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Đã thanh toán</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Ngày nhập</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {filteredImports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 text-xs italic font-semibold">
                    Chưa có phiếu nhập kho nào được lập.
                  </td>
                </tr>
              ) : (
                filteredImports.map((imp) => (
                  <tr key={imp.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4 font-mono text-[10px] font-black text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>#{imp.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-black text-xs text-slate-800">{imp.partnerName}</td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {imp.items?.slice(0, 2).map((item, i) => (
                          <div key={i} className="text-[11px] font-bold text-slate-600">
                            • {item.brand} {item.model}: <span className="font-extrabold text-slate-800">{item.quantity} {item.unit}</span>
                          </div>
                        ))}
                        {imp.items?.length > 2 && (
                          <span className="text-[9px] font-black uppercase text-slate-400">Và {imp.items.length - 2} dòng thiết bị khác...</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-xs text-slate-800">
                      {formatCurrency(imp.totalValue)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-xs font-bold text-emerald-600 block">{formatCurrency(imp.paidAmount || 0)}</span>
                      {(imp.debtAmount || 0) > 0 && (
                        <span className="text-[9px] text-rose-500 font-extrabold block">Ghi nợ: {formatCurrency(imp.debtAmount || 0)}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-400">{imp.date}</td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => onOpenDocument(imp.id, 'pn', `${imp.id}`)}
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

      {/* MODAL: Create Import Receipt */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col justify-between max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-emerald-600 animate-bounce" />
                Lập phiếu nhập kho & Tăng tồn kho
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Đối tác / Nhà cung cấp *</label>
                  <select
                    required
                    value={formSupplierId}
                    onChange={(e) => setFormSupplierId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  >
                    <option value="">-- Chọn Nhà cung cấp --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Ghi chú phiếu nhập</label>
                  <input 
                    type="text"
                    placeholder="Ví dụ: Nhập kho theo HĐ 8849 hoặc nhập bổ sung..."
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
              </div>

              {/* Items Picker and details input */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">Lựa chọn vật tư nhập kho</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Equipment selector */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Thiết bị trong danh mục</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl divide-y divide-slate-50">
                      {equipment.map(eq => (
                        <div key={eq.id} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-blue-600 block leading-none">{eq.brand}</span>
                            <span className="font-bold text-slate-800">{eq.model}</span>
                            <span className="text-[9px] text-slate-400 font-bold block">Tồn hiện tại: {eq.stock || 0} {eq.unit}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddItem(eq.id)}
                            className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50 active:scale-95 cursor-pointer"
                          >
                            Chọn
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Picked list */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Danh mục vật tư nhập ({formItems.length})</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl p-2 space-y-2">
                      {formItems.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center text-slate-400 italic text-[11px] font-semibold">
                          Hãy chọn thiết bị bên trái để thêm vào phiếu nhập kho.
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
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Số lượng nhập</label>
                                  <input 
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                                    className="w-full px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Đơn giá nhập</label>
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

              {/* Payments Section */}
              {formItems.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Tổng trị giá lô hàng nhập kho:</span>
                    <span className="text-slate-950 font-black">{formatCurrency(calculateTotalValue())}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Đã thanh toán (VND)</label>
                      <input 
                        type="number"
                        min={0}
                        max={calculateTotalValue()}
                        value={formPaidAmount}
                        onChange={(e) => setFormPaidAmount(Number(e.target.value))}
                        className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Tính nợ nhà cung cấp</label>
                      <div className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 font-extrabold text-xs text-rose-600">
                        {formatCurrency(Math.max(0, calculateTotalValue() - formPaidAmount))}
                      </div>
                    </div>
                  </div>
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
                Ký duyệt & Nhập kho
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
