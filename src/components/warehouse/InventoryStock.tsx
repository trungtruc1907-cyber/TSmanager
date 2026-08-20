import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  AlertTriangle, 
  Download, 
  Upload, 
  Filter, 
  Settings, 
  Info,
  Calendar,
  History,
  TrendingUp,
  MapPin,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  MoreVertical,
  QrCode,
  Printer,
  RefreshCw,
  FileText,
  Layers,
  ChevronDown,
  ShoppingBag,
  Clock,
  ArrowRight,
  CheckCircle2,
  PackageCheck,
  Truck,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, setDoc, deleteDoc } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { Equipment, InventoryTransaction, WarehouseSupplier } from './types';

const renderFakeQrCodeSvg = (id: string) => {
  const squares = [];
  const idHash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  for (let i = 2; i < 14; i += 2) {
    for (let j = 2; j < 14; j += 2) {
      if (((i * j + idHash) % 3) === 0) {
        squares.push(<rect key={`${i}-${j}`} x={i} y={j} width={2} height={2} className="fill-slate-900" />);
      }
    }
  }
  return (
    <svg viewBox="0 0 16 16" className="w-16 h-16 text-slate-900 shrink-0 select-none">
      <rect x={0} y={0} width={5} height={5} className="fill-none stroke-slate-900" strokeWidth={0.5} />
      <rect x={1} y={1} width={3} height={3} className="fill-slate-900" />
      <rect x={11} y={0} width={5} height={5} className="fill-none stroke-slate-900" strokeWidth={0.5} />
      <rect x={12} y={1} width={3} height={3} className="fill-slate-900" />
      <rect x={0} y={11} width={5} height={5} className="fill-none stroke-slate-900" strokeWidth={0.5} />
      <rect x={1} y={12} width={3} height={3} className="fill-slate-900" />
      {squares}
    </svg>
  );
};

interface InventoryStockProps {
  equipment: Equipment[];
  transactions: InventoryTransaction[];
  userRole: string;
  suppliers?: WarehouseSupplier[];
}

