import React, { useState } from 'react';
import { 
  Users, 
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
  Coins,
  ArrowLeft,
  Building2,
  HardHat,
  ShoppingCart,
  Eye,
  FileText,
  Activity,
  Briefcase
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { Customer, UsageType, PhaseType } from '../../types';
import { InventoryTransaction } from './types';

interface WarehouseCustomersProps {
  customers: Customer[];
  transactions: InventoryTransaction[];
  userRole: string;
}

export default function WarehouseCustomers({ customers, transactions, userRole }: WarehouseCustomersProps) {
  // Tab states
  const [activeSource, setActiveSource] = useState<'construction' | 'commercial' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Tab filter in main dashboard (All, Construction, Commercial)
  const [mainTabFilter, setMainTabFilter] = useState<'all' | 'construction' | 'commercial'>('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeSource, mainTabFilter]);

  // Modals & form states
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomerForView, setSelectedCustomerForView] = useState<Customer | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCustomerType, setFormCustomerType] = useState<'construction' | 'commercial'>('construction');
  const [formUsageType, setFormUsageType] = useState<UsageType>('residential');
  const [formPhaseType, setFormPhaseType] = useState<PhaseType>('1phase');
  const [formDebt, setFormDebt] = useState(0);

  // Payment states (Collect customer debt)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentNote, setPaymentNote] = useState('Thu nợ khách hàng mua hàng thương mại');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Helper to resolve if a customer is construction or commercial
  const getCustomerType = (cust: any): 'construction' | 'commercial' => {
    if (cust.customerType) return cust.customerType;
    // Infer from usageType/status or default to construction if not specified
    if (cust.usageType || cust.status) return 'construction';
    return 'commercial';
  };

  // Filter and Search Customer List
  const filteredCustomers = customers.filter(cust => {
    const type = getCustomerType(cust);
    
    // Apply source tabs or main tab filters
    if (activeSource === 'construction' && type !== 'construction') return false;
    if (activeSource === 'commercial' && type !== 'commercial') return false;
    
    if (activeSource === null) {
      if (mainTabFilter === 'construction' && type !== 'construction') return false;
      if (mainTabFilter === 'commercial' && type !== 'commercial') return false;
    }

    const searchLower = searchTerm.toLowerCase();
    return (
      (cust.name || '').toLowerCase().includes(searchLower) ||
      (cust.phone || '').toLowerCase().includes(searchLower) ||
      (cust.email || '').toLowerCase().includes(searchLower) ||
      (cust.address || '').toLowerCase().includes(searchLower) ||
      (cust.id || '').toLowerCase().includes(searchLower)
    );
  });

  const totalItems = filteredCustomers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const indexFirst = (currentPage - 1) * pageSize;
  const indexLast = indexFirst + pageSize;
  const paginatedCustomers = filteredCustomers.slice(indexFirst, indexLast);

  // Calculate statistics
  const stats = React.useMemo(() => {
    let totalConstruction = 0;
    let totalCommercial = 0;
    let totalCommercialDebt = 0;

    customers.forEach(cust => {
      const type = getCustomerType(cust);
      if (type === 'construction') {
        totalConstruction++;
      } else {
        totalCommercial++;
        totalCommercialDebt += (cust as any).debt || 0;
      }
    });

    return {
      totalConstruction,
      totalCommercial,
      totalCommercialDebt
    };
  }, [customers]);

  // Open modals handlers
  const openAddModal = (type?: 'construction' | 'commercial') => {
    setEditingCustomer(null);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormCustomerType(type || 'commercial');
    setFormUsageType('residential');
    setFormPhaseType('1phase');
    setFormDebt(0);
    setShowAddEditModal(true);
  };

  const openEditModal = (cust: Customer) => {
    const type = getCustomerType(cust);
    setEditingCustomer(cust);
    setFormName(cust.name);
    setFormPhone(cust.phone);
    setFormEmail(cust.email || '');
    setFormAddress(cust.address || '');
    setFormCustomerType(type);
    setFormUsageType(cust.usageType || 'residential');
    setFormPhaseType(cust.phaseType || '1phase');
    setFormDebt((cust as any).debt || 0);
    setShowAddEditModal(true);
  };

  const openPaymentModal = (cust: Customer) => {
    setPaymentCustomer(cust);
    setPaymentAmount((cust as any).debt || 0);
    setPaymentNote(`Thu nợ mua hàng thương mại từ ${cust.name}`);
    setShowPaymentModal(true);
  };

  // Save Customer to Firestore
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      alert('Vui lòng điền đầy đủ Họ tên khách hàng và Số điện thoại.');
      return;
    }

    try {
      const isEdit = !!editingCustomer;
      const custId = isEdit ? editingCustomer.id : 'CUST' + Math.floor(1000 + Math.random() * 9000);

      const payload: any = {
        id: custId,
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim() || null,
        address: formAddress.trim() || null,
        customerType: formCustomerType,
        createdAt: isEdit ? (editingCustomer.createdAt || new Date().toISOString()) : new Date().toISOString()
      };

      if (formCustomerType === 'construction') {
        payload.usageType = formUsageType;
        payload.phaseType = formPhaseType;
        payload.status = isEdit ? (editingCustomer.status || 'new') : 'new';
      } else {
        payload.debt = Number(formDebt) || 0;
      }

      await setDoc(doc(db, 'customers', custId), payload, { merge: true });
      setShowAddEditModal(false);
      alert(`${isEdit ? 'Cập nhật' : 'Thêm mới'} khách hàng thành công!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'customers');
    }
  };

  // Delete Customer
  const handleDeleteCustomer = async (custId: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa khách hàng "${name}"? Thao tác này không thể hoàn tác.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'customers', custId));
      alert('Đã xóa khách hàng thành công khỏi hệ thống.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `customers/${custId}`);
    }
  };

  // Record Debt Payment from Customer
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentCustomer) return;
    if (paymentAmount <= 0) {
      alert('Số tiền thu nợ phải lớn hơn 0.');
      return;
    }

    try {
      await updateDoc(doc(db, 'customers', paymentCustomer.id), {
        debt: increment(-paymentAmount)
      });
      setShowPaymentModal(false);
      alert(`Đã thu nợ thành công ${formatCurrency(paymentAmount)} từ khách hàng ${paymentCustomer.name}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `customers/${paymentCustomer.id}`);
    }
  };

  // Filter transactions related to a customer
  const getCustomerTransactions = (cust: Customer) => {
    return transactions.filter(tx => 
      tx.partnerId === cust.id || 
      (tx.partnerName && tx.partnerName.toLowerCase() === cust.name.toLowerCase())
    );
  };

  return (
    <div id="warehouse-customers-container" className="space-y-6 font-sans">
      
      {/* 1. Header with custom breadcrumb or main title */}
      {activeSource === null ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <Users className="h-6 w-6 text-[#0054a6]" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-800 uppercase tracking-wider">Danh Sách Khách Hàng</h1>
              <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                Quản lý khách hàng thi công lắp đặt và bán thiết bị thương mại lẻ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => openAddModal('commercial')}
              className="bg-[#0054a6] hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-all active:scale-95 border-0 outline-none"
            >
              <Plus className="h-4 w-4" /> Thêm khách hàng thương mại
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-xs">
          <button
            onClick={() => {
              setActiveSource(null);
              setSearchTerm('');
            }}
            className="flex items-center gap-2 text-slate-500 hover:text-[#0054a6] text-xs font-black uppercase tracking-wider bg-transparent border-0 outline-none cursor-pointer transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Quay lại danh mục chính
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold">Nguồn hiện tại:</span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
              activeSource === 'construction' ? 'bg-blue-50 text-[#0054a6]' : 'bg-emerald-50 text-emerald-600'
            }`}>
              {activeSource === 'construction' ? '🏡 Khách hàng thi công' : '🛍️ Khách hàng thương mại'}
            </span>
          </div>
        </div>
      )}

      {/* 2. Selection Cards (When no sub-source is active) - Designed exactly like Import Goods sources selection */}
      {activeSource === null && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Loại hình khách hàng</h3>
            <span className="text-[11px] text-slate-400 font-bold">Chọn nhóm khách hàng để theo dõi chi tiết hoặc lọc nhanh</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Card 1: Khách hàng thi công */}
            <div 
              onClick={() => {
                setActiveSource('construction');
                setSearchTerm('');
              }}
              className="p-6 rounded-3xl border-2 transition-all cursor-pointer flex items-center gap-5 border-slate-100 bg-white hover:border-[#0054a6] hover:bg-slate-50/50 hover:shadow-md group"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all bg-blue-50 text-[#0054a6] group-hover:scale-105">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-sm tracking-wide flex items-center gap-1.5">
                  Khách hàng thi công
                  <span className="bg-blue-100 text-[#0054a6] text-[10px] font-black px-2 py-0.5 rounded-full">
                    {stats.totalConstruction}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                  Khách hàng lắp điện mặt trời áp mái, theo dõi vật tư cấp phát dự án lắp đặt.
                </p>
              </div>
            </div>

            {/* Card 2: Khách hàng thương mại */}
            <div 
              onClick={() => {
                setActiveSource('commercial');
                setSearchTerm('');
              }}
              className="p-6 rounded-3xl border-2 transition-all cursor-pointer flex items-center gap-5 border-slate-100 bg-white hover:border-emerald-500 hover:bg-slate-50/50 hover:shadow-md group"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all bg-emerald-50 text-emerald-600 group-hover:scale-105">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-sm tracking-wide flex items-center gap-1.5">
                  Khách hàng thương mại
                  <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                    {stats.totalCommercial}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                  Khách hàng mua bán buôn/bán lẻ thiết bị solar, quản lý thu nợ & doanh thu bán.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 3. Filter Stats Row (When inside sub-source) */}
      {activeSource === 'construction' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-[#0054a6] rounded-2xl">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tổng số khách hàng thi công</span>
              <span className="text-xl font-black text-slate-800">{stats.totalConstruction} đối tác</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Phiếu bàn giao thi công (PX-TC)</span>
              <span className="text-xl font-black text-slate-800">
                {transactions.filter(tx => tx.id.startsWith('PX-TC')).length} phiếu
              </span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tổng giá trị bàn giao</span>
              <span className="text-xl font-black text-slate-800">
                {formatCurrency(transactions.filter(tx => tx.id.startsWith('PX-TC')).reduce((s, t) => s + (t.totalValue || 0), 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeSource === 'commercial' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in duration-200">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tổng số khách hàng thương mại</span>
              <span className="text-xl font-black text-slate-800">{stats.totalCommercial} đối tác</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-500 rounded-2xl">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tổng công nợ khách hàng nợ</span>
              <span className="text-xl font-black text-red-600">{formatCurrency(stats.totalCommercialDebt)}</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Tổng doanh thu bán lẻ (PX-TM)</span>
              <span className="text-xl font-black text-slate-800">
                {formatCurrency(transactions.filter(tx => tx.id.startsWith('PX-TM')).reduce((s, t) => s + (t.totalValue || 0), 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Controls: Search, Lọc, Thêm nhanh */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input 
            type="text"
            placeholder={
              activeSource === 'construction' ? 'Tìm khách hàng thi công...' :
              activeSource === 'commercial' ? 'Tìm khách hàng thương mại...' :
              'Tìm kiếm theo tên, SĐT, địa chỉ...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0054a6] text-slate-700 placeholder-slate-400"
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

        {/* Tab Filters (Visible only in root dashboard) */}
        {activeSource === null ? (
          <div className="flex bg-slate-100/80 p-1 rounded-xl gap-1">
            <button
              onClick={() => setMainTabFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer border-0 transition-all ${
                mainTabFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              Tất cả ({customers.length})
            </button>
            <button
              onClick={() => setMainTabFilter('construction')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer border-0 transition-all ${
                mainTabFilter === 'construction' ? 'bg-[#0054a6] text-white shadow-xs' : 'text-slate-500 hover:text-[#0054a6] bg-transparent'
              }`}
            >
              Thi công ({stats.totalConstruction})
            </button>
            <button
              onClick={() => setMainTabFilter('commercial')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer border-0 transition-all ${
                mainTabFilter === 'commercial' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-emerald-600 bg-transparent'
              }`}
            >
              Thương mại ({stats.totalCommercial})
            </button>
          </div>
        ) : activeSource === 'commercial' ? (
          <button
            onClick={() => openAddModal('commercial')}
            className="font-black text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-all active:scale-95 border-0 outline-none bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> Thêm KH thương mại
          </button>
        ) : null}
      </div>

      {/* 5. Main Datatable of customers */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã Khách Hàng</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Họ & Tên</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Phân Loại Kho</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Số Điện Thoại</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Email / Địa Chỉ</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Công Nợ Thương Mại</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold italic">
                    Không tìm thấy khách hàng nào phù hợp...
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map(cust => {
                  const type = getCustomerType(cust);
                  const custTx = getCustomerTransactions(cust);
                  const debt = (cust as any).debt || 0;

                  return (
                    <tr key={cust.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-black text-slate-400">#{cust.id}</td>
                      <td className="px-6 py-4 font-extrabold text-slate-800">{cust.name}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          type === 'construction' ? 'bg-blue-50 text-[#0054a6] border border-blue-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                        }`}>
                          {type === 'construction' ? 'Thi công (Dự án)' : 'Thương mại (Bán sỉ lẻ)'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-1.5 pt-5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {cust.phone}
                      </td>
                      <td className="px-6 py-4 max-w-xs space-y-0.5">
                        {cust.email && (
                          <div className="text-slate-400 font-semibold truncate flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {cust.email}
                          </div>
                        )}
                        {cust.address ? (
                          <div className="text-slate-600 font-semibold truncate flex items-center gap-1" title={cust.address}>
                            <MapPin className="h-3 w-3 text-red-400 shrink-0" /> {cust.address}
                          </div>
                        ) : (
                          <div className="text-slate-300 italic">Không có địa chỉ</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-mono">
                        {type === 'commercial' ? (
                          <span className={`inline-block px-2.5 py-1 rounded-full font-black text-[10px] ${
                            debt > 0 ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-slate-50 text-slate-400'
                          }`}>
                            {formatCurrency(debt)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md italic">Lắp áp mái</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          
                          {/* View details / Transaction history */}
                          <button
                            onClick={() => setSelectedCustomerForView(cust)}
                            title="Lịch sử giao dịch & Vật tư"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all cursor-pointer bg-transparent border-0 outline-none flex items-center justify-center"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Edit Customer info */}
                          <button
                            onClick={() => openEditModal(cust)}
                            title="Sửa thông tin"
                            className="p-1.5 text-slate-500 hover:text-[#0054a6] hover:bg-slate-100 rounded-lg transition-all cursor-pointer bg-transparent border-0 outline-none flex items-center justify-center"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>

                          {/* Record Payment for Commercial Debt */}
                          {type === 'commercial' && debt > 0 && (
                            <button
                              onClick={() => openPaymentModal(cust)}
                              title="Thu nợ"
                              className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                            >
                              <Coins className="h-3.5 w-3.5 text-emerald-600" />
                              Thu nợ
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                            title="Xóa khách hàng"
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer bg-transparent border-0 outline-none flex items-center justify-center"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div id="customers-pagination-row" className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
          <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
            <span>Hiển thị</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-1.5 py-0.5 rounded border border-slate-200 bg-white text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value={5}>5 dòng</option>
              <option value={10}>10 dòng</option>
              <option value={20}>20 dòng</option>
              <option value={50}>50 dòng</option>
            </select>
            <span>
              | dòng <span className="font-bold text-slate-800">{totalItems > 0 ? indexFirst + 1 : 0}</span> - <span className="font-bold text-slate-800">{Math.min(indexLast, totalItems)}</span> của <span className="font-bold text-slate-800">{totalItems}</span> khách hàng
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
                        ? 'bg-[#0054a6] text-white shadow-xs scale-105' 
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

      {/* 6. Add / Edit Customer Modal */}
      {showAddEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-up">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#0054a6]" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  {editingCustomer ? 'Cập Nhật Khách Hàng' : 'Thêm Khách Hàng Mới'}
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
            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              
              {/* Customer Type Switch */}
              {editingCustomer && (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                    Loại hình khách hàng *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center justify-center gap-2 p-3 border-2 rounded-2xl cursor-pointer transition-all ${
                      formCustomerType === 'construction' 
                        ? 'border-[#0054a6] bg-blue-50/50 text-[#0054a6] font-black' 
                        : 'border-slate-100 bg-slate-50 text-slate-500 font-bold'
                    }`}>
                      <input 
                        type="radio" 
                        name="formCustomerType" 
                        value="construction"
                        checked={formCustomerType === 'construction'}
                        onChange={() => setFormCustomerType('construction')}
                        className="hidden"
                      />
                      <Building2 className="h-4 w-4" />
                      <span>Thi công dự án</span>
                    </label>
                    
                    <label className={`flex items-center justify-center gap-2 p-3 border-2 rounded-2xl cursor-pointer transition-all ${
                      formCustomerType === 'commercial' 
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-600 font-black' 
                        : 'border-slate-100 bg-slate-50 text-slate-500 font-bold'
                    }`}>
                      <input 
                        type="radio" 
                        name="formCustomerType" 
                        value="commercial"
                        checked={formCustomerType === 'commercial'}
                        onChange={() => setFormCustomerType('commercial')}
                        className="hidden"
                      />
                      <ShoppingCart className="h-4 w-4" />
                      <span>Thương mại lẻ</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Họ và tên khách hàng / Đại diện *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Ví dụ: Anh Nguyễn Văn Hoàng, Solar Tây Nguyên"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0054a6] text-slate-700"
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
                    className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0054a6] text-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Email
                  </label>
                  <input 
                    type="email"
                    placeholder="email@solar.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0054a6] text-slate-700"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Địa chỉ lắp đặt / Giao hàng
                </label>
                <input 
                  type="text"
                  placeholder="Số nhà, Tên đường, Tỉnh thành..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#0054a6] text-slate-700"
                />
              </div>

              {/* Conditional parameters based on customerType */}
              {formCustomerType === 'construction' ? (
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                      Mô hình sử dụng
                    </label>
                    <select
                      value={formUsageType}
                      onChange={(e) => setFormUsageType(e.target.value as UsageType)}
                      className="w-full px-2 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none text-slate-700"
                    >
                      <option value="residential">🏡 Hộ gia đình</option>
                      <option value="commercial">🏢 Doanh nghiệp</option>
                      <option value="industrial">🏭 Nhà máy công nghiệp</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">
                      Nguồn điện hòa lưới
                    </label>
                    <select
                      value={formPhaseType}
                      onChange={(e) => setFormPhaseType(e.target.value as PhaseType)}
                      className="w-full px-2 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none text-slate-700"
                    >
                      <option value="1phase">🔌 1 Pha (220V)</option>
                      <option value="3phase">⚡ 3 Pha (380V)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Công nợ mua hàng ban đầu (nếu có)
                  </label>
                  <input 
                    type="number"
                    min={0}
                    step={1000}
                    placeholder="Ví dụ: 5000000"
                    value={formDebt}
                    onChange={(e) => setFormDebt(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                  />
                </div>
              )}

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
                  className={`px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-0 outline-none ${
                    formCustomerType === 'construction' ? 'bg-[#0054a6] hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  Lưu thông tin
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 7. Detailed Customer View & Transaction History Modal */}
      {selectedCustomerForView && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-scale-up">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#0054a6]" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Chi Tiết Giao Dịch & Vật Tư: {selectedCustomerForView.name}
                </h3>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedCustomerForView(null)}
                className="text-slate-400 hover:text-slate-600 transition-all cursor-pointer bg-transparent border-0 outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              
              {/* Profile Card Summary */}
              <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Thông tin cơ bản</span>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-slate-400" /> {selectedCustomerForView.name}
                    </div>
                    <div className="font-bold flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-emerald-500" /> {selectedCustomerForView.phone}
                    </div>
                    {selectedCustomerForView.email && (
                      <div className="font-medium text-slate-500 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-blue-400" /> {selectedCustomerForView.email}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Thông tin nghiệp vụ</span>
                  <div className="space-y-1.5 text-xs text-slate-700">
                    <div>
                      <span className="font-semibold text-slate-400 block">Kiểu khách hàng:</span>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-0.5 ${
                        getCustomerType(selectedCustomerForView) === 'construction' ? 'bg-blue-50 text-[#0054a6]' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        {getCustomerType(selectedCustomerForView) === 'construction' ? 'Thi công dự án áp mái' : 'Bán lẻ / thương mại'}
                      </span>
                    </div>

                    {getCustomerType(selectedCustomerForView) === 'construction' ? (
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
                        <div>
                          <span className="text-slate-400 block font-normal">Mô hình:</span>
                          {selectedCustomerForView.usageType === 'residential' ? '🏡 Hộ gia đình' : 
                           selectedCustomerForView.usageType === 'commercial' ? '🏢 Doanh nghiệp' : '🏭 Nhà máy'}
                        </div>
                        <div>
                          <span className="text-slate-400 block font-normal">Đấu nối:</span>
                          {selectedCustomerForView.phaseType === '1phase' ? '🔌 1 Pha (220V)' : '⚡ 3 Pha (380V)'}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span className="font-semibold text-slate-400 block">Công nợ hiện nợ:</span>
                        <span className="text-rose-600 font-extrabold font-mono block text-sm mt-0.5">
                          {formatCurrency((selectedCustomerForView as any).debt || 0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Transactions History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lịch sử xuất hàng / mua bán</h4>
                  <span className="text-[10px] text-slate-400 font-bold">
                    Tổng cộng: {getCustomerTransactions(selectedCustomerForView).length} phiếu xuất
                  </span>
                </div>

                <div className="space-y-3">
                  {getCustomerTransactions(selectedCustomerForView).length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-bold bg-slate-50/50 border border-slate-100 rounded-3xl italic">
                      Không tìm thấy phiếu xuất kho / hóa đơn bán lẻ nào liên kết với khách hàng này.
                    </div>
                  ) : (
                    getCustomerTransactions(selectedCustomerForView).map(tx => (
                      <div key={tx.id} className="p-4 rounded-2xl border border-slate-100 space-y-3 bg-white hover:bg-slate-50/50 transition-colors">
                        
                        {/* Transaction Metadata Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-500">#{tx.id}</span>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                              tx.id.startsWith('PX-TC') ? 'bg-blue-50 text-[#0054a6]' : 'bg-emerald-50 text-emerald-600'
                            }`}>
                              {tx.id.startsWith('PX-TC') ? 'Xuất thi công' : 'Xuất bán thương mại'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-400 font-semibold">
                            <Calendar className="h-3.5 w-3.5" />
                            {tx.date}
                          </div>
                        </div>

                        {/* List items issued */}
                        <div className="space-y-2">
                          {tx.items.map((item, index) => (
                            <div key={index} className="flex justify-between items-center text-xs">
                              <div className="space-y-0.5">
                                <span className="font-extrabold text-slate-700 block">
                                  {item.brand} {item.model}
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">Mã thiết bị: {item.equipmentId}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-extrabold text-slate-800 block">x{item.quantity} {item.unit}</span>
                                {tx.id.startsWith('PX-TM') && (
                                  <span className="text-[10px] text-slate-400 block">Đơn giá: {formatCurrency(item.unitPrice)}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Totals bar */}
                        <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 text-xs font-bold bg-slate-50/30 px-2 py-1.5 rounded-xl">
                          <span className="text-slate-400 uppercase text-[9px] tracking-wider font-black">Giá trị phiếu:</span>
                          <span className="text-slate-900 font-black">{formatCurrency(tx.totalValue)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <button
                type="button"
                onClick={() => setSelectedCustomerForView(null)}
                className="px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer bg-transparent border-0 outline-none"
              >
                Đóng thông tin
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 8. Collect Customer Debt Payment Modal */}
      {showPaymentModal && paymentCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-up">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-emerald-600" />
                <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  Thu Hồi Công Nợ Khách Hàng
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
                  Họ tên khách hàng
                </label>
                <div className="text-sm font-black text-slate-800 bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center gap-2">
                  <User className="h-4.5 w-4.5 text-slate-400" />
                  {paymentCustomer.name}
                </div>
              </div>

              {/* Debt and Amount fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Số tiền đang nợ
                  </label>
                  <div className="text-xs font-bold text-rose-600 bg-rose-50/50 border border-rose-100/50 px-3.5 py-2.5 rounded-xl">
                    {formatCurrency((paymentCustomer as any).debt || 0)}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                    Số tiền thu thực tế *
                  </label>
                  <input 
                    type="number"
                    required
                    min={1000}
                    step={1000}
                    max={(paymentCustomer as any).debt || 0}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                  />
                </div>
              </div>

              {/* Payment content */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                  Ghi chú thu tiền nợ
                </label>
                <textarea 
                  rows={2}
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700 resize-none"
                />
              </div>

              {/* Warning/Guideline info */}
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-2.5">
                <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-emerald-700 leading-relaxed font-semibold">
                  Hệ thống sẽ ghi giảm số nợ hiện có của khách hàng mua lẻ này trực tiếp trên cơ sở dữ liệu.
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
                  className="px-5 py-2.5 text-[10px] font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-0 outline-none"
                >
                  Xác nhận thu nợ
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
