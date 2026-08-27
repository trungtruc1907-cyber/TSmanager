import { Equipment } from './types';

/**
 * Loại bỏ dấu tiếng Việt để phục vụ tìm kiếm không phân biệt dấu
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  let res = str.toString();
  res = res.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  res = res.replace(/đ/g, 'd').replace(/Đ/g, 'D');
  return res;
}

/**
 * Chuẩn hóa chuỗi tìm kiếm (xóa ký tự đặc biệt, đưa về chữ thường không dấu)
 */
export function normalizeSearchText(str: string): string {
  if (!str) return '';
  return removeVietnameseTones(str)
    .toLowerCase()
    .replace(/[()[\]{}_,./:;*+^$&#@!=?-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Khớp vật tư thiết bị với từ khóa tìm kiếm (hỗ trợ tìm mờ, không phân biệt dấu, viết hoa, dấu gạch nối)
 */
export function matchEquipment(eq: Record<string, any> | null | undefined, query: string): boolean {
  if (!eq) return false;
  if (!query || !query.trim()) return true;

  const rawQuery = query.trim().toLowerCase();
  const normQuery = normalizeSearchText(query);
  if (!normQuery) return true;

  // Xây dựng chuỗi dữ liệu searchable
  const fields = [
    eq.id,
    eq.brand,
    eq.model,
    eq.name,
    eq.barcode,
    eq.sku,
    eq.group,
    eq.unit,
    eq.location,
    eq.supplier,
    eq.details,
    eq.type,
    eq.description
  ].filter(Boolean);

  const rawTarget = fields.join(' ').toLowerCase();
  const normTarget = normalizeSearchText(rawTarget);

  // 1. Kiểm tra chứa trực tiếp
  if (rawTarget.includes(rawQuery) || normTarget.includes(normQuery)) {
    return true;
  }

  // 2. Kiểm tra không khoảng trắng (Ví dụ: "cxv2x10" khớp với "cxv 2x10" hoặc "CXV-2X10")
  const compactQuery = normQuery.replace(/\s+/g, '');
  const compactTarget = normTarget.replace(/\s+/g, '');
  if (compactTarget.includes(compactQuery)) {
    return true;
  }

  // 3. Kiểm tra tất cả các từ khóa riêng lẻ đều xuất hiện
  const queryTokens = normQuery.split(' ').filter(token => token.length > 0);
  const allTokensMatch = queryTokens.every(token => normTarget.includes(token) || compactTarget.includes(token));
  if (allTokensMatch) {
    return true;
  }

  return false;
}

/**
 * Gợi ý thuộc tính ban đầu khi người dùng tạo nhanh một mã vật tư mới từ từ khóa tìm kiếm
 */
export function guessEquipmentAttributes(searchTerm: string) {
  const norm = normalizeSearchText(searchTerm);
  const cleanModel = searchTerm.trim();

  let brand = 'Khác';
  let unit = 'Cái';
  let type: 'panel' | 'inverter' | 'battery' | 'mounting' | 'accessory' | 'other' = 'other';
  let supplier = 'Chưa liên kết';
  let unitPrice = 50000;
  let sellingPrice = 65000;
  let details = cleanModel;

  if (norm.includes('cxv') || norm.includes('cadivi') || norm.includes('cap') || norm.includes('day') || norm.includes('cable') || norm.includes('2x10') || norm.includes('2x16') || norm.includes('4x16')) {
    brand = 'Cadivi';
    unit = 'Mét';
    type = 'other';
    supplier = 'Cáp điện Cadivi Việt Nam';
    if (norm.includes('2x10') || norm.includes('2*10')) {
      unitPrice = 85000;
      sellingPrice = 110000;
      details = 'Cáp điện lực hạ thế Cu/XLPE/PVC 0.6/1kV 2x10mm² (kèm cáp đồng tiếp địa x16mm²)';
    } else if (norm.includes('2x16') || norm.includes('2*16')) {
      unitPrice = 135000;
      sellingPrice = 165000;
      details = 'Cáp điện lực hạ thế Cu/XLPE/PVC 0.6/1kV 2x16mm²';
    } else if (norm.includes('4x16') || norm.includes('4*16')) {
      unitPrice = 245000;
      sellingPrice = 295000;
      details = 'Cáp điện lực hạ thế 3 pha 4 ruột đồng Cu/XLPE/PVC 0.6/1kV 4x16mm²';
    }
  } else if (norm.includes('dc') || norm.includes('solar') || norm.includes('4mm') || norm.includes('6mm')) {
    brand = 'Leader / KBE';
    unit = 'Mét';
    type = 'other';
    supplier = 'Solar Sông Đà';
    unitPrice = 14000;
    sellingPrice = 18000;
    details = 'Cáp DC Solar chuyên dụng chống tia UV 1500V tiêu chuẩn EN50618';
  } else if (norm.includes('panel') || norm.includes('tam pin') || norm.includes('longi') || norm.includes('jinko') || norm.includes('550w') || norm.includes('545w')) {
    brand = norm.includes('jinko') ? 'Jinko Solar' : 'Longi Solar';
    unit = 'Tấm';
    type = 'panel';
    supplier = 'Solar Sông Đà';
    unitPrice = 2100000;
    sellingPrice = 2800000;
  } else if (norm.includes('inverter') || norm.includes('bien tan') || norm.includes('growatt') || norm.includes('deye') || norm.includes('huawei')) {
    brand = norm.includes('deye') ? 'Deye' : 'Growatt';
    unit = 'Bộ';
    type = 'inverter';
    supplier = 'Growatt Việt Nam';
    unitPrice = 18500000;
    sellingPrice = 23000000;
  } else if (norm.includes('battery') || norm.includes('pin luu tru') || norm.includes('gigabox') || norm.includes('pylontech')) {
    brand = 'Gigabox';
    unit = 'Quả';
    type = 'battery';
    supplier = 'Solar Sông Đà';
    unitPrice = 28000000;
    sellingPrice = 34000000;
  } else if (norm.includes('ray') || norm.includes('nhom') || norm.includes('rail') || norm.includes('kep')) {
    brand = 'Trường Sơn';
    unit = 'Thanh';
    type = 'mounting';
    supplier = 'Nhôm Định Hình Việt Pháp';
    unitPrice = 180000;
    sellingPrice = 250000;
  }

  // Tạo mã ID gọn gàng
  const sanitized = removeVietnameseTones(searchTerm)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);

  const suggestedId = sanitized ? `${sanitized}` : `VT-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    id: suggestedId,
    brand,
    model: cleanModel,
    type,
    unit,
    supplier,
    unitPrice,
    sellingPrice,
    details
  };
}
