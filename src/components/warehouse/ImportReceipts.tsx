import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  X, 
  ArrowUpRight, 
  Building, 
  Package, 
  Layers, 
  Calendar, 
  User,
  CheckCircle2,
  ShoppingCart,
  ClipboardCheck,
  Database,
  Download,
  FileSpreadsheet,
  Star,
  MoreVertical,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Check,
  Undo2,
  FileText,
  ClipboardList
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { InventoryTransaction, Equipment, WarehouseSupplier, PurchaseProposal } from './types';

interface ImportReceiptsProps {
  transactions: InventoryTransaction[];
  equipment: Equipment[];
  suppliers: WarehouseSupplier[];
  onOpenDocument: (id: string, type: 'pn' | 'px' | 'dexuat' | 'muahang', label: string) => void;
  userId: string;
  purchaseProposals?: PurchaseProposal[];
}

// Beautiful pure CSS category-based material icon thumbnails
const MaterialIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'panel':
      return (
        <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 flex flex-col justify-between p-1 shrink-0 shadow-xs relative overflow-hidden">
          <div className="grid grid-cols-3 gap-0.5 h-full w-full">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-blue-600 rounded-[1px] border-[0.5px] border-blue-400/30"></div>
            ))}
          </div>
        </div>
      );
    case 'inverter':
      return (
        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center p-1 shrink-0 shadow-xs relative">
          <div className="w-5 h-5 bg-slate-700 rounded-md border border-slate-600 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></div>
          </div>
          <div className="absolute bottom-[2px] right-[2px] w-1.5 h-1 bg-slate-400 rounded-xs"></div>
        </div>
      );
    case 'battery':
      return (
        <div className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center p-1 shrink-0 shadow-xs">
          <div className="w-4 h-5 bg-purple-600 rounded-md flex flex-col justify-between p-[2px]">
            <div className="w-full h-1 bg-purple-300 rounded-[1px]"></div>
            <div className="w-full h-1 bg-purple-300 rounded-[1px]"></div>
            <div className="w-full h-1 bg-purple-300 rounded-[1px]"></div>
          </div>
        </div>
      );
    case 'structure':
      return (
        <div className="w-8 h-8 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center p-1 shrink-0 shadow-xs">
          <div className="relative w-5 h-5 flex items-center justify-center">
            <div className="absolute w-full h-[2px] bg-slate-500 rounded-full rotate-45"></div>
            <div className="absolute w-full h-[2px] bg-slate-500 rounded-full -rotate-45"></div>
            <div className="absolute w-1.5 h-1.5 bg-slate-800 rounded-full"></div>
          </div>
        </div>
      );
    case 'cable':
    default:
      return (
        <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center p-1 shrink-0 shadow-xs">
          <div className="w-4 h-4 rounded-full border-2 border-amber-600 border-dashed"></div>
        </div>
      );
  }
};

