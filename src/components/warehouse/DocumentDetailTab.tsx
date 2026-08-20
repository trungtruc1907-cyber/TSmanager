import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  User, 
  Calendar, 
  Building, 
  Briefcase, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ArrowLeft
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Equipment, InventoryTransaction, MaterialRequest, PurchaseProposal, WarehouseSupplier } from './types';
import { numberToVietnameseWords, openExportReceiptPrintWindow } from './printUtils';

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

interface DocumentDetailTabProps {
  documentId: string;
  documentType: 'pn' | 'px' | 'dexuat' | 'muahang';
  equipment: Equipment[];
  transactions: InventoryTransaction[];
  requests: MaterialRequest[];
  proposals: PurchaseProposal[];
  suppliers?: WarehouseSupplier[];
  onOpenProject?: (id: string) => void;
  onClose?: () => void;
}

export default function DocumentDetailTab({
  documentId,
  documentType,
  equipment,
  transactions,
  requests,
  proposals,
  suppliers = [],
  onOpenProject,
  onClose
}: DocumentDetailTabProps) {

  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
    }, (error) => {
      console.log("Error fetching general settings for DocumentDetailTab:", error);
    });
    return () => unsub();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleUpdateProposalSupplier = async (newSupplierId: string) => {
    try {
      const selectedSup = suppliers.find(s => s.id === newSupplierId);
      if (!selectedSup) return;
      await updateDoc(doc(db, 'purchase_proposals', documentId), {
        supplierId: newSupplierId,
        supplierName: selectedSup.name
      });
    } catch (err) {
      console.error("Error updating proposal supplier:", err);
    }
  };

  // ----------------------------------------------------
  // CASE A: Import Receipt (Phiếu nhập kho)
  // ----------------------------------------------------
  if (documentType === 'pn') {
    const docItem = transactions.find(t => t.id === documentId && t.type === 'import');
    if (!docItem) {
      return (
        <div className="bg-white rounded-[2rem] p-12 text-center text-slate-500 font-bold border border-slate-100 shadow-xs flex flex-col items-center justify-center gap-4">
          <XCircle className="h-12 w-12 text-rose-500 animate-bounce" />
          <span>Phiếu Nhập Kho #{documentId} không tồn tại hoặc đã bị xóa.</span>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-wider cursor-pointer transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xs space-y-8 max-w-4xl mx-auto printable-document-card print:border-none print:shadow-none print:p-0">
        
        {/* Header Ribbon / Control actions for interactive screen */}
        <div className="flex justify-between items-center pb-6 border-b border-slate-100 print:hidden gap-4">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <ArrowLeft className="h-4 w-4 text-slate-500" />
                Quay lại
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <span className="text-xs font-black uppercase tracking-wider text-emerald-600">Đã kiểm duyệt & lưu trữ kho thành công</span>
            </div>
          </div>
          <button 
            onClick={handlePrint}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            In phiếu nhập kho
          </button>
        </div>

        {/* Invoice / Slip Print Structure */}
        <div className="space-y-6">
          
          {/* Header section with brand identity */}
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              {settings?.printHeaderUrl ? (
                <div className="w-full max-h-24 overflow-hidden mb-2">
                  <img 
                    src={settings.printHeaderUrl} 
                    alt="Company Header Banner" 
                    className="max-h-20 object-contain text-left" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <>
                  <span className="text-sm font-black text-[#0054a6] uppercase tracking-widest block">
                    {settings?.companyName || 'VINASOLAR TECHNOLOGY CO., LTD'}
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">
                    {settings?.companyTagline || 'Hệ Thống Quản Lý Kho & Vật Tư Cơ Điện Mặt Trời'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold">
                    Số điện thoại: {settings?.phone || '028.6277.8849'} | Website: {settings?.website || 'vinasolar.com'}
                  </p>
                </>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-black uppercase text-slate-400 block tracking-widest">PHIẾU NHẬP KHO</span>
              <span className="text-sm font-black text-slate-900 font-mono mt-1 block">SỐ: #{docItem.id}</span>
              <span className="text-[10px] text-slate-400 font-bold mt-1 block">Ngày lập: {docItem.date}</span>
            </div>
          </div>

          <div className="h-px bg-dashed bg-slate-200" />

          {/* Supplier details / Creator */}
          <div className="grid grid-cols-2 gap-6 text-xs text-slate-700">
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Đơn vị giao hàng / Nhà cung cấp</p>
              <p className="font-extrabold text-slate-900 flex items-center gap-1">
                <Building className="h-4 w-4 text-slate-400" />
                {docItem.partnerName}
              </p>
              <p className="font-semibold text-slate-500">Mã liên kết đối tác: {docItem.partnerId || 'SUP_DEFAULT'}</p>
              <p className="font-medium text-slate-500 italic">Mục đích: {docItem.note}</p>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Thủ kho chịu trách nhiệm</p>
              <p className="font-extrabold text-slate-900 flex items-center gap-1">
                <User className="h-4 w-4 text-slate-400" />
                {docItem.createdByName || 'Thủ kho Solar'}
              </p>
              <p className="font-semibold text-slate-500">Người nhận bàn giao: Tổ phụ trách kho vận</p>
              <p className="font-semibold text-slate-500">Thời gian ghi nhận: {getSafeISOString(docItem.createdAt).substring(11, 16) || '11:20'}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <table className="w-full text-left border-collapse mt-4 text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-black uppercase text-slate-400">STT</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400">Thiết bị / Model vật tư</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400 text-center">ĐVT</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400 text-right">Số lượng nhập</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400 text-right">Đơn giá</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
              {docItem.items?.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3.5 font-mono text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-[9px] font-black text-blue-600 block leading-none">{item.brand}</span>
                    <span className="text-xs font-black text-slate-800">{item.model}</span>
                    <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Mã thiết bị: #{item.equipmentId}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center text-slate-500">{item.unit || 'Cái'}</td>
                  <td className="px-4 py-3.5 text-right font-black text-slate-900">{item.quantity}</td>
                  <td className="px-4 py-3.5 text-right">{formatCurrency(item.unitPrice || 0)}</td>
                  <td className="px-4 py-3.5 text-right text-slate-950 font-black">{formatCurrency((item.quantity || 1) * (item.unitPrice || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Money totals and signature lines */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-4 border-t border-slate-100">
            <div className="text-slate-400 italic text-[11px] font-semibold max-w-sm">
              * Ghi chú pháp lý: Phiếu nhập này có hiệu lực ngay khi được ký nhận đầy đủ chữ ký bàn giao giữa bên giao hàng và thủ kho, số lượng thực tế đã được đồng bộ hóa ghi sổ kế toán kho.
            </div>

            <div className="w-full sm:w-72 bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-500 font-bold">
                <span>Cộng tiền hàng:</span>
                <span className="text-slate-900 font-black">{formatCurrency(docItem.totalValue - (docItem.taxAmount || 0))}</span>
              </div>
              {(docItem.taxAmount || 0) > 0 && (
                <div className="flex justify-between items-center text-amber-700 font-bold">
                  <span>Thuế VAT ({docItem.taxPercent || 0}%):</span>
                  <span className="font-black">+ {formatCurrency(docItem.taxAmount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-slate-900 font-black border-t border-slate-200 pt-1">
                <span>Tổng giá trị thanh toán:</span>
                <span className="text-blue-700">{formatCurrency(docItem.totalValue)}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-600 font-black pt-1.5 border-t border-slate-100">
                <span>Đã trả nhà cung cấp:</span>
                <span>{formatCurrency(docItem.paidAmount || 0)}</span>
              </div>
              {(docItem.debtAmount || 0) > 0 && (
                <div className="flex justify-between items-center text-rose-600 font-black">
                  <span>Dư nợ gối đầu:</span>
                  <span>{formatCurrency(docItem.debtAmount || 0)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center text-xs pt-10">
            <div className="space-y-16">
              <p className="font-black text-slate-800 uppercase tracking-wider">Người lập phiếu</p>
              <p className="font-extrabold text-slate-400 italic">(Ký, ghi rõ họ tên)</p>
            </div>
            <div className="space-y-16">
              <p className="font-black text-slate-800 uppercase tracking-wider">Bên giao hàng</p>
              <p className="font-extrabold text-slate-400 italic">(Ký, ghi rõ họ tên)</p>
            </div>
            <div className="space-y-16">
              <p className="font-black text-slate-800 uppercase tracking-wider">Thủ kho xác nhận</p>
              <p className="font-black text-slate-800">Thủ kho Vinasolar</p>
            </div>
          </div>

        </div>

      </div>
    );
  }

  // ----------------------------------------------------
  // CASE B: Export Receipt (Phiếu xuất kho)
  // ----------------------------------------------------
  if (documentType === 'px') {
    const docItem = transactions.find(t => t.id === documentId && t.type === 'export');
    if (!docItem) {
      return (
        <div className="bg-white rounded-[2rem] p-12 text-center text-slate-500 font-bold border border-slate-100 shadow-xs flex flex-col items-center justify-center gap-4">
          <XCircle className="h-12 w-12 text-rose-500 animate-bounce" />
          <span>Phiếu Xuất Kho #{documentId} không tồn tại hoặc đã bị xóa.</span>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-wider cursor-pointer transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xs space-y-8 max-w-4xl mx-auto printable-document-card print:border-none print:shadow-none print:p-0">
        
        {/* Header Ribbon / Control actions for interactive screen */}
        <div className="flex justify-between items-center pb-6 border-b border-slate-100 print:hidden gap-4">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <ArrowLeft className="h-4 w-4 text-slate-500" />
                Quay lại
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping shrink-0" />
              <span className="text-xs font-black uppercase tracking-wider text-rose-600">Đã xuất vật tư bàn giao thi công công trình</span>
            </div>
          </div>
          <button 
            onClick={() => {
              const win = openExportReceiptPrintWindow({
                receipt: docItem,
                equipment,
                generalSettings: settings,
                showUnitPrice: true,
                pageSize: 'A4',
                showBarcode: true,
                autoPrint: true
              });
              if (!win) {
                handlePrint();
              }
            }}
            className="bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 cursor-pointer shadow-xs"
            title="Mở bản in ở cửa sổ / tab mới của trình duyệt"
          >
            <Printer className="h-4 w-4 text-blue-600" />
            In phiếu xuất kho (Cửa sổ mới)
          </button>
        </div>

        {/* Invoice / Slip Print Structure */}
        <div className="space-y-6">
          
          {/* Header section with brand identity */}
          <div className="flex justify-between items-start gap-4 border-b-2 border-slate-900 pb-4 print:border-b-2">
            <div className="flex-1">
              {settings?.printHeaderUrl ? (
                <div className="w-full max-h-24 overflow-hidden mb-2">
                  <img 
                    src={settings.printHeaderUrl} 
                    alt="Company Header Banner" 
                    className="max-h-20 object-contain text-left" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <>
                  <span className="text-sm font-black text-[#0054a6] uppercase tracking-widest block">
                    {settings?.companyName || 'CÔNG TY TNHH KỸ THUẬT NĂNG LƯỢNG TRƯỜNG SƠN'}
                  </span>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">
                    {settings?.address || 'KCN Sóng Thần, TP. Dĩ An, Tỉnh Bình Dương - CN TP.HCM'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold">
                    Số điện thoại: {settings?.phone || '0988.123.456'} | Website: {settings?.website || 'truongsonenergy.vn'}
                  </p>
                </>
              )}
            </div>
            <div className="text-right shrink-0 space-y-1">
              <div className="border border-slate-900 px-3 py-1 text-center inline-block rounded-xs bg-slate-50 print:bg-transparent">
                <span className="font-bold text-[10px] uppercase block tracking-wider text-slate-800">Mẫu số: 02 - VT</span>
                <span className="text-[8px] text-slate-500 block italic leading-tight">(Ban hành theo TT số 200/2014/TT-BTC)</span>
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 font-mono block">SỐ: #{docItem.id}</span>
                <span className="text-[10px] text-slate-500 font-bold block">Ngày xuất: {docItem.date}</span>
              </div>
            </div>
          </div>

          {/* Title and Barcode */}
          <div className="text-center my-4 space-y-1">
            <h1 className="text-xl font-black text-slate-950 uppercase tracking-wider">
              PHIẾU XUẤT KHO VẬT TƯ
            </h1>
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">
              ({docItem.id.startsWith('PX-TC') ? 'XUẤT CẤP PHÁT THI CÔNG DỰ ÁN' : docItem.id.startsWith('PX-TM') ? 'XUẤT BÁN HÀNG THƯƠNG MẠI' : 'XUẤT THANH LÝ / HỦY KHO'})
            </p>
            <div className="flex flex-col items-center justify-center pt-1 print:flex">
              <div className="font-mono tracking-widest text-[9px] text-slate-400 select-none scale-y-125">
                ||| | |||| || | ||||| || ||| |||| | ||||| | ||
              </div>
              <span className="font-mono text-[8px] font-bold text-slate-500">*{docItem.id}*</span>
            </div>
          </div>

          {/* Supplier details / Creator */}
          <div className="border border-slate-900 rounded-sm p-4 text-xs text-slate-900 bg-slate-50/50 print:bg-transparent space-y-2">
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-8 flex items-baseline">
                <span className="font-bold shrink-0 w-44">Đơn vị / Công trình nhận:</span>
                {docItem.partnerId && docItem.partnerId !== 'PRJ_TEMP' && docItem.partnerId !== 'PROJ_DEFAULT' && onOpenProject ? (
                  <button
                    onClick={() => onOpenProject(docItem.partnerId)}
                    className="font-black text-blue-600 hover:underline border-b border-dotted border-slate-400 flex-1 pb-0.5 text-left cursor-pointer focus:outline-none"
                    title="Click để xem chi tiết công trình"
                  >
                    {docItem.partnerName}
                  </button>
                ) : (
                  <span className="font-black text-slate-950 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                    {docItem.partnerName}
                  </span>
                )}
              </div>
              <div className="col-span-12 sm:col-span-4 flex items-baseline">
                <span className="font-bold shrink-0 w-24">Mã liên kết:</span>
                <span className="font-mono font-bold text-slate-950 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                  {docItem.partnerId || 'PROJ_DEFAULT'}
                </span>
              </div>
            </div>

            <div className="flex items-baseline">
              <span className="font-bold shrink-0 w-44">Lý do / Mục đích xuất kho:</span>
              <span className="font-medium text-slate-900 border-b border-dotted border-slate-400 flex-1 pb-0.5 italic">
                {docItem.note || 'Xuất kho cấp phát vật tư thiết bị phục vụ công trình năng lượng mặt trời'}
              </span>
            </div>

            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-12 sm:col-span-8 flex items-baseline">
                <span className="font-bold shrink-0 w-44">Xuất tại kho:</span>
                <span className="font-semibold text-slate-950 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                  Kho Tổng Vật Tư Năng Lượng Mặt Trời (Trường Sơn Solar)
                </span>
              </div>
              <div className="col-span-12 sm:col-span-4 flex items-baseline">
                <span className="font-bold shrink-0 w-24">Thủ kho:</span>
                <span className="font-bold text-slate-950 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                  {docItem.createdByName || 'Thủ kho Solar'}
                </span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <table className="w-full text-left border-collapse mt-4 text-xs border border-slate-900">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-100 print:bg-slate-100 text-center font-black">
                <th className="border border-slate-900 px-3 py-2 w-10">STT</th>
                <th className="border border-slate-900 px-4 py-2 text-left">Tên, nhãn hiệu, quy cách phẩm chất vật tư</th>
                <th className="border border-slate-900 px-2 py-2 text-center w-16">ĐVT</th>
                <th className="border border-slate-900 px-3 py-2 text-right w-20">SL Xuất</th>
                <th className="border border-slate-900 px-3 py-2 text-right w-28">Đơn giá</th>
                <th className="border border-slate-900 px-4 py-2 text-right w-32">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-bold text-slate-800">
              {docItem.items?.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-900 hover:bg-slate-50/50">
                  <td className="border border-slate-900 px-3 py-3 font-mono text-center text-slate-500">{idx + 1}</td>
                  <td className="border border-slate-900 px-4 py-3">
                    <span className="text-[9px] font-black text-rose-600 block leading-none">{item.brand}</span>
                    <span className="text-xs font-black text-slate-900">{item.model}</span>
                    <span className="text-[9px] font-bold text-slate-400 block mt-0.5 font-mono">Mã SKU: #{item.equipmentId}</span>
                  </td>
                  <td className="border border-slate-900 px-2 py-3 text-center text-slate-700">{item.unit || 'Cái'}</td>
                  <td className="border border-slate-900 px-3 py-3 text-right font-black text-slate-950">{item.quantity}</td>
                  <td className="border border-slate-900 px-3 py-3 text-right text-slate-700">{formatCurrency(item.unitPrice || 0)}</td>
                  <td className="border border-slate-900 px-4 py-3 text-right text-slate-950 font-black">{formatCurrency((item.quantity || 1) * (item.unitPrice || 0))}</td>
                </tr>
              ))}
              <tr className="font-black bg-slate-100 print:bg-slate-100 border-t-2 border-slate-900">
                <td colSpan={3} className="border border-slate-900 px-4 py-2.5 text-right uppercase tracking-wider">
                  Tổng Cộng:
                </td>
                <td className="border border-slate-900 px-3 py-2.5 text-right font-black text-slate-950">
                  {docItem.items?.reduce((s, i) => s + (i.quantity || 0), 0)}
                </td>
                <td className="border border-slate-900 px-3 py-2.5 text-center text-slate-400">x</td>
                <td className="border border-slate-900 px-4 py-2.5 text-right text-rose-700 font-black">
                  {formatCurrency(docItem.totalValue)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Money totals and in words */}
          <div className="space-y-1.5 pt-2 text-xs text-slate-900">
            <p className="font-medium">
              - Tổng số tiền hàng xuất kho (viết bằng chữ):{' '}
              <strong className="font-black text-slate-950 italic">
                {numberToVietnameseWords(docItem.totalValue)}
              </strong>
            </p>
            <p className="text-[11px] text-slate-500 italic">
              * Quy định quản lý: Kỹ thuật thi công có trách nhiệm kiểm tra đúng chủng loại, quy cách đóng gói và chữ ký của đại diện kho vận trước khi vận chuyển thiết bị ra khỏi khu vực kho bãi.
            </p>
          </div>

          {/* 5 Signature Blocks */}
          <div className="pt-6">
            <div className="text-right text-xs italic text-slate-700 mb-2 font-serif">
              Ngày xuất: {docItem.date}
            </div>

            <div className="grid grid-cols-5 gap-2 text-center text-[11px]">
              <div className="flex flex-col justify-between h-28">
                <div>
                  <p className="font-black uppercase tracking-wider text-slate-900">Người lập phiếu</p>
                  <p className="text-[10px] text-slate-500 italic">(Ký, họ tên)</p>
                </div>
                <p className="font-bold text-slate-900">{docItem.createdByName || 'Thủ kho Solar'}</p>
              </div>

              <div className="flex flex-col justify-between h-28">
                <div>
                  <p className="font-black uppercase tracking-wider text-slate-900">Người nhận hàng</p>
                  <p className="text-[10px] text-slate-500 italic">(Ký, họ tên)</p>
                </div>
                <p className="font-bold text-slate-900 truncate px-1" title={docItem.partnerName}>
                  {docItem.partnerName}
                </p>
              </div>

              <div className="flex flex-col justify-between h-28">
                <div>
                  <p className="font-black uppercase tracking-wider text-slate-900">Thủ kho xuất</p>
                  <p className="text-[10px] text-slate-500 italic">(Ký, họ tên)</p>
                </div>
                <p className="font-bold text-slate-900">Thủ kho Vinasolar</p>
              </div>

              <div className="flex flex-col justify-between h-28">
                <div>
                  <p className="font-black uppercase tracking-wider text-slate-900">Kế toán kho</p>
                  <p className="text-[10px] text-slate-500 italic">(Ký, họ tên)</p>
                </div>
                <p className="font-bold text-slate-400 italic">..........................</p>
              </div>

              <div className="flex flex-col justify-between h-28">
                <div>
                  <p className="font-black uppercase tracking-wider text-slate-900">Giám đốc duyệt</p>
                  <p className="text-[10px] text-slate-500 italic">(Ký, đóng dấu)</p>
                </div>
                <p className="font-bold text-slate-400 italic">..........................</p>
              </div>
            </div>
          </div>

        </div>

      </div>
    );
  }

  // ----------------------------------------------------
  // CASE C: Material Request (Đề xuất cấp vật tư)
  // ----------------------------------------------------
  if (documentType === 'dexuat') {
    const docItem = requests.find(r => r.id === documentId);
    if (!docItem) {
      return (
        <div className="bg-white rounded-[2rem] p-12 text-center text-slate-500 font-bold border border-slate-100 shadow-xs flex flex-col items-center justify-center gap-4">
          <XCircle className="h-12 w-12 text-rose-500 animate-bounce" />
          <span>Tờ Đề Xuất Cấp Vật Tư #{documentId} không tồn tại hoặc đã bị xóa.</span>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-wider cursor-pointer transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xs space-y-8 max-w-4xl mx-auto printable-document-card print:border-none print:shadow-none print:p-0">
        
        <div className="flex justify-between items-center pb-6 border-b border-slate-100 print:hidden gap-4">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <ArrowLeft className="h-4 w-4 text-slate-500" />
                Quay lại
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full shrink-0 ${
                docItem.status === 'pending' ? 'bg-amber-500 animate-pulse' :
                docItem.status === 'approved' ? 'bg-emerald-500' : 'bg-rose-500'
              }`} />
              <span className={`text-xs font-black uppercase tracking-wider ${
                docItem.status === 'pending' ? 'text-amber-600' :
                docItem.status === 'approved' ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                Trạng thái: {docItem.status === 'pending' ? 'Chờ kiểm duyệt' : docItem.status === 'approved' ? 'Đã duyệt đề xuất' : 'Từ chối cấp phát'}
              </span>
            </div>
          </div>
          <button 
            onClick={handlePrint}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            In phiếu đề xuất
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              {settings?.printHeaderUrl ? (
                <div className="w-full max-h-24 overflow-hidden mb-2">
                  <img 
                    src={settings.printHeaderUrl} 
                    alt="Company Header Banner" 
                    className="max-h-20 object-contain text-left" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <>
                  <span className="text-sm font-black text-[#0054a6] uppercase tracking-widest block">
                    {settings?.companyName || 'VINASOLAR TECHNOLOGY CO., LTD'}
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">
                    {settings?.companyTagline || 'Hệ Thống Phê Duyệt Tự Động Kỹ Thuật Dự Án Vinasolar'}
                  </p>
                </>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-black uppercase text-slate-400 block tracking-widest">TỜ TRÌNH ĐỀ XUẤT CẤP PHÁT VẬT TƯ THI CÔNG</span>
              <span className="text-sm font-black text-slate-900 font-mono mt-1 block">#{docItem.id}</span>
              <span className="text-[10px] text-slate-400 font-bold mt-1 block">Yêu cầu: {getSafeISOString(docItem.createdAt).substring(0, 10)}</span>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 grid grid-cols-2 gap-6 text-xs text-slate-700">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Người lập đề xuất (Kỹ thuật)</p>
              <p className="font-extrabold text-slate-950 mt-1">{docItem.technicianName}</p>
              <p className="font-semibold text-slate-500">Mã cán bộ: {docItem.technicianId}</p>
              <p className="font-medium text-slate-500 mt-2">Lý do đề xuất: <span className="italic font-bold">"{docItem.reason}"</span></p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Công trình áp dụng cấp phát</p>
              {docItem.projectId && docItem.projectId !== 'PRJ_TEMP' && onOpenProject ? (
                <button
                  onClick={() => onOpenProject(docItem.projectId)}
                  className="font-extrabold text-blue-600 hover:underline block mt-1 text-left cursor-pointer focus:outline-none"
                  title="Click để xem chi tiết công trình"
                >
                  <span className="underline decoration-dotted">{docItem.projectName}</span>
                </button>
              ) : (
                <p className="font-extrabold text-blue-600 mt-1">{docItem.projectName}</p>
              )}
              <p className="font-semibold text-slate-500">Mã công trình: {docItem.projectId}</p>
              {docItem.adminNote && (
                <p className="font-medium text-slate-500 mt-2 bg-white border border-slate-200 p-2 rounded-xl text-[11px]">
                  Ý kiến chỉ đạo: <span className="text-slate-800 font-extrabold">"{docItem.adminNote}"</span>
                </p>
              )}
            </div>
          </div>

          <table className="w-full text-left border-collapse mt-4 text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-black uppercase text-slate-400">STT</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400">Thiết bị yêu cầu</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400">Thương hiệu / Model</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400 text-center">ĐVT</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400 text-right">Số lượng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
              {docItem.items?.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3.5 font-mono text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                      item.type === 'panel' ? 'bg-blue-50 text-blue-700' :
                      item.type === 'inverter' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'
                    }`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-black text-slate-900">{item.brand} {item.model}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">#{item.equipmentId}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center text-slate-500">{item.unit || 'Cái'}</td>
                  <td className="px-4 py-3.5 text-right text-slate-950 font-black text-sm">{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Money totals and signature lines for Case C */}
          <div className="grid grid-cols-3 gap-4 text-center text-xs pt-12">
            <div className="space-y-16">
              <p className="font-black text-slate-800 uppercase tracking-wider">Kỹ thuật lập đề xuất</p>
              <p className="font-extrabold text-slate-400 italic">(Ký, ghi rõ họ tên)</p>
            </div>
            <div className="space-y-16">
              <p className="font-black text-slate-800 uppercase tracking-wider">Phó/Trưởng phòng kỹ thuật</p>
              <p className="font-extrabold text-slate-400 italic">(Ký, duyệt chủng loại)</p>
            </div>
            <div className="space-y-16">
              <p className="font-black text-slate-800 uppercase tracking-wider">Ban Giám Đốc duyệt</p>
              <p className="font-black text-slate-800">{docItem.status === 'approved' ? 'Đã phê duyệt (Hệ thống)' : 'Chờ phê duyệt'}</p>
            </div>
          </div>
        </div>

      </div>
    );
  }

  // ----------------------------------------------------
  // CASE D: Purchase Order (Đơn đặt mua hàng)
  // ----------------------------------------------------
  if (documentType === 'muahang') {
    const docItem = proposals.find(p => p.id === documentId);
    if (!docItem) {
      return (
        <div className="bg-white rounded-[2rem] p-12 text-center text-slate-500 font-bold border border-slate-100 shadow-xs flex flex-col items-center justify-center gap-4">
          <XCircle className="h-12 w-12 text-rose-500 animate-bounce" />
          <span>Đơn Mua Hàng #{documentId} không tồn tại hoặc đã bị xóa.</span>
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-wider cursor-pointer transition-all active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              Quay lại danh sách
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xs space-y-8 max-w-4xl mx-auto printable-document-card print:border-none print:shadow-none print:p-0">
        
        <div className="flex justify-between items-center pb-6 border-b border-slate-100 print:hidden gap-4">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <ArrowLeft className="h-4 w-4 text-slate-500" />
                Quay lại
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 animate-ping shrink-0" />
              <span className="text-xs font-black uppercase tracking-wider text-blue-600">
                Trạng thái mua hàng: {docItem.status === 'pending' ? 'Chờ ban giám đốc phê duyệt' : docItem.status === 'approved' ? 'Đã duyệt mua - Chờ đặt hàng' : docItem.status === 'ordering' ? 'Đang giao vận' : 'Hoàn tất mua hàng'}
              </span>
            </div>
          </div>
          <button 
            onClick={handlePrint}
            className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            In phiếu đặt mua
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              {settings?.printHeaderUrl ? (
                <div className="w-full max-h-24 overflow-hidden mb-2">
                  <img 
                    src={settings.printHeaderUrl} 
                    alt="Company Header Banner" 
                    className="max-h-20 object-contain text-left" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              ) : (
                <>
                  <span className="text-sm font-black text-[#0054a6] uppercase tracking-widest block">
                    {settings?.companyName || 'VINASOLAR TECHNOLOGY CO., LTD'}
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">
                    {settings?.companyTagline || 'Phòng Kế Hoạch & Vật Tư Vinasolar'}
                  </p>
                </>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs font-black uppercase text-slate-400 block tracking-widest">ĐƠN ĐỀ XUẤT ĐẶT MUA HÀNG</span>
              <span className="text-sm font-black text-slate-900 font-mono mt-1 block">#{docItem.id}</span>
              <span className="text-[10px] text-slate-400 font-bold mt-1 block">Lập ngày: {getSafeISOString(docItem.createdAt).substring(0, 10)}</span>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          <div className="grid grid-cols-2 gap-6 text-xs text-slate-700">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Đơn vị thụ hưởng / Nhà phân phối</p>
              {docItem.status === 'pending' && suppliers.length > 0 ? (
                <div className="mt-2 space-y-1">
                  <select
                    value={docItem.supplierId}
                    onChange={(e) => handleUpdateProposalSupplier(e.target.value)}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 font-semibold italic">Mã đối tác hiện tại: {docItem.supplierId}</p>
                </div>
              ) : (
                <>
                  <p className="font-extrabold text-slate-950 mt-1">{docItem.supplierName}</p>
                  <p className="font-semibold text-slate-500">Mã đối tác: {docItem.supplierId}</p>
                </>
              )}
              <p className="font-medium text-slate-500 mt-2">Lý do thu mua: <span className="italic font-bold">"{docItem.reason}"</span></p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col justify-center">
              <span className="text-[9px] font-black uppercase text-slate-400 block">Tổng chi phí thu mua tạm tính</span>
              <span className="text-base font-black text-[#0054a6] mt-1 block">{formatCurrency(docItem.totalCost)}</span>
            </div>
          </div>

          <table className="w-full text-left border-collapse mt-4 text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-black uppercase text-slate-400">STT</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400">Thiết bị thu mua</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400 text-center">ĐVT</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400 text-right">Số lượng đặt</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400 text-right">Giá dự kiến</th>
                <th className="px-4 py-3 font-black uppercase text-slate-400 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
              {docItem.items?.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3.5 font-mono text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-[9px] font-black text-blue-600 block leading-none">{item.brand}</span>
                    <span className="font-black text-slate-800">{item.model}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">#{item.equipmentId}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center text-slate-500">{item.unit || 'Cái'}</td>
                  <td className="px-4 py-3.5 text-right text-slate-900 font-black">{item.quantity}</td>
                  <td className="px-4 py-3.5 text-right">{formatCurrency(item.unitPrice || 0)}</td>
                  <td className="px-4 py-3.5 text-right text-slate-950 font-black">{formatCurrency((item.quantity || 1) * (item.unitPrice || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Money totals and signature lines for Case D */}
          <div className="grid grid-cols-3 gap-4 text-center text-xs pt-12">
            <div className="space-y-16">
              <p className="font-black text-slate-800 uppercase tracking-wider">Người lập đơn mua</p>
              <p className="font-extrabold text-slate-400 italic">(Ký, ghi rõ họ tên)</p>
            </div>
            <div className="space-y-16">
              <p className="font-black text-slate-800 uppercase tracking-wider">Phòng Kế toán - Cung ứng</p>
              <p className="font-extrabold text-slate-400 italic">(Ký, ghi rõ họ tên)</p>
            </div>
            <div className="space-y-16">
              <p className="font-black text-slate-800 uppercase tracking-wider">Thủ trưởng đơn vị duyệt</p>
              <p className="font-black text-slate-800">{docItem.status === 'completed' || docItem.status === 'ordering' || docItem.status === 'approved' ? 'Đã phê duyệt (Hệ thống)' : 'Chờ phê duyệt'}</p>
            </div>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2rem] p-12 text-center text-slate-500 font-bold border border-slate-100 shadow-xs">
      <HelpCircle className="h-12 w-12 text-slate-300 mx-auto mb-4 animate-spin-slow" />
      Không nhận diện được loại tài liệu yêu cầu.
    </div>
  );
}
