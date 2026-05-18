import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, updateDoc } from 'firebase/firestore';
import { Equipment } from '../types';
import { Plus, Trash2, Edit2, Package, Cpu, Battery, Box, X } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

type EquipmentCategory = 'panel' | 'inverter' | 'battery' | 'mounting' | 'accessory';

interface CatalogManagerProps {
  userId?: string;
  userRole?: string;
}

export default function CatalogManager({ userId, userRole }: CatalogManagerProps) {
  const isAdmin = userRole === 'admin' || userRole === 'manager';
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<EquipmentCategory | 'all'>('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<Equipment> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categories: { id: EquipmentCategory; label: string; icon: any }[] = [
    { id: 'panel', label: 'Tấm pin PV', icon: Package },
    { id: 'inverter', label: 'Biến tần (Inverter)', icon: Cpu },
    { id: 'battery', label: 'Lưu trữ (Battery)', icon: Battery },
    { id: 'mounting', label: 'Hệ thống khung giá', icon: Box },
    { id: 'accessory', label: 'Phụ kiện & Cáp', icon: Box },
  ];

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'equipment'), orderBy('brand'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEquipment(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'equipment');
    });
    return () => unsubscribe();
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.brand || !editingItem?.model) return;

    try {
      if (editingItem.id) {
        await updateDoc(doc(db, 'equipment', editingItem.id), editingItem);
      } else {
        await addDoc(collection(db, 'equipment'), editingItem);
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error saving equipment:", error);
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'equipment', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `equipment/${id}`);
    }
  };

  const filteredEquipment = filter === 'all' 
    ? equipment 
    : equipment.filter(e => e.type === filter);

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium italic">Đang tải dữ liệu thiết bị...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Danh mục Thiết bị Kỹ thuật</h2>
          <p className="text-xs text-slate-500 font-medium">Quản lý thư viện vật tư dùng cho dự toán và báo giá.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => {
              setEditingItem({ type: 'panel', brand: '', model: '', capacity: 0, unitPrice: 0 });
              setIsModalOpen(true);
            }}
            className="bg-blue-600 text-white px-5 py-2 rounded-md flex items-center gap-2 text-sm font-bold shadow-md hover:bg-blue-700 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> Thêm Thiết bị
          </button>
        )}
      </div>

      {/* Phân nhóm (Tabs) */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button 
          onClick={() => setFilter('all')}
          className={cn(
            "px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all border shrink-0",
            filter === 'all' ? "bg-slate-900 border-slate-900 text-white shadow-md" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
          )}
        >
          Tất cả
        </button>
        {categories.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setFilter(cat.id)}
            className={cn(
              "px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all border flex items-center gap-2 shrink-0",
              filter === cat.id ? "bg-blue-600 border-blue-600 text-white shadow-md" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            )}
          >
            <cat.icon className="h-3 w-3" />
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredEquipment.map((item) => (
          <div key={item.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative">
            {isAdmin && (
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setDeletingId(item.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
            
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "w-10 h-10 rounded flex items-center justify-center shrink-0",
                  item.type === 'panel' ? "bg-amber-50 text-amber-600" : 
                  item.type === 'inverter' ? "bg-blue-50 text-blue-600" : 
                  item.type === 'battery' ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                )}>
                  {item.type === 'panel' ? <Package className="h-5 w-5" /> : 
                   item.type === 'inverter' ? <Cpu className="h-5 w-5" /> : 
                   item.type === 'battery' ? <Battery className="h-5 w-5" /> : <Box className="h-5 w-5" />}
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{item.brand}</p>
                  <h3 className="text-sm font-bold text-slate-800 truncate leading-tight mt-0.5">{item.model}</h3>
                </div>
              </div>

              <div className="flex-1 space-y-2 mb-4">
                 <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-400 uppercase tracking-tighter">Công suất:</span>
                    <span className="text-slate-700 font-bold">{item.capacity} {item.type === 'panel' ? 'Wp' : 'kW'}</span>
                 </div>
                 <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-400 uppercase tracking-tighter">Đơn giá:</span>
                    <span className="text-blue-600 font-bold">{formatCurrency(item.unitPrice)}</span>
                 </div>
              </div>

              <div className="pt-3 border-t border-slate-50">
                 <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Thiết bị dự án Solar</div>
              </div>
            </div>
          </div>
        ))}

        {filteredEquipment.length === 0 && (
          <div className="col-span-full py-12 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">
             <Box className="h-12 w-12 text-slate-200 mx-auto mb-3" />
             <p className="text-slate-400 text-sm font-medium italic">Không tìm thấy thiết bị phù hợp trong danh mục này.</p>
          </div>
        )}
      </div>

      {/* Modal Xóa */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-2xl animate-in zoom-in duration-200 border border-slate-200 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Xác nhận xóa?</h3>
            <p className="text-sm text-slate-500 mb-8">Hành động này không thể hoàn tác. Thiết bị sẽ bị xóa vĩnh viễn khỏi danh mục.</p>
            
            <div className="flex gap-3">
              <button 
                onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors uppercase tracking-widest"
              >
                Hủy
              </button>
              <button 
                onClick={() => deleteItem(deletingId)}
                className="flex-1 px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded shadow-md transition-colors uppercase tracking-widest"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Thêm/Sửa */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in duration-200 border border-slate-200">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
                {editingItem?.id ? 'Chỉnh sửa Thiết bị' : 'Thêm Thiết bị mới'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Loại thiết bị</label>
                  <select 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                    value={editingItem?.type}
                    onChange={e => setEditingItem({ ...editingItem, type: e.target.value as any })}
                  >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Thương hiệu</label>
                  <input 
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                    value={editingItem?.brand}
                    placeholder="VD: Canadian Solar"
                    onChange={e => setEditingItem({ ...editingItem, brand: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Model / Mã sản phẩm</label>
                <input 
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                  value={editingItem?.model}
                  placeholder="VD: HiKu6 550W"
                  onChange={e => setEditingItem({ ...editingItem, model: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Công suất (W/kW)</label>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                    value={editingItem?.capacity}
                    onChange={e => setEditingItem({ ...editingItem, capacity: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Đơn Giá vật tư (VND)</label>
                  <input 
                    type="number"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                    value={editingItem?.unitPrice}
                    onChange={e => setEditingItem({ ...editingItem, unitPrice: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors uppercase tracking-widest"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-md transition-colors uppercase tracking-widest"
                >
                  {editingItem?.id ? 'Cập nhật' : 'Lưu thiết bị'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

