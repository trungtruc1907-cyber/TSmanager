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

