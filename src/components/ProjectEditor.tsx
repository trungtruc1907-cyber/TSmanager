import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, getDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Project, Customer, Equipment, ProjectStatus, SalesPerson } from '../types';
import { 
  Calculator, 
  ArrowLeft, 
  Save, 
  FileText, 
  ChevronRight, 
  User, 
  Zap, 
  Coins, 
  ShieldCheck,
  Plus,
  Minus,
  Clock,
  UserCheck,
  Calendar,
  MapPin,
  Sun,
  Download
} from 'lucide-react';
import { cn, formatCurrency, estimateSystemSize, calculateSolarProduction, getAverageElectricityPrice } from '../lib/utils';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

interface Props {
  projectId: string | null;
  initialCustomerId?: string | null;
  onClose: () => void;
}

export default function ProjectEditor({ projectId, initialCustomerId, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalog, setCatalog] = useState<Equipment[]>([]);
  const [salesStaff, setSalesStaff] = useState<SalesPerson[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [project, setProject] = useState<Partial<Project>>({
    status: 'lead',
    customerId: initialCustomerId || '',
    monthlyBill: 0,
    systemSizeKWp: 0,
    panels: { equipmentId: '', count: 0 },
    inverters: { equipmentId: '', count: 0 },
    totalCost: 0,
    annualProduction: 0,
    paybackYears: 0,
    assignedSalesId: ''
  });

  useEffect(() => {
    onSnapshot(collection(db, 'customers'), (s) => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() } as Customer))), (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });
    onSnapshot(collection(db, 'equipment'), (s) => setCatalog(s.docs.map(d => ({ id: d.id, ...d.data() } as Equipment))), (error) => {
      handleFirestoreError(error, OperationType.GET, 'equipment');
    });
    onSnapshot(query(collection(db, 'sales'), orderBy('name')), (s) => setSalesStaff(s.docs.map(d => ({ id: d.id, ...d.data() } as SalesPerson))), (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
    });

    if (projectId) {
      getDoc(doc(db, 'projects', projectId)).then(s => {
        if (s.exists()) setProject({ id: s.id, ...s.data() } as Project);
      });
    }
    setLoading(false);
  }, [projectId]);

  // Set default sales rep when customer changes
  useEffect(() => {
    if (project.customerId && !project.assignedSalesId) {
      const cust = customers.find(c => c.id === project.customerId);
      if (cust?.assignedSalesId) {
        setProject(prev => ({ ...prev, assignedSalesId: cust.assignedSalesId }));
      }
    }
  }, [project.customerId, customers]);

  const panels = useMemo(() => catalog.filter(e => e.type === 'panel'), [catalog]);
  const inverters = useMemo(() => catalog.filter(e => e.type === 'inverter'), [catalog]);
  const batteries = useMemo(() => catalog.filter(e => e.type === 'battery'), [catalog]);

  const calculateFinancials = (p: Partial<Project>) => {
    const cust = customers.find(c => c.id === p.customerId);
    const panel = catalog.find(e => e.id === p.panels?.equipmentId);
    const inverter = catalog.find(e => e.id === p.inverters?.equipmentId);
    const battery = catalog.find(e => e.id === p.batteries?.equipmentId);

    const panelCost = (p.panels?.count || 0) * (panel?.unitPrice || 0);
    const inverterCost = (p.inverters?.count || 0) * (inverter?.unitPrice || 0);
    const batteryCost = (p.batteries?.count || 0) * (battery?.unitPrice || 0);
    
    // Additional costs: mounting, labor, wiring
    const additionalCost = (p.systemSizeKWp || 0) * 5000000;
    const total = panelCost + inverterCost + batteryCost + additionalCost;

    const annualProduction = calculateSolarProduction(p.systemSizeKWp || 0);
    const avgPrice = getAverageElectricityPrice(p.monthlyBill || 0, cust?.usageType);
    const annualSavings = annualProduction * avgPrice;
    const payback = total / annualSavings;

    return {
      totalCost: total,
      annualProduction,
      paybackYears: isFinite(payback) ? Number(payback.toFixed(1)) : 0
    };
  };

  const handleAutoConfig = (bill: number) => {
    const cust = customers.find(c => c.id === project.customerId);
    const size = estimateSystemSize(bill, cust?.usageType, cust?.phaseType);
    const selectedPanel = panels[0];
    const selectedInverter = inverters[0];

    if (!selectedPanel || !selectedInverter) return;

    const panelCount = Math.ceil((size * 1000) / selectedPanel.capacity);
    const inverterCount = Math.ceil(size / selectedInverter.capacity);
    
    const baseProject = {
      ...project,
      monthlyBill: bill,
      systemSizeKWp: size,
      panels: { equipmentId: selectedPanel.id, count: panelCount },
      inverters: { equipmentId: selectedInverter.id, count: inverterCount },
      batteries: project.batteries ? { ...project.batteries } : { equipmentId: '', count: 0 }
    };

    const financials = calculateFinancials(baseProject);

    setProject({
      ...baseProject,
      ...financials
    });
  };

  const handleSave = async () => {
    if (!project.customerId) return alert('Vui lòng chọn khách hàng');

    const data = {
      ...project,
      updatedAt: serverTimestamp()
    };

    if (project.id) {
      await updateDoc(doc(db, 'projects', project.id), data);
    } else {
      await addDoc(collection(db, 'projects'), data);
    }
    onClose();
  };

  if (loading) return <div>Đang tải...</div>;

  const currentCustomer = customers.find(c => c.id === project.customerId);

  return (
    <div className="max-w-5xl mx-auto pb-32 md:pb-20 px-4 md:px-0">
      {/* Redesigned Navigation Header */}
      <div className="flex flex-col gap-6 mb-10 sticky top-0 md:relative z-20 md:z-10 bg-slate-50/80 backdrop-blur-xl py-4 md:py-0">
        <div className="flex items-center justify-between">
            <button 
                onClick={onClose} 
                className="group flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-2xl shadow-sm hover:bg-slate-900 hover:border-slate-900 transition-all active:scale-95"
            >
                <ArrowLeft className="h-5 w-5 text-slate-400 group-hover:text-white transition-colors" /> 
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 group-hover:text-white">Thoát</span>
            </button>
            
            <div className="flex items-center gap-1.5 md:gap-3 bg-white/50 p-1.5 rounded-full border border-slate-100 shadow-inner">
                {[1, 2, 3, 4].map(s => (
                    <div 
                        key={s} 
                        onClick={() => setStep(s)}
                        className={cn(
                            "cursor-pointer flex items-center justify-center transition-all duration-500",
                            step === s ? "w-10 h-7 md:w-16 md:h-2 rounded-full bg-slate-900" : "w-2 h-2 rounded-full",
                            step > s ? "bg-blue-600 w-2 h-2" : (step < s ? "bg-slate-200" : "")
                        )} 
                    >
                        {step === s && <span className="text-[8px] font-black text-white uppercase hidden md:inline">Step 0{s}</span>}
                        {step === s && <span className="text-[9px] font-black text-white md:hidden">0{s}</span>}
                    </div>
                ))}
            </div>

            <button 
                onClick={handleSave}
                className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl flex items-center gap-2.5 font-black shadow-xl shadow-slate-200 hover:bg-blue-600 transition-all active:scale-95"
            >
                <Save className="h-4 w-4" /> 
                <span className="text-[11px] uppercase tracking-widest hidden sm:inline">Lưu Dự án</span>
                <span className="text-[11px] uppercase tracking-widest sm:hidden">Lưu</span>
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {step === 1 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-[0_10px_40px_rgb(0,0,0,0.03)] space-y-10"
            >
              <div>
                <h3 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none mb-3">Phân Tích Nhu Cầu</h3>
                <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest">Xác định quy mô hệ thống dựa trên hóa đơn điện</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Chủ đầu tư / Khách hàng *</label>
                    <div className="relative">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                      <select 
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all"
                        value={project.customerId || ''}
                        onChange={e => setProject({...project, customerId: e.target.value})}
                      >
                        <option value="">-- Chọn danh bạ --</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Vị trí triển khai</label>
                    <div className="relative">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                      <input 
                        type="text" 
                        readOnly
                        placeholder="Chọn khách hàng để xem địa chỉ"
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-400 outline-none" 
                        value={currentCustomer?.address || ''} 
                      />
                    </div>
                  </div>

                   <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Chuyên viên phụ trách</label>
                    <div className="relative">
                      <UserCheck className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                      <select 
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all"
                        value={project.assignedSalesId || ''}
                        onChange={e => setProject({...project, assignedSalesId: e.target.value})}
                      >
                        <option value="">-- Cấp độ hệ thống --</option>
                        {salesStaff.map(s => <option key={s.id} value={s.id}>{s.name.toUpperCase()}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[2.5rem] p-8 md:p-10 border border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.02)] flex flex-col justify-center min-h-[340px]">
                  <div className="space-y-8">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Zap className="h-5 w-5 text-blue-600 fill-blue-600" />
                         </div>
                         <div>
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">
                             Chỉ số tài chính
                           </label>
                           <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">Hóa đơn điện trung bình</h4>
                         </div>
                      </div>
                      <div className="px-3 py-1 bg-blue-600 text-[9px] font-black text-white uppercase rounded-full shadow-lg shadow-blue-100">
                        Auto Config
                      </div>
                    </div>
 
                    <div className="space-y-4">
                      <div className="relative max-w-[280px] mx-auto">
                        <input 
                          type="number"
                          placeholder="0"
                          className="w-full bg-slate-50 border-2 border-slate-100 px-6 py-5 rounded-2xl text-3xl font-black text-slate-900 tracking-tighter outline-none focus:border-blue-600 focus:bg-white transition-all text-center"
                          value={project.monthlyBill || ''}
                          onChange={e => handleAutoConfig(Number(e.target.value))}
                        />
                        <div className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest italic pointer-events-none">
                          VNĐ
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-px w-8 bg-slate-100" />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tương ứng tiêu thụ</p>
                        <div className="h-px w-8 bg-slate-100" />
                      </div>

                      <div className="text-center">
                        <span className="text-4xl font-black text-blue-600 tracking-tighter">
                          {Math.round((project.monthlyBill || 0) / getAverageElectricityPrice(project.monthlyBill || 0, currentCustomer?.usageType))}
                        </span>
                        <span className="text-sm font-black text-slate-400 ml-2 uppercase tracking-widest">kWh / Tháng</span>
                      </div>
                    </div>
 
                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                       <div className="space-y-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phụ tải</span>
                          <p className="text-[11px] font-black text-slate-800 uppercase truncate">
                              {currentCustomer?.usageType === 'residential' ? 'Sinh hoạt' : 
                               currentCustomer?.usageType === 'commercial' ? 'Kinh doanh' : 
                               currentCustomer?.usageType === 'industrial' ? 'Sản xuất' : 'N/A'}
                          </p>
                       </div>
                       <div className="space-y-1 text-right">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Đơn giá</span>
                          <p className="text-[11px] font-black text-slate-800">
                            ~{getAverageElectricityPrice(project.monthlyBill || 0, currentCustomer?.usageType).toLocaleString('vi-VN')} đ/kWh
                          </p>
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-[0_10px_40px_rgb(0,0,0,0.03)] space-y-10"
            >
              <div>
                <h3 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none mb-3">Cấu Hình Kỹ Thuật</h3>
                <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest">Lựa chọn thiết bị và cân chỉnh quy mô hệ thống</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Tấm pin (PV Panels)</label>
                    <div className="flex items-center gap-4">
                         <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center shrink-0 border border-amber-100 shadow-sm transition-transform group-hover:scale-110">
                            <Sun className="h-6 w-6 text-amber-500" />
                         </div>
                         <div className="flex-1 relative">
                           <select 
                              className="w-full pl-6 pr-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all"
                              value={project.panels?.equipmentId}
                              onChange={e => {
                                  const id = e.target.value;
                                  const p = panels.find(i => i.id === id);
                                  if (p) {
                                      const newCount = Math.ceil(((project.systemSizeKWp || 0) * 1000) / p.capacity);
                                      setProject({ ...project, panels: { equipmentId: id, count: newCount } });
                                  }
                              }}
                           >
                              {panels.map(p => <option key={p.id} value={p.id}>{p.brand} {p.model}</option>)}
                           </select>
                           <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none rotate-90" />
                         </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Biến tần (Inverter)</label>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-100 shadow-sm">
                           <Zap className="h-6 w-6 text-indigo-500" />
                        </div>
                        <div className="flex-1 relative">
                          <select 
                              className="w-full pl-6 pr-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all"
                              value={project.inverters?.equipmentId}
                              onChange={e => {
                                  const newProj = {...project, inverters: {...project.inverters!, equipmentId: e.target.value}};
                                  setProject({...newProj, ...calculateFinancials(newProj)});
                              }}
                          >
                              {inverters.map(i => <option key={i.id} value={i.id}>{i.brand} {i.model}</option>)}
                          </select>
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none rotate-90" />
                        </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Pin lưu trữ (Battery / ESS)</label>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center shrink-0 border border-green-100 shadow-sm">
                           <Coins className="h-6 w-6 text-green-500" />
                        </div>
                        <div className="flex-1 relative">
                          <select 
                              className="w-full pl-6 pr-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all"
                              value={project.batteries?.equipmentId || ''}
                              onChange={e => {
                                  const newId = e.target.value;
                                  const newProj = {...project, batteries: { equipmentId: newId, count: newId ? Math.max(1, project.batteries?.count || 1) : 0 }};
                                  setProject({...newProj, ...calculateFinancials(newProj)});
                              }}
                          >
                              <option value="">-- Không sử dụng lưu trữ --</option>
                              {batteries.map(b => <option key={b.id} value={b.id}>{b.brand} {b.model} ({b.capacity}kWh)</option>)}
                          </select>
                          <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none rotate-90" />
                        </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl shadow-slate-200 group">
                    <p className="text-[10px] uppercase opacity-40 font-black tracking-widest mb-2">Công suất đề xuất</p>
                    <div className="flex items-baseline gap-2 group-hover:scale-105 transition-transform origin-left">
                       <span className="text-4xl md:text-5xl font-black text-amber-400 tracking-tighter">{project.systemSizeKWp}</span>
                       <span className="text-sm font-black opacity-40 uppercase tracking-widest">kWp</span>
                    </div>
                  </div>

                  <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                    <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-4">Số lượng tấm pin mặt trời</p>
                    <div className="flex items-center justify-between">
                         <span className="text-2xl font-black text-slate-800 tracking-tight">{project.panels?.count} <small className="text-xs opacity-40">TẤM</small></span>
                         <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                const newProj = {...project, panels: {...project.panels!, count: Math.max(0, (project.panels?.count || 0) - 1)}};
                                setProject({...newProj, ...calculateFinancials(newProj)});
                              }} 
                              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                            >
                                <Minus className="h-4 w-4"/>
                            </button>
                            <button 
                              onClick={() => {
                                const newProj = {...project, panels: {...project.panels!, count: (project.panels?.count || 0) + 1}};
                                setProject({...newProj, ...calculateFinancials(newProj)});
                              }} 
                              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                            >
                                <Plus className="h-4 w-4"/>
                            </button>
                         </div>
                    </div>
                  </div>
                  
                  {project.batteries?.equipmentId && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100"
                    >
                        <p className="text-[10px] uppercase text-slate-400 font-black tracking-widest mb-4">Số lượng Module lưu trữ</p>
                        <div className="flex items-center justify-between">
                            <span className="text-2xl font-black text-slate-800 tracking-tight">{project.batteries?.count} <small className="text-xs opacity-40">BỘ</small></span>
                            <div className="flex gap-2">
                                <button 
                                  onClick={() => {
                                      const newProj = {...project, batteries: {...project.batteries!, count: Math.max(1, (project.batteries?.count || 1) - 1)}};
                                      setProject({...newProj, ...calculateFinancials(newProj)});
                                  }} 
                                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                                >
                                    <Minus className="h-4 w-4"/>
                                </button>
                                <button 
                                  onClick={() => {
                                      const newProj = {...project, batteries: {...project.batteries!, count: (project.batteries?.count || 1) + 1}};
                                      setProject({...newProj, ...calculateFinancials(newProj)});
                                  }} 
                                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-900 hover:text-white transition-all active:scale-95"
                                >
                                    <Plus className="h-4 w-4"/>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-6 md:p-10 rounded-[2.5rem] border border-slate-100 shadow-[0_10px_40px_rgb(0,0,0,0.03)] space-y-10"
            >
              <div>
                <h3 className="text-xl md:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none mb-3">Hiệu Quả Tài Chính</h3>
                <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest">Phân tích dòng tiền và thời gian hoàn vốn dự kiến</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100 group">
                   <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-3">Tổng giá trị đầu tư</p>
                   <p className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors uppercase">{formatCurrency(project.totalCost || 0)}</p>
                </div>
                <div className="p-8 bg-green-50 rounded-[2rem] border border-green-100 group">
                   <p className="text-[10px] text-green-600 uppercase font-black tracking-widest mb-3">Tiết kiệm / Năm</p>
                   <p className="text-2xl font-black text-green-900 group-hover:scale-105 transition-transform origin-left uppercase">{formatCurrency((project.annualProduction || 0) * 2500)}</p>
                </div>
                <div className="p-8 bg-amber-50 rounded-[2rem] border border-amber-100 group">
                   <p className="text-[10px] text-amber-600 uppercase font-black tracking-widest mb-3">Hoàn vốn (ROI)</p>
                   <p className="text-2xl font-black text-amber-900 group-hover:scale-105 transition-transform origin-left uppercase">~ {project.paybackYears} NĂM</p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 text-white relative overflow-hidden shadow-2xl">
                <div className="flex flex-col md:flex-row items-center justify-between mb-10 gap-4">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-[0.2em] text-blue-400">Dòng tiền lũy kế</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Dự phóng tăng trưởng trong 20 năm</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Lợi nhuận dương</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-red-500" />
                       <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Đang hoàn vốn</span>
                    </div>
                  </div>
                </div>

                <div className="h-64 relative z-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Array.from({length: 20}, (_, i) => ({
                        year: i + 1,
                        benefit: Math.round(((project.annualProduction || 0) * 2500 * (i + 1)) - (project.totalCost || 0))
                    }))}>
                        <XAxis 
                          dataKey="year" 
                          fontSize={10} 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: 'rgba(255,255,255,0.2)', fontWeight: 900}}
                        />
                        <YAxis hide />
                        <Tooltip 
                          cursor={{fill: 'rgba(255,255,255,0.05)'}} 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-white text-slate-900 text-[10px] px-3 py-2 rounded-xl shadow-2xl font-black uppercase border border-slate-100">
                                        Năm {payload[0].payload.year}: {formatCurrency(payload[0].value as number)}
                                    </div>
                                );
                            }
                            return null;
                        }} />
                        <Bar dataKey="benefit" radius={[4, 4, 0, 0]}>
                        {Array.from({length: 20}).map((_, i) => (
                            <Cell 
                              key={i} 
                              fill={((project.annualProduction || 0) * 2500 * (i + 1)) >= (project.totalCost || 0) ? '#10b981' : '#f43f5e'} 
                              fillOpacity={0.8}
                            />
                        ))}
                        </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Abstract Glass Element */}
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="bg-white p-8 md:p-12 rounded-[1rem] border border-slate-200 proposal-print relative shadow-sm break-after-page mb-8">
                {/* Header Section */}
                <div className="flex items-start gap-6 border-b border-slate-100 pb-8 mb-8">
                  <div className="w-24 h-24 shrink-0 flex items-center justify-center border border-slate-100 rounded-xl bg-white p-2">
                    <img src="https://lh3.googleusercontent.com/d/1vN7tAn7UoZ7rR7U7S-JtG0rY_iV7B56Q" alt="Trường Sơn Solar Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <h1 className="text-2xl font-bold text-slate-900">CÔNG TY CỔ PHẦN ĐẦU TƯ TM TRƯỜNG SƠN</h1>
                    <p className="text-sm text-slate-600">Địa chỉ: Số 151 Thôi Hữu, MB 1413, P. Đông Vệ, TP. Thanh Hóa</p>
                    <p className="text-sm text-slate-600">VP: 368 Nguyễn Thiếp (Đường 39m mới) - P. Đông Vệ - TP Thanh Hóa</p>
                  </div>
                </div>

                {/* Customer Info Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 mb-10 text-sm">
                  <div className="flex gap-2">
                    <span className="font-medium text-slate-500 shrink-0">Khách hàng:</span>
                    <span className="font-bold text-slate-900 border-b border-dashed border-slate-300 flex-1">{currentCustomer?.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-medium text-slate-500 shrink-0">Địa chỉ lắp đặt:</span>
                    <span className="font-bold text-slate-900 border-b border-dashed border-slate-300 flex-1">{currentCustomer?.address}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-medium text-slate-500 shrink-0">Số Điện Thoại:</span>
                    <span className="font-bold text-slate-900 border-b border-dashed border-slate-300 flex-1">{currentCustomer?.phone}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-medium text-slate-500 shrink-0">Ngày Báo Giá:</span>
                    <span className="font-bold text-slate-900 border-b border-dashed border-slate-300 flex-1">{new Date().toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>

                {/* Main Price Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-10 text-center mb-8 shadow-sm">
                   <p className="text-lg font-bold text-slate-600 mb-2">Tổng chi phí</p>
                   <p className="text-5xl font-black text-[#2e7d32] tracking-tight">{formatCurrency(project.totalCost || 0)} VND</p>
                   <p className="text-xs text-slate-400 mt-4 font-medium italic">Giá đã bao gồm VAT, bảo hiểm, bảo hành 30 năm</p>
                </div>

                {/* Technical Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-tight">Công suất lắp đặt khuyến nghị</p>
                    <p className="text-2xl font-black text-[#2e7d32]">{project.systemSizeKWp}Kwp</p>
                    <p className="text-xs text-slate-400 font-medium mt-1">Hệ hybrid(có pin lưu trữ)</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-sm font-bold text-slate-500 mb-2 uppercase tracking-tight">Lưu trữ (nếu có)</p>
                    <p className="text-2xl font-black text-[#2e7d32]">
                      {project.batteries?.equipmentId ? `${(batteries.find(b => b.id === project.batteries?.equipmentId)?.capacity || 0) * (project.batteries?.count || 1)}KWH` : 'KHÔNG'}
                    </p>
                  </div>
                </div>

                {/* Financial Row 1 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-tight">Thời gian thu hồi vốn</p>
                    <p className="text-xl font-black text-[#2e7d32]">
                      {Math.floor(project.paybackYears || 0)} năm {Math.round(((project.paybackYears || 0) % 1) * 12)} tháng
                    </p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-tight">Lợi nhuận đầu tư</p>
                    <p className="text-xl font-black text-[#2e7d32]">
                      {project.paybackYears ? Math.round(100 / project.paybackYears) : 0}%
                    </p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-tight">Diện tích mái cần để lắp</p>
                    <p className="text-xl font-black text-[#2e7d32]">{(project.systemSizeKWp || 0) * 5.45} m²</p>
                  </div>
                </div>

                {/* Savings Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-tight">Số tiền điện tiết kiệm sau 1 THÁNG</p>
                    <p className="text-lg font-black text-[#2e7d32]">{formatCurrency(Math.round(((project.annualProduction || 0) * 2500) / 12))} VND</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-tight">Số tiền điện tiết kiệm sau 12 THÁNG</p>
                    <p className="text-lg font-black text-[#2e7d32]">{formatCurrency(Math.round((project.annualProduction || 0) * 2500))} VND</p>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-tight">Số tiền điện tiết kiệm sau 30 NĂM</p>
                    <p className="text-lg font-black text-[#2e7d32]">{formatCurrency(Math.round((project.annualProduction || 0) * 2500 * 54.8))} VND</p>
                  </div>
                </div>

                {/* Footer Disclaimer */}
                <div className="flex gap-3 items-start border-t border-slate-100 pt-8 italic">
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-1.5 shrink-0" />
                   <p className="text-sm text-slate-700 leading-relaxed font-serif">
                     báo giá trên được tạo bởi công cụ AI - Trí tuệ nhân tạo được phát triển bởi đội ngũ kỹ sư của Trường Sơn Solar dựa trên dữ liệu sản lượng bức xạ tại địa điểm khách hàng cung cấp
                   </p>
                </div>
              </div>

              {/* Second Page: Formal Quote Table */}
              <div className="bg-white p-12 proposal-print relative shadow-sm border border-slate-200 min-h-[1050px]">
                <div className="text-center mb-12">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">BÁO GIÁ HỆ THỐNG ĐIỆN NĂNG LƯỢNG MẶT TRỜI</h2>
                  <div className="w-40 h-1 bg-slate-900 mx-auto mt-4" />
                </div>

                <div className="space-y-4 mb-12 text-lg font-serif">
                  <div className="flex border-b border-dotted border-slate-300 pb-1">
                    <span className="w-48 shrink-0">Khách hàng:</span>
                    <span className="font-bold">{currentCustomer?.name}</span>
                  </div>
                  <div className="flex border-b border-dotted border-slate-300 pb-1">
                    <span className="w-48 shrink-0">Địa chỉ lắp đặt:</span>
                    <span className="">{currentCustomer?.address}</span>
                  </div>
                  <div className="flex border-b border-dotted border-slate-300 pb-1">
                    <span className="w-48 shrink-0">Số Điện Thoại:</span>
                    <span className="">{currentCustomer?.phone}</span>
                  </div>
                  <div className="flex border-b border-dotted border-slate-300 pb-1">
                    <span className="w-48 shrink-0">Ngày Báo Giá:</span>
                    <span className="">{new Date().toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div className="flex border-b border-dotted border-slate-300 pb-1">
                    <span className="w-48 shrink-0">Công Suất DC (KWp):</span>
                    <span className="font-bold">{project.systemSizeKWp}</span>
                  </div>
                  <div className="flex border-b border-dotted border-slate-300 pb-1">
                    <span className="w-48 shrink-0">Công Suất AC (KW):</span>
                    <span className="font-bold">{project.systemSizeKWp}</span>
                  </div>
                </div>

                <table className="w-full border-collapse border border-slate-900 text-base">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-900 px-4 py-3 text-center w-16">STT</th>
                      <th className="border border-slate-900 px-6 py-3 text-left">Các hạng mục</th>
                      <th className="border border-slate-900 px-6 py-3 text-center">Giá (VNĐ)</th>
                      <th className="border border-slate-900 px-6 py-3 text-left">Ghi Chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-slate-900 px-4 py-4 text-center font-bold">A</td>
                      <td className="border border-slate-900 px-6 py-4 font-bold">Thiết bị chính</td>
                      <td className="border border-slate-900 px-6 py-4 text-right">
                        {formatCurrency((project.totalCost || 0) / 1.08 * 0.75)}
                      </td>
                      <td className="border border-slate-900 px-6 py-4 text-slate-500 italic">Pin & Inverter</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-900 px-4 py-4 text-center font-bold">B</td>
                      <td className="border border-slate-900 px-6 py-4 font-bold">Vật tư phụ và thi công</td>
                      <td className="border border-slate-900 px-6 py-4 text-right">
                        {formatCurrency((project.totalCost || 0) / 1.08 * 0.20)}
                      </td>
                      <td className="border border-slate-900 px-6 py-4 text-slate-500 italic">Khung nhôm & nhân công</td>
                    </tr>
                    <tr>
                      <td className="border border-slate-900 px-4 py-4 text-center font-bold">C</td>
                      <td className="border border- slate-900 px-6 py-4 font-bold">Vận chuyển và chi phí phụ khác</td>
                      <td className="border border-slate-900 px-6 py-4 text-right">
                        {formatCurrency((project.totalCost || 0) / 1.08 * 0.05)}
                      </td>
                      <td className="border border-slate-900 px-6 py-4 text-slate-500 italic">VC xây lắp</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td colSpan={2} className="border border-slate-900 px-6 py-4 font-bold">Tổng cộng (Chưa bao gồm VAT)</td>
                      <td className="border border-slate-900 px-6 py-4 text-right font-bold">
                        {formatCurrency((project.totalCost || 0) / 1.08)}
                      </td>
                      <td className="border border-slate-900 px-6 py-4"></td>
                    </tr>
                    <tr>
                      <td colSpan={2} className="border border-slate-900 px-6 py-4 font-bold">Thuế (8%)</td>
                      <td className="border border-slate-900 px-6 py-4 text-right font-bold">
                        {formatCurrency((project.totalCost || 0) - (project.totalCost || 0) / 1.08)}
                      </td>
                      <td className="border border-slate-900 px-6 py-4"></td>
                    </tr>
                    <tr className="bg-slate-100">
                      <td colSpan={2} className="border border-slate-900 px-6 py-4 font-black uppercase text-lg">Tổng tiền</td>
                      <td className="border border-slate-900 px-6 py-4 text-right font-black text-xl text-blue-700">
                        {formatCurrency(project.totalCost || 0)}
                      </td>
                      <td className="border border-slate-900 px-6 py-4"></td>
                    </tr>
                  </tbody>
                </table>

                <div className="mt-16 grid grid-cols-2 text-center font-serif">
                  <div className="space-y-24">
                    <p className="font-bold">ĐẠI DIỆN KHÁCH HÀNG</p>
                    <p className="text-slate-400 italic">(Ký và ghi rõ họ tên)</p>
                  </div>
                  <div className="space-y-24">
                    <p className="font-bold uppercase leading-tight">CÔNG TY CỔ PHẦN ĐẦU TƯ TM TRƯỜNG SƠN</p>
                    <p className="font-bold">{salesStaff.find(s => s.id === project.assignedSalesId)?.name || 'CHUYÊN VIÊN KỸ THUẬT'}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 no-print sm:justify-center">
                  <button 
                    onClick={() => {
                        window.focus();
                        window.print();
                    }}
                    className="flex-1 max-w-xs bg-slate-900 text-white rounded-[2rem] py-5 font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-slate-200 active:scale-95 transition-all mx-auto sm:mx-0"
                  >
                    <Download className="h-4 w-4" /> Xuất File In
                  </button>
                  <button 
                    onClick={handleSave}
                    className="flex-1 max-w-xs bg-white border border-slate-200 text-slate-900 rounded-[2rem] py-5 font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm active:scale-95 transition-all mx-auto sm:mx-0"
                  >
                    <Save className="h-4 w-4" /> Lưu Dự Án
                  </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Professional Sidebar Summary */}
        <div className="space-y-6 no-print hidden lg:block">
          <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-[0_10px_40px_rgb(0,0,0,0.02)] sticky top-24">
            <div className="mb-10">
                <h4 className="font-black text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-2">Lộ trình thiết kế</h4>
                <div className="h-1 w-12 bg-blue-600 rounded-full" />
            </div>

            <div className="space-y-4">
              {[
                { s: 1, label: 'Nhu cầu', sub: currentCustomer?.name || 'CHƯA CHỌN', icon: <User className="h-4 w-4" /> },
                { s: 2, label: 'Kỹ thuật', sub: `${project.systemSizeKWp} kWp`, icon: <Zap className="h-4 w-4" /> },
                { s: 3, label: 'Tài chính', sub: `${project.paybackYears} năm`, icon: <Coins className="h-4 w-4" /> },
                { s: 4, label: 'Văn bản', sub: 'Proposal', icon: <FileText className="h-4 w-4" /> },
              ].map(item => (
                <button
                  key={item.s}
                  onClick={() => setStep(item.s)}
                  className={cn(
                    "w-full group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300",
                    step === item.s 
                      ? "bg-slate-900 text-white shadow-2xl shadow-slate-200" 
                      : "bg-transparent text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-100"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                    step === item.s ? "bg-white/10" : "bg-slate-100 group-hover:bg-white"
                  )}>
                    {item.icon}
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{item.label}</p>
                    <p className={cn("text-[9px] font-bold uppercase tracking-tighter opacity-40 truncate max-w-[100px]", step === item.s && "opacity-60")}>
                        {item.sub}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-10 pt-10 border-t border-slate-50">
               <div className="flex items-center gap-4 opacity-40 grayscale group hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                  <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-slate-600" />
                  </div>
                  <p className="text-[8px] font-black uppercase tracking-widest leading-tight">
                    Powered by<br/><span className="text-[10px] text-blue-600">SE-CRM Engine</span>
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
