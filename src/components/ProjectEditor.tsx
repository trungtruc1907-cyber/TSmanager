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
  UserCheck
} from 'lucide-react';
import { cn, formatCurrency, estimateSystemSize, calculateSolarProduction, getAverageElectricityPrice } from '../lib/utils';
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
  onClose: () => void;
}

export default function ProjectEditor({ projectId, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalog, setCatalog] = useState<Equipment[]>([]);
  const [salesStaff, setSalesStaff] = useState<SalesPerson[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [project, setProject] = useState<Partial<Project>>({
    status: 'lead',
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
    <div className="max-w-5xl mx-auto pb-20 px-4 md:px-0">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center justify-between w-full md:w-auto">
            <button onClick={onClose} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors">
                <ArrowLeft className="h-5 w-5" /> <span className="hidden sm:inline">Quay lại</span>
            </button>
            <button 
                onClick={handleSave}
                className="md:hidden bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-blue-200 text-xs"
            >
                <Save className="h-4 w-4" /> Lưu
            </button>
        </div>
        
        <div className="flex items-center gap-1 md:gap-2">
            {[1, 2, 3, 4].map(s => (
                <div 
                    key={s} 
                    className={cn(
                        "h-1.5 w-8 md:h-2 md:w-12 rounded-full transition-all",
                        step >= s ? "bg-blue-600" : "bg-slate-200"
                    )} 
                />
            ))}
        </div>

        <button 
          onClick={handleSave}
          className="hidden md:flex bg-blue-600 text-white px-6 py-2 rounded-xl items-center gap-2 font-bold shadow-lg shadow-blue-200"
        >
          <Save className="h-4 w-4" /> Lưu Dự án
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {step === 1 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4 border-b pb-2">Thông tin & Chi phí điện năng</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Chọn khách hàng</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
                      value={project.customerId || ''}
                      onChange={e => setProject({...project, customerId: e.target.value})}
                    >
                      <option value="">-- Chọn khách hàng --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Địa chỉ lắp đặt</label>
                    <input 
                      type="text" 
                      readOnly
                      className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm text-slate-500" 
                      value={currentCustomer?.address || 'Chưa cập nhật'} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Sale phụ trách</label>
                    <select 
                      className="w-full bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
                      value={project.assignedSalesId || ''}
                      onChange={e => setProject({...project, assignedSalesId: e.target.value})}
                    >
                      <option value="">-- Chưa bàn giao --</option>
                      {salesStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 flex flex-col justify-center">
                  <label className="block text-xs font-semibold text-blue-700 mb-2 uppercase">Tiền điện trung bình/tháng (VND)</label>
                  <div className="flex items-end gap-2">
                    <input 
                      type="number"
                      className="bg-transparent border-b-2 border-blue-200 text-2xl md:text-3xl font-black text-blue-900 tracking-tight outline-none w-full"
                      value={project.monthlyBill || ''}
                      onChange={e => handleAutoConfig(Number(e.target.value))}
                    />
                    <span className="text-sm font-normal text-blue-400 italic shrink-0">đ/tháng</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-blue-200 flex flex-col gap-2 text-xs text-blue-600 font-medium">
                    <div className="flex justify-between items-center bg-white/50 p-2 rounded">
                        <span className="text-blue-400 uppercase font-bold text-[9px]">Loại điện:</span>
                        <span className="font-bold uppercase">
                            {currentCustomer?.usageType === 'residential' ? 'Sinh hoạt' : 
                             currentCustomer?.usageType === 'commercial' ? 'Kinh doanh' : 
                             currentCustomer?.usageType === 'industrial' ? 'Sản xuất' : 'N/A'} 
                            ({currentCustomer?.phaseType === '1phase' ? '1 Pha' : '3 Pha'})
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Giá điện tb:</span>
                        <span className="font-bold">~{getAverageElectricityPrice(project.monthlyBill || 0, currentCustomer?.usageType)} đ/kWh</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Sản lượng tiêu thụ tb:</span>
                        <span className="font-bold uppercase">~{Math.round((project.monthlyBill || 0) / getAverageElectricityPrice(project.monthlyBill || 0, currentCustomer?.usageType))} kWh</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4 border-b pb-2">Cấu hình Solar System</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase">Tấm pin (PV Panels)</label>
                    <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center shrink-0 text-lg">☀️</div>
                         <select 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
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
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase">Biến tần (Inverter)</label>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center shrink-0 text-lg">⚡</div>
                        <select 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
                            value={project.inverters?.equipmentId}
                            onChange={e => {
                                const newProj = {...project, inverters: {...project.inverters!, equipmentId: e.target.value}};
                                setProject({...newProj, ...calculateFinancials(newProj)});
                            }}
                        >
                            {inverters.map(i => <option key={i.id} value={i.id}>{i.brand} {i.model}</option>)}
                        </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase">Pin lưu trữ (Battery / ESS)</label>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center shrink-0 text-lg">🔋</div>
                        <select 
                            className="flex-1 bg-slate-50 border border-slate-200 rounded px-3 py-2 text-sm outline-none focus:border-blue-500"
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
                    </div>
                  </div>
                </div>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-2 lg:grid-cols-1">
                    <div className="p-4 bg-slate-900 rounded-xl text-white">
                      <p className="text-[10px] uppercase opacity-60 font-bold mb-1">Công suất lắp đặt</p>
                      <p className="text-2xl md:text-3xl font-bold text-amber-400">{project.systemSizeKWp} <span className="text-sm font-normal opacity-60">kWp</span></p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Số lượng tấm pin</p>
                      <div className="flex items-center justify-between">
                           <span className="text-lg md:text-xl font-bold text-slate-800">{project.panels?.count} Tấm</span>
                           <div className="flex gap-1">
                              <button onClick={() => {
                                  const newProj = {...project, panels: {...project.panels!, count: Math.max(0, (project.panels?.count || 0) - 1)}};
                                  setProject({...newProj, ...calculateFinancials(newProj)});
                              }} className="w-6 h-6 flex items-center justify-center rounded bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50"><Minus className="h-3 w-3"/></button>
                              <button onClick={() => {
                                  const newProj = {...project, panels: {...project.panels!, count: (project.panels?.count || 0) + 1}};
                                  setProject({...newProj, ...calculateFinancials(newProj)});
                              }} className="w-6 h-6 flex items-center justify-center rounded bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50"><Plus className="h-3 w-3"/></button>
                           </div>
                      </div>
                    </div>
                    
                    {project.batteries?.equipmentId && (
                      <div className="col-span-2 md:col-span-1 p-4 bg-slate-50 rounded-xl border border-slate-100 animate-in fade-in slide-in-from-top-2">
                          <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Số lượng bộ lưu trữ</p>
                          <div className="flex items-center justify-between">
                              <span className="text-lg md:text-xl font-bold text-slate-800">{project.batteries?.count} Bộ</span>
                              <div className="flex gap-1">
                                  <button onClick={() => {
                                      const newProj = {...project, batteries: {...project.batteries!, count: Math.max(1, (project.batteries?.count || 1) - 1)}};
                                      setProject({...newProj, ...calculateFinancials(newProj)});
                                  }} className="w-6 h-6 flex items-center justify-center rounded bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50"><Minus className="h-3 w-3"/></button>
                                  <button onClick={() => {
                                      const newProj = {...project, batteries: {...project.batteries!, count: (project.batteries?.count || 1) + 1}};
                                      setProject({...newProj, ...calculateFinancials(newProj)});
                                  }} className="w-6 h-6 flex items-center justify-center rounded bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50"><Plus className="h-3 w-3"/></button>
                              </div>
                          </div>
                      </div>
                    )}
                  </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in slide-in-from-right-4 duration-300">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-4 border-b pb-2">Phân tích Phương án Đầu tư</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                   <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Tổng mức đầu tư</p>
                   <p className="text-lg font-bold text-slate-900">{formatCurrency(project.totalCost || 0)}</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                   <p className="text-[10px] text-green-700 uppercase font-bold mb-1">Tiết kiệm hàng năm</p>
                   <p className="text-lg font-bold text-green-900">{formatCurrency((project.annualProduction || 0) * 2500)}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                   <p className="text-[10px] text-amber-700 uppercase font-bold mb-1">Hoàn vốn dự kiến</p>
                   <p className="text-lg font-bold text-amber-900">{project.paybackYears} Năm</p>
                </div>
              </div>

              <div className="h-48 mt-4 bg-slate-50/50 rounded-xl p-4 border border-slate-100">
                <p className="text-[10px] uppercase text-slate-400 font-bold mb-4">Biểu đồ dòng tiền lũy kế (20 năm)</p>
                <div className="h-[calc(100%-20px)]">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={Array.from({length: 20}, (_, i) => ({
                        year: i + 1,
                        benefit: Math.round(((project.annualProduction || 0) * 2500 * (i + 1)) - (project.totalCost || 0))
                    }))}>
                        <XAxis dataKey="year" fontSize={8} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip cursor={{fill: '#f1f5f9'}} content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-xl">
                                        Năm {payload[0].payload.year}: {formatCurrency(payload[0].value as number)}
                                    </div>
                                );
                            }
                            return null;
                        }} />
                        <Bar dataKey="benefit">
                        {Array.from({length: 20}).map((_, i) => (
                            <Cell key={i} fill={((project.annualProduction || 0) * 2500 * (i + 1)) >= (project.totalCost || 0) ? '#10b981' : '#f43f5e'} />
                        ))}
                        </Bar>
                    </BarChart>
                    </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="proposal-container bg-white rounded-xl shadow-2xl p-0 overflow-hidden animate-in fade-in zoom-in duration-500 border border-slate-200">
               {/* Proposal Header */}
               <div className="bg-slate-900 p-4 md:p-8 text-white flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl flex flex-col items-center justify-center shadow-lg border border-blue-500/30 shrink-0">
                        <span className="text-lg md:text-xl font-black text-red-600 leading-none">TS</span>
                        <span className="text-[4px] md:text-[5px] font-bold text-blue-600 uppercase tracking-tighter">TRƯỜNG SƠN</span>
                    </div>
                    <div>
                      <div className="text-lg md:text-xl font-black text-white tracking-tight">TRUONGSONSOLAR</div>
                      <p className="text-blue-400 text-[9px] md:text-[10px] uppercase tracking-widest font-bold">Proposal: #TS-{Math.random().toString(36).substring(7).toUpperCase()}</p>
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-[10px] md:text-xs font-bold uppercase tracking-wide">TRƯỜNG SƠN SOLAR</p>
                    <p className="text-[9px] md:text-[10px] text-slate-400">truongsonsolar.vn</p>
                  </div>
               </div>

               <div className="p-4 md:p-8">
                  <div className="mb-6 md:mb-8">
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight uppercase border-b-4 border-blue-600 inline-block pb-2 mb-4">Báo giá Dự án</h2>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2 text-wrap break-words overflow-hidden">
                        <div>
                            <p className="text-[10px] md:text-xs text-slate-500 font-semibold uppercase">Khách hàng</p>
                            <p className="text-base md:text-lg font-bold text-slate-800">{currentCustomer?.name}</p>
                            <p className="text-[10px] md:text-[11px] text-slate-500">{currentCustomer?.address}</p>
                        </div>
                        <div className="text-left md:text-right shrink-0">
                            <p className="text-[10px] md:text-xs text-slate-500 font-semibold uppercase">Ngày báo giá</p>
                            <p className="text-xs md:text-sm font-bold text-slate-800">{new Date().toLocaleDateString('vi-VN')}</p>
                        </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-8 md:mb-10">
                    <div className="space-y-4">
                        <h4 className="text-[10px] md:text-[11px] font-bold text-red-600 uppercase tracking-wider mb-2">Cấu hình Hệ thống</h4>
                        <div className="space-y-2 md:space-y-3 font-medium">
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="text-lg">☀️</div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-800 uppercase leading-none mb-1">Tấm pin PV</p>
                                    <p className="text-[10px] md:text-[11px] text-slate-500 leading-tight">
                                      {project.panels?.count}x {catalog.find(e => e.id === project.panels?.equipmentId)?.brand || 'N/A'} {catalog.find(e => e.id === project.panels?.equipmentId)?.model || ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="text-lg">⚡</div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-800 uppercase leading-none mb-1">Inverter</p>
                                    <p className="text-[10px] md:text-[11px] text-slate-500 leading-tight">
                                      {catalog.find(e => e.id === project.inverters?.equipmentId)?.brand || 'N/A'} {catalog.find(e => e.id === project.inverters?.equipmentId)?.model || ''}
                                    </p>
                                </div>
                            </div>
                            {project.batteries?.equipmentId && (
                                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 transition-all font-medium">
                                    <div className="text-lg">🔋</div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-800 uppercase leading-none mb-1">Pin lưu trữ</p>
                                        <p className="text-[10px] md:text-[11px] text-slate-500 leading-tight">
                                          {project.batteries.count}x {catalog.find(e => e.id === project.batteries?.equipmentId)?.brand || 'N/A'} {catalog.find(e => e.id === project.batteries?.equipmentId)?.model || ''}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h4 className="text-[10px] md:text-[11px] font-bold text-red-600 uppercase tracking-wider mb-2">Hiệu quả vận hành</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                                <p className="text-[8px] md:text-[9px] font-bold text-blue-600 uppercase">Công suất</p>
                                <p className="text-base md:text-lg font-black text-blue-800">{project.systemSizeKWp} kWp</p>
                            </div>
                            <div className="p-3 bg-green-50 border border-green-100 rounded-lg">
                                <p className="text-[8px] md:text-[9px] font-bold text-green-600 uppercase">Tiết kiệm/Năm</p>
                                <p className="text-[11px] md:text-sm font-black text-green-800">{formatCurrency((project.annualProduction || 0) * getAverageElectricityPrice(project.monthlyBill || 0, currentCustomer?.usageType))}</p>
                            </div>
                        </div>
                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center justify-between">
                            <div>
                                <p className="text-[8px] md:text-[9px] font-bold text-blue-600 uppercase">Hoàn vốn</p>
                                <p className="text-base md:text-lg font-black text-blue-800">{project.paybackYears} Năm</p>
                            </div>
                            <Clock className="text-blue-500 h-5 w-5 md:h-6 md:w-6 opacity-40 shrink-0" />
                        </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-white p-4 md:p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg border-b-4 border-red-600">
                    <div className="text-center md:text-left">
                        <p className="text-slate-400 text-[8px] md:text-[10px] uppercase font-bold tracking-widest mb-1">Tổng giá trị đầu tư Trọn gói</p>
                        <p className="text-2xl md:text-3xl font-black text-white">{formatCurrency(project.totalCost || 0)}</p>
                    </div>
                    <div className="text-[8px] md:text-[10px] text-blue-400 font-bold border border-blue-400/30 px-3 py-1 rounded uppercase">
                        Bao gồm VAT & thi công
                    </div>
                  </div>
               </div>
               
               <div className="px-8 pb-8 flex justify-between text-[10px] text-slate-400">
                  <p>* Báo giá có giá trị trong vòng 15 ngày kể từ ngày ban hành.</p>
                  <p>Phụ trách kinh doanh: {salesStaff.find(s => s.id === project.assignedSalesId)?.name || 'Admin User'}</p>
               </div>
            </div>
          )}
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6 no-print">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm sticky top-6">
            <h4 className="font-bold text-xs uppercase tracking-widest text-slate-400 mb-6 border-b pb-4">
                Các bước thiết kế
            </h4>
            <div className="space-y-2">
              {[
                { s: 1, label: 'Thông tin & Nhu cầu', sub: currentCustomer?.name },
                { s: 2, label: 'Cấu hình Kỹ thuật', sub: `${project.systemSizeKWp} kWp` },
                { s: 3, label: 'Phân tích Tài chính', sub: `${project.paybackYears} năm` },
                { s: 4, label: 'Xuất văn bản Proposal', sub: 'PDF / Preview' },
              ].map(item => (
                <button
                  key={item.s}
                  onClick={() => setStep(item.s)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-md transition-all text-sm",
                    step === item.s ? "bg-slate-800 text-white shadow-md" : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                  )}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-bold opacity-60 uppercase tracking-tighter">BƯỚC 0{item.s}</span>
                    {step > item.s && <ShieldCheck className="h-3 w-3 text-green-500" />}
                  </div>
                  <div className="font-bold truncate">{item.label}</div>
                </button>
              ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
              {step < 4 ? (
                <button 
                  onClick={() => setStep(prev => prev + 1)}
                  className="w-full py-3 bg-blue-600 text-white rounded-md font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95 shadow-md"
                >
                  Giai đoạn tiếp theo <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button 
                  onClick={() => {
                    window.focus();
                    window.print();
                  }}
                  className="w-full py-3 bg-slate-900 text-white rounded-md font-bold text-sm flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-95 shadow-md shadow-slate-200"
                >
                  <FileText className="h-4 w-4 text-amber-400" /> In Proposal (PDF)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
