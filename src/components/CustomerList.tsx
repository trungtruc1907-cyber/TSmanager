import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  serverTimestamp,
  where,
  getDocs,
  limit
} from 'firebase/firestore';
import { Project, Customer, SalesPerson } from '../types';
import { UserPlus, Search, Phone, Mail, MapPin, Calendar, UserCheck, X } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface CustomerListProps {
  onViewProject: (customerId: string) => void;
}

export default function CustomerList({ onViewProject }: CustomerListProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesStaff, setSalesStaff] = useState<SalesPerson[]>([]);
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ 
    name: '', 
    phone: '', 
    email: '', 
    address: '',
    usageType: 'residential' as any,
    phaseType: '1phase' as any,
    assignedSalesId: ''
  });

  useEffect(() => {
    const qCust = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const unsubCust = onSnapshot(qCust, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });

    const qSales = query(collection(db, 'sales'), orderBy('name'));
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      setSalesStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesPerson)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
    });

    return () => {
      unsubCust();
      unsubSales();
    };
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) return;
    await addDoc(collection(db, 'customers'), {
      ...newCustomer,
      createdAt: serverTimestamp()
    });
    setNewCustomer({ 
      name: '', 
      phone: '', 
      email: '', 
      address: '', 
      usageType: 'residential', 
      phaseType: '1phase',
      assignedSalesId: ''
    });
    setIsAdding(false);
  };

  const getUsageLabel = (type?: string) => {
    switch(type) {
      case 'residential': return 'Điện sinh hoạt';
      case 'commercial': return 'Điện kinh doanh';
      case 'industrial': return 'Điện sản xuất';
      default: return 'Chưa xác định';
    }
  };

  const getPhaseLabel = (type?: string) => {
    return type === '3phase' ? 'Điện 3 pha' : 'Điện 1 pha';
  };

  const filtered = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Quản lý Khách hàng</h2>
          <p className="text-xs text-slate-500 font-medium">Theo dõi và quản lý data khách hàng tiềm năng.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 text-white px-5 py-2 rounded-md flex items-center gap-2 text-sm font-bold shadow-md hover:bg-blue-700 transition-all active:scale-95"
        >
          <UserPlus className="h-4 w-4" /> Thêm Khách hàng
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input 
          type="text"
          placeholder="Tìm kiếm khách hàng..."
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-md text-sm outline-none focus:border-blue-500 transition-all shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((c) => (
          <div key={c.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 bg-slate-100 text-slate-600 rounded flex items-center justify-center text-sm font-bold uppercase">
                {c.name.substring(0, 2)}
              </div>
              <div className="flex flex-col items-end">
                <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wider">
                  <Calendar className="h-3 w-3" />
                  {c.createdAt?.seconds ? format(c.createdAt.seconds * 1000, 'dd/MM/yyyy', { locale: vi }) : 'Vừa xong'}
                </div>
                <div className="mt-1 flex gap-1">
                   <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase">{getUsageLabel(c.usageType)}</span>
                   <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded font-bold uppercase">{getPhaseLabel(c.phaseType)}</span>
                </div>
              </div>
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-4 truncate">{c.name}</h3>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-slate-500">
                <Phone className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-semibold">{c.phone}</span>
              </div>
              {c.assignedSalesId && (
                <div className="flex items-center gap-3 text-blue-600">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Sale: {salesStaff.find(s => s.id === c.assignedSalesId)?.name || 'N/A'}</span>
                </div>
              )}
              {c.email && (
                <div className="flex items-center gap-3 text-slate-500">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs truncate">{c.email}</span>
                </div>
              )}
              {c.address && (
                <div className="flex items-center gap-3 text-slate-500">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-xs truncate">{c.address}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-50 flex gap-2">
              <button 
                onClick={() => onViewProject(c.id)}
                className="flex-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 py-2 rounded transition-colors uppercase tracking-wider"
              >
                Hồ sơ
              </button>
              <button className="flex-1 text-[11px] font-bold text-slate-600 hover:bg-slate-50 py-2 rounded transition-colors uppercase tracking-wider">
                Liên hệ
              </button>
            </div>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200 border border-slate-200 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Khách hàng mới</h3>
              <button onClick={() => setIsAdding(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Họ và tên *</label>
                <input 
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                  value={newCustomer.name}
                  onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số điện thoại *</label>
                  <input 
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                    value={newCustomer.phone}
                    onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email</label>
                  <input 
                    type="email"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                    value={newCustomer.email}
                    onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Địa chỉ lắp đặt</label>
                <input 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                  value={newCustomer.address}
                  onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Loại điện tiêu thụ</label>
                  <select 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                    value={newCustomer.usageType}
                    onChange={e => setNewCustomer({...newCustomer, usageType: e.target.value as any})}
                  >
                    <option value="residential">Điện sinh hoạt</option>
                    <option value="commercial">Điện kinh doanh</option>
                    <option value="industrial">Điện sản xuất</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Hệ thống điện</label>
                  <select 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                    value={newCustomer.phaseType}
                    onChange={e => setNewCustomer({...newCustomer, phaseType: e.target.value as any})}
                  >
                    <option value="1phase">Điện 1 pha</option>
                    <option value="3phase">Điện 3 pha</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Sale phụ trách</label>
                <select 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none focus:border-blue-500"
                  value={newCustomer.assignedSalesId}
                  onChange={e => setNewCustomer({...newCustomer, assignedSalesId: e.target.value})}
                >
                  <option value="">-- Chưa bàn giao --</option>
                  {salesStaff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role === 'sales_manager' ? 'Manager' : 'Rep'})</option>)}
                </select>
              </div>

              <div className="pt-6 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors uppercase tracking-widest"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-md transition-colors uppercase tracking-widest"
                >
                  Lưu dữ liệu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
