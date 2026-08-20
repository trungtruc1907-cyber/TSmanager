/**
 * Utility function to convert numbers to Vietnamese words for accounting and invoices.
 */
export function numberToVietnameseWords(num: number): string {
  if (isNaN(num) || num === 0) return 'Không đồng';
  if (num < 0) return 'Âm ' + numberToVietnameseWords(Math.abs(num)).toLowerCase();

  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  function readThreeDigits(n: number, isLastGroup: boolean): string {
    const hundred = Math.floor(n / 100);
    const ten = Math.floor((n % 100) / 10);
    const one = n % 10;
    let result = '';

    if (hundred > 0 || !isLastGroup) {
      result += digits[hundred] + ' trăm ';
      if (ten === 0 && one > 0) {
        result += 'lẻ ';
      }
    }

    if (ten === 1) {
      result += 'mười ';
    } else if (ten > 1) {
      result += digits[ten] + ' mươi ';
    }

    if (ten > 0 && one === 1 && ten !== 1) {
      result += 'mốt ';
    } else if (ten >= 1 && one === 5) {
      result += 'lăm ';
    } else if (one > 0) {
      result += digits[one] + ' ';
    }

    return result.trim();
  }

  const groups: number[] = [];
  let temp = Math.round(num);

  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  let textResult = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g > 0) {
      const isLastGroup = i === groups.length - 1;
      const readG = readThreeDigits(g, isLastGroup);
      textResult += readG + ' ' + units[i] + ' ';
    }
  }

  textResult = textResult.trim();
  if (!textResult) return 'Không đồng';

  // Capitalize first letter and append "đồng chẵn"
  textResult = textResult.charAt(0).toUpperCase() + textResult.slice(1);
  return textResult + ' đồng chẵn.';
}

export function formatCurrencyVND(val: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
}

export interface PrintExportReceiptOptions {
  receipt: any;
  equipment?: any[];
  projects?: any[];
  customers?: any[];
  generalSettings?: any;
  showUnitPrice?: boolean;
  pageSize?: 'A4' | 'A5';
  showBarcode?: boolean;
  autoPrint?: boolean;
}

/**
 * Opens a dedicated new browser window with high-quality styled export receipt and print controls.
 */
