import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType, auth, createNotification } from '../lib/firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { Project, Customer, AppUser, CustomerInteraction, CustomerReminder } from '../types';
import { 
  UserPlus, Search, Phone, Mail, MapPin, Calendar, UserCheck, X, Edit2, Trash2,
  TrendingUp, DollarSign, MessageSquare, Plus, ChevronRight, CheckSquare, Sparkles,
  Clipboard, PhoneCall, Check, Tag, Info, AlertCircle, FileText, CalendarDays, BarChart3, Clock,
  List, LayoutGrid
} from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface CustomerListProps {
  onViewProject: (customerId: string) => void;
  userId?: string;
  userRole?: string;
}

export default function CustomerList({ onViewProject, userId, userRole }: CustomerListProps) {
  const isAdmin = userRole === 'admin' || userRole === 'manager';
  
  // States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesStaff, setSalesStaff] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // Appending and Editing Modal State
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState({ 
    name: '', 
    phone: '', 
    email: '', 
    address: '',
    usageType: 'residential' as any,
    phaseType: '1phase' as any,
    assignedSalesId: '',
    status: 'new' as any,
    source: 'referral' as any,
    leadValue: 0
  });

  // Selected Customer for CRM Detail Panel
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [crmTab, setCrmTab] = useState<'interactions' | 'reminders'>('interactions');
  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [reminders, setReminders] = useState<CustomerReminder[]>([]);
  
  // New interaction template
  const [newInt, setNewInt] = useState({
    type: 'call' as any,
    content: ''
  });

  // New Reminder template
  const [newRem, setNewRem] = useState({
    title: '',
    dueDate: '',
    assignedToId: ''
  });

  // Real-time Firestore Listeners
  useEffect(() => {
    if (!userId) return;
    
    // Listen to customers
    const qCust = userRole === 'sales_rep'
      ? query(collection(db, 'customers'), where('assignedSalesId', '==', userId), orderBy('createdAt', 'desc'))
      : query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const unsubCust = onSnapshot(qCust, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });

    // Listen to sales staff users
    const qSales = query(collection(db, 'users'), orderBy('displayName'));
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      setSalesStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return () => {
      unsubCust();
      unsubSales();
    };
  }, [userId, userRole]);

  // Real-time listener for current selected Customer CRM logs
  useEffect(() => {
    if (!selectedCustomerId) {
      setInteractions([]);
      setReminders([]);
      return;
    }

    // Set listener for interactions
    const unsubInt = onSnapshot(
      query(collection(db, 'customers', selectedCustomerId, 'interactions'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setInteractions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerInteraction)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `customers/${selectedCustomerId}/interactions`);
      }
    );

    // Set listener for reminders
    const unsubRem = onSnapshot(
      query(collection(db, 'customers', selectedCustomerId, 'reminders'), orderBy('dueDate', 'asc')),
      (snapshot) => {
        setReminders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerReminder)));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `customers/${selectedCustomerId}/reminders`);
      }
    );

    return () => {
      unsubInt();
      unsubRem();
    };
  }, [selectedCustomerId]);

  // Active customer object reactively resolved
  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Lead status mapping labels and colors
  const statusConfig = {
    new: { label: 'Mới nhận', bg: 'bg-blue-50 text-blue-700 border-blue-100', color: 'bg-blue-600', hover: 'hover:border-blue-300' },
    contacted: { label: 'Đã liên hệ', bg: 'bg-indigo-50 text-indigo-700 border-indigo-100', color: 'bg-indigo-600', hover: 'hover:border-indigo-300' },
    survey: { label: 'Khảo sát', bg: 'bg-amber-50 text-amber-700 border-amber-100', color: 'bg-amber-500', hover: 'hover:border-amber-300' },
    negotiating: { label: 'Thương thảo', bg: 'bg-teal-50 text-teal-700 border-teal-100', color: 'bg-teal-600', hover: 'hover:border-teal-300' },
    won: { label: 'Chốt hợp đồng 🏆', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', color: 'bg-emerald-600', hover: 'hover:border-emerald-300' },
    lost: { label: 'Thất bại', bg: 'bg-rose-50 text-rose-700 border-rose-100', color: 'bg-rose-600', hover: 'hover:border-rose-300' }
  };

  const getStatusLabel = (status?: string) => {
    return statusConfig[status as keyof typeof statusConfig]?.label || 'Mới nhận';
  };

  const getStatusColor = (status?: string) => {
    return statusConfig[status as keyof typeof statusConfig]?.bg || 'bg-blue-50 text-blue-700 border-blue-100';
  };

  // Lead source mapping labels
  const sourceConfig = {
    facebook: { label: 'Facebook Ads', css: 'bg-sky-50 text-sky-700 border-sky-100' },
    google: { label: 'Google Search', css: 'bg-violet-50 text-violet-700 border-violet-100' },
    referral: { label: 'Khách giới thiệu', css: 'bg-teal-50 text-teal-700 border-teal-100' },
    hotline: { label: 'Hotline trực tiếp', css: 'bg-rose-50 text-rose-700 border-rose-100' },
    other: { label: 'Kênh khác', css: 'bg-slate-100 text-slate-700 border-slate-200' }
  };

  const getSourceLabel = (src?: string) => {
    return sourceConfig[src as keyof typeof sourceConfig]?.label || 'Khách giới thiệu';
  };

  const getSourceColor = (src?: string) => {
    return sourceConfig[src as keyof typeof sourceConfig]?.css || 'bg-teal-50 text-teal-700 border-teal-100';
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

  // Pipeline Metrics Calculation for Dashboard summary cards
  const pipelineMetrics = useMemo(() => {
    const summary = {
      new: { count: 0, val: 0 },
      contacted: { count: 0, val: 0 },
      survey: { count: 0, val: 0 },
      negotiating: { count: 0, val: 0 },
      won: { count: 0, val: 0 },
      lost: { count: 0, val: 0 }
    };
    
    customers.forEach(c => {
      const st = c.status || 'new';
      if (summary[st as keyof typeof summary]) {
        summary[st as keyof typeof summary].count += 1;
        summary[st as keyof typeof summary].val += (c.leadValue || 0);
      }
    });

    const totalInflow = Object.values(summary).reduce((acc, current) => acc + current.val, 0);
    const totalCount = customers.length;
    
    return {
      stages: summary,
      totalInflow,
      totalCount
    };
  }, [customers]);

  // Primary filtering execution
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchesSearch = 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.phone.includes(search) ||
        (c.address && c.address.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = filterStatus === 'all' || (c.status || 'new') === filterStatus;
      const matchesSource = filterSource === 'all' || c.source === filterSource;
      
      return matchesSearch && matchesStatus && matchesSource;
    });
  }, [customers, search, filterStatus, filterSource]);

  // CRUD Customer Lead Submissions
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name || !newCustomer.phone) return;
    
    try {
      const payload = {
        ...newCustomer,
        assignedSalesId: userRole === 'sales_rep' ? userId : newCustomer.assignedSalesId,
        leadValue: Number(newCustomer.leadValue) || 0,
      };

      if (editingId) {
        await updateDoc(doc(db, 'customers', editingId), {
          ...payload,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'customers'), {
          ...payload,
          createdAt: serverTimestamp()
        });
        await createNotification(
          'customer',
          'Khách hàng mới được thêm',
          `Khách hàng "${newCustomer.name.trim()}" đã được thêm vào hệ thống.`
        );
      }
      
      // Reset State
      setNewCustomer({ 
        name: '', 
        phone: '', 
        email: '', 
        address: '', 
        usageType: 'residential', 
        phaseType: '1phase',
        assignedSalesId: '',
        status: 'new',
        source: 'referral',
        leadValue: 0
      });
      setIsAdding(false);
      setEditingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'customers');
    }
  };

  const deleteCustomer = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'customers', id));
      setDeletingId(null);
      // If deleted active inspected customer, close workspace
      if (selectedCustomerId === id) setSelectedCustomerId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
    }
  };

  const startEdit = (customer: Customer) => {
    setNewCustomer({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      address: customer.address || '',
      usageType: customer.usageType || 'residential',
      phaseType: customer.phaseType || '1phase',
      assignedSalesId: customer.assignedSalesId || '',
      status: customer.status || 'new',
      source: customer.source || 'referral',
      leadValue: customer.leadValue || 0
    });
    setEditingId(customer.id);
    setIsAdding(true);
  };

  // Inline reactive updates for inspected customer leads inside details panel
  const handleInlineUpdateFields = async (fields: Partial<Customer>) => {
    if (!selectedCustomerId) return;
    try {
      await updateDoc(doc(db, 'customers', selectedCustomerId), {
        ...fields,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `customers/${selectedCustomerId}`);
    }
  };

  // Add interaction history logs
  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !newInt.content.trim()) return;

    try {
      await addDoc(collection(db, 'customers', selectedCustomerId, 'interactions'), {
        customerId: selectedCustomerId,
        type: newInt.type,
        content: newInt.content.trim(),
        userId: auth.currentUser?.uid || userId || 'system',
        userName: auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Sales Rep',
        createdAt: serverTimestamp()
      });

      setNewInt({ ...newInt, content: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `customers/${selectedCustomerId}/interactions`);
    }
  };

  const handleDeleteInteraction = async (intId: string) => {
    if (!selectedCustomerId) return;
    try {
      await deleteDoc(doc(db, 'customers', selectedCustomerId, 'interactions', intId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${selectedCustomerId}/interactions/${intId}`);
    }
  };

  // Reminders Scheduling Tasks
  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !newRem.title.trim()) return;

    try {
      const defaultAssigneeId = activeCustomer?.assignedSalesId || '';
      await addDoc(collection(db, 'customers', selectedCustomerId, 'reminders'), {
        customerId: selectedCustomerId,
        title: newRem.title.trim(),
        dueDate: newRem.dueDate || format(new Date(), 'yyyy-MM-dd'),
        status: 'pending',
        assignedToId: newRem.assignedToId || defaultAssigneeId,
        createdAt: serverTimestamp()
      });

      const custName = activeCustomer?.name || 'Khách hàng';
      await createNotification(
        'appointment',
        'Lịch hẹn mới được lên',
        `Lịch hẹn chăm sóc khách hàng "${newRem.title.trim()}" cho khách hàng "${custName}" đã được lên lịch.`
      );

      setNewRem({ title: '', dueDate: '', assignedToId: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `customers/${selectedCustomerId}/reminders`);
    }
  };

  const handleToggleReminder = async (remId: string, currentStatus: 'pending' | 'completed') => {
    if (!selectedCustomerId) return;
    try {
      await updateDoc(doc(db, 'customers', selectedCustomerId, 'reminders', remId), {
        status: currentStatus === 'pending' ? 'completed' : 'pending'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `customers/${selectedCustomerId}/reminders/${remId}`);
    }
  };

  const handleDeleteReminder = async (remId: string) => {
    if (!selectedCustomerId) return;
    try {
      await deleteDoc(doc(db, 'customers', selectedCustomerId, 'reminders', remId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${selectedCustomerId}/reminders/${remId}`);
    }
  };

  // Currency utility Localizer format
  const formatVndNumber = (num: number) => {
    return num.toLocaleString('vi-VN') + ' ₫';
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Module Header SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-2">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight uppercase leading-none flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-blue-600 animate-pulse" />
            Điều Phối CRM Khách Hàng
          </h2>
          <div className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-[0.2em] mt-3 flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
             Hệ thống Chăm sóc, Lịch hẹn & Phễu bán hàng thông minh
          </div>
        </div>
        <button 
          onClick={() => {
            setEditingId(null);
            setIsAdding(true);
          }}
          className="w-full md:w-auto bg-slate-900 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-blue-600 hover:shadow-blue-200 transition-all active:scale-95"
          id="btn-add-customer-lead"
        >
          <UserPlus className="h-4 w-4" /> Khởi Tạo Lead Mới
        </button>
      </div>

      {/* CRM INTERACTIVE SALES FUNNEL PIPELINE SECTION */}
      <div className="bg-slate-50/50 p-6 rounded-[2.5rem] border border-slate-100 shadow-inner">
        <div className="flex justify-between items-center mb-4 px-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
            Phân Tích Phễu Đường Ống Kinh Doanh (Sales Pipeline)
          </span>
          <span className="text-[11px] font-bold text-slate-500">
            Tổng giá trị tiềm năng: <strong className="text-slate-900 font-black">{formatVndNumber(pipelineMetrics.totalInflow)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {(Object.keys(statusConfig) as Array<keyof typeof statusConfig>).map((stKey) => {
            const config = statusConfig[stKey];
            const data = pipelineMetrics.stages[stKey];
            const isActiveFilter = filterStatus === stKey;

            return (
              <button
                key={stKey}
                onClick={() => setFilterStatus(filterStatus === stKey ? 'all' : stKey)}
                className={`bg-white p-4 rounded-2xl border text-left transition-all relative ${
                  isActiveFilter 
                    ? 'border-indigo-600 ring-2 ring-indigo-100 shadow-md translate-y-[-2px]' 
                    : 'border-slate-100 shadow-sm hover:shadow-md'
                } group cursor-pointer`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded-full">
                    {data.count} lead
                  </span>
                </div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">
                  {config.label.replace(' 🏆', '')}
                </h4>
                <p className="text-[11px] font-bold text-slate-500 mt-2">
                  {formatVndNumber(data.val)}
                </p>
                {isActiveFilter && (
                  <span className="absolute bottom-1 right-2 text-[8px] font-extrabold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded">
                    Lọc
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* FILTERS & SEARCH ROW */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Keywords text Search */}
        <div className="relative group w-full md:max-w-md">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
          <input 
            type="text"
            placeholder="Tìm theo tên, điện thoại, địa bàn..."
            className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Dynamic drop-down selectors */}
        <div className="flex flex-wrap w-full md:w-auto items-center gap-3 justify-end">
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Trạng thái:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="new">Mới nhận</option>
              <option value="contacted">Đã liên hệ</option>
              <option value="survey">Khảo sát</option>
              <option value="negotiating">Thương thảo</option>
              <option value="won">Thành công (Won)</option>
              <option value="lost">Thất bại (Lost)</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nguồn Leads:</span>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="all">Tất cả nguồn</option>
              <option value="facebook">Facebook Ads</option>
              <option value="google">Google Search</option>
              <option value="referral">Khách giới thiệu</option>
              <option value="hotline">Hotline</option>
              <option value="other">Kênh khác</option>
            </select>
          </div>

          {(filterStatus !== 'all' || filterSource !== 'all' || search !== '') && (
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterSource('all');
                setSearch('');
              }}
              className="text-[10px] font-black text-rose-600 uppercase tracking-widest bg-rose-50 px-3 py-3 rounded-xl border border-rose-100 hover:bg-rose-100"
            >
              Đặt lại lọc
            </button>
          )}

          {/* View Mode Switcher */}
          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 shadow-inner">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-widest ${
                viewMode === 'list' 
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-100' 
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              Danh sách
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all text-[10px] font-black uppercase tracking-widest ${
                viewMode === 'grid' 
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-100' 
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Lưới Thẻ
            </button>
          </div>

        </div>
      </div>

      {/* REACTIVE CUSTOMER LEADS LISTING GRID/LIST */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
          {/* Table headers (Visible only on desktop md and up) */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4.5 bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
            <div className="col-span-3 flex items-center gap-2">
              <span>Hồ sơ khách hàng / Ngày tạo</span>
            </div>
            <div className="col-span-2">Thông tin liên hệ</div>
            <div className="col-span-3 text-center">Tiến trình phễu CRM (Stages)</div>
            <div className="col-span-2 text-right">Giá trị Lead / Nguồn</div>
            <div className="col-span-2 text-center">Thao tác nhanh</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredCustomers.map((c) => {
              // Calculate index of steps: new, contacted, survey, negotiating, won
              const stages = ['new', 'contacted', 'survey', 'negotiating', 'won'];
              const currentStep = stages.indexOf(c.status || 'new') + 1 || (c.status === 'lost' ? 0 : 1);
              const isLost = c.status === 'lost';

              return (
                <div key={c.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-6 py-4.5 hover:bg-slate-50/50 transition-colors">
                  {/* Column 1: Client profile info */}
                  <div className="col-span-1 md:col-span-3 flex items-center gap-3">
                    <div className={cn(
                      "h-10 w-10 text-white rounded-xl flex items-center justify-center text-xs font-black uppercase tracking-tight shadow-sm flex-shrink-0",
                      statusConfig[c.status as keyof typeof statusConfig]?.color || 'bg-blue-600'
                    )}>
                      {c.name.substring(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight truncate max-w-[150px] md:max-w-[180px]" title={c.name}>
                          {c.name}
                        </h4>
                        <span className="md:hidden text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border bg-slate-100 border-slate-200 text-slate-600">
                          {getSourceLabel(c.source)}
                        </span>
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-300" />
                        {c.createdAt?.seconds ? format(c.createdAt.seconds * 1000, 'dd/MM/yyyy', { locale: vi }) : 'Vừa xong'}
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Contact info */}
                  <div className="col-span-1 md:col-span-2 space-y-0.5 text-xs">
                    <div className="flex items-center gap-1.5 font-extrabold text-slate-700">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <a href={`tel:${c.phone}`} className="hover:text-blue-600 transition-colors">{c.phone}</a>
                    </div>
                    {c.email ? (
                      <div className="flex items-center gap-1.5 text-slate-500 font-bold truncate">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate" title={c.email}>{c.email}</span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 italic font-bold">Chưa bổ sung Email</div>
                    )}
                  </div>

                  {/* Column 3: Stepped mini progress tracker + Clear badge */}
                  <div className="col-span-1 md:col-span-3 flex flex-col items-start md:items-center justify-center space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border",
                        getStatusColor(c.status || 'new')
                      )}>
                        Phễu: {getStatusLabel(c.status || 'new')}
                      </span>
                    </div>

                    {/* Desktop Pipeline dot-stepper bar */}
                    <div className="w-full max-w-[170px]">
                      {isLost ? (
                        <div className="text-[9px] font-extrabold text-rose-500 uppercase tracking-widest flex items-center gap-1 justify-start md:justify-center">
                          <AlertCircle className="h-3 w-3" /> Trượt thầu / Thuyết phục lại
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 w-full">
                          {Array.from({ length: 5 }).map((_, i) => {
                            const stepIndex = i + 1;
                            const isCompleted = stepIndex <= currentStep;
                            const isCurrent = stepIndex === currentStep;

                            return (
                              <div key={i} className="flex-1">
                                <div 
                                  className={cn(
                                    "h-1.5 rounded-full transition-all duration-300",
                                    isCurrent 
                                      ? "bg-blue-600 ring-2 ring-blue-100" 
                                      : isCompleted 
                                        ? "bg-emerald-500" 
                                        : "bg-slate-100"
                                  )} 
                                  title={`Giai đoạn ${stepIndex}/5`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 4: Potential Value & Traffic marketing source */}
                  <div className="col-span-1 md:col-span-2 text-left md:text-right flex md:flex-col justify-between items-center md:items-end gap-1.5 py-1.5 md:py-0 border-t border-b md:border-none border-slate-50">
                    <span className="md:hidden text-[10px] font-black text-slate-400 uppercase tracking-wider">Giá Trị:</span>
                    <div>
                      <div className="text-sm font-black text-slate-800 tracking-tight font-mono">
                        {formatVndNumber(c.leadValue || 0)}
                      </div>
                      <span className="hidden md:inline-block text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border max-w-[130px] truncate bg-slate-50 text-slate-500 border-slate-200">
                        {getSourceLabel(c.source)}
                      </span>
                    </div>
                  </div>

                  {/* Column 5: Interaction triggers or profile edit buttons */}
                  <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-center gap-3">
                    <div className="flex gap-1">
                      <button 
                        onClick={() => onViewProject(c.id)}
                        className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all"
                        title="Dự án Solar"
                      >
                        <Clipboard className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setSelectedCustomerId(c.id)}
                        className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-sm"
                        title="CRM Chăm Sóc"
                      >
                        <Sparkles className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex gap-1 border-l border-slate-100 pl-2">
                      {isAdmin && (
                        <>
                          <button 
                            onClick={() => startEdit(c)}
                            className="p-1.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-100 transition-all"
                            title="Sửa thông tin"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button 
                            onClick={() => setDeletingId(c.id)}
                            className="p-1.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-slate-100 transition-all"
                            title="Xóa Lead"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((c) => (
            <motion.div 
              whileHover={{ y: -4 }}
              key={c.id} 
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)] transition-all flex flex-col h-full relative overflow-hidden"
            >
              {/* Top Pipeline Tag accent */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${statusConfig[c.status as keyof typeof statusConfig]?.color || 'bg-blue-600'}`} />

              {/* Header: Name, date, edit triggers */}
              <div className="flex items-start justify-between mb-5 mt-2">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-sm font-black border border-slate-800">
                    {c.name.substring(0, 1)}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 uppercase tracking-tight line-clamp-1 leading-snug">{c.name}</h3>
                    <div className="text-[9px] font-black text-slate-400 flex items-center gap-1 uppercase tracking-wider mt-0.5">
                      <Calendar className="h-3 w-3" />
                      {c.createdAt?.seconds ? format(c.createdAt.seconds * 1000, 'dd MMM yyyy', { locale: vi }) : 'Vừa xong'}
                    </div>
                  </div>
                </div>

                <div className="flex gap-1">
                  {isAdmin && (
                    <>
                      <button 
                        onClick={() => startEdit(c)}
                        className="p-1.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-100 transition-all"
                        title="Sửa"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button 
                        onClick={() => setDeletingId(c.id)}
                        className="p-1.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg border border-slate-100 transition-all"
                        title="Xóa"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Tags area */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                <span className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${getStatusColor(c.status || 'new')}`}>
                  Status: {getStatusLabel(c.status || 'new')}
                </span>
                <span className={`text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${getSourceColor(c.source || 'referral')}`}>
                  Nguồn: {getSourceLabel(c.source || 'referral')}
                </span>
              </div>

              {/* Core parameters display */}
              <div className="space-y-3.5 flex-1">
                <div className="flex items-center justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">GIÁ TRỊ LEAD:</span>
                  <span className="text-sm font-black text-slate-800">
                    {formatVndNumber(c.leadValue || 0)}
                  </span>
                </div>

                <div className="space-y-2.5 text-xs text-slate-500 font-bold">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <a href={`tel:${c.phone}`} className="text-slate-700 font-extrabold hover:text-blue-600 transition-colors">
                      {c.phone}
                    </a>
                  </div>

                  {c.email && (
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                        <Mail className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <span className="text-slate-600 truncate">{c.email}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <span className="text-slate-600 truncate">{c.address || 'Chưa cập nhật địa chỉ'}</span>
                  </div>

                  {c.assignedSalesId && (
                    <div className="flex items-center gap-3 bg-blue-50/20 p-2 rounded-lg border border-blue-500/10">
                      <UserCheck className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-blue-700">
                        Sale: {salesStaff.find(s => s.id === c.assignedSalesId)?.displayName || 'N/A'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions block footer */}
              <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                <button 
                  onClick={() => onViewProject(c.id)}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black py-4 rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
                >
                  <Clipboard className="h-3.5 w-3.5" /> Hồ Sơ Dự Án
                </button>
                <button 
                  onClick={() => setSelectedCustomerId(c.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black py-4 rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-blue-50"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Chăm Sóc CRM
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* GRID EMPTY STATE REPRESENTATION */}
      {filteredCustomers.length === 0 && (
         <div className="text-center py-20 px-6 bg-white rounded-[3rem] border border-dashed border-slate-200">
            <Search className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Không tìm thấy Lead khách hàng phù hợp</p>
         </div>
      )}

      {/* ============================================== */}
      {/* 🔮 SLIDING OVERLAY DETAILED CRM WORKSPACE MODAL */}
      {/* ============================================== */}
      <AnimatePresence>
        {selectedCustomerId && activeCustomer && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-0 md:p-6 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCustomerId(null)}
              className="absolute inset-0 bg-slate-950/65 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ scale: 0.95, y: 15, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 15, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 220 }}
              className="relative w-full max-w-5xl bg-white md:rounded-[2.5rem] shadow-2xl h-full md:h-[85vh] flex flex-col overflow-hidden z-10"
            >
              {/* Header block with lead summaries */}
              <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center text-lg font-black font-mono">
                    {activeCustomer.name.substring(0, 1)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight">
                        {activeCustomer.name}
                      </h3>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${getStatusColor(activeCustomer.status || 'new')}`}>
                        {getStatusLabel(activeCustomer.status || 'new')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-bold mt-1 flex items-center gap-1">
                      <Phone className="h-3 w-3 text-slate-400" /> {activeCustomer.phone} | <Mail className="h-3 w-3 text-slate-400" /> {activeCustomer.email || 'Hộp thư trống'}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedCustomerId(null)}
                  className="p-2.5 bg-white text-slate-400 hover:text-slate-900 rounded-full border border-slate-200 shadow-sm transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Main Workspace split layout */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                
                {/* 1. Left side column: Profiler attributes edits */}
                <div className="w-full md:w-85 border-r border-slate-100 p-6 md:p-8 overflow-y-auto space-y-6 flex-shrink-0 bg-slate-50/50">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 mb-2">
                    <Info className="h-3.5 w-3.5 text-blue-600" />
                    Cấu Hình Nguồn Trạng Thái CRM
                  </span>

                  <div className="space-y-4">
                    {/* Status selection */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Giai Đoạn Phễu CRM</label>
                      <select
                        value={activeCustomer.status || 'new'}
                        onChange={(e) => handleInlineUpdateFields({ status: e.target.value as any })}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500"
                      >
                        <option value="new">Mới nhận (New Lead)</option>
                        <option value="contacted">Đã liên hệ (Contacted)</option>
                        <option value="survey">Khảo sát & Lên cấu hình</option>
                        <option value="negotiating">Thương thảo hợp đồng</option>
                        <option value="won">Thành công chốt hợp đồng 🏆</option>
                        <option value="lost">Thất bại (Lost)</option>
                      </select>
                    </div>

                    {/* Source selection */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Nguồn Phát Sinh Lead</label>
                      <select
                        value={activeCustomer.source || 'referral'}
                        onChange={(e) => handleInlineUpdateFields({ source: e.target.value as any })}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500"
                      >
                        <option value="facebook">Facebook Ads</option>
                        <option value="google">Google SEO/Mạng xã hội</option>
                        <option value="referral">Được giới thiệu</option>
                        <option value="hotline">Gọi điện Hotline</option>
                        <option value="other">Kênh tiếp cận khác</option>
                      </select>
                    </div>

                    {/* Estimated Contract lead value */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">
                        Giá Trị Ước Tính (VND)
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="number"
                          value={activeCustomer.leadValue || 0}
                          onChange={(e) => handleInlineUpdateFields({ leadValue: Number(e.target.value) || 0 })}
                          className="w-full pl-8 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500"
                        />
                      </div>
                      <span className="text-[10px] font-black text-blue-600 block mt-1 ml-1">
                        Khớp định dạng: {formatVndNumber(activeCustomer.leadValue || 0)}
                      </span>
                    </div>

                    {/* assigned Sales broker */}
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Nhân phái phụ trách</label>
                      <select
                        value={activeCustomer.assignedSalesId || ''}
                        onChange={(e) => handleInlineUpdateFields({ assignedSalesId: e.target.value })}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                        disabled={userRole === 'sales_rep'}
                      >
                        <option value="">-- Chưa bàn giao nhân sự --</option>
                        {salesStaff
                          .filter(s => s.status === 'active' && (s.role === 'sales_rep' || s.role === 'manager' || s.role === 'admin'))
                          .map(s => <option key={s.id} value={s.id}>{s.displayName.toUpperCase()}</option>)}
                      </select>
                    </div>

                    {/* Basic Grid specs */}
                    <div className="space-y-1.5 pt-4 border-t border-slate-200 text-xs text-slate-600 font-bold space-y-3">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 block uppercase mb-0.5">Tiêu dùng:</span>
                        {getUsageLabel(activeCustomer.usageType)}
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 block uppercase mb-0.5">Dạng lưới điện:</span>
                        {getPhaseLabel(activeCustomer.phaseType)}
                      </div>
                      {activeCustomer.address && (
                        <div>
                          <span className="text-[9px] font-black text-slate-400 block uppercase mb-0.5">Địa bàn định vị:</span>
                          <span className="leading-snug text-slate-800 flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-rose-500" /> {activeCustomer.address}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Right side column: Interactions flow logger & Reminders checklists */}
                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                  
                  {/* Selector Tabs Header */}
                  <div className="border-b border-slate-100 flex py-1 px-4 flex-shrink-0">
                    <button
                      onClick={() => setCrmTab('interactions')}
                      className={`px-5 py-4 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border-b-2 ${
                        crmTab === 'interactions' 
                          ? 'border-blue-600 text-blue-600' 
                          : 'border-transparent text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <MessageSquare className="h-4 w-4" />
                      Nhật Ký CSKH ({interactions.length})
                    </button>
                    <button
                      onClick={() => setCrmTab('reminders')}
                      className={`px-5 py-4 text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border-b-2 ${
                        crmTab === 'reminders' 
                          ? 'border-blue-600 text-blue-600' 
                          : 'border-transparent text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Clock className="h-4 w-4" />
                      Lịch Hẹn & Công Việc ({reminders.length})
                    </button>
                  </div>

                  {/* Tab Body Contents scrollable frame */}
                  <div className="flex-1 overflow-y-auto p-6 md:p-8">
                    
                    {/* INTERACTIONS TIMELINE MODULE */}
                    {crmTab === 'interactions' && (
                      <div className="space-y-6">
                        
                        {/* New log addition block */}
                        <form onSubmit={handleAddInteraction} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ghi nhật ký:</span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(['call', 'meeting', 'note', 'email', 'survey'] as const).map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setNewInt({ ...newInt, type })}
                                  className={`px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-wider font-extrabold border transition-all ${
                                    newInt.type === type 
                                      ? 'bg-blue-600 text-white border-blue-500' 
                                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  {type === 'call' && '📞 Gọi'}
                                  {type === 'meeting' && '🤝 Gặp mặt'}
                                  {type === 'note' && '📌 Ghi chú'}
                                  {type === 'email' && '✉️ Thư gửi'}
                                  {type === 'survey' && '📋 Khảo sát'}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <textarea
                              rows={2}
                              required
                              placeholder="Nhập nội dung cuộc gọi, thông tin ghi lại cuộc họp hoặc yêu cầu thiết kế của chủ nhà..."
                              className="flex-1 bg-white border border-slate-200 rounded-xl p-3.5 text-xs text-slate-800 font-medium outline-none focus:border-blue-500 resize-none h-16"
                              value={newInt.content}
                              onChange={e => setNewInt({ ...newInt, content: e.target.value })}
                            />
                            <button
                              type="submit"
                              className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center flex-shrink-0"
                            >
                              Ghi lại
                            </button>
                          </div>
                        </form>

                        {/* Timeline Flow */}
                        <div className="relative pl-6 space-y-5 border-l-2 border-slate-100 ml-4">
                          {interactions.map((it) => (
                            <div key={it.id} className="relative group">
                              {/* Left icon marker overlay on stem */}
                              <div className="absolute -left-9.5 top-1 w-7 h-7 bg-white rounded-full border border-slate-200 flex items-center justify-center text-[10px] shadow-sm">
                                {it.type === 'call' && '📞'}
                                {it.type === 'meeting' && '🤝'}
                                {it.type === 'note' && '📌'}
                                {it.type === 'email' && '✉️'}
                                {it.type === 'survey' && '📋'}
                              </div>

                              <div className="bg-slate-50/50 hover:bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-800">
                                      {it.userName}
                                    </span>
                                    <span className="text-[8px] bg-slate-200/50 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold">
                                      {it.type}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-medium text-slate-400">
                                      {it.createdAt?.seconds ? format(it.createdAt.seconds * 1000, 'dd/MM/yyyy HH:mm', { locale: vi }) : 'Bây giờ'}
                                    </span>
                                    <button
                                      onClick={() => handleDeleteInteraction(it.id)}
                                      className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                      title="Gỡ"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-line">
                                  {it.content}
                                </p>
                              </div>
                            </div>
                          ))}

                          {interactions.length === 0 && (
                            <div className="text-center py-10 text-slate-400 font-bold text-xs uppercase tracking-wider">
                              Trống nhật ký. Hãy tạo ghi chép cskh đầu tiên của bạn!
                            </div>
                          )}
                        </div>

                      </div>
                    )}

                    {/* REMINDERS SCHEDULER MODULE */}
                    {crmTab === 'reminders' && (
                      <div className="space-y-6">
                        
                        {/* New Reminder Submission Form */}
                        <form onSubmit={handleAddReminder} className="bg-slate-50 p-5 rounded-2xl border border-slate-100 grid grid-cols-1 gap-3">
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <input
                                type="text"
                                required
                                placeholder="Lên lịch hành động (VD: Gọi lại báo giá inverter, Khảo sát mái)..."
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-blue-500"
                                value={newRem.title}
                                onChange={e => setNewRem({ ...newRem, title: e.target.value })}
                              />
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider px-1">📅 Hạn hoàn tất</label>
                                <input
                                  type="date"
                                  required
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold outline-none focus:border-blue-500"
                                  value={newRem.dueDate}
                                  onChange={e => setNewRem({ ...newRem, dueDate: e.target.value })}
                                />
                              </div>

                              <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-450 uppercase tracking-wider px-1"> 👤 Phân công nhân sự</label>
                                <select
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold outline-none focus:border-blue-500"
                                  value={newRem.assignedToId || activeCustomer?.assignedSalesId || ''}
                                  onChange={e => setNewRem({ ...newRem, assignedToId: e.target.value })}
                                >
                                  <option value="">-- Mặc định hoặc Chưa chọn --</option>
                                  {salesStaff.map(staff => (
                                    <option key={staff.id} value={staff.id}>
                                      {staff.displayName || staff.username} ({staff.role === 'sales_rep' ? 'Kinh doanh' : staff.role === 'manager' ? 'Quản lý' : staff.role})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex items-end">
                                <button
                                  type="submit"
                                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                                >
                                  Đặt Hẹn & Giao Việc
                                </button>
                              </div>
                            </div>
                          </div>
                        </form>

                        {/* Reminders layout list */}
                        <div className="space-y-3">
                          {reminders.map((rem) => {
                            const isCompleted = rem.status === 'completed';
                            const parsedDate = rem.dueDate ? parseISO(rem.dueDate) : new Date();
                            const isOverdue = !isCompleted && isAfter(new Date(), parsedDate);

                            return (
                              <div 
                                key={rem.id}
                                className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                                  isCompleted 
                                    ? 'bg-emerald-50/20 border-emerald-100/50 opacity-70' 
                                    : isOverdue 
                                      ? 'bg-rose-50/30 border-rose-100' 
                                      : 'bg-slate-50/40 border-slate-100'
                                }`}
                              >
                                <div className="flex items-center gap-3.5 max-w-[85%]">
                                  <button
                                    onClick={() => handleToggleReminder(rem.id, rem.status)}
                                    className={`w-5.5 h-5.5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                      isCompleted 
                                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                                        : isOverdue 
                                          ? 'border-rose-400 bg-white hover:bg-rose-50' 
                                          : 'border-slate-300 bg-white hover:bg-slate-100 text-slate-300'
                                    }`}
                                  >
                                    {isCompleted && <Check className="h-4.5 w-4.5 stroke-[3.5]" />}
                                  </button>
                                  
                                  <div>
                                    <p className={`text-xs font-extrabold text-slate-800 ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                                      {rem.title}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      <span className={`text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                        isCompleted 
                                          ? 'text-emerald-600' 
                                          : isOverdue 
                                            ? 'text-rose-600 animate-pulse' 
                                            : 'text-slate-400'
                                      }`}>
                                        <CalendarDays className="h-3 w-3" />
                                        Hạn hoàn tất: {rem.dueDate ? format(parsedDate, 'dd/MM/yyyy', { locale: vi }) : 'Hôm nay'}
                                        {isOverdue && ' (Trễ Hẹn)'}
                                        {isCompleted && ' (Hoàn thành)'}
                                      </span>

                                      {/* Assigned Salesrep selector inside list item */}
                                      <div className="flex items-center gap-1 bg-indigo-50 text-indigo-700 rounded px-1.5 py-0.5 border border-indigo-100 text-[9px] font-black uppercase">
                                        <span>Giaoviệc:</span>
                                        <select
                                          className="bg-transparent font-black border-none text-indigo-800 outline-none p-0 cursor-pointer text-[9px]"
                                          value={(rem as any).assignedToId || ''}
                                          onChange={async (e) => {
                                            const val = e.target.value;
                                            try {
                                              await updateDoc(doc(db, 'customers', selectedCustomerId, 'reminders', rem.id), {
                                                assignedToId: val
                                              });
                                            } catch (err) {
                                              handleFirestoreError(err, OperationType.UPDATE, `customers/${selectedCustomerId}/reminders/${rem.id}`);
                                            }
                                          }}
                                        >
                                          <option value="">Chưa chọn</option>
                                          {salesStaff.map(staff => (
                                            <option key={staff.id} value={staff.id}>
                                              {staff.displayName || staff.username}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  onClick={() => handleDeleteReminder(rem.id)}
                                  className="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl border border-slate-100 transition-colors flex-shrink-0"
                                  title="Gỡ công việc"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}

                          {reminders.length === 0 && (
                            <div className="text-center py-10 text-slate-400 font-bold text-xs uppercase tracking-wider">
                              Không có công việc hoặc lịch hẹn cần xử lý.
                            </div>
                          )}
                        </div>

                      </div>
                    )}

                  </div>

                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ============================================== */}
      {/* ⚠️ CONFIRM DELETE MODEL OUTLET */}
      {/* ============================================== */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeletingId(null)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-[2rem] p-8 shadow-2xl text-center z-10"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-100">
                <Trash2 className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">Gỡ Bỏ Khách Hàng?</h3>
              <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
                Hồ sơ khách hàng, các mốc thời gian chăm sóc và các nhắc dịch liên quan sẽ bị gỡ bỏ vĩnh viễn khỏi toàn tuyến cơ sở dữ liệu.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeletingId(null)}
                  className="flex-1 px-6 py-4 text-[10px] font-black bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-all uppercase tracking-widest cursor-pointer"
                >
                  Hủy
                </button>
                <button 
                  onClick={() => deleteCustomer(deletingId)}
                  className="flex-1 px-6 py-4 text-[10px] font-black bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-200 transition-all uppercase tracking-widest cursor-pointer"
                >
                  Gióp Xóa
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ============================================== */}
        {/* ➕ PRIMARY ADD/EDIT CUSTOMER DIALOG OVERLAY */}
        {/* ============================================== */}
        {isAdding && (
          <div className="fixed inset-0 z-[130] flex items-end md:items-center justify-center p-0 md:p-6 text-left">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-slate-950/45 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              className="relative w-full max-w-xl bg-white rounded-t-[2.5rem] md:rounded-[3rem] p-8 md:p-10 shadow-[0_-20px_60px_rgba(0,0,0,0.1)] max-h-[92vh] overflow-y-auto z-10"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <UserPlus className="h-5.5 w-5.5 text-blue-600" />
                    {editingId ? 'Cập Nhật Hồ Sơ Lead' : 'Thiết Lập Khách Hàng CRM'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">Đồng bộ dữ liệu thời gian thực</p>
                </div>
                <button 
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                    setNewCustomer({ 
                      name: '', phone: '', email: '', address: '', usageType: 'residential', phaseType: '1phase', assignedSalesId: '', status: 'new', source: 'referral', leadValue: 0
                    });
                  }} 
                  className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-full transition-colors border border-slate-100"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleAddCustomer} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Tên khách hàng / Tổ chức *</label>
                  <input 
                    required
                    placeholder="VD: Nguyễn Văn A"
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner"
                    value={newCustomer.name}
                    onChange={e => setNewCustomer({...newCustomer, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Số điện thoại liên hệ *</label>
                    <input 
                      required
                      placeholder="09xx xxx xxx"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner"
                      value={newCustomer.phone}
                      onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Hộp thư (Email)</label>
                    <input 
                      type="email"
                      placeholder="example@gmail.com"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner"
                      value={newCustomer.email}
                      onChange={e => setNewCustomer({...newCustomer, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Địa chỉ lắp đặt / Khảo sát</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                    <input 
                      placeholder="Địa chỉ cụ thể hoặc khu phố"
                      className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 transition-all shadow-inner"
                      value={newCustomer.address}
                      onChange={e => setNewCustomer({...newCustomer, address: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Phân loại hộ tiêu dùng</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all shadow-inner"
                      value={newCustomer.usageType}
                      onChange={e => setNewCustomer({...newCustomer, usageType: e.target.value as any})}
                    >
                      <option value="residential">Điện sinh hoạt gia đình</option>
                      <option value="commercial">Điện kinh doanh / Dịch vụ</option>
                      <option value="industrial">Điện xưởng sản xuất</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Mạng điện lưới</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all shadow-inner"
                      value={newCustomer.phaseType}
                      onChange={e => setNewCustomer({...newCustomer, phaseType: e.target.value as any})}
                    >
                      <option value="1phase">Lưới điện 1 pha</option>
                      <option value="3phase">Lưới điện 3 pha</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-slate-100 pt-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Trạng thái CSKH</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none"
                      value={newCustomer.status}
                      onChange={e => setNewCustomer({...newCustomer, status: e.target.value as any})}
                    >
                      <option value="new">Mới nhận</option>
                      <option value="contacted">Đã liên hệ</option>
                      <option value="survey">Khảo sát</option>
                      <option value="negotiating">Thương thảo</option>
                      <option value="won">Thành công (Won)</option>
                      <option value="lost">Thất bại (Lost)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Nguồn tiếp cận</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none"
                      value={newCustomer.source}
                      onChange={e => setNewCustomer({...newCustomer, source: e.target.value as any})}
                    >
                      <option value="facebook">Facebook Ads</option>
                      <option value="google">Google SEO</option>
                      <option value="referral">Khách giới thiệu</option>
                      <option value="hotline">Hotline</option>
                      <option value="other">Kênh tiếp cận khác</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Giá trị dự kiến (đ)</label>
                    <input 
                      type="number"
                      placeholder="Nhập giá trị hợp đồng ví dụ"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500"
                      value={newCustomer.leadValue}
                      onChange={e => setNewCustomer({...newCustomer, leadValue: Number(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {userRole !== 'sales_rep' && (
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Sale điều phối phụ trách</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all"
                      value={newCustomer.assignedSalesId}
                      onChange={e => setNewCustomer({...newCustomer, assignedSalesId: e.target.value})}
                    >
                      <option value="">-- Chưa bàn giao nhân sự --</option>
                      {salesStaff
                        .filter(s => s.status === 'active' && (s.role === 'sales_rep' || s.role === 'manager' || s.role === 'admin'))
                        .map(s => <option key={s.id} value={s.id}>{s.displayName.toUpperCase()}</option>)}
                    </select>
                  </div>
                )}

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingId(null);
                      setNewCustomer({ 
                        name: '', phone: '', email: '', address: '', usageType: 'residential', phaseType: '1phase', assignedSalesId: '', status: 'new', source: 'referral', leadValue: 0
                      });
                    }}
                    className="flex-1 px-8 py-4.5 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl transition-all uppercase tracking-widest cursor-pointer"
                  >
                    Hủy Bỏ
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] px-8 py-4.5 text-xs font-black bg-slate-900 hover:bg-blue-600 text-white rounded-xl shadow-xl transition-all uppercase tracking-widest active:scale-95 cursor-pointer"
                  >
                    {editingId ? 'Cập Nhật Lead' : 'Lưu Lead Khách Hàng'}
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
