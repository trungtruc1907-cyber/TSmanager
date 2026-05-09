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
import { motion, AnimatePresence } from 'motion/react';

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
    <div className="space-y-8 pb-10">
      {/* Module Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-2">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight uppercase leading-none">Data Khách Hàng</h2>
          <div className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mt-3 flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
             Quản lý tệp khách hàng tiềm năng
          </div>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="w-full md:w-auto bg-slate-900 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-blue-600 transition-all active:scale-95"
        >
          <UserPlus className="h-4 w-4" /> Thêm khách hàng mới
        </button>
      </div>

      {/* Global Search Bar */}
      <div className="relative group max-w-2xl mx-auto md:mx-0">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
        <input 
          type="text"
          placeholder="Tìm tên, số điện thoại hoặc khu vực..."
          className="w-full pl-14 pr-6 py-4.5 bg-white border border-slate-200 rounded-[1.5rem] text-sm font-medium outline-none focus:border-blue-500 transition-all shadow-[0_4px_20px_rgb(0,0,0,0.03)] focus:shadow-[0_10px_30px_rgb(0,0,0,0.06)]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Responsive Customer Grid/Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((c) => (
          <motion.div 
            whileHover={{ y: -5 }}
            key={c.id} 
            className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.06)] transition-all flex flex-col h-full"
          >
            <div className="flex items-start justify-between mb-6">
              <div className="h-12 w-12 bg-blue-50/50 text-blue-600 rounded-2xl flex items-center justify-center text-base font-black border border-blue-100 shadow-sm">
                {c.name.substring(0, 1)}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="text-[9px] font-black text-slate-400 flex items-center gap-1.5 uppercase tracking-widest bg-slate-50 px-2.5 py-1 rounded-full">
                  <Calendar className="h-3 w-3" />
                  {c.createdAt?.seconds ? format(c.createdAt.seconds * 1000, 'dd MMM yyyy', { locale: vi }) : 'Vừa xong'}
                </div>
                <div className="flex gap-1.5">
                   <span className="text-[8px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-black uppercase border border-indigo-100/50">{getUsageLabel(c.usageType).split(' ')[1]}</span>
                   <span className="text-[8px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-black uppercase border border-amber-100/50">{getPhaseLabel(c.phaseType).split(' ')[1]}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 flex-1">
              <h3 className="text-lg font-black text-slate-900 truncate tracking-tight uppercase leading-none">{c.name}</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3.5 group/link">
                  <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                    <Phone className="h-3.5 w-3.5 text-slate-400 group-hover/link:text-blue-600 transition-colors" />
                  </div>
                  <span className="text-[13px] font-black text-slate-700">{c.phone}</span>
                </div>
                
                {c.assignedSalesId && (
                  <div className="flex items-center gap-3.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50/50 flex items-center justify-center border border-blue-100/50">
                      <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <span className="text-[9px] font-black text-blue-800 uppercase tracking-widest">Sale: {salesStaff.find(s => s.id === c.assignedSalesId)?.name || 'N/A'}</span>
                  </div>
                )}

                <div className="flex items-center gap-3.5">
                   <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                     <MapPin className="h-3.5 w-3.5 text-slate-400" />
                   </div>
                  <span className="text-[11px] text-slate-500 font-bold leading-tight truncate">{c.address || 'Chưa định vị lắp đặt'}</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-50 flex gap-3">
              <button 
                onClick={() => onViewProject(c.id)}
                className="flex-[2] bg-slate-900 text-white text-[10px] font-black py-4 rounded-2xl transition-all uppercase tracking-widest shadow-lg shadow-slate-200 flex items-center justify-center gap-2 hover:bg-blue-600 active:scale-95"
              >
                HỒ SƠ DỰ ÁN
              </button>
              <button 
                className="flex-1 bg-slate-50 text-slate-600 hover:bg-slate-100 text-[10px] font-black py-4 rounded-2xl transition-all uppercase tracking-widest border border-slate-100 flex items-center justify-center"
                onClick={() => window.location.href = `tel:${c.phone}`}
              >
                GỌI
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
         <div className="text-center py-20 px-6 bg-white rounded-[3rem] border border-dashed border-slate-200">
            <Search className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Không tìm thấy khách hàng phù hợp</p>
         </div>
      )}

      {/* Modern Slide-up Sheet for Adding Customer */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-xl bg-white rounded-t-[2.5rem] md:rounded-[3rem] p-8 md:p-12 shadow-[0_-20px_60px_rgba(0,0,0,0.15)] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-10">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Thiết lập KH mới</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Hệ thống đồng bộ Firestore</p>
                </div>
                <button onClick={() => setIsAdding(false)} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-full transition-colors border border-slate-100">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleAdd} className="space-y-6">
                <div className="space-y-1.5 group">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2 group-focus-within:text-blue-600 transition-colors">Tên chủ hộ / Công ty *</label>
                  <input 
                    required
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold placeholder:text-slate-300 outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner"
                    value={newCustomer.name}
                    onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5 focus-within:scale-[1.02] transition-transform">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Số điện thoại *</label>
                    <input 
                      required
                      placeholder="09xx xxx xxx"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner"
                      value={newCustomer.phone}
                      onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Email cá nhân</label>
                    <input 
                      type="email"
                      placeholder="example@gmail.com"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner"
                      value={newCustomer.email}
                      onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Vị trí lắp đặt</label>
                  <div className="relative">
                    <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    <input 
                      placeholder="Địa chỉ cụ thể của khách hàng"
                      className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner"
                      value={newCustomer.address}
                      onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Phân loại tiêu thụ</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all shadow-inner"
                      value={newCustomer.usageType}
                      onChange={e => setNewCustomer({...newCustomer, usageType: e.target.value as any})}
                    >
                      <option value="residential">Điện sinh hoạt</option>
                      <option value="commercial">Điện kinh doanh</option>
                      <option value="industrial">Điện sản xuất</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Lưới điện hiện có</label>
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all shadow-inner"
                      value={newCustomer.phaseType}
                      onChange={e => setNewCustomer({...newCustomer, phaseType: e.target.value as any})}
                    >
                      <option value="1phase">Điện 1 pha</option>
                      <option value="3phase">Điện 3 pha</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Sale phụ trách tư vấn</label>
                  <select 
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all shadow-inner"
                    value={newCustomer.assignedSalesId}
                    onChange={e => setNewCustomer({...newCustomer, assignedSalesId: e.target.value})}
                  >
                    <option value="">-- Chưa bàn giao nhân sự --</option>
                    {salesStaff.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                  </select>
                </div>

                <div className="pt-8 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-8 py-5 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl transition-all uppercase tracking-[0.2em]"
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] px-8 py-5 text-xs font-black bg-slate-900 hover:bg-blue-600 text-white rounded-2xl shadow-xl shadow-slate-200 transition-all uppercase tracking-[0.2em] active:scale-95"
                  >
                    Khởi tạo dữ liệu
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
