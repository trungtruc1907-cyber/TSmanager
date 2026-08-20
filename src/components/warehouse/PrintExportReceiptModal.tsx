import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  X, 
  Download, 
  Settings2, 
  Check, 
  FileSpreadsheet, 
  Building, 
  User, 
  Calendar, 
  MapPin, 
  Briefcase, 
  ShoppingCart, 
  Trash2,
  Info,
  ExternalLink
} from 'lucide-react';
import { InventoryTransaction, Equipment } from './types';
import { numberToVietnameseWords, formatCurrencyVND, openExportReceiptPrintWindow } from './printUtils';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface PrintExportReceiptModalProps {
  receipt: InventoryTransaction | null;
  onClose: () => void;
  equipment?: Equipment[];
  projects?: any[];
  customers?: any[];
}

export default function PrintExportReceiptModal({
  receipt,
  onClose,
  equipment = [],
  projects = [],
  customers = []
}: PrintExportReceiptModalProps) {
  if (!receipt) return null;

  // Print customization options
  const [showUnitPrice, setShowUnitPrice] = useState<boolean>(true);
  const [pageSize, setPageSize] = useState<'A4' | 'A5'>('A4');
  const [showBarcode, setShowBarcode] = useState<boolean>(true);
  const [generalSettings, setGeneralSettings] = useState<any>(null);

  // Fetch company general settings if available
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setGeneralSettings(snap.data());
      }
    }, (err) => {
      console.log('Error loading company settings for print modal:', err);
    });
    return () => unsub();
  }, []);

  // Determine export type info
  const isConstruction = receipt.id.startsWith('PX-TC');
  const isCommercial = receipt.id.startsWith('PX-TM');
  const isDisposal = receipt.id.startsWith('PX-HUY');

  let typeTitle = 'XUẤT CẤP PHÁT THI CÔNG DỰ ÁN';
  let typeSub = 'Cấp phát vật tư, trang thiết bị phục vụ lắp đặt hệ thống điện mặt trời';
  let partnerRoleLabel = 'Đơn vị / Dự án tiếp nhận:';
  let purposeDefault = 'Xuất kho phục vụ thi công lắp đặt dự án điện năng lượng mặt trời';

  if (isCommercial) {
    typeTitle = 'XUẤT KHO BÁN HÀNG THƯƠNG MẠI';
    typeSub = 'Xuất bán thiết bị, vật tư điện mặt trời cho khách hàng / đại lý';
    partnerRoleLabel = 'Khách hàng / Người mua:';
    purposeDefault = 'Xuất bán thương mại theo đơn đặt hàng';
  } else if (isDisposal) {
    typeTitle = 'XUẤT THANH LÝ / HỦY KHO VẬT TƯ';
    typeSub = 'Xuất kho thanh lý, xử lý thiết bị hư hại hoặc quá hạn sử dụng';
    partnerRoleLabel = 'Hội đồng thanh lý / Đơn vị tiếp nhận:';
    purposeDefault = 'Xuất thanh lý xử lý kho theo biên bản kiểm kê';
  }

  // Find extra project/customer details if any
  const matchedProject = projects.find(p => p.id === receipt.partnerId);
  const matchedCustomer = customers.find(c => c.id === receipt.partnerId || c.name === receipt.partnerName || c.fullName === receipt.partnerName);

  const deliveryAddress = matchedProject?.address || matchedCustomer?.address || 'Tại địa điểm công trình thi công / Địa chỉ khách hàng';
  const contactPhone = matchedProject?.phone || matchedCustomer?.phone || matchedProject?.customerPhone || '';

  // Parse items
  const items = receipt.items || [];
  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalValue = receipt.totalValue || 0;

  // Format date parts
  let day = '...';
  let month = '...';
  let year = '2026';
  try {
    if (receipt.date) {
      const d = new Date(receipt.date);
      if (!isNaN(d.getTime())) {
        day = String(d.getDate()).padStart(2, '0');
        month = String(d.getMonth() + 1).padStart(2, '0');
        year = String(d.getFullYear());
      }
    }
  } catch (e) {}

  const handleOpenSeparateWindow = () => {
    openExportReceiptPrintWindow({
      receipt,
      equipment,
      projects,
      customers,
      generalSettings,
      showUnitPrice,
      pageSize,
      showBarcode,
      autoPrint: true
    });
  };

  const handleTriggerPrint = () => {
    // Try opening in separate window, fallback to window.print()
    const win = openExportReceiptPrintWindow({
      receipt,
      equipment,
      projects,
      customers,
      generalSettings,
      showUnitPrice,
      pageSize,
      showBarcode,
      autoPrint: true
    });
    if (!win) {
      window.print();
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    let csv = "data:text/csv;charset=utf-8,\uFEFF";
    csv += `PHIẾU XUẤT KHO - SỐ: ${receipt.id}\n`;
    csv += `Ngày xuất: ${receipt.date},Người nhận: ${receipt.partnerName},Thủ kho: ${receipt.createdByName || 'Thủ kho'}\n\n`;
    csv += "STT,Mã SKU,Tên Hàng Hóa Vật Tư,ĐVT,Số Lượng,Đơn Giá,Thành Tiền\n";
    items.forEach((item, idx) => {
      csv += `${idx + 1},${item.equipmentId},"${item.brand} ${item.model}",${item.unit || 'Cái'},${item.quantity},${item.unitPrice},${item.quantity * item.unitPrice}\n`;
    });
    csv += `,,,Tổng Cộng,${totalQuantity},,${totalValue}\n`;
    csv += `Bằng chữ: "${numberToVietnameseWords(totalValue)}"\n`;

    const encodedUri = encodeURI(csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Phieu_Xuat_Kho_${receipt.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="print-export-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      
      {/* Container Card */}
      <div className="bg-slate-100 w-full max-w-5xl rounded-[2.5rem] shadow-2xl flex flex-col my-auto max-h-[96vh] overflow-hidden border border-slate-200 print:border-none print:shadow-none print:max-h-none print:max-w-none print:bg-white print:rounded-none">
        
        {/* TOP TOOLBAR: Control buttons & Customization (Hidden during actual paper print) */}
        <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                Mẫu In Phiếu Xuất Kho
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-mono">
                  #{receipt.id}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Mẫu số 02 - VT (Ban hành theo TT 200/2014/TT-BTC & TT 133/2016/TT-BTC)
              </p>
            </div>
          </div>

          {/* Settings & Quick Toggles */}
          <div className="flex items-center flex-wrap gap-2 text-xs">
            
            {/* Toggle Show/Hide Price */}
            <button
              type="button"
              onClick={() => setShowUnitPrice(!showUnitPrice)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                showUnitPrice 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="Bật/Tắt hiển thị giá tiền (hữu ích khi giao thợ thi công không cần lộ giá vốn)"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span>{showUnitPrice ? 'Đang hiện giá tiền' : 'Đã ẩn giá tiền'}</span>
            </button>

            {/* Toggle Page Size */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPageSize('A4')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-all ${
                  pageSize === 'A4' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Khổ A4
              </button>
              <button
                type="button"
                onClick={() => setPageSize('A5')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition-all ${
                  pageSize === 'A5' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Khổ A5
              </button>
            </div>

            {/* Toggle Barcode */}
            <button
              type="button"
              onClick={() => setShowBarcode(!showBarcode)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer border ${
                showBarcode 
                  ? 'bg-slate-50 border-slate-200 text-slate-700' 
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
            >
              Barcode: {showBarcode ? 'Bật' : 'Tắt'}
            </button>

            {/* Export CSV button */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Xuất file Excel CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Xuất Excel</span>
            </button>

            {/* Open in Separate Window button */}
            <button
              type="button"
              onClick={handleOpenSeparateWindow}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              title="Mở bản in trong cửa sổ / tab mới của trình duyệt"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Cửa sổ mới</span>
            </button>

            {/* Print Primary Button */}
            <button
              type="button"
              onClick={handleTriggerPrint}
              className="px-4 py-2 rounded-xl bg-[#0054a6] hover:bg-blue-700 text-white font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95"
            >
              <Printer className="h-4 w-4" />
              <span>In Ngay (Print)</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-500 transition-all cursor-pointer border border-slate-200"
              title="Đóng cửa sổ in"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* PRINT PAPER VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-slate-200/60 print:p-0 print:bg-white print:overflow-visible">
          
          {/* THE EXACT PRINTABLE A4/A5 SHEET */}
          <div 
            id="printable-export-slip" 
            className={`bg-white text-slate-900 shadow-xl print:shadow-none mx-auto transition-all p-8 sm:p-10 font-sans print:p-0 ${
              pageSize === 'A5' ? 'w-full max-w-[560px] text-xs' : 'w-full max-w-[800px] text-[13px]'
            }`}
            style={{ minHeight: pageSize === 'A5' ? '180mm' : '260mm' }}
          >
            
            {/* 1. HEADER: COMPANY INFO & FORM TITLE */}
            <div className="flex justify-between items-start gap-4 border-b-2 border-slate-900 pb-4">
              
              {/* Left: Company Details */}
              <div className="space-y-1 max-w-[440px]">
                {generalSettings?.printHeaderUrl ? (
                  <img 
                    src={generalSettings.printHeaderUrl} 
                    alt="Company Header" 
                    className="max-h-16 object-contain mb-1" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="space-y-0.5">
                    <h3 className="font-black text-xs uppercase tracking-wider text-slate-950">
                      {generalSettings?.companyName || 'CÔNG TY TNHH KỸ THUẬT NĂNG LƯỢNG TRƯỜNG SƠN'}
                    </h3>
                    <p className="text-[11px] text-slate-600 font-medium">
                      {generalSettings?.address || 'Địa chỉ: KCN Sóng Thần 2, TP. Dĩ An, Tỉnh Bình Dương - CN TP.HCM'}
                    </p>
                    <p className="text-[11px] text-slate-600 font-medium">
                      Điện thoại: {generalSettings?.phone || '0988.123.456'} | Email: {generalSettings?.email || 'kho.solar@truongsonenergy.vn'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      Kho xuất: <strong>KHO TỔNG VẬT TƯ & THIẾT BỊ ĐIỆN MẶT TRỜI</strong>
                    </p>
                  </div>
                )}
              </div>

              {/* Right: Form Standards & Receipt Meta */}
              <div className="text-right shrink-0 space-y-1">
                <div className="border border-slate-900 px-3 py-1 text-center inline-block rounded-xs bg-slate-50 print:bg-transparent">
                  <span className="font-bold text-[10px] uppercase block tracking-wider text-slate-800">Mẫu số: 02 - VT</span>
                  <span className="text-[8px] text-slate-600 block italic leading-tight">(Ban hành theo TT số 200/2014/TT-BTC)</span>
                </div>
                <div className="pt-1">
                  <p className="font-mono font-black text-xs text-slate-950">Số: <strong>{receipt.id}</strong></p>
                  <p className="text-[10px] text-slate-600 font-bold">Quyển số: 01/XK</p>
                </div>
              </div>
            </div>

            {/* 2. TITLE & DATE */}
            <div className="text-center my-6 space-y-1">
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-wider">
                PHIẾU XUẤT KHO
              </h1>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                ({typeTitle})
              </p>
              <p className="text-xs italic text-slate-700 font-serif pt-1">
                Ngày {day} tháng {month} năm {year}
              </p>
              
              {/* Barcode representation */}
              {showBarcode && (
                <div className="flex flex-col items-center justify-center pt-2">
                  <div className="font-mono tracking-widest text-[9px] text-slate-400 select-none scale-y-125">
                    ||| | |||| || | ||||| || ||| |||| | ||||| | ||
                  </div>
                  <span className="font-mono text-[9px] font-bold text-slate-500">*{receipt.id}*</span>
                </div>
              )}
            </div>

            {/* 3. PARTNER & DISPATCH INFORMATION (Structured Clean Box) */}
            <div className="border border-slate-900 rounded-sm p-4 mb-5 space-y-2 text-xs text-slate-900 bg-slate-50/50 print:bg-transparent">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-8 flex items-baseline">
                  <span className="font-bold shrink-0 w-44">{partnerRoleLabel}</span>
                  <span className="font-black text-slate-950 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                    {receipt.partnerName} {contactPhone ? `(${contactPhone})` : ''}
                  </span>
                </div>
                <div className="col-span-12 sm:col-span-4 flex items-baseline">
                  <span className="font-bold shrink-0 w-20">Mã liên kết:</span>
                  <span className="font-mono font-bold text-slate-950 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                    {receipt.partnerId || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="flex items-baseline">
                <span className="font-bold shrink-0 w-44">Lý do xuất kho:</span>
                <span className="font-medium text-slate-900 border-b border-dotted border-slate-400 flex-1 pb-0.5 italic">
                  {receipt.note || purposeDefault}
                </span>
              </div>

              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-7 flex items-baseline">
                  <span className="font-bold shrink-0 w-44">Xuất tại kho:</span>
                  <span className="font-semibold text-slate-950 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                    Kho Tổng Vật Tư Năng Lượng Mặt Trời (Trường Sơn Solar)
                  </span>
                </div>
                <div className="col-span-12 sm:col-span-5 flex items-baseline">
                  <span className="font-bold shrink-0 w-28">Thủ kho xuất:</span>
                  <span className="font-bold text-slate-950 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                    {receipt.createdByName || 'Thủ kho Solar'}
                  </span>
                </div>
              </div>

              <div className="flex items-baseline">
                <span className="font-bold shrink-0 w-44">Địa điểm giao nhận hàng:</span>
                <span className="font-medium text-slate-900 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                  {deliveryAddress}
                </span>
              </div>
            </div>

            {/* 4. ITEMS DETAIL TABLE */}
            <div className="mb-4">
              <table className="w-full border-collapse border border-slate-900 text-xs">
                <thead>
                  <tr className="bg-slate-100 print:bg-slate-100 text-center font-black border-b border-slate-900">
                    <th rowSpan={2} className="border border-slate-900 px-2 py-2 w-8">STT</th>
                    <th rowSpan={2} className="border border-slate-900 px-3 py-2 text-left">
                      Tên, nhãn hiệu, quy cách phẩm chất vật tư / thiết bị
                    </th>
                    <th rowSpan={2} className="border border-slate-900 px-2 py-2 w-20">Mã SKU</th>
                    <th rowSpan={2} className="border border-slate-900 px-2 py-2 w-14">ĐVT</th>
                    <th colSpan={2} className="border border-slate-900 px-2 py-1">Số lượng</th>
                    {showUnitPrice && (
                      <>
                        <th rowSpan={2} className="border border-slate-900 px-2 py-2 w-24 text-right">Đơn giá</th>
                        <th rowSpan={2} className="border border-slate-900 px-2 py-2 w-28 text-right">Thành tiền</th>
                      </>
                    )}
                    <th rowSpan={2} className="border border-slate-900 px-2 py-2 w-20 text-center">Ghi chú</th>
                  </tr>
                  <tr className="bg-slate-50 print:bg-slate-50 text-center font-bold text-[10px] border-b border-slate-900">
                    <th className="border border-slate-900 px-1 py-1 w-12">Yêu cầu</th>
                    <th className="border border-slate-900 px-1 py-1 w-12">Thực xuất</th>
                  </tr>
                  <tr className="text-center italic text-[9px] bg-slate-50/50 print:bg-transparent text-slate-500 border-b border-slate-900">
                    <td className="border border-slate-900 py-0.5">A</td>
                    <td className="border border-slate-900 py-0.5">B</td>
                    <td className="border border-slate-900 py-0.5">C</td>
                    <td className="border border-slate-900 py-0.5">D</td>
                    <td className="border border-slate-900 py-0.5">1</td>
                    <td className="border border-slate-900 py-0.5">2</td>
                    {showUnitPrice && (
                      <>
                        <td className="border border-slate-900 py-0.5">3</td>
                        <td className="border border-slate-900 py-0.5">4 = 2 x 3</td>
                      </>
                    )}
                    <td className="border border-slate-900 py-0.5">5</td>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const eq = equipment.find(e => e.id === item.equipmentId);
                    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
                    return (
                      <tr key={idx} className="border-b border-slate-900 hover:bg-slate-50/50 print:hover:bg-transparent">
                        <td className="border border-slate-900 px-2 py-2 text-center font-mono font-bold text-slate-700">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-900 px-3 py-2 font-medium">
                          <span className="font-black text-slate-950 block">
                            {item.brand} {item.model}
                          </span>
                          {eq?.details && (
                            <span className="text-[10px] text-slate-500 block leading-tight mt-0.5 font-normal">
                              Quy cách: {eq.details}
                            </span>
                          )}
                        </td>
                        <td className="border border-slate-900 px-2 py-2 text-center font-mono font-bold text-[11px] text-slate-700">
                          {item.equipmentId}
                        </td>
                        <td className="border border-slate-900 px-2 py-2 text-center font-bold text-slate-800">
                          {item.unit || 'Cái'}
                        </td>
                        <td className="border border-slate-900 px-2 py-2 text-center font-bold text-slate-600">
                          {item.quantity}
                        </td>
                        <td className="border border-slate-900 px-2 py-2 text-center font-black text-slate-950">
                          {item.quantity}
                        </td>
                        {showUnitPrice && (
                          <>
                            <td className="border border-slate-900 px-2 py-2 text-right font-medium text-slate-900">
                              {formatCurrencyVND(item.unitPrice)}
                            </td>
                            <td className="border border-slate-900 px-2 py-2 text-right font-black text-slate-950">
                              {formatCurrencyVND(lineTotal)}
                            </td>
                          </>
                        )}
                        <td className="border border-slate-900 px-2 py-2 text-center text-[10px] text-slate-500 font-normal">
                          {eq?.location || 'Đủ tiêu chuẩn'}
                        </td>
                      </tr>
                    );
                  })}

                  {/* SUMMARY ROW */}
                  <tr className="font-black bg-slate-100 print:bg-slate-100 border-t-2 border-slate-900">
                    <td colSpan={4} className="border border-slate-900 px-3 py-2 text-right uppercase tracking-wider">
                      Tổng Cộng:
                    </td>
                    <td className="border border-slate-900 px-2 py-2 text-center font-bold">
                      {totalQuantity}
                    </td>
                    <td className="border border-slate-900 px-2 py-2 text-center font-black text-slate-950">
                      {totalQuantity}
                    </td>
                    {showUnitPrice && (
                      <>
                        <td className="border border-slate-900 px-2 py-2 text-center text-slate-400">
                          x
                        </td>
                        <td className="border border-slate-900 px-2 py-2 text-right text-slate-950 font-black">
                          {formatCurrencyVND(totalValue)}
                        </td>
                      </>
                    )}
                    <td className="border border-slate-900 px-2 py-2 text-center text-[10px]">
                      {items.length} mục
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 5. SUMMARY STATEMENT & WORDS (Chuẩn Kế toán Quản trị) */}
            <div className="space-y-1.5 mb-6 text-xs text-slate-900">
              <p className="font-medium">
                - Tổng số lượng vật tư xuất kho (bằng chữ):{' '}
                <strong className="font-black text-slate-950">
                  {numberToVietnameseWords(totalQuantity).replace(' đồng chẵn.', '')} ({totalQuantity}) đơn vị sản phẩm.
                </strong>
              </p>

              {showUnitPrice && (
                <p className="font-medium">
                  - Tổng số tiền hàng xuất kho (viết bằng chữ):{' '}
                  <strong className="font-black text-slate-950 italic">
                    {numberToVietnameseWords(totalValue)}
                  </strong>
                </p>
              )}

              {isCommercial && receipt.paidAmount !== undefined && (
                <div className="grid grid-cols-2 gap-4 pt-1 font-medium">
                  <p>• Đã thu tiền khách hàng: <strong>{formatCurrencyVND(receipt.paidAmount)}</strong></p>
                  <p>• Ghi nhận công nợ còn lại: <strong className="text-rose-700">{formatCurrencyVND(receipt.debtAmount || 0)}</strong></p>
                </div>
              )}

              <p className="text-[11px] text-slate-500 italic pt-1">
                - Kèm theo chứng từ: Đề xuất cấp vật tư / Biên bản bàn giao kỹ thuật công trình số #{receipt.id}.
              </p>
            </div>

            {/* 6. SIGNATURE BLOCKS (5 Standard Roles) */}
            <div className="pt-2">
              <div className="text-right text-xs italic text-slate-700 mb-2 font-serif">
                Ngày {day} tháng {month} năm {year}
              </div>

              <div className="grid grid-cols-5 gap-2 text-center text-[11px]">
                
                {/* Sign 1: Người lập phiếu */}
                <div className="flex flex-col justify-between h-28">
                  <div>
                    <p className="font-black uppercase tracking-wider text-slate-900">Người lập phiếu</p>
                    <p className="text-[10px] text-slate-500 italic">(Ký, họ tên)</p>
                  </div>
                  <p className="font-bold text-slate-900">{receipt.createdByName || 'Thủ kho Solar'}</p>
                </div>

                {/* Sign 2: Người nhận hàng */}
                <div className="flex flex-col justify-between h-28">
                  <div>
                    <p className="font-black uppercase tracking-wider text-slate-900">Người nhận hàng</p>
                    <p className="text-[10px] text-slate-500 italic">(Ký, họ tên)</p>
                  </div>
                  <p className="font-bold text-slate-900 truncate px-1" title={receipt.partnerName}>
                    {receipt.partnerName}
                  </p>
                </div>

                {/* Sign 3: Thủ kho xuất */}
                <div className="flex flex-col justify-between h-28">
                  <div>
                    <p className="font-black uppercase tracking-wider text-slate-900">Thủ kho</p>
                    <p className="text-[10px] text-slate-500 italic">(Ký, họ tên)</p>
                  </div>
                  <p className="font-bold text-slate-900">Thủ kho Vinasolar</p>
                </div>

                {/* Sign 4: Kế toán kho */}
                <div className="flex flex-col justify-between h-28">
                  <div>
                    <p className="font-black uppercase tracking-wider text-slate-900">Kế toán kho</p>
                    <p className="text-[10px] text-slate-500 italic">(Ký, họ tên)</p>
                  </div>
                  <p className="font-bold text-slate-400 italic">..........................</p>
                </div>

                {/* Sign 5: Giám đốc / Người duyệt */}
                <div className="flex flex-col justify-between h-28">
                  <div>
                    <p className="font-black uppercase tracking-wider text-slate-900">Giám đốc duyệt</p>
                    <p className="text-[10px] text-slate-500 italic">(Ký, đóng dấu)</p>
                  </div>
                  <p className="font-bold text-slate-400 italic">..........................</p>
                </div>

              </div>
            </div>

            {/* 7. FOOTER BAR */}
            <div className="mt-8 pt-3 border-t border-dashed border-slate-300 flex justify-between items-center text-[9px] text-slate-400 italic print:flex">
              <span>Hệ thống Quản lý Kho & Thiết bị Điện Mặt Trời (Vinasolar ERP)</span>
              <span>Thời gian in: {new Date().toLocaleString('vi-VN')}</span>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
