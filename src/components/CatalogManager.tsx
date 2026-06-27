import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Equipment, Customer } from '../types';
import * as XLSX from 'xlsx';
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
  User,
  FileText,
  Check,
  XCircle,
  Clock,
  Send,
  Briefcase,
  ExternalLink,
  UploadCloud,
  FileSpreadsheet,
  Download,
  ArrowLeft,
  ChevronDown,
  Phone,
  Truck,
  Building,
  Info,
  Printer,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Settings,
  ShieldCheck,
  TrendingUp,
  Globe
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

type EquipmentCategory = 'panel' | 'inverter' | 'battery' | 'mounting' | 'accessory' | 'other';
type StockStatusFilter = 'all' | 'instock' | 'low' | 'outofstock';

export const getUnit = (item: { type?: string; unit?: string } | undefined) => {
  if (!item) return 'cái';
  if (item.unit) return item.unit;
  if (item.type === 'panel') return 'tấm';
  if (item.type === 'inverter' || item.type === 'battery') return 'bộ';
  return 'cái';
};

interface PrintRequestViewProps {
  request: any;
  onClose: () => void;
  equipmentList?: any[];
}

function PrintRequestView({ request, onClose, equipmentList: propEquipmentList }: PrintRequestViewProps) {
  const [settings, setSettings] = useState<any>(null);
  const [localEquipmentList, setLocalEquipmentList] = useState<any[]>([]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'general'));
        if (docSnap.exists()) {
          setSettings(docSnap.data());
        }
      } catch (err) {
        console.warn("Failed to fetch print header settings for PrintRequestView:", err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (propEquipmentList && propEquipmentList.length > 0) {
      setLocalEquipmentList(propEquipmentList);
    } else {
      const q = collection(db, 'equipment');
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLocalEquipmentList(list);
      }, (error) => {
        console.error("Error loading equipment inside PrintRequestView:", error);
      });
      return () => unsubscribe();
    }
  }, [propEquipmentList]);

  const getStockStatusText = (item: any) => {
    const eq = localEquipmentList.find(
      (e) => e.id === item.equipmentId || (e.brand === item.brand && e.model === item.model)
    );
    if (!eq) {
      return (
        <span className="text-slate-400 font-medium italic">N/A</span>
      );
    }
    const stock = eq.stock || 0;
    if (stock <= 0) {
      return (
        <span className="text-rose-600 font-extrabold text-[10px] uppercase">Hết hàng (Tồn: 0)</span>
      );
    }
    if (stock < item.quantity) {
      return (
        <span className="text-amber-600 font-black text-[10px] uppercase">Thiếu hụt (Tồn: {stock})</span>
      );
    }
    return (
      <span className="text-emerald-600 font-bold text-[10px] uppercase">Còn hàng (Tồn: {stock})</span>
    );
  };

  const mainItems = request.items?.filter((item: any) => 
    ['panel', 'inverter', 'battery'].includes(item.type?.toLowerCase())
  ) || [];

  const subItems = request.items?.filter((item: any) => 
    !['panel', 'inverter', 'battery'].includes(item.type?.toLowerCase())
  ) || [];

  const dateObj = request.createdAt?.toDate 
    ? request.createdAt.toDate() 
    : request.createdAt 
      ? new Date(request.createdAt) 
      : new Date();

  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();

  return (
    <div className="proposal-container flex flex-col gap-6">
      {/* Top action bar - Hidden during print */}
      <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-xs">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </button>
        <button
          onClick={() => {
            window.focus();
            window.print();
          }}
          className="bg-[#0054a6] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <Printer className="h-4 w-4" /> In phiếu yêu cầu
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="proposal-print bg-white p-8 border border-slate-200 rounded-2xl shadow-sm max-w-[850px] mx-auto w-full font-sans text-black leading-relaxed flex flex-col justify-between min-h-[1100px]">
        {/* Header Block matching the image */}
        <div>
          {settings?.printHeaderUrl ? (
            <div className="w-full mb-6 overflow-hidden rounded-xl">
              <img 
                src={settings.printHeaderUrl} 
                alt="Banner Công ty" 
                className="w-full h-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-full bg-white border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden mb-6">
              {/* Left Side: Globe TS Logo */}
              <div className="flex flex-col items-center text-center shrink-0 w-24">
                <img 
                  src="https://lh3.googleusercontent.com/d/1vN7tAn7UoZ7rR7U7S-JtG0rY_iV7B56Q" 
                  alt="Solar Trường Sơn Logo" 
                  className="w-20 h-20 object-contain"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[7px] text-[#0054a6] font-black uppercase tracking-widest mt-1">TRUONG SON COMPANY</span>
              </div>

              {/* Middle Section: Company Slogans & Badges */}
              <div className="flex-1 md:border-l border-slate-200 md:pl-6 space-y-3">
                <div>
                  <h2 className="text-[#0054a6] text-[10px] font-bold uppercase tracking-[0.2em] leading-none">CÔNG TY CỔ PHẦN</h2>
                  <h1 className="text-[#0054a6] text-xl md:text-2xl font-black uppercase tracking-tight mt-1 leading-none">ĐẦU TƯ TM TRƯỜNG SƠN</h1>
                  <h3 className="text-[#40b04c] text-[11px] md:text-xs font-extrabold uppercase tracking-[0.15em] mt-2 leading-none">GIẢI PHÁP ĐIỆN NĂNG LƯỢNG MẶT TRỜI</h3>
                  <p className="text-slate-500 text-[10px] italic font-medium mt-1 leading-none">Hiệu quả hôm nay – Bền vững ngày mai</p>
                </div>

                {/* 4 Custom badged services matching the circular icons on the image */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1 text-[8px] font-bold text-slate-700 uppercase tracking-wide">
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#0054a6] text-white flex items-center justify-center p-0.5 shrink-0">
                      <Sun className="h-3 w-3" />
                    </div>
                    TƯ VẤN CHUYÊN NGHIỆP
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#0054a6] text-white flex items-center justify-center p-0.5 shrink-0">
                      <Settings className="h-3 w-3" />
                    </div>
                    THIẾT KẾ TỐI ƯU
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#0054a6] text-white flex items-center justify-center p-0.5 shrink-0">
                      <ShieldCheck className="h-3 w-3" />
                    </div>
                    THIẾT BỊ CHÍNH HÃNG CHẤT LƯỢNG CAO
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#0054a6] text-white flex items-center justify-center p-0.5 shrink-0">
                      <TrendingUp className="h-3 w-3" />
                    </div>
                    TIẾT KIỆM ĐIỆN TỐI ƯU HIỆU QUẢ
                  </span>
                </div>
              </div>

              {/* Right Side: Clipped Modern Solar Panel Graphic matching the image's right angle */}
              <div className="hidden md:block w-48 h-28 relative overflow-hidden rounded-r-lg">
                <div className="absolute inset-0 bg-gradient-to-r from-white via-[#0054a6]/10 to-transparent z-10" />
                <img 
                  src="https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=400&q=80" 
                  alt="Solar System" 
                  className="w-full h-full object-cover grayscale-[20%]"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}

          {/* Contact Strip with exact colors and updated phone number */}
          <div className="bg-[#0054a6] text-white py-1 px-4 rounded-md text-[9px] flex flex-col sm:flex-row justify-between items-center font-bold tracking-tight gap-2 shadow-xs mb-8">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-amber-300" />
              <span>Đường Nguyễn Thiếp, P. Hạc Thành, Thanh Hóa</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe className="h-3 w-3 text-amber-300" />
              <span>solartruongson.vn</span>
            </div>
            <div className="bg-[#e30613] text-white px-2.5 py-0.5 flex items-center gap-1 rounded-sm font-black text-[9px] shrink-0">
              <Phone className="h-2.5 w-2.5 text-white fill-white" />
              <span>0945.880.386 - 0982.075.705</span>
            </div>
          </div>

          {/* Sheet Title */}
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-slate-900">PHIẾU YÊU CẦU VẬT TƯ</h1>
            <div className="w-24 h-1 bg-[#0054a6] mx-auto rounded-full" />
          </div>

          {/* Meta Information (Tên dự án, Mã phiếu, Ghi chú) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-800 mb-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <div className="space-y-1.5">
              <p className="flex items-center gap-2">
                <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider shrink-0 w-20">Tên dự án:</span>
                <span className="text-slate-900 font-black">{request.projectName || 'Chưa liên kết'}</span>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider shrink-0 w-20">Ghi Chú:</span>
                <span className="text-slate-700 italic font-medium">"{request.reason || 'Không có ghi chú thêm'}"</span>
              </p>
            </div>
            <div className="space-y-1.5 md:text-right">
              <p className="flex md:justify-end items-center gap-2">
                <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider shrink-0">Mã phiếu:</span>
                <span className="text-[#0054a6] font-black tracking-tight text-sm uppercase">#{request.id?.substring(0, 6).toUpperCase()}</span>
              </p>
              <p className="flex md:justify-end items-center gap-2">
                <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider shrink-0">Ngày tạo:</span>
                <span className="text-slate-900 font-semibold">{dateObj.toLocaleString('vi-VN')}</span>
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto border border-black rounded-lg">
            <table className="min-w-full divide-y divide-black border-collapse text-xs">
              <thead className="bg-slate-50 font-black text-slate-900 uppercase tracking-wider text-[10px]">
                <tr className="divide-x divide-black">
                  <th scope="col" className="py-2.5 px-2 text-center w-12 border border-black font-extrabold bg-slate-100">Stt</th>
                  <th scope="col" className="py-2.5 px-4 text-left border border-black font-extrabold bg-slate-100">Tên vật tư / Thiết bị</th>
                  <th scope="col" className="py-2.5 px-2 text-center w-16 border border-black font-extrabold bg-slate-100">SL</th>
                  <th scope="col" className="py-2.5 px-3 text-center w-20 border border-black font-extrabold bg-slate-100">Đơn vị</th>
                  <th scope="col" className="py-2.5 px-4 text-center w-28 border border-black font-extrabold bg-slate-100">Trạng thái kho</th>
                  <th scope="col" className="py-2.5 px-4 text-center w-36 border border-black font-extrabold bg-slate-100">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black bg-white text-slate-800 font-medium">
                {/* GROUP I: THIẾT BỊ CHÍNH */}
                {mainItems.length > 0 && (
                  <>
                    <tr className="bg-slate-50/80 divide-x divide-black font-extrabold text-slate-900">
                      <td className="py-2 px-2 text-center border border-black font-extrabold text-slate-950">I</td>
                      <td colSpan={5} className="py-2 px-4 border border-black text-[11px] uppercase tracking-wider font-extrabold text-slate-950">Thiết bị chính</td>
                    </tr>
                    {mainItems.map((item: any, idx: number) => (
                      <tr key={`main-${idx}`} className="hover:bg-slate-50/50 divide-x divide-black">
                        <td className="py-2 px-2 text-center border border-black font-semibold text-slate-900">{idx + 1}</td>
                        <td className="py-2 px-4 border border-black">
                          <div className="font-extrabold text-slate-950">{item.brand}</div>
                          <div className="text-[11px] text-slate-600 font-medium mt-0.5">{item.model}</div>
                        </td>
                        <td className="py-2 px-2 text-center border border-black font-black text-slate-950 text-sm">{item.quantity}</td>
                        <td className="py-2 px-3 text-center border border-black text-slate-600 font-bold uppercase">{item.unit || getUnit(item)}</td>
                        <td className="py-2 px-4 border border-black text-center">{getStockStatusText(item)}</td>
                        <td className="py-2 px-4 border border-black"></td>
                      </tr>
                    ))}
                  </>
                )}

                {/* GROUP II: THIẾT BỊ PHỤ & VẬT TƯ PHỤ */}
                {subItems.length > 0 && (
                  <>
                    <tr className="bg-slate-50/80 divide-x divide-black font-extrabold text-slate-900">
                      <td className="py-2 px-2 text-center border border-black font-extrabold text-slate-950">{mainItems.length > 0 ? 'II' : 'I'}</td>
                      <td colSpan={5} className="py-2 px-4 border border-black text-[11px] uppercase tracking-wider font-extrabold text-slate-950">Thiết bị phụ & Vật tư phụ</td>
                    </tr>
                    {subItems.map((item: any, idx: number) => (
                      <tr key={`sub-${idx}`} className="hover:bg-slate-50/50 divide-x divide-black">
                        <td className="py-2 px-2 text-center border border-black font-semibold text-slate-900">{idx + 1}</td>
                        <td className="py-2 px-4 border border-black">
                          <div className="font-extrabold text-slate-950">{item.brand}</div>
                          <div className="text-[11px] text-slate-600 font-medium mt-0.5">{item.model}</div>
                        </td>
                        <td className="py-2 px-2 text-center border border-black font-black text-slate-950 text-sm">{item.quantity}</td>
                        <td className="py-2 px-3 text-center border border-black text-slate-600 font-bold uppercase">{item.unit || getUnit(item)}</td>
                        <td className="py-2 px-4 border border-black text-center">{getStockStatusText(item)}</td>
                        <td className="py-2 px-4 border border-black"></td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Area with Signatures */}
        <div className="mt-12 pt-8 border-t border-dashed border-slate-200">
          <div className="flex justify-between items-start text-xs font-bold text-slate-800">
            <div className="text-center w-48 space-y-1">
              <p className="uppercase text-slate-400 text-[10px] tracking-wider font-extrabold">Người phê duyệt</p>
              <p className="text-[10px] text-slate-400 italic font-medium">(Ký, ghi rõ họ tên)</p>
              <div className="h-16" />
              <p className="text-slate-900 font-black">{request.resolvedBy || '...........................'}</p>
            </div>
            
            <div className="text-center w-48 space-y-1">
              <p className="text-slate-900 font-semibold italic text-[11px]">Ngày {day} Tháng {month} Năm {year}</p>
              <p className="uppercase text-slate-500 text-[10px] tracking-wider font-extrabold">Người yêu cầu</p>
              <p className="text-[10px] text-slate-400 italic font-medium">(Ký, ghi rõ họ tên)</p>
              <div className="h-16" />
              <p className="text-blue-600 font-black">{request.technicianName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PrintProposalsViewProps {
  proposals: any[];
  onClose: () => void;
}

function PrintProposalsView({ proposals, onClose }: PrintProposalsViewProps) {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'general'));
        if (docSnap.exists()) {
          setSettings(docSnap.data());
        }
      } catch (err) {
        console.warn("Failed to fetch print header settings for PrintProposalsView:", err);
      }
    };
    fetchSettings();
  }, []);

  // Aggregate items
  const aggregatedItemsMap: Record<string, any> = {};
  
  proposals.forEach(p => {
    p.items?.forEach((item: any) => {
      const type = item.type || 'other';
      const brand = item.brand || '';
      const model = item.model || '';
      const key = `${type.toLowerCase()}|${brand.toLowerCase()}|${model.toLowerCase()}`;
      
      if (!aggregatedItemsMap[key]) {
        aggregatedItemsMap[key] = {
          type,
          brand,
          model,
          unit: item.unit || '',
          quantity: 0,
          projects: new Set<string>()
        };
      }
      aggregatedItemsMap[key].quantity += Number(item.quantity) || 0;
      if (p.projectName) {
        aggregatedItemsMap[key].projects.add(p.projectName);
      }
    });
  });

  const allAggregatedItems = Object.values(aggregatedItemsMap);
  const mainItems = allAggregatedItems.filter((item: any) => 
    ['panel', 'inverter', 'battery'].includes(item.type?.toLowerCase())
  );
  const subItems = allAggregatedItems.filter((item: any) => 
    !['panel', 'inverter', 'battery'].includes(item.type?.toLowerCase())
  );

  const dateObj = new Date();
  const day = dateObj.getDate().toString().padStart(2, '0');
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const year = dateObj.getFullYear();

  const proposalCodes = proposals.map(p => `#${p.id?.substring(0, 6).toUpperCase()}`).join(', ');
  const projectNames = Array.from(new Set(proposals.map(p => p.projectName).filter(Boolean))).join(', ');

  return (
    <div className="proposal-container flex flex-col gap-6">
      {/* Top action bar - Hidden during print */}
      <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-xs">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Quay lại
        </button>
        <button
          onClick={() => {
            window.focus();
            window.print();
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer"
        >
          <Printer className="h-4 w-4" /> In phiếu đề nghị ({proposals.length} phiếu)
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="proposal-print bg-white p-8 border border-slate-200 rounded-2xl shadow-sm max-w-[850px] mx-auto w-full font-sans text-black leading-relaxed flex flex-col justify-between min-h-[1100px]">
        {/* Header Block matching the image */}
        <div>
          {settings?.printHeaderUrl ? (
            <div className="w-full mb-6 overflow-hidden rounded-xl">
              <img 
                src={settings.printHeaderUrl} 
                alt="Banner Công ty" 
                className="w-full h-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-full bg-white border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden mb-6">
              {/* Left Side: Globe TS Logo */}
              <div className="flex flex-col items-center text-center shrink-0 w-24">
                <img 
                  src="https://lh3.googleusercontent.com/d/1vN7tAn7UoZ7rR7U7S-JtG0rY_iV7B56Q" 
                  alt="Solar Trường Sơn Logo" 
                  className="w-20 h-20 object-contain"
                  referrerPolicy="no-referrer"
                />
                <span className="text-[7px] text-[#0054a6] font-black uppercase tracking-widest mt-1">TRUONG SON COMPANY</span>
              </div>

              {/* Middle Section: Company Slogans & Badges */}
              <div className="flex-1 md:border-l border-slate-200 md:pl-6 space-y-3">
                <div>
                  <h2 className="text-[#0054a6] text-[10px] font-bold uppercase tracking-[0.2em] leading-none">CÔNG TY CỔ PHẦN</h2>
                  <h1 className="text-[#0054a6] text-xl md:text-2xl font-black uppercase tracking-tight mt-1 leading-none">ĐẦU TƯ TM TRƯỜNG SƠN</h1>
                  <h3 className="text-[#40b04c] text-[11px] md:text-xs font-extrabold uppercase tracking-[0.15em] mt-2 leading-none">GIẢI PHÁP ĐIỆN NĂNG LƯỢNG MẶT TRỜI</h3>
                  <p className="text-slate-500 text-[10px] italic font-medium mt-1 leading-none">Hiệu quả hôm nay – Bền vững ngày mai</p>
                </div>

                {/* 4 Custom badged services matching the circular icons on the image */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1 text-[8px] font-bold text-slate-700 uppercase tracking-wide">
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#0054a6] text-white flex items-center justify-center p-0.5 shrink-0">
                      <Sun className="h-3 w-3" />
                    </div>
                    TƯ VẤN CHUYÊN NGHIỆP
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#0054a6] text-white flex items-center justify-center p-0.5 shrink-0">
                      <Settings className="h-3 w-3" />
                    </div>
                    THIẾT KẾ TỐI ƯU
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#0054a6] text-white flex items-center justify-center p-0.5 shrink-0">
                      <ShieldCheck className="h-3 w-3" />
                    </div>
                    THIẾT BỊ CHÍNH HÃNG CHẤT LƯỢNG CAO
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#0054a6] text-white flex items-center justify-center p-0.5 shrink-0">
                      <TrendingUp className="h-3 w-3" />
                    </div>
                    TIẾT KIỆM ĐIỆN TỐI ƯU HIỆU QUẢ
                  </span>
                </div>
              </div>

              {/* Right Side: Clipped Modern Solar Panel Graphic matching the image's right angle */}
              <div className="hidden md:block w-48 h-28 relative overflow-hidden rounded-r-lg">
                <div className="absolute inset-0 bg-gradient-to-r from-white via-[#0054a6]/10 to-transparent z-10" />
                <img 
                  src="https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=400&q=80" 
                  alt="Solar System" 
                  className="w-full h-full object-cover grayscale-[20%]"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
          )}

          {/* Contact Strip with exact colors and updated phone number */}
          <div className="bg-[#0054a6] text-white py-1 px-4 rounded-md text-[9px] flex flex-col sm:flex-row justify-between items-center font-bold tracking-tight gap-2 shadow-xs mb-8">
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 text-amber-300" />
              <span>Đường Nguyễn Thiếp, P. Hạc Thành, Thanh Hóa</span>
            </div>
            <div className="flex items-center gap-1">
              <Globe className="h-3 w-3 text-amber-300" />
              <span>solartruongson.vn</span>
            </div>
            <div className="bg-[#e30613] text-white px-2.5 py-0.5 flex items-center gap-1 rounded-sm font-black text-[9px] shrink-0">
              <Phone className="h-2.5 w-2.5 text-white fill-white" />
              <span>0945.880.386 - 0982.075.705</span>
            </div>
          </div>

          {/* Sheet Title */}
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-2xl font-black uppercase tracking-[0.1em] text-slate-900">PHIẾU ĐỀ NGHỊ NHẬP VẬT TƯ</h1>
            <div className="w-24 h-1 bg-[#40b04c] mx-auto rounded-full" />
          </div>

          {/* Meta Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-bold text-slate-800 mb-6 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
            <div className="space-y-1.5">
              <p className="flex items-start gap-2">
                <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider shrink-0 w-24">Dự án liên quan:</span>
                <span className="text-slate-900 font-black">{projectNames || 'Tổng hợp nhiều dự án'}</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider shrink-0 w-24">Số lượng phiếu:</span>
                <span className="text-slate-700 font-bold">{proposals.length} phiếu yêu cầu</span>
              </p>
            </div>
            <div className="space-y-1.5 md:text-right">
              <p className="flex md:justify-end items-start gap-2">
                <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider shrink-0">Các mã đề xuất:</span>
                <span className="text-[#0054a6] font-black tracking-tight uppercase text-right max-w-xs">{proposalCodes}</span>
              </p>
              <p className="flex md:justify-end items-center gap-2">
                <span className="text-slate-400 font-medium uppercase text-[10px] tracking-wider shrink-0">Ngày lập bảng:</span>
                <span className="text-slate-900 font-semibold">{dateObj.toLocaleString('vi-VN')}</span>
              </p>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto border border-black rounded-lg">
            <table className="min-w-full divide-y divide-black border-collapse text-xs">
              <thead className="bg-slate-50 font-black text-slate-900 uppercase tracking-wider text-[10px]">
                <tr className="divide-x divide-black">
                  <th scope="col" className="py-2.5 px-2 text-center w-12 border border-black font-extrabold bg-slate-100">Stt</th>
                  <th scope="col" className="py-2.5 px-4 text-left border border-black font-extrabold bg-slate-100">Tên vật tư / Thiết bị đề xuất</th>
                  <th scope="col" className="py-2.5 px-2 text-center w-16 border border-black font-extrabold bg-slate-100">Tổng SL</th>
                  <th scope="col" className="py-2.5 px-3 text-center w-20 border border-black font-extrabold bg-slate-100">Đơn vị</th>
                  <th scope="col" className="py-2.5 px-4 text-left border border-black font-extrabold bg-slate-100">Dự án yêu cầu</th>
                  <th scope="col" className="py-2.5 px-4 text-center w-32 border border-black font-extrabold bg-slate-100">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black bg-white text-slate-800 font-medium">
                {/* GROUP I: THIẾT BỊ CHÍNH */}
                {mainItems.length > 0 && (
                  <>
                    <tr className="bg-slate-50/80 divide-x divide-black font-extrabold text-slate-900">
                      <td className="py-2 px-2 text-center border border-black font-extrabold text-slate-950">I</td>
                      <td colSpan={5} className="py-2 px-4 border border-black text-[11px] uppercase tracking-wider font-extrabold text-slate-950">Thiết bị chính</td>
                    </tr>
                    {mainItems.map((item: any, idx: number) => (
                      <tr key={`main-${idx}`} className="hover:bg-slate-50/50 divide-x divide-black">
                        <td className="py-2 px-2 text-center border border-black font-semibold text-slate-900">{idx + 1}</td>
                        <td className="py-2 px-4 border border-black">
                          <div className="font-extrabold text-slate-950">{item.brand}</div>
                          <div className="text-[11px] text-slate-600 font-medium mt-0.5">{item.model}</div>
                        </td>
                        <td className="py-2 px-2 text-center border border-black font-black text-rose-600 text-sm">{item.quantity}</td>
                        <td className="py-2 px-3 text-center border border-black text-slate-600 font-bold uppercase">{item.unit || getUnit(item)}</td>
                        <td className="py-2 px-4 border border-black text-left text-[11px] font-semibold text-slate-700">
                          {Array.from(item.projects).join(', ') || 'Chưa rõ'}
                        </td>
                        <td className="py-2 px-4 border border-black"></td>
                      </tr>
                    ))}
                  </>
                )}

                {/* GROUP II: THIẾT BỊ PHỤ & VẬT TƯ PHỤ */}
                {subItems.length > 0 && (
                  <>
                    <tr className="bg-slate-50/80 divide-x divide-black font-extrabold text-slate-900">
                      <td className="py-2 px-2 text-center border border-black font-extrabold text-slate-950">{mainItems.length > 0 ? 'II' : 'I'}</td>
                      <td colSpan={5} className="py-2 px-4 border border-black text-[11px] uppercase tracking-wider font-extrabold text-slate-950">Thiết bị phụ & Vật tư phụ</td>
                    </tr>
                    {subItems.map((item: any, idx: number) => (
                      <tr key={`sub-${idx}`} className="hover:bg-slate-50/50 divide-x divide-black">
                        <td className="py-2 px-2 text-center border border-black font-semibold text-slate-900">{idx + 1}</td>
                        <td className="py-2 px-4 border border-black">
                          <div className="font-extrabold text-slate-950">{item.brand}</div>
                          <div className="text-[11px] text-slate-600 font-medium mt-0.5">{item.model}</div>
                        </td>
                        <td className="py-2 px-2 text-center border border-black font-black text-rose-600 text-sm">{item.quantity}</td>
                        <td className="py-2 px-3 text-center border border-black text-slate-600 font-bold uppercase">{item.unit || getUnit(item)}</td>
                        <td className="py-2 px-4 border border-black text-left text-[11px] font-semibold text-slate-700">
                          {Array.from(item.projects).join(', ') || 'Chưa rõ'}
                        </td>
                        <td className="py-2 px-4 border border-black"></td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Area with Signatures */}
        <div className="mt-12 pt-8 border-t border-dashed border-slate-200">
          <div className="flex justify-between items-start text-xs font-bold text-slate-800">
            <div className="text-center w-48 space-y-1">
              <p className="uppercase text-slate-400 text-[10px] tracking-wider font-extrabold">Ban giám đốc</p>
              <p className="text-[10px] text-slate-400 italic font-medium">(Ký, duyệt)</p>
              <div className="h-16" />
              <p className="text-slate-900 font-black">...........................</p>
            </div>

            <div className="text-center w-48 space-y-1">
              <p className="uppercase text-slate-400 text-[10px] tracking-wider font-extrabold">Phòng kế toán</p>
              <p className="text-[10px] text-slate-400 italic font-medium">(Ký, duyệt)</p>
              <div className="h-16" />
              <p className="text-slate-900 font-black">...........................</p>
            </div>
            
            <div className="text-center w-48 space-y-1">
              <p className="text-slate-900 font-semibold italic text-[11px]">Ngày {day} Tháng {month} Năm {year}</p>
              <p className="uppercase text-slate-500 text-[10px] tracking-wider font-extrabold">Người đề nghị nhập</p>
              <p className="text-[10px] text-slate-400 italic font-medium">(Ký, ghi rõ họ tên)</p>
              <div className="h-16" />
              <p className="text-blue-600 font-black">...........................</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CatalogManagerProps {
  userId?: string;
  userRole?: string;
}

export default function CatalogManager({ userId, userRole }: CatalogManagerProps) {
  const isAdmin = userRole === 'admin' || userRole === 'manager' || userRole === 'accountant' || userRole === 'operator';
  
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('Nhân viên');
  
  // Tabs for general warehouse vs material requests
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests' | 'proposals'>('inventory');

  // Real-time collections for material requests
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [materialRequests, setMaterialRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [purchaseProposals, setPurchaseProposals] = useState<any[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(true);

  // Request creation modal states
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [searchQueryInRequest, setSearchQueryInRequest] = useState('');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requestProjectId, setRequestProjectId] = useState('');
  const [requestItems, setRequestItems] = useState<{
    equipmentId: string;
    brand: string;
    model: string;
    type: string;
    quantity: number;
  }[]>([]);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [printingRequest, setPrintingRequest] = useState<any | null>(null);
  const [selectedProposals, setSelectedProposals] = useState<string[]>([]);
  const [printingProposals, setPrintingProposals] = useState<any[] | null>(null);
  
  // Selection states inside request creation modal
  const [selectedEqId, setSelectedEqId] = useState('');
  const [selectedEqQty, setSelectedEqQty] = useState(1);

  // Approval/rejection states
  const [resolvingRequest, setResolvingRequest] = useState<any | null>(null);
  const [resolveAction, setResolveAction] = useState<'approve' | 'reject' | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  
  // Filters & Search
  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | 'all'>('all');
  const [stockFilter, setStockFilter] = useState<StockStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination for inventory list
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, stockFilter, searchQuery]);

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

  // Excel Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<{ data: Partial<Equipment>; errors: string[]; rowNum: number; isValid: boolean }[]>([]);
  const [isImporting, setIsImporting] = useState(false);

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

  // Load Projects for select dropdown
  useEffect(() => {
    if (!userId) return;
    const q = collection(db, 'projects');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjectsList(list);
    }, (error) => {
      console.error("Error loading projects for warehouse request:", error);
    });
    return () => unsubscribe();
  }, [userId]);

  // Load Customers for mapping project names
  useEffect(() => {
    if (!userId) return;
    const q = collection(db, 'customers');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Record<string, Customer> = {};
      snapshot.docs.forEach(doc => {
        data[doc.id] = { id: doc.id, ...doc.data() } as Customer;
      });
      setCustomers(data);
    }, (error) => {
      console.error("Error loading customers for mapping project names:", error);
    });
    return () => unsubscribe();
  }, [userId]);

  // Load Material Requests sync
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'material_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMaterialRequests(list);
      setRequestsLoading(false);
    }, (error) => {
      console.error("Error loading material requests:", error);
      setRequestsLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  // Load Purchase Proposals sync
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'purchase_proposals'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPurchaseProposals(list);
      setProposalsLoading(false);
    }, (error) => {
      console.error("Error loading purchase proposals:", error);
      setProposalsLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  // F3 Key shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        const searchInput = document.getElementById('request-search-input');
        if (searchInput) {
          searchInput.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handler to initiate request directly from equipment card
  const handleOpenRequestWithItem = (item: Equipment) => {
    setRequestItems([{
      equipmentId: item.id,
      brand: item.brand,
      model: item.model,
      type: item.type,
      quantity: 1,
      unit: item.unit
    }]);
    setRequestReason(`Yêu cầu cấp phát thiết bị ${item.brand} ${item.model} phục vụ lắp đặt`);
    setRequestProjectId('');
    setActiveTab('requests');
    setIsCreatingRequest(true);
  };

  // Add selected item to the request slip list
  const handleAddRequestItem = () => {
    if (!selectedEqId) return;
    const item = equipmentList.find(e => e.id === selectedEqId);
    if (!item) return;

    if (requestItems.some(ri => ri.equipmentId === selectedEqId)) {
      setRequestItems(prev => prev.map(ri => 
        ri.equipmentId === selectedEqId 
          ? { ...ri, quantity: ri.quantity + selectedEqQty } 
          : ri
      ));
    } else {
      setRequestItems(prev => [...prev, {
        equipmentId: item.id,
        brand: item.brand,
        model: item.model,
        type: item.type,
        quantity: selectedEqQty,
        unit: item.unit
      }]);
    }

    setSelectedEqId('');
    setSelectedEqQty(1);
  };

  // Download sample CSV request file
  const handleDownloadSampleRequestFile = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Ma thiet bi,Thuong hieu,Model,Loai,So luong\n"
      + "eq_sample_1,Longi,Hi-MO 5,panel,5\n"
      + "eq_sample_2,Growatt,MIN 5000TL-X,inverter,1\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "mau_yeu_cau_vat_tu.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import requests items from a text file or CSV
  const handleImportRequestFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      const newItems: typeof requestItems = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length >= 4) {
          const brand = parts[1]?.trim();
          const model = parts[2]?.trim();
          const type = parts[3]?.trim();
          const quantity = parseInt(parts[4]?.trim() || '1') || 1;

          const matchedEq = equipmentList.find(eq => 
            eq.brand.toLowerCase() === brand.toLowerCase() && 
            eq.model.toLowerCase() === model.toLowerCase()
          );

          if (matchedEq) {
            newItems.push({
              equipmentId: matchedEq.id,
              brand: matchedEq.brand,
              model: matchedEq.model,
              type: matchedEq.type,
              quantity: quantity,
              unit: matchedEq.unit
            });
          }
        }
      }

      if (newItems.length > 0) {
        setRequestItems(prev => {
          const combined = [...prev];
          newItems.forEach(item => {
            const existing = combined.find(ri => ri.equipmentId === item.equipmentId);
            if (existing) {
              existing.quantity += item.quantity;
            } else {
              combined.push(item);
            }
          });
          return combined;
        });
        alert(`Đã nhập thành công ${newItems.length} vật tư từ file.`);
      } else {
        if (equipmentList.length > 0) {
          const sampleCount = Math.min(3, equipmentList.length);
          const samples: typeof requestItems = [];
          for (let j = 0; j < sampleCount; j++) {
            const eq = equipmentList[j];
            samples.push({
              equipmentId: eq.id,
              brand: eq.brand,
              model: eq.model,
              type: eq.type,
              quantity: 2 + j,
              unit: eq.unit
            });
          }
          setRequestItems(prev => [...prev, ...samples]);
          alert("Đã tải dữ liệu mẫu thành công với 3 vật tư demo từ kho hàng.");
        } else {
          alert("Không tìm thấy vật tư nào phù hợp trong hệ thống.");
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Remove item from requested slip list
  const handleRemoveRequestItem = (eqId: string) => {
    setRequestItems(prev => prev.filter(ri => ri.equipmentId !== eqId));
  };

  // Create or Update material request in database
  const handleCreateMaterialRequest = async (e?: React.FormEvent, status: 'pending' | 'draft' = 'pending') => {
    if (e) e.preventDefault();
    if (requestItems.length === 0) return;

    const project = projectsList.find(p => p.id === requestProjectId);
    const cust = project ? customers[project.customerId] : null;
    const projectName = cust ? `Công trình ${cust.name}` : (project ? (project.name || project.customerName || 'Dự án') : '');

    try {
      const resolvedStatus = (status === 'draft') ? 'draft' : 'pending';
      const requestData = {
        technicianId: userId || '',
        technicianName: userName || 'Nhân viên',
        projectId: requestProjectId || '',
        projectName: projectName || '',
        reason: (requestReason || '').trim(),
        items: (requestItems || [])
          .filter(Boolean)
          .filter(item => !!item.equipmentId)
          .map(item => {
            const eq = equipmentList.find(e => e.id === item.equipmentId);
            const isOutOfStock = eq ? (eq.stock || 0) <= 0 : true;
            return {
              equipmentId: item.equipmentId || '',
              brand: item.brand || '',
              model: item.model || '',
              type: item.type || '',
              quantity: item.quantity || 1,
              unit: item.unit || 'cái',
              isOutOfStock,
              currentStock: eq ? (eq.stock || 0) : 0
            };
          }),
        status: resolvedStatus,
        createdAt: serverTimestamp(),
        resolvedAt: null,
        resolvedBy: null,
        adminNote: ''
      };

      if (editingRequestId) {
        await updateDoc(doc(db, 'material_requests', editingRequestId), requestData);
      } else {
        await addDoc(collection(db, 'material_requests'), requestData);
      }

      if (resolvedStatus === 'pending') {
        // Notification to admin & manager
        await addDoc(collection(db, 'notifications'), {
          title: '📋 YÊU CẦU VẬT TƯ MỚI',
          message: `Kỹ thuật ${userName || 'Nhân viên'} đã ${editingRequestId ? 'cập nhật' : 'tạo'} phiếu yêu cầu vật tư mới cho công trình: ${projectName || 'Chưa liên kết'}. Nội dung: ${(requestReason || '').trim()}`,
          type: 'task',
          createdAt: serverTimestamp(),
          createdBy: userId || '',
          createdByName: userName || 'Nhân viên'
        });
      }

      setIsRequestModalOpen(false);
      setIsCreatingRequest(false);
      setRequestReason('');
      setRequestProjectId('');
      setRequestItems([]);
      setSelectedEqId('');
      setSelectedEqQty(1);
      setEditingRequestId(null);

      if (status === 'draft') {
        alert("Đã lưu tạm dự thảo phiếu yêu cầu thành công!");
      } else {
        alert("Đã gửi phiếu yêu cầu vật tư thành công!");
      }
    } catch (err) {
      console.error("Error creating/updating material request:", err);
    }
  };

  // Approve / Reject material requests
  const handleResolveRequest = async () => {
    if (!resolvingRequest || !resolveAction) return;

    try {
      const isApproved = resolveAction === 'approve';
      const resolvedRequestData = {
        status: isApproved ? 'approved' as const : 'rejected' as const,
        resolvedAt: serverTimestamp(),
        resolvedBy: userName,
        adminNote: adminNote.trim()
      };

      await updateDoc(doc(db, 'material_requests', resolvingRequest.id), resolvedRequestData);

      // Deduct stock if approved
      if (isApproved) {
        const outOfStockItems: any[] = [];

        for (const reqItem of resolvingRequest.items) {
          const eqDocRef = doc(db, 'equipment', reqItem.equipmentId);
          const eqSnap = await getDoc(eqDocRef);

          if (eqSnap.exists()) {
            const currentData = eqSnap.data();
            const currentStock = currentData.stock || 0;

            if (currentStock > 0) {
              // Còn tồn kho: Trừ tồn kho tối đa có thể
              const deductQty = Math.min(reqItem.quantity, currentStock);
              const newStock = currentStock - deductQty;

              const transactionLog = {
                id: Math.random().toString(36).substring(7),
                type: 'export' as const,
                quantity: deductQty,
                note: `Cấp phát theo phiếu yêu cầu của ${resolvingRequest.technicianName || 'Nhân viên'}. Ghi chú: ${resolvingRequest.reason || ''}`,
                createdAt: new Date().toISOString(),
                createdBy: userId || '',
                createdByName: userName || 'Nhân viên'
              };

              const updatedHistory = [transactionLog, ...(currentData.history || [])].slice(0, 50);

              await updateDoc(eqDocRef, {
                stock: newStock,
                history: updatedHistory
              });

              // Nếu số lượng yêu cầu lớn hơn tồn kho có sẵn, phần còn lại chuyển thành hết hàng để đề nghị nhập kho
              if (reqItem.quantity > deductQty) {
                outOfStockItems.push({
                  ...reqItem,
                  quantity: reqItem.quantity - deductQty
                });
              }
            } else {
              // Hết tồn kho hoàn toàn
              outOfStockItems.push(reqItem);
            }
          } else {
            // Không tồn tại trong kho
            outOfStockItems.push(reqItem);
          }
        }

        // Tạo phiếu đề nghị nhập vật tư gửi kế toán nếu có hàng hết tồn kho
        if (outOfStockItems.length > 0) {
          const proposalData = {
            requestId: resolvingRequest.id,
            technicianId: resolvingRequest.technicianId || '',
            technicianName: resolvingRequest.technicianName || 'Nhân viên',
            projectId: resolvingRequest.projectId || '',
            projectName: resolvingRequest.projectName || '',
            reason: `Đề xuất mua vật tư hết hàng cho dự án ${resolvingRequest.projectName || 'Chưa liên kết'} (Theo phiếu yêu cầu gốc #${resolvingRequest.id.substring(0, 6).toUpperCase()})`,
            items: outOfStockItems
              .filter(Boolean)
              .filter(item => !!item.equipmentId)
              .map(item => ({
                equipmentId: item.equipmentId || '',
                brand: item.brand || '',
                model: item.model || '',
                type: item.type || '',
                quantity: item.quantity || 1,
                unit: item.unit || 'cái'
              })),
            status: 'pending', // pending, ordering, completed, cancelled
            createdAt: serverTimestamp(),
            resolvedAt: null,
            resolvedBy: null,
            adminNote: ''
          };

          await addDoc(collection(db, 'purchase_proposals'), proposalData);

          // Thông báo cho kế toán
          await addDoc(collection(db, 'notifications'), {
            title: '💰 ĐỀ NGHỊ NHẬP VẬT TƯ MỚI',
            message: `Hệ thống tự động đề xuất nhập vật tư hết tồn kho cho công trình: ${resolvingRequest.projectName || 'Chưa liên kết'} từ phiếu yêu cầu của ${resolvingRequest.technicianName || 'Nhân viên'}.`,
            type: 'task',
            createdAt: serverTimestamp(),
            createdBy: userId || '',
            createdByName: userName || 'Nhân viên'
          });
        }
      }

      // Live update notification
      await addDoc(collection(db, 'notifications'), {
        title: isApproved ? '✅ PHÊ DUYỆT YÊU CẦU VẬT TƯ' : '❌ TỪ CHỐI YÊU CẦU VẬT TƯ',
        message: `Phiếu yêu cầu vật tư của ${resolvingRequest.technicianName || 'Nhân viên'} đã được ${userName || 'Nhân viên'} ${isApproved ? 'PHÊ DUYỆT' : 'TỪ CHỐI'}. Ghi chú: ${(adminNote || '').trim() || 'Không có ghi chú thêm'}`,
        type: 'task',
        createdAt: serverTimestamp(),
        createdBy: userId || '',
        createdByName: userName || 'Nhân viên'
      });

      setIsResolveModalOpen(false);
      setResolvingRequest(null);
      setResolveAction(null);
      setAdminNote('');
    } catch (err) {
      console.error("Error resolving material request:", err);
    }
  };

  // Resolve purchase proposal (for Accountant/Admin)
  const handleResolveProposal = async (proposalId: string, action: 'order' | 'complete' | 'cancel') => {
    try {
      const proposalRef = doc(db, 'purchase_proposals', proposalId);
      const proposalSnap = await getDoc(proposalRef);

      if (!proposalSnap.exists()) return;
      const proposalData = proposalSnap.data();

      let newStatus = 'pending';
      if (action === 'order') newStatus = 'ordering';
      if (action === 'cancel') newStatus = 'cancelled';
      if (action === 'complete') newStatus = 'completed';

      await updateDoc(proposalRef, {
        status: newStatus,
        resolvedAt: serverTimestamp(),
        resolvedBy: userName
      });

      // Nếu chuyển thành đã hoàn thành nhập kho (completed): Cộng thêm số lượng vào kho và ghi nhận lịch sử nhập kho
      if (action === 'complete') {
        for (const pItem of proposalData.items) {
          const eqDocRef = doc(db, 'equipment', pItem.equipmentId);
          const eqSnap = await getDoc(eqDocRef);

          if (eqSnap.exists()) {
            const currentData = eqSnap.data();
            const currentStock = currentData.stock || 0;
            const newStock = currentStock + pItem.quantity;

            const transactionLog = {
              id: Math.random().toString(36).substring(7),
              type: 'import' as const,
              quantity: pItem.quantity,
              note: `Nhập kho hoàn thành từ phiếu đề nghị mua hàng #${proposalId.substring(0, 6).toUpperCase()}`,
              createdAt: new Date().toISOString(),
              createdBy: userId!,
              createdByName: userName
            };

            const updatedHistory = [transactionLog, ...(currentData.history || [])].slice(0, 50);

            await updateDoc(eqDocRef, {
              stock: newStock,
              history: updatedHistory
            });
          }
        }

        // Tạo thông báo hoàn thành nhập kho
        await addDoc(collection(db, 'notifications'), {
          title: '📦 VẬT TƯ ĐÃ NHẬP KHO THÀNH CÔNG',
          message: `Kế toán ${userName} đã hoàn thành mua hàng và nhập kho các vật tư hết hàng cho công trình: ${proposalData.projectName || 'Chưa liên kết'}. Vật tư đã có sẵn để thi công!`,
          type: 'task',
          createdAt: serverTimestamp(),
          createdBy: userId!,
          createdByName: userName
        });
      } else {
        // Thông báo đổi trạng thái khác
        const actionStr = action === 'order' ? 'XÁC NHẬN ĐANG MUA HÀNG' : 'HỦY BỎ ĐỀ NGHỊ';
        await addDoc(collection(db, 'notifications'), {
          title: `💰 CẬP NHẬT ĐỀ NGHỊ NHẬP VẬT TƯ`,
          message: `Kế toán ${userName} đã ${actionStr} phiếu đề nghị nhập vật tư #${proposalId.substring(0, 6).toUpperCase()} cho công trình: ${proposalData.projectName || 'Chưa liên kết'}.`,
          type: 'task',
          createdAt: serverTimestamp(),
          createdBy: userId!,
          createdByName: userName
        });
      }
    } catch (err) {
      console.error("Error resolving purchase proposal:", err);
    }
  };

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
        history: editingItem.history || [],
        unit: editingItem.unit || ''
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

  // Excel template generation and download helper
  const handleDownloadTemplate = () => {
    // Standard schema for equipment
    const sampleData = [
      {
        'Loại thiết bị (*)': 'panel',
        'Thương hiệu (*)': 'Longi Solar',
        'Model (*)': 'LR5-72HPH-550M',
        'Công suất (Wp) (*)': 550,
        'Đơn giá nhập kho (VND) (*)': 2200000,
        'Đơn giá bán ra (VND) (*)': 3100000,
        'Điện 3 Pha (Có/Không) (*)': 'Không',
        'Số lượng tồn kho ban đầu (*)': 100,
        'Số lượng tối thiểu cảnh báo (*)': 10,
        'Vị trí lưu kho (*)': 'Khu A1',
        'Mô tả chi tiết': 'Tấm pin Mono Crystalline hiệu suất cao, 144 half-cell'
      },
      {
        'Loại thiết bị (*)': 'inverter',
        'Thương hiệu (*)': 'Solis',
        'Model (*)': 'Solis-110K-5G',
        'Công suất (Wp) (*)': 110000,
        'Đơn giá nhập kho (VND) (*)': 65000000,
        'Đơn giá bán ra (VND) (*)': 82000000,
        'Điện 3 Pha (Có/Không) (*)': 'Có',
        'Số lượng tồn kho ban đầu (*)': 5,
        'Số lượng tối thiểu cảnh báo (*)': 2,
        'Vị trí lưu kho (*)': 'Khu B2',
        'Mô tả chi tiết': 'Biến tần hòa lưới 3 pha 110kW, hiệu suất 98.7%, 10 MPPT'
      },
      {
        'Loại thiết bị (*)': 'battery',
        'Thương hiệu (*)': 'Sunket',
        'Model (*)': 'LFP-51.2V100AH',
        'Công suất (Wp) (*)': 5120,
        'Đơn giá nhập kho (VND) (*)': 28000000,
        'Đơn giá bán ra (VND) (*)': 36000000,
        'Điện 3 Pha (Có/Không) (*)': 'Không',
        'Số lượng tồn kho ban đầu (*)': 8,
        'Số lượng tối thiểu cảnh báo (*)': 3,
        'Vị trí lưu kho (*)': 'Khu C1',
        'Mô tả chi tiết': 'Pin lưu trữ Lithium sắt phốt phát (LiFePO4) cho hệ độc lập/hybrid'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_Vat_Tu');

    // Instruction tab
    const instructionData = [
      { 'Hướng dẫn nhập dữ liệu': 'CÁC THÔNG TIN QUAN TRỌNG KHI NHẬP FILE' },
      { 'Hướng dẫn nhập dữ liệu': '1. Các cột đánh dấu (*) là bắt buộc.' },
      { 'Hướng dẫn nhập dữ liệu': '2. Loại thiết bị phải thuộc một trong các giá trị sau: panel, inverter, battery, mounting, accessory, other' },
      { 'Hướng dẫn nhập dữ liệu': '   - panel: Tấm pin năng lượng mặt trời' },
      { 'Hướng dẫn nhập dữ liệu': '   - inverter: Biến tần' },
      { 'Hướng dẫn nhập dữ liệu': '   - battery: Pin lưu trữ' },
      { 'Hướng dẫn nhập dữ liệu': '   - mounting: Hệ khung giá đỡ' },
      { 'Hướng dẫn nhập dữ liệu': '   - accessory: Phụ kiện lắp đặt, cáp điện' },
      { 'Hướng dẫn nhập dữ liệu': '   - other: Các thiết bị khác' },
      { 'Hướng dẫn nhập dữ liệu': '3. Điện 3 Pha ghi: "Có" hoặc "Không".' },
      { 'Hướng dẫn nhập dữ liệu': '4. Công suất, Đơn giá nhập, Đơn giá bán, Tồn kho ban đầu, Tối thiểu cảnh báo phải là số nguyên dương >= 0.' }
    ];
    const wsInstruction = XLSX.utils.json_to_sheet(instructionData);
    XLSX.utils.book_append_sheet(wb, wsInstruction, 'Huong_Dan_Su_Dung');

    // Adjust column widths for aesthetics
    ws['!cols'] = [
      { wch: 18 }, // Loại thiết bị
      { wch: 18 }, // Thương hiệu
      { wch: 22 }, // Model
      { wch: 18 }, // Công suất
      { wch: 28 }, // Đơn giá nhập
      { wch: 26 }, // Đơn giá bán
      { wch: 24 }, // Điện 3 Pha
      { wch: 26 }, // Tồn kho
      { wch: 28 }, // Cảnh báo
      { wch: 20 }, // Vị trí
      { wch: 50 }, // Mô tả
    ];

    wsInstruction['!cols'] = [{ wch: 80 }];

    XLSX.writeFile(wb, 'Mau_Excel_Vat_Tu_Solar.xlsx');
  };

  // Parser of uploaded Excel file
  const handleParseExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);
    setParsedItems([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);
        if (rawRows.length === 0) {
          setImportError('File Excel không có dữ liệu để phân tích.');
          return;
        }

        const allowedTypes = ['panel', 'inverter', 'battery', 'mounting', 'accessory', 'other'];

        const getRowValue = (r: any, keys: string[]) => {
          for (const key of keys) {
            if (r[key] !== undefined && r[key] !== null && r[key] !== '') {
              return r[key];
            }
          }
          return undefined;
        };

        const items = rawRows.map((row, idx) => {
          const rowNum = idx + 2; // header is row 1
          const errors: string[] = [];

          // Column extraction accommodating spelling variants using safe helper
          const typeRaw = (getRowValue(row, ['Loại thiết bị (*)', 'Loại thiết bị', 'type']) || '').toString().trim().toLowerCase();
          const brand = (getRowValue(row, ['Thương hiệu (*)', 'Thương hiệu', 'brand']) || '').toString().trim();
          const model = (getRowValue(row, ['Model (*)', 'Model', 'model']) || '').toString().trim();
          const capacityRaw = getRowValue(row, ['Công suất (Wp) (*)', 'Công suất (Wp)', 'Công suất', 'capacity']);
          const unitPriceRaw = getRowValue(row, ['Đơn giá nhập kho (VND) (*)', 'Đơn giá nhập kho (VND)', 'Đơn giá nhập', 'unitPrice']);
          const sellingPriceRaw = getRowValue(row, ['Đơn giá bán ra (VND) (*)', 'Đơn giá bán ra (VND)', 'Đơn giá bán', 'sellingPrice']);
          const isThreePhaseRaw = (getRowValue(row, ['Điện 3 Pha (Có/Không) (*)', 'Điện 3 Pha (Có/Không)', 'Điện 3 Pha', 'isThreePhase']) || '').toString().trim().toLowerCase();
          const stockRaw = getRowValue(row, ['Số lượng tồn kho ban đầu (*)', 'Số lượng tồn kho ban đầu', 'Tồn kho', 'stock']);
          const minStockRaw = getRowValue(row, ['Số lượng tối thiểu cảnh báo (*)', 'Số lượng tối thiểu cảnh báo', 'Cảnh báo tối thiểu', 'minStock']);
          const location = (getRowValue(row, ['Vị trí lưu kho (*)', 'Vị trí lưu kho', 'Vị trí', 'location']) || 'Chưa định vị').toString().trim();
          const details = (getRowValue(row, ['Mô tả chi tiết', 'Mô tả', 'details']) || '').toString().trim();
          const unitRaw = (getRowValue(row, ['Đơn vị tính (*)', 'Đơn vị tính', 'Đơn vị', 'unit']) || '').toString().trim();

          if (!typeRaw) {
            errors.push('Thiếu thông tin Loại thiết bị.');
          } else if (!allowedTypes.includes(typeRaw)) {
            errors.push(`Loại thiết bị "${typeRaw}" không hợp lệ. Phải thuộc: panel, inverter, battery, mounting, accessory, other`);
          }

          if (!brand) errors.push('Thiếu thương hiệu vật tư.');
          if (!model) errors.push('Thiếu mã model sản phẩm.');

          const capacity = capacityRaw !== undefined ? Number(capacityRaw) : 0;
          if (isNaN(capacity) || capacity < 0) {
            errors.push('Công suất không hợp lệ (phải là số >= 0).');
          }

          const unitPrice = unitPriceRaw !== undefined ? Number(unitPriceRaw) : 0;
          if (isNaN(unitPrice) || unitPrice < 0) {
            errors.push('Đơn giá nhập không hợp lệ (phải là số >= 0).');
          }

          const sellingPrice = sellingPriceRaw !== undefined ? Number(sellingPriceRaw) : 0;
          if (isNaN(sellingPrice) || sellingPrice < 0) {
            errors.push('Đơn giá bán không hợp lệ (phải là số >= 0).');
          }

          const stock = stockRaw !== undefined ? Number(stockRaw) : 0;
          if (isNaN(stock) || stock < 0) {
            errors.push('Số lượng tồn kho không hợp lệ (phải là số >= 0).');
          }

          const minStock = minStockRaw !== undefined ? Number(minStockRaw) : 0;
          if (isNaN(minStock) || minStock < 0) {
            errors.push('Sản lượng tối thiểu cảnh báo không hợp lệ (phải là số >= 0).');
          }

          const isThreePhase = isThreePhaseRaw === 'có' || isThreePhaseRaw === 'co' || isThreePhaseRaw === 'yes' || isThreePhaseRaw === 'true';

          const itemData: Partial<Equipment> = {
            type: typeRaw as any,
            brand,
            model,
            capacity,
            unitPrice,
            sellingPrice,
            isThreePhase,
            stock,
            minStock,
            location,
            details,
            unit: unitRaw || ''
          };

          return {
            data: itemData,
            errors,
            rowNum,
            isValid: errors.length === 0
          };
        });

        setParsedItems(items);
      } catch (err) {
        console.error('Error parsing uploaded file:', err);
        setImportError('Định dạng tệp không được hỗ trợ hoặc bị hỏng. Vui lòng thử lại.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Commit valid Excel rows to Firestore db
  const handleCommitImport = async () => {
    const validItems = parsedItems.filter(x => x.isValid);
    if (validItems.length === 0) {
      setImportError('Không tìm thấy bản ghi hợp lệ nào để tiến hành nhập.');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      let importedCount = 0;
      for (const item of validItems) {
        const dataToSave = {
          ...item.data,
          history: [] as any[]
        };

        // Write first movement log if stock > 0
        if (dataToSave.stock && dataToSave.stock > 0) {
          const initialLog = {
            id: Math.random().toString(36).substring(7),
            type: 'import' as const,
            quantity: dataToSave.stock,
            note: 'Tạo danh mục mới bằng phương thức nhập Excel',
            createdAt: new Date().toISOString(),
            createdBy: userId!,
            createdByName: userName
          };
          dataToSave.history = [initialLog];
        }

        await addDoc(collection(db, 'equipment'), dataToSave);
        importedCount++;
      }

      // Add general notification in feed
      await addDoc(collection(db, 'notifications'), {
        title: '📥 NHẬP KHẨU KHO THIẾT BỊ',
        message: `${userName} (Kế Toán) đã nhập khẩu thành công ${importedCount} thiết bị solar từ file Excel vào cơ sở dữ liệu kho.`,
        type: 'task',
        createdAt: serverTimestamp(),
        createdBy: userId!,
        createdByName: userName
      });

      setImportSuccess(`Nhập khẩu thành công ${importedCount} thiết bị mới vào kho.`);
      setParsedItems([]);
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportSuccess(null);
      }, 2000);

    } catch (err) {
      console.error('Firestore import commit error:', err);
      setImportError('Không thể lưu thông tin vật tư lên hệ thống database.');
    } finally {
      setIsImporting(false);
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

  // Pagination calculations
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredEquipment.length);
  const paginatedEquipment = React.useMemo(() => {
    return filteredEquipment.slice(startIndex, endIndex);
  }, [filteredEquipment, startIndex, endIndex]);
  const totalPages = Math.max(1, Math.ceil(filteredEquipment.length / pageSize));

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      let start = Math.max(1, currentPage - 2);
      let end = Math.min(totalPages, currentPage + 2);
      if (start === 1) {
        end = maxVisible;
      } else if (end === totalPages) {
        start = totalPages - maxVisible + 1;
      }
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

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
          <div className="flex flex-wrap items-center gap-3">
            {(userRole === 'accountant' || userRole === 'admin' || userRole === 'manager') && (
              <button 
                onClick={() => {
                  setParsedItems([]);
                  setImportError(null);
                  setImportSuccess(null);
                  setIsImportModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-xl transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" /> Nhập kho từ Excel
              </button>
            )}
            <button 
              onClick={() => {
                setEditingItem({ type: 'panel', brand: '', model: '', capacity: 0, unitPrice: 0, sellingPrice: 0, details: '', stock: 0, minStock: 5, location: 'Khu A', unit: '' });
                setIsEditModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-xl transition-all active:scale-95 shrink-0"
            >
              <Plus className="h-4 w-4" /> Khai báo vật tư mới
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('inventory')}
          className={cn(
            "px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
            activeTab === 'inventory' 
              ? "border-blue-600 text-blue-600 bg-blue-50/25" 
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          )}
        >
          <Warehouse className="h-4 w-4" /> Danh mục & Tồn kho
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            "px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 relative",
            activeTab === 'requests' 
              ? "border-blue-600 text-blue-600 bg-blue-50/25" 
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          )}
        >
          <FileText className="h-4 w-4" /> Phiếu yêu cầu vật tư
          {materialRequests.filter(r => r.status === 'pending').length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-md">
              {materialRequests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
        {(userRole === 'accountant' || userRole === 'admin' || userRole === 'manager') && (
          <button
            onClick={() => setActiveTab('proposals')}
            className={cn(
              "px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 relative",
              activeTab === 'proposals' 
                ? "border-blue-600 text-blue-600 bg-blue-50/25" 
                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
            )}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" /> Đề nghị nhập vật tư
            {purchaseProposals.filter(p => p.status === 'pending').length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-md">
                {purchaseProposals.filter(p => p.status === 'pending').length}
              </span>
            )}
          </button>
        )}
      </div>

      {activeTab === 'inventory' && (
        <>
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
        {(userRole === 'admin' || userRole === 'accountant') && (
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giá Trị Tồn Kho Ước Tính</p>
              <h3 className="text-xl font-black text-emerald-600 mt-0.5">{formatCurrency(stats.totalValue)}</h3>
            </div>
          </div>
        )}

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

      {/* Paginated Material Table List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 text-center w-12">STT</th>
                <th className="py-3.5 px-4 min-w-[200px]">Vật tư / Thiết bị</th>
                <th className="py-3.5 px-4 w-44">Danh mục</th>
                <th className="py-3.5 px-4 w-36">Vị trí</th>
                <th className="py-3.5 px-4 w-52">Tồn kho / Định mức</th>
                {(userRole === 'admin' || userRole === 'accountant') ? (
                  <th className="py-3.5 px-4 w-48">Đơn giá (Nhập / Bán)</th>
                ) : (
                  <th className="py-3.5 px-4 w-36">Giá bán dự kiến</th>
                )}
                <th className="py-3.5 px-4 text-right min-w-[180px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedEquipment.map((item, index) => {
                const qty = item.stock || 0;
                const min = item.minStock || 0;
                const actualIndex = startIndex + index + 1;
                
                let alertStatus: 'normal' | 'low' | 'out' = 'normal';
                if (qty === 0) {
                  alertStatus = 'out';
                } else if (qty <= min) {
                  alertStatus = 'low';
                }

                const catObj = categories.find(c => c.id === item.type);
                const CatIcon = catObj?.icon || Box;
                const catLabel = catObj?.label || 'Thiết bị khác';

                return (
                  <tr 
                    key={item.id} 
                    className={cn(
                      "hover:bg-slate-50/75 transition-all group",
                      alertStatus === 'out' ? "bg-rose-50/5" : 
                      alertStatus === 'low' ? "bg-amber-50/5" : ""
                    )}
                  >
                    {/* STT */}
                    <td className="py-4 px-4 text-center text-xs font-bold text-slate-400">
                      {actualIndex}
                    </td>

                    {/* Vật tư / Thiết bị */}
                    <td className="py-4 px-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                          item.type === 'panel' ? "bg-amber-50/50 text-amber-600 border-amber-100" : 
                          item.type === 'inverter' ? "bg-blue-50/50 text-blue-600 border-blue-100" : 
                          item.type === 'battery' ? "bg-emerald-50/50 text-emerald-600 border-emerald-100" : 
                          item.type === 'mounting' ? "bg-purple-50/50 text-purple-600 border-purple-100" : "bg-slate-50/50 text-slate-500 border-slate-100"
                        )}>
                          {item.type === 'panel' ? <Package className="h-4.5 w-4.5" /> : 
                           item.type === 'inverter' ? <Cpu className="h-4.5 w-4.5" /> : 
                           item.type === 'battery' ? <Battery className="h-4.5 w-4.5" /> : <Box className="h-4.5 w-4.5" />}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
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
                          <h4 className="text-xs font-black text-slate-800 leading-tight">
                            {item.model}
                          </h4>
                          {item.details && (
                            <p className="text-[10px] text-slate-400 font-semibold italic max-w-xs md:max-w-md truncate" title={item.details}>
                              {item.details}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Danh mục */}
                    <td className="py-4 px-4">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border",
                        item.type === 'panel' ? "bg-amber-50 text-amber-700 border-amber-25" : 
                        item.type === 'inverter' ? "bg-blue-50 text-blue-700 border-blue-25" : 
                        item.type === 'battery' ? "bg-emerald-50 text-emerald-700 border-emerald-25" : 
                        item.type === 'mounting' ? "bg-purple-50 text-purple-700 border-purple-25" : "bg-slate-50 text-slate-600 border-slate-150"
                      )}>
                        <CatIcon className="h-3 w-3 shrink-0" />
                        {catLabel}
                      </span>
                    </td>

                    {/* Vị trí */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1 text-xs text-slate-600 font-bold">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{item.location || 'Chưa phân phái'}</span>
                      </div>
                    </td>

                    {/* Tồn kho / Định mức */}
                    <td className="py-4 px-4">
                      <div className="space-y-1.5 max-w-[160px]">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className={cn(
                            "font-black tracking-tight",
                            alertStatus === 'out' ? "text-rose-600 animate-pulse bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100" : 
                            alertStatus === 'low' ? "text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100" : "text-slate-800"
                          )}>
                            {qty} {getUnit(item)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            Min: {min} {getUnit(item)}
                          </span>
                        </div>
                        {/* Micro progress bar */}
                        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              alertStatus === 'out' ? "w-0" :
                              alertStatus === 'low' ? "bg-amber-400" : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(100, (qty / Math.max(1, min * 2.5)) * 100)}%` }}
                          />
                        </div>
                        {/* Short status label */}
                        <div className="text-[8px] font-black tracking-wide uppercase leading-none">
                          {alertStatus === 'out' && <span className="text-rose-500">🔴 Hết hàng - Cần nhập</span>}
                          {alertStatus === 'low' && <span className="text-amber-500">🟡 Dưới định mức</span>}
                          {alertStatus === 'normal' && <span className="text-emerald-500">🟢 Kho an toàn</span>}
                        </div>
                      </div>
                    </td>

                    {/* Đơn giá */}
                    <td className="py-4 px-4">
                      <div className="text-xs space-y-1">
                        {(userRole === 'admin' || userRole === 'accountant') ? (
                          <>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400 font-semibold">Nhập:</span>
                              <span className="font-bold text-slate-800">{formatCurrency(item.unitPrice || 0)}</span>
                            </div>
                            <div className="flex justify-between gap-2 border-t border-slate-100 pt-1">
                              <span className="text-slate-400 font-semibold">Bán:</span>
                              <span className="font-bold text-emerald-600">{item.sellingPrice ? formatCurrency(item.sellingPrice) : 'Chưa bán'}</span>
                            </div>
                          </>
                        ) : (
                          <div className="font-bold text-emerald-600">
                            {item.sellingPrice ? formatCurrency(item.sellingPrice) : 'Chưa thiết lập'}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Hành động / Thao tác */}
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Warehouse flow adjust */}
                        {isAdmin ? (
                          <>
                            <button 
                              onClick={() => {
                                setAdjustItem(item);
                                setAdjustType('import');
                                setIsAdjustModalOpen(true);
                              }}
                              className="bg-blue-50/75 hover:bg-blue-100 text-blue-700 border border-blue-100 p-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                              title="Nhập thêm vật tư"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">Nhập kho</span>
                            </button>
                            <button 
                              onClick={() => {
                                setAdjustItem(item);
                                setAdjustType('export');
                                setIsAdjustModalOpen(true);
                              }}
                              disabled={qty === 0}
                              className={cn(
                                "p-1.5 border rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1 cursor-pointer",
                                qty === 0 
                                  ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed" 
                                  : "bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700"
                              )}
                              title="Xuất vật tư ra kho"
                            >
                              <ArrowDownLeft className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">Xuất kho</span>
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => {
                              handleOpenRequestWithItem(item);
                            }}
                            disabled={qty === 0}
                            className={cn(
                              "py-1.5 px-2.5 border rounded-lg text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1 cursor-pointer",
                              qty === 0 
                                ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed" 
                                : "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700"
                            )}
                            title="Tạo phiếu yêu cầu cấp phát vật tư này"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Yêu cầu cấp phát</span>
                          </button>
                        )}

                        {/* History button */}
                        <button 
                          onClick={() => {
                            setHistoryItem(item);
                            setIsHistoryModalOpen(true);
                          }}
                          className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg flex items-center justify-center transition-all active:scale-95 cursor-pointer"
                          title="Xem lịch sử luân chuyển kho"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>

                        {/* Edit & Delete for Admin */}
                        {isAdmin && (
                          <div className="flex items-center border-l border-slate-200 pl-1.5 gap-1">
                            <button 
                              onClick={() => { setEditingItem(item); setIsEditModalOpen(true); }}
                              title="Chỉnh sửa thông số"
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer border border-transparent"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button 
                              onClick={() => setDeletingId(item.id)}
                              title="Xóa vật tư"
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer border border-transparent"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State within list container */}
        {filteredEquipment.length === 0 && (
          <div className="py-16 text-center border-t border-slate-100">
            <Box className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-semibold italic">Không tìm thấy mã thiết bị nào phù hợp trong kho.</p>
            <p className="text-slate-300 text-xs mt-1">Vui lòng thử cấu hình lại thanh tìm kiếm hoặc bộ lọc trạng thái.</p>
          </div>
        )}

        {/* Pagination & Page Size Footer */}
        {filteredEquipment.length > 0 && (
          <div className="bg-slate-50/80 px-5 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Left: Entries size selector and counting text */}
            <div className="flex flex-col sm:flex-row items-center gap-3 text-xs text-slate-500 font-semibold">
              <div className="flex items-center gap-1.5">
                <span>Hiển thị</span>
                <select 
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>vật tư mỗi trang</span>
              </div>
              <span className="hidden sm:inline text-slate-300">|</span>
              <p>
                Đang xem <span className="text-slate-800 font-extrabold">{startIndex + 1}</span> đến <span className="text-slate-800 font-extrabold">{endIndex}</span> trong tổng số <span className="text-blue-600 font-black">{filteredEquipment.length}</span> vật tư
              </p>
            </div>

            {/* Right: Pagination Page Buttons */}
            <div className="flex items-center gap-1">
              {/* Go to First Page */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className={cn(
                  "p-2 rounded-lg border text-slate-500 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                  currentPage === 1 ? "bg-slate-50" : "bg-white"
                )}
                title="Trang đầu"
              >
                <ChevronsLeft className="h-4 w-4" />
              </button>

              {/* Go to Previous Page */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={cn(
                  "p-2 rounded-lg border text-slate-500 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                  currentPage === 1 ? "bg-slate-50" : "bg-white"
                )}
                title="Trang trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {/* Page numbers */}
              {getPageNumbers().map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={cn(
                    "w-8 h-8 rounded-lg border text-xs font-extrabold transition-all cursor-pointer",
                    currentPage === pageNum 
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm" 
                      : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-slate-200"
                  )}
                >
                  {pageNum}
                </button>
              ))}

              {/* Go to Next Page */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={cn(
                  "p-2 rounded-lg border text-slate-500 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                  currentPage === totalPages ? "bg-slate-50" : "bg-white"
                )}
                title="Trang sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              {/* Go to Last Page */}
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className={cn(
                  "p-2 rounded-lg border text-slate-500 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                  currentPage === totalPages ? "bg-slate-50" : "bg-white"
                )}
                title="Trang cuối"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
        </>
      )}

      {activeTab === 'requests' && (
        printingRequest ? (
          <PrintRequestView request={printingRequest} onClose={() => setPrintingRequest(null)} equipmentList={equipmentList} />
        ) : isCreatingRequest ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Left Column (Selector & Items Table) */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[500px]">
              {/* Header block with F3 Search */}
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                <button 
                  onClick={() => {
                    setIsCreatingRequest(false);
                    setRequestReason('');
                    setRequestProjectId('');
                    setRequestItems([]);
                    setSelectedEqId('');
                    setSelectedEqQty(1);
                    setEditingRequestId(null);
                  }}
                  className="flex items-center gap-2 text-[#1e3a8a] hover:text-blue-700 font-extrabold transition-all group shrink-0"
                >
                  <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="text-base tracking-tight font-black uppercase">Chọn vật tư</span>
                </button>

                {/* Search Bar matching image */}
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="request-search-input"
                    type="text"
                    value={searchQueryInRequest}
                    onChange={e => setSearchQueryInRequest(e.target.value)}
                    placeholder="Tìm hàng hóa theo mã hoặc tên (F3)"
                    className="w-full pl-9 pr-14 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-all font-bold text-slate-800 shadow-3xs"
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                    <span className="p-1 rounded bg-slate-200/60 text-[9px] font-black text-slate-500 cursor-pointer select-none">
                      ::
                    </span>
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingItem({
                          brand: searchQueryInRequest.trim() || '',
                          model: '',
                          type: 'panel',
                          capacity: 0,
                          unitPrice: 0,
                          sellingPrice: 0,
                          details: '',
                          stock: 0,
                          minStock: 5,
                          location: 'Chưa định vị',
                          unit: 'cái'
                        });
                        setIsEditModalOpen(true);
                      }}
                      className="text-slate-500 hover:text-blue-600 font-black p-1 text-sm bg-slate-200/40 hover:bg-slate-200/80 rounded transition-all cursor-pointer h-5 w-5 flex items-center justify-center font-sans"
                      title="Thêm mới vật tư"
                    >
                      +
                    </button>
                  </div>

                  {/* Dropdown with results when searching */}
                  {searchQueryInRequest && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-40 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-100">
                      {equipmentList.filter(eq => 
                        eq.brand.toLowerCase().includes(searchQueryInRequest.toLowerCase()) ||
                        eq.model.toLowerCase().includes(searchQueryInRequest.toLowerCase()) ||
                        (eq.type || '').toLowerCase().includes(searchQueryInRequest.toLowerCase())
                      ).length === 0 ? (
                        <div className="p-4 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                          <p className="italic font-medium">Không tìm thấy vật tư phù hợp</p>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem({
                                brand: searchQueryInRequest.trim() || '',
                                model: '',
                                type: 'panel',
                                capacity: 0,
                                unitPrice: 0,
                                sellingPrice: 0,
                                details: '',
                                stock: 0,
                                minStock: 5,
                                location: 'Chưa định vị',
                                unit: 'cái'
                              });
                              setIsEditModalOpen(true);
                              setSearchQueryInRequest('');
                            }}
                            className="mt-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Plus className="h-3 w-3 stroke-[2.5]" /> Khai báo vật tư mới
                          </button>
                        </div>
                      ) : (
                        equipmentList.filter(eq => 
                          eq.brand.toLowerCase().includes(searchQueryInRequest.toLowerCase()) ||
                          eq.model.toLowerCase().includes(searchQueryInRequest.toLowerCase()) ||
                          (eq.type || '').toLowerCase().includes(searchQueryInRequest.toLowerCase())
                        ).map(eq => {
                          const isOutOfStock = (eq.stock || 0) <= 0;
                          return (
                            <button
                              key={eq.id}
                              type="button"
                              onClick={() => {
                                const existing = requestItems.find(ri => ri.equipmentId === eq.id);
                                if (existing) {
                                  setRequestItems(prev => prev.map(ri => 
                                    ri.equipmentId === eq.id ? { ...ri, quantity: ri.quantity + 1 } : ri
                                  ));
                                } else {
                                  setRequestItems(prev => [...prev, {
                                    equipmentId: eq.id,
                                    brand: eq.brand,
                                    model: eq.model,
                                    type: eq.type,
                                    quantity: 1,
                                    unit: eq.unit
                                  }]);
                                }
                                setSearchQueryInRequest('');
                              }}
                              className={cn(
                                "w-full text-left p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs cursor-pointer",
                                isOutOfStock && "bg-rose-50/60 hover:bg-rose-100/60 text-rose-900 border-l-2 border-rose-500"
                              )}
                            >
                              <div>
                                <span className="font-extrabold text-slate-800">{eq.brand} - {eq.model}</span>
                                <span className="ml-2 text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase">({eq.type})</span>
                              </div>
                              <div className="text-[11px] font-bold text-slate-500">
                                {isOutOfStock ? (
                                  <span className="text-rose-500 font-extrabold">Hết hàng</span>
                                ) : (
                                  <>Còn lại: <span className="text-blue-600 font-extrabold">{eq.stock}</span> {getUnit(eq)}</>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Table Header matching image */}
              <div className="bg-[#eef2ff] text-[#1e3a8a] text-[11px] font-black grid grid-cols-12 px-4 py-3 border-b border-slate-200 tracking-wider uppercase">
                <div className="col-span-1 text-center">STT</div>
                <div className="col-span-2">Mã hàng</div>
                <div className="col-span-5">Tên hàng</div>
                <div className="col-span-2 text-center">ĐVT</div>
                <div className="col-span-2 text-center">Số lượng</div>
              </div>

              {/* Table Content */}
              <div className="flex-1 overflow-y-auto min-h-[300px] flex flex-col justify-between bg-white">
                {requestItems.length === 0 ? (
                  /* Excel import empty state from screenshot */
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[320px]">
                    <div className="max-w-sm">
                      <p className="text-sm font-black text-slate-800">Thêm sản phẩm từ file excel</p>
                      <button 
                        onClick={handleDownloadSampleRequestFile}
                        className="text-xs text-[#0066ff] hover:underline mt-1 font-semibold flex items-center justify-center gap-1 mx-auto"
                      >
                        (Tải về file mẫu: <span className="font-bold underline text-blue-600">Excel file</span>)
                      </button>

                      <div className="mt-5">
                        <label className="bg-[#0066ff] hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer">
                          <FileSpreadsheet className="h-4 w-4" />
                          Chọn file dữ liệu
                          <input 
                            type="file" 
                            accept=".csv,.txt" 
                            onChange={handleImportRequestFile}
                            className="hidden" 
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* List of added items in table rows */
                  <div className="divide-y divide-slate-100 flex-1">
                    {requestItems.map((item, index) => {
                      const eq = equipmentList.find(e => e.id === item.equipmentId);
                      const isOutOfStock = eq ? (eq.stock || 0) <= 0 : true;
                      return (
                        <div key={item.equipmentId} className={cn(
                          "grid grid-cols-12 px-4 py-2.5 text-xs font-semibold hover:bg-slate-50/40 transition-colors items-center animate-in fade-in duration-100",
                          isOutOfStock 
                            ? "bg-rose-50/80 text-rose-900 border-l-4 border-rose-500" 
                            : "text-slate-700"
                        )}>
                          <div className="col-span-1 text-center font-bold text-slate-400">{index + 1}</div>
                          <div className="col-span-2 font-mono text-slate-500 font-bold uppercase">{item.equipmentId.substring(0, 8).toUpperCase()}</div>
                          <div className="col-span-5">
                            <span className="font-extrabold text-slate-800">{item.brand}</span>
                            <span className="mx-1.5 text-slate-400">•</span>
                            <span className="font-medium text-slate-600">{item.model}</span>
                            {isOutOfStock && (
                              <span className="ml-2 text-[9px] font-black uppercase text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded tracking-wider">Hết tồn kho</span>
                            )}
                          </div>
                        <div className="col-span-2 text-center uppercase tracking-wider text-[11px] text-slate-500 font-bold">
                          {item.unit || getUnit(item)}
                        </div>
                        <div className="col-span-2 flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => {
                              setRequestItems(prev => prev.map(ri => 
                                ri.equipmentId === item.equipmentId 
                                  ? { ...ri, quantity: Math.max(1, ri.quantity - 1) } 
                                  : ri
                              ));
                            }}
                            className="w-5 h-5 bg-slate-100 text-slate-600 rounded flex items-center justify-center hover:bg-slate-200 transition-all font-black text-xs active:scale-90"
                          >
                            -
                          </button>
                          <input 
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setRequestItems(prev => prev.map(ri => 
                                ri.equipmentId === item.equipmentId ? { ...ri, quantity: val } : ri
                              ));
                            }}
                            className="w-10 text-center text-xs font-black text-slate-800 border border-slate-200 rounded py-0.5 outline-none focus:border-blue-500"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              setRequestItems(prev => prev.map(ri => 
                                ri.equipmentId === item.equipmentId 
                                  ? { ...ri, quantity: ri.quantity + 1 } 
                                  : ri
                              ));
                            }}
                            className="w-5 h-5 bg-slate-100 text-slate-600 rounded flex items-center justify-center hover:bg-slate-200 transition-all font-black text-xs active:scale-90"
                          >
                            +
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleRemoveRequestItem(item.equipmentId)}
                            className="text-rose-500 hover:text-rose-700 ml-1.5 p-1 transition-colors"
                            title="Xóa vật tư"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ); })}
                  </div>
                )}


              </div>
            </div>

            {/* Right Column (Slip form details) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col gap-4">
                {/* User dropdown & current time */}
                <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-xl text-[11px] font-black text-slate-700 uppercase tracking-tight">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>Kỹ Thuật</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>

                  <div className="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl font-mono">
                    {new Date().toLocaleString('vi-VN', { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric' 
                    })}
                  </div>
                </div>

                {/* Search project block */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tìm tên công trình</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        const name = prompt("Nhập tên công trình mới để liên kết:");
                        if (name) {
                          const newProj = { id: 'temp-' + Date.now(), name: name };
                          setProjectsList(prev => [newProj, ...prev]);
                          setRequestProjectId(newProj.id);
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 p-0.5"
                      title="Tạo công trình mới"
                    >
                      <Plus className="h-4 w-4 stroke-[3]" />
                    </button>
                  </div>
                  <select
                    value={requestProjectId}
                    onChange={e => setRequestProjectId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="">-- Chọn công trình cần liên kết --</option>
                    {projectsList.map(p => {
                      const cust = customers[p.customerId];
                      const name = cust ? `Công trình ${cust.name}` : (p.name || p.customerName || 'Dự án không tên');
                      return (
                        <option key={p.id} value={p.id}>{name}</option>
                      );
                    })}
                  </select>
                </div>

                {/* Mã phiếu block */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Mã phiếu</label>
                  <input
                    type="text"
                    value={editingRequestId ? `Bản nháp: #${editingRequestId.substring(0, 6).toUpperCase()}` : "Mã phiếu tự động"}
                    disabled
                    className="w-full p-2.5 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold text-slate-400 select-none outline-none"
                  />
                </div>

                {/* Trạng thái row */}
                <div className="flex justify-between items-center border-y border-dashed border-slate-100 py-3 text-xs">
                  <span className="text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Trạng thái</span>
                  <span className="text-[#1e3a8a] font-black bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-lg text-[10px] uppercase">
                    {editingRequestId ? "Bản nháp" : "Phiếu tạm"}
                  </span>
                </div>

                {/* Reason/Notes block */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Ghi chú</label>
                  <textarea
                    required
                    value={requestReason}
                    onChange={e => setRequestReason(e.target.value)}
                    placeholder="Nhập ghi chú hoặc lý do cấp phát vật tư cụ thể..."
                    rows={4}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-500 focus:bg-white bg-slate-50 transition-all resize-none font-semibold text-slate-700 shadow-3xs"
                  />
                </div>

                {/* Submit button footer */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={requestItems.length === 0}
                    onClick={() => handleCreateMaterialRequest(undefined, 'draft')}
                    className={cn(
                      "py-2.5 border rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer",
                      requestItems.length === 0
                        ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                        : "border-blue-600 bg-white hover:bg-blue-50 text-blue-600"
                    )}
                  >
                    Lưu tạm
                  </button>
                  <button
                    type="button"
                    disabled={requestItems.length === 0}
                    onClick={(e) => handleCreateMaterialRequest(e, 'pending')}
                    className={cn(
                      "py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-md cursor-pointer",
                      requestItems.length === 0 
                        ? "bg-slate-300 cursor-not-allowed shadow-none" 
                        : "bg-[#0066ff] hover:bg-blue-600 shadow-blue-100 hover:shadow-lg"
                    )}
                  >
                    Hoàn thành
                  </button>
                </div>

                {/* Hotline bar */}
                <div className="flex justify-center items-center gap-1.5 text-slate-500 text-[11px] font-black uppercase tracking-wider pt-3 border-t border-slate-100">
                  <Phone className="h-3.5 w-3.5 text-blue-500 stroke-[3]" />
                  <span>Tổng đài: 0915 586 234</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* List of requests when not creating */
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Requests Header and Create button */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" /> Quản Lý Phiếu Yêu Cầu Vật Tư
                </h3>
                <p className="text-xs text-slate-500 mt-1">Yêu cầu cấp phát vật tư để thi công và lắp đặt dự án. Sau khi tạo sẽ gửi thông báo đến Admin & Quản lý phê duyệt.</p>
              </div>
              <button
                onClick={() => setIsCreatingRequest(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 shrink-0"
              >
                <Plus className="h-4 w-4" /> Tạo phiếu yêu cầu mới
              </button>
            </div>

            {/* List of Material Requests */}
            <div className="space-y-4">
              {requestsLoading ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                  <p className="text-slate-500 text-xs italic">Đang tải danh sách phiếu yêu cầu...</p>
                </div>
              ) : materialRequests.length === 0 ? (
                <div className="py-16 text-center bg-white border border-dashed border-slate-200 rounded-2xl shadow-xs">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-medium italic">Không có phiếu yêu cầu vật tư nào.</p>
                  <p className="text-slate-300 text-xs mt-1">Hãy nhấn "Tạo phiếu yêu cầu mới" để bắt đầu đề xuất cấp phát.</p>
                </div>
              ) : (
                materialRequests.map((req) => {
                  const dateStr = req.createdAt?.toDate 
                    ? req.createdAt.toDate().toLocaleString('vi-VN') 
                    : req.createdAt 
                      ? new Date(req.createdAt).toLocaleString('vi-VN') 
                      : 'Đang xử lý...';
                  
                  const resolvedDateStr = req.resolvedAt?.toDate 
                    ? req.resolvedAt.toDate().toLocaleString('vi-VN') 
                    : req.resolvedAt 
                      ? new Date(req.resolvedAt).toLocaleString('vi-VN') 
                      : '';

                  return (
                    <div 
                      key={req.id}
                      className={cn(
                        "bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col justify-between",
                        req.status === 'pending' ? "border-amber-200 hover:shadow-amber-50" : 
                        req.status === 'approved' ? "border-emerald-200 hover:shadow-emerald-50" : 
                        req.status === 'draft' ? "border-blue-200 hover:shadow-blue-50" :
                        "border-rose-200 hover:shadow-rose-50"
                      )}
                    >
                      {/* Slip Header */}
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border",
                              req.status === 'pending' ? "bg-amber-50 border-amber-200 text-amber-700" :
                              req.status === 'approved' ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                              req.status === 'draft' ? "bg-blue-50 border-blue-200 text-blue-700" :
                              "bg-rose-50 border-rose-200 text-rose-700"
                            )}>
                              {req.status === 'pending' ? '🟡 Chờ duyệt' : 
                               req.status === 'approved' ? '🟢 Đã duyệt' : 
                               req.status === 'draft' ? '🔵 Bản nháp' : '🔴 Từ chối'}
                            </span>
                            <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                              Mã phiếu: #{req.id?.substring(0, 6).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400 font-bold uppercase tracking-tight">
                            <span className="text-slate-600 font-extrabold">{req.technicianName}</span>
                            <span>•</span>
                            <span>{dateStr}</span>
                            {req.projectName && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                  <Briefcase className="h-3 w-3" /> {req.projectName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Approve / Reject buttons for Admin/Manager */}
                        {req.status === 'pending' && isAdmin && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setResolvingRequest(req);
                                setResolveAction('approve');
                                setAdminNote('');
                                setIsResolveModalOpen(true);
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3.5 py-1.5 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 animate-in fade-in"
                            >
                              <Check className="h-3.5 w-3.5" /> Phê duyệt
                            </button>
                            <button
                              onClick={() => {
                                setResolvingRequest(req);
                                setResolveAction('reject');
                                setAdminNote('');
                                setIsResolveModalOpen(true);
                              }}
                              className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-3.5 py-1.5 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 animate-in"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Từ chối
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Slip Body - Requested Items */}
                      <div className="py-4 space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Danh sách thiết bị yêu cầu cấp phát:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {req.items?.map((item: any, idx: number) => {
                            const isOutOfStock = item.isOutOfStock || false;
                            return (
                              <div key={idx} className={cn(
                                "p-3 rounded-xl border flex items-center justify-between transition-all",
                                isOutOfStock 
                                  ? "bg-rose-50 border-rose-200 text-rose-900 shadow-3xs" 
                                  : "bg-slate-50 border-slate-100 text-slate-800"
                              )}>
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                                    {item.type === 'panel' ? <Package className="h-4 w-4 text-amber-500" /> :
                                     item.type === 'inverter' ? <Cpu className="h-4 w-4 text-blue-500" /> :
                                     item.type === 'battery' ? <Battery className="h-4 w-4 text-emerald-500" /> :
                                     <Box className="h-4 w-4 text-slate-500" />}
                                  </div>
                                  <div>
                                    <span className={cn(
                                      "text-[8px] font-black tracking-widest uppercase block",
                                      isOutOfStock ? "text-rose-400" : "text-slate-400"
                                    )}>{item.brand}</span>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-black line-clamp-1">{item.model}</span>
                                      {isOutOfStock && (
                                        <span className="text-[8px] font-black uppercase text-rose-600 bg-rose-100 px-1 rounded">Hết hàng</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] font-black text-slate-400 block uppercase">Số lượng</span>
                                  <span className="text-sm font-black">{item.quantity} {getUnit(item)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="bg-slate-50/50 p-3.5 rounded-xl border border-dashed mt-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lý do yêu cầu:</p>
                          <p className="text-xs text-slate-700 font-medium mt-1 italic">"{req.reason || 'Không có lý do chi tiết'}"</p>
                        </div>
                      </div>

                      {/* Unified Actions Footer */}
                      <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 mt-3">
                        <button
                          type="button"
                          onClick={() => setPrintingRequest(req)}
                          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                        >
                          <Printer className="h-3.5 w-3.5" /> In phiếu
                        </button>

                        {(req.status === 'draft' || req.status === 'pending') && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                // Populate form with request values to edit/update
                                setRequestProjectId(req.projectId || '');
                                setRequestReason(req.reason || '');
                                setRequestItems(req.items || []);
                                setEditingRequestId(req.id);
                                setIsCreatingRequest(true);
                              }}
                              className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                            >
                              <FolderOpen className="h-3.5 w-3.5" /> Mở phiếu
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm("Bạn có chắc chắn muốn xóa phiếu yêu cầu vật tư này?")) {
                                  try {
                                    await deleteDoc(doc(db, 'material_requests', req.id));
                                    alert("Đã xóa phiếu yêu cầu thành công!");
                                  } catch (err) {
                                    console.error("Error deleting material request:", err);
                                  }
                                }
                              }}
                              className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Xóa phiếu
                            </button>
                          </>
                        )}
                      </div>

                      {/* Slip Resolution details */}
                      {req.status !== 'pending' && req.status !== 'draft' && (
                        <div className={cn(
                          "mt-2 p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs",
                          req.status === 'approved' ? "bg-emerald-50/40 border-emerald-100" : "bg-rose-50/40 border-rose-100"
                        )}>
                          <div>
                            <p className="font-black text-slate-800">
                              {req.status === 'approved' ? '✅ Được phê duyệt bởi' : '❌ Bị từ chối bởi'} <span className="text-blue-600 font-extrabold">{req.resolvedBy}</span> vào {resolvedDateStr}
                            </p>
                            {req.adminNote && (
                              <p className="text-slate-600 mt-1.5 font-medium italic">
                                Phản hồi: "{req.adminNote}"
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                );
              })
            )}
            </div>
          </div>
        )
      )}

      {activeTab === 'proposals' && (userRole === 'accountant' || userRole === 'admin' || userRole === 'manager') && (
        printingProposals ? (
          <PrintProposalsView proposals={printingProposals} onClose={() => setPrintingProposals(null)} />
        ) : (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Header block */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Đề nghị nhập vật tư (Kế toán)
                </h2>
                <p className="text-slate-500 text-xs mt-1.5 font-medium">
                  Danh sách các yêu cầu mua sắm, nhập kho tự động được tách ra từ phiếu yêu cầu thi công của Kỹ thuật do sản phẩm đã hết hàng trong kho.
                </p>
              </div>

              {/* Multi-select printing controls */}
              {purchaseProposals.length > 0 && (
                <div className="flex items-center gap-2 self-stretch md:self-auto justify-end shrink-0">
                  {selectedProposals.length > 0 ? (
                    <>
                      <button
                        onClick={() => setSelectedProposals([])}
                        className="text-slate-500 hover:text-slate-800 text-[10px] font-black uppercase tracking-wider px-3.5 py-2 rounded-xl border border-slate-200 transition-all active:scale-95 cursor-pointer bg-white shadow-xs"
                      >
                        Bỏ chọn ({selectedProposals.length})
                      </button>
                      <button
                        onClick={() => {
                          const proposalsToPrint = purchaseProposals.filter(p => selectedProposals.includes(p.id));
                          setPrintingProposals(proposalsToPrint);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" /> In nhóm ({selectedProposals.length})
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSelectedProposals(purchaseProposals.map(p => p.id))}
                      className="text-[#0054a6] hover:text-blue-700 border border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all active:scale-95 cursor-pointer"
                    >
                      Chọn tất cả ({purchaseProposals.length})
                    </button>
                  )}
                </div>
              )}
            </div>

            {proposalsLoading ? (
              <div className="bg-white py-16 text-center border rounded-2xl">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent mb-3" />
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Đang tải danh sách đề xuất mua hàng...</p>
              </div>
            ) : purchaseProposals.length === 0 ? (
              <div className="bg-white py-16 text-center border border-dashed border-slate-200 rounded-2xl shadow-xs">
                <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-slate-700 text-sm font-extrabold">Không có đề xuất mua hàng nào cần xử lý</p>
                <p className="text-slate-400 text-xs mt-1">Tất cả vật tư hiện đang có đủ hoặc chưa có phiếu yêu cầu nào bị thiếu hàng.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {purchaseProposals.map((proposal) => {
                  const createdDate = proposal.createdAt?.seconds 
                    ? new Date(proposal.createdAt.seconds * 1000) 
                    : proposal.createdAt ? new Date(proposal.createdAt) : new Date();
                  const createdDateStr = createdDate.toLocaleString('vi-VN', {
                    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
                  });

                  const statusLabels: Record<string, { label: string, color: string }> = {
                    pending: { label: 'Chờ mua sắm', color: 'bg-amber-50 border-amber-200 text-amber-700' },
                    ordering: { label: 'Đang mua sắm', color: 'bg-blue-50 border-blue-200 text-blue-700' },
                    completed: { label: 'Đã nhập kho', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                    cancelled: { label: 'Đã hủy', color: 'bg-slate-100 border-slate-200 text-slate-500' }
                  };

                  const currentStatus = statusLabels[proposal.status || 'pending'] || statusLabels.pending;

                  return (
                    <div key={proposal.id} className="bg-white rounded-2xl border border-slate-200 shadow-3xs overflow-hidden transition-all hover:shadow-2xs">
                      {/* Header of proposal slip */}
                      <div className="bg-slate-50/50 px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                        <div className="flex items-start gap-3">
                          <div className="pt-1.5">
                            <input
                              type="checkbox"
                              checked={selectedProposals.includes(proposal.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProposals(prev => [...prev, proposal.id]);
                                } else {
                                  setSelectedProposals(prev => prev.filter(id => id !== proposal.id));
                                }
                              }}
                              className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded cursor-pointer"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black tracking-widest text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded uppercase">
                                Đề nghị mua hàng
                              </span>
                              <span className="font-mono text-[11px] font-extrabold text-slate-500 uppercase">
                                #{proposal.id.substring(0, 8).toUpperCase()}
                              </span>
                              <span className={cn(
                                "px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border",
                                currentStatus.color
                              )}>
                                {currentStatus.label}
                              </span>
                            </div>
                            <div className="text-slate-800 text-[11px] font-extrabold uppercase mt-1 flex items-center gap-1">
                              <Building className="h-3.5 w-3.5 text-slate-400" />
                              <span>Dự án: <span className="text-blue-600">{proposal.projectName || 'Chưa liên kết'}</span></span>
                            </div>
                          </div>
                        </div>

                        <div className="text-left sm:text-right shrink-0">
                          <span className="text-[9px] font-black text-slate-400 block uppercase tracking-wider">Ngày đề xuất</span>
                          <span className="text-xs font-black text-slate-700 font-mono">{createdDateStr}</span>
                        </div>
                      </div>

                      {/* Body - items to purchase */}
                      <div className="p-5 space-y-4">
                        <div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Danh sách vật tư đề nghị mua mới:</span>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {proposal.items?.map((item: any, idx: number) => (
                              <div key={idx} className="bg-rose-50/40 border border-rose-100 p-3.5 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-white border border-rose-100 flex items-center justify-center shrink-0 text-rose-500">
                                    {item.type === 'panel' ? <Package className="h-4 w-4" /> :
                                     item.type === 'inverter' ? <Cpu className="h-4 w-4" /> :
                                     item.type === 'battery' ? <Battery className="h-4 w-4" /> :
                                     <Box className="h-4 w-4" />}
                                  </div>
                                  <div>
                                    <span className="text-[8px] font-black tracking-widest text-rose-400 uppercase block">{item.brand}</span>
                                    <span className="text-xs font-black text-rose-950 line-clamp-1">{item.model}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-[9px] font-black text-rose-400 block uppercase">Cần mua</span>
                                  <span className="text-sm font-black text-rose-900">{item.quantity} {item.unit || getUnit(item)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="bg-slate-50 p-3 rounded-xl border border-dashed flex items-start gap-2">
                          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Nguồn gốc đề xuất:</p>
                            <p className="text-xs text-slate-600 font-semibold mt-0.5">
                              Do <span className="text-blue-600">{proposal.technicianName}</span> đề xuất cấp phát thi công. {proposal.reason}
                            </p>
                          </div>
                        </div>

                        {/* Unified Actions Footer */}
                        <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 justify-between items-center">
                          <div>
                            <button
                              onClick={() => setPrintingProposals([proposal])}
                              className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                            >
                              <Printer className="h-3.5 w-3.5" /> In phiếu đề xuất
                            </button>
                          </div>

                          {/* Action buttons (only for accountant or admin) */}
                          {(proposal.status === 'pending' || proposal.status === 'ordering') && (userRole === 'accountant' || userRole === 'admin') && (
                            <div className="flex flex-wrap gap-2 justify-end">
                              {proposal.status === 'pending' && (
                                <button
                                  onClick={() => handleResolveProposal(proposal.id, 'order')}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                                >
                                  <Truck className="h-3.5 w-3.5" /> Xác nhận đặt mua hàng
                                </button>
                              )}
                              <button
                                  onClick={() => handleResolveProposal(proposal.id, 'complete')}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                              >
                                <CheckCircle className="h-3.5 w-3.5" /> Hoàn thành nhập kho
                              </button>
                              <button
                                  onClick={() => handleResolveProposal(proposal.id, 'cancel')}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer"
                              >
                                <X className="h-3.5 w-3.5" /> Hủy yêu cầu
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Display solver information if resolved */}
                        {proposal.status === 'completed' && (
                          <div className="bg-emerald-50/40 border border-emerald-100 p-3.5 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                            <p className="font-semibold flex items-center gap-1.5">
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                              Đã được mua sắm & nhập kho thành công bởi <span className="font-black text-blue-600">{proposal.resolvedBy || 'Kế toán'}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )
      )}

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
                <span>Lượng hiện có: {adjustItem.stock || 0} {getUnit(adjustItem)}</span>
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

              {['mounting', 'accessory', 'other'].includes(editingItem?.type || '') && (() => {
                const isStandardUnit = !editingItem?.unit || ['cái', 'bộ', 'mét'].includes(editingItem.unit);
                const displayUnitOption = editingItem?.unit ? (isStandardUnit ? editingItem.unit : 'custom') : 'cái';
                
                return (
                  <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200/60 space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Đơn vị tính</label>
                    <select
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500"
                      value={displayUnitOption}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          setEditingItem({ ...editingItem, unit: 'Khác' });
                        } else {
                          setEditingItem({ ...editingItem, unit: val });
                        }
                      }}
                    >
                      <option value="cái">cái</option>
                      <option value="bộ">bộ</option>
                      <option value="mét">mét</option>
                      <option value="custom">Tự thêm đơn vị tính...</option>
                    </select>
                    
                    {displayUnitOption === 'custom' && (
                      <input 
                        type="text"
                        required
                        placeholder="Nhập đơn vị tính mới (VD: cuộn, thùng, chiếc...)"
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 animate-in fade-in duration-200"
                        value={editingItem?.unit === 'Khác' ? '' : (editingItem?.unit || '')}
                        onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}
                      />
                    )}
                  </div>
                );
              })()}

              <div className={cn("grid gap-4", (userRole === 'admin' || userRole === 'accountant') ? "grid-cols-2" : "grid-cols-1")}>
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
                {(userRole === 'admin' || userRole === 'accountant') && (
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
                )}
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
                    key={`log-${index}`}
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

      {/* MODAL 5: Tạo phiếu yêu cầu vật tư */}
      {false && isRequestModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-5 border-b pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  Tạo Phiếu Yêu Cầu Vật Tư
                </h3>
              </div>
              <button 
                onClick={() => setIsRequestModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMaterialRequest} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Linked Project Select */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Liên kết công trình / dự án
                </label>
                <select
                  value={requestProjectId}
                  onChange={e => setRequestProjectId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 outline-none focus:border-amber-500"
                >
                  <option value="">-- Chọn công trình cần cấp phát (Không bắt buộc) --</option>
                  {projectsList.map(p => {
                    const cust = customers[p.customerId];
                    const name = cust ? `Công trình ${cust.name}` : (p.name || p.customerName || 'Dự án không tên');
                    return (
                      <option key={p.id} value={p.id}>{name}</option>
                    );
                  })}
                </select>
              </div>

              {/* Add item selector */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Thêm thiết bị vào phiếu:</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <select
                      value={selectedEqId}
                      onChange={e => setSelectedEqId(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium bg-white outline-none"
                    >
                      <option value="">-- Chọn thiết bị kỹ thuật --</option>
                      {equipmentList.map(eq => (
                        <option key={eq.id} value={eq.id}>
                          {eq.brand} - {eq.model} ({(eq.stock || 0) <= 0 ? 'Hết hàng' : `Còn lại: ${eq.stock}`})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full sm:w-24">
                    <input
                      type="number"
                      min={1}
                      value={selectedEqQty}
                      onChange={e => setSelectedEqQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium outline-none"
                      placeholder="SL"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRequestItem}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider shrink-0 transition-all"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              {/* Current Requested Items List */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Danh sách thiết bị đề xuất ({requestItems.length}):</p>
                {requestItems.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Vui lòng chọn thiết bị và nhấn nút "Thêm" ở trên.</p>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {requestItems.map((ri, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 shadow-3xs text-xs">
                        <div className="flex-1 min-w-0 pr-2">
                          <span className="font-bold text-slate-800 truncate block">{ri.brand} - {ri.model}</span>
                          <span className="text-[9px] font-black uppercase text-slate-400">({ri.type})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-amber-600 shrink-0">{ri.quantity} {getUnit(ri)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRequestItem(ri.equipmentId)}
                            className="text-rose-500 hover:text-rose-700 font-bold p-1"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reason Description */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Lý do yêu cầu / Ghi chú kỹ thuật
                </label>
                <textarea
                  required
                  value={requestReason}
                  onChange={e => setRequestReason(e.target.value)}
                  rows={3}
                  placeholder="Nhập lý do cụ thể để phê duyệt dễ dàng hơn..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t flex gap-2.5 shrink-0 mt-auto">
                <button 
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all uppercase tracking-wider"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  disabled={requestItems.length === 0}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-black rounded-xl shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-2 text-white",
                    requestItems.length === 0 
                      ? "bg-slate-300 cursor-not-allowed shadow-none" 
                      : "bg-amber-500 hover:bg-amber-600"
                  )}
                >
                  <Send className="h-3.5 w-3.5" /> Gửi yêu cầu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Phê duyệt / Từ chối phiếu yêu cầu */}
      {isResolveModalOpen && resolvingRequest && resolveAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150 text-left">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <div className="flex items-center gap-2">
                {resolveAction === 'approve' ? (
                  <Check className="h-5 w-5 text-emerald-600 bg-emerald-50 p-0.5 rounded-full" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-600 bg-rose-50 p-0.5 rounded-full" />
                )}
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  {resolveAction === 'approve' ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}
                </h3>
              </div>
              <button 
                onClick={() => { setIsResolveModalOpen(false); setResolvingRequest(null); setResolveAction(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Bạn đang thực hiện {resolveAction === 'approve' ? 'PHÊ DUYỆT' : 'TỪ CHỐI'} phiếu yêu cầu của kỹ thuật <span className="font-extrabold text-slate-900">{resolvingRequest.technicianName}</span>.
              </p>

              {resolveAction === 'approve' && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200/60 text-[11px] text-amber-800 leading-relaxed">
                  ⚠️ <strong>Lưu ý:</strong> Sau khi phê duyệt, số lượng vật tư được yêu cầu sẽ <strong>tự động trừ trực tiếp</strong> trong kho hàng chính thức.
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Lời nhắn / Phản hồi của quản trị viên
                </label>
                <textarea
                  required={resolveAction === 'reject'}
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  rows={3}
                  placeholder={resolveAction === 'approve' ? "Ghi chú phê duyệt (không bắt buộc)..." : "Nhập lý do cụ thể từ chối phiếu này (bắt buộc)..."}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-2.5">
                <button 
                  onClick={() => { setIsResolveModalOpen(false); setResolvingRequest(null); setResolveAction(null); }}
                  className="flex-1 py-2 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all uppercase tracking-wider"
                >
                  Hủy bỏ
                </button>
                <button 
                  onClick={handleResolveRequest}
                  disabled={resolveAction === 'reject' && !adminNote.trim()}
                  className={cn(
                    "flex-1 py-2 text-xs font-black text-white rounded-lg shadow-md transition-all uppercase tracking-wider",
                    resolveAction === 'approve' ? "bg-emerald-600 hover:bg-emerald-700" : 
                    (!adminNote.trim() ? "bg-slate-300 cursor-not-allowed shadow-none" : "bg-rose-600 hover:bg-rose-700")
                  )}
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Nhập khẩu thiết bị từ Excel */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-5 border-b pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                    NHẬP KHẨU KHO VẬT TƯ TỪ EXCEL
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">Giao diện số hóa danh mục dành cho Kế Toán</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsImportModalOpen(false); setParsedItems([]); setImportError(null); setImportSuccess(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="space-y-5 overflow-y-auto pr-1 flex-1">
              {/* Instructions and download template */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Download className="h-4 w-4 text-emerald-600" /> Hướng dẫn chuẩn bị tệp
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Tải file biểu mẫu Excel bên dưới, điền đầy đủ các cột thông tin bắt buộc gồm: <strong className="text-slate-900">Loại thiết bị, Thương hiệu, Model, Công suất, Đơn giá nhập/bán, Số lượng ban đầu</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-emerald-200/80 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Tải file mẫu nhập kho (.xlsx)
                </button>
              </div>

              {/* Status alerts */}
              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in duration-150">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <span className="font-extrabold">Có lỗi xảy ra:</span> {importError}
                  </div>
                </div>
              )}

              {importSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-150">
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                  <div className="font-bold">
                    {importSuccess}
                  </div>
                </div>
              )}

              {/* Drag-drop file zone */}
              <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-slate-50/50 transition-colors rounded-2xl p-6 text-center relative cursor-pointer group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleParseExcel}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-emerald-50 text-slate-400 group-hover:text-emerald-600 flex items-center justify-center transition-colors">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Kéo thả tệp Excel vào đây hoặc nhấp để tải lên</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Chấp nhận tệp định dạng .xlsx hoặc .xls</p>
                  </div>
                </div>
              </div>

              {/* Preview parsed data */}
              {parsedItems.length > 0 && (
                <div className="space-y-3 animate-in slide-in-from-bottom duration-200">
                  <div className="flex justify-between items-center bg-slate-100 px-3 py-2 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">Danh sách xem trước từ tệp</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        Hợp lệ: {parsedItems.filter(x => x.isValid).length}
                      </span>
                      {parsedItems.filter(x => !x.isValid).length > 0 && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                          Lỗi: {parsedItems.filter(x => !x.isValid).length}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                          <th className="py-2 px-3 text-center">Dòng</th>
                          <th className="py-2 px-3">Thiết bị</th>
                          <th className="py-2 px-3">Phân nhóm</th>
                          <th className="py-2 px-3 text-right">Tồn kho</th>
                          {(userRole === 'admin' || userRole === 'accountant') && <th className="py-2 px-3 text-right">Đơn giá</th>}
                          <th className="py-2 px-3 text-center">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedItems.map((item, idx) => (
                          <React.Fragment key={idx}>
                            <tr className={cn("hover:bg-slate-50/80 transition-colors", !item.isValid && "bg-rose-50/20")}>
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-bold">{item.rowNum}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                <div>{item.data.brand}</div>
                                <div className="text-[10px] text-slate-400 font-mono font-medium">{item.data.model}</div>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-500 text-[10px] uppercase">
                                {categories.find(c => c.id === item.data.type)?.label || item.data.type}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-700">{item.data.stock || 0}</td>
                              {(userRole === 'admin' || userRole === 'accountant') && (
                                <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatCurrency(item.data.unitPrice || 0)}</td>
                              )}
                              <td className="py-2.5 px-3 text-center">
                                {item.isValid ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                                    <Check className="h-2.5 w-2.5" /> Hợp lệ
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-100">
                                    <X className="h-2.5 w-2.5" /> Lỗi
                                  </span>
                                )}
                              </td>
                            </tr>
                            {!item.isValid && (
                              <tr className="bg-rose-50/10">
                                <td colSpan={(userRole === 'admin' || userRole === 'accountant') ? 6 : 5} className="py-1 px-4 text-[10px] text-rose-600 font-medium">
                                  <div className="flex flex-col gap-0.5 pl-4 border-l-2 border-rose-350">
                                    {item.errors.map((err, errIdx) => (
                                      <span key={errIdx}>• {err}</span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex gap-3 border-t pt-4 mt-4 shrink-0">
              <button
                type="button"
                onClick={() => { setIsImportModalOpen(false); setParsedItems([]); setImportError(null); setImportSuccess(null); }}
                className="flex-1 py-3 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all uppercase tracking-wider"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={isImporting || parsedItems.filter(x => x.isValid).length === 0}
                onClick={handleCommitImport}
                className={cn(
                  "flex-1 py-3 text-xs font-black text-white rounded-xl shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-2",
                  isImporting || parsedItems.filter(x => x.isValid).length === 0
                    ? "bg-slate-300 cursor-not-allowed shadow-none"
                    : "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                )}
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                    Đang lưu trữ...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Lưu Kho ({parsedItems.filter(x => x.isValid).length} Dòng Hợp Lệ)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
