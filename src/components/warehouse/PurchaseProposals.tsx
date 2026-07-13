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
  DollarSign,
  ArrowLeft,
  Trash2,
  FileSpreadsheet,
  Upload,
  Calendar,
  ChevronDown
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

  // Order / Purchase Popup Modal States
  const [selectedProposalForOrder, setSelectedProposalForOrder] = useState<PurchaseProposal | null>(null);
  const [orderPaidAmount, setOrderPaidAmount] = useState<number>(0);
  const [orderNote, setOrderNote] = useState<string>('');

  // Form states
  const [formReason, setFormReason] = useState('');
  const [eqSearch, setEqSearch] = useState('');
  const [formItems, setFormItems] = useState<Array<{ 
    equipmentId: string; 
    quantity: number; 
    unitPrice: number; 
    supplierId?: string; 
  }>>([]);

  // Mockup-inspired States
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [customPaidAmount, setCustomPaidAmount] = useState(0);
  const [proposalSearchTerm, setProposalSearchTerm] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Filter equipment for the picker in modal
  const filteredEquipment = equipment.filter(eq => 
    (eq.id || '').toLowerCase().includes(eqSearch.toLowerCase()) ||
    (eq.brand || '').toLowerCase().includes(eqSearch.toLowerCase()) ||
    (eq.model || '').toLowerCase().includes(eqSearch.toLowerCase()) ||
    (eq.details || '').toLowerCase().includes(eqSearch.toLowerCase()) ||
    (eq.type || '').toLowerCase().includes(eqSearch.toLowerCase())
  );

  // Filter and sort proposals (newest first)
  const filteredProposals = proposals
    .filter(prop => {
      const searchMatch = 
        (prop.supplierName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
        (prop.id || '').toLowerCase().includes((searchTerm || '').toLowerCase());

      const statusMatch = statusFilter === 'all' || prop.status === statusFilter;

      return searchMatch && statusMatch;
    })
    .sort((a, b) => {
      const dateA = getSafeISOString(a.createdAt);
      const dateB = getSafeISOString(b.createdAt);
      // Descending order: newest first
      return dateB.localeCompare(dateA);
    });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Add item to proposal list
  const handleAddItem = (equipmentId: string) => {
    if (formItems.some(item => item.equipmentId === equipmentId)) return;
    const eq = equipment.find(e => e.id === equipmentId);
    
    // Find matching supplier
    let defaultSupplierId = '';
    if (eq?.supplier && suppliers.length > 0) {
      const foundSup = suppliers.find(s => 
        s.name?.toLowerCase().includes(eq.supplier!.toLowerCase()) || 
        eq.supplier!.toLowerCase().includes(s.name?.toLowerCase())
      );
      if (foundSup) {
        defaultSupplierId = foundSup.id;
      }
    }

    setFormItems([...formItems, { 
      equipmentId, 
      quantity: eq && eq.stock && eq.minStock ? Math.max(1, eq.minStock - eq.stock) : 10, 
      unitPrice: eq?.unitPrice || 2000000,
      supplierId: defaultSupplierId
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

  const handleItemSupplierChange = (idx: number, supId: string) => {
    const newItems = [...formItems];
    newItems[idx].supplierId = supId;
    setFormItems(newItems);
  };

  const calculateTotalCost = () => {
    return formItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  // Grouping logic for proposed items
  const getGroupedProposals = () => {
    const groups: { [supplierId: string]: { supplierName: string; items: typeof formItems; totalCost: number } } = {};
    
    formItems.forEach(item => {
      const supId = item.supplierId || 'unassigned';
      const selectedSup = suppliers.find(s => s.id === supId);
      const supplierName = selectedSup ? selectedSup.name : 'Chưa gán nhà cung cấp ⚠️';
      
      if (!groups[supId]) {
        groups[supId] = { supplierName, items: [], totalCost: 0 };
      }
      groups[supId].items.push(item);
      groups[supId].totalCost += (item.quantity * item.unitPrice);
    });
    
    return groups;
  };

  // Create Proposal
  const handleCreateProposal = async (e: React.FormEvent, statusOverride?: 'pending' | 'approved') => {
    e.preventDefault();
    if (formItems.length === 0) {
      alert('Vui lòng lập danh sách vật tư cần mua.');
      return;
    }

    const finalStatus = statusOverride || 'pending';
    const finalSupplierId = selectedSupplierId || (suppliers[0]?.id || 'unassigned');
    const selectedSup = suppliers.find(s => s.id === finalSupplierId);
    const finalSupplierName = selectedSup ? selectedSup.name : 'Chưa gán nhà cung cấp';

    try {
      const propId = 'MH-' + Math.floor(1000 + Math.random() * 9000);
      const totalCost = formItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

      const payload: PurchaseProposal = {
        id: propId,
        supplierId: finalSupplierId,
        supplierName: finalSupplierName,
        reason: formReason.trim() || 'Lập đề xuất mua hàng',
        totalCost: totalCost,
        status: finalStatus,
        createdAt: new Date().toISOString(),
        paidAmount: finalStatus === 'approved' ? customPaidAmount : 0,
        debtAmount: finalStatus === 'approved' ? Math.max(0, totalCost - customPaidAmount) : totalCost,
        orderNote: invoiceNumber ? `Số hóa đơn: ${invoiceNumber}` : '',
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
      setFormReason('');
      setFormItems([]);
      setInvoiceNumber('');
      setCustomPaidAmount(0);
      setProposalSearchTerm('');
      alert(finalStatus === 'approved' 
        ? `Lập phiếu mua hàng #${propId} thành công & Đã tự động duyệt!` 
        : `Lưu tạm phiếu mua hàng #${propId} thành công!`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'purchase_proposals');
    }
  };

  // Simulate downloading Excel template
  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,STT,MaHang,TenHang,DVT,SoLuong,DonGia\n1,PV-LONGI-450,Tam pin mat troi Longi 450W,Tam,15,4200000\n2,INV-SUNGROW-5KW,Bien tan inverter Sungrow 5KW,Bo,4,18500000";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Mau_file_nhap_kho_vattu.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSimulateExcelUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (equipment.length < 2) {
      alert("Hệ thống cần ít nhất 2 thiết bị trong danh mục để mô phỏng nhập file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const imported: typeof formItems = [];

      if (text && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
        const lines = text.split('\n');
        for (let line of lines) {
          const parts = line.split(/[;,]/);
          if (parts.length >= 2) {
            const idCandidate = parts[0].trim().replace(/['"]/g, '');
            const qtyCandidate = parseInt(parts[1].trim());
            const priceCandidate = parts[2] ? parseInt(parts[2].trim()) : undefined;

            const foundEq = equipment.find(eq => eq.id.toLowerCase() === idCandidate.toLowerCase());
            if (foundEq && !isNaN(qtyCandidate) && qtyCandidate > 0) {
              if (!imported.some(item => item.equipmentId === foundEq.id)) {
                imported.push({
                  equipmentId: foundEq.id,
                  quantity: qtyCandidate,
                  unitPrice: priceCandidate || foundEq.unitPrice || 1500000,
                  supplierId: selectedSupplierId || (suppliers[0]?.id || '')
                });
              }
            }
          }
        }
      }

      if (imported.length === 0) {
        const itemsToImport = equipment.slice(0, 3);
        itemsToImport.forEach((eq, idx) => {
          imported.push({
            equipmentId: eq.id,
            quantity: idx === 0 ? 12 : idx === 1 ? 8 : 25,
            unitPrice: eq.unitPrice || 1500000,
            supplierId: selectedSupplierId || (suppliers[0]?.id || '')
          });
        });
      }

      setFormItems(imported);
      
      const totalCost = imported.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      setCustomPaidAmount(totalCost);

      alert(`Đã nhập khẩu thành công ${imported.length} sản phẩm từ tệp: ${file.name}!`);
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
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

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProposalForOrder) return;
    try {
      const propRef = doc(db, 'purchase_proposals', selectedProposalForOrder.id);
      const paid = Number(orderPaidAmount) || 0;
      const debt = Math.max(0, (selectedProposalForOrder.totalCost || 0) - paid);
      await updateDoc(propRef, {
        status: 'ordering',
        paidAmount: paid,
        debtAmount: debt,
        orderNote: orderNote.trim(),
        orderedAt: new Date().toISOString()
      });
      setSelectedProposalForOrder(null);
      setOrderPaidAmount(0);
      setOrderNote('');
      alert(`Đã gieo đơn & Đặt hàng thành công Phiếu #${selectedProposalForOrder.id}! Phiếu mua hàng đã tự động chuyển sang tab "Nhập kho".`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'purchase_proposals');
    }
  };

  const handleChangeSupplier = async (propId: string, newSupplierId: string) => {
    try {
      const selectedSup = suppliers.find(s => s.id === newSupplierId);
      if (!selectedSup) return;
      await updateDoc(doc(db, 'purchase_proposals', propId), {
        supplierId: newSupplierId,
        supplierName: selectedSup.name
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'purchase_proposals');
    }
  };

  return (
    <div className="space-y-6">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".xlsx, .xls, .csv, .txt" 
        className="hidden" 
      />
      
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
                    <td className="px-6 py-4 font-mono text-[10px] font-black text-slate-400">
                      <div>#{prop.id}</div>
                      {(prop.reason?.toLowerCase().includes('tự động') || prop.reason?.toLowerCase().includes('đề xuất')) && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-[9px] font-black tracking-wider uppercase">Tự động</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-700 shrink-0">
                          <Building className="h-3.5 w-3.5 text-slate-500" />
                        </div>
                        {prop.status === 'pending' ? (
                          <select
                            value={prop.supplierId}
                            onChange={(e) => handleChangeSupplier(prop.id, e.target.value)}
                            className="text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer max-w-[200px]"
                          >
                            {suppliers.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-xs font-black text-slate-800">{prop.supplierName}</span>
                        )}
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
                            onClick={() => {
                              setSelectedProposalForOrder(prop);
                              setOrderPaidAmount(prop.totalCost || 0);
                              setOrderNote('');
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                          >
                            Duyệt mua
                          </button>
                        )}
                        {prop.status === 'approved' && (
                          <button
                            onClick={() => {
                              setSelectedProposalForOrder(prop);
                              setOrderPaidAmount(prop.totalCost || 0);
                              setOrderNote('');
                            }}
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-0 md:p-4 overflow-hidden animate-fade-in">
          <div className="bg-slate-50 w-full h-full max-w-7xl md:h-[95vh] md:max-h-[900px] md:rounded-3xl border border-slate-100 shadow-2xl flex flex-col justify-between overflow-hidden relative">
            
            {/* Top Navigation Bar */}
            <div className="bg-white px-6 py-4 border-b border-slate-150 flex items-center justify-between shrink-0">
              <div className="flex items-center flex-1">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="mr-4 p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-all cursor-pointer flex items-center justify-center"
                  title="Quay lại"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase mr-6">Nhập hàng</h2>
                
                {/* Search Input: Tìm hàng hóa theo mã hoặc tên (F3) */}
                <div className="relative flex-1 max-w-xl">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm hàng hóa theo mã hoặc tên (F3)"
                    value={proposalSearchTerm}
                    onChange={(e) => {
                      setProposalSearchTerm(e.target.value);
                      setShowSearchDropdown(true);
                    }}
                    onFocus={() => setShowSearchDropdown(true)}
                    className="w-full pl-9 pr-10 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 font-bold transition-all"
                  />
                  {proposalSearchTerm && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setProposalSearchTerm('');
                        setShowSearchDropdown(false);
                      }} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-0 outline-none cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Autocomplete Dropdown */}
                  {showSearchDropdown && proposalSearchTerm && (
                    <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-50">
                      {equipment.filter(eq => 
                        (eq.id || '').toLowerCase().includes(proposalSearchTerm.toLowerCase()) ||
                        (eq.brand || '').toLowerCase().includes(proposalSearchTerm.toLowerCase()) ||
                        (eq.model || '').toLowerCase().includes(proposalSearchTerm.toLowerCase())
                      ).length === 0 ? (
                        <div className="p-4 text-xs text-slate-400 italic text-center">Không tìm thấy vật tư nào...</div>
                      ) : (
                        equipment.filter(eq => 
                          (eq.id || '').toLowerCase().includes(proposalSearchTerm.toLowerCase()) ||
                          (eq.brand || '').toLowerCase().includes(proposalSearchTerm.toLowerCase()) ||
                          (eq.model || '').toLowerCase().includes(proposalSearchTerm.toLowerCase())
                        ).map(eq => (
                          <button
                            key={eq.id}
                            type="button"
                            onClick={() => {
                              handleAddItem(eq.id);
                              setProposalSearchTerm('');
                              setShowSearchDropdown(false);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50/50 flex justify-between items-center text-xs transition-colors"
                          >
                            <div className="pr-3">
                              <span className="font-extrabold text-slate-800 block">{eq.brand} - {eq.model}</span>
                              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Mã hàng: {eq.id} | ĐVT: {eq.unit || 'Cái'}</span>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded-lg shrink-0">Thêm +</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content Columns split */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
              
              {/* Left Column: Table Ledger Grid */}
              <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
                {formItems.length === 0 ? (
                  /* Empty state exactly matching the user's mockup */
                  <div className="h-full flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200/60 p-8 shadow-xs max-w-3xl mx-auto my-6">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5 border border-emerald-100 shadow-xs">
                      <FileSpreadsheet className="h-8 w-8" />
                    </div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-1">Thêm sản phẩm từ file excel</h3>
                    <button 
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline mb-6 cursor-pointer bg-transparent border-0 outline-none"
                    >
                      (Tải về file mẫu:Excel file)
                    </button>
                    
                    <button 
                      type="button"
                      onClick={handleSimulateExcelUpload}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer border-0"
                    >
                      <Upload className="h-4 w-4" />
                      Chọn file dữ liệu
                    </button>
                  </div>
                ) : (
                  /* Form Item Table rendering exactly as in the image */
                  <div className="bg-white rounded-2xl border border-slate-200/60 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-blue-50/40 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                            <th className="px-4 py-4.5 text-center w-14">STT</th>
                            <th className="px-4 py-4.5">Mã hàng</th>
                            <th className="px-6 py-4.5">Tên hàng</th>
                            <th className="px-4 py-4.5 text-center">ĐVT</th>
                            <th className="px-5 py-4.5 text-center w-28">Số lượng</th>
                            <th className="px-5 py-4.5 text-right w-36">Đơn giá (₫)</th>
                            <th className="px-5 py-4.5 text-right w-36">Thành tiền</th>
                            <th className="px-4 py-4.5 text-center w-14"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                          {formItems.map((item, index) => {
                            const eq = equipment.find(e => e.id === item.equipmentId);
                            return (
                              <tr key={index} className="hover:bg-slate-50/40 transition-colors">
                                {/* STT */}
                                <td className="px-4 py-4 text-center text-slate-400 font-mono font-bold">
                                  {index + 1}
                                </td>
                                
                                {/* Mã hàng */}
                                <td className="px-4 py-4 font-mono font-bold text-slate-500">
                                  {item.equipmentId}
                                </td>
                                
                                {/* Tên hàng */}
                                <td className="px-6 py-4">
                                  <div>
                                    <span className="font-extrabold text-slate-800 block text-xs">
                                      {eq?.brand} {eq?.model}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 block mt-0.5">
                                      Nhóm: {eq?.type === 'panel' ? 'Tấm pin Solar' : eq?.type === 'inverter' ? 'Biến tần Inverter' : eq?.type === 'battery' ? 'Pin lưu trữ' : 'Phụ kiện'}
                                    </span>
                                  </div>
                                </td>
                                
                                {/* ĐVT */}
                                <td className="px-4 py-4 text-center text-slate-500">
                                  {eq?.unit || 'Cái'}
                                </td>
                                
                                {/* Số lượng */}
                                <td className="px-5 py-4">
                                  <div className="flex items-center justify-center border border-slate-200 bg-white rounded-lg p-1 w-24 mx-auto">
                                    <button 
                                      type="button"
                                      onClick={() => handleQtyChange(index, item.quantity - 1)}
                                      className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors cursor-pointer text-xs font-bold"
                                    >
                                      -
                                    </button>
                                    <input 
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => handleQtyChange(index, Number(e.target.value))}
                                      className="w-10 text-center font-bold text-slate-800 focus:outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-0 py-0 text-xs"
                                    />
                                    <button 
                                      type="button"
                                      onClick={() => handleQtyChange(index, item.quantity + 1)}
                                      className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-800 transition-colors cursor-pointer text-xs font-bold"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                
                                {/* Đơn giá */}
                                <td className="px-5 py-4">
                                  <input 
                                    type="number"
                                    value={item.unitPrice}
                                    onChange={(e) => handlePriceChange(index, Number(e.target.value))}
                                    className="w-full px-2.5 py-1.5 font-bold text-right text-slate-800 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-slate-50/20 text-xs"
                                    placeholder="Giá mua..."
                                  />
                                </td>
                                
                                {/* Thành tiền */}
                                <td className="px-5 py-4 text-right font-extrabold text-slate-900">
                                  {formatCurrency(item.quantity * item.unitPrice)}
                                </td>
                                
                                {/* Actions */}
                                <td className="px-4 py-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveItem(index)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                    title="Xóa vật tư"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="bg-slate-50/50 p-4 border-t border-slate-100 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400 uppercase tracking-wider">Tổng số vật tư: {formItems.length} dòng</span>
                      <button 
                        type="button"
                        onClick={() => setFormItems([])}
                        className="text-rose-600 hover:text-rose-700 font-bold hover:underline bg-transparent border-0 cursor-pointer"
                      >
                        Xóa tất cả
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Right Column: Control Sidebar Panel */}
              <div className="w-full md:w-96 bg-white border-t md:border-t-0 md:border-l border-slate-150 p-6 flex flex-col justify-between overflow-y-auto shrink-0">
                <div className="space-y-5">
                  
                  {/* Supplier dropdown */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Nhà cung cấp</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select
                          required
                          value={selectedSupplierId}
                          onChange={(e) => setSelectedSupplierId(e.target.value)}
                          className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-extrabold text-xs text-slate-800 cursor-pointer appearance-none"
                        >
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => {
                          const newName = prompt('Nhập tên nhà cung cấp mới:');
                          if (newName) {
                            alert(`Yêu cầu thêm nhà cung cấp "${newName}" đã được gửi tới Quản trị viên.`);
                          }
                        }}
                        className="w-10 h-10 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl flex items-center justify-center transition-colors cursor-pointer font-bold"
                        title="Thêm nhà cung cấp mới"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* Date & Time Timestamp indicator */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Ngày lập phiếu</label>
                      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-600 flex items-center gap-1.5 select-none">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {new Date().toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Giờ lập</label>
                      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-600 text-center select-none">
                        {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>

                  {/* Automatic IDs & Document Status Indicators */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Mã phiếu nhập</label>
                      <input 
                        type="text"
                        disabled
                        placeholder="Mã phiếu tự động"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-150 rounded-xl text-xs font-bold text-slate-400 italic"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Mã đặt hàng nhập</label>
                      <input 
                        type="text"
                        disabled
                        placeholder="(Bỏ trống)"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-150 rounded-xl text-xs font-bold text-slate-400 text-center"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Trạng thái</label>
                      <div className="px-3 py-2 bg-amber-50 text-amber-700 border border-amber-100 rounded-xl text-xs font-extrabold text-center select-none">
                        Phiếu tạm (Draft)
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Hóa đơn mua đầu vào</label>
                      <input 
                        type="text"
                        placeholder="Số hóa đơn VAT..."
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Separator Line */}
                  <hr className="border-slate-100" />

                  {/* Totals & Payments Ledger calculations */}
                  <div className="space-y-3 bg-slate-50/50 p-4.5 rounded-2xl border border-slate-200/60 shadow-xs">
                    
                    {/* General Total */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-500 flex items-center gap-1">
                        Tổng tiền hàng 
                        <span className="cursor-help text-slate-300" title="Tổng giá trị các vật tư đã chọn">ⓘ</span>
                      </span>
                      <span className="font-black text-sm text-slate-850">
                        {formatCurrency(formItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0))}
                      </span>
                    </div>

                    {/* Paid amount by store to supplier */}
                    <div className="space-y-1.5 pt-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Tiền trả nhà cung cấp</label>
                        <button 
                          type="button"
                          onClick={() => setCustomPaidAmount(formItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0))}
                          className="text-[10px] font-black text-blue-600 hover:text-blue-700 bg-transparent border-0 cursor-pointer"
                        >
                          [ Trả hết ]
                        </button>
                      </div>
                      <div className="relative">
                        <input 
                          type="number"
                          value={customPaidAmount}
                          onChange={(e) => setCustomPaidAmount(Number(e.target.value))}
                          className="w-full pl-3.5 pr-12 py-2 text-right font-black text-slate-800 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs bg-white"
                          placeholder="0"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-450 select-none">₫</span>
                      </div>
                    </div>

                    {/* Leftover Account Debt */}
                    <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200/50">
                      <span className="font-black text-slate-700">Tính vào công nợ</span>
                      <span className="font-black text-sm text-blue-600">
                        {formatCurrency(Math.max(0, formItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) - customPaidAmount))}
                      </span>
                    </div>

                  </div>

                  {/* General Note text box */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Ghi chú</label>
                    <textarea 
                      placeholder="Ghi chú (Ví dụ: Nhập dự phòng pin lưu trữ mùa mưa bão...)"
                      value={formReason}
                      onChange={(e) => setFormReason(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:bg-white focus:border-blue-500 font-bold text-xs text-slate-700 placeholder:text-slate-350 resize-none"
                    />
                  </div>

                </div>

                {/* Sidebar Bottom Action Buttons exactly like mockup */}
                <div className="pt-6 space-y-3">
                  <button
                    type="button"
                    disabled={formItems.length === 0}
                    onClick={(e) => handleCreateProposal(e, 'pending')}
                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 border ${
                      formItems.length === 0 
                        ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed shadow-none' 
                        : 'border-blue-600 bg-white text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    Lưu tạm
                  </button>
                  <button
                    type="button"
                    disabled={formItems.length === 0}
                    onClick={(e) => handleCreateProposal(e, 'approved')}
                    className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 border-0 ${
                      formItems.length === 0 
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                        : 'bg-[#0054a6] hover:bg-blue-700 text-white shadow-md'
                    }`}
                  >
                    Hoàn thành
                  </button>
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* MODAL 2: Confirm Order & Payment for Approved Proposal */}
      {selectedProposalForOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col justify-between max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-blue-50/10">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                Xác nhận đặt hàng & Thanh toán
              </h3>
              <button 
                onClick={() => setSelectedProposalForOrder(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmOrder} className="p-8 overflow-y-auto space-y-6">
              
              {/* General Order Info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Mã phiếu đề xuất</span>
                  <span className="font-extrabold text-slate-800">{selectedProposalForOrder.id}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Nhà cung cấp phân phối</span>
                  <span className="font-extrabold text-blue-650">{selectedProposalForOrder.supplierName || 'Mặc định'}</span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200/60">
                  <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Lý do thu mua</span>
                  <span className="font-bold text-slate-600">{selectedProposalForOrder.reason || 'Không có lý do ghi chú'}</span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Danh sách vật tư đặt mua</span>
                <div className="border border-slate-200 bg-white rounded-xl overflow-hidden divide-y divide-slate-100 max-h-36 overflow-y-auto">
                  {selectedProposalForOrder.items.map((item, index) => (
                    <div key={index} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50">
                      <div>
                        <span className="font-bold text-slate-800 block">{item.brand} - {item.model}</span>
                        <span className="text-[10px] font-bold text-slate-400 block">Số lượng: {item.quantity} {item.unit || 'Cái'} × {formatCurrency(item.unitPrice)}</span>
                      </div>
                      <span className="font-extrabold text-slate-800">
                        {formatCurrency(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Section */}
              <div className="p-5 bg-blue-50/30 rounded-3xl border border-blue-100 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-600">Khoản tiền phải thanh toán:</span>
                  <span className="font-black text-base text-blue-700">{formatCurrency(selectedProposalForOrder.totalCost)}</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Điền số tiền thanh toán thực tế (VND)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xs text-slate-400">₫</span>
                    <input 
                      type="number"
                      required
                      min={0}
                      max={selectedProposalForOrder.totalCost}
                      value={orderPaidAmount}
                      onChange={(e) => setOrderPaidAmount(Number(e.target.value))}
                      className="w-full pl-8 pr-4 py-3 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-extrabold text-xs text-slate-800"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 px-1 pt-1">
                    <span>Số tiền còn nợ lại:</span>
                    <span className="text-rose-600 font-black">{formatCurrency(Math.max(0, selectedProposalForOrder.totalCost - orderPaidAmount))}</span>
                  </div>
                </div>
              </div>

              {/* Order Note */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Ghi chú đơn đặt hàng</label>
                <textarea 
                  placeholder="Nhập ghi chú đặt hàng nếu có (ví dụ: Giao trước thứ 2, thanh toán chuyển khoản...)"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 min-h-[60px]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedProposalForOrder(null)}
                  className="bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 shadow-md shadow-blue-200"
                >
                  Đồng ý đặt hàng
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