export function openExportReceiptPrintWindow(options: PrintExportReceiptOptions): Window | null {
  const {
    receipt,
    equipment = [],
    projects = [],
    customers = [],
    generalSettings = null,
    showUnitPrice = true,
    pageSize = 'A4',
    showBarcode = true,
    autoPrint = true
  } = options;

  if (!receipt) return null;

  // Determine export type title & meta
  const isConstruction = receipt.id?.startsWith('PX-TC');
  const isCommercial = receipt.id?.startsWith('PX-TM');
  const isDisposal = receipt.id?.startsWith('PX-HUY');

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

  // Find partner extra info
  const matchedProject = projects.find(p => p.id === receipt.partnerId);
  const matchedCustomer = customers.find(c => c.id === receipt.partnerId || c.name === receipt.partnerName || c.fullName === receipt.partnerName);
  const deliveryAddress = matchedProject?.address || matchedCustomer?.address || 'Tại địa điểm công trình thi công / Địa chỉ khách hàng';
  const contactPhone = matchedProject?.phone || matchedCustomer?.phone || matchedProject?.customerPhone || '';

  // Dates
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

  const items = receipt.items || [];
  const totalQuantity = items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  const totalValue = receipt.totalValue || 0;
  const inWords = numberToVietnameseWords(totalValue);

  // Generate Table Rows
  const tableRowsHTML = items.map((item: any, idx: number) => {
    const eq = equipment.find((e: any) => e.id === item.equipmentId);
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
    const formattedPrice = formatCurrencyVND(item.unitPrice || 0);
    const formattedLineTotal = formatCurrencyVND(lineTotal);
    return `
      <tr class="item-row">
        <td class="text-center font-bold text-slate">${idx + 1}</td>
        <td class="text-left font-medium">
          <span class="brand-text">${item.brand || ''}</span>
          <span class="model-text">${item.model || ''}</span>
          ${eq?.details ? `<span class="spec-text">Quy cách: ${eq.details}</span>` : ''}
        </td>
        <td class="text-center font-mono sku-col">${item.equipmentId || ''}</td>
        <td class="text-center font-bold">${item.unit || 'Cái'}</td>
        <td class="text-center text-slate">${item.quantity || 0}</td>
        <td class="text-center font-bold text-main">${item.quantity || 0}</td>
        <td class="text-right font-medium price-col">${formattedPrice}</td>
        <td class="text-right font-bold text-main price-col">${formattedLineTotal}</td>
        <td class="text-center text-slate font-small">${eq?.location || 'Đạt chuẩn'}</td>
      </tr>
    `;
  }).join('');

  const companyName = generalSettings?.companyName || 'CÔNG TY TNHH KỸ THUẬT NĂNG LƯỢNG TRƯỜNG SƠN';
  const companyAddress = generalSettings?.address || 'KCN Sóng Thần 2, TP. Dĩ An, Tỉnh Bình Dương - CN TP.HCM';
  const companyPhone = generalSettings?.phone || '0988.123.456';
  const companyEmail = generalSettings?.email || 'kho.solar@truongsonenergy.vn';

  // Build the complete standalone HTML string
  const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Phiếu Xuất Kho #${receipt.id} - ${receipt.partnerName || 'Vinasolar'}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      background-color: #f1f5f9;
      line-height: 1.4;
      font-size: 13px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Action bar at the top of the new window */
    .action-bar {
      position: sticky;
      top: 0;
      background: #ffffff;
      border-bottom: 1px solid #cbd5e1;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      z-index: 999;
    }
    .action-title {
      font-weight: 800;
      font-size: 14px;
      color: #0054a6;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .badge {
      background: #e0f2fe;
      color: #0369a1;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-family: monospace;
      font-weight: bold;
    }
    .btn-group {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .btn:hover {
      background: #f8fafc;
      border-color: #94a3b8;
    }
    .btn-primary {
      background: #0054a6;
      color: #ffffff;
      border-color: #004080;
    }
    .btn-primary:hover {
      background: #004080;
    }
    .btn-danger:hover {
      background: #fef2f2;
      color: #dc2626;
      border-color: #fca5a5;
    }

    /* Paper Page Layout */
    .page-container {
      display: flex;
      justify-content: center;
      padding: 24px 16px;
    }
    .sheet {
      background: #ffffff;
      width: 100%;
      max-width: 800px;
      padding: 32px 36px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      border-radius: 4px;
    }

    .sheet.size-a5 {
      max-width: 580px;
      font-size: 11px;
      padding: 20px 24px;
    }

    /* Typography and Components */
    .header-grid {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .company-title {
      font-weight: 900;
      font-size: 13px;
      text-transform: uppercase;
      color: #020617;
      letter-spacing: 0.5px;
    }
    .company-info {
      font-size: 11px;
      color: #475569;
      margin-top: 2px;
    }
    .standard-box {
      border: 1px solid #0f172a;
      padding: 4px 10px;
      text-align: center;
      background: #f8fafc;
    }
    .standard-title {
      font-weight: 800;
      font-size: 10px;
      text-transform: uppercase;
      display: block;
    }
    .standard-sub {
      font-size: 8px;
      font-style: italic;
      color: #64748b;
      display: block;
    }
    .receipt-number {
      font-family: monospace;
      font-weight: 800;
      font-size: 12px;
      margin-top: 4px;
      color: #020617;
      text-align: right;
    }

    .title-section {
      text-align: center;
      margin: 16px 0 14px;
    }
    .main-title {
      font-size: 20px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #020617;
    }
    .sub-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #475569;
      margin-top: 2px;
    }
    .date-text {
      font-size: 12px;
      font-style: italic;
      color: #334155;
      margin-top: 4px;
      font-family: Georgia, serif;
    }
    .barcode-wrapper {
      margin-top: 6px;
      font-family: monospace;
      font-size: 9px;
      color: #64748b;
      letter-spacing: 2px;
    }

    /* Meta Info Card */
    .info-card {
      border: 1px solid #0f172a;
      padding: 12px 14px;
      background: #fafafa;
      margin-bottom: 16px;
      border-radius: 2px;
    }
    .info-row {
      display: flex;
      margin-bottom: 6px;
      align-items: baseline;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .info-label {
      font-weight: 700;
      color: #0f172a;
      width: 175px;
      flex-shrink: 0;
    }
    .info-val {
      flex: 1;
      border-bottom: 1px dotted #94a3b8;
      padding-bottom: 1px;
      font-weight: 600;
      color: #020617;
    }
    .info-val.italic {
      font-style: italic;
      font-weight: 500;
    }

    /* Table Styles */
    table.table-items {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #0f172a;
      margin-bottom: 14px;
    }
    table.table-items th,
    table.table-items td {
      border: 1px solid #0f172a;
      padding: 6px 8px;
      font-size: 11.5px;
    }
    table.table-items th {
      background: #f1f5f9;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 11px;
      text-align: center;
    }
    table.table-items th.sub-th {
      font-size: 9.5px;
      background: #f8fafc;
    }
    .item-row:hover {
      background: #f8fafc;
    }
    .brand-text {
      display: block;
      font-size: 9px;
      font-weight: 800;
      color: #dc2626;
      text-transform: uppercase;
    }
    .model-text {
      display: block;
      font-weight: 800;
      color: #020617;
    }
    .spec-text {
      display: block;
      font-size: 9px;
      color: #64748b;
      font-weight: normal;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 700; }
    .font-medium { font-weight: 500; }
    .font-small { font-size: 9.5px; }
    .font-mono { font-family: monospace; }
    .text-slate { color: #475569; }
    .text-main { color: #020617; }

    /* Summary & In-words */
    .summary-section {
      margin-bottom: 20px;
      font-size: 12px;
      line-height: 1.5;
    }
    .in-words-bold {
      font-weight: 800;
      font-style: italic;
      color: #020617;
    }

    /* Signatures */
    .signatures-section {
      margin-top: 10px;
    }
    .sig-date {
      text-align: right;
      font-style: italic;
      font-size: 12px;
      margin-bottom: 8px;
      font-family: Georgia, serif;
    }
    .sig-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      text-align: center;
      gap: 6px;
    }
    .sig-block {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 110px;
    }
    .sig-title {
      font-weight: 800;
      font-size: 11px;
      text-transform: uppercase;
      color: #0f172a;
    }
    .sig-sub {
      font-size: 9px;
      font-style: italic;
      color: #64748b;
    }
    .sig-name {
      font-weight: 700;
      font-size: 11px;
      color: #0f172a;
    }

    .footer-stamp {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      font-style: italic;
      color: #94a3b8;
    }

    /* Print Specific Overrides */
    @media print {
      body {
        background-color: #ffffff;
      }
      .action-bar {
        display: none !important;
      }
      .page-container {
        padding: 0 !important;
      }
      .sheet {
        box-shadow: none !important;
        padding: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
      }
      @page {
        size: ${pageSize === 'A5' ? 'A5' : 'A4'};
        margin: 12mm 10mm 12mm 10mm;
      }
      .no-print {
        display: none !important;
      }
    }

    .hide-prices .price-col {
      display: none !important;
    }
  </style>
</head>
<body class="${showUnitPrice ? '' : 'hide-prices'}">

  <!-- TOP ACTION BAR -->
  <div class="action-bar no-print">
    <div class="action-title">
      <span>📄 PHIẾU XUẤT KHO</span>
      <span class="badge">#${receipt.id}</span>
      <span style="font-size: 11px; color: #64748b; font-weight: normal;">(Mẫu 02 - VT)</span>
    </div>

    <div class="btn-group">
      <button class="btn" onclick="togglePrice()">
        <span id="price-btn-text">${showUnitPrice ? '👁️ Đang hiện đơn giá' : '🙈 Đang ẩn đơn giá'}</span>
      </button>

      <button class="btn" onclick="toggleSize()">
        <span id="size-btn-text">Khổ giấy: ${pageSize}</span>
      </button>

      <button class="btn btn-primary" onclick="window.print()">
        <span>🖨️ In Phiếu (Print / PDF)</span>
      </button>

      <button class="btn btn-danger" onclick="window.close()">
        <span>❌ Đóng</span>
      </button>
    </div>
  </div>

  <!-- MAIN SHEET -->
  <div class="page-container">
    <div class="sheet ${pageSize === 'A5' ? 'size-a5' : ''}" id="receipt-sheet">
      
      <!-- 1. Header -->
      <div class="header-grid">
        <div style="max-width: 480px;">
          ${generalSettings?.printHeaderUrl ? `
            <img src="${generalSettings.printHeaderUrl}" alt="Banner" style="max-height: 65px; object-fit: contain; margin-bottom: 4px;" />
          ` : `
            <div class="company-title">${companyName}</div>
            <div class="company-info">Địa chỉ: ${companyAddress}</div>
            <div class="company-info">Điện thoại: ${companyPhone} | Email: ${companyEmail}</div>
            <div class="company-info" style="font-weight: 700; color: #020617; margin-top: 2px;">Kho xuất: KHO TỔNG VẬT TƯ & THIẾT BỊ ĐIỆN MẶT TRỜI</div>
          `}
        </div>

        <div style="text-align: right;">
          <div class="standard-box">
            <span class="standard-title">Mẫu số: 02 - VT</span>
            <span class="standard-sub">(Ban hành theo TT số 200/2014/TT-BTC)</span>
          </div>
          <div class="receipt-number">Số: <strong>${receipt.id}</strong></div>
          <div style="font-size: 10px; color: #64748b; font-weight: 600;">Quyển số: 01/XK</div>
        </div>
      </div>

      <!-- 2. Form Title -->
      <div class="title-section">
        <h1 class="main-title">PHIẾU XUẤT KHO</h1>
        <p class="sub-title">(${typeTitle})</p>
        <p class="date-text">Ngày ${day} tháng ${month} năm ${year}</p>
        
        ${showBarcode ? `
          <div class="barcode-wrapper">
            <div style="font-size: 11px; transform: scaleY(1.3);">||| | |||| || | ||||| || ||| |||| | ||||| | ||</div>
            <div style="font-weight: bold; font-size: 8px;">*${receipt.id}*</div>
          </div>
        ` : ''}
      </div>

      <!-- 3. Dispatch & Partner Details -->
      <div class="info-card">
        <div class="info-row">
          <span class="info-label">${partnerRoleLabel}</span>
          <span class="info-val" style="font-weight: 800;">${receipt.partnerName || 'Khách hàng / Đơn vị thi công'} ${contactPhone ? `(${contactPhone})` : ''}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Mã liên kết hồ sơ:</span>
          <span class="info-val font-mono">${receipt.partnerId || 'PROJ_DEFAULT'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Lý do / Mục đích xuất kho:</span>
          <span class="info-val italic">${receipt.note || purposeDefault}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Xuất tại kho:</span>
          <span class="info-val">Kho Tổng Vật Tư Năng Lượng Mặt Trời (Trường Sơn Solar)</span>
        </div>
        <div class="info-row">
          <span class="info-label">Thủ kho phụ trách:</span>
          <span class="info-val" style="font-weight: 700;">${receipt.createdByName || 'Thủ kho Solar'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Địa điểm giao nhận:</span>
          <span class="info-val">${deliveryAddress}</span>
        </div>
      </div>

      <!-- 4. Line Items Table -->
      <table class="table-items">
        <thead>
          <tr>
            <th rowspan="2" style="width: 32px;">STT</th>
            <th rowspan="2" style="text-align: left;">Tên, nhãn hiệu, quy cách phẩm chất vật tư / thiết bị</th>
            <th rowspan="2" class="sku-col" style="width: 80px;">Mã SKU</th>
            <th rowspan="2" style="width: 45px;">ĐVT</th>
            <th colspan="2">Số lượng</th>
            <th rowspan="2" class="price-col" style="width: 90px; text-align: right;">Đơn giá</th>
            <th rowspan="2" class="price-col" style="width: 105px; text-align: right;">Thành tiền</th>
            <th rowspan="2" style="width: 65px;">Ghi chú</th>
          </tr>
          <tr>
            <th class="sub-th" style="width: 45px;">Yêu cầu</th>
            <th class="sub-th" style="width: 45px;">Thực xuất</th>
          </tr>
          <tr style="font-size: 8.5px; font-style: italic; background: #fafafa; color: #64748b; text-align: center;">
            <td>A</td>
            <td>B</td>
            <td class="sku-col">C</td>
            <td>D</td>
            <td>1</td>
            <td>2</td>
            <td class="price-col">3</td>
            <td class="price-col">4 = 2 x 3</td>
            <td>5</td>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHTML}
          
          <!-- Summary Row -->
          <tr style="font-weight: 800; background: #f1f5f9; border-top: 2px solid #0f172a;">
            <td colspan="4" style="text-align: right; text-transform: uppercase; letter-spacing: 0.5px;">Tổng cộng:</td>
            <td class="text-center">${totalQuantity}</td>
            <td class="text-center font-bold" style="color: #020617;">${totalQuantity}</td>
            <td class="text-center price-col" style="color: #94a3b8;">x</td>
            <td class="text-right font-bold price-col" style="color: #020617; font-size: 12px;">${formatCurrencyVND(totalValue)}</td>
            <td class="text-center font-small text-slate">${items.length} mục</td>
          </tr>
        </tbody>
      </table>

      <!-- 5. In-words & Summary Note -->
      <div class="summary-section">
        <p>- Tổng số lượng vật tư xuất kho (viết bằng chữ): <strong>${numberToVietnameseWords(totalQuantity).replace(' đồng chẵn.', '')} (${totalQuantity}) đơn vị vật tư.</strong></p>
        <p class="price-col">- Tổng số tiền xuất kho (viết bằng chữ): <strong class="in-words-bold">${inWords}</strong></p>
        ${isCommercial && receipt.paidAmount !== undefined ? `
          <p style="margin-top: 3px;">• Đã thanh toán: <strong>${formatCurrencyVND(receipt.paidAmount)}</strong> | Ghi nợ: <strong style="color: #dc2626;">${formatCurrencyVND(receipt.debtAmount || 0)}</strong></p>
        ` : ''}
        <p style="font-size: 10px; color: #64748b; font-style: italic; margin-top: 4px;">- Kèm theo chứng từ: Đề xuất cấp vật tư / Biên bản giao nhận kỹ thuật công trình số #${receipt.id}.</p>
      </div>

      <!-- 6. 5 Signature Columns -->
      <div class="signatures-section">
        <div class="sig-date">Ngày ${day} tháng ${month} năm ${year}</div>
        
        <div class="sig-grid">
          <!-- Sig 1 -->
          <div class="sig-block">
            <div>
              <div class="sig-title">Người lập phiếu</div>
              <div class="sig-sub">(Ký, họ tên)</div>
            </div>
            <div class="sig-name">${receipt.createdByName || 'Thủ kho Solar'}</div>
          </div>

          <!-- Sig 2 -->
          <div class="sig-block">
            <div>
              <div class="sig-title">Người nhận hàng</div>
              <div class="sig-sub">(Ký, họ tên)</div>
            </div>
            <div class="sig-name" title="${receipt.partnerName || ''}">${receipt.partnerName || 'Người nhận'}</div>
          </div>

          <!-- Sig 3 -->
          <div class="sig-block">
            <div>
              <div class="sig-title">Thủ kho</div>
              <div class="sig-sub">(Ký, họ tên)</div>
            </div>
            <div class="sig-name">Thủ kho Vinasolar</div>
          </div>

          <!-- Sig 4 -->
          <div class="sig-block">
            <div>
              <div class="sig-title">Kế toán kho</div>
              <div class="sig-sub">(Ký, họ tên)</div>
            </div>
            <div class="sig-name" style="color: #94a3b8; font-style: italic;">...................</div>
          </div>

          <!-- Sig 5 -->
          <div class="sig-block">
            <div>
              <div class="sig-title">Giám đốc duyệt</div>
              <div class="sig-sub">(Ký, đóng dấu)</div>
            </div>
            <div class="sig-name" style="color: #94a3b8; font-style: italic;">...................</div>
          </div>
        </div>
      </div>

      <!-- 7. Footer -->
      <div class="footer-stamp">
        <span>Hệ thống Quản lý Kho & Thiết bị Điện Mặt Trời (Vinasolar ERP)</span>
        <span>Thời gian in: ${new Date().toLocaleString('vi-VN')}</span>
      </div>

    </div>
  </div>

  <script>
    let showPriceState = ${showUnitPrice ? 'true' : 'false'};
    let sizeState = '${pageSize}';

    function togglePrice() {
      showPriceState = !showPriceState;
      if (showPriceState) {
        document.body.classList.remove('hide-prices');
        document.getElementById('price-btn-text').innerText = '👁️ Đang hiện đơn giá';
      } else {
        document.body.classList.add('hide-prices');
        document.getElementById('price-btn-text').innerText = '🙈 Đang ẩn đơn giá';
      }
    }

    function toggleSize() {
      const sheet = document.getElementById('receipt-sheet');
      if (sizeState === 'A4') {
        sizeState = 'A5';
        sheet.classList.add('size-a5');
      } else {
        sizeState = 'A4';
        sheet.classList.remove('size-a5');
      }
      document.getElementById('size-btn-text').innerText = 'Khổ giấy: ' + sizeState;
    }

    ${autoPrint ? `
      window.onload = function() {
        setTimeout(function() {
          window.focus();
          window.print();
        }, 500);
      };
    ` : ''}
  </script>
</body>
</html>`;

  // Try opening new window
  try {
    const printWindow = window.open('', '_blank', 'width=1020,height=920,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      return printWindow;
    }
  } catch (err) {
    console.warn('Popup blocked or error opening print window:', err);
  }

  return null;
}

export interface PrintImportReceiptOptions {
  receipt: any;
  equipment?: any[];
  suppliers?: any[];
  purchaseProposals?: any[];
  generalSettings?: any;
  showUnitPrice?: boolean;
  pageSize?: 'A4' | 'A5';
  showBarcode?: boolean;
  autoPrint?: boolean;
}

/**
 * Opens a dedicated new browser window with high-quality styled import receipt (Mẫu 01-VT) and print controls.
 */
export function openImportReceiptPrintWindow(options: PrintImportReceiptOptions): Window | null {
  const {
    receipt,
    equipment = [],
    suppliers = [],
    purchaseProposals = [],
    generalSettings = null,
    showUnitPrice = true,
    pageSize = 'A4',
    showBarcode = true,
    autoPrint = true
  } = options;

  if (!receipt) return null;

  // Determine receipt type & title
  const isInitialStock = receipt.id?.startsWith('PN-DK') || receipt.partnerId === 'INITIAL_STOCK' || receipt.sourceType === 'initial_stock';
  const isTechReturn = receipt.id?.startsWith('PN-TL') || receipt.partnerId === 'TECH_RETURN' || receipt.sourceType === 'tech_return';
  const isSupplierReturn = receipt.sourceType === 'supplier_return';

  let typeTitle = 'NHẬP KHO MUA HÀNG & VẬT TƯ';
  let typeSub = 'Nhập kho trang thiết bị, vật tư điện mặt trời từ nhà cung cấp';
  let partnerRoleLabel = 'Đơn vị giao hàng / Nhà cung cấp:';
  let purposeDefault = 'Nhập kho mua sắm bổ sung trang thiết bị, vật tư lưu kho phục vụ dự án';

  if (isInitialStock) {
    typeTitle = 'NHẬP SỐ DƯ TỒN KHO ĐẦU KỲ';
    typeSub = 'Khai báo và ghi nhận số dư ban đầu cho các danh mục thiết bị';
    partnerRoleLabel = 'Nguồn ghi nhận:';
    purposeDefault = 'Nhập số dư tồn kho ban đầu để thiết lập dữ liệu quản lý';
  } else if (isTechReturn) {
    typeTitle = 'NHẬP KHO THU HỒI VẬT TƯ TỪ ĐỘI THI CÔNG';
    typeSub = 'Ghi nhận hoàn trả thiết bị, vật tư dư thừa từ công trình thi công';
    partnerRoleLabel = 'Đội thi công / Kỹ thuật viên hoàn trả:';
    purposeDefault = 'Nhập trả lại kho vật tư dư thừa sau khi hoàn thành lắp đặt công trình';
  } else if (isSupplierReturn) {
    typeTitle = 'NHẬP TRẢ HÀNG TỪ NHÀ CUNG CẤP';
    typeSub = 'Nhập bù hàng đổi trả / bảo hành từ nhà cung cấp';
    partnerRoleLabel = 'Nhà cung cấp đổi trả:';
    purposeDefault = 'Nhập lại thiết bị đã qua xử lý bảo hành hoặc đổi mới từ nhà sản xuất';
  }

  // Partner extra info
  const matchedSupplier = suppliers.find(s => s.id === receipt.partnerId || s.name === receipt.partnerName);
  const supplierAddress = matchedSupplier?.address || 'Tại kho đơn vị hoặc địa chỉ nhà cung cấp';
  const supplierPhone = matchedSupplier?.phone || matchedSupplier?.contactPhone || '';
  const supplierTaxCode = matchedSupplier?.taxCode || matchedSupplier?.taxNumber || '';

  // Dates
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

  // Items processing
  const rawItems = receipt.items || [];
  let totalQty = 0;
  let subTotal = 0;

  const processedItems = rawItems.map((item: any, idx: number) => {
    const eq = equipment.find(e => e.id === item.equipmentId);
    const brand = item.brand || eq?.brand || 'Thiết bị';
    const model = item.model || eq?.model || item.equipmentId || `Mặt hàng #${idx + 1}`;
    const unit = item.unit || eq?.unit || 'Cái';
    const qty = Number(item.quantity || item.qty || 1);
    const unitPrice = Number(item.unitPrice !== undefined ? item.unitPrice : (eq?.unitPrice || 0));
    const itemTotal = Number(item.totalPrice !== undefined ? item.totalPrice : (qty * unitPrice));
    const sku = eq?.sku || item.equipmentId || '';
    const note = item.note || eq?.location || eq?.category || '';

    totalQty += qty;
    subTotal += itemTotal;

    return {
      stt: idx + 1,
      name: `${brand} - ${model}`,
      brand,
      model,
      sku,
      unit,
      docQty: qty,
      actualQty: qty,
      unitPrice,
      totalPrice: itemTotal,
      note
    };
  });

  const taxPercent = receipt.taxPercent || 0;
  const taxAmount = receipt.taxAmount !== undefined ? receipt.taxAmount : (taxPercent > 0 ? Math.round((subTotal * taxPercent) / 100) : 0);
  const grandTotal = receipt.totalValue !== undefined ? receipt.totalValue : (subTotal + taxAmount);
  const paidAmount = receipt.paidAmount !== undefined ? receipt.paidAmount : grandTotal;
  const debtAmount = receipt.debtAmount !== undefined ? receipt.debtAmount : Math.max(0, grandTotal - paidAmount);

  const grandTotalInWords = numberToVietnameseWords(grandTotal);

  // Settings
  const companyName = generalSettings?.companyName || 'CÔNG TY CỔ PHẦN CÔNG NGHỆ & ĐIỆN MẶT TRỜI VIỆT NAM (VINASOLAR)';
  const companyAddress = generalSettings?.address || 'Khu Công Nghệ Cao, TP. Thủ Đức, TP. Hồ Chí Minh';
  const companyPhone = generalSettings?.phone || '028.6277.8849 - 0988.123.456';
  const companyEmail = generalSettings?.email || 'kho@vinasolar.vn / contact@vinasolar.vn';
  const companyTaxCode = generalSettings?.taxCode || '0315897426';
  const warehouseName = generalSettings?.warehouseName || 'Kho Tổng Vật Tư Cơ Điện & Pin Năng Lượng Mặt Trời';
  const warehouseAddress = generalSettings?.warehouseAddress || companyAddress;

  // Barcode mock (SVG Barcode lines)
  const barcodeSvg = showBarcode ? `
    <svg style="height: 38px; width: 150px; display: block; margin: 0 auto;" viewBox="0 0 160 40">
      <rect x="5" y="5" width="2" height="24" fill="#1e293b"/>
      <rect x="9" y="5" width="4" height="24" fill="#1e293b"/>
      <rect x="15" y="5" width="1" height="24" fill="#1e293b"/>
      <rect x="18" y="5" width="3" height="24" fill="#1e293b"/>
      <rect x="23" y="5" width="2" height="24" fill="#1e293b"/>
      <rect x="27" y="5" width="5" height="24" fill="#1e293b"/>
      <rect x="34" y="5" width="2" height="24" fill="#1e293b"/>
      <rect x="38" y="5" width="1" height="24" fill="#1e293b"/>
      <rect x="42" y="5" width="4" height="24" fill="#1e293b"/>
      <rect x="48" y="5" width="2" height="24" fill="#1e293b"/>
      <rect x="52" y="5" width="3" height="24" fill="#1e293b"/>
      <rect x="58" y="5" width="1" height="24" fill="#1e293b"/>
      <rect x="62" y="5" width="4" height="24" fill="#1e293b"/>
      <rect x="68" y="5" width="2" height="24" fill="#1e293b"/>
      <rect x="72" y="5" width="3" height="24" fill="#1e293b"/>
      <rect x="78" y="5" width="2" height="24" fill="#1e293b"/>
      <rect x="82" y="5" width="5" height="24" fill="#1e293b"/>
      <rect x="89" y="5" width="1" height="24" fill="#1e293b"/>
      <rect x="92" y="5" width="3" height="24" fill="#1e293b"/>
      <rect x="97" y="5" width="2" height="24" fill="#1e293b"/>
      <rect x="101" y="5" width="4" height="24" fill="#1e293b"/>
      <rect x="107" y="5" width="2" height="24" fill="#1e293b"/>
      <rect x="111" y="5" width="3" height="24" fill="#1e293b"/>
      <rect x="116" y="5" width="2" height="24" fill="#1e293b"/>
      <rect x="120" y="5" width="5" height="24" fill="#1e293b"/>
      <rect x="127" y="5" width="1" height="24" fill="#1e293b"/>
      <rect x="130" y="5" width="4" height="24" fill="#1e293b"/>
      <rect x="136" y="5" width="2" height="24" fill="#1e293b"/>
      <rect x="140" y="5" width="3" height="24" fill="#1e293b"/>
      <rect x="145" y="5" width="2" height="24" fill="#1e293b"/>
      <rect x="149" y="5" width="4" height="24" fill="#1e293b"/>
      <text x="80" y="37" font-size="9" font-family="monospace" font-weight="bold" fill="#475569" text-anchor="middle">${receipt.id}</text>
    </svg>
  ` : '';

  // Generate table rows HTML
  const itemsRowsHtml = processedItems.map(item => `
    <tr>
      <td style="text-align: center; font-weight: bold; color: #475569;">${item.stt}</td>
      <td>
        <div style="font-weight: 800; color: #0f172a; font-size: 11.5px;">${item.brand} - ${item.model}</div>
        ${item.sku ? `<div style="font-size: 9.5px; color: #64748b; font-family: monospace; margin-top: 1px;">Mã/SKU: ${item.sku}</div>` : ''}
      </td>
      <td style="text-align: center; font-weight: 600; color: #334155;">${item.unit}</td>
      <td style="text-align: center; font-weight: 600; color: #475569;">${item.docQty}</td>
      <td style="text-align: center; font-weight: 800; color: #0f172a;">${item.actualQty}</td>
      <td class="price-col" style="text-align: right; font-weight: 600; color: #334155;">${formatCurrencyVND(item.unitPrice)}</td>
      <td class="price-col" style="text-align: right; font-weight: 800; color: #0f172a;">${formatCurrencyVND(item.totalPrice)}</td>
      <td style="font-size: 10px; color: #64748b;">${item.note || '-'}</td>
    </tr>
  `).join('');

  // Complete HTML document
  const htmlContent = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Phiếu Nhập Kho - ${receipt.id} - ${receipt.partnerName || 'Vinasolar'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      line-height: 1.45;
      color: #1e293b;
      background-color: #f1f5f9;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Floating Action Header (Screen only) */
    .action-header {
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      backdrop-filter: blur(8px);
    }

    .action-header .title-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .action-header .badge {
      background: #059669;
      color: #ffffff;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .action-header .doc-id {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      color: #38bdf8;
    }

    .action-header .btn-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
      font-family: inherit;
    }

    .btn-primary {
      background: #0054a6;
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(0,84,166,0.35);
    }
    .btn-primary:hover {
      background: #004080;
    }

    .btn-secondary {
      background: #334155;
      color: #f8fafc;
      border-color: #475569;
    }
    .btn-secondary:hover {
      background: #475569;
    }

    .btn-close {
      background: #dc2626;
      color: #ffffff;
    }
    .btn-close:hover {
      background: #b91c1c;
    }

    /* Print Paper Sheet */
    .paper-container {
      display: flex;
      justify-content: center;
      padding: 24px 16px 48px;
    }

    .paper-sheet {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm 18mm;
      background: #ffffff;
      box-shadow: 0 10px 30px rgba(0,0,0,0.08);
      position: relative;
    }

    .paper-sheet.size-a5 {
      width: 148mm;
      min-height: 210mm;
      padding: 10mm 12mm;
      font-size: 10px;
    }

    /* Header Section */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0054a6;
      padding-bottom: 12px;
      margin-bottom: 14px;
      gap: 16px;
    }

    .company-info {
      flex: 1;
    }

    .company-title {
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      color: #0054a6;
      letter-spacing: 0.3px;
      margin-bottom: 3px;
    }

    .company-desc {
      font-size: 10px;
      color: #475569;
      line-height: 1.4;
    }

    .company-desc strong {
      color: #1e293b;
    }

    .form-meta {
      text-align: right;
      flex-shrink: 0;
    }

    .form-sample {
      font-size: 9.5px;
      font-weight: 700;
      color: #334155;
    }

    .form-decree {
      font-size: 8.5px;
      color: #64748b;
      font-style: italic;
      margin-top: 1px;
    }

    .receipt-id-box {
      margin-top: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #0f172a;
    }

    /* Title Block */
    .title-block {
      text-align: center;
      margin: 16px 0 14px;
    }

    .main-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 3px;
    }

    .sub-title {
      font-size: 10.5px;
      color: #059669;
      font-weight: 700;
      font-style: italic;
      margin-bottom: 4px;
    }

    .date-row {
      font-size: 10.5px;
      color: #475569;
      font-style: italic;
    }

    /* Meta Info Grid */
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      margin-bottom: 14px;
      font-size: 10.5px;
      line-height: 1.6;
    }

    .meta-line {
      display: flex;
      margin-bottom: 3px;
    }
    .meta-line:last-child {
      margin-bottom: 0;
    }

    .meta-label {
      width: 170px;
      font-weight: 700;
      color: #475569;
      flex-shrink: 0;
    }

    .meta-value {
      font-weight: 600;
      color: #0f172a;
      flex: 1;
    }

    .meta-value.strong {
      font-weight: 800;
      color: #0054a6;
    }

    /* Data Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 10.5px;
    }

    .items-table th, .items-table td {
      border: 1px solid #cbd5e1;
      padding: 7px 9px;
    }

    .items-table th {
      background: #f1f5f9;
      color: #0f172a;
      font-weight: 800;
      text-align: center;
      text-transform: uppercase;
      font-size: 9.5px;
      letter-spacing: 0.3px;
    }

    .items-table tbody tr:nth-child(even) {
      background-color: #fafafa;
    }

    .summary-row td {
      background: #f8fafc;
      font-weight: 800;
      color: #0f172a;
    }

    /* Amounts in Words & Payment breakdown */
    .amount-words-box {
      margin-bottom: 14px;
      padding: 8px 12px;
      border-left: 3px solid #059669;
      background: #f0fdf4;
      font-size: 10.5px;
    }

    .amount-words-box strong {
      color: #065f46;
    }

    .payment-summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
      font-size: 10.5px;
    }

    .payment-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
    }

    .payment-card-line {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }
    .payment-card-line:last-child {
      margin-bottom: 0;
    }

    /* Signatures Section */
    .signatures-section {
      margin-top: 20px;
      page-break-inside: avoid;
    }

    .sig-date-line {
      text-align: right;
      font-style: italic;
      font-size: 10.5px;
      color: #475569;
      margin-bottom: 10px;
    }

    .sig-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      text-align: center;
      gap: 8px;
    }

    .sig-col {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 110px;
    }

    .sig-title {
      font-weight: 800;
      text-transform: uppercase;
      font-size: 10px;
      color: #0f172a;
    }

    .sig-sub {
      font-size: 8.5px;
      font-style: italic;
      color: #64748b;
      margin-top: 2px;
    }

    .sig-name {
      font-weight: 700;
      font-size: 10.5px;
      color: #0f172a;
    }

    /* Footer Stamp */
    .footer-stamp {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #94a3b8;
    }

    /* Toggle visibility helper */
    .hide-prices .price-col {
      display: none !important;
    }

    /* Print Styles */
    @media print {
      @page {
        size: A4 portrait;
        margin: 10mm 12mm 10mm 12mm;
      }

      body {
        background: #ffffff !important;
        color: #000000 !important;
      }

      .action-header {
        display: none !important;
      }

      .paper-container {
        padding: 0 !important;
      }

      .paper-sheet {
        width: 100% !important;
        min-height: auto !important;
        padding: 0 !important;
        box-shadow: none !important;
      }

      .meta-box, .payment-card, .amount-words-box {
        background: transparent !important;
        border-color: #94a3b8 !important;
      }

      .items-table th {
        background: #e2e8f0 !important;
        color: #000000 !important;
      }

      .summary-row td {
        background: #f1f5f9 !important;
        color: #000000 !important;
      }
    }
  </style>
