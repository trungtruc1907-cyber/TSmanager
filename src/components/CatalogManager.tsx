import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Equipment } from '../types';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Package, 
  Cpu, 
  Battery, 
  Box, 
  X, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Warehouse, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign, 
  MapPin, 
  Calendar, 
  User 
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

type EquipmentCategory = 'panel' | 'inverter' | 'battery' | 'mounting' | 'accessory' | 'other';
type StockStatusFilter = 'all' | 'instock' | 'low' | 'outofstock';

interface CatalogManagerProps {
  userId?: string;
  userRole?: string;
}

export default function CatalogManager({ userId, userRole }: CatalogManagerProps) {
  const isAdmin = userRole === 'admin' || userRole === 'manager';
  
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('Nhân viên');
  
  // Filters & Search
  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | 'all'>('all');
  const [stockFilter, setStockFilter] = useState<StockStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<Equipment> | null>(null);
  
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<Equipment | null>(null);
  const [adjustType, setAdjustType] = useState<'import' | 'export'>('import');
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustNote, setAdjustNote] = useState<string>('');
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<Equipment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const categories: { id: EquipmentCategory; label: string; icon: any }[] = [
    { id: 'panel', label: 'Tấm pin PV', icon: Package },
    { id: 'inverter', label: 'Biến tần (Inverter)', icon: Cpu },
    { id: 'battery', label: 'Lưu trữ (Battery)', icon: Battery },
    { id: 'mounting', label: 'Hệ thống khung giá', icon: Box },
    { id: 'accessory', label: 'Phụ kiện & Cáp', icon: Box },
    { id: 'other', label: 'Thiết bị khác', icon: Box },
  ];

  // Load User Name
  useEffect(() => {
    if (!userId) return;
    const loadUserName = async () => {
      try {
        const userRef = doc(db, 'users', userId);
        const snap = await getDoc(userRef).catch((err) => {
          const isOffline = err instanceof Error && (
            err.message.toLowerCase().includes('offline') ||
            err.message.toLowerCase().includes('failed to get document')
          );
          if (isOffline) {
            console.warn("Could not fetch user profile in warehouse from server (operating in offline mode):", err);
          } else {
            console.error("Error loading user profile in warehouse:", err);
          }
          return null;
        });
        if (snap && snap.exists()) {
          const data = snap.data();
          setUserName(data.name || data.displayName || 'Nhân viên');
        }
      } catch (err) {
        console.warn("Error loading user profile in warehouse (possibly offline):", err);
      }
    };
    loadUserName();
  }, [userId]);

  // Real-time equipment catalog sync
  useEffect(() => {
    if (!userId) return;
    const q = collection(db, 'equipment');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawEquipment = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
      rawEquipment.sort((a, b) => {
        const brandA = a.brand || '';
        const brandB = b.brand || '';
        return brandA.localeCompare(brandB);
      });
      setEquipmentList(rawEquipment);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'equipment');
    });
    return () => unsubscribe();
  }, [userId]);

  // Save / Edit technical information
  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.brand || !editingItem?.model) return;

    try {
      const dataToSave = {
        type: editingItem.type || 'panel',
        brand: editingItem.brand.trim(),
        model: editingItem.model.trim(),
        capacity: Number(editingItem.capacity) || 0,
        unitPrice: Number(editingItem.unitPrice) || 0,
        sellingPrice: Number(editingItem.sellingPrice) || 0,
        details: editingItem.details?.trim() || '',
        isThreePhase: editingItem.isThreePhase || false,
        stock: Number(editingItem.stock) >= 0 ? Number(editingItem.stock) : 0,
        minStock: Number(editingItem.minStock) >= 0 ? Number(editingItem.minStock) : 5,
        location: editingItem.location?.trim() || 'Chưa định vị',
        history: editingItem.history || []
      };

      if (editingItem.id) {
        await updateDoc(doc(db, 'equipment', editingItem.id), dataToSave);
      } else {
        // Record initial inventory if first stock is set > 0
        if (dataToSave.stock > 0) {
          const initialLog = {
            id: Math.random().toString(36).substring(7),
            type: 'import' as const,
            quantity: dataToSave.stock,
            note: 'Tạo danh mục mới với lượng khai báo ban đầu',
            createdAt: new Date().toISOString(),
            createdBy: userId!,
            createdByName: userName
          };
          dataToSave.history = [initialLog];
        }
        await addDoc(collection(db, 'equipment'), dataToSave);
      }
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error saving equipment information:", error);
    }
  };

  // Submit in/out stock transaction
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem || adjustQty <= 0) return;

    try {
      const currentStock = adjustItem.stock || 0;
      let newStock = currentStock;

      if (adjustType === 'import') {
        newStock = currentStock + adjustQty;
      } else {
        newStock = Math.max(0, currentStock - adjustQty);
      }

      const transactionLog = {
        id: Math.random().toString(36).substring(7),
        type: adjustType,
        quantity: adjustQty,
        note: adjustNote.trim() || (adjustType === 'import' ? 'Nhập bổ sung kho' : 'Xuất kho sử dụng'),
        createdAt: new Date().toISOString(),
        createdBy: userId!,
        createdByName: userName
      };

      const updatedHistory = [transactionLog, ...(adjustItem.history || [])].slice(0, 50);

      // 1. Update Equipment Firestore Document
      await updateDoc(doc(db, 'equipment', adjustItem.id), {
        stock: newStock,
        history: updatedHistory
      });

      // 2. Add dynamic Notification to feed
      await addDoc(collection(db, 'notifications'), {
        title: adjustType === 'import' ? '📥 NHẬP KHO VẬT TƯ' : '📤 XUẤT KHO VẬT TƯ',
        message: `${userName} đã ${adjustType === 'import' ? 'nhập' : 'xuất'} ${adjustQty} chiếc ${adjustItem.brand} ${adjustItem.model} (${adjustType === 'import' ? 'Vào kho' : 'Khỏi kho'}). Ghi chú: ${transactionLog.note}`,
        type: 'task',
        createdAt: serverTimestamp(),
        createdBy: userId!,
        createdByName: userName
      });

      setIsAdjustModalOpen(false);
      setAdjustItem(null);
      setAdjustQty(1);
      setAdjustNote('');
    } catch (err) {
      console.error("Error operating inventory movement:", err);
    }
  };

  const handleDeleteEquipment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'equipment', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `equipment/${id}`);
    }
  };

  // Stats Calculations
  const stats = React.useMemo(() => {
    let totalItems = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    equipmentList.forEach(item => {
      const qty = item.stock || 0;
      const min = item.minStock || 0;
      totalItems += qty;
      totalValue += qty * (item.unitPrice || 0);

      if (qty === 0) {
        outOfStockCount++;
      } else if (qty <= min) {
        lowStockCount++;
      }
    });

    return { totalItems, totalValue, lowStockCount, outOfStockCount };
  }, [equipmentList]);

  // Filtering Logic
  const filteredEquipment = React.useMemo(() => {
    return equipmentList.filter(item => {
      // 1. Category filter
      if (categoryFilter !== 'all' && item.type !== categoryFilter) return false;

      // 2. Stock status filter
      const qty = item.stock || 0;
      const min = item.minStock || 0;
      if (stockFilter === 'instock' && qty <= min) return false;
      if (stockFilter === 'low' && (qty === 0 || qty > min)) return false;
      if (stockFilter === 'outofstock' && qty > 0) return false;

      // 3. Search query filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const brand = item.brand?.toLowerCase() || '';
        const model = item.model?.toLowerCase() || '';
        const location = item.location?.toLowerCase() || '';
        if (!brand.includes(query) && !model.includes(query) && !location.includes(query)) return false;
      }

      return true;
    });
  }, [equipmentList, categoryFilter, stockFilter, searchQuery]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-16 space-y-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      <p className="text-slate-500 font-medium italic text-sm">Đang đồng bộ hóa kho vật tư...</p>
    </div>
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-blue-600" /> Hệ Thống Quản Lý Kho & Vật Tư
          </h2>
          <p className="text-xs text-slate-500 font-medium">Theo dõi số lượng, vị trí lưu trữ, và lịch sử luân chuyển thiết bị vật tư solar.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => {
              setEditingItem({ type: 'panel', brand: '', model: '', capacity: 0, unitPrice: 0, sellingPrice: 0, details: '', stock: 0, minStock: 5, location: 'Khu A' });
              setIsEditModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-xl transition-all active:scale-95 shrink-0"
          >
            <Plus className="h-4 w-4" /> Khai báo vật tư mới
          </button>
        )}
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total stock items */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng Thiết Bị Trong Kho</p>
            <h3 className="text-xl font-black text-slate-800 mt-0.5">{stats.totalItems.toLocaleString('vi-VN')} <span className="text-xs font-bold text-slate-400">cái</span></h3>
          </div>
        </div>

        {/* Total Value */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giá Trị Tồn Kho Ước Tính</p>
            <h3 className="text-xl font-black text-emerald-600 mt-0.5">{formatCurrency(stats.totalValue)}</h3>
          </div>
        </div>

        {/* Low inventory alert */}
        <div className={cn(
          "p-4.5 rounded-2xl border flex items-center gap-4 shadow-xs transition-colors",
          stats.lowStockCount > 0 ? "bg-amber-50/50 border-amber-200" : "bg-white border-slate-200/80"
        )}>
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
            stats.lowStockCount > 0 ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-slate-100 text-slate-500"
          )}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sản Phẩm Sắp Hết Hàng</p>
            <h3 className={cn(
              "text-xl font-black mt-0.5",
              stats.lowStockCount > 0 ? "text-amber-700 font-extrabold" : "text-slate-800"
            )}>{stats.lowStockCount} <span className="text-xs font-bold text-slate-400">loại</span></h3>
          </div>
        </div>

        {/* Out of stok warning */}
        <div className={cn(
          "p-4.5 rounded-2xl border flex items-center gap-4 shadow-xs transition-colors",
          stats.outOfStockCount > 0 ? "bg-rose-50/50 border-rose-200" : "bg-white border-slate-200/80"
        )}>
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
            stats.outOfStockCount > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
          )}>
            <X className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sản Phẩm Đã Hết Kho</p>
            <h3 className={cn(
              "text-xl font-black mt-0.5",
              stats.outOfStockCount > 0 ? "text-rose-600 font-extrabold" : "text-slate-800"
            )}>{stats.outOfStockCount} <span className="text-xs font-bold text-slate-400">loại</span></h3>
          </div>
        </div>
      </div>

      {/* Control Tools Panel (Search, Filter, Status Tabs) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input 
              type="text"
              placeholder="Tìm theo thương hiệu, mã Sp, vị trí..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-500 bg-slate-50/50"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Stock Condition Badges */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <button 
              onClick={() => setStockFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all border shrink-0",
                stockFilter === 'all' ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              Tất cả trạng thái
            </button>
            <button 
              onClick={() => setStockFilter('instock')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all border shrink-0 flex items-center gap-1.5",
                stockFilter === 'instock' ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              <CheckCircle className="h-3 w-3" /> Còn hàng ({equipmentList.filter(item => (item.stock || 0) > (item.minStock || 0)).length})
            </button>
            <button 
              onClick={() => setStockFilter('low')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all border shrink-0 flex items-center gap-1.5",
                stockFilter === 'low' ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              <AlertTriangle className="h-3 w-3" /> Sắp hết ({equipmentList.filter(item => (item.stock || 0) > 0 && (item.stock || 0) <= (item.minStock || 0)).length})
            </button>
            <button 
              onClick={() => setStockFilter('outofstock')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all border shrink-0 flex items-center gap-1.5",
                stockFilter === 'outofstock' ? "bg-rose-600 border-rose-600 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              <X className="h-3 w-3" /> Chờ nhập kho ({equipmentList.filter(item => (item.stock || 0) === 0).length})
            </button>
          </div>
        </div>

        {/* Category Icons Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide border-t pt-3">
          <button 
            onClick={() => setCategoryFilter('all')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border shrink-0",
              categoryFilter === 'all' ? "bg-blue-600 border-blue-600 text-white shadow-xs" : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
            )}
          >
            Tất cả danh mục ({equipmentList.length})
          </button>
          {categories.map(cat => {
            const countInCat = equipmentList.filter(e => e.type === cat.id).length;
            return (
              <button 
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 shrink-0",
                  categoryFilter === cat.id ? "bg-blue-600 border-blue-600 text-white shadow-xs" : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                )}
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label} ({countInCat})
              </button>
            );
          })}
        </div>
      </div>

      {/* Equipment Warehouse Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredEquipment.map((item) => {
          const qty = item.stock || 0;
          const min = item.minStock || 0;
          
          let alertStatus: 'normal' | 'low' | 'out' = 'normal';
          if (qty === 0) {
            alertStatus = 'out';
          } else if (qty <= min) {
            alertStatus = 'low';
          }

          return (
            <div 
              key={item.id} 
              className={cn(
                "bg-white p-5 rounded-2xl border transition-all group relative flex flex-col justify-between overflow-hidden",
                alertStatus === 'out' ? "border-rose-200 hover:shadow-rose-50" : 
                alertStatus === 'low' ? "border-amber-200 hover:shadow-amber-50" : "border-slate-200 hover:shadow-slate-100",
                "hover:shadow-md hover:border-slate-300"
              )}
            >
              <div className="space-y-4">
                {/* Upper row: Icons & Action Triggers */}
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    item.type === 'panel' ? "bg-amber-50 text-amber-600" : 
                    item.type === 'inverter' ? "bg-blue-50 text-blue-600" : 
                    item.type === 'battery' ? "bg-emerald-50 text-emerald-600" : 
                    item.type === 'mounting' ? "bg-purple-50 text-purple-600" : "bg-slate-50 text-slate-500"
                  )}>
                    {item.type === 'panel' ? <Package className="h-5 w-5" /> : 
                    item.type === 'inverter' ? <Cpu className="h-5 w-5" /> : 
                    item.type === 'battery' ? <Battery className="h-5 w-5" /> : <Box className="h-5 w-5" />}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 p-0.5 rounded-lg border border-slate-100 shadow-xs">
                    {isAdmin && (
                      <>
                        <button 
                          onClick={() => { setEditingItem(item); setIsEditModalOpen(true); }}
                          title="Chỉnh sửa thông số kỹ thuật"
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => setDeletingId(item.id)}
                          title="Xóa thiết bị khỏi kho"
                          className="p-1 text-slate-500 hover:text-red-600 hover:bg-white rounded-md transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Main branding models details */}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase leading-none">{item.brand}</span>
                    {item.type === 'inverter' && (
                      <span className={cn(
                        "text-[7px] px-1 py-0.5 font-bold uppercase rounded border scale-95",
                        item.isThreePhase ? "bg-purple-150 text-purple-700 border-purple-200" : "bg-blue-150 text-blue-700 border-blue-200"
                      )}>
                        {item.isThreePhase ? '3 Pha' : '1 Pha'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-slate-800 leading-tight mt-1 line-clamp-1" title={item.model}>
                    {item.model}
                  </h3>
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-tight">
                    <MapPin className="h-3 w-3 text-slate-300" />
                    <span>{item.location || 'Chưa phân phái'}</span>
                  </div>
                  {item.details && (
                    <div className="mt-2 text-[11px] text-slate-500 font-semibold italic line-clamp-2 border-l-2 border-slate-200 pl-1.5" title={item.details}>
                      {item.details}
                    </div>
                  )}
                </div>

                {/* Stock values badge & progress indicator */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px]">Lượng tồn kho</span>
                    <span className={cn(
                      "font-black tracking-tight",
                      alertStatus === 'out' ? "text-rose-600 animate-pulse bg-rose-50 px-1.5 py-0.5 rounded" : 
                      alertStatus === 'low' ? "text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded" : "text-emerald-600"
                    )}>
                      {qty} / <span className="text-[10px] text-slate-400 font-semibold">{min} min</span>
                    </span>
                  </div>

                  {/* Stock micro bar indicator */}
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        alertStatus === 'out' ? "w-0" :
                        alertStatus === 'low' ? "bg-amber-400" : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(100, (qty / Math.max(1, min * 2.5)) * 100)}%` }}
                    />
                  </div>

                  {/* Alert notifications label */}
                  {alertStatus === 'out' && (
                    <div className="text-[8px] font-black text-rose-500 uppercase tracking-widest text-center mt-1">🔴 HẾT HÀNG - CẦN NHẬP</div>
                  )}
                  {alertStatus === 'low' && (
                    <div className="text-[8px] font-black text-amber-500 uppercase tracking-widest text-center mt-1">🟡 DƯỚI ĐỊNH MỨC CẢNH BÁO</div>
                  )}
                  {alertStatus === 'normal' && (
                    <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest text-center mt-1">🟢 KHO HÀNG AN TOÀN</div>
                  )}
                </div>

                {/* Basic financial values */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px] font-medium leading-none">
                    <span className="text-slate-400">Giá nhập vật tư:</span>
                    <span className="text-slate-700 font-bold">{formatCurrency(item.unitPrice || 0)}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-medium leading-none border-t border-slate-50 pt-1.5">
                    <span className="text-slate-400">Giá bán dự kiến:</span>
                    <span className="text-emerald-600 font-bold">{item.sellingPrice ? formatCurrency(item.sellingPrice) : 'Chưa thiết lập'}</span>
                  </div>
                  <div className="flex justify-between text-[11px] font-medium leading-none border-t border-slate-50 pt-1.5">
                    <span className="text-slate-400">Giá trị tồn kho (nhập):</span>
                    <span className="text-slate-900 font-black">{formatCurrency(qty * (item.unitPrice || 0))}</span>
                  </div>
                </div>
              </div>

              {/* Warehouse dynamic in-out movement control panel */}
              <div className="mt-4 border-t border-slate-100 pt-3 flex gap-1.5 shrink-0">
                <button 
                  onClick={() => {
                    setAdjustItem(item);
                    setAdjustType('import');
                    setIsAdjustModalOpen(true);
                  }}
                  className="flex-1 bg-blue-50/70 hover:bg-blue-105 border border-blue-100 text-blue-700 py-1.5 rounded-lg flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider transition-all active:scale-95"
                  title="Nhập thêm vật tư"
                >
                  <ArrowUpRight className="h-3 w-3" /> Nhập kho
                </button>
                <button 
                  onClick={() => {
                    setAdjustItem(item);
                    setAdjustType('export');
                    setIsAdjustModalOpen(true);
                  }}
                  disabled={qty === 0}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 border",
                    qty === 0 
                      ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed" 
                      : "bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700"
                  )}
                  title="Xuất vật tư ra kho"
                >
                  <ArrowDownLeft className="h-3 w-3" /> Xuất kho
                </button>
                <button 
                  onClick={() => {
                    setHistoryItem(item);
                    setIsHistoryModalOpen(true);
                  }}
                  className="px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg flex items-center justify-center transition-all active:scale-95"
                  title="Xem lịch sử luân chuyển kho"
                >
                  <History className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredEquipment.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white border border-dashed border-slate-200 rounded-2xl shadow-xs">
            <Box className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium italic">Không tìm thấy mã thiết bị nào phù hợp trong kho.</p>
            <p className="text-slate-300 text-xs mt-1">Vui lòng thử cấu hình lại thanh tìm kiếm hoặc bộ lọc trạng thái.</p>
          </div>
        )}
      </div>

      {/* MODAL 1: Nhập/Xuất kho vật tư */}
      {isAdjustModalOpen && adjustItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150">
            <div className="flex justify-between items-center mb-5 border-b pb-3">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "p-1.5 rounded-lg",
                  adjustType === 'import' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                )}>
                  {adjustType === 'import' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                </span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  {adjustType === 'import' ? 'Nhập kho bổ sung' : 'Xuất kho vật tư'}
                </h3>
              </div>
              <button 
                onClick={() => { setIsAdjustModalOpen(false); setAdjustItem(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Thiết bị thao tác</p>
              <p className="text-xs font-black text-slate-700 mt-1">{adjustItem.brand} - {adjustItem.model}</p>
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold mt-1">
                <span>Lượng hiện có: {adjustItem.stock || 0} cái</span>
                <span>Vị trí: {adjustItem.location || 'Chưa rõ'}</span>
              </div>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Số lượng thao tác (chiếc/tấm)</label>
                <input 
                  type="number"
                  required
                  min={1}
                  max={adjustType === 'export' ? (adjustItem.stock || 0) : 9999}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs"
                  value={adjustQty}
                  onChange={e => setAdjustQty(Math.max(1, Number(e.target.value)))}
                />
                {adjustType === 'export' && (adjustItem.stock || 0) < adjustQty && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-1">Số lượng xuất kho vượt quá lượng tồn kho hiện tại!</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Lý do / Mô tả chi tiết
                </label>
                <textarea 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all h-20 resize-none shadow-xs"
                  placeholder={adjustType === 'import' ? 'VD: Nhập thêm lô hàng từ Canadian Solar Vietnam' : 'VD: Xuất kho phục vụ lắp đặt dự án Hòa Lưới 10kW Hoàng Mai'}
                  required
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                />
                
                {/* Suggestions templates */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {(adjustType === 'import' 
                    ? ['Đại lý nhập hàng sỉ', 'Hàng dư công trình trả kho', 'Kiểm kê bù dư']
                    : ['Xuất cho tổ thi công', 'Hàng lỗi gửi bảo hành', 'Xuất mẫu khảo sát']
                  ).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAdjustNote(t)}
                      className="text-[9px] font-bold text-slate-400 bg-slate-100 hover:bg-slate-200 hover:text-slate-600 px-2 py-0.5 rounded transition-all"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-2.5">
                <button 
                  type="button"
                  onClick={() => { setIsAdjustModalOpen(false); setAdjustItem(null); }}
                  className="flex-1 py-2.5 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all uppercase tracking-wider text-center"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  disabled={adjustType === 'export' && (adjustItem.stock || 0) < adjustQty}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-black text-white rounded-xl shadow-md transition-all uppercase tracking-wider text-center",
                    adjustType === 'export' && (adjustItem.stock || 0) < adjustQty
                      ? "bg-slate-350 cursor-not-allowed"
                      : adjustType === 'import' ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-500 hover:bg-amber-600"
                  )}
                >
                  Đồng ý lưu {adjustQty} SP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Tạo mới & Chỉnh sửa kỹ thuật thiết bị */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150">
            <div className="flex justify-between items-center mb-5 border-b pb-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />
                {editingItem?.id ? 'HIỆU CHỈNH THÔNG SỐ VẬT TƯ' : 'KHAI BÁO THÔNG TIN VẬT TƯ MỚI'}
              </h3>
              <button 
                onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEquipment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Nhóm thiết bị</label>
                  <select 
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                    value={editingItem?.type}
                    onChange={e => setEditingItem({ ...editingItem, type: e.target.value as any })}
                  >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Hãng sản xuất</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white uppercase"
                    value={editingItem?.brand}
                    placeholder="VD: Canadian Solar"
                    onChange={e => setEditingItem({ ...editingItem, brand: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Model / Mã ký hiệu</label>
                <input 
                  required
                  type="text"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                  value={editingItem?.model}
                  placeholder="VD: HiKu6 CS6W-550MS"
                  onChange={e => setEditingItem({ ...editingItem, model: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Công suất ({editingItem?.type === 'panel' ? 'Wp' : 'kW'})
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                    value={editingItem?.capacity}
                    onChange={e => setEditingItem({ ...editingItem, capacity: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Đơn vị giá nhập (VND)</label>
                  <input 
                    type="number"
                    step="1000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                    value={editingItem?.unitPrice}
                    onChange={e => setEditingItem({ ...editingItem, unitPrice: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Đơn vị giá bán dự kiến (VND)</label>
                  <input 
                    type="number"
                    step="1000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                    placeholder="Nhập giá bán dự kiến cho khách hàng..."
                    value={editingItem?.sellingPrice || ''}
                    onChange={e => setEditingItem({ ...editingItem, sellingPrice: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Chi tiết vật tư / Thông số mô tả</label>
                <textarea 
                  rows={2}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white resize-none"
                  placeholder="Nhập chi tiết vật tư, đặc tính kỹ thuật hoặc hướng dẫn..."
                  value={editingItem?.details || ''}
                  onChange={e => setEditingItem({ ...editingItem, details: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-150">
                <div className="col-span-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Tồn ban đầu</label>
                  <input 
                    type="number"
                    disabled={!!editingItem?.id}
                    title={editingItem?.id ? "Tăng giảm số lượng vui lòng dùng tính năng Nhập/Xuất kho để ghi nhận nhật ký" : "Dữ liệu ban đầu"}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100"
                    value={editingItem?.stock}
                    onChange={e => setEditingItem({ ...editingItem, stock: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Cảnh báo tối thiểu</label>
                  <input 
                    type="number"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                    value={editingItem?.minStock}
                    onChange={e => setEditingItem({ ...editingItem, minStock: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Phân Khu / Kệ</label>
                  <input 
                    type="text"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                    value={editingItem?.location}
                    placeholder="Khu A"
                    onChange={e => setEditingItem({ ...editingItem, location: e.target.value })}
                  />
                </div>
              </div>

              {editingItem?.type === 'inverter' && (
                <div className="bg-blue-50/20 p-4 rounded-xl border border-blue-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={editingItem?.isThreePhase || false}
                      onChange={e => setEditingItem({ ...editingItem, isThreePhase: e.target.checked })}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Cấu hình lưới điện 3 Pha</span>
                      <span className="text-[10px] text-slate-500 font-medium">Bỏ chọn nếu là biến tần 1 pha dân dụng</span>
                    </div>
                  </label>
                </div>
              )}

              <div className="pt-4 flex gap-2.5">
                <button 
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }}
                  className="flex-1 py-2.5 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all uppercase tracking-wider text-center"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all uppercase tracking-wider text-center"
                >
                  {editingItem?.id ? 'Cập nhật thiết bị' : 'Lưu thiết bị mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Chi tiết lịch sử giao dịch kho */}
      {isHistoryModalOpen && historyItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 border-b pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-blue-600" />
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                    Nhật Ký Luân Chuyển Kho
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold">{historyItem.brand} - {historyItem.model}</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsHistoryModalOpen(false); setHistoryItem(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* General state */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 shrink-0 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Lượng Tồn Hiện Tại</span>
                <span className="text-sm font-extrabold text-blue-600 mt-0.5 block">{historyItem.stock || 0} SP</span>
              </div>
              <div>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Vị Trí Sắp Đặt</span>
                <span className="text-sm font-extrabold text-slate-700 mt-0.5 block">{historyItem.location || 'Khu A'}</span>
              </div>
              <div>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Định Mức Cảnh Báo</span>
                <span className="text-sm font-extrabold text-slate-700 mt-0.5 block">{historyItem.minStock || 5} SP</span>
              </div>
            </div>

            {/* List transactions */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[250px]">
              {historyItem.history && historyItem.history.length > 0 ? (
                historyItem.history.map((log, index) => (
                  <div 
                    key={log.id || index}
                    className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-start gap-3 text-xs justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0",
                          log.type === 'import' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-amber-50 text-amber-600 border-amber-100"
                        )}>
                          {log.type === 'import' ? 'Nhập kho' : 'Xuất kho'}
                        </span>
                        <span className="text-slate-700 font-extrabold">
                          {log.type === 'import' ? `+${log.quantity}` : `-${log.quantity}`} chiếc
                        </span>
                      </div>
                      <p className="text-slate-600 font-semibold leading-normal">{log.note}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400 font-bold pt-1 border-t border-dashed border-slate-100 my-0.5">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-300" />
                          <span>Thực hiện: {log.createdByName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-300" />
                          <span>Thời gian: {new Date(log.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-400 italic">
                  Chưa ghi nhận hoạt động luân chuyển kho nào cho thiết bị này.
                </div>
              )}
            </div>

            <div className="pt-4 border-t mt-4 shrink-0">
              <button 
                onClick={() => { setIsHistoryModalOpen(false); setHistoryItem(null); }}
                className="w-full py-2.5 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all uppercase tracking-wider text-center"
              >
                Đóng lịch sử
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Xác nhận xóa */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150 text-center">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-7 w-7" />
            </div>
            <h3 className="text-md font-black text-slate-900 mb-2 uppercase tracking-wide">Xác nhận xóa vật tư?</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">Hành động này sẽ xóa vĩnh viễn thiết bị kỹ thuật này và lịch sử kho liên quan ra khỏi hệ thống.</p>
            
            <div className="flex gap-2.5">
              <button 
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all uppercase tracking-wider"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => handleDeleteEquipment(deletingId)}
                className="flex-1 py-2 text-xs font-black bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-all uppercase tracking-wider"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