export default function InventoryStock({ equipment, transactions, userRole, suppliers = [] }: InventoryStockProps) {
  // Predefined high-fidelity mockup items representing the screenshot
  const mockupItems = [
    {
      id: 'VT001',
      brand: 'Ống nhựa',
      model: 'Ống PVC D25',
      name: 'Ống PVC D25',
      barcode: '8936100000012',
      kho: 'Kho chính',
      unit: 'm',
      stock: 235,
      holding: 20,
      buying: 80,
      available: 215,
      minStock: 100,
      maxStock: 500,
      unitPrice: 35000,
      sellingPrice: 45000,
      status: 'Bình thường' as const,
      group: 'Ống nhựa',
      location: 'Kệ A1-A3',
      supplier: 'Công ty TNHH ABC',
      details: 'D25mm - Dày 2.0mm',
      type: 'other'
    },
    {
      id: 'VT002',
      brand: 'Xi măng',
      model: 'Xi măng PCB40',
      name: 'Xi măng PCB40',
      barcode: '8936100000029',
      kho: 'Kho chính',
      unit: 'bao',
      stock: 20,
      holding: 15,
      buying: 100,
      available: 5,
      minStock: 50,
      maxStock: 300,
      unitPrice: 95000,
      sellingPrice: 120000,
      status: 'Thiếu hàng' as const,
      group: 'Vật liệu xây dựng',
      location: 'Kệ D1',
      supplier: 'Vật liệu xây dựng Trường Sơn',
      details: 'Bao 50kg',
      type: 'other'
    },
    {
      id: 'VT003',
      brand: 'Keo dán',
      model: 'Keo PU',
      name: 'Keo PU',
      barcode: '8936100000036',
      kho: 'Kho phụ',
      unit: 'chai',
      stock: 12,
      holding: 2,
      buying: 0,
      available: 10,
      minStock: 10,
      maxStock: 50,
      unitPrice: 45000,
      sellingPrice: 55000,
      status: 'Cảnh báo' as const,
      group: 'Keo dán',
      location: 'Kệ B2',
      supplier: 'Keo dán silicone Apollo',
      details: 'Chai 300ml',
      type: 'other'
    },
    {
      id: 'VT004',
      brand: 'Thiết bị điện',
      model: 'Dây điện Cadivi 2.5',
      name: 'Dây điện Cadivi 2.5',
      barcode: '8936100000043',
      kho: 'Kho chính',
      unit: 'm',
      stock: 350,
      holding: 30,
      buying: 0,
      available: 320,
      minStock: 100,
      maxStock: 1000,
      unitPrice: 8500,
      sellingPrice: 11000,
      status: 'Bình thường' as const,
      group: 'Thiết bị điện',
      location: 'Kệ C1',
      supplier: 'Cáp điện Cadivi Việt Nam',
      details: 'Cu/PVC 1x2.5',
      type: 'other'
    },
    {
      id: 'VT005',
      brand: 'Sơn nước',
      model: 'Sơn chống thấm KOVA',
      name: 'Sơn chống thấm KOVA',
      barcode: '8936100000050',
      kho: 'Kho phụ',
      unit: 'kg',
      stock: 0,
      holding: 0,
      buying: 50,
      available: 0,
      minStock: 10,
      maxStock: 100,
      unitPrice: 120000,
      sellingPrice: 150000,
      status: 'Hết hàng' as const,
      group: 'Sơn chống thấm',
      location: 'Kệ B1',
      supplier: 'Sơn KOVA miền Bắc',
      details: 'Thùng 20kg',
      type: 'other'
    }
  ];

  // Merge database items into the list (avoiding duplicate IDs if any exist)
  const dbItemsMapped = equipment
    .filter(eq => !mockupItems.some(m => m.id === eq.id))
    .map((eq, index) => {
      const numId = eq.id.replace(/\D/g, '') || String(index + 6);
      const barcode = `89361000000${numId.padStart(2, '0')}`;
      const stock = eq.stock || 0;
      const minStock = eq.minStock || 5;
      const holding = Math.round(stock * 0.1);
      const buying = stock < minStock ? 50 : 0;
      const available = Math.max(0, stock - holding);
      
      let status: 'Bình thường' | 'Thiếu hàng' | 'Cảnh báo' | 'Hết hàng' = 'Bình thường';
      if (stock === 0) status = 'Hết hàng';
      else if (stock <= minStock) status = 'Thiếu hàng';
      else if (stock <= minStock * 1.5) status = 'Cảnh báo';

      let group = 'Phụ kiện';
      if (eq.type === 'panel') group = 'Tấm pin Solar';
      else if (eq.type === 'inverter') group = 'Biến tần';
      else if (eq.type === 'battery') group = 'Pin lưu trữ';
      else if (eq.type === 'mounting') group = 'Ray nhôm';

      return {
        id: eq.id,
        brand: eq.brand || '',
        model: eq.model || '',
        name: `${eq.brand || ''} ${eq.model || ''}`.trim() || 'Vật tư chưa rõ tên',
        barcode,
        kho: (eq.location || '').toLowerCase().includes('phụ') ? 'Kho phụ' : 'Kho chính',
        unit: eq.unit || 'Cái',
        stock,
        holding,
        buying,
        available,
        minStock,
        maxStock: minStock * 5,
        unitPrice: eq.unitPrice,
        sellingPrice: eq.sellingPrice || eq.unitPrice * 1.3,
        status,
        group,
        location: eq.location || 'Kệ A1-A3',
        supplier: eq.supplier || 'Chưa liên kết',
        details: eq.details || '',
        type: eq.type
      };
    });

  // Local state to keep track of items deleted in the current UI session or saved to localStorage
  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('warehouse_deleted_item_ids') || '[]');
    } catch {
      return [];
    }
  });

  const allItems = [...mockupItems, ...dbItemsMapped].filter(item => !deletedIds.includes(item.id));

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [khoFilter, setKhoFilter] = useState('Tất cả kho');
  const [groupFilter, setGroupFilter] = useState('Tất cả nhóm');
  const [statusFilter, setStatusFilter] = useState('Tất cả trạng thái');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);

  // Selected item for Detail Sidebar (defaults to VT001 to mimic the image)
  const [selectedItem, setSelectedItem] = useState<any>(allItems[0]);
  const [detailTab, setDetailTab] = useState<'info' | 'history' | 'import' | 'export' | 'supplier' | 'docs'>('info');

  // Comprehensive Item Detail & History Modal state
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailModalItem, setDetailModalItem] = useState<any>(null);
  const [modalActiveTab, setModalActiveTab] = useState<'history' | 'info' | 'stats'>('history');
  const [modalHistoryFilter, setModalHistoryFilter] = useState<'all' | 'import' | 'export'>('all');
  const [modalHistorySearch, setModalHistorySearch] = useState('');
  const [showPrintStockCardModal, setShowPrintStockCardModal] = useState(false);

  // Modals & UI states
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [scannerStatus, setScannerStatus] = useState<'idle' | 'scanning' | 'success'>('idle');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const [showPrintQrModal, setShowPrintQrModal] = useState(false);
  const [selectedQrItems, setSelectedQrItems] = useState<string[]>([]);

  // Excel Import states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedImportRows, setParsedImportRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Form State for Add/Edit
  const [formId, setFormId] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formType, setFormType] = useState<'panel' | 'inverter' | 'battery' | 'mounting' | 'accessory' | 'other'>('other');
  const [formUnit, setFormUnit] = useState('Cái');
  const [formStock, setFormStock] = useState(0);
  const [formMinStock, setFormMinStock] = useState(5);
  const [formUnitPrice, setFormUnitPrice] = useState(0);
  const [formSellingPrice, setFormSellingPrice] = useState(0);
  const [formLocation, setFormLocation] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formDetails, setFormDetails] = useState('');

  // Handle barcode simulation scan
  const handleBarcodeScan = () => {
    setShowQrScanner(true);
    setScannerStatus('scanning');
    setTimeout(() => {
      setScannerStatus('success');
      setTimeout(() => {
        setShowQrScanner(false);
        // Find and select VT001
        const target = allItems.find(i => i.id === 'VT001');
        if (target) {
          setSelectedItem(target);
        }
        setScannerStatus('idle');
      }, 800);
    }, 1500);
  };

  // Unique lists for filtering dropdowns
  const availableGroups = ['Tất cả nhóm', ...Array.from(new Set(allItems.map(i => i.group)))];
  const availableKhos = ['Tất cả kho', ...Array.from(new Set(allItems.map(i => i.kho)))];
  const availableStatuses = ['Tất cả trạng thái', 'Bình thường', 'Thiếu hàng', 'Cảnh báo', 'Hết hàng'];

  // Filter items
  const filteredItems = allItems.filter(item => {
    const searchMatch = 
      (item.id || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (item.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (item.barcode || '').toLowerCase().includes((searchTerm || '').toLowerCase());
    
    const khoMatch = khoFilter === 'Tất cả kho' || item.kho === khoFilter;
    const groupMatch = groupFilter === 'Tất cả nhóm' || item.group === groupFilter;
    const statusMatch = statusFilter === 'Tất cả trạng thái' || item.status === statusFilter;

    return searchMatch && khoMatch && groupMatch && statusMatch;
  });

  // Pagination calculation
  const totalItemsCount = filteredItems.length;
  const totalPages = Math.ceil(totalItemsCount / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);

  // Dynamic stats calculated from allItems
  const totalInventoryValue = allItems.reduce((sum, item) => sum + (item.stock * (item.unitPrice || 0)), 0);
  const lowStockItemsCount = allItems.filter(item => item.stock <= item.minStock).length;
  const totalBuyingQty = allItems.reduce((sum, item) => sum + (item.buying || 0), 0);
  const totalHoldingQty = allItems.reduce((sum, item) => sum + (item.holding || 0), 0);
  const totalPhysicalStock = allItems.reduce((sum, item) => sum + item.stock, 0);

  // Warnings card list computed dynamically from allItems
  const dynamicWarningList = allItems
    .filter(item => item.status !== 'Bình thường')
    .slice(0, 5)
    .map((item, idx) => {
      let text = '';
      let type: 'error' | 'warning' | 'info' = 'info';
      if (item.status === 'Hết hàng') {
        text = `Đã hết hàng, cần đặt hàng bổ sung gấp`;
        type = 'error';
      } else if (item.status === 'Thiếu hàng') {
        text = `Tồn kho ${item.stock} ${item.unit || 'm'}, dưới mức tối thiểu (${item.minStock} ${item.unit || 'm'})`;
        type = 'error';
      } else if (item.status === 'Cảnh báo') {
        text = `Tồn kho ${item.stock} ${item.unit || 'm'} sắp xuống dưới định mức tối thiểu`;
        type = 'warning';
      }
      return {
        id: item.id || String(idx),
        name: item.name || item.model,
        text,
        time: `${10 * (idx + 1)} phút trước`,
        type
      };
    });

  const warningList = dynamicWarningList.length > 0 ? dynamicWarningList : [
    { id: 'w1', name: 'Xi măng PCB40', text: 'Tồn kho 20 bao, dưới mức tối thiểu (50 bao)', time: '5 phút trước', type: 'error' as const },
    { id: 'w2', name: 'Keo PU', text: 'Tồn kho sắp xuống dưới mức tối thiểu', time: '15 phút trước', type: 'warning' as const },
    { id: 'w3', name: 'Sơn chống thấm KOVA', text: 'Đã hết hàng, đang chờ nhập 50 kg', time: '30 phút trước', type: 'info' as const }
  ];

  // High-value items list computed dynamically from allItems
  const dynamicTopValueList = allItems
    .map(item => ({
      name: item.name || item.model,
      value: item.stock * (item.unitPrice || 0)
    }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((item, idx) => ({
      rank: idx + 1,
      name: item.name,
      value: item.value
    }));

  const topValueList = dynamicTopValueList.length > 0 ? dynamicTopValueList : [
    { rank: 1, name: 'Thép Hòa Phát D10', value: 850000000 },
    { rank: 2, name: 'Xi măng PCB40', value: 760000000 },
    { rank: 3, name: 'Ống HDPE D110', value: 540000000 },
    { rank: 4, name: 'Cát vàng', value: 480000000 },
    { rank: 5, name: 'Đá 1x2', value: 320000000 }
  ];

  // Recharts Donut data (Total Inventory by Warehouse) computed dynamically from allItems
  const warehouseGroups: { [key: string]: number } = {};
  allItems.forEach(item => {
    const warehouseName = item.kho || 'Kho chính';
    warehouseGroups[warehouseName] = (warehouseGroups[warehouseName] || 0) + item.stock;
  });

  const colors = ['#0054a6', '#10b981', '#3b82f6', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6'];
  const dynamicDonutData = Object.keys(warehouseGroups).map((name, index) => ({
    name,
    value: warehouseGroups[name],
    color: colors[index % colors.length]
  })).sort((a, b) => b.value - a.value);

  const donutData = dynamicDonutData.length > 0 ? dynamicDonutData : [
    { name: 'Kho chính', value: 1456, color: '#0054a6' },
    { name: 'Kho phụ', value: 456, color: '#10b981' },
    { name: 'Kho công trình 1', value: 156, color: '#3b82f6' },
    { name: 'Kho công trình 2', value: 89, color: '#f59e0b' },
    { name: 'Khác', value: 28, color: '#6366f1' }
  ];

  // Helper currency formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Excel handlers
  const handleExportToExcel = () => {
    const dataToExport = filteredItems.map(item => ({
      'Mã vật tư': item.id,
      'Tên vật tư': item.name,
      'Barcode': item.barcode,
      'Kho': item.kho,
      'ĐVT': item.unit,
      'Tồn thực tế': item.stock,
      'Đang giữ': item.holding,
      'Đang mua': item.buying,
      'Tồn khả dụng': item.available,
      'Định mức tối thiểu': item.minStock,
      'Định mức tối đa': item.maxStock,
      'Giá nhập': item.unitPrice,
      'Giá bán lẻ': item.sellingPrice,
      'Vị trí': item.location,
      'Nhà cung cấp': item.supplier,
      'Trạng thái': item.status
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kho Vật Tư");
    XLSX.writeFile(wb, `Báo_cáo_tồn_kho_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const sampleData = [
      {
        'Mã vật tư': 'VT101',
        'Thương hiệu': 'Longi',
        'Model': 'Tấm pin LR5-72HPH 550W',
        'ĐVT': 'Tấm',
        'Tồn thực tế': 150,
        'Định mức tối thiểu': 10,
        'Giá nhập': 2850000,
        'Giá bán lẻ': 3400000,
        'Vị trí': 'Kệ A1',
        'Nhà cung cấp': 'Longi Solar Group',
        'Mô tả': 'Tấm pin mặt trời mono đơn tinh thể hiệu suất cao'
      },
      {
        'Mã vật tư': 'VT102',
        'Thương hiệu': 'Growatt',
        'Model': 'Inverter MIN 5000TL-X',
        'ĐVT': 'Bộ',
        'Tồn thực tế': 45,
        'Định mức tối thiểu': 5,
        'Giá nhập': 14200000,
        'Giá bán lẻ': 16500000,
        'Vị trí': 'Kệ B2',
        'Nhà cung cấp': 'Growatt Việt Nam',
        'Mô tả': 'Inverter hòa lưới 1 pha 5kW chất lượng cao'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mau_Khai_Bao");

    // Auto-fit columns
    const maxLens = Object.keys(sampleData[0]).map(key => {
      return Math.max(key.length, ...sampleData.map(row => String(row[key as keyof typeof row] || '').length)) + 3;
    });
    ws['!cols'] = maxLens.map(len => ({ wch: len }));

    XLSX.writeFile(wb, "Mau_Danh_Muc_Vat_Tu.xlsx");
  };

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setImportFile(null);
      setParsedImportRows([]);
      return;
    }
    setImportFile(file);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        // Map data to preview layout
        const mapped = data.map((row, idx) => ({
          index: idx + 1,
          id: row['Mã vật tư'] || 'VT' + Math.floor(100 + Math.random() * 900),
          brand: String(row['Thương hiệu'] || row['Tên vật tư']?.split(' ')[0] || 'Chưa rõ'),
          model: String(row['Model'] || row['Tên vật tư'] || 'Chưa rõ'),
          unit: String(row['ĐVT'] || 'Cái'),
          stock: Number(row['Tồn thực tế'] || row['Tồn kho'] || 0),
          minStock: Number(row['Định mức tối thiểu'] || row['Tồn tối thiểu'] || 5),
          unitPrice: Number(row['Giá nhập'] || 0),
          sellingPrice: Number(row['Giá bán lẻ'] || 0),
          location: String(row['Vị trí'] || row['Vị trí kho'] || 'Kệ A1'),
          supplier: String(row['Nhà cung cấp'] || 'Chưa liên kết'),
          details: String(row['Mô tả'] || '')
        }));
        
        setParsedImportRows(mapped);
      } catch (err) {
        alert('Lỗi đọc và phân tích tệp Excel. Vui lòng kiểm tra lại cấu trúc file mẫu.');
        setImportFile(null);
        setParsedImportRows([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirmImport = async () => {
    if (parsedImportRows.length === 0) {
      alert('Chưa có dữ liệu nào để nhập!');
      return;
    }
    
    setImporting(true);
    try {
      let importedCount = 0;
      for (const row of parsedImportRows) {
        const payload: Equipment = {
          id: row.id,
          brand: row.brand,
          model: row.model,
          type: 'other',
          capacity: 0,
          unit: row.unit,
          stock: row.stock,
          minStock: row.minStock,
          unitPrice: row.unitPrice,
          sellingPrice: row.sellingPrice,
          location: row.location,
          supplier: row.supplier,
          details: row.details
        };
        await setDoc(doc(db, 'equipment', row.id), payload);
        
        // If this item was previously hidden/deleted, restore it
        if (deletedIds.includes(row.id)) {
          const updatedDeletedIds = deletedIds.filter(id => id !== row.id);
          setDeletedIds(updatedDeletedIds);
          localStorage.setItem('warehouse_deleted_item_ids', JSON.stringify(updatedDeletedIds));
        }
        
        importedCount++;
      }
      
      alert(`Đã nhập thành công ${importedCount} vật tư vào kho!`);
      // Reset and close
      setShowImportModal(false);
      setImportFile(null);
      setParsedImportRows([]);
    } catch (err) {
      console.error("Lỗi khi nhập dữ liệu:", err);
      alert('Có lỗi xảy ra khi lưu dữ liệu. Vui lòng thử lại.');
    } finally {
      setImporting(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      if (fileExt === 'xlsx' || fileExt === 'xls') {
        handleFileChange(file);
      } else {
        alert('Hệ thống chỉ hỗ trợ tệp định dạng Excel (.xlsx, .xls)!');
      }
    }
  };

  // Form open handlers
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormId('VT' + Math.floor(100 + Math.random() * 900));
    setFormBrand('');
    setFormModel('');
    setFormType('other');
    setFormUnit('Cái');
    setFormStock(0);
    setFormMinStock(5);
    setFormUnitPrice(0);
    setFormSellingPrice(0);
    setFormLocation('');
    setFormSupplier('');
    setFormDetails('');
    setShowAddModal(true);
  };

  const handleOpenEditModal = (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const foundDb = equipment.find(eq => eq.id === item.id);
    setEditingItem(foundDb || null);
    setFormId(item.id);
    setFormBrand(item.brand || '');
    setFormModel(item.model || '');
    setFormType(item.type || 'other');
    setFormUnit(item.unit || 'Cái');
    setFormStock(item.stock || 0);
    setFormMinStock(item.minStock || 5);
    setFormUnitPrice(item.unitPrice || 0);
    setFormSellingPrice(item.sellingPrice || 0);
    setFormLocation(item.location || '');
    setFormSupplier(item.supplier || '');
    setFormDetails(item.details || '');
    setShowAddModal(true);
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBrand || !formModel) {
      alert('Vui lòng nhập Thương hiệu và Model.');
      return;
    }
    try {
      const payload: Equipment = {
        id: formId,
        brand: formBrand.trim(),
        model: formModel.trim(),
        type: formType,
        capacity: 0,
        unit: formUnit.trim(),
        stock: Number(formStock),
        minStock: Number(formMinStock),
        unitPrice: Number(formUnitPrice),
        sellingPrice: Number(formSellingPrice),
        location: formLocation.trim(),
        supplier: formSupplier.trim(),
        details: formDetails.trim()
      };
      await setDoc(doc(db, 'equipment', formId), payload);
      
      // If this item was previously hidden/deleted, restore it
      if (deletedIds.includes(formId)) {
        const updatedDeletedIds = deletedIds.filter(id => id !== formId);
        setDeletedIds(updatedDeletedIds);
        localStorage.setItem('warehouse_deleted_item_ids', JSON.stringify(updatedDeletedIds));
      }

      setShowAddModal(false);
      
      // Update selected item dynamically if we edited it
      if (selectedItem?.id === formId) {
        setSelectedItem({
          ...selectedItem,
          ...payload,
          name: `${formBrand.trim()} ${formModel.trim()}`
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'equipment');
    }
  };

  const handleDeleteEquipment = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const targetItem = allItems.find(i => i.id === id);
    const itemName = targetItem ? `${targetItem.id} - ${targetItem.model}` : id;

    if (!confirm(`Bạn có chắc chắn muốn xóa vật tư "${itemName}" khỏi hệ thống?`)) {
      return;
    }

    try {
      // 1. Check if it's a real database item
      const isDbItem = equipment.some(eq => eq.id === id);
      
      if (isDbItem) {
        if (userRole !== 'admin') {
          alert(`Tài khoản của bạn không có quyền Admin (quyền hiện tại: "${userRole}"). Để thuận tiện cho việc kiểm thử, hệ thống sẽ ẩn tạm thời mặt hàng này khỏi giao diện của bạn.`);
        } else {
          await deleteDoc(doc(db, 'equipment', id));
        }
      }

      // 2. Add to local deleted IDs list to instantly update UI (works for both mockup and DB items)
      const newDeletedIds = [...deletedIds, id];
      setDeletedIds(newDeletedIds);
      localStorage.setItem('warehouse_deleted_item_ids', JSON.stringify(newDeletedIds));

      // 3. Update active selection if the deleted item was selected
      if (selectedItem?.id === id) {
        const remainingItems = allItems.filter(i => i.id !== id);
        setSelectedItem(remainingItems[0] || null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'equipment');
    }
  };

  // Generate Recharts Area chart data based on active item
  const getChartData = (targetItem = selectedItem) => {
    const base = targetItem?.stock || 100;
    return [
      { name: '01/02', 'Tồn kho': Math.max(0, Math.round(base * 0.85)) },
      { name: '01/03', 'Tồn kho': Math.max(0, Math.round(base * 1.1)) },
      { name: '01/04', 'Tồn kho': Math.max(0, Math.round(base * 0.9)) },
      { name: '01/05', 'Tồn kho': Math.max(0, Math.round(base * 0.95)) },
      { name: '01/06', 'Tồn kho': Math.max(0, Math.round(base * 1.2)) },
      { name: '01/07', 'Tồn kho': base }
    ];
  };

  // Comprehensive helper to filter and map all import/export transaction history for any item
  const getItemTransactions = (item: any) => {
    if (!item) return [];
    
    // Filter real transactions matching by item ID or Model/Name
    const realHistory = transactions
      .filter(tx => tx.items?.some(i => 
        i.equipmentId === item.id || 
        (i.model && item.model && i.model.trim().toLowerCase() === item.model.trim().toLowerCase()) ||
        (item.name && i.model && `${i.brand || ''} ${i.model || ''}`.trim().toLowerCase() === item.name.trim().toLowerCase())
      ))
      .map(tx => {
        const match = tx.items.find(i => 
          i.equipmentId === item.id || 
          (i.model && item.model && i.model.trim().toLowerCase() === item.model.trim().toLowerCase()) ||
          (item.name && i.model && `${i.brand || ''} ${i.model || ''}`.trim().toLowerCase() === item.name.trim().toLowerCase())
        );
        const isImport = tx.type === 'import';
        let subType = isImport ? 'Nhập kho mua hàng' : 'Xuất kho giao hàng';
        if (isImport) {
          if (tx.id.startsWith('PN-TH') || tx.note?.toLowerCase().includes('trả')) subType = 'Nhập trả hàng';
          else subType = 'Nhập kho từ NCC';
        } else {
          if (tx.id.startsWith('PX-TM')) subType = 'Xuất bán thương mại';
          else if (tx.id.startsWith('PX-TC')) subType = 'Xuất thi công dự án';
          else if (tx.id.startsWith('PX-CK')) subType = 'Xuất điều chuyển kho';
          else subType = 'Xuất kho giao khách';
        }

        return {
          id: tx.id,
          type: tx.type === 'import' ? 'Nhập kho' : 'Xuất kho',
          subType,
          isImport,
          partner: tx.partnerName || (isImport ? 'Nhà cung cấp đối tác' : 'Khách hàng / Dự án'),
          partnerId: tx.partnerId,
          qty: match?.quantity || 0,
          unitPrice: match?.unitPrice || (isImport ? item.unitPrice : item.sellingPrice) || 0,
          totalPrice: (match?.quantity || 0) * (match?.unitPrice || (isImport ? item.unitPrice : item.sellingPrice) || 0),
          unit: match?.unit || item.unit || 'Cái',
          date: tx.date || new Date().toISOString().split('T')[0],
          user: tx.createdByName || 'Thủ kho Solar',
          note: tx.note || 'Phiếu nhập xuất đã phê duyệt'
        };
      });

    // Provide rich initial logs if real history from Firestore is empty for mockup items
    if (realHistory.length === 0) {
      return [
        { 
          id: 'PN000235', 
          type: 'Nhập kho', 
          subType: 'Nhập kho từ NCC',
          isImport: true, 
          partner: item.supplier || 'Công ty TNHH Thiết Bị Solar Việt Nam', 
          qty: Math.max(50, Math.round(item.stock * 0.6) || 50), 
          unitPrice: item.unitPrice || 4500000, 
          totalPrice: (Math.max(50, Math.round(item.stock * 0.6) || 50)) * (item.unitPrice || 4500000),
          unit: item.unit || 'Cái', 
          date: '2026-08-10', 
          user: 'Trần Thị Thu (Thủ kho)', 
          note: 'Nhập kho định kỳ theo HĐ cung cấp số 45/2026' 
        },
        { 
          id: 'PX000124', 
          type: 'Xuất kho', 
          subType: 'Xuất thi công dự án',
          isImport: false, 
          partner: 'Dự án Điện MT Áp Mái 50kWp - KCN Sóng Thần', 
          qty: Math.max(10, Math.round(item.stock * 0.2) || 15), 
          unitPrice: item.sellingPrice || (item.unitPrice ? item.unitPrice * 1.25 : 5500000), 
          totalPrice: (Math.max(10, Math.round(item.stock * 0.2) || 15)) * (item.sellingPrice || (item.unitPrice ? item.unitPrice * 1.25 : 5500000)),
          unit: item.unit || 'Cái', 
          date: '2026-08-14', 
          user: 'Lê Văn Tám (Kỹ thuật trưởng)', 
          note: 'Bàn giao vật tư cho đội thi công đợt 1' 
        },
        { 
          id: 'PN000212', 
          type: 'Nhập kho', 
          subType: 'Nhập kho từ NCC',
          isImport: true, 
          partner: item.supplier || 'Tổng kho Phân Phối Thiết Bị Solar', 
          qty: Math.max(80, Math.round(item.stock * 0.8) || 100), 
          unitPrice: item.unitPrice || 4500000, 
          totalPrice: (Math.max(80, Math.round(item.stock * 0.8) || 100)) * (item.unitPrice || 4500000),
          unit: item.unit || 'Cái', 
          date: '2026-07-28', 
          user: 'Trần Thị Thu (Thủ kho)', 
          note: 'Nhập lô hàng bổ sung chuẩn bị triển khai các dự án mới' 
        },
        { 
          id: 'PX000118', 
          type: 'Xuất kho', 
          subType: 'Xuất bán thương mại',
          isImport: false, 
          partner: 'Công ty Cổ phần Năng Lượng Xanh Miền Nam', 
          qty: Math.max(5, Math.round(item.stock * 0.1) || 10), 
          unitPrice: item.sellingPrice || (item.unitPrice ? item.unitPrice * 1.25 : 5500000), 
          totalPrice: (Math.max(5, Math.round(item.stock * 0.1) || 10)) * (item.sellingPrice || (item.unitPrice ? item.unitPrice * 1.25 : 5500000)),
          unit: item.unit || 'Cái', 
          date: '2026-07-15', 
          user: 'Nguyễn Văn Hùng (Kinh doanh)', 
          note: 'Xuất bán thương mại kèm biên bản bàn giao' 
        }
      ];
    }
    return realHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  // Helper to filter and map recent transaction history for selected item (used by side panel)
  const getSelectedHistory = () => {
    return getItemTransactions(selectedItem);
  };

  // Open the comprehensive item detail & import-export history modal
  const handleOpenDetailModal = (item: any, initialTab: 'history' | 'info' | 'stats' = 'history', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedItem(item);
    setDetailModalItem(item);
    setModalActiveTab(initialTab);
    setModalHistoryFilter('all');
    setModalHistorySearch('');
    setShowDetailModal(true);
  };

  // Export item transaction history to Excel
  const handleExportItemHistoryToExcel = (item: any) => {
    if (!item) return;
    const historyList = getItemTransactions(item);
    const data = historyList.map((h, idx) => ({
      'STT': idx + 1,
      'Mã chứng từ': h.id,
      'Ngày thực hiện': h.date,
      'Loại phiếu': h.type,
      'Phân loại': h.subType,
      'Đối tác (Khách hàng/NCC/Dự án)': h.partner,
      'Số lượng': h.qty,
      'Đơn vị tính': h.unit,
      'Đơn giá (VND)': h.unitPrice,
      'Thành tiền (VND)': h.totalPrice,
      'Người thực hiện': h.user,
      'Ghi chú': h.note
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LichSuNhapXuat');
    XLSX.writeFile(wb, `LichSuNhapXuat_${item.id}_${item.model?.replace(/[/\\?%*:|"<>]/g, '-')}.xlsx`);
  };

  return (
    <div className="space-y-6 font-sans antialiased" id="warehouse-root-container">
      
      {/* 1. Header Row */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">KHO</h1>
          <p className="text-slate-400 text-xs font-semibold mt-0.5">Quản lý tồn kho vật tư thiết bị</p>
        </div>

        {/* Filters and search inline header */}
        <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
          
          {/* Search bar */}
          <div className="relative min-w-[200px] flex-1 md:flex-none">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm vật tư, mã, barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl focus:outline-none focus:border-blue-500 font-bold text-[11px] text-slate-700 placeholder:text-slate-400 transition-all shadow-2xs"
            />
          </div>

          {/* Kho Dropdown */}
          <div className="relative">
            <select
              value={khoFilter}
              onChange={(e) => setKhoFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200/80 text-slate-700 px-4 py-2 pr-9 rounded-2xl font-black text-[11px] hover:bg-slate-100 cursor-pointer transition-all shadow-2xs"
            >
              <option value="Tất cả kho">Tất cả kho</option>
              {availableKhos.filter(k => k !== 'Tất cả kho').map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Nhóm vật tư Dropdown */}
          <div className="relative">
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200/80 text-slate-700 px-4 py-2 pr-9 rounded-2xl font-black text-[11px] hover:bg-slate-100 cursor-pointer transition-all shadow-2xs"
            >
              <option value="Tất cả nhóm">Tất cả nhóm</option>
              {availableGroups.filter(g => g !== 'Tất cả nhóm').map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Trạng thái Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200/80 text-slate-700 px-4 py-2 pr-9 rounded-2xl font-black text-[11px] hover:bg-slate-100 cursor-pointer transition-all shadow-2xs"
            >
              {availableStatuses.map(s => (
                <option key={s} value={s}>{s === 'Tất cả trạng thái' ? 'Tất cả trạng thái' : `Trạng thái: ${s}`}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Thêm vật tư button */}
          <button 
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 bg-[#0054a6] hover:bg-blue-700 text-white rounded-2xl px-4 py-2 font-black text-[11px] uppercase tracking-wide transition-all shadow-md shadow-blue-500/10 cursor-pointer active:scale-95"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm vật tư
          </button>

          {/* Extra utility panel toggler */}
          <div className="relative group">
            <button 
              onClick={() => setShowFabMenu(!showFabMenu)}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all shadow-2xs cursor-pointer"
              title="Tính năng bổ sung"
            >
              <MoreVertical className="h-4 w-4 text-slate-500" />
            </button>
            
            {showFabMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl z-30 py-2 divide-y divide-slate-50 animate-fade-in font-bold text-xs">
                <button 
                  onClick={() => { handleExportToExcel(); setShowFabMenu(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-slate-400" />
                  Xuất báo cáo Excel
                </button>
                <button 
                  onClick={() => { setShowImportModal(true); setShowFabMenu(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 text-slate-700 flex items-center gap-2 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5 text-slate-400" />
                  Nhập danh mục Excel
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 2. KPI Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* Card 1: Tổng số vật tư */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4 hover:border-blue-100 transition-all">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Tổng số vật tư</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-slate-800 leading-none">{allItems.length}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Mã hàng</span>
            </div>
          </div>
        </div>

        {/* Card 2: Giá trị tồn kho */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4 hover:border-emerald-100 transition-all col-span-1">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Giá trị tồn kho</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg font-black text-emerald-600 leading-none">{totalInventoryValue.toLocaleString('vi-VN')}</span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">VND</span>
            </div>
          </div>
        </div>

        {/* Card 3: Vật tư sắp hết */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4 hover:border-amber-100 transition-all">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shrink-0 animate-pulse">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Vật tư sắp hết</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-amber-600 leading-none">{lowStockItemsCount}</span>
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-tight">Dưới tối thiểu</span>
            </div>
          </div>
        </div>

        {/* Card 4: Đang mua */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4 hover:border-purple-100 transition-all">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Đang mua</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-purple-700 leading-none">{totalBuyingQty.toLocaleString('vi-VN')}</span>
              <span className="text-[9px] font-black text-purple-400 uppercase tracking-tight">Số lượng</span>
            </div>
          </div>
        </div>

        {/* Card 5: Chờ xuất */}
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-xs flex items-center gap-4 hover:border-cyan-100 transition-all">
          <div className="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Chờ xuất</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl font-black text-cyan-600 leading-none">{totalHoldingQty.toLocaleString('vi-VN')}</span>
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-tight">Đã giữ</span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Two Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Table & Cards Block */}
        <div className={`${selectedItem ? 'lg:col-span-8 xl:col-span-9' : 'lg:col-span-12'} space-y-6 transition-all`}>
          
          {/* Main List Box */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xs overflow-hidden">
            
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">Danh sách tồn kho</h2>
              <span className="text-[10px] font-bold text-slate-400">Tự động đồng bộ với hệ thống</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Mã vật tư</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Tên vật tư</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">Kho</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400">ĐVT</th>
                    
                    {/* Quantity headers row section header span layout */}
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center border-x border-slate-100/80 bg-slate-100/10" colSpan={4}>
                      <span className="block border-b border-slate-100 pb-1 mb-1 text-[9px]">SỐ LƯỢNG</span>
                      <div className="grid grid-cols-4 gap-2 text-center text-[8px] font-bold">
                        <span>Tồn thực tế</span>
                        <span>Đang giữ</span>
                        <span>Đang mua</span>
                        <span className="text-blue-600">Khả dụng</span>
                      </div>
                    </th>

                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Min - Max</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Giá nhập gần nhất</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Trạng thái</th>
                    <th className="px-5 py-4 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="text-center py-20 text-slate-400 italic text-xs font-semibold">
                        Không tìm thấy vật tư nào khớp với điều kiện lọc.
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((item) => {
                      const isSelected = selectedItem?.id === item.id;
                      return (
                        <tr 
                          key={item.id} 
                          onClick={() => setSelectedItem(item)}
                          className={`hover:bg-slate-50/50 transition-all cursor-pointer ${isSelected ? 'bg-blue-50/30' : ''}`}
                        >
                          {/* Mã vật tư */}
                          <td className="px-5 py-3.5 font-mono text-[11px] font-black text-slate-900">
                            {item.id}
                          </td>

                          {/* Tên vật tư + Barcode */}
                          <td className="px-5 py-3.5">
                            <div>
                              <button
                                type="button"
                                onClick={(e) => handleOpenDetailModal(item, 'history', e)}
                                className="text-left font-black text-xs text-slate-800 hover:text-blue-600 hover:underline transition-colors flex items-center gap-1.5 group cursor-pointer"
                                title="Nhấn vào tên để xem chi tiết và lịch sử nhập xuất của hàng hoá"
                              >
                                <span className="group-hover:text-blue-600">{item.model}</span>
                                <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-blue-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </button>
                              <div className="flex items-center gap-1.5 text-slate-400 font-medium text-[9px] mt-0.5">
                                <span className="tracking-tighter font-mono">||||| {item.barcode}</span>
                                <span className="text-slate-300">•</span>
                                <span>{item.brand}</span>
                              </div>
                            </div>
                          </td>

                          {/* Kho */}
                          <td className="px-5 py-3.5 text-xs font-semibold text-slate-600">
                            {item.kho}
                          </td>

                          {/* ĐVT */}
                          <td className="px-5 py-3.5 text-xs font-bold text-slate-500">
                            {item.unit}
                          </td>

                          {/* SỐ LƯỢNG details (4 grid sub-elements) */}
                          <td className="px-4 py-3.5 border-l border-slate-100/80 bg-slate-100/5" colSpan={4}>
                            <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
                              {/* Tồn thực tế */}
                              <span className={item.stock > item.minStock ? 'text-emerald-600' : 'text-rose-500'}>
                                {item.stock}
                              </span>
                              {/* Đang giữ */}
                              <span className="text-amber-600">
                                {item.holding}
                              </span>
                              {/* Đang mua */}
                              <span className="text-blue-500">
                                {item.buying}
                              </span>
                              {/* Tồn khả dụng */}
                              <span className="text-emerald-500 font-extrabold bg-emerald-50/30 px-1 py-0.5 rounded border border-emerald-100/20">
                                {item.available}
                              </span>
                            </div>
                          </td>

                          {/* Min - Max */}
                          <td className="px-5 py-3.5 text-center text-xs font-semibold text-slate-500 border-l border-slate-100/80">
                            {item.minStock} - {item.maxStock}
                          </td>

                          {/* Giá nhập gần nhất */}
                          <td className="px-5 py-3.5 text-right font-extrabold text-xs text-slate-700">
                            {formatCurrency(item.unitPrice)}
                          </td>

                          {/* Trạng thái */}
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                              item.status === 'Bình thường' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                              item.status === 'Thiếu hàng' ? 'bg-rose-50 border-rose-100 text-rose-500' :
                              item.status === 'Cảnh báo' ? 'bg-amber-50 border-amber-100 text-amber-500' :
                              'bg-slate-100 border-slate-200 text-slate-400'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                item.status === 'Bình thường' ? 'bg-emerald-500 animate-pulse' :
                                item.status === 'Thiếu hàng' ? 'bg-rose-500' :
                                item.status === 'Cảnh báo' ? 'bg-amber-500' :
                                'bg-slate-400'
                              }`} />
                              {item.status}
                            </span>
                          </td>

                          {/* Thao tác */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={(e) => handleOpenDetailModal(item, 'history', e)}
                                className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all cursor-pointer"
                                title="Xem chi tiết & lịch sử nhập xuất"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                              <button 
                                onClick={(e) => handleOpenEditModal(item, e)}
                                className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-all cursor-pointer"
                                title="Sửa thông số"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                              <button 
                                onClick={(e) => handleDeleteEquipment(item.id, e)}
                                className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-all cursor-pointer"
                                title="Xóa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination block */}
            <div className="px-6 py-4.5 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 font-bold text-xs">
              <span className="text-slate-400 font-semibold">
                Hiển thị {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, totalItemsCount)} của {totalItemsCount} vật tư
              </span>
              
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[10px]"
                >
                  Trước
                </button>
                
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(idx + 1)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer ${
                      currentPage === idx + 1 
                        ? 'bg-[#0054a6] text-white' 
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {idx + 1}
                  </button>
                ))}

                <button
                  disabled={currentPage === totalPages || totalPages === 0}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-[10px]"
                >
                  Sau
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">Hiển thị</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-white border border-slate-200 px-2 py-1 rounded-lg text-[11px]"
                >
                  <option value={5}>5 / trang</option>
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                </select>
              </div>
            </div>

          </div>

          {/* Bottom Card Row (Warnings, Donut, Top High-Value) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Box 1: CẢNH BÁO */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-500 block">Cảnh báo</span>
                <div className="mt-4 space-y-4">
                  {warningList.map(item => (
                    <div key={item.id} className="flex gap-3 text-xs leading-normal">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                        item.type === 'error' ? 'bg-rose-500 animate-ping' :
                        item.type === 'warning' ? 'bg-amber-500' : 'bg-slate-400'
                      }`} />
                      <div className="flex-1">
                        <p className="font-extrabold text-slate-800">{item.name}</p>
                        <p className="text-slate-400 text-[10px] font-semibold mt-0.5">{item.text}</p>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400 shrink-0">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button className="mt-6 w-full text-center text-xs font-black text-blue-600 hover:text-blue-700 inline-flex items-center justify-center gap-1.5 pt-3 border-t border-slate-50 cursor-pointer">
                Xem tất cả cảnh báo 
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* Box 2: TỒN KHO THEO KHO Donut */}
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-xs flex flex-col justify-between items-center text-center">
              <div className="w-full">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block text-left">Tồn kho theo kho</span>
                
                {/* Donut Chart Wrapper */}
                <div className="relative h-[160px] w-full mt-3 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value} vật tư`} />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Center Content of Donut */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Tổng tồn</span>
                    <span className="text-xl font-black text-slate-800 leading-tight mt-0.5">
                      {totalPhysicalStock.toLocaleString('vi-VN')}
                    </span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Vật tư</span>
                  </div>
                </div>
              </div>

              {/* Legends */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full text-[9px] font-black text-slate-500 uppercase tracking-tight text-left mt-1 border-t border-slate-50 pt-3">
                {donutData.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="truncate">{d.name}</span>
                    <span className="ml-auto text-slate-800">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Box 3: TOP VẬT TƯ GIÁ TRỊ CAO */}
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Top vật tư giá trị cao</span>
                <div className="mt-4 space-y-3.5">
                  {topValueList.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-blue-600 text-sm w-4">{item.rank}</span>
                        <span className="font-extrabold text-slate-700">{item.name}</span>
                      </div>
                      <span className="font-extrabold text-slate-900">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button className="mt-6 w-full text-center text-xs font-black text-blue-600 hover:text-blue-700 inline-flex items-center justify-center gap-1.5 pt-3 border-t border-slate-50 cursor-pointer">
                Xem tất cả 
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

          </div>

        </div>

        {/* Right Side: CHI TIẾT VẬT TƯ (Active selected item detail card) */}
        {selectedItem && (
          <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl p-6 sticky top-6 z-10 space-y-5 animate-fade-in">
            
            {/* Detail Panel Title */}
            <div className="flex items-center justify-between border-b border-slate-50 pb-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chi tiết vật tư</h3>
              <button 
                onClick={() => setSelectedItem(null)}
                className="p-1.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-100 rounded-full transition-all cursor-pointer"
                title="Đóng bảng"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Card Header Product Profile */}
            <div className="flex gap-4 items-center">
              <div className="w-14 h-14 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center text-2xl shrink-0 p-1 font-black text-slate-400">
                {selectedItem.type === 'panel' ? '☀️' : selectedItem.type === 'inverter' ? '⚡' : selectedItem.type === 'battery' ? '🔋' : '📦'}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">{selectedItem.id}</span>
                <p className="text-sm font-black text-slate-800 leading-tight truncate">{selectedItem.model}</p>
                <span className="inline-block mt-1 text-[9px] font-black uppercase tracking-widest bg-emerald-50 border border-emerald-100 text-emerald-600 px-2 py-0.5 rounded-md">
                  ● {selectedItem.status}
                </span>
              </div>
            </div>

            {/* Sidebar Tabs Selector */}
            <div className="flex border-b border-slate-100 overflow-x-auto scrollbar-none gap-3 font-bold text-[10px] uppercase tracking-wider pb-1 shrink-0">
              {[
                { id: 'info', label: 'Thông tin' },
                { id: 'history', label: 'Lịch sử' },
                { id: 'supplier', label: 'Nhà CC' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDetailTab(tab.id as any)}
                  className={`pb-2 transition-all relative cursor-pointer ${
                    detailTab === tab.id 
                      ? 'text-blue-600 font-black' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab.label}
                  {detailTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab content rendering block */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {detailTab === 'info' && (
                <div className="space-y-4 text-xs font-semibold text-slate-500">
                  
                  {/* General Specifications Table */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/60 grid grid-cols-2 gap-y-3 text-[11px]">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Nhóm vật tư</span>
                      <span className="text-slate-800 font-black">{selectedItem.group}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Tồn thực tế</span>
                      <span className="text-emerald-600 font-extrabold">{selectedItem.stock} {selectedItem.unit}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Đơn vị tính</span>
                      <span className="text-slate-800 font-extrabold">{selectedItem.unit}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Đang giữ</span>
                      <span className="text-amber-600 font-extrabold">{selectedItem.holding} {selectedItem.unit}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Kho mặc định</span>
                      <span className="text-slate-800 font-black">{selectedItem.kho}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Đang mua</span>
                      <span className="text-blue-600 font-extrabold">{selectedItem.buying} {selectedItem.unit}</span>
                    </div>
                    <div className="col-span-2 border-t border-slate-200/50 pt-2 mt-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-0.5">Quy cách kỹ thuật</span>
                      <span className="text-slate-700 font-extrabold block leading-normal">{selectedItem.details || 'Chưa cập nhật thông số'}</span>
                    </div>
                  </div>

                  {/* Highlights light-green box for Tồn Khả Dụng */}
                  <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-100/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Tồn khả dụng</span>
                      <p className="text-[10px] text-emerald-700 font-medium leading-none mt-1">Sẵn sàng để bàn giao thi công</p>
                    </div>
                    <span className="text-2xl font-black text-emerald-600">
                      {selectedItem.available} <span className="text-sm font-bold">{selectedItem.unit}</span>
                    </span>
                  </div>

                  {/* Additional parameters list block */}
                  <div className="grid grid-cols-2 gap-3 text-[11px] font-bold">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5">Mức tối thiểu</span>
                      <span className="text-rose-500 font-extrabold">{selectedItem.minStock} {selectedItem.unit}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5">Mức tối đa</span>
                      <span className="text-slate-700 font-extrabold">{selectedItem.maxStock} {selectedItem.unit}</span>
                    </div>
                    <div className="col-span-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex justify-between items-center">
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5">Ước tính giá trị tồn</span>
                        <span className="text-xs font-black text-slate-800">{formatCurrency(selectedItem.stock * selectedItem.unitPrice)}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest block mb-0.5 text-right">Vị trí kệ</span>
                        <span className="text-xs font-black text-slate-700 block text-right">{selectedItem.location}</span>
                      </div>
                    </div>
                  </div>

                  {/* Biến động 6 tháng Area chart rendering */}
                  <div className="border-t border-slate-100 pt-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Biểu đồ biến động tồn kho (6 tháng)</h4>
                    <div className="h-[120px] w-full text-[9px] font-bold">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={getChartData()} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0054a6" stopOpacity={0.25}/>
                              <stop offset="95%" stopColor="#0054a6" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                          <Tooltip />
                          <Area type="monotone" dataKey="Tồn kho" stroke="#0054a6" strokeWidth={2} fillOpacity={1} fill="url(#colorStock)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              )}

              {/* Lịch sử tab */}
              {detailTab === 'history' && (
                <div className="space-y-3 text-xs">
                  {getSelectedHistory().map((log, idx) => (
                    <div key={idx} className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-slate-100/50 transition-all">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          log.isImport ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-500'
                        }`}>
                          {log.isImport ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-800">{log.type}</span>
                            <span className="text-[9px] font-mono font-bold text-slate-400">#{log.id}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[140px]">{log.partner}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-black block ${log.isImport ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {log.isImport ? '+' : '-'}{log.qty}
                        </span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">{log.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Nhà CC tab */}
              {detailTab === 'supplier' && (
                <div className="space-y-3.5 text-xs">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Tên nhà cung cấp</span>
                    <span className="font-black text-slate-800 text-sm">{selectedItem.supplier || 'Chưa liên kết'}</span>
                    
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mt-4 mb-1">Sản phẩm phân phối</span>
                    <span className="font-bold text-slate-600">{selectedItem.group} - {selectedItem.brand}</span>
                    
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mt-4 mb-1">Mã hóa đơn nhập gốc</span>
                    <span className="font-mono font-black text-slate-800">PN000235</span>
                  </div>
                  <button className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 py-2.5 rounded-xl font-bold transition-all text-center cursor-pointer">
                    Xem thông tin liên hệ Nhà CC
                  </button>
                </div>
              )}
            </div>

          </div>
        )}

      </div>



      {/* QR Barcode simulated active scanner modal */}
      {showQrScanner && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-slate-950 w-full max-w-sm rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl p-6 relative flex flex-col items-center">
            <button 
              onClick={() => setShowQrScanner(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block text-center mb-1">Hệ thống quét mã</span>
            <h3 className="text-sm font-black text-white text-center">QUÉT BARCODE SẢN PHẨM</h3>
            
            {/* Visual scanner target frame area with red flash laser */}
            <div className="relative w-56 h-56 border-2 border-dashed border-blue-500/40 rounded-3xl overflow-hidden my-6 bg-slate-900/60 flex items-center justify-center">
              {scannerStatus === 'scanning' && (
                <>
                  <div className="w-full h-0.5 bg-red-500 shadow-md shadow-red-500 absolute top-0 animate-scanner-laser" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider animate-pulse">Đang quét camera...</span>
                </>
              )}
              {scannerStatus === 'success' && (
                <div className="text-center">
                  <span className="text-3xl">✓</span>
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-2 animate-bounce">ĐÃ NHẬN DIỆN VT001</p>
                </div>
              )}
            </div>

            <p className="text-center text-[10px] text-slate-400 leading-normal px-4">
              Đặt mã vạch/mã QR của vật tư trước camera điện thoại hoặc đầu đọc barcode để nhận dạng tức thì.
            </p>
          </div>
        </div>
      )}

      {/* 4. MODAL: Add/Edit Equipment (Preserving live DB functionality) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-2xl flex flex-col justify-between max-h-[90vh]">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600 animate-spin-slow" />
                {editingItem ? 'Cập nhật thông số vật tư' : 'Khai báo vật tư mới'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEquipment} className="p-8 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Thương hiệu *</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ví dụ: Longi Solar, Growatt, Deye..."
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Model / Tên *</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ví dụ: LR5-72HPH 550W, Ống PVC D25..."
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Phân loại</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  >
                    <option value="panel">Tấm pin Solar</option>
                    <option value="inverter">Inverter Biến tần</option>
                    <option value="battery">Pin lưu trữ (Battery)</option>
                    <option value="mounting">Hệ giá đỡ / Nhôm</option>
                    <option value="accessory">Phụ kiện lắp đặt</option>
                    <option value="other">Vật tư khác</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Đơn vị tính</label>
                  <input 
                    type="text"
                    placeholder="m, bộ, thùng, bao, tấm..."
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Vị trí lưu trữ trong kho</label>
                  <input 
                    type="text"
                    placeholder="Ví dụ: Kệ A1, Kệ B2..."
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Giá nhập vốn (VND)</label>
                  <input 
                    type="number"
                    value={formUnitPrice}
                    onChange={(e) => setFormUnitPrice(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Giá bán đề xuất (VND)</label>
                  <input 
                    type="number"
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Số lượng hiện tại</label>
                  <input 
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Mức tồn tối thiểu</label>
                  <input 
                    type="number"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Nhà cung cấp phân phối</label>
                <select
                  value={formSupplier}
                  onChange={(e) => setFormSupplier(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs cursor-pointer"
                >
                  <option value="">-- Chọn nhà cung cấp --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Quy cách chi tiết kỹ thuật</label>
                <textarea 
                  rows={2}
                  placeholder="Ghi chú kỹ thuật, tiêu chuẩn chất lượng, kích thước..."
                  value={formDetails}
                  onChange={(e) => setFormDetails(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                />
              </div>
            </form>

            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEquipment}
                className="bg-[#0054a6] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95"
              >
                {editingItem ? 'Lưu thay đổi' : 'Khai báo ngay'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-Fidelity Printable QR Codes Sticker Labels Sheet Modal */}
      {showPrintQrModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans print:p-0 print:bg-white print:static print:inset-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden print:shadow-none print:border-none print:h-auto print:max-w-full print:w-full print:bg-white">
            
            {/* Modal Header */}
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 print:hidden shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <QrCode className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">In Mã QR / Barcode Vật Tư</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Chọn các thiết bị cơ điện mặt trời bên dưới để in nhãn dán định danh</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrintQrModal(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 print:block">
              
              {/* Left Panel: Selection list */}
              <div className="w-full md:w-2/5 border-r border-slate-100 flex flex-col overflow-hidden print:hidden shrink-0">
                <div className="p-4 border-b border-slate-50 bg-slate-50/20">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <span>Danh sách vật tư ({allItems.length})</span>
                    <button 
                      onClick={() => {
                        if (selectedQrItems.length === allItems.length) {
                          setSelectedQrItems([]);
                        } else {
                          setSelectedQrItems(allItems.map(i => i.id));
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 font-black cursor-pointer"
                    >
                      {selectedQrItems.length === allItems.length ? 'Bỏ chọn hết' : 'Chọn tất cả'}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-50 p-2">
                  {allItems.map(item => {
                    const isSelected = selectedQrItems.includes(item.id);
                    return (
                      <div 
                        key={item.id} 
                        onClick={() => {
                          if (isSelected) {
                            setSelectedQrItems(selectedQrItems.filter(id => id !== item.id));
                          } else {
                            setSelectedQrItems([...selectedQrItems, item.id]);
                          }
                        }}
                        className={`p-3 rounded-xl flex items-center gap-3 hover:bg-slate-50 transition-all cursor-pointer ${
                          isSelected ? 'bg-blue-50/40 border border-blue-100/30' : 'border border-transparent'
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => {}} // Handled by div click
                          className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 shrink-0 pointer-events-none"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-[8px] font-mono font-black text-slate-400 uppercase">#{item.id}</span>
                            <span className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{item.unit || 'Cái'}</span>
                          </div>
                          <span className="text-xs font-black text-slate-800 block truncate mt-0.5">{item.model}</span>
                          <span className="text-[9px] font-bold text-slate-400 block mt-0.5">{item.brand} | Tồn: {item.stock}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Panel: Label preview sheet */}
              <div className="flex-1 bg-slate-100/50 p-6 overflow-y-auto print:bg-white print:p-0">
                <div className="mb-4 flex justify-between items-center print:hidden">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block font-black">
                    Bản xem trước trang in ({selectedQrItems.length} nhãn)
                  </span>
                  {selectedQrItems.length > 0 && (
                    <button 
                      onClick={() => window.print()}
                      className="bg-[#0054a6] hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                    >
                      <Printer className="h-4 w-4" />
                      In nhãn dán
                    </button>
                  )}
                </div>

                {selectedQrItems.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-200 rounded-3xl bg-white p-6 print:hidden">
                    <QrCode className="h-10 w-10 text-slate-300 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Vui lòng chọn vật tư để xem trước nhãn in</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-3 print:gap-6 print:p-0">
                    {allItems.filter(item => selectedQrItems.includes(item.id)).map(item => (
                      <div 
                        key={item.id} 
                        className="bg-white border-2 border-dashed border-slate-300 p-4 rounded-xl flex items-center gap-4 shadow-xs relative print:border print:border-solid print:border-slate-800 print:shadow-none print:break-inside-avoid print:my-2"
                      >
                        {/* Left Side: Brand & Product Details */}
                        <div className="flex-1 min-w-0 space-y-1.5 text-left">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[7px] font-black tracking-widest text-blue-600 uppercase">TRƯỜNG SƠN SOLAR</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{item.brand}</span>
                            <span className="text-xs font-black text-slate-800 block truncate" title={item.model}>{item.model}</span>
                          </div>
                          <div className="pt-1.5 border-t border-slate-100 flex justify-between items-center text-[10px]">
                            <span className="font-mono font-black text-slate-900">SKU: #{item.id}</span>
                            <span className="font-bold text-slate-500">VT: {item.kho || 'KHO_SOLAR'}</span>
                          </div>
                        </div>

                        {/* Right Side: QR Code Generator */}
                        <div className="w-16 h-16 shrink-0 border border-slate-200 p-1 bg-white rounded-lg flex items-center justify-center print:border-slate-800">
                          {renderFakeQrCodeSvg(item.id)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="px-8 py-4 border-t border-slate-100 flex justify-between items-center bg-slate-50/50 print:hidden shrink-0">
              <span className="text-[10px] font-bold text-slate-400 italic">
                * Mẹo: Sử dụng giấy Decal A4 chia 3 cột nhãn để dán trực tiếp lên hộp vật tư.
              </span>
              <button
                type="button"
                onClick={() => setShowPrintQrModal(false)}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Đóng lại
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 5. MODAL: Nhập danh mục Excel & Tải tệp mẫu */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-2xl flex flex-col justify-between max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Nhập danh mục thiết bị từ Excel</h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">Đồng bộ danh sách vật tư hàng loạt nhanh chóng qua file bảng tính</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setParsedImportRows([]);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto flex-1 space-y-6">
              
              {/* Step 1: Download sample & instructions */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center bg-slate-50 border border-slate-200/50 rounded-2xl p-5">
                <div className="md:col-span-8 space-y-2">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Tải về tệp mẫu Excel chuẩn</h4>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    Hệ thống yêu cầu tệp Excel có các tiêu đề cột chính xác: <strong>Mã vật tư, Thương hiệu, Model, ĐVT, Tồn thực tế, Định mức tối thiểu, Giá nhập, Giá bán lẻ, Vị trí, Nhà cung cấp, Mô tả</strong>. Nhấn nút bên cạnh để tải file mẫu chuẩn.
                  </p>
                </div>
                <div className="md:col-span-4 text-left md:text-right">
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest px-4 py-3 rounded-xl transition-all shadow-sm shadow-emerald-200 cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    Tải file Excel mẫu
                  </button>
                </div>
              </div>

              {/* Step 2: Drag & Drop upload frame */}
              {!importFile ? (
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                    dragActive 
                      ? 'border-blue-500 bg-blue-50/30' 
                      : 'border-slate-300 hover:border-blue-500 hover:bg-slate-50/50'
                  }`}
                >
                  <input 
                    type="file"
                    id="excel-file-uploader"
                    accept=".xlsx, .xls"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />
                  <label htmlFor="excel-file-uploader" className="w-full h-full cursor-pointer flex flex-col items-center justify-center">
                    <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                      <FileText className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Kéo thả tệp Excel của bạn vào đây</span>
                    <span className="text-[10px] text-slate-400 font-bold mt-1">Hoặc nhấp chuột để chọn từ máy tính (.xlsx, .xls)</span>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected File Details Banner */}
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white border border-blue-200 rounded-xl flex items-center justify-center text-blue-600 font-bold shrink-0">
                        XLS
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-800 truncate max-w-md">{importFile.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                          Dung lượng: {(importFile.size / 1024).toFixed(1)} KB — Đã phân tích <strong>{parsedImportRows.length}</strong> dòng vật tư
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setImportFile(null);
                        setParsedImportRows([]);
                      }}
                      className="text-[10px] text-slate-400 hover:text-red-500 font-black uppercase tracking-widest px-3 py-1.5 bg-white border border-slate-100 rounded-lg shadow-2xs"
                    >
                      Chọn lại file
                    </button>
                  </div>

                  {/* Parsed Data Preview Grid */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Danh sách vật tư xem trước</span>
                      <span className="text-[9px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-black">PREVIEW</span>
                    </div>

                    <div className="overflow-x-auto max-h-[30vh]">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400">
                            <th className="px-4 py-2 text-[9px] font-black uppercase tracking-wider">Mã vật tư</th>
                            <th className="px-4 py-2 text-[9px] font-black uppercase tracking-wider">Thương hiệu</th>
                            <th className="px-4 py-2 text-[9px] font-black uppercase tracking-wider">Model/Tên vật tư</th>
                            <th className="px-4 py-2 text-[9px] font-black uppercase tracking-wider">ĐVT</th>
                            <th className="px-4 py-2 text-[9px] font-black uppercase tracking-wider text-center">Tồn kho</th>
                            <th className="px-4 py-2 text-[9px] font-black uppercase tracking-wider text-right">Đơn giá nhập</th>
                            <th className="px-4 py-2 text-[9px] font-black uppercase tracking-wider">Vị trí</th>
                            <th className="px-4 py-2 text-[9px] font-black uppercase tracking-wider">Nhà cung cấp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 text-slate-700">
                          {parsedImportRows.map((row, index) => (
                            <tr key={index} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-mono text-[10px] font-black text-slate-950">{row.id}</td>
                              <td className="px-4 py-2.5 font-bold">{row.brand}</td>
                              <td className="px-4 py-2.5 font-black text-slate-800">{row.model}</td>
                              <td className="px-4 py-2.5 font-semibold text-slate-500">{row.unit}</td>
                              <td className="px-4 py-2.5 text-center font-bold text-emerald-600">{row.stock}</td>
                              <td className="px-4 py-2.5 text-right font-extrabold text-slate-800">
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(row.unitPrice)}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-slate-600">{row.location}</td>
                              <td className="px-4 py-2.5 text-slate-500 truncate max-w-[120px]" title={row.supplier}>{row.supplier}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setParsedImportRows([]);
                }}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={importing || parsedImportRows.length === 0}
                onClick={handleConfirmImport}
                className="bg-[#0054a6] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 flex items-center gap-2"
              >
                {importing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Đang lưu trữ...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Xác nhận nhập danh mục ({parsedImportRows.length})
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 6. MODAL: Comprehensive Product Detail & Import/Export History */}
      {showDetailModal && detailModalItem && (() => {
        const itemHistory = getItemTransactions(detailModalItem);
        const totalImports = itemHistory.filter(h => h.isImport);
        const totalExports = itemHistory.filter(h => !h.isImport);
        const totalImportQty = totalImports.reduce((sum, h) => sum + h.qty, 0);
        const totalExportQty = totalExports.reduce((sum, h) => sum + h.qty, 0);
        
        // Filter history by tab/search
        const filteredHistory = itemHistory.filter(h => {
          if (modalHistoryFilter === 'import' && !h.isImport) return false;
          if (modalHistoryFilter === 'export' && h.isImport) return false;
          if (modalHistorySearch.trim()) {
            const q = modalHistorySearch.toLowerCase();
            return (
              h.id.toLowerCase().includes(q) ||
              h.partner.toLowerCase().includes(q) ||
              h.user.toLowerCase().includes(q) ||
              h.subType.toLowerCase().includes(q) ||
              (h.note && h.note.toLowerCase().includes(q))
            );
          }
          return true;
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-5 animate-fade-in backdrop-blur-xs font-sans">
            <div className="bg-white w-full max-w-6xl rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
              
              {/* Modal Top Header */}
              <div className="px-6 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/70 flex flex-wrap justify-between items-center gap-4 shrink-0">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-13 h-13 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center text-2xl shrink-0">
                    {detailModalItem.type === 'panel' ? '☀️' : detailModalItem.type === 'inverter' ? '⚡' : detailModalItem.type === 'battery' ? '🔋' : '📦'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white px-2 py-0.5 rounded-md">
                        #{detailModalItem.id}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {detailModalItem.brand}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${
                        detailModalItem.status === 'Bình thường' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        detailModalItem.status === 'Thiếu hàng' ? 'bg-rose-50 border-rose-200 text-rose-600' :
                        detailModalItem.status === 'Cảnh báo' ? 'bg-amber-50 border-amber-200 text-amber-600' :
                        'bg-slate-100 border-slate-200 text-slate-600'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {detailModalItem.status}
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-black text-slate-900 leading-snug truncate mt-0.5" title={detailModalItem.model}>
                      {detailModalItem.model}
                    </h2>
                  </div>
                </div>

                {/* Header Action Tools */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportItemHistoryToExcel(detailModalItem)}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    title="Xuất file Excel lịch sử nhập xuất của hàng hoá này"
                  >
                    <Download className="h-4 w-4 text-emerald-600" />
                    <span className="hidden sm:inline">Xuất Excel</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPrintStockCardModal(true)}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    title="In thẻ kho / sổ theo dõi chi tiết vật tư"
                  >
                    <Printer className="h-4 w-4 text-blue-600" />
                    <span className="hidden sm:inline">In thẻ kho</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      setShowDetailModal(false);
                      handleOpenEditModal(detailModalItem, e);
                    }}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-700 border border-slate-200 hover:border-amber-300 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
                    title="Chỉnh sửa thông số vật tư"
                  >
                    <Edit className="h-4 w-4 text-amber-600" />
                    <span className="hidden sm:inline">Sửa</span>
                  </button>

                  <button 
                    onClick={() => setShowDetailModal(false)}
                    className="w-9 h-9 rounded-full bg-white hover:bg-rose-50 hover:text-rose-600 border border-slate-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                    title="Đóng cửa sổ"
                  >
                    <X className="h-4 w-4 text-slate-500" />
                  </button>
                </div>
              </div>

              {/* KPI Summary Banner */}
              <div className="px-6 sm:px-8 py-4 bg-slate-50/40 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
                <div className="bg-white p-3 rounded-2xl border border-slate-100/90 shadow-2xs">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Tồn thực tế</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-slate-900">{detailModalItem.stock}</span>
                    <span className="text-[10px] font-bold text-slate-400">{detailModalItem.unit}</span>
                  </div>
                </div>

                <div className="bg-emerald-50/40 p-3 rounded-2xl border border-emerald-100 shadow-2xs">
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 block mb-0.5">Tồn khả dụng</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-emerald-700">{detailModalItem.available}</span>
                    <span className="text-[10px] font-bold text-emerald-600">{detailModalItem.unit}</span>
                  </div>
                </div>

                <div className="bg-amber-50/40 p-3 rounded-2xl border border-amber-100 shadow-2xs">
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 block mb-0.5">Đang giữ / Treo</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-amber-700">{detailModalItem.holding}</span>
                    <span className="text-[10px] font-bold text-amber-600">{detailModalItem.unit}</span>
                  </div>
                </div>

                <div className="bg-blue-50/40 p-3 rounded-2xl border border-blue-100 shadow-2xs">
                  <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 block mb-0.5">Đang mua / Về</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-blue-700">{detailModalItem.buying}</span>
                    <span className="text-[10px] font-bold text-blue-600">{detailModalItem.unit}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-slate-100/90 shadow-2xs">
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 block mb-0.5">Tổng nhập ({totalImports.length} lần)</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-emerald-600">+{totalImportQty}</span>
                    <span className="text-[10px] font-bold text-slate-400">{detailModalItem.unit}</span>
                  </div>
                </div>

                <div className="bg-white p-3 rounded-2xl border border-slate-100/90 shadow-2xs">
                  <span className="text-[9px] font-black uppercase tracking-wider text-rose-500 block mb-0.5">Tổng xuất ({totalExports.length} lần)</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-black text-rose-600">-{totalExportQty}</span>
                    <span className="text-[10px] font-bold text-slate-400">{detailModalItem.unit}</span>
                  </div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="px-6 sm:px-8 pt-3 border-b border-slate-100 bg-white flex items-center gap-6 text-xs font-black uppercase tracking-wider shrink-0 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setModalActiveTab('history')}
                  className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
                    modalActiveTab === 'history'
                      ? 'border-[#0054a6] text-[#0054a6]'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <History className="h-4 w-4" />
                  <span>Lịch sử nhập xuất ({itemHistory.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalActiveTab('info')}
                  className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
                    modalActiveTab === 'info'
                      ? 'border-[#0054a6] text-[#0054a6]'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <Info className="h-4 w-4" />
                  <span>Thông số chi tiết & Định mức</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalActiveTab('stats')}
                  className={`pb-3 border-b-2 flex items-center gap-2 cursor-pointer transition-all ${
                    modalActiveTab === 'stats'
                      ? 'border-[#0054a6] text-[#0054a6]'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Biểu đồ biến động 6 tháng</span>
                </button>
              </div>

              {/* Modal Body Content Container */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-50/30 min-h-0">
                
                {/* TAB 1: Lịch sử nhập xuất của hàng hoá */}
                {modalActiveTab === 'history' && (
                  <div className="space-y-4">
                    
                    {/* Filter & Search Bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
                      
                      {/* Filter Pills */}
                      <div className="flex items-center gap-1.5 p-1 bg-slate-100/70 rounded-xl">
                        <button
                          type="button"
                          onClick={() => setModalHistoryFilter('all')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                            modalHistoryFilter === 'all'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-500 hover:text-slate-900'
                          }`}
                        >
                          Tất cả ({itemHistory.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalHistoryFilter('import')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                            modalHistoryFilter === 'import'
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          Nhập ({totalImports.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setModalHistoryFilter('export')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ${
                            modalHistoryFilter === 'export'
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'text-rose-600 hover:bg-rose-50'
                          }`}
                        >
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                          Xuất ({totalExports.length})
                        </button>
                      </div>

                      {/* Search in history */}
                      <div className="relative min-w-[220px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Tìm mã phiếu, đối tác, người tạo..."
                          value={modalHistorySearch}
                          onChange={(e) => setModalHistorySearch(e.target.value)}
                          className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                        />
                        {modalHistorySearch && (
                          <button
                            type="button"
                            onClick={() => setModalHistorySearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Transactions Table */}
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-400">
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider">Ngày GD</th>
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider">Mã chứng từ</th>
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider">Loại giao dịch</th>
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider">Đối tác / Dự án / Khách hàng</th>
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-right">Số lượng</th>
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-right">Đơn giá GD</th>
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-right">Thành tiền</th>
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider">Người thực hiện</th>
                              <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider">Ghi chú</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 text-slate-700">
                            {filteredHistory.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="py-12 text-center text-slate-400 italic text-xs">
                                  Không tìm thấy giao dịch nhập xuất nào phù hợp.
                                </td>
                              </tr>
                            ) : (
                              filteredHistory.map((h, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">
                                    {h.date}
                                  </td>
                                  <td className="px-4 py-3 font-mono font-black whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] ${
                                      h.isImport 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                      #{h.id}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="font-bold text-slate-800 block">{h.type}</span>
                                    <span className="text-[10px] text-slate-400 font-medium block">{h.subType}</span>
                                  </td>
                                  <td className="px-4 py-3 max-w-[200px]">
                                    <span className="font-bold text-slate-800 block truncate" title={h.partner}>
                                      {h.partner}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap font-black">
                                    <span className={`inline-flex items-center gap-0.5 text-xs font-black ${
                                      h.isImport ? 'text-emerald-600' : 'text-rose-600'
                                    }`}>
                                      {h.isImport ? '+' : '-'}{h.qty} {h.unit}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap font-bold text-slate-600">
                                    {formatCurrency(h.unitPrice)}
                                  </td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap font-black text-slate-900">
                                    {formatCurrency(h.totalPrice)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                                    {h.user}
                                  </td>
                                  <td className="px-4 py-3 text-slate-500 max-w-[180px] truncate" title={h.note}>
                                    {h.note || '—'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Table summary bar */}
                      <div className="px-6 py-3 bg-slate-50/70 border-t border-slate-100 flex flex-wrap justify-between items-center text-xs font-bold text-slate-500 gap-2">
                        <span>Hiển thị <strong>{filteredHistory.length}</strong> / {itemHistory.length} giao dịch</span>
                        <div className="flex items-center gap-4 text-[11px]">
                          <span>Tổng lượng nhập: <strong className="text-emerald-600">+{totalImportQty} {detailModalItem.unit}</strong></span>
                          <span>Tổng lượng xuất: <strong className="text-rose-600">-{totalExportQty} {detailModalItem.unit}</strong></span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

                {/* TAB 2: Thông số kỹ thuật & Định mức */}
                {modalActiveTab === 'info' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      
                      {/* Card 1: Thông tin định danh & Phân loại */}
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                          <PackageCheck className="h-4 w-4 text-blue-600" />
                          Thông tin định danh & Phân loại
                        </h4>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Mã vật tư (SKU)</span>
                            <span className="font-mono font-black text-slate-900 text-sm">#{detailModalItem.id}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Mã vạch Barcode</span>
                            <span className="font-mono font-bold text-slate-700 text-xs">||||| {detailModalItem.barcode}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Thương hiệu</span>
                            <span className="font-black text-slate-800">{detailModalItem.brand}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Nhóm phân loại</span>
                            <span className="font-black text-slate-800">{detailModalItem.group}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Đơn vị tính (ĐVT)</span>
                            <span className="font-black text-blue-600">{detailModalItem.unit}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Trạng thái</span>
                            <span className="font-bold text-emerald-600">{detailModalItem.status}</span>
                          </div>

                          <div className="col-span-2 pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Mô tả quy cách kỹ thuật</span>
                            <p className="text-slate-700 font-medium text-xs leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                              {detailModalItem.details || 'Chưa cập nhật chi tiết quy cách thông số.'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Card 2: Vị trí kho & Định mức tồn kho */}
                      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-emerald-600" />
                          Vị trí lưu kho & Định mức tồn
                        </h4>

                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Kho lưu trữ</span>
                            <span className="font-black text-slate-900">{detailModalItem.kho}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Vị trí kệ</span>
                            <span className="font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-md inline-block">
                              {detailModalItem.location || 'Chưa phân kệ'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Mức tồn tối thiểu (Min)</span>
                            <span className="font-black text-rose-600">{detailModalItem.minStock} {detailModalItem.unit}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Mức tồn tối đa (Max)</span>
                            <span className="font-black text-slate-800">{detailModalItem.maxStock} {detailModalItem.unit}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Giá nhập vốn gần nhất</span>
                            <span className="font-black text-slate-900 text-sm">{formatCurrency(detailModalItem.unitPrice)}</span>
                          </div>

                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Giá bán đề xuất</span>
                            <span className="font-black text-emerald-700 text-sm">{formatCurrency(detailModalItem.sellingPrice || detailModalItem.unitPrice * 1.25)}</span>
                          </div>

                          <div className="col-span-2 pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Nhà cung cấp phân phối chính</span>
                            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <span className="font-black text-slate-800">{detailModalItem.supplier || 'Chưa liên kết nhà cung cấp'}</span>
                              <Truck className="h-4 w-4 text-slate-400" />
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {/* TAB 3: Biến động tồn kho & Thống kê */}
                {modalActiveTab === 'stats' && (
                  <div className="space-y-6">
                    
                    {/* Area Chart 6 Months */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-2xs space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Biểu đồ biến động số lượng tồn kho (6 tháng)</h4>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Dữ liệu ghi nhận từ các chu kỳ kiểm kê và giao dịch nhập/xuất</p>
                        </div>
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-xl">
                          Hiện tại: {detailModalItem.stock} {detailModalItem.unit}
                        </span>
                      </div>

                      <div className="h-[220px] w-full pt-4 text-xs font-bold">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={getChartData(detailModalItem)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorStockModal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0054a6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#0054a6" stopOpacity={0.0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '11px' }}
                            />
                            <Area type="monotone" dataKey="Tồn kho" stroke="#0054a6" strokeWidth={3} fillOpacity={1} fill="url(#colorStockModal)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Breakdown distribution cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 text-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block mb-1">Tỷ lệ khả dụng</span>
                        <span className="text-2xl font-black text-emerald-700">
                          {detailModalItem.stock > 0 ? Math.round((detailModalItem.available / detailModalItem.stock) * 100) : 0}%
                        </span>
                        <p className="text-[10px] text-emerald-600 mt-1 font-medium">{detailModalItem.available} / {detailModalItem.stock} {detailModalItem.unit}</p>
                      </div>

                      <div className="bg-amber-50/50 p-5 rounded-2xl border border-amber-100 text-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 block mb-1">Tỷ lệ đang giữ</span>
                        <span className="text-2xl font-black text-amber-700">
                          {detailModalItem.stock > 0 ? Math.round((detailModalItem.holding / detailModalItem.stock) * 100) : 0}%
                        </span>
                        <p className="text-[10px] text-amber-600 mt-1 font-medium">{detailModalItem.holding} {detailModalItem.unit} dành cho dự án</p>
                      </div>

                      <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 text-center">
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block mb-1">Ước tính giá trị</span>
                        <span className="text-lg font-black text-blue-800">
                          {formatCurrency(detailModalItem.stock * detailModalItem.unitPrice)}
                        </span>
                        <p className="text-[10px] text-blue-600 mt-1 font-medium">Theo đơn giá nhập vốn</p>
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* Modal Bottom Footer */}
              <div className="px-6 sm:px-8 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-between items-center shrink-0">
                <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
                  Mã SKU: <strong className="text-slate-700 font-mono">#{detailModalItem.id}</strong> — Vị trí: <strong className="text-slate-700">{detailModalItem.location || 'Kho Solar'}</strong>
                </span>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setShowDetailModal(false)}
                    className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportItemHistoryToExcel(detailModalItem)}
                    className="bg-[#0054a6] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs active:scale-95 flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="h-4 w-4" />
                    Tải lịch sử Excel
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* 7. MODAL: Printable Stock Card (Thẻ kho chi tiết) */}
      {showPrintStockCardModal && detailModalItem && (() => {
        const itemHistory = getItemTransactions(detailModalItem);
        return (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans print:p-0 print:bg-white print:static print:inset-auto">
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden print:shadow-none print:border-none print:h-auto print:max-w-full print:w-full print:bg-white">
              
              {/* Modal Top Header (Hidden on print) */}
              <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 print:hidden shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <Printer className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Bản in Thẻ Kho / Sổ Theo Dõi Vật Tư</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">Chuẩn mẫu biểu kế toán quản trị kho vật tư thiết bị Solar</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => window.print()}
                    className="bg-[#0054a6] hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <Printer className="h-4 w-4" />
                    In Thẻ Kho
                  </button>
                  <button 
                    onClick={() => setShowPrintStockCardModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Printable Body Content */}
              <div className="flex-1 p-8 sm:p-12 overflow-y-auto print:p-0 print:overflow-visible">
                
                {/* Official Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">CÔNG TY TNHH KỸ THUẬT NĂNG LƯỢNG TRƯỜNG SƠN</h4>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Kho hàng: {detailModalItem.kho || 'KHO VẬT TƯ CHÍNH'}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">Địa chỉ: KCN Sóng Thần, Dĩ An, Bình Dương</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs font-black text-slate-900 block">Mẫu số: 06-VT</span>
                    <span className="text-[9px] text-slate-400 italic block">(Ban hành theo TT số 200/2014/TT-BTC)</span>
                  </div>
                </div>

                {/* Title */}
                <div className="text-center my-6 space-y-1">
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">THẺ KHO (SỔ KHO)</h2>
                  <p className="text-xs text-slate-500 italic">Ngày lập thẻ: {new Date().toLocaleDateString('vi-VN')}</p>
                </div>

                {/* Item Details Block */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 text-xs mb-6">
                  <div>
                    <span className="text-slate-500">Tên, quy cách vật tư:</span> <strong className="text-slate-900">{detailModalItem.model}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Mã số vật tư:</span> <strong className="text-slate-900 font-mono">#{detailModalItem.id}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Đơn vị tính:</span> <strong className="text-slate-900">{detailModalItem.unit}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Vị trí lưu kho:</span> <strong className="text-slate-900">{detailModalItem.location || 'Chưa xác định'}</strong>
                  </div>
                </div>

                {/* Table of Stock Card Movements */}
                <table className="w-full border-collapse border border-slate-300 text-xs mb-8">
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 text-[10px] font-black uppercase">
                      <th className="border border-slate-300 p-2 text-center" rowSpan={2}>STT</th>
                      <th className="border border-slate-300 p-2 text-center" rowSpan={2}>Ngày tháng</th>
                      <th className="border border-slate-300 p-2 text-center" colSpan={2}>Số hiệu chứng từ</th>
                      <th className="border border-slate-300 p-2 text-left" rowSpan={2}>Diễn giải giao dịch</th>
                      <th className="border border-slate-300 p-2 text-right" colSpan={3}>Số lượng ({detailModalItem.unit})</th>
                      <th className="border border-slate-300 p-2 text-center" rowSpan={2}>Ký xác nhận</th>
                    </tr>
                    <tr className="bg-slate-100 text-slate-800 text-[9px] font-black uppercase">
                      <th className="border border-slate-300 p-1.5 text-center">Thu</th>
                      <th className="border border-slate-300 p-1.5 text-center">Chi</th>
                      <th className="border border-slate-300 p-1.5 text-right">Nhập</th>
                      <th className="border border-slate-300 p-1.5 text-right">Xuất</th>
                      <th className="border border-slate-300 p-1.5 text-right">Tồn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemHistory.map((h, i) => (
                      <tr key={i} className="text-slate-800">
                        <td className="border border-slate-300 p-2 text-center font-medium">{i + 1}</td>
                        <td className="border border-slate-300 p-2 text-center font-medium">{h.date}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono font-bold">{h.isImport ? h.id : '—'}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono font-bold">{!h.isImport ? h.id : '—'}</td>
                        <td className="border border-slate-300 p-2 font-medium">{h.subType} - {h.partner}</td>
                        <td className="border border-slate-300 p-2 text-right font-black text-emerald-700">{h.isImport ? h.qty : '—'}</td>
                        <td className="border border-slate-300 p-2 text-right font-black text-rose-700">{!h.isImport ? h.qty : '—'}</td>
                        <td className="border border-slate-300 p-2 text-right font-black text-slate-900">{detailModalItem.stock}</td>
                        <td className="border border-slate-300 p-2 text-center text-slate-400 italic font-mono text-[9px]">{h.user}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Signature Blocks */}
                <div className="grid grid-cols-3 gap-6 text-center text-xs mt-12 pt-6">
                  <div>
                    <span className="font-black text-slate-900 uppercase block">Người lập thẻ</span>
                    <span className="text-[10px] text-slate-400 italic block mt-0.5">(Ký, họ tên)</span>
                    <div className="h-20" />
                    <span className="font-bold text-slate-800">Trần Thị Thu</span>
                  </div>
                  <div>
                    <span className="font-black text-slate-900 uppercase block">Thủ kho</span>
                    <span className="text-[10px] text-slate-400 italic block mt-0.5">(Ký, họ tên)</span>
                    <div className="h-20" />
                    <span className="font-bold text-slate-800">Lê Văn Tám</span>
                  </div>
                  <div>
                    <span className="font-black text-slate-900 uppercase block">Kế toán trưởng</span>
                    <span className="text-[10px] text-slate-400 italic block mt-0.5">(Ký, họ tên)</span>
                    <div className="h-20" />
                    <span className="font-bold text-slate-800">Nguyễn Quốc Bảo</span>
                  </div>
                </div>

              </div>

              {/* Modal Footer (Hidden on print) */}
              <div className="px-8 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50 print:hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPrintStockCardModal(false)}
                  className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Đóng lại
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
}