</head>
<body>

  <!-- 1. Floating Screen Action Bar -->
  <div class="action-header">
    <div class="title-group">
      <span class="badge">Phiếu Nhập Kho</span>
      <span class="doc-id">#${receipt.id}</span>
      <span style="font-size: 11px; color: #94a3b8;">${receipt.partnerName || 'NCC'}</span>
    </div>

    <div class="btn-group">
      <button class="btn btn-secondary" onclick="togglePrice()" id="toggle-price-btn" title="Ẩn hoặc hiện cột đơn giá / thành tiền">
        <span id="price-btn-text">👁️ Đang hiện đơn giá</span>
      </button>

      <button class="btn btn-secondary" onclick="toggleSize()" id="toggle-size-btn" title="Chuyển đổi kích thước khổ giấy A4 / A5">
        <span id="size-btn-text">Khổ giấy: ${pageSize}</span>
      </button>

      <button class="btn btn-primary" onclick="window.print()" title="In ra máy in hoặc lưu tệp PDF">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
        <span>In Phiếu (Print / PDF)</span>
      </button>

      <button class="btn btn-close" onclick="window.close()" title="Đóng cửa sổ in">
        <span>✕ Đóng</span>
      </button>
    </div>
  </div>

  <!-- 2. Printable Paper Container -->
  <div class="paper-container">
    <div class="paper-sheet ${pageSize === 'A5' ? 'size-a5' : ''}" id="receipt-sheet">
      
      <!-- 1. Header (Company Info & Form decree) -->
      <div class="header-row">
        <div class="company-info">
          <div class="company-title">${companyName}</div>
          <div class="company-desc">
            <div><strong>Địa chỉ:</strong> ${companyAddress}</div>
            <div><strong>Điện thoại:</strong> ${companyPhone} | <strong>Email:</strong> ${companyEmail}</div>
            <div><strong>Mã số thuế:</strong> ${companyTaxCode} | <strong>Kho:</strong> ${warehouseName}</div>
          </div>
        </div>

        <div class="form-meta">
          <div class="form-sample">Mẫu số: 01 - VT</div>
          <div class="form-decree">(Ban hành theo TT số 200/2014/TT-BTC<br>ngày 22/12/2014 của Bộ Tài chính)</div>
          <div class="receipt-id-box">Số phiếu: <strong>${receipt.id}</strong></div>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Quyển số: 01/NK</div>
        </div>
      </div>

      <!-- 2. Title block -->
      <div class="title-block">
        <div class="main-title">PHIẾU NHẬP KHO</div>
        <div class="sub-title">${typeTitle}</div>
        <div class="date-row">Ngày ${day} tháng ${month} năm ${year}</div>
        ${barcodeSvg ? `<div style="margin-top: 6px;">${barcodeSvg}</div>` : ''}
      </div>

      <!-- 3. Metadata box -->
      <div class="meta-box">
        <div class="meta-line">
          <div class="meta-label">${partnerRoleLabel}</div>
          <div class="meta-value strong">${receipt.partnerName || 'Chưa xác định'} ${supplierPhone ? `(SĐT: ${supplierPhone})` : ''}</div>
        </div>
        <div class="meta-line">
          <div class="meta-label">Địa chỉ đối tác:</div>
          <div class="meta-value">${supplierAddress}</div>
        </div>
        <div class="meta-line">
          <div class="meta-label">Theo hóa đơn / đề xuất:</div>
          <div class="meta-value">${receipt.proposalId ? `Đề xuất mua sắm số #${receipt.proposalId}` : (receipt.invoiceNo ? `Hóa đơn số ${receipt.invoiceNo}` : `Phiếu bàn giao nhập kho #${receipt.id}`)} ngày ${receipt.date || `${day}/${month}/${year}`}</div>
        </div>
        <div class="meta-line">
          <div class="meta-label">Nhập tại kho:</div>
          <div class="meta-value strong">${warehouseName} (${warehouseAddress})</div>
        </div>
        <div class="meta-line">
          <div class="meta-label">Thủ kho tiếp nhận:</div>
          <div class="meta-value">${receipt.createdByName || 'Thủ kho Vinasolar'}</div>
        </div>
        <div class="meta-line">
          <div class="meta-label">Lý do / Mục đích nhập:</div>
          <div class="meta-value">${receipt.note || purposeDefault}</div>
        </div>
      </div>

      <!-- 4. Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 32px;" rowspan="2">STT</th>
            <th rowspan="2">Tên nhãn hiệu, quy cách, phẩm chất<br>vật tư, thiết bị Solar</th>
            <th style="width: 48px;" rowspan="2">ĐVT</th>
            <th colspan="2">Số lượng</th>
            <th class="price-col" style="width: 85px;" rowspan="2">Đơn giá (VNĐ)</th>
            <th class="price-col" style="width: 100px;" rowspan="2">Thành tiền (VNĐ)</th>
            <th style="width: 75px;" rowspan="2">Ghi chú</th>
          </tr>
          <tr>
            <th style="width: 55px;">Chứng từ</th>
            <th style="width: 55px;">Thực nhập</th>
          </tr>
          <tr style="font-size: 8.5px; color: #64748b; background: #fafafa;">
            <th>A</th>
            <th>B</th>
            <th>C</th>
            <th>1</th>
            <th>2</th>
            <th class="price-col">3</th>
            <th class="price-col">4 = 2 x 3</th>
            <th>D</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}

          <!-- Subtotal / Summary Row -->
          <tr class="summary-row">
            <td colspan="3" style="text-align: right; font-weight: 800; text-transform: uppercase;">Tổng cộng:</td>
            <td style="text-align: center; font-weight: 800;">${totalQty}</td>
            <td style="text-align: center; font-weight: 800; color: #0054a6;">${totalQty}</td>
            <td class="price-col" style="text-align: right;">-</td>
            <td class="price-col" style="text-align: right; font-weight: 800; color: #0054a6;">${formatCurrencyVND(subTotal)}</td>
            <td></td>
          </tr>

          ${taxAmount > 0 ? `
          <tr class="summary-row price-col">
            <td colspan="6" style="text-align: right; font-weight: 700; color: #d97706;">Thuế suất GTGT (${taxPercent}%):</td>
            <td style="text-align: right; font-weight: 800; color: #d97706;">+ ${formatCurrencyVND(taxAmount)}</td>
            <td></td>
          </tr>
          ` : ''}

          <tr class="summary-row price-col">
            <td colspan="6" style="text-align: right; font-weight: 800; text-transform: uppercase; color: #0f172a; font-size: 11px;">Tổng tiền thanh toán (đã bao gồm thuế):</td>
            <td style="text-align: right; font-weight: 800; color: #0054a6; font-size: 12px;">${formatCurrencyVND(grandTotal)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <!-- 5. Amount in words & Payment Status -->
      <div class="amount-words-box price-col">
        <div><strong>Tổng số tiền (viết bằng chữ):</strong> <span style="font-style: italic; font-weight: 600; color: #0f172a;">${grandTotalInWords}</span></div>
      </div>

      <div class="payment-summary-grid price-col">
        <div class="payment-card">
          <div class="payment-card-line">
            <span style="color: #64748b; font-weight: 700;">Đã thanh toán cho bên giao:</span>
            <span style="font-weight: 800; color: #059669;">${formatCurrencyVND(paidAmount)}</span>
          </div>
          <div class="payment-card-line">
            <span style="color: #64748b; font-weight: 700;">Hình thức thanh toán:</span>
            <span style="font-weight: 600; color: #334155;">${receipt.paymentMethod || 'Chuyển khoản / Tiền mặt'}</span>
          </div>
        </div>
        <div class="payment-card">
          <div class="payment-card-line">
            <span style="color: #64748b; font-weight: 700;">Còn ghi nợ nhà cung cấp:</span>
            <span style="font-weight: 800; color: ${debtAmount > 0 ? '#e11d48' : '#64748b'};">${formatCurrencyVND(debtAmount)}</span>
          </div>
          <div class="payment-card-line">
            <span style="color: #64748b; font-weight: 700;">Trạng thái chứng từ:</span>
            <span style="font-weight: 700; color: #059669;">Đã nhập sổ kho thành công</span>
          </div>
        </div>
      </div>

      <!-- 6. Signatures (5 accounting roles) -->
      <div class="signatures-section">
        <div class="sig-date-line">
          Ngày ${day} tháng ${month} năm ${year}
        </div>

        <div class="sig-grid">
          <!-- Sig 1: Người lập -->
          <div class="sig-col">
            <div>
              <div class="sig-title">Người lập phiếu</div>
              <div class="sig-sub">(Ký, họ tên)</div>
            </div>
            <div class="sig-name">${receipt.createdByName || 'Người lập phiếu'}</div>
          </div>

          <!-- Sig 2: Người giao -->
          <div class="sig-col">
            <div>
              <div class="sig-title">Người giao hàng</div>
              <div class="sig-sub">(Ký, họ tên)</div>
            </div>
            <div class="sig-name">${receipt.partnerName || 'Đại diện bên giao'}</div>
          </div>

          <!-- Sig 3: Thủ kho -->
          <div class="sig-col">
            <div>
              <div class="sig-title">Thủ kho</div>
              <div class="sig-sub">(Ký, họ tên)</div>
            </div>
            <div class="sig-name">${receipt.createdByName || 'Thủ kho Vinasolar'}</div>
          </div>

          <!-- Sig 4: Kế toán -->
          <div class="sig-col">
            <div>
              <div class="sig-title">Kế toán trưởng</div>
              <div class="sig-sub">(Ký, họ tên)</div>
            </div>
            <div class="sig-name" style="color: #94a3b8; font-style: italic;">...................</div>
          </div>

          <!-- Sig 5: Giám đốc -->
          <div class="sig-col">
            <div>
              <div class="sig-title">Giám đốc duyệt</div>
              <div class="sig-sub">(Ký, đóng dấu)</div>
            </div>
            <div class="sig-name" style="color: #94a3b8; font-style: italic;">...................</div>
          </div>
        </div>
      </div>

      <!-- 7. Footer -->
      <div class="footer-stamp">
        <span>Hệ thống Quản lý Kho & Thiết bị Điện Mặt Trời (Vinasolar ERP)</span>
        <span>Thời gian in: ${new Date().toLocaleString('vi-VN')}</span>
      </div>

    </div>
  </div>

  <script>
    let showPriceState = ${showUnitPrice ? 'true' : 'false'};
    let sizeState = '${pageSize}';

    function togglePrice() {
      showPriceState = !showPriceState;
      if (showPriceState) {
        document.body.classList.remove('hide-prices');
        document.getElementById('price-btn-text').innerText = '👁️ Đang hiện đơn giá';
      } else {
        document.body.classList.add('hide-prices');
        document.getElementById('price-btn-text').innerText = '🙈 Đang ẩn đơn giá';
      }
    }

    function toggleSize() {
      const sheet = document.getElementById('receipt-sheet');
      if (sizeState === 'A4') {
        sizeState = 'A5';
        sheet.classList.add('size-a5');
      } else {
        sizeState = 'A4';
        sheet.classList.remove('size-a5');
      }
      document.getElementById('size-btn-text').innerText = 'Khổ giấy: ' + sizeState;
    }

    ${autoPrint ? `
      window.onload = function() {
        setTimeout(function() {
          window.focus();
          window.print();
        }, 500);
      };
    ` : ''}
  </script>
</body>
</html>`;

  // Try opening new window
  try {
    const printWindow = window.open('', '_blank', 'width=1020,height=920,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      return printWindow;
    }
  } catch (err) {
    console.warn('Popup blocked or error opening print window:', err);
  }

  return null;
}


