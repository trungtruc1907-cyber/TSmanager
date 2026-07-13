import React, { useState } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  X, 
  Check, 
  AlertTriangle, 
  Trash2, 
  Edit3, 
  Mail, 
  Phone, 
  MapPin, 
  User, 
  DollarSign,
  Calendar,
  CreditCard,
  Coins
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { WarehouseSupplier } from './types';

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
  return '';
};

interface WarehouseSuppliersProps {
  suppliers: WarehouseSupplier[];
  userRole: string;
}

export default function WarehouseSuppliers({ suppliers, userRole }: WarehouseSuppliersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<WarehouseSupplier | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Form states
  const [formName, setFormName] = useState('');
  const [formContactName, setFormContactName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formDebt, setFormDebt] = useState(0);

  // Search filter
  const filteredSuppliers = suppliers.filter(sup => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (sup.name || '').toLowerCase().includes(searchLower) ||
      (sup.contactName || '').toLowerCase().includes(searchLower) ||
      (sup.phone || '').toLowerCase().includes(searchLower) ||
      (sup.email || '').toLowerCase().includes(searchLower) ||
      (sup.address || '').toLowerCase().includes(searchLower) ||
      (sup.id || '').toLowerCase().includes(searchLower)
    );
  });

  const totalItems = filteredSuppliers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const indexFirst = (currentPage - 1) * pageSize;
  const indexLast = indexFirst + pageSize;
  const paginatedSuppliers = filteredSuppliers.slice(indexFirst, indexLast);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const openAddModal = () => {
    setEditingSupplier(null);
    setFormName('');
    setFormContactName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormDebt(0);
    setShowAddEditModal(true);
  };

  const openEditModal = (sup: WarehouseSupplier) => {
    setEditingSupplier(sup);
    setFormName(sup.name);
    setFormContactName(sup.contactName || '');
    setFormPhone(sup.phone);
    setFormEmail(sup.email || '');
    setFormAddress(sup.address || '');
    setFormDebt(sup.debt || 0);
    setShowAddEditModal(true);
  };

  // Payment states & handlers
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentSupplier, setPaymentSupplier] = useState<WarehouseSupplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNote, setPaymentNote] = useState('Thanh toán công nợ nhà cung cấp');

  const openPaymentModal = (sup: WarehouseSupplier) => {
    setPaymentSupplier(sup);
    setPaymentAmount(sup.debt || 0);
    setPaymentNote(`Thanh toán công nợ cho ${sup.name}`);
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentSupplier) return;
    if (paymentAmount <= 0) {
      alert('Số tiền thanh toán phải lớn hơn 0.');
      return;
    }
    if (paymentAmount > (paymentSupplier.debt || 0)) {
      if (!confirm('Số tiền thanh toán lớn hơn số tiền nợ hiện tại. Bạn có chắc chắn muốn tiếp tục?')) {
        return;
      }
    }

    try {
      await updateDoc(doc(db, 'suppliers', paymentSupplier.id), {
        debt: increment(-paymentAmount)
      });
      setShowPaymentModal(false);
      alert(`Đã thanh toán thành công ${formatCurrency(paymentAmount)} cho nhà cung cấp ${paymentSupplier.name}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'suppliers');
    }
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      alert('Vui lòng điền đầy đủ Tên nhà cung cấp và Số điện thoại.');
      return;
    }

    try {
      const isEdit = !!editingSupplier;
      const supId = isEdit ? editingSupplier.id : 'SUP' + Math.floor(100 + Math.random() * 900);

      const payload: any = {
        id: supId,
        name: formName.trim(),
        contactName: formContactName.trim() || null,
        phone: formPhone.trim(),
        email: formEmail.trim() || null,
        address: formAddress.trim() || null,
        debt: Number(formDebt) || 0,
        createdAt: isEdit ? (editingSupplier.createdAt || new Date()) : new Date()
      };

      await setDoc(doc(db, 'suppliers', supId), payload);
      setShowAddEditModal(false);
      alert(`${isEdit ? 'Cập nhật' : 'Thêm mới'} nhà cung cấp thành công!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'suppliers');
    }
  };

  const handleDeleteSupplier = async (supId: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa nhà cung cấp "${name}"? Thao tác này không thể hoàn tác.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'suppliers', supId));
      alert('Đã xóa nhà cung cấp thành công.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'suppliers');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search and control bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 rounded-2xl">
            <Building2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Danh Sách Nhà Cung Cấp</h2>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
              Quản lý danh sách đối tác cung ứng vật tư & công nợ
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm nhà cung cấp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700 placeholder-slate-400"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-0 outline-none"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={openAddModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" /> Thêm nhà cung cấp
          </button>
        </div>
      </div>

      {/* Main suppliers table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã NCC</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên Nhà Cung Cấp</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Người Liên Hệ</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Thông Tin Liên Lạc</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Địa Chỉ</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Công Nợ Hiện Tại</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedSuppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold italic">
                    Không tìm thấy nhà cung cấp nào phù hợp...
                  </td>
                </tr>
              ) : (
                paginatedSuppliers.map(sup => (
                  <tr key={sup.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono font-black text-slate-400">#{sup.id}</td>
                    <td className="px-6 py-4 font-extrabold text-slate-800">{sup.name}</td>
                    <td className="px-6 py-4 text-slate-600 font-semibold">
                      {sup.contactName ? (
                        <span className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-slate-400" />
                          {sup.contactName}
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">Chưa cập nhật</span>
                      )}
                    </td>
                    <td className="px-6 py-4 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-slate-700">
                        <Phone className="h-3 w-3 text-emerald-500" />
                        {sup.phone}
                      </div>
                      {sup.email && (
                        <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                          <Mail className="h-3 w-3 text-blue-400" />
                          {sup.email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-semibold max-w-xs truncate" title={sup.address || ''}>
                      {sup.address ? (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-red-400 shrink-0" />
                          {sup.address}
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">Chưa cập nhật</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-mono">
                      <span className={`inline-block px-2.5 py-1 rounded-full font-black text-[10px] ${
                        (sup.debt || 0) > 0 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-slate-50 text-slate-500'
                      }`}>
                        {formatCurrency(sup.debt || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(sup)}
                          title="Sửa thông tin"
                          className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all cursor-pointer bg-transparent border-0 outline-none flex items-center justify-center"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        {(sup.debt || 0) > 0 ? (
                          <button
                            onClick={() => openPaymentModal(sup)}
                            title="Thanh toán công nợ"
                            className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                          >
                            <Coins className="h-3.5 w-3.5 text-amber-600" />
                            Thanh toán
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">Đã Sạch Nợ</span>
                        )}

                        <button
                          onClick={() => handleDeleteSupplier(sup.id, sup.name)}
                          title="Xóa đối tác"
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer bg-transparent border-0 outline-none flex items-center justify-center"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div id="suppliers-pagination-row" className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
            <span>Hiển thị</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value={5}>5 dòng</option>
              <option value={10}>10 dòng</option>
              <option value={20}>20 dòng</option>
              <option value={50}>50 dòng</option>
            </select>
            <span>
              | dòng <span className="font-bold text-slate-800">{totalItems > 0 ? indexFirst + 1 : 0}</span> - <span className="font-bold text-slate-800">{Math.min(indexLast, totalItems)}</span> của <span className="font-bold text-slate-800">{totalItems}</span> nhà cung cấp
            </span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-100 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                Trước
              </button>
              
              {Array.from({ length: totalPages }).map((_, idx) => {
                const p = idx + 1;
                // Smart pagination (show first, last, and current +/- 1 or 2)
                if (
                  totalPages > 7 &&
                  p !== 1 &&
                  p !== totalPages &&
                  Math.abs(p - currentPage) > 1
                ) {
                  if (p === 2 && currentPage > 3) {
                    return <span key={p} className="text-slate-400 px-1 text-xs font-bold">...</span>;
                  }
                  if (p === totalPages - 1 && currentPage < totalPages - 2) {
                    return <span key={p} className="text-slate-400 px-1 text-xs font-bold">...</span>;
                  }
                  return null;
                }

                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                      p === currentPage 
                        ? 'bg-emerald-600 text-white shadow-xs scale-105' 
                        : 'border border-slate-100 text-slate-600 hover:bg-slate-50/80'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-100 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                Sau
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Supplier Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-up">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  {editingSupplier ? 'Cập Nhật Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp Mới'}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-all cursor-pointer bg-transparent border-0 outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              
              {/* Supplier Name */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Tên nhà cung cấp *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Ví dụ: Công ty TNHH Thiết bị Solar Việt Nam"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                />
              </div>

              {/* Contact Person Name */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Người liên hệ đại diện
                </label>
                <input 
                  type="text"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={formContactName}
                  onChange={(e) => setFormContactName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Số điện thoại *
                  </label>
                  <input 
                    type="tel"
                    required
                    placeholder="09xx xxx xxx"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input 
                    type="email"
                    placeholder="partner@gmail.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Địa chỉ văn phòng / kho
                </label>
                <input 
                  type="text"
                  placeholder="Số nhà, Tên đường, Quận/Huyện, Tỉnh..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                />
              </div>

              {/* Current Debt */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Công nợ hiện tại (VNĐ)
                </label>
                <input 
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="0"
                  value={formDebt}
                  onChange={(e) => setFormDebt(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer bg-transparent border-0 outline-none"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-0 outline-none"
                >
                  Lưu thông tin
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Payment Modal: Thanh toán công nợ */}
      {showPaymentModal && paymentSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-up">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Thanh Toán Công Nợ Đối Tác
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-all cursor-pointer bg-transparent border-0 outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleProcessPayment} className="p-6 space-y-4">
              
              {/* Partner name */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Nhà cung cấp
                </label>
                <div className="text-sm font-black text-slate-800 bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-2">
                  <Building2 className="h-4.5 w-4.5 text-slate-400" />
                  {paymentSupplier.name}
                </div>
              </div>

              {/* Debt and Amount fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Công nợ hiện tại
                  </label>
                  <div className="text-xs font-bold text-amber-600 bg-amber-50/50 border border-amber-100/50 px-3.5 py-2.5 rounded-xl">
                    {formatCurrency(paymentSupplier.debt || 0)}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Số tiền thanh toán (VNĐ) *
                  </label>
                  <input 
                    type="number"
                    required
                    min={1000}
                    step={1000}
                    max={paymentSupplier.debt || 0}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 text-slate-700"
                  />
                </div>
              </div>

              {/* Payment content */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Nội dung thanh toán
                </label>
                <textarea 
                  rows={2}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 text-slate-700 resize-none"
                />
              </div>

              {/* Warning/Guideline info */}
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-2.5">
                <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-700 leading-relaxed font-semibold">
                  Ghi nhận thanh toán sẽ trừ trực tiếp vào số dư công nợ của nhà cung cấp này trong cơ sở dữ liệu.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer bg-transparent border-0 outline-none"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-0 outline-none"
                >
                  Xác nhận thanh toán
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