export default function ImportReceipts({ 
  transactions, 
  equipment, 
  suppliers, 
  onOpenDocument,
  userId,
  purchaseProposals = []
}: ImportReceiptsProps) {
  
  // Tab/Source State
  const [activeSource, setActiveSource] = useState<'purchase_order' | 'tech_return' | 'initial_stock'>('purchase_order');

  // Filter States (For Purchase Orders list)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);

  // Manual Form States
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formPaidAmount, setFormPaidAmount] = useState(0);
  const [formItems, setFormItems] = useState<Array<{ equipmentId: string, quantity: number, unitPrice: number }>>([]);

  // Active Row Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Technical return form state
  const [techName, setTechName] = useState('');
  const [techEquipmentId, setTechEquipmentId] = useState('');
  const [techQty, setTechQty] = useState(1);
  const [techReason, setTechReason] = useState('');

  // Initial stock form state
  const [initialStockUpdates, setInitialStockUpdates] = useState<Record<string, number>>({});

  // States to keep track of processed/completed POs
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [completedPOIds, setCompletedPOIds] = useState<string[]>([]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // 1. Define high-fidelity simulated POs to match the image exactly (23 total records)
  const simulatedPOs = [
    {
      id: 'PO000123',
      supplierId: 'SUP001',
      supplierName: 'Công ty TNHH ABC',
      rating: 4.8,
      itemTypes: ['structure', 'inverter', 'panel', 'battery'],
      totalTypes: 12,
      additionalCount: 8,
      totalCost: 128450000,
      createdAt: '2024-07-08T10:30:00Z',
      dateDisplay: '08/07/2024',
      timeDisplay: '10:30',
      status: 'delivered_full',
      items: [
        { equipmentId: 'EQ001', brand: 'Longi', model: 'LR5-72HPH 550W', type: 'panel', quantity: 30, unitPrice: 2100000, unit: 'Tấm' },
        { equipmentId: 'EQ004', brand: 'Growatt', model: 'MIN 5000TL-X', type: 'inverter', quantity: 2, unitPrice: 15000000, unit: 'Bộ' },
      ]
    },
    {
      id: 'PO000122',
      supplierId: 'SUP002',
      supplierName: 'Công ty CP Thiết bị điện DEF',
      rating: 4.6,
      itemTypes: ['structure', 'structure', 'panel', 'other'],
      totalTypes: 9,
      additionalCount: 6,
      totalCost: 95760000,
      createdAt: '2024-07-07T14:22:00Z',
      dateDisplay: '07/07/2024',
      timeDisplay: '14:22',
      status: 'delivered_full',
      items: [
        { equipmentId: 'EQ002', brand: 'VSun', model: 'VSUN450-144M', type: 'panel', quantity: 40, unitPrice: 1800000, unit: 'Tấm' },
      ]
    },
    {
      id: 'PO000121',
      supplierId: 'SUP003',
      supplierName: 'Công ty TNHH GHI',
      rating: 4.5,
      itemTypes: ['panel', 'inverter', 'cable', 'other'],
      totalTypes: 6,
      additionalCount: 3,
      totalCost: 67230000,
      createdAt: '2024-07-06T09:15:00Z',
      dateDisplay: '06/07/2024',
      timeDisplay: '09:15',
      status: 'delivered_partial',
      items: [
        { equipmentId: 'EQ003', brand: 'Solis', model: 'S5-GR3P10K', type: 'inverter', quantity: 1, unitPrice: 22000000, unit: 'Bộ' },
      ]
    },
    {
      id: 'PO000120',
      supplierId: 'SUP004',
      supplierName: 'Công ty VLXD JKL',
      rating: 4.7,
      itemTypes: ['other', 'structure', 'cable', 'structure'],
      totalTypes: 8,
      additionalCount: 5,
      totalCost: 210500000,
      createdAt: '2024-07-05T16:45:00Z',
      dateDisplay: '05/07/2024',
      timeDisplay: '16:45',
      status: 'delivered_partial',
      items: [
        { equipmentId: 'EQ001', brand: 'Longi', model: 'LR5-72HPH 550W', type: 'panel', quantity: 80, unitPrice: 2100000, unit: 'Tấm' },
      ]
    },
    {
      id: 'PO000119',
      supplierId: 'SUP005',
      supplierName: 'Công ty TNHH MNO',
      rating: 4.4,
      itemTypes: ['panel', 'inverter', 'structure', 'panel'],
      totalTypes: 11,
      additionalCount: 7,
      totalCost: 89600000,
      createdAt: '2024-07-04T11:20:00Z',
      dateDisplay: '04/07/2024',
      timeDisplay: '11:20',
      status: 'delivered_full',
      items: [
        { equipmentId: 'EQ002', brand: 'VSun', model: 'VSUN450-144M', type: 'panel', quantity: 45, unitPrice: 1800000, unit: 'Tấm' },
      ]
    }
  ];

  // Helper to generate additional simulated records to make pagination interactive and realistic (up to 23 records)
  const generateMoreSimulatedPOs = () => {
    const list = [];
    const suppliersNames = [
      'Công ty TNHH ABC',
      'Công ty CP Thiết bị điện DEF',
      'Công ty TNHH GHI',
      'Công ty VLXD JKL',
      'Công ty TNHH MNO'
    ];
    const supplierIds = ['SUP001', 'SUP002', 'SUP003', 'SUP004', 'SUP005'];
    const ratings = [4.8, 4.6, 4.5, 4.7, 4.4];
    const itemTypesList = [
      ['panel', 'inverter'],
      ['structure', 'panel', 'cable'],
      ['battery', 'inverter'],
      ['structure', 'cable'],
      ['panel', 'battery', 'cable', 'structure']
    ];

    for (let i = 118; i >= 101; i--) {
      const idx = (118 - i) % 5;
      const numTypes = 5 + (i % 8);
      list.push({
        id: `PO000${i}`,
        supplierId: supplierIds[idx],
        supplierName: suppliersNames[idx],
        rating: ratings[idx],
        itemTypes: itemTypesList[idx],
        totalTypes: numTypes,
        additionalCount: Math.max(0, numTypes - 4),
        totalCost: 45000000 + (i * 350000),
        createdAt: new Date(Date.now() - 3600000 * 24 * (119 - i + 5)).toISOString(),
        dateDisplay: `${String(Math.max(1, (i % 28))).padStart(2, '0')}/06/2024`,
        timeDisplay: `${String(10 + (i % 12)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
        status: i % 3 === 0 ? 'delivered_partial' : 'delivered_full',
        items: [
          { equipmentId: 'EQ001', brand: 'Longi', model: 'LR5-72HPH 550W', type: 'panel', quantity: 15, unitPrice: 2100000, unit: 'Tấm' }
        ]
      });
    }
    return list;
  };

  // Combine real Firestore purchase proposals with our simulated list to keep it interactive
  const getCombinedPOs = () => {
    const formattedRealPOs = purchaseProposals
      .filter(p => p.status === 'ordering' || p.status === 'completed')
      .map(p => {
        const itemTypes = p.items.map(item => item.type || 'other');
        const totalTypes = p.items.length;
        
        let dateDisplay = '08/07/2024';
        let timeDisplay = '10:30';
        if (p.createdAt) {
          try {
            const d = new Date(p.createdAt);
            dateDisplay = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            timeDisplay = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
          } catch (e) {}
        }
        
        return {
          id: p.id,
          supplierId: p.supplierId,
          supplierName: p.supplierName,
          rating: 4.5,
          itemTypes,
          totalTypes,
          additionalCount: Math.max(0, totalTypes - 4),
          totalCost: p.totalCost,
          createdAt: p.createdAt || new Date().toISOString(),
          dateDisplay,
          timeDisplay,
          status: p.status === 'completed' ? 'delivered_full' : 'delivered_partial',
          items: p.items,
          isReal: true,
          originalStatus: p.status
        };
      });

    const moreSimulated = generateMoreSimulatedPOs();
    const allSimulated = [...simulatedPOs, ...moreSimulated];
    
    // De-duplicate so that if we have real POs they take precedence over matching simulated ones
    const combined = [
      ...formattedRealPOs,
      ...allSimulated.filter(sim => !formattedRealPOs.some(real => real.id === sim.id))
    ];

    // Sort by createdAt descending so that the newest real orders are displayed at the very top
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const allPOs = getCombinedPOs();

  // Filter combined POs list
  const filteredPOs = allPOs.filter(po => {
    const matchSearch = 
      po.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      po.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchSupplier = selectedSupplier === 'all' || po.supplierName === selectedSupplier;
    const matchStatus = selectedStatus === 'all' || po.status === selectedStatus;
    
    let matchDate = true;
    if (dateFrom || dateTo) {
      const poDate = new Date(po.createdAt);
      if (dateFrom) {
        const from = new Date(dateFrom);
        from.setHours(0,0,0,0);
        if (poDate < from) matchDate = false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23,59,59,999);
        if (poDate > to) matchDate = false;
      }
    }
    
    return matchSearch && matchSupplier && matchStatus && matchDate;
  });

  // Pagination Math
  const totalItems = filteredPOs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const indexOfLastItem = currentPage * pageSize;
  const indexOfFirstItem = indexOfLastItem - pageSize;
  const currentPOs = filteredPOs.slice(indexOfFirstItem, indexOfLastItem);

  // Helper to generate dynamic page numbers list (matches the beautiful style of the image)
  const getPageNumbers = () => {
    const pages: Array<number | string> = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  // Open "Nhập kho" prefilled modal when clicking a row's button
  const handleOpenImportModal = (po: any) => {
    setSelectedPO(po);
    setFormSupplierId(po.supplierId || 'SUP001');
    setFormNote(`Nhập kho thực tế từ Đơn mua hàng #${po.id}`);
    
    if (po.items && po.items.length > 0) {
      setFormItems(po.items.map((item: any) => ({
        equipmentId: item.equipmentId,
        quantity: item.quantity,
        unitPrice: item.unitPrice || 2000000
      })));
    } else {
      // Fallback
      setFormItems([
        { equipmentId: 'EQ001', quantity: 20, unitPrice: 2100000 }
      ]);
    }
    
    setFormPaidAmount(po.paidAmount !== undefined ? po.paidAmount : 0);
    setShowAddModal(true);
  };

  // Export to Excel / CSV function supporting UTF-8 for Vietnamese characters
  const handleExportExcel = () => {
    try {
      const headers = ['Mã đơn mua', 'Nhà cung cấp', 'Đánh giá NCC', 'Tổng chi phí dự kiến', 'Ngày lập', 'Trạng thái'];
      const rows = filteredPOs.map(po => [
        po.id,
        po.supplierName,
        `${po.rating} Sao`,
        `${po.totalCost} VND`,
        `${po.dateDisplay} ${po.timeDisplay}`,
        po.status === 'delivered_full' ? 'Đã nhận đủ hàng' : 'Nhận thiếu hàng'
      ]);
      
      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Danh_sach_phieu_mua_hang_da_hoan_thanh_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('Không thể xuất Excel vào lúc này.');
    }
  };

  // Modal Item handlers
  const handleAddItem = (equipmentId: string) => {
    if (formItems.some(item => item.equipmentId === equipmentId)) return;
    const eq = equipment.find(e => e.id === equipmentId);
    setFormItems([...formItems, { 
      equipmentId, 
      quantity: 10, 
      unitPrice: eq?.unitPrice || 2000000 
    }]);
  };

  const handleRemoveItem = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handleQtyChange = (idx: number, qty: number) => {
    if (qty < 1) return;
    const newItems = [...formItems];
    newItems[idx].quantity = qty;
    setFormItems(newItems);
  };

  const handlePriceChange = (idx: number, price: number) => {
    if (price < 0) return;
    const newItems = [...formItems];
    newItems[idx].unitPrice = price;
    setFormItems(newItems);
  };

  const calculateTotalValue = () => {
    return formItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  // Ký duyệt & Nhập kho Submit
  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplierId || formItems.length === 0) {
      alert('Vui lòng chọn nhà cung cấp và thêm ít nhất 1 vật tư.');
      return;
    }

    try {
      const selectedSup = suppliers.find(s => s.id === formSupplierId) || { name: 'Nhà cung cấp' };
      const supName = selectedSup.name;
      
      const receiptId = 'PN' + Math.floor(200000 + Math.random() * 799999);
      const totalVal = calculateTotalValue();
      const debtVal = Math.max(0, totalVal - formPaidAmount);

      const payload: InventoryTransaction = {
        id: receiptId,
        type: 'import',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        partnerId: formSupplierId,
        partnerName: supName,
        totalValue: totalVal,
        paidAmount: formPaidAmount,
        debtAmount: debtVal,
        note: formNote.trim() || 'Nhập kho lô vật tư thiết bị solar mới',
        createdBy: userId,
        createdByName: 'Thủ kho Solar',
        items: formItems.map(item => {
          const eq = equipment.find(e => e.id === item.equipmentId);
          return {
            equipmentId: item.equipmentId,
            brand: eq?.brand || 'Chưa rõ',
            model: eq?.model || 'Thiết bị',
            type: eq?.type || 'other',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unit: eq?.unit || 'Cái'
          };
        })
      };

      // 1. Save receipt document to Firestore
      await setDoc(doc(db, 'inventory_transactions', receiptId), payload);

      // If imported from a PO, mark it as completed
      if (selectedPO) {
        if (selectedPO.isReal) {
          try {
            const poRef = doc(db, 'purchase_proposals', selectedPO.id);
            await updateDoc(poRef, {
              status: 'completed'
            });
          } catch (poErr) {
            console.error('Error updating purchase proposal status:', poErr);
          }
        }
        setCompletedPOIds(prev => [...prev, selectedPO.id]);
      }

      // 2. Loop & increment stock of equipment in Firestore
      for (const item of formItems) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(item.quantity)
        });
      }

      // 3. Update Supplier liabilities debt if any remaining
      if (debtVal > 0) {
        const supRef = doc(db, 'suppliers', formSupplierId);
        await updateDoc(supRef, {
          debt: increment(debtVal)
        });
      }

      setShowAddModal(false);
      setFormSupplierId('');
      setFormNote('');
      setFormPaidAmount(0);
      setFormItems([]);
      setSelectedPO(null);
      alert(`Đã lập và duyệt thành công Phiếu Nhập Kho #${receiptId}! Số lượng tồn kho đã được đồng bộ tăng.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  // Technical return handler
  const handleTechReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techName || !techEquipmentId || techQty < 1) {
      alert('Vui lòng điền đầy đủ thông tin kỹ thuật hoàn trả.');
      return;
    }

    try {
      const eq = equipment.find(e => e.id === techEquipmentId);
      if (!eq) return;

      const receiptId = 'PN' + Math.floor(100000 + Math.random() * 899999);
      const totalVal = techQty * (eq.unitPrice || 1500000);

      const payload: InventoryTransaction = {
        id: receiptId,
        type: 'import',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        partnerId: 'TECH_RETURN',
        partnerName: `Kỹ thuật: ${techName}`,
        totalValue: totalVal,
        items: [{
          equipmentId: techEquipmentId,
          brand: eq.brand,
          model: eq.model,
          type: eq.type,
          quantity: techQty,
          unitPrice: eq.unitPrice || 1500000,
          unit: eq.unit
        }],
        note: techReason.trim() || `Kỹ thuật viên ${techName} hoàn trả vật tư thừa dự án`,
        createdBy: userId,
        createdByName: 'Thủ kho Solar'
      };

      await setDoc(doc(db, 'inventory_transactions', receiptId), payload);

      const eqRef = doc(db, 'equipment', techEquipmentId);
      await updateDoc(eqRef, {
        stock: increment(techQty)
      });

      alert(`Đã duyệt hoàn trả vật tư #${receiptId} từ kỹ thuật viên ${techName}! Kho đã tăng thêm ${techQty} ${eq.unit}.`);
      setTechName('');
      setTechEquipmentId('');
      setTechQty(1);
      setTechReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  // Initial stock balance handler
  const handleSaveInitialStock = async (eqId: string) => {
    const newQty = initialStockUpdates[eqId];
    if (newQty === undefined || newQty < 0) {
      alert('Vui lòng nhập số lượng hợp lệ.');
      return;
    }

    try {
      const eq = equipment.find(e => e.id === eqId);
      if (!eq) return;

      // Update in Firestore
      const eqRef = doc(db, 'equipment', eqId);
      await updateDoc(eqRef, {
        stock: newQty
      });

      // Write log transaction
      const receiptId = 'PN' + Math.floor(900000 + Math.random() * 99999);
      const payload: InventoryTransaction = {
        id: receiptId,
        type: 'import',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        partnerId: 'INITIAL_STOCK',
        partnerName: 'Tồn kho đầu kỳ',
        totalValue: newQty * (eq.unitPrice || 1000000),
        items: [{
          equipmentId: eqId,
          brand: eq.brand,
          model: eq.model,
          type: eq.type,
          quantity: newQty,
          unitPrice: eq.unitPrice || 1000000,
          unit: eq.unit
        }],
        note: `Nhập và đồng bộ số dư tồn kho đầu kỳ cho thiết bị ${eq.brand} ${eq.model}`,
        createdBy: userId,
        createdByName: 'Thủ kho Solar'
      };

      await setDoc(doc(db, 'inventory_transactions', receiptId), payload);

      alert(`Đã cập nhật số dư tồn kho đầu kỳ của thiết bị ${eq.brand} ${eq.model} thành ${newQty} ${eq.unit}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'equipment');
    }
  };

  return (
    <div id="import-receipts-container" className="space-y-6">
      
      {/* Title Header */}
      <div id="import-header-section" className="space-y-1">
        <h1 id="import-main-title" className="text-2xl font-extrabold text-slate-900 tracking-tight">Nhập kho</h1>
        <p id="import-sub-title" className="text-slate-500 text-xs font-semibold">Chọn nguồn nhập kho để bắt đầu</p>
      </div>

      {/* THREE LARGE SELECTOR CARDS - Identical to Image */}
      <div id="import-source-cards" className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Source Card 1: Nhập từ đơn mua hàng (Selected State in image) */}
        <button 
          id="btn-source-purchase-order"
          onClick={() => setActiveSource('purchase_order')}
          className={`p-5 rounded-[2rem] border text-left flex items-start gap-4 transition-all duration-300 cursor-pointer ${
            activeSource === 'purchase_order' 
              ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-2 ring-blue-500/10' 
              : 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200'
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
            activeSource === 'purchase_order' ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
          }`}>
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 text-xs tracking-wide">Nhập từ đơn mua hàng</h4>
            <p className="text-[10px] text-slate-500 font-bold mt-1 leading-relaxed">Nhập kho từ các đơn mua hàng đã hoàn thành</p>
          </div>
        </button>

        {/* Source Card 2: Kỹ thuật trả vật tư */}
        <button 
          id="btn-source-tech-return"
          onClick={() => setActiveSource('tech_return')}
          className={`p-5 rounded-[2rem] border text-left flex items-start gap-4 transition-all duration-300 cursor-pointer ${
            activeSource === 'tech_return' 
              ? 'border-emerald-500 bg-emerald-50/40 shadow-sm ring-2 ring-emerald-500/10' 
              : 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200'
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
            activeSource === 'tech_return' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
          }`}>
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 text-xs tracking-wide">Kỹ thuật trả vật tư</h4>
            <p className="text-[10px] text-slate-500 font-bold mt-1 leading-relaxed">Nhập kho từ vật tư được kỹ thuật trả lại kho</p>
          </div>
        </button>

        {/* Source Card 3: Nhập hàng tồn đầu kỳ */}
        <button 
          id="btn-source-initial-stock"
          onClick={() => setActiveSource('initial_stock')}
          className={`p-5 rounded-[2rem] border text-left flex items-start gap-4 transition-all duration-300 cursor-pointer ${
            activeSource === 'initial_stock' 
              ? 'border-purple-500 bg-purple-50/40 shadow-sm ring-2 ring-purple-500/10' 
              : 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200'
          }`}
        >
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${
            activeSource === 'initial_stock' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'
          }`}>
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-900 text-xs tracking-wide">Nhập hàng tồn đầu kỳ</h4>
            <p className="text-[10px] text-slate-500 font-bold mt-1 leading-relaxed">Nhập số liệu hàng tồn kho đầu kỳ</p>
          </div>
        </button>

      </div>

      {/* VIEW PANEL 1: PURCHASE ORDER (Match image layout perfectly) */}
      {activeSource === 'purchase_order' && (
        <div id="purchase-order-panel" className="space-y-4">
          
          {/* Card Title Header with Export Excel Button */}
          <div id="po-list-title-header" className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Danh sách phiếu mua hàng đã hoàn thành</h3>
            
            <div className="flex items-center gap-2">
              {/* Optional Manual Add Trigger for maximum versatility */}
              <button
                id="btn-manual-add-trigger"
                onClick={() => {
                  setFormSupplierId('');
                  setFormNote('');
                  setFormPaidAmount(0);
                  setFormItems([]);
                  setShowAddModal(true);
                }}
                className="bg-blue-650 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Lập phiếu ngoài đơn
              </button>

              <button
                id="btn-export-excel-action"
                onClick={handleExportExcel}
                className="bg-[#217346] hover:bg-[#1a5c38] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Xuất Excel
              </button>
            </div>
          </div>

          {/* Filtering Bar Row - Matching image elements */}
          <div id="po-filtering-bar" className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-wrap items-center gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input 
                type="text"
                placeholder="Tìm kiếm mã đơn, nhà cung cấp..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 placeholder-slate-400/75 shadow-xs"
              />
            </div>

            {/* Supplier Select */}
            <div className="relative">
              <select
                value={selectedSupplier}
                onChange={(e) => {
                  setSelectedSupplier(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-4 pr-10 py-2.5 rounded-2xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer shadow-xs min-w-[160px]"
              >
                <option value="all">Tất cả nhà cung cấp</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.name}>{sup.name}</option>
                ))}
                {/* Simulated suppliers to match exact mock names */}
                <option value="Công ty TNHH ABC">Công ty TNHH ABC</option>
                <option value="Công ty CP Thiết bị điện DEF">Công ty CP Thiết bị điện DEF</option>
                <option value="Công ty TNHH GHI">Công ty TNHH GHI</option>
                <option value="Công ty VLXD JKL">Công ty VLXD JKL</option>
                <option value="Công ty TNHH MNO">Công ty TNHH MNO</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Date Range Picker */}
            <div className="flex items-center gap-2 border border-slate-200 rounded-2xl px-4 py-2.5 bg-white text-slate-400 text-xs shadow-xs">
              <input 
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="focus:outline-none bg-transparent font-bold cursor-pointer text-slate-700"
              />
              <span className="text-slate-300 font-bold">→</span>
              <input 
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="focus:outline-none bg-transparent font-bold cursor-pointer text-slate-700"
              />
              <Calendar className="h-4 w-4 text-slate-400 ml-1" />
            </div>

            {/* Status Select */}
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
                className="appearance-none pl-4 pr-10 py-2.5 rounded-2xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer shadow-xs min-w-[150px]"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="delivered_full">Đã nhận đủ hàng</option>
                <option value="delivered_partial">Chờ nhập kho (Đã đặt hàng)</option>
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            {/* Reset Filters button */}
            <button 
              id="btn-reset-po-filters"
              onClick={() => {
                setSearchTerm('');
                setSelectedSupplier('all');
                setDateFrom('');
                setDateTo('');
                setSelectedStatus('all');
                setCurrentPage(1);
              }}
              className="p-2.5 border border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 bg-white"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

          </div>

          {/* Table Container - High Contrast Visual Design */}
          <div id="po-table-container" className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-150 bg-slate-50/50">
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Mã đơn mua ◆</th>
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Nhà cung cấp ◆</th>
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Vật tư dự kiến mua ◆</th>
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Tổng chi phí dự kiến ◆</th>
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Ngày lập ◆</th>
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Trạng thái ◆</th>
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {currentPOs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-400 text-xs italic font-semibold">
                        Không tìm thấy đơn mua hàng nào phù hợp với bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    currentPOs.map((po) => (
                      <tr key={po.id} className="hover:bg-slate-50/40 transition-all">
                        
                        {/* ID & Type Badge */}
                        <td className="px-6 py-5 font-mono text-[10px] font-black text-slate-800">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center justify-center shrink-0">
                              <ClipboardList className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <span className="font-extrabold text-slate-900 text-xs block tracking-wide">{po.id}</span>
                              <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600">
                                <Check className="h-2.5 w-2.5" /> Hoàn thành
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Supplier Info with Star Rating */}
                        <td className="px-6 py-5">
                          <span className="font-bold text-xs text-slate-800 block">{po.supplierName}</span>
                          <div className="flex items-center gap-1 mt-1">
                            <div className="flex text-amber-400">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`h-3 w-3 fill-current ${i < Math.floor(po.rating) ? 'text-amber-400' : 'text-slate-200'}`} 
                                />
                              ))}
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 ml-0.5">{po.rating}</span>
                          </div>
                        </td>

                        {/* Material Previews Stacked */}
                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center -space-x-1.5">
                              {po.itemTypes.slice(0, 4).map((type: string, i: number) => (
                                <div key={i} className="relative z-10 border-2 border-white rounded-lg shadow-xs hover:z-20 transition-all">
                                  <MaterialIcon type={type} />
                                </div>
                              ))}
                              {po.additionalCount > 0 && (
                                <div className="w-8 h-8 rounded-lg bg-slate-50 border-2 border-white flex items-center justify-center text-[9px] font-black text-slate-500 shadow-xs z-0">
                                  +{po.additionalCount}
                                </div>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold leading-tight">{po.totalTypes} loại vật tư</span>
                          </div>
                        </td>

                        {/* Cost */}
                        <td className="px-6 py-5 font-black text-xs text-slate-800">
                          {formatCurrency(po.totalCost)}
                        </td>

                        {/* Create Date */}
                        <td className="px-6 py-5">
                          <div className="flex flex-col text-xs font-medium text-slate-700">
                            <span className="font-bold text-slate-800">{po.dateDisplay}</span>
                            <span className="text-[10px] text-slate-400 font-bold mt-0.5">{po.timeDisplay}</span>
                          </div>
                        </td>

                        {/* Status badge */}
                        <td className="px-6 py-5">
                          {po.originalStatus === 'completed' || completedPOIds.includes(po.id) ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                              Đã nhận đủ hàng
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                              Đã đặt hàng (Chờ nhập)
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {(() => {
                              const isPOCompleted = po.originalStatus === 'completed' || completedPOIds.includes(po.id);
                              if (isPOCompleted) {
                                return (
                                  <button
                                    id={`btn-view-detail-${po.id}`}
                                    onClick={() => {
                                      if (po.isReal) {
                                        onOpenDocument(po.id, 'muahang', `Đơn ${po.id}`);
                                      } else {
                                        alert(`Chi tiết phiếu mua hàng giả lập #${po.id}`);
                                      }
                                    }}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all border border-slate-200 cursor-pointer hover:shadow-xs active:scale-95"
                                  >
                                    Xem chi tiết
                                  </button>
                                );
                              }

                              return (
                                <>
                                  <button
                                    id={`btn-view-detail-${po.id}`}
                                    onClick={() => {
                                      if (po.isReal) {
                                        onOpenDocument(po.id, 'muahang', `Đơn ${po.id}`);
                                      } else {
                                        alert(`Chi tiết phiếu mua hàng giả lập #${po.id}`);
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer hover:shadow-xs"
                                  >
                                    Xem chi tiết
                                  </button>
                                  <button
                                    onClick={() => handleOpenImportModal(po)}
                                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 font-bold"
                                  >
                                    Nhập kho
                                  </button>
                                </>
                              );
                            })()}
                          </div>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Row - Identical structure to Image */}
            <div id="po-pagination-row" className="px-6 py-4 border-t border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
              
              {/* Left summary count */}
              <div id="pagination-summary-left" className="text-xs text-slate-500 font-semibold">
                Hiển thị <span className="font-bold text-slate-800">{indexOfFirstItem + 1}</span> - <span className="font-bold text-slate-800">{Math.min(indexOfLastItem, totalItems)}</span> của <span className="font-bold text-slate-800">{totalItems}</span> đơn mua hàng
              </div>

              {/* Center pagination control buttons */}
              <div id="pagination-nav-center" className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {getPageNumbers().map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (typeof p === 'number') setCurrentPage(p);
                    }}
                    disabled={p === '...'}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                      p === currentPage 
                        ? 'bg-blue-600 text-white shadow-xs scale-105' 
                        : p === '...'
                          ? 'text-slate-400 cursor-default'
                          : 'border border-slate-150 text-slate-600 hover:bg-slate-50/80'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Right Page Size selector */}
              <div id="pagination-size-right" className="relative shrink-0">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="appearance-none pl-4 pr-10 py-1.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer shadow-xs"
                >
                  <option value={5}>5 / trang</option>
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              </div>

            </div>

          </div>

        </div>
      )}

      {/* VIEW PANEL 2: KỸ THUẬT TRẢ VẬT TƯ (Beautiful & fully functional) */}
      {activeSource === 'tech_return' && (
        <div id="tech-return-panel" className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center gap-3">
            <ClipboardCheck className="h-6 w-6 text-emerald-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Xác nhận kỹ thuật trả lại vật tư thừa</h3>
              <p className="text-xs text-slate-500 font-bold mt-0.5">Xử lý nhập kho hoàn trả các thiết bị chưa lắp đặt của các tổ thợ thi công</p>
            </div>
          </div>

          <form onSubmit={handleTechReturnSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Tên Kỹ thuật viên / Tổ trưởng hoàn trả *</label>
                <input 
                  type="text"
                  required
                  placeholder="Nhập tên kỹ thuật viên (ví dụ: Nguyễn Văn Hải)..."
                  value={techName}
                  onChange={(e) => setTechName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Chọn Thiết bị / Vật tư hoàn trả *</label>
                <select
                  required
                  value={techEquipmentId}
                  onChange={(e) => setTechEquipmentId(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs cursor-pointer"
                >
                  <option value="">-- Lựa chọn thiết bị hoàn trả --</option>
                  {equipment.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.brand} {eq.model} (Hiện có: {eq.stock} {eq.unit})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Số lượng hoàn trả *</label>
                  <input 
                    type="number"
                    min={1}
                    required
                    value={techQty}
                    onChange={(e) => setTechQty(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Đơn vị tính</label>
                  <div className="px-4 py-3.5 rounded-xl bg-slate-100 border border-slate-200 font-extrabold text-xs text-slate-500 text-center">
                    {equipment.find(e => e.id === techEquipmentId)?.unit || 'Cái'}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Lý do hoàn trả & Tên công trình</label>
                <textarea 
                  rows={4}
                  placeholder="Ví dụ: Thừa 2 bộ inverter sau khi bàn giao dự án hộ dân tại Biên Hòa, Đồng Nai..."
                  value={techReason}
                  onChange={(e) => setTechReason(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="h-4.5 w-4.5" />
                Xác nhận nhận trả & Đồng bộ kho
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VIEW PANEL 3: NHẬP TỒN ĐẦU KỲ (Beautiful & fully functional) */}
      {activeSource === 'initial_stock' && (
        <div id="initial-stock-panel" className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-purple-600" />
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Nhập số liệu hàng tồn kho đầu kỳ</h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">Đồng bộ số dư tồn kho đầu kỳ cho danh mục thiết bị solar</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Hình ảnh / Loại</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Hãng sản xuất</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Tên Thiết bị / Model</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Tồn kho hiện tại</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Tồn kho đầu kỳ mới</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {equipment.map(eq => (
                  <tr key={eq.id} className="hover:bg-slate-50/30">
                    <td className="px-6 py-4">
                      <MaterialIcon type={eq.type || 'other'} />
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">{eq.brand}</td>
                    <td className="px-6 py-4 font-bold text-slate-950">{eq.model}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-700 font-black rounded-lg">
                        {eq.stock || 0} {eq.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input 
                        type="number"
                        min={0}
                        placeholder="Số lượng đầu kỳ..."
                        value={initialStockUpdates[eq.id] !== undefined ? initialStockUpdates[eq.id] : ''}
                        onChange={(e) => setInitialStockUpdates({
                          ...initialStockUpdates,
                          [eq.id]: e.target.value === '' ? 0 : Number(e.target.value)
                        })}
                        className="w-28 px-3 py-1.5 rounded-lg border border-slate-200 text-center font-extrabold text-xs"
                      />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleSaveInitialStock(eq.id)}
                        className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                      >
                        Đồng bộ số dư
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Import Receipt (Popup) */}
      {showAddModal && (
        <div id="import-receipt-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col justify-between max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                Lập phiếu nhập kho & Tăng tồn kho
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitReceipt} className="p-8 space-y-5 overflow-y-auto flex-1">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Supplier selection */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Đối tác / Nhà cung cấp *</label>
                  <select
                    required
                    value={formSupplierId}
                    onChange={(e) => setFormSupplierId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  >
                    <option value="">-- Chọn Nhà cung cấp --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    {/* Simulated suppliers as fallback */}
                    <option value="SUP001">Công ty TNHH ABC</option>
                    <option value="SUP002">Công ty CP Thiết bị điện DEF</option>
                    <option value="SUP003">Công ty TNHH GHI</option>
                    <option value="SUP004">Công ty VLXD JKL</option>
                    <option value="SUP005">Công ty TNHH MNO</option>
                  </select>
                </div>

                {/* Import Notes */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Ghi chú phiếu nhập</label>
                  <input 
                    type="text"
                    placeholder="Ví dụ: Nhập kho theo HĐ hoặc nhập bổ sung..."
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>

              </div>

              {/* Items Picker Grid */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">Lựa chọn vật tư nhập kho</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Equipment Selector Catalogue */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Danh mục thiết bị</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl divide-y divide-slate-50">
                      {equipment.map(eq => (
                        <div key={eq.id} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-blue-600 block leading-none">{eq.brand}</span>
                            <span className="font-bold text-slate-800">{eq.model}</span>
                            <span className="text-[9px] text-slate-400 font-bold block mt-1">Tồn hiện tại: {eq.stock || 0} {eq.unit}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddItem(eq.id)}
                            className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50 active:scale-95 cursor-pointer"
                          >
                            Chọn
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Picked Items Form Details */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Danh sách chọn ({formItems.length})</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl p-2 space-y-2">
                      {formItems.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center text-slate-400 italic text-[11px] font-semibold p-4">
                          Chọn thiết bị ở cột trái để thêm vào phiếu nhập kho.
                        </div>
                      ) : (
                        formItems.map((item, idx) => {
                          const eq = equipment.find(e => e.id === item.equipmentId);
                          return (
                            <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-2 text-xs">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-bold text-slate-800 line-clamp-1">{eq?.brand} {eq?.model}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Số lượng nhập</label>
                                  <input 
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                                    className="w-full px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Đơn giá nhập</label>
                                  <input 
                                    type="number"
                                    min={0}
                                    value={item.unitPrice}
                                    onChange={(e) => handlePriceChange(idx, Number(e.target.value))}
                                    className="w-full px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs bg-white"
                                  />
                                </div>
                              </div>
                              <p className="text-[9px] text-right font-black text-slate-400 uppercase pt-1">
                                Thành tiền: <span className="text-slate-700">{formatCurrency(item.quantity * item.unitPrice)}</span>
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Payments & Debt calculation */}
              {formItems.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Tổng trị giá nhập kho:</span>
                    <span className="text-slate-950 font-black">{formatCurrency(calculateTotalValue())}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Đã thanh toán (VND)</label>
                      <input 
                        type="number"
                        min={0}
                        max={calculateTotalValue()}
                        value={formPaidAmount}
                        onChange={(e) => setFormPaidAmount(Number(e.target.value))}
                        className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Ghi nợ nhà cung cấp</label>
                      <div className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 font-extrabold text-xs text-rose-600">
                        {formatCurrency(Math.max(0, calculateTotalValue() - formPaidAmount))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </form>

            {/* Modal Buttons Footer */}
            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                id="btn-close-import-modal"
                onClick={() => setShowAddModal(false)}
                className="bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                id="btn-submit-import-receipt"
                onClick={handleSubmitReceipt}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Ký duyệt & Nhập kho
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
