import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, getDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Project, Customer, Equipment, ProjectStatus, AppUser, UserRole } from '../types';
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
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { cn, formatCurrency, estimateSystemSize, calculateSolarProduction, getAverageElectricityPrice } from '../lib/utils';
import { motion } from 'motion/react';
import { Logo } from './Logo';
import * as XLSX from 'xlsx';
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
  userRole?: UserRole;
  userId?: string;
  onClose: () => void;
}

export default function ProjectEditor({ projectId, initialCustomerId, userRole, userId, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [catalog, setCatalog] = useState<Equipment[]>([]);
  const [salesStaff, setSalesStaff] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [project, setProject] = useState<Partial<Project>>({
    status: 'lead',
    customerId: initialCustomerId || '',
    monthlyBill: 0,
    systemSizeKWp: 0,
    progress: 0,
    panels: { equipmentId: '', count: 0 },
    inverters: { equipmentId: '', count: 0 },
    totalCost: 0,
    annualProduction: 0,
    paybackYears: 0,
    assignedSalesId: userRole === 'sales_rep' ? userId : ''
  });

  useEffect(() => {
    onSnapshot(collection(db, 'customers'), (s) => setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() } as Customer))), (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });
    onSnapshot(collection(db, 'equipment'), (s) => setCatalog(s.docs.map(d => ({ id: d.id, ...d.data() } as Equipment))), (error) => {
      handleFirestoreError(error, OperationType.GET, 'equipment');
    });
    onSnapshot(query(collection(db, 'users'), orderBy('displayName')), (s) => setSalesStaff(s.docs.map(d => ({ id: d.id, ...d.data() } as AppUser))), (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
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
    const inverterCount = 1;
    
    const baseProject = {
      ...project,
      monthlyBill: bill,
      systemSizeKWp: size,
      panels: { equipmentId: selectedPanel.id, count: panelCount },
      inverters: { equipmentId: selectedInverter.id, count: 1 },
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

  const exportToExcel = () => {
    if (!currentCustomer) return;

    const data = [
      ['CÔNG TY CỔ PHẦN ĐẦU TƯ TM TRƯỜNG SƠN'],
      ['Địa chỉ: Số 151 Thôi Hữu, MB 1413, P. Đông Vệ, TP. Thanh Hóa'],
      ['VP: 368 Nguyễn Thiếp (Đường 39m mới) - P. Đông Vệ - TP Thanh Hóa'],
      ['Website: www.truongsonsolar.vn'],
      [''],
      ['BÁO GIÁ HỆ THỐNG ĐIỆN NĂNG LƯỢNG MẶT TRỜI'],
      ['Số: BG-' + new Date().getTime().toString().slice(-6)],
      ['Ngày báo giá:', new Date().toLocaleDateString('vi-VN')],
      [''],
      ['THÔNG TIN KHÁCH HÀNG'],
      ['Khách hàng:', currentCustomer.name],
      ['Địa chỉ lắp đặt:', currentCustomer.address],
      ['Số điện thoại:', currentCustomer.phone],
      [''],
      ['THÔNG SỐ KỸ THUẬT HỆ THỐNG'],
      ['Công suất thiết kế:', `${project.systemSizeKWp} kWp`],
      ['Hóa đơn điện trung bình:', formatCurrency(project.monthlyBill || 0)],
      ['Sản lượng dự kiến/năm:', `${Math.round(project.annualProduction || 0)} kWh`],
      [''],
      ['DANH MỤC THIẾT BỊ & CHI PHÍ'],
      ['STT', 'Hạng mục', 'Mô tả chi tiết', 'Thương hiệu', 'Thông số', 'Số lượng', 'Đơn vị', 'Đơn giá', 'Thành tiền'],
    ];

    let stt = 1;

    // PV Panels
    if (project.panels?.equipmentId) {
      const item = catalog.find(e => e.id === project.panels!.equipmentId);
      if (item) {
        data.push([
          stt++,
          `Tấm pin NLMT ${item.brand}`,
          'Hiệu suất cao, công nghệ N-type Topcon mới nhất',
          item.brand,
          `${item.capacity}W`,
          project.panels!.count,
          'Tấm',
          item.unitPrice,
          item.unitPrice * project.panels!.count
        ]);
      }
    }

    // Inverter
    if (project.inverters?.equipmentId) {
      const item = catalog.find(e => e.id === project.inverters!.equipmentId);
      if (item) {
        data.push([
          stt++,
          `Biến tần (Inverter) ${item.brand}`,
          'Sóng sin chuẩn, hỗ trợ giám sát Cloud/Wifi',
          item.brand,
          `${item.capacity}KW`,
          project.inverters!.count,
          'Bộ',
          item.unitPrice,
          item.unitPrice * project.inverters!.count
        ]);
      }
    }

    // Battery
    if (project.batteries?.equipmentId) {
      const item = catalog.find(e => e.id === project.batteries!.equipmentId);
      if (item) {
        data.push([
          stt++,
          `Pin lưu trữ (Battery) ${item.brand}`,
          'Lithium LiFePO4 an toàn, tuổi thọ cao',
          item.brand,
          `${item.capacity}KWH`,
          project.batteries!.count,
          'Bộ',
          item.unitPrice,
          item.unitPrice * project.batteries!.count
        ]);
      }
    }

    // Materials
    data.push([stt++, 'Hệ thống khung giàn', 'Nhôm định hình chuyên dụng anode', 'VN', 'Standard', 1, 'Hệ', '', '']);
    data.push([stt++, 'Vật tư điện & Cáp Solar', 'Cáp DC 4mm2, Tủ điện bảo vệ AC/DC', 'Cadisun', 'Standard', 1, 'Gói', '', '']);
    data.push([stt++, 'Vận chuyển & Thi công', 'Lắp đặt đưa vào sử dụng', '', '', 1, 'Gói', '', '']);

    data.push(['']);
    data.push(['', '', '', '', '', '', '', 'TỔNG CỘNG (Đã VAT):', project.totalCost || 0]);
    data.push(['']);
    data.push(['PHÂN TÍCH HIỆU QUẢ KINH TẾ']);
    data.push(['Dòng tiền tiết kiệm/năm:', formatCurrency((project.annualProduction || 0) * 2500)]);
    data.push(['Thời gian hoàn vốn:', `${project.paybackYears} năm`]);
    data.push(['ROI dự kiến:', `${project.paybackYears ? Math.round(100 / project.paybackYears) : 0}%/năm`]);
    data.push(['']);
    data.push(['GHI CHÚ & ĐIỀU KIỆN']);
    data.push(['- Báo giá đã bao gồm vận chuyển và lắp đặt']);
    data.push(['- Tiến độ: 10 ngày từ ngày đặt cọc']);
    data.push(['- Thanh toán: 40% (Ký HĐ) - 30% (Thiết bị về) - 30% (Nghiệm thu)']);
    data.push(['- Bảo hành theo tiêu chuẩn nhà sản xuất (15-25 năm tấm pin)']);

    const ws = XLSX.utils.aoa_to_sheet(data);
    
    // Auto-width for columns
    const wscols = [
      {wch: 5}, {wch: 30}, {wch: 48}, {wch: 15}, {wch: 12}, {wch: 10}, {wch: 8}, {wch: 15}, {wch: 15}
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Quotation");
    XLSX.writeFile(wb, `BaoGia_SolarTruongSon_${currentCustomer.name.replace(/\s+/g, '_')}.xlsx`);
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
                        disabled={userRole === 'sales_rep'}
                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 appearance-none transition-all disabled:opacity-50"
                        value={project.assignedSalesId || ''}
                        onChange={e => setProject({...project, assignedSalesId: e.target.value})}
                      >
                        <option value="">-- Chọn nhân sự phụ trách --</option>
                        {userRole === 'sales_rep' && userId ? (
                          <option value={userId}>CHÍNH TÔI</option>
                        ) : (
                          salesStaff
                            .filter(u => u.status === 'active' && (u.role === 'sales_rep' || u.role === 'manager' || u.role === 'admin'))
                            .map(s => <option key={s.id} value={s.id}>{s.displayName.toUpperCase()}</option>)
                        )}
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
                                  const newProj = {...project, inverters: { equipmentId: e.target.value, count: 1 }};
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
              className="space-y-12"
            >
              <div className="proposal-container flex flex-col gap-10">
                {/* PAGE 1: COVER PAGE */}
                <div className="bg-white proposal-print shadow-sm break-after-page min-h-[1050px] flex flex-col relative overflow-hidden font-display">
                  {/* Modern Background Accents */}
                  <div className="absolute top-0 right-0 w-2/3 h-full bg-slate-50/50 -skew-x-12 translate-x-1/4 z-0" />
                  <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/5 rounded-full blur-[120px]" />
                  <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-600/5 rounded-full blur-[120px]" />
                  
                  <div className="relative z-10 p-16 md:p-24 flex flex-col h-full flex-1">
                    <div className="flex justify-between items-start mb-32">
                      <Logo className="w-40 h-40" />
                      <div className="text-right">
                        <h1 className="text-2xl font-extrabold text-slate-950 leading-tight uppercase tracking-tight">CÔNG TY CỔ PHẦN ĐẦU TƯ<br/> THƯƠNG MẠI TRƯỜNG SƠN</h1>
                        <p className="text-[11px] font-black text-blue-600 uppercase tracking-[0.3em] mt-3">Giải pháp Năng lượng Xanh chuyên nghiệp</p>
                        <div className="h-1 w-24 bg-blue-600 ml-auto mt-4" />
                      </div>
                    </div>

                    <div className="mt-auto mb-auto max-w-3xl">
                      <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-900 rounded-full mb-8">
                        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Hồ sơ giải pháp kỹ thuật • 2026</span>
                      </div>
                      
                      <h3 className="text-7xl font-extrabold text-slate-950 leading-[0.95] mb-10 tracking-tighter">
                        BÁO GIÁ HỆ THỐNG<br/>
                        ĐIỆN NĂNG LƯỢNG<br/>
                        MẶT TRỜI <span className="text-blue-600">HYBRID</span>
                      </h3>
                      
                      <div className="flex items-center gap-6 mb-16">
                         <div className="h-px flex-1 bg-slate-200" />
                         <Sun className="h-6 w-6 text-amber-500" />
                         <div className="h-px flex-1 bg-slate-200" />
                      </div>

                      <div className="grid grid-cols-2 gap-16">
                        <div className="space-y-5">
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Khách hàng / Chủ đầu tư</p>
                          <div className="border-l-[6px] border-slate-950 pl-6">
                            <p className="text-3xl font-extrabold text-slate-950 uppercase tracking-tight">{currentCustomer?.name}</p>
                            <p className="text-sm font-medium text-slate-500 mt-1">{currentCustomer?.address}</p>
                          </div>
                        </div>
                        <div className="space-y-5">
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Quy mô hệ thống</p>
                          <div className="border-l-[6px] border-blue-600 pl-6">
                            <p className="text-3xl font-extrabold text-slate-950 tracking-tight">{project.systemSizeKWp} kWp</p>
                            <p className="text-sm font-medium text-slate-500 mt-1">Lưu trữ Lithium thông minh</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-12 border-t border-slate-100 flex justify-between items-end">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 text-slate-600 font-bold text-sm">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-blue-600">
                             <MapPin className="h-4 w-4" />
                          </div>
                          <span>Thanh Hóa, Việt Nam</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600 font-bold text-sm">
                          <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-blue-600">
                             <Calendar className="h-4 w-4" />
                          </div>
                          <span>Ngày lập: {new Date().toLocaleDateString('vi-VN')}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2">TRƯỜNG SƠN SOLAR</p>
                        <p className="text-lg font-extrabold text-slate-950 tracking-tight">www.truongsonsolar.vn</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 italic">Professional Clean Energy Solutions</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Large Stylized Logo Background */}
                  <div className="absolute bottom-0 right-0 w-3/4 h-3/4 opacity-[0.04] grayscale pointer-events-none -mb-32 -mr-32 rotate-12">
                    <Logo className="w-full h-full" />
                  </div>
                </div>

                {/* PAGE 2: SUMMARY & HIGHLIGHTS */}
                <div className="bg-white p-8 md:p-12 proposal-print shadow-sm break-after-page min-h-[1050px]">
                  <div className="flex items-center gap-4 mb-12">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                      <Zap className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Tổ hợp giải pháp</h4>
                      <h3 className="text-2xl font-black text-slate-900 uppercase">Tổng quan kỹ thuật & Tài chính</h3>
                    </div>
                  </div>

                  <div className="bg-slate-900 rounded-[2.5rem] p-12 text-center mb-10 shadow-2xl relative overflow-hidden group">
                     <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent pointer-events-none" />
                     <p className="text-sm font-black text-blue-400 uppercase tracking-[0.3em] mb-4 relative z-10">Tổng giá trị đầu tư trọn gói</p>
                     <p className="text-6xl font-black text-white tracking-tighter relative z-10">{formatCurrency(project.totalCost || 0)} <span className="text-xl opacity-40">VNĐ</span></p>
                     <p className="text-xs text-slate-400 mt-6 font-medium italic relative z-10 opacity-60">* Giá đã bao gồm VAT, vận chuyển, thi công và các chi phí liên quan</p>
                  </div>

                  <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Hiệu suất vận hành</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-slate-900">{project.systemSizeKWp}</span>
                        <span className="text-sm font-bold text-slate-400 uppercase">kWp</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 font-medium">Hệ thống Hybrid đa tầng</p>
                    </div>
                    <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Lưu trữ dự phòng</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-slate-900">
                          {project.batteries?.equipmentId ? `${(batteries.find(b => b.id === project.batteries?.equipmentId)?.capacity || 0) * (project.batteries?.count || 1)}` : '0'}
                        </span>
                        <span className="text-sm font-bold text-slate-400 uppercase">kWh</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 font-medium">Pin Lithium LiFePO4</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 mb-12">
                    <div className="bg-white border-2 border-slate-50 rounded-2xl p-6 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Hoàn vốn</p>
                      <p className="text-lg font-black text-slate-900">~ {project.paybackYears} Năm</p>
                    </div>
                    <div className="bg-white border-2 border-slate-50 rounded-2xl p-6 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">ROI</p>
                      <p className="text-lg font-black text-green-600">{project.paybackYears ? Math.round(100 / project.paybackYears) : 0}%</p>
                    </div>
                    <div className="bg-white border-2 border-slate-50 rounded-2xl p-6 text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Tiết kiệm/tháng</p>
                      <p className="text-lg font-black text-blue-600">{formatCurrency(Math.round(((project.annualProduction || 0) * 2500) / 12))}</p>
                    </div>
                  </div>

                  <div className="space-y-6 mb-10">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest border-l-4 border-blue-600 pl-4">Phân tích giá trị tích lũy</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 p-6 rounded-2xl flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-500">Tiết kiệm sau 12 tháng:</span>
                        <span className="text-md font-black text-slate-900">{formatCurrency(Math.round((project.annualProduction || 0) * 2500))}</span>
                      </div>
                      <div className="bg-slate-50 p-6 rounded-2xl flex justify-between items-center border-2 border-slate-900/5">
                        <span className="text-xs font-bold text-slate-500">Tiết kiệm sau 30 năm (Dự kiến):</span>
                        <span className="text-md font-black text-blue-700">{formatCurrency(Math.round((project.annualProduction || 0) * 2500 * 54.8))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Disclaimer */}
                  <div className="mt-auto flex gap-4 items-start border-t border-slate-100 pt-8 italic grayscale opacity-40">
                     <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <Logo className="w-6 h-6" />
                     </div>
                     <p className="text-[10px] text-slate-500 leading-relaxed font-sans font-medium">
                       Báo giá trên được tạo bởi hệ thống quản lý thông minh TRƯỜNG SƠN SOLAR dựa trên các tham số kỹ thuật chuẩn hóa. 
                       Cam kết chất lượng thiết bị chính hãng và dịch vụ hậu mãi chu đáo.
                     </p>
                  </div>
                </div>

                {/* PAGE 3: FORMAL QUOTATION TABLE */}
                <div className="bg-white p-12 proposal-print relative shadow-sm border border-slate-200 min-h-[1050px] break-after-page flex flex-col">
                  <div className="text-center mb-12">
                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">PHỤ LỤC CHI PHÍ CHI TIẾT</h2>
                    <div className="w-24 h-1 bg-blue-600 mx-auto mt-4" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 mb-10 text-sm font-sans">
                    <div className="flex border-b border-dotted border-slate-300 pb-1">
                      <span className="w-40 shrink-0 text-slate-400 font-bold uppercase text-[9px] tracking-widest">Khách hàng</span>
                      <span className="font-bold text-slate-900">{currentCustomer?.name}</span>
                    </div>
                    <div className="flex border-b border-dotted border-slate-300 pb-1">
                      <span className="w-40 shrink-0 text-slate-400 font-bold uppercase text-[9px] tracking-widest">Ngày lập</span>
                      <span className="font-bold text-slate-900">{new Date().toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div className="flex border-b border-dotted border-slate-300 pb-1">
                      <span className="w-40 shrink-0 text-slate-400 font-bold uppercase text-[9px] tracking-widest">Hệ thống</span>
                      <span className="font-bold text-slate-900">{project.systemSizeKWp} kWp Hybrid</span>
                    </div>
                    <div className="flex border-b border-dotted border-slate-300 pb-1">
                      <span className="w-40 shrink-0 text-slate-400 font-bold uppercase text-[9px] tracking-widest">Thanh toán</span>
                      <span className="font-bold text-slate-600">Tiền mặt / Chuyển khoản</span>
                    </div>
                  </div>

                  <table className="w-full border-collapse border-b border-slate-200 text-sm mb-12">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="px-4 py-4 text-center w-16 uppercase text-[10px] tracking-widest">STT</th>
                        <th className="px-6 py-4 text-left uppercase text-[10px] tracking-widest">Các hạng mục giải pháp</th>
                        <th className="px-6 py-4 text-right uppercase text-[10px] tracking-widest">Giá trị (VNĐ)</th>
                        <th className="px-6 py-4 text-left uppercase text-[10px] tracking-widest">Ghi Chú</th>
                      </tr>
                    </thead>
                    <tbody className="font-sans">
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-5 text-center font-bold text-slate-400 italic">01</td>
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">Gói thiết bị chính (Standard/Premium)</p>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">Pin năng lượng mặt trời & Inverter Hybrid & Pin Lithium</p>
                        </td>
                        <td className="px-6 py-5 text-right font-bold text-slate-900">
                          {formatCurrency((project.totalCost || 0) / 1.08 * 0.75)}
                        </td>
                        <td className="px-6 py-5 text-xs text-slate-500 italic">Theo Catalog</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-5 text-center font-bold text-slate-400 italic">02</td>
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">Hệ thống khung đỡ & Vật tư điện</p>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">Nhôm định hình, Tủ điện bảo vệ, Cáp DC/AC chuyên dụng</p>
                        </td>
                        <td className="px-6 py-5 text-right font-bold text-slate-900">
                          {formatCurrency((project.totalCost || 0) / 1.08 * 0.20)}
                        </td>
                        <td className="px-6 py-5 text-xs text-slate-500 italic">Trọn gói</td>
                      </tr>
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-5 text-center font-bold text-slate-400 italic">03</td>
                        <td className="px-6 py-5">
                          <p className="font-bold text-slate-900">Vận chuyển & Nhân công lắp đặt</p>
                          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">Nhân sự kỹ thuật cao, Kiểm định và Test vận hành</p>
                        </td>
                        <td className="px-6 py-5 text-right font-bold text-slate-900">
                          {formatCurrency((project.totalCost || 0) / 1.08 * 0.05)}
                        </td>
                        <td className="px-6 py-5 text-xs text-slate-500 italic">Trọn gói</td>
                      </tr>
                      <tr className="bg-slate-50/50">
                        <td colSpan={2} className="px-6 py-6 font-bold text-slate-500 text-right uppercase text-[10px] tracking-widest">Tổng cộng (Chưa VAT)</td>
                        <td className="px-6 py-6 text-right font-bold text-slate-900">
                          {formatCurrency((project.totalCost || 0) / 1.08)}
                        </td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={2} className="px-6 py-4 font-bold text-slate-400 text-right uppercase text-[10px] tracking-widest">Thuế giá trị gia tăng (8%)</td>
                        <td className="px-6 py-4 text-right font-bold text-slate-600">
                          {formatCurrency((project.totalCost || 0) - (project.totalCost || 0) / 1.08)}
                        </td>
                        <td></td>
                      </tr>
                      <tr className="bg-blue-600 text-white">
                        <td colSpan={2} className="px-6 py-8 font-black uppercase text-lg tracking-tight">TỔNG GIÁ TRỊ HỢP ĐỒNG (VNĐ)</td>
                        <td className="px-6 py-8 text-right font-black text-2xl">
                          {formatCurrency(project.totalCost || 0)}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="grid grid-cols-2 gap-10 mt-auto">
                    <div className="space-y-4">
                      <p className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-900 pb-2">Điều khoản thanh toán</p>
                      <ul className="text-xs space-y-2 text-slate-600 font-sans">
                        <li className="flex justify-between"><span>• Tạm ứng ngay khi ký HĐ (40%):</span> <span className="font-bold">{formatCurrency((project.totalCost || 0) * 0.4)}</span></li>
                        <li className="flex justify-between"><span>• Khi thiết bị về công trình (30%):</span> <span className="font-bold">{formatCurrency((project.totalCost || 0) * 0.3)}</span></li>
                        <li className="flex justify-between"><span>• Khi nghiệm thu bàn giao (30%):</span> <span className="font-bold">{formatCurrency((project.totalCost || 0) * 0.3)}</span></li>
                      </ul>
                    </div>
                    <div className="space-y-4">
                      <p className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-900 pb-2">Cam kết kỹ thuật</p>
                      <ul className="text-xs space-y-2 text-slate-600 font-sans">
                        <li>• Tiến độ: Hoàn thành trong vòng 10 ngày.</li>
                        <li>• Bảo hành: Theo tiêu chuẩn NSX (15-25 năm Pin).</li>
                        <li>• Chất lượng: Đầy đủ chứng nhận COCQ chính hãng.</li>
                        <li>• Hỗ trợ: Kỹ thuật 24/7 qua Hotline/Zalo.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-16 grid grid-cols-2 text-center font-sans">
                    <div className="space-y-20">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đại diện khách hàng</p>
                      <p className="font-bold text-slate-300 italic text-sm">..................................................</p>
                    </div>
                    <div className="space-y-20">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đại diện Trường Sơn Solar</p>
                      <p className="font-black text-slate-900 text-sm uppercase">{salesStaff.find(s => s.id === project.assignedSalesId)?.displayName || 'PHÒNG KỸ THUẬT'}</p>
                    </div>
                  </div>
                </div>

                {/* PAGE 4: DETAILED EQUIPMENT LIST */}
                <div className="bg-white p-10 proposal-print shadow-sm border border-slate-200 min-h-[1050px] flex flex-col">
                  <div className="flex items-center justify-between mb-10">
                    <Logo className="w-16 h-16" />
                    <div className="text-right">
                       <h3 className="text-lg font-black text-slate-900 uppercase">PHỤ LỤC CHI TIẾT THIẾT BỊ</h3>
                       <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Danh mục chi tiết chủng loại & Đơn giá vật tư</p>
                    </div>
                  </div>
                  
                  <table className="w-full border-collapse text-[9px] font-sans">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="border border-slate-800 px-2 py-3 text-center w-8 uppercase">STT</th>
                        <th className="border border-slate-800 px-3 py-3 text-left uppercase">Hạng mục / Mô tả kỹ thuật</th>
                        <th className="border border-slate-800 px-2 py-3 text-center uppercase">Thương hiệu</th>
                        <th className="border border-slate-800 px-2 py-3 text-center uppercase">Số lượng</th>
                        <th className="border border-slate-800 px-2 py-3 text-center uppercase">Đơn vị</th>
                        <th className="border border-slate-800 px-2 py-3 text-right uppercase">Đơn giá</th>
                        <th className="border border-slate-800 px-2 py-3 text-right uppercase">Thành tiền</th>
                        <th className="border border-slate-800 px-2 py-3 text-center uppercase">Bảo hành</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-slate-100">
                        <td className="border border-slate-200 px-2 py-1.5 text-center font-bold">A</td>
                        <td colSpan={7} className="border border-slate-200 px-3 py-1.5 font-black uppercase tracking-widest text-slate-900">TỔNG HỢP THIẾT BỊ CHÍNH (MAJOR EQUIPMENT)</td>
                      </tr>
                      {project.panels?.equipmentId && (() => {
                        const item = catalog.find(e => e.id === project.panels?.equipmentId);
                        if (!item) return null;
                        return (
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="border border-slate-200 px-2 py-3 text-center">01</td>
                            <td className="border border-slate-200 px-3 py-3">
                              <p className="font-bold text-slate-900">Tấm pin NLMT {item.brand}</p>
                              <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">
                                Công nghệ N-Type Topcon {item.capacity}W, Hiệu suất cao, chịu tải gió 2400Pa. Chống ăn mòn muối biển.
                              </p>
                            </td>
                            <td className="border border-slate-200 px-2 py-3 text-center font-medium">{item.brand}</td>
                            <td className="border border-slate-200 px-2 py-3 text-center font-bold">{project.panels?.count}</td>
                            <td className="border border-slate-200 px-2 py-3 text-center">Tấm</td>
                            <td className="border border-slate-200 px-2 py-3 text-right font-medium">{formatCurrency(item.unitPrice)}</td>
                            <td className="border border-slate-200 px-2 py-3 text-right font-bold text-slate-900">{formatCurrency(item.unitPrice * (project.panels?.count || 0))}</td>
                            <td className="border border-slate-200 px-2 py-3 text-center whitespace-nowrap">15-25 Năm</td>
                          </tr>
                        );
                      })()}
                      {project.inverters?.equipmentId && (() => {
                        const item = catalog.find(e => e.id === project.inverters?.equipmentId);
                        if (!item) return null;
                        return (
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="border border-slate-200 px-2 py-3 text-center">02</td>
                            <td className="border border-slate-200 px-3 py-3">
                              <p className="font-bold text-slate-900">Biến tần (Inverter) Hybrid {item.brand}</p>
                              <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">
                                Công suất {item.capacity}KW, tích hợp sạc/xả thông minh, 2 MPPT, giám sát qua Cloud/App Wifi.
                              </p>
                            </td>
                            <td className="border border-slate-200 px-2 py-3 text-center font-medium">{item.brand}</td>
                            <td className="border border-slate-200 px-2 py-3 text-center font-bold">{project.inverters?.count}</td>
                            <td className="border border-slate-200 px-2 py-3 text-center">Bộ</td>
                            <td className="border border-slate-200 px-2 py-3 text-right font-medium">{formatCurrency(item.unitPrice)}</td>
                            <td className="border border-slate-200 px-2 py-3 text-right font-bold text-slate-900">{formatCurrency(item.unitPrice * (project.inverters?.count || 0))}</td>
                            <td className="border border-slate-200 px-2 py-3 text-center whitespace-nowrap">5 Năm</td>
                          </tr>
                        );
                      })()}
                      {project.batteries?.equipmentId && (() => {
                        const item = catalog.find(e => e.id === project.batteries?.equipmentId);
                        if (!item) return null;
                        return (
                          <tr className="hover:bg-slate-50 transition-colors">
                            <td className="border border-slate-200 px-2 py-3 text-center">03</td>
                            <td className="border border-slate-200 px-3 py-3">
                              <p className="font-bold text-slate-900">Pin lưu trữ Lithium ESP {item.brand}</p>
                              <p className="text-[8px] text-slate-400 mt-0.5 leading-tight">
                                LiFePO4 an toàn cháy nổ, dung lượng {item.capacity}kWh, 6000 chu kỳ sạc xả, DoD 90%.
                              </p>
                            </td>
                            <td className="border border-slate-200 px-2 py-3 text-center font-medium">{item.brand}</td>
                            <td className="border border-slate-200 px-2 py-3 text-center font-bold">{project.batteries?.count}</td>
                            <td className="border border-slate-200 px-2 py-3 text-center">Bộ</td>
                            <td className="border border-slate-200 px-2 py-3 text-right font-medium">{formatCurrency(item.unitPrice)}</td>
                            <td className="border border-slate-200 px-2 py-3 text-right font-bold text-slate-900">{formatCurrency(item.unitPrice * (project.batteries?.count || 0))}</td>
                            <td className="border border-slate-200 px-2 py-3 text-center whitespace-nowrap">5-10 Năm</td>
                          </tr>
                        );
                      })()}

                      <tr className="bg-slate-100">
                        <td className="border border-slate-200 px-2 py-1.5 text-center font-bold">B</td>
                        <td colSpan={7} className="border border-slate-200 px-3 py-1.5 font-black uppercase tracking-widest text-slate-900">VẬT TƯ PHỤ TRỌN GÓI (BALANCE OF SYSTEM)</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-200 px-2 py-3 text-center">04</td>
                        <td className="border border-slate-200 px-3 py-3">
                          <p className="font-bold text-slate-900">Hệ thống khung đỡ chuyên dụng</p>
                          <p className="text-[8px] text-slate-400 mt-0.5">Hợp kim nhôm Aluminum 6005-T5 Anode, Inox 304 không rỉ.</p>
                        </td>
                        <td className="border border-slate-200 px-2 py-3 text-center">VN</td>
                        <td className="border border-slate-200 px-2 py-3 text-center font-bold">01</td>
                        <td className="border border-slate-200 px-2 py-3 text-center">Hệ</td>
                        <td className="border border-slate-200 px-2 py-3 text-right font-medium">{formatCurrency((project.systemSizeKWp || 0) * 2000000)}</td>
                        <td className="border border-slate-200 px-2 py-3 text-right font-bold text-slate-900">{formatCurrency((project.systemSizeKWp || 0) * 2000000)}</td>
                        <td className="border border-slate-200 px-2 py-3 text-center">10 Năm</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-200 px-2 py-3 text-center">05</td>
                        <td className="border border-slate-200 px-3 py-3">
                          <p className="font-bold text-slate-900">Tủ điện & Vật tư đấu nối</p>
                          <p className="text-[8px] text-slate-400 mt-0.5">Tủ điện IP65, Cầu chì DC, Chống sét SPD AC/DC, Cáp DC 4mm2 chuyên dụng.</p>
                        </td>
                        <td className="border border-slate-200 px-2 py-3 text-center">Standard</td>
                        <td className="border border-slate-200 px-2 py-3 text-center font-bold">01</td>
                        <td className="border border-slate-200 px-2 py-3 text-center">Gói</td>
                        <td className="border border-slate-200 px-2 py-3 text-right font-medium">{formatCurrency((project.systemSizeKWp || 0) * 2000000)}</td>
                        <td className="border border-slate-200 px-2 py-3 text-right font-bold text-slate-900">{formatCurrency((project.systemSizeKWp || 0) * 2000000)}</td>
                        <td className="border border-slate-200 px-2 py-3 text-center">2 Năm</td>
                      </tr>

                      <tr className="bg-slate-100">
                        <td className="border border-slate-200 px-2 py-1.5 text-center font-bold">C</td>
                        <td colSpan={7} className="border border-slate-200 px-3 py-1.5 font-black uppercase tracking-widest text-slate-900">DỊCH VỤ THI CÔNG & LẮP ĐẶT</td>
                      </tr>
                      <tr>
                        <td className="border border-slate-200 px-2 py-3 text-center">06</td>
                        <td className="border border-slate-200 px-3 py-3">
                          <p className="font-bold text-slate-900">Vận chuyển, lắp đặt & Kỹ thuật</p>
                          <p className="text-[8px] text-slate-400 mt-0.5">Nhân công cơ khí, kỹ thuật điện, cấu hình phần mềm & đào tạo vận hành.</p>
                        </td>
                        <td className="border border-slate-200 px-2 py-3 text-center">TSolar</td>
                        <td className="border border-slate-200 px-2 py-3 text-center font-bold">01</td>
                        <td className="border border-slate-200 px-2 py-3 text-center">Gói</td>
                        <td className="border border-slate-200 px-2 py-3 text-right font-medium">{formatCurrency((project.systemSizeKWp || 0) * 1000000)}</td>
                        <td className="border border-slate-200 px-2 py-3 text-right font-bold text-slate-900">{formatCurrency((project.systemSizeKWp || 0) * 1000000)}</td>
                        <td className="border border-slate-200 px-2 py-3 text-center">1 Năm</td>
                      </tr>
                      
                      <tr className="bg-slate-900 text-white">
                        <td colSpan={6} className="border border-slate-900 px-4 py-4 text-right font-black uppercase tracking-widest text-[11px]">TỔNG GIÁ TRỊ DỰ TOÁN (Đã VAT)</td>
                        <td className="border border-slate-900 px-4 py-4 text-right font-black text-sm">{formatCurrency(project.totalCost || 0)}</td>
                        <td className="border border-slate-900 px-4 py-4"></td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="mt-8 p-6 bg-slate-50 border border-slate-200 rounded-2xl">
                     <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-3 border-b border-slate-200 pb-2">ƯU ĐIỂM GIẢI PHÁP TRƯỜNG SƠN SOLAR</p>
                     <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-[9px] text-slate-600 font-sans">
                       <li className="list-none flex items-center gap-2"><div className="w-1 h-1 bg-blue-600 rounded-full" /> Tấm pin Topcon thế hệ mới nhất, hiệu suất chuyển đổi &gt;22%</li>
                       <li className="list-none flex items-center gap-2"><div className="w-1 h-1 bg-blue-600 rounded-full" /> Inverter Hybrid phản ứng siêu tốc &lt;10ms khi mất điện lưới</li>
                       <li className="list-none flex items-center gap-2"><div className="w-1 h-1 bg-blue-600 rounded-full" /> Pin Lithium LiFePO4 tuổi thọ thiết kế 15 năm, sạc xả hàng ngày</li>
                       <li className="list-none flex items-center gap-2"><div className="w-1 h-1 bg-blue-600 rounded-full" /> Quản lý hệ thống từ xa qua Smartphone mọi lúc mọi nơi</li>
                       <li className="list-none flex items-center gap-2"><div className="w-1 h-1 bg-blue-600 rounded-full" /> Bảo trì miễn phí trong 2 năm đầu tiên cho mọi khách hàng</li>
                       <li className="list-none flex items-center gap-2"><div className="w-1 h-1 bg-blue-600 rounded-full" /> Cam kết sản lượng tiết kiệm dựa trên báo cáo kỹ thuật thực tế</li>
                     </div>
                  </div>

                  <div className="mt-auto pt-10 border-t border-dashed border-slate-200 flex justify-between items-center opacity-40 grayscale">
                    <p className="text-[8px] font-bold text-slate-400">© 2026 TRUONGSONSOLAR.VN - TÀI LIỆU LƯU HÀNH NỘI BỘ</p>
                    <Logo className="w-12 h-12" />
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
                    <Download className="h-4 w-4" /> Xuất File PDF
                  </button>
                  <button 
                    onClick={exportToExcel}
                    className="flex-1 max-w-xs bg-green-700 text-white rounded-[2rem] py-5 font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-green-200 active:scale-95 transition-all mx-auto sm:mx-0"
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Xuất Excel
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
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <Logo className="w-6 h-6" />
                  </div>
                  <p className="text-[8px] font-black uppercase tracking-widest leading-tight">
                    Powered by<br/><span className="text-[10px] text-blue-600 font-black">SE-CRM ENGINE</span>
                  </p>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
