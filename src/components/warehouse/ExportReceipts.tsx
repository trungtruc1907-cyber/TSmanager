import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  X, 
  ArrowDownLeft, 
  Calendar, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  ClipboardList, 
  Printer, 
  Trash2, 
  Eye,
  FileSpreadsheet,
  Briefcase,
  ShoppingCart,
  Database,
  ArrowRight,
  ArrowLeft,
  User,
  Building,
  CheckCircle2,
  Trash,
  Info,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, increment, deleteDoc, onSnapshot, getDocs } from 'firebase/firestore';
import { InventoryTransaction, Equipment, WarehouseSupplier } from './types';
import { AppUser } from '../../types';

interface ExportReceiptsProps {
  transactions: InventoryTransaction[];
  equipment: Equipment[];
  onOpenDocument: (id: string, type: 'pn' | 'px' | 'dexuat' | 'muahang', label: string) => void;
  userId: string;
  activeSourceExternal?: 'construction_export' | 'commercial_export' | 'disposal_export' | null;
  onCloseForm?: (skipConfirm?: boolean) => void;
  onOpenFormTab?: (sourceType: 'construction_export' | 'commercial_export' | 'disposal_export') => void;
}

export default function ExportReceipts({ 
  transactions, 
  equipment, 
  onOpenDocument,
  userId,
  activeSourceExternal,
  onCloseForm,
  onOpenFormTab
}: ExportReceiptsProps) {
  
  // Tab/Source States: 'construction_export' | 'commercial_export' | 'disposal_export' | null
  const [localActiveSource, setLocalActiveSource] = useState<'construction_export' | 'commercial_export' | 'disposal_export' | null>(null);
  const activeSource = activeSourceExternal !== undefined ? activeSourceExternal : localActiveSource;
  const setActiveSource = (val: 'construction_export' | 'commercial_export' | 'disposal_export' | null) => {
    if (activeSourceExternal !== undefined) {
      if (val === null) {
        if (onCloseForm) onCloseForm(false);
      }
    } else {
      setLocalActiveSource(val);
    }
  };

  const handleCloseThisForm = (skipConfirm = false) => {
    if (onCloseForm) {
      onCloseForm(skipConfirm);
    } else {
      setLocalActiveSource(null);
    }
  };

  // Db lists
  const [users, setUsers] = useState<AppUser[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<WarehouseSupplier[]>([]);

  // Filter States for history
  const [exportSearchTerm, setExportSearchTerm] = useState('');
  const [exportCurrentPage, setExportCurrentPage] = useState(1);
  const [exportPageSize, setExportPageSize] = useState(10);

  // View & Print Modals
  const [selectedTxForView, setSelectedTxForView] = useState<InventoryTransaction | null>(null);
  const [selectedTxForPrint, setSelectedTxForPrint] = useState<InventoryTransaction | null>(null);

  // POS 1: Xuất kho thi công States
  const [constItems, setConstItems] = useState<Array<{ equipmentId: string, quantity: number }>>([]);
  const [constProjectId, setConstProjectId] = useState('');
  const [constProjectSearch, setConstProjectSearch] = useState('');
  const [isConstProjectDropdownOpen, setIsConstProjectDropdownOpen] = useState(false);
  const [constSearchTerm, setConstSearchTerm] = useState('');
  const [constStaff, setConstStaff] = useState('');
  const [constNote, setConstNote] = useState('');
  const [constReceiptId, setConstReceiptId] = useState('');

  // POS 2: Xuất kho thương mại States
  const [commItems, setCommItems] = useState<Array<{ equipmentId: string, quantity: number, unitPrice: number }>>([]);
  const [commCustomerId, setCommCustomerId] = useState('');
  const [commCustomerSearch, setCommCustomerSearch] = useState('');
  const [isCommCustomerDropdownOpen, setIsCommCustomerDropdownOpen] = useState(false);
  const [commSearchTerm, setCommSearchTerm] = useState('');
  const [commStaff, setCommStaff] = useState('');
  const [commNote, setCommNote] = useState('');
  const [commReceiptId, setCommReceiptId] = useState('');
  const [commPaidAmount, setCommPaidAmount] = useState(0);

  // POS 3: Xuất hủy States
  const [dispItems, setDispItems] = useState<Array<{ equipmentId: string, quantity: number }>>([]);
  const [dispSearchTerm, setDispSearchTerm] = useState('');
  const [dispStaff, setDispStaff] = useState('');
  const [dispReason, setDispReason] = useState('Thiết bị lỗi, hỏng hóc trong quá trình thi công / lưu kho');
  const [dispReceiptId, setDispReceiptId] = useState('');

  // Thêm nhanh vật tư (Quick Add Equipment) States
  const [showQuickAddEquipModal, setShowQuickAddEquipModal] = useState(false);
  const [quickEquipBrand, setQuickEquipBrand] = useState('');
  const [quickEquipModel, setQuickEquipModel] = useState('');
  const [quickEquipType, setQuickEquipType] = useState('inverter');
  const [quickEquipUnit, setQuickEquipUnit] = useState('Cái');
  const [quickEquipPrice, setQuickEquipPrice] = useState(0);

  // Thêm nhanh khách hàng (Quick Add Customer) States
  const [showQuickAddCustomerModal, setShowQuickAddCustomerModal] = useState(false);
  const [quickCustName, setQuickCustName] = useState('');
  const [quickCustPhone, setQuickCustPhone] = useState('');
  const [quickCustEmail, setQuickCustEmail] = useState('');
  const [quickCustAddress, setQuickCustAddress] = useState('');
  const [quickCustDebt, setQuickCustDebt] = useState(0);

  // Listen / Fetch initial database records
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => {
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const unsubProjects = onSnapshot(collection(db, 'projects'), (s) => {
      setProjects(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error fetching projects:', error);
    });

    const unsubCustomers = onSnapshot(collection(db, 'customers'), (s) => {
      setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('Error fetching customers:', error);
    });

    const unsubSuppliers = onSnapshot(collection(db, 'suppliers'), (s) => {
      setSuppliers(s.docs.map(d => ({ id: d.id, ...d.data() } as WarehouseSupplier)));
    }, (error) => {
      console.error('Error fetching suppliers:', error);
    });

    return () => {
      unsubUsers();
      unsubProjects();
      unsubCustomers();
      unsubSuppliers();
    };
  }, []);

  // Filter list of eligible employees: admin, operator (kỹ thuật), accountant (kế toán)
  const staffList = useMemo(() => {
    const filtered = users.filter(u => u.role === 'admin' || u.role === 'operator' || u.role === 'accountant');
    if (filtered.length === 0) {
      return [
        { id: '1', displayName: 'Chống Thấm 36', username: 'Chống Thấm 36', role: 'admin' } as any,
        { id: '2', displayName: 'Thủ kho Solar', username: 'Thủ kho Solar', role: 'operator' } as any,
        { id: '3', displayName: 'Kỹ thuật Hoàng', username: 'Kỹ thuật Hoàng', role: 'operator' } as any,
        { id: '4', displayName: 'Admin', username: 'Admin', role: 'admin' } as any
      ];
    }
    return filtered;
  }, [users]);

  // Set default staff once list is loaded
  useEffect(() => {
    if (staffList.length > 0) {
      const defaultName = staffList[0].displayName || staffList[0].username || 'Nhân viên';
      setConstStaff(defaultName);
      setCommStaff(defaultName);
      setDispStaff(defaultName);
    }
  }, [staffList]);

  // Generate receipt IDs when form opens
  useEffect(() => {
    if (activeSource === 'construction_export' && !constReceiptId) {
      setConstReceiptId(generateReceiptId('PX-TC'));
    }
    if (activeSource === 'commercial_export' && !commReceiptId) {
      setCommReceiptId(generateReceiptId('PX-TM'));
    }
    if (activeSource === 'disposal_export' && !dispReceiptId) {
      setDispReceiptId(generateReceiptId('PX-HUY'));
    }
  }, [activeSource]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Generate unique ID helper
  const generateReceiptId = (prefix: string) => {
    return `${prefix}-${Math.floor(100000 + Math.random() * 899999)}`;
  };

  // Open Form Handlers
  const handleOpenConstructionExport = () => {
    if (onOpenFormTab) {
      onOpenFormTab('construction_export');
    } else {
      setActiveSource('construction_export');
      setConstItems([]);
      setConstProjectId('');
      setConstProjectSearch('');
      setConstNote('');
      setConstReceiptId(generateReceiptId('PX-TC'));
    }
  };

  const handleOpenCommercialExport = () => {
    if (onOpenFormTab) {
      onOpenFormTab('commercial_export');
    } else {
      setActiveSource('commercial_export');
      setCommItems([]);
      setCommCustomerId('');
      setCommCustomerSearch('');
      setCommNote('');
      setCommPaidAmount(0);
      setCommReceiptId(generateReceiptId('PX-TM'));
    }
  };

  const handleOpenDisposalExport = () => {
    if (onOpenFormTab) {
      onOpenFormTab('disposal_export');
    } else {
      setActiveSource('disposal_export');
      setDispItems([]);
      setDispReason('Thiết bị lỗi, hỏng hóc trong quá trình thi công / lưu kho');
      setDispReceiptId(generateReceiptId('PX-HUY'));
    }
  };

  // Autocomplete Projects for Construction
  const selectedProjectObj = useMemo(() => {
    return projects.find(p => p.id === constProjectId);
  }, [constProjectId, projects]);

  const filteredProjects = useMemo(() => {
    const q = constProjectSearch.toLowerCase().trim();
    if (!q) return projects;
    return projects.filter(p => {
      const customerObj = customers.find(c => c.id === p.customerId);
      const customerPhone = customerObj ? (customerObj.phone || '') : '';
      return (
        (p.customerName || '').toLowerCase().includes(q) ||
        (p.projectName || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q) ||
        (p.customerPhone || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q) ||
        customerPhone.toLowerCase().includes(q)
      );
    });
  }, [constProjectSearch, projects, customers]);

  // Autocomplete Customers for Commercial
  const selectedCustomerObj = useMemo(() => {
    return customers.find(c => c.id === commCustomerId);
  }, [commCustomerId, customers]);

  const filteredCustomers = useMemo(() => {
    const q = commCustomerSearch.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter(c => 
      (c.fullName || c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      (c.id || '').toLowerCase().includes(q)
    );
  }, [commCustomerSearch, customers]);

  // General Filter for Export Transactions
  const exportTxList = useMemo(() => {
    return transactions
      .filter(tx => tx.type === 'export' || tx.id.startsWith('PX-'))
      .filter(tx => {
        if (!exportSearchTerm) return true;
        const term = exportSearchTerm.toLowerCase();
        return (
          (tx.id || '').toLowerCase().includes(term) ||
          (tx.partnerName || '').toLowerCase().includes(term) ||
          (tx.note || '').toLowerCase().includes(term) ||
          (tx.createdByName || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
  }, [transactions, exportSearchTerm]);

  // Pagination calculations
  const totalPages = Math.ceil(exportTxList.length / exportPageSize) || 1;
  const paginatedExportTx = useMemo(() => {
    const startIdx = (exportCurrentPage - 1) * exportPageSize;
    return exportTxList.slice(startIdx, startIdx + exportPageSize);
  }, [exportTxList, exportCurrentPage, exportPageSize]);

  // Submit Construction Export
  const handleSubmitConstructionExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!constProjectId) {
      alert('Vui lòng chọn dự án / công trình thi công!');
      return;
    }
    if (constItems.length === 0) {
      alert('Vui lòng thêm ít nhất 1 vật tư thiết bị vào phiếu xuất!');
      return;
    }

    // Double check stock constraints
    for (const item of constItems) {
      const eq = equipment.find(e => e.id === item.equipmentId);
      if (!eq) continue;
      if (item.quantity > (eq.stock || 0)) {
        alert(`Sản phẩm ${eq.brand} ${eq.model} không đủ hàng tồn kho! Hiện tại chỉ còn ${eq.stock || 0} ${eq.unit}.`);
        return;
      }
    }

    try {
      const proj = projects.find(p => p.id === constProjectId);
      const projLabel = proj ? `${proj.customerName || 'KH Solar'} (Hòa lưới ${proj.systemSizeKWp || 5}kWp)` : 'Dự án Solar';
      
      const totalValue = constItems.reduce((sum, item) => {
        const eq = equipment.find(e => e.id === item.equipmentId);
        return sum + (item.quantity * (eq?.sellingPrice || eq?.unitPrice || 0));
      }, 0);

      const finalReceiptId = constReceiptId.trim() || generateReceiptId('PX-TC');

      const payload: InventoryTransaction = {
        id: finalReceiptId,
        type: 'export',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        partnerId: constProjectId,
        partnerName: projLabel,
        totalValue: totalValue,
        note: constNote.trim() || 'Xuất kho cấp phát vật tư thi công dự án điện mặt trời',
        createdBy: userId,
        createdByName: constStaff,
        items: constItems.map(item => {
          const eq = equipment.find(e => e.id === item.equipmentId);
          return {
            equipmentId: item.equipmentId,
            brand: eq?.brand || 'Chưa rõ',
            model: eq?.model || 'Thiết bị',
            type: eq?.type || 'other',
            quantity: item.quantity,
            unitPrice: eq?.sellingPrice || eq?.unitPrice || 0,
            unit: eq?.unit || 'Cái'
          };
        })
      };

      // 1. Save slip
      await setDoc(doc(db, 'inventory_transactions', finalReceiptId), payload);

      // 2. Decrement Stock in Firestore
      for (const item of constItems) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(-item.quantity)
        });
      }

      alert(`Lập phiếu xuất kho thi công thành công! Mã phiếu: #${finalReceiptId}`);
      handleCloseThisForm(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  // Submit Commercial Export
  const handleSubmitCommercialExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commCustomerId && !commCustomerSearch.trim()) {
      alert('Vui lòng chọn hoặc nhập tên khách hàng / đối tác bán lẻ!');
      return;
    }
    if (commItems.length === 0) {
      alert('Vui lòng thêm ít nhất 1 mặt hàng vào giỏ xuất bán!');
      return;
    }

    // Double check stock constraints
    for (const item of commItems) {
      const eq = equipment.find(e => e.id === item.equipmentId);
      if (!eq) continue;
      if (item.quantity > (eq.stock || 0)) {
        alert(`Sản phẩm ${eq.brand} ${eq.model} không đủ hàng tồn kho! Hiện tại chỉ còn ${eq.stock || 0} ${eq.unit}.`);
        return;
      }
    }

    try {
      const clientName = selectedCustomerObj ? (selectedCustomerObj.fullName || selectedCustomerObj.name) : commCustomerSearch.trim();
      const totalValue = commItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

      const finalReceiptId = commReceiptId.trim() || generateReceiptId('PX-TM');

      const payload: InventoryTransaction = {
        id: finalReceiptId,
        type: 'export',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        partnerId: commCustomerId || 'GUEST',
        partnerName: clientName,
        totalValue: totalValue,
        paidAmount: commPaidAmount,
        debtAmount: Math.max(0, totalValue - commPaidAmount),
        note: commNote.trim() || 'Xuất bán thương mại sản phẩm điện mặt trời',
        createdBy: userId,
        createdByName: commStaff,
        items: commItems.map(item => {
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

      // 1. Save slip
      await setDoc(doc(db, 'inventory_transactions', finalReceiptId), payload);

      // 2. Decrement stock
      for (const item of commItems) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(-item.quantity)
        });
      }

      // 3. Update customer liability if any debt is remaining and it's a real database customer
      const debtAmount = totalValue - commPaidAmount;
      if (debtAmount > 0 && commCustomerId) {
        const custRef = doc(db, 'customers', commCustomerId);
        await updateDoc(custRef, {
          debt: increment(debtAmount)
        });
      }

      alert(`Lập phiếu xuất kho thương mại bán hàng thành công! Mã phiếu: #${finalReceiptId}`);
      handleCloseThisForm(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  // Quick Add Customer Save
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName.trim() || !quickCustPhone.trim()) {
      alert('Vui lòng nhập đầy đủ Tên khách hàng và Số điện thoại!');
      return;
    }

    try {
      const custId = 'CUST' + Math.floor(1000 + Math.random() * 9000);
      const payload: any = {
        id: custId,
        name: quickCustName.trim(),
        phone: quickCustPhone.trim(),
        email: quickCustEmail.trim() || null,
        address: quickCustAddress.trim() || null,
        customerType: 'commercial',
        debt: Number(quickCustDebt) || 0,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'customers', custId), payload);
      
      // Auto-select this newly created customer
      setCommCustomerId(custId);
      setCommCustomerSearch(payload.name);

      // Reset form states
      setQuickCustName('');
      setQuickCustPhone('');
      setQuickCustEmail('');
      setQuickCustAddress('');
      setQuickCustDebt(0);
      setShowQuickAddCustomerModal(false);

      alert(`Thêm nhanh khách hàng "${payload.name}" thành công và đã tự động chọn.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'customers');
    }
  };

  // Submit Disposal Export
  const handleSubmitDisposalExport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dispItems.length === 0) {
      alert('Vui lòng chọn ít nhất 1 thiết bị cần xuất hủy!');
      return;
    }

    // Double check stock constraints
    for (const item of dispItems) {
      const eq = equipment.find(e => e.id === item.equipmentId);
      if (!eq) continue;
      if (item.quantity > (eq.stock || 0)) {
        alert(`Sản phẩm ${eq.brand} ${eq.model} không đủ hàng tồn kho! Hiện tại chỉ còn ${eq.stock || 0} ${eq.unit}.`);
        return;
      }
    }

    try {
      const totalValue = dispItems.reduce((sum, item) => {
        const eq = equipment.find(e => e.id === item.equipmentId);
        return sum + (item.quantity * (eq?.sellingPrice || eq?.unitPrice || 0));
      }, 0);

      const finalReceiptId = dispReceiptId.trim() || generateReceiptId('PX-HUY');

      const payload: InventoryTransaction = {
        id: finalReceiptId,
        type: 'export',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        partnerId: 'DISPOSAL_DEPT',
        partnerName: 'Hội đồng thanh lý / Xuất Hủy',
        totalValue: totalValue,
        note: `Xuất hủy thiết bị. Lý do: ${dispReason}`,
        createdBy: userId,
        createdByName: dispStaff,
        items: dispItems.map(item => {
          const eq = equipment.find(e => e.id === item.equipmentId);
          return {
            equipmentId: item.equipmentId,
            brand: eq?.brand || 'Chưa rõ',
            model: eq?.model || 'Thiết bị',
            type: eq?.type || 'other',
            quantity: item.quantity,
            unitPrice: eq?.sellingPrice || eq?.unitPrice || 0,
            unit: eq?.unit || 'Cái'
          };
        })
      };

      // 1. Save slip
      await setDoc(doc(db, 'inventory_transactions', finalReceiptId), payload);

      // 2. Decrement Stock
      for (const item of dispItems) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(-item.quantity)
        });
      }

      alert(`Đã hoàn tất lập phiếu xuất hủy và thanh lý vật tư hỏng! Mã phiếu: #${finalReceiptId}`);
      handleCloseThisForm(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  // Quick Add Equipment
  const handleQuickAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEquipBrand || !quickEquipModel) {
      alert('Vui lòng nhập đầy đủ hãng và model.');
      return;
    }
    try {
      const newId = 'EQ' + Math.floor(1000 + Math.random() * 9000);
      const payload = {
        id: newId,
        brand: quickEquipBrand.trim(),
        model: quickEquipModel.trim(),
        type: quickEquipType,
        unit: quickEquipUnit,
        unitPrice: Number(quickEquipPrice) || 0,
        stock: 0,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'equipment', newId), payload);
      alert(`Đã thêm thành công vật tư ${quickEquipBrand} ${quickEquipModel}!`);
      setShowQuickAddEquipModal(false);

      // Add to corresponding active POS list automatically for convenience
      if (activeSource === 'construction_export') {
        setConstItems(prev => [...prev, { equipmentId: newId, quantity: 1 }]);
      } else if (activeSource === 'commercial_export') {
        setCommItems(prev => [...prev, { equipmentId: newId, quantity: 1, unitPrice: Number(quickEquipPrice) || 0 }]);
      } else if (activeSource === 'disposal_export') {
        setDispItems(prev => [...prev, { equipmentId: newId, quantity: 1 }]);
      }

      // Reset
      setQuickEquipBrand('');
      setQuickEquipModel('');
      setQuickEquipPrice(0);
    } catch (err) {
      console.error(err);
      alert('Lỗi khi thêm vật tư.');
    }
  };

  // Delete transaction handler
  const handleDeleteTransaction = async (txId: string, items: any[]) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa phiếu xuất #${txId}? Thao tác này sẽ KHÔNG tự động hoàn kho. Vui lòng cân nhắc!`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'inventory_transactions', txId));
      alert(`Đã xóa thành công phiếu xuất #${txId}!`);
    } catch (error) {
      console.error(error);
      alert('Có lỗi xảy ra khi xóa phiếu.');
    }
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    if (exportTxList.length === 0) {
      alert('Không có dữ liệu phiếu xuất để xuất Excel.');
      return;
    }
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "Mã Phiếu,Loại Xuất,Đối Tác / Dự Án,Ngày Xuất,Người Lập,Tổng Giá Trị,Ghi Chú\n";
    
    exportTxList.forEach(tx => {
      const typeLabel = tx.id.includes('PX-TC') ? "Xuất thi công" : tx.id.includes('PX-TM') ? "Xuất thương mại" : "Xuất hủy";
      const partner = (tx.partnerName || '').replace(/,/g, ' - ');
      const note = (tx.note || '').replace(/,/g, ' - ');
      csvContent += `${tx.id},${typeLabel},${partner},${tx.date},${tx.createdByName || 'Thủ kho Solar'},${tx.totalValue},${note}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Lich_Su_Xuat_Kho_Solar_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="export-receipts-container" className="space-y-8 font-sans">
      
      {/* Title Header */}
      {activeSource === null && (
        <div id="export-header-section" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="space-y-1">
            <h1 id="export-main-title" className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-rose-600" />
              Xuất kho vật tư
            </h1>
            <p id="export-sub-title" className="text-slate-500 text-xs font-semibold">
              Chọn một phương thức xuất kho Solar để thực hiện lập phiếu mới hoặc truy vấn lịch sử phiếu xuất
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-export-csv-list"
              onClick={handleExportCSV}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Xuất Excel lịch sử
            </button>
          </div>
        </div>
      )}

      {/* THREE EXPORT SOURCE CARDS */}
      {activeSource === null && (
        <div id="export-sources-selection-container" className="space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Nguồn xuất kho chính</h3>
            <span className="text-[11px] text-slate-400 font-bold">Chọn phương án xuất kho phù hợp để mở giao diện POS lập nhanh</span>
          </div>
          
          <div id="export-sources-row" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            
            {/* Card 1: Xuất kho thi công */}
            <div 
              id="source-card-construction-export"
              onClick={handleOpenConstructionExport}
              className="p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex items-center gap-4 border-slate-100 bg-white hover:border-blue-500 hover:bg-slate-50/50 hover:shadow-lg group"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all bg-blue-50 text-blue-600 group-hover:scale-105">
                <Briefcase className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-xs tracking-wide">Xuất kho thi công</h4>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Cấp phát tấm pin, inverter, tủ điện thi công công trình</p>
              </div>
            </div>

            {/* Card 2: Xuất kho thương mại */}
            <div 
              id="source-card-commercial-export"
              onClick={handleOpenCommercialExport}
              className="p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex items-center gap-4 border-slate-100 bg-white hover:border-emerald-500 hover:bg-slate-50/50 hover:shadow-lg group"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all bg-emerald-50 text-emerald-600 group-hover:scale-105">
                <ShoppingCart className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-xs tracking-wide">Xuất kho thương mại</h4>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Xuất bán sỉ, lẻ thiết bị cho đại lý hoặc khách hàng mua lẻ</p>
              </div>
            </div>

            {/* Card 3: Xuất hủy */}
            <div 
              id="source-card-disposal-export"
              onClick={handleOpenDisposalExport}
              className="p-6 rounded-[2rem] border-2 transition-all cursor-pointer flex items-center gap-4 border-slate-100 bg-white hover:border-rose-500 hover:bg-slate-50/50 hover:shadow-lg group"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all bg-rose-50 text-rose-600 group-hover:scale-105">
                <Trash2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-xs tracking-wide">Xuất hủy / Thanh lý</h4>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Xuất loại bỏ phế liệu, thiết bị lỗi hỏng không thể phục hồi</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* SEARCH AND HISTORIC LIST TABLE */}
      {activeSource === null && (
        <div id="export-history-section" className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Lịch sử phiếu xuất kho</h3>
            <span className="text-[11px] text-slate-400 font-bold">Tìm thấy {exportTxList.length} phiếu xuất kho</span>
          </div>

          {/* Search bar */}
          <div className="bg-white rounded-[2rem] p-4 border border-slate-100 shadow-xs flex items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Tìm phiếu xuất theo mã phiếu, dự án thi công, ghi chú hoặc tên người xuất..."
                value={exportSearchTerm}
                onChange={(e) => {
                  setExportSearchTerm(e.target.value);
                  setExportCurrentPage(1);
                }}
                className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium text-xs text-slate-700"
              />
              {exportSearchTerm && (
                <button
                  onClick={() => setExportSearchTerm('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-xs">
            <div className="overflow-x-auto font-sans">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Mã phiếu / Phân loại</th>
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Đối tượng tiếp nhận</th>
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Vật tư xuất kho</th>
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Giá trị vốn xuất</th>
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Ngày xuất</th>
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Người lập</th>
                    <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {paginatedExportTx.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-20 text-slate-400 text-xs italic font-semibold bg-white">
                        Không tìm thấy phiếu xuất kho nào phù hợp với bộ lọc tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    paginatedExportTx.map((tx) => {
                      // Determine type label & badge
                      const isConst = tx.id.startsWith('PX-TC');
                      const isComm = tx.id.startsWith('PX-TM');
                      const isDisp = tx.id.startsWith('PX-HUY');
                      
                      let badgeColor = "bg-blue-50 border-blue-100 text-blue-700";
                      let badgeText = "Thi công";
                      if (isComm) {
                        badgeColor = "bg-emerald-50 border-emerald-100 text-emerald-700";
                        badgeText = "Thương mại";
                      } else if (isDisp) {
                        badgeColor = "bg-rose-50 border-rose-100 text-rose-700";
                        badgeText = "Xuất hủy";
                      }

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/50 transition-all font-sans">
                          <td className="px-6 py-5 font-mono">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-extrabold text-slate-900 text-xs">#{tx.id}</span>
                              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border w-fit ${badgeColor}`}>
                                {badgeText}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-1.5">
                              {isConst && <Briefcase className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                              {isComm && <ShoppingCart className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                              {isDisp && <Trash2 className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                              <span className="font-extrabold text-xs text-slate-800 truncate max-w-[200px]">{tx.partnerName}</span>
                            </div>
                            {tx.note && (
                              <p className="text-[10px] text-slate-400 mt-1 truncate max-w-[200px] font-bold italic">
                                "{tx.note}"
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-5">
                            <div className="space-y-1 max-w-[220px]">
                              {tx.items?.slice(0, 2).map((item, i) => (
                                <div key={i} className="text-[11px] font-bold text-slate-600 truncate">
                                  • {item.brand} {item.model}: <span className="font-extrabold text-slate-900">{item.quantity} {item.unit}</span>
                                </div>
                              ))}
                              {tx.items?.length > 2 && (
                                <span className="text-[9px] font-black uppercase text-slate-400 block">Và {tx.items.length - 2} dòng thiết bị khác...</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right font-black text-xs text-slate-900">
                            {formatCurrency(tx.totalValue)}
                          </td>
                          <td className="px-6 py-5 text-xs font-semibold text-slate-400">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-slate-300" />
                              <span>{tx.date}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-xs font-bold text-slate-700">
                            {tx.createdByName || 'Thủ kho Solar'}
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setSelectedTxForView(tx)}
                                className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
                                title="Xem chi tiết"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setSelectedTxForPrint(tx)}
                                className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg transition-all cursor-pointer"
                                title="In phiếu xuất"
                              >
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTransaction(tx.id, tx.items)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg transition-all cursor-pointer"
                                title="Xóa phiếu"
                              >
                                <Trash2 className="h-4 w-4" />
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

            {/* Pagination footer */}
            {totalPages > 1 && (
              <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between font-sans text-xs">
                <span className="text-slate-500 font-bold">
                  Trang <span className="font-extrabold text-slate-800">{exportCurrentPage}</span> trên <span className="font-extrabold text-slate-800">{totalPages}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={exportCurrentPage === 1}
                    onClick={() => setExportCurrentPage(p => Math.max(1, p - 1))}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4 text-slate-600" />
                  </button>
                  <button
                    disabled={exportCurrentPage === totalPages}
                    onClick={() => setExportCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4 text-slate-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* ----------------------------------------------------------- */}
      {/* POS VIEW 1: XUẤT KHO THI CÔNG */}
      {/* ----------------------------------------------------------- */}
      {activeSource === 'construction_export' && (
        <div id="pos-construction-export-view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Left Block: Search Equipment & Cart (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Header Block with Back button */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
              <button
                type="button"
                onClick={() => handleCloseThisForm(false)}
                className="p-2 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200 cursor-pointer active:scale-95"
                title="Quay lại danh sách"
              >
                <ArrowLeft className="h-4 w-4 text-slate-700" />
              </button>
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-blue-600" />
                    Lập Phiếu Xuất Kho Thi Công
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold block">Xuất kho cấp phát vật tư thi công cho công trình Solar</p>
                </div>
                
                {/* Search Goods Input */}
                <div className="relative w-full sm:w-80">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={constSearchTerm}
                    onChange={(e) => setConstSearchTerm(e.target.value)}
                    placeholder="Tìm thiết bị theo mô tả (từ khóa)..."
                    className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowQuickAddEquipModal(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors"
                    title="Thêm nhanh vật tư mới"
                  >
                    <Plus className="h-3 w-3" />
                  </button>

                  {/* Search Autocomplete Panel */}
                  {constSearchTerm.trim() !== '' && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-55 max-h-52 overflow-y-auto divide-y divide-slate-50">
                      {equipment
                        .filter(eq => {
                          const keywords = constSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
                          const searchableText = `${eq.brand || ''} ${eq.model || ''} ${eq.id || ''} ${eq.type || ''} ${eq.details || ''} ${eq.location || ''} ${eq.unit || ''} ${(eq as any).description || ''} ${eq.supplier || ''}`.toLowerCase();
                          return keywords.every(kw => searchableText.includes(kw));
                        })
                        .map(eq => {
                          const isOutOfStock = (eq.stock || 0) <= 0;
                          return (
                            <div 
                              key={eq.id}
                              onClick={() => {
                                if (isOutOfStock) {
                                  alert('Thiết bị này đã hết hàng tồn kho, không thể xuất!');
                                  return;
                                }
                                const exists = constItems.find(item => item.equipmentId === eq.id);
                                if (exists) {
                                  if (exists.quantity >= (eq.stock || 0)) {
                                    alert(`Chỉ có thể chọn tối đa ${eq.stock} ${eq.unit} trong kho.`);
                                    return;
                                  }
                                  setConstItems(constItems.map(item => item.equipmentId === eq.id ? { ...item, quantity: item.quantity + 1 } : item));
                                } else {
                                  setConstItems([...constItems, { equipmentId: eq.id, quantity: 1 }]);
                                }
                                setConstSearchTerm('');
                              }}
                              className={`p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs ${isOutOfStock ? 'opacity-50' : ''}`}
                            >
                              <div>
                                <span className="font-extrabold text-slate-800 block">{eq.brand} {eq.model}</span>
                                <span className="text-[9px] text-slate-400 font-bold">Mã: {eq.id} | Tồn: <span className={isOutOfStock ? 'text-red-500 font-black' : 'text-slate-600 font-bold'}>{eq.stock || 0}</span> {eq.unit}</span>
                              </div>
                              <span className="font-black text-blue-600">{formatCurrency(eq.sellingPrice || eq.unitPrice || 0)}</span>
                            </div>
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cart list containing selected items for Construction Export */}
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-xs min-h-[400px] flex flex-col justify-between">
              
              {constItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-3 font-sans">
                  <div className="w-16 h-16 rounded-full bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-400">
                    <Database className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-700">Chưa có vật tư nào được chọn</p>
                    <p className="text-[10px] text-slate-400 font-bold max-w-sm mt-1">
                      Hãy gõ tìm kiếm nhanh tất cả từ khóa mô tả sản phẩm ở thanh tìm kiếm phía trên để chọn vật tư đưa vào phiếu xuất thi công.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 divide-y divide-slate-100 font-sans text-xs">
                  <div className="grid grid-cols-12 gap-4 pb-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <div className="col-span-6">Thiết bị / Mô tả</div>
                    <div className="col-span-3 text-center">Số lượng cấp phát</div>
                    <div className="col-span-2 text-right">Giá trị tạm tính</div>
                    <div className="col-span-1 text-center">Xóa</div>
                  </div>
                  
                  <div className="space-y-3 pt-3 overflow-y-auto max-h-[450px] pr-1">
                    {constItems.map((item, idx) => {
                      const eq = equipment.find(e => e.id === item.equipmentId);
                      const maxStock = eq?.stock || 0;
                      return (
                        <div key={item.equipmentId} className="grid grid-cols-12 gap-4 items-center py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 px-2 rounded-xl">
                          <div className="col-span-6">
                            <span className="text-[9px] font-black text-blue-600 block leading-none">{eq?.brand}</span>
                            <span className="font-extrabold text-slate-800 text-xs block mt-1">{eq?.model}</span>
                            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Mã: {eq?.id} | Tồn hiện tại: <span className="text-emerald-600 font-extrabold">{maxStock} {eq?.unit}</span></span>
                          </div>
                          
                          <div className="col-span-3">
                            <div className="flex items-center justify-center gap-1.5 max-w-[120px] mx-auto">
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.quantity > 1) {
                                    const newItems = [...constItems];
                                    newItems[idx].quantity -= 1;
                                    setConstItems(newItems);
                                  }
                                }}
                                className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 active:scale-95 cursor-pointer"
                              >
                                -
                              </button>
                              <input 
                                type="number"
                                min={1}
                                max={maxStock}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (val < 1) return;
                                  if (val > maxStock) {
                                    alert(`Kho chỉ còn tối đa ${maxStock} sản phẩm.`);
                                    return;
                                  }
                                  const newItems = [...constItems];
                                  newItems[idx].quantity = val;
                                  setConstItems(newItems);
                                }}
                                className="w-12 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center font-extrabold text-xs text-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.quantity < maxStock) {
                                    const newItems = [...constItems];
                                    newItems[idx].quantity += 1;
                                    setConstItems(newItems);
                                  } else {
                                    alert(`Đã đạt giới hạn tối đa tồn kho của mặt hàng này.`);
                                  }
                                }}
                                className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 active:scale-95 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="col-span-2 text-right font-extrabold text-slate-800 text-xs">
                            {formatCurrency(item.quantity * (eq?.sellingPrice || eq?.unitPrice || 0))}
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => setConstItems(constItems.filter(i => i.equipmentId !== item.equipmentId))}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Total Value Bar */}
              {constItems.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between font-sans">
                  <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Tổng giá trị vật tư cấp phát:</span>
                  <span className="text-lg font-black text-[#0054a6]">
                    {formatCurrency(constItems.reduce((sum, i) => {
                      const eq = equipment.find(e => e.id === i.equipmentId);
                      return sum + (i.quantity * (eq?.sellingPrice || eq?.unitPrice || 0));
                    }, 0))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Block: Project & Staff Select details (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-xs font-sans text-xs">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-3 mb-4">
                Thông tin phiếu xuất thi công
              </h3>
              
              <form onSubmit={handleSubmitConstructionExport} className="space-y-4">
                {/* Receipt Code Display */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Mã Phiếu</label>
                  <input
                    type="text"
                    disabled
                    value={constReceiptId}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 font-mono font-bold text-slate-500 text-xs"
                  />
                </div>

                {/* Choose Employee / Staff linked to accountants, technicians, and admin */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Nhân viên tiếp quản / bàn giao <span className="text-red-500">*</span></label>
                  <select
                    value={constStaff}
                    onChange={(e) => setConstStaff(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer"
                  >
                    {staffList.map(u => {
                      const name = u.displayName || u.username || 'Nhân viên';
                      const roleLabel = u.role === 'admin' ? 'Admin' : u.role === 'operator' ? 'Kỹ thuật' : 'Kế toán';
                      return (
                        <option key={u.id} value={name}>
                          {name} ({roleLabel})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Searchable Autocomplete Project Selection */}
                <div className="space-y-1.5 relative">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Chọn công trình thi công <span className="text-red-500">*</span></label>
                  
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="🔍 Tìm nhanh tên công trình / KH..."
                      value={isConstProjectDropdownOpen ? constProjectSearch : (selectedProjectObj ? `${selectedProjectObj.customerName || 'KH Solar'} (${selectedProjectObj.systemSizeKWp || 5}kWp)` : '')}
                      onChange={(e) => {
                        setConstProjectSearch(e.target.value);
                        setIsConstProjectDropdownOpen(true);
                      }}
                      onFocus={() => {
                        setConstProjectSearch('');
                        setIsConstProjectDropdownOpen(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setIsConstProjectDropdownOpen(false);
                        }, 250);
                      }}
                      className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700"
                    />
                    <Briefcase className="absolute left-3 h-3.5 w-3.5 text-slate-400" />
                    {constProjectId && (
                      <button
                        type="button"
                        onClick={() => {
                          setConstProjectId('');
                          setConstProjectSearch('');
                        }}
                        className="absolute right-3 hover:bg-slate-200 p-0.5 rounded-full text-slate-400 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {isConstProjectDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                      {filteredProjects.length === 0 ? (
                        <div className="px-3 py-2 text-slate-400 text-xs italic">Không tìm thấy công trình nào</div>
                      ) : (
                        filteredProjects.map(p => {
                          const customerObj = customers.find(c => c.id === p.customerId);
                          const customerPhone = p.customerPhone || p.phone || (customerObj ? customerObj.phone : '');
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setConstProjectId(p.id);
                                setConstProjectSearch(`${p.customerName} (Hòa lưới ${p.systemSizeKWp || 5}kWp)`);
                                setIsConstProjectDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex flex-col gap-0.5 border-b border-slate-50 last:border-b-0 cursor-pointer ${
                                constProjectId === p.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                              }`}
                            >
                              <span className="font-bold text-xs">{p.customerName || 'KH Solar'}</span>
                              <span className="text-[10px] text-slate-500">
                                Quy mô: Hòa lưới {p.systemSizeKWp || 5}kWp
                                {customerPhone && ` | SĐT: ${customerPhone}`}
                                {p.address && ` | Địa chỉ: ${p.address}`}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Note / Description */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Ghi chú phiếu xuất</label>
                  <textarea
                    rows={3}
                    placeholder="VD: Xuất 10 tấm pin Solar Jinko và Biến tần phục vụ thi công lắp mái điện cho hộ dân..."
                    value={constNote}
                    onChange={(e) => setConstNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCloseThisForm(false)}
                    className="w-1/2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 bg-[#0054a6] hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center active:scale-95 shadow-md"
                  >
                    Lập phiếu
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


      {/* ----------------------------------------------------------- */}
      {/* POS VIEW 2: XUẤT KHO THƯƠNG MẠI (XUẤT BÁN) */}
      {/* ----------------------------------------------------------- */}
      {activeSource === 'commercial_export' && (
        <div id="pos-commercial-export-view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Left Block: Search Equipment & Cart (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Header Block with Back button */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
              <button
                type="button"
                onClick={() => handleCloseThisForm(false)}
                className="p-2 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200 cursor-pointer active:scale-95"
                title="Quay lại danh sách"
              >
                <ArrowLeft className="h-4 w-4 text-slate-700" />
              </button>
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-emerald-600" />
                    Lập Phiếu Xuất Bán Thương Mại
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold block">Xuất kho bán hàng lẻ, buôn thiết bị Solar trực tiếp cho khách hàng</p>
                </div>
                
                {/* Search Goods Input */}
                <div className="relative w-full sm:w-80">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={commSearchTerm}
                    onChange={(e) => setCommSearchTerm(e.target.value)}
                    placeholder="Tìm thiết bị Solar theo mô tả..."
                    className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowQuickAddEquipModal(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer transition-colors"
                    title="Thêm nhanh vật tư mới"
                  >
                    <Plus className="h-3 w-3" />
                  </button>

                  {/* Search Autocomplete Panel */}
                  {commSearchTerm.trim() !== '' && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-55 max-h-52 overflow-y-auto divide-y divide-slate-50">
                      {equipment
                        .filter(eq => {
                          const keywords = commSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
                          const searchableText = `${eq.brand || ''} ${eq.model || ''} ${eq.id || ''} ${eq.type || ''} ${eq.details || ''} ${eq.location || ''} ${eq.unit || ''} ${(eq as any).description || ''} ${eq.supplier || ''}`.toLowerCase();
                          return keywords.every(kw => searchableText.includes(kw));
                        })
                        .map(eq => {
                          const isOutOfStock = (eq.stock || 0) <= 0;
                          return (
                            <div 
                              key={eq.id}
                              onClick={() => {
                                if (isOutOfStock) {
                                  alert('Thiết bị này đã hết hàng trong kho!');
                                  return;
                                }
                                const exists = commItems.find(item => item.equipmentId === eq.id);
                                if (exists) {
                                  if (exists.quantity >= (eq.stock || 0)) {
                                    alert(`Chỉ có thể chọn tối đa ${eq.stock} sản phẩm.`);
                                    return;
                                  }
                                  setCommItems(commItems.map(item => item.equipmentId === eq.id ? { ...item, quantity: item.quantity + 1 } : item));
                                } else {
                                  setCommItems([...commItems, { equipmentId: eq.id, quantity: 1, unitPrice: eq.sellingPrice || eq.unitPrice || 2000000 }]);
                                }
                                setCommSearchTerm('');
                              }}
                              className={`p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs ${isOutOfStock ? 'opacity-50' : ''}`}
                            >
                              <div>
                                <span className="font-extrabold text-slate-800 block">{eq.brand} {eq.model}</span>
                                <span className="text-[9px] text-slate-400 font-bold">Mã: {eq.id} | Tồn kho: <span className="text-emerald-600 font-extrabold">{eq.stock || 0} {eq.unit}</span></span>
                              </div>
                              <span className="font-black text-emerald-600">{formatCurrency(eq.sellingPrice || eq.unitPrice || 0)}</span>
                            </div>
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cart list containing selected items for Commercial Export */}
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-xs min-h-[400px] flex flex-col justify-between">
              
              {commItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-3 font-sans">
                  <div className="w-16 h-16 rounded-full bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-400">
                    <ShoppingCart className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-700">Giỏ hàng xuất bán trống</p>
                    <p className="text-[10px] text-slate-400 font-bold max-w-sm mt-1">
                      Hãy tìm kiếm nhanh các thiết bị Solar và thêm vào đây để tính tiền & làm giảm kho.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 divide-y divide-slate-100 font-sans text-xs">
                  <div className="grid grid-cols-12 gap-4 pb-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <div className="col-span-4">Mặt hàng xuất bán</div>
                    <div className="col-span-3 text-center">Đơn giá bán (VND)</div>
                    <div className="col-span-2 text-center">Số lượng bán</div>
                    <div className="col-span-2 text-right">Thành tiền</div>
                    <div className="col-span-1 text-center">Xóa</div>
                  </div>
                  
                  <div className="space-y-3 pt-3 overflow-y-auto max-h-[450px] pr-1">
                    {commItems.map((item, idx) => {
                      const eq = equipment.find(e => e.id === item.equipmentId);
                      const maxStock = eq?.stock || 0;
                      return (
                        <div key={item.equipmentId} className="grid grid-cols-12 gap-4 items-center py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 px-2 rounded-xl">
                          <div className="col-span-4">
                            <span className="text-[9px] font-black text-emerald-600 block leading-none">{eq?.brand}</span>
                            <span className="font-extrabold text-slate-800 text-xs block mt-1">{eq?.model}</span>
                            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Kho hiện tại còn: <span className="text-emerald-600 font-extrabold">{maxStock} {eq?.unit}</span></span>
                          </div>
                          
                          <div className="col-span-3">
                            <input 
                              type="number"
                              min={0}
                              value={item.unitPrice}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const newItems = [...commItems];
                                newItems[idx].unitPrice = val;
                                setCommItems(newItems);
                              }}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-center font-extrabold text-xs text-slate-800"
                            />
                          </div>

                          <div className="col-span-2">
                            <div className="flex items-center justify-center gap-1 mx-auto">
                              <input 
                                type="number"
                                min={1}
                                max={maxStock}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (val < 1) return;
                                  if (val > maxStock) {
                                    alert(`Kho chỉ còn tối đa ${maxStock} sản phẩm.`);
                                    return;
                                  }
                                  const newItems = [...commItems];
                                  newItems[idx].quantity = val;
                                  setCommItems(newItems);
                                }}
                                className="w-16 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-center font-extrabold text-xs text-slate-800"
                              />
                              <span className="text-[10px] text-slate-400 font-bold">{eq?.unit || 'Cái'}</span>
                            </div>
                          </div>

                          <div className="col-span-2 text-right font-black text-slate-800 text-xs">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => setCommItems(commItems.filter(i => i.equipmentId !== item.equipmentId))}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Total Value Bar */}
              {commItems.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between font-sans">
                  <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Tổng giá trị doanh thu xuất bán:</span>
                  <span className="text-lg font-black text-emerald-600">
                    {formatCurrency(commItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Block: Customer Select & Invoice fields (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-xs font-sans text-xs">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-3 mb-4">
                Thông tin xuất bán thương mại
              </h3>
              
              <form onSubmit={handleSubmitCommercialExport} className="space-y-4">
                {/* Receipt Code Display */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Mã Phiếu</label>
                  <input
                    type="text"
                    disabled
                    value={commReceiptId}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 font-mono font-bold text-slate-500 text-xs"
                  />
                </div>

                {/* Staff Linkage */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Nhân viên tiếp quản xuất kho <span className="text-red-500">*</span></label>
                  <select
                    value={commStaff}
                    onChange={(e) => setCommStaff(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer"
                  >
                    {staffList.map(u => {
                      const name = u.displayName || u.username || 'Nhân viên';
                      const roleLabel = u.role === 'admin' ? 'Admin' : u.role === 'operator' ? 'Kỹ thuật' : 'Kế toán';
                      return (
                        <option key={u.id} value={name}>
                          {name} ({roleLabel})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Searchable Autocomplete Customer Selection */}
                <div className="space-y-1.5 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Chọn khách hàng có sẵn <span className="text-slate-400 font-bold">(hoặc tự nhập tay)</span></label>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddCustomerModal(true)}
                      className="text-[10px] font-black text-[#0054a6] hover:text-blue-700 uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Thêm nhanh
                    </button>
                  </div>
                  
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="🔍 Tìm nhanh sđt / tên khách..."
                      value={isCommCustomerDropdownOpen ? commCustomerSearch : (selectedCustomerObj ? `${selectedCustomerObj.fullName || selectedCustomerObj.name}` : commCustomerSearch)}
                      onChange={(e) => {
                        setCommCustomerSearch(e.target.value);
                        setIsCommCustomerDropdownOpen(true);
                      }}
                      onFocus={() => {
                        setCommCustomerSearch('');
                        setIsCommCustomerDropdownOpen(true);
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          setIsCommCustomerDropdownOpen(false);
                        }, 250);
                      }}
                      className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700"
                    />
                    <Building className="absolute left-3 h-3.5 w-3.5 text-slate-400" />
                    {(commCustomerId || commCustomerSearch) && (
                      <button
                        type="button"
                        onClick={() => {
                          setCommCustomerId('');
                          setCommCustomerSearch('');
                        }}
                        className="absolute right-3 hover:bg-slate-200 p-0.5 rounded-full text-slate-400 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {isCommCustomerDropdownOpen && (
                    <div className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg">
                      {filteredCustomers.length === 0 ? (
                        <div className="px-3 py-2 text-slate-400 text-xs italic">Không có khách hàng trùng khớp, nhập tay vào ô trên</div>
                      ) : (
                        filteredCustomers.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCommCustomerId(c.id);
                              setCommCustomerSearch(c.fullName || c.name);
                              setIsCommCustomerDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex flex-col gap-0.5 border-b border-slate-50 last:border-b-0 cursor-pointer ${
                              commCustomerId === c.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                            }`}
                          >
                            <span className="font-bold text-xs">{c.fullName || c.name}</span>
                            <span className="text-[10px] text-slate-500">SĐT: {c.phone || 'Chưa cập nhật'} | Nợ cũ: <span className="text-red-500 font-bold">{formatCurrency(c.debt || 0)}</span></span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Khách đã trả (VND)</label>
                    <input
                      type="number"
                      min={0}
                      value={commPaidAmount || ''}
                      onChange={(e) => setCommPaidAmount(Number(e.target.value))}
                      placeholder="VD: 5000000"
                      className="w-full px-3 py-2 bg-white border border-slate-250 rounded-xl font-bold text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 pt-1">
                    <span>Ghi nhận công nợ mới:</span>
                    <span className="text-rose-600 font-black">
                      {formatCurrency(Math.max(0, commItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0) - commPaidAmount))}
                    </span>
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Ghi chú phiếu bán hàng</label>
                  <textarea
                    rows={2}
                    placeholder="VD: Khách hàng mua trực tiếp tại quầy thanh toán tiền mặt..."
                    value={commNote}
                    onChange={(e) => setCommNote(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCloseThisForm(false)}
                    className="w-1/2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center active:scale-95 shadow-md"
                  >
                    Bán & Xuất kho
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


      {/* ----------------------------------------------------------- */}
      {/* POS VIEW 3: XUẤT KHO HỦY (TIÊU HỦY / THANH LÝ) */}
      {/* ----------------------------------------------------------- */}
      {activeSource === 'disposal_export' && (
        <div id="pos-disposal-export-view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in slide-in-from-bottom-4 duration-300">
          
          {/* Left Block: Search Equipment & Cart (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* Header Block with Back button */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
              <button
                type="button"
                onClick={() => handleCloseThisForm(false)}
                className="p-2 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200 cursor-pointer active:scale-95"
                title="Quay lại danh sách"
              >
                <ArrowLeft className="h-4 w-4 text-slate-700" />
              </button>
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Trash2 className="h-5 w-5 text-rose-600" />
                    Lập Phiếu Xuất Hủy / Tiêu Hủy
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold block">Xuất kho loại bỏ các trang thiết bị Solar hỏng hóc, lỗi kỹ thuật hoặc hao mòn phế liệu</p>
                </div>
                
                {/* Search Goods Input */}
                <div className="relative w-full sm:w-80">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={dispSearchTerm}
                    onChange={(e) => setDispSearchTerm(e.target.value)}
                    placeholder="Tìm thiết bị để xuất hủy..."
                    className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowQuickAddEquipModal(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer transition-colors"
                    title="Thêm nhanh vật tư mới"
                  >
                    <Plus className="h-3 w-3" />
                  </button>

                  {/* Search Autocomplete Panel */}
                  {dispSearchTerm.trim() !== '' && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-55 max-h-52 overflow-y-auto divide-y divide-slate-50">
                      {equipment
                        .filter(eq => {
                          const keywords = dispSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
                          const searchableText = `${eq.brand || ''} ${eq.model || ''} ${eq.id || ''} ${eq.type || ''} ${eq.details || ''} ${eq.location || ''} ${eq.unit || ''} ${(eq as any).description || ''} ${eq.supplier || ''}`.toLowerCase();
                          return keywords.every(kw => searchableText.includes(kw));
                        })
                        .map(eq => {
                          const isOutOfStock = (eq.stock || 0) <= 0;
                          return (
                            <div 
                              key={eq.id}
                              onClick={() => {
                                if (isOutOfStock) {
                                  alert('Thiết bị này không còn hàng tồn trong kho!');
                                  return;
                                }
                                const exists = dispItems.find(item => item.equipmentId === eq.id);
                                if (exists) {
                                  if (exists.quantity >= (eq.stock || 0)) {
                                    alert(`Chỉ có thể chọn tối đa ${eq.stock} sản phẩm.`);
                                    return;
                                  }
                                  setDispItems(dispItems.map(item => item.equipmentId === eq.id ? { ...item, quantity: item.quantity + 1 } : item));
                                } else {
                                  setDispItems([...dispItems, { equipmentId: eq.id, quantity: 1 }]);
                                }
                                setDispSearchTerm('');
                              }}
                              className={`p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs ${isOutOfStock ? 'opacity-50' : ''}`}
                            >
                              <div>
                                <span className="font-extrabold text-slate-800 block">{eq.brand} {eq.model}</span>
                                <span className="text-[9px] text-slate-400 font-bold">Mã: {eq.id} | Tồn hiện tại: <span className="text-red-500 font-black">{eq.stock || 0} {eq.unit}</span></span>
                              </div>
                              <span className="font-black text-rose-600">{formatCurrency(eq.sellingPrice || eq.unitPrice || 0)}</span>
                            </div>
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Cart list containing selected items for Disposal Export */}
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-xs min-h-[400px] flex flex-col justify-between">
              
              {dispItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center space-y-3 font-sans">
                  <div className="w-16 h-16 rounded-full bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-400">
                    <Trash className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-700">Chưa có thiết bị nào được chọn để hủy</p>
                    <p className="text-[10px] text-slate-400 font-bold max-w-sm mt-1">
                      Hãy gõ tìm kiếm các vật tư Solar bị hỏng hóc hoặc thanh lý để đưa vào danh sách xuất hủy.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 divide-y divide-slate-100 font-sans text-xs">
                  <div className="grid grid-cols-12 gap-4 pb-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    <div className="col-span-6">Thiết bị hỏng hóc</div>
                    <div className="col-span-3 text-center">Số lượng hủy</div>
                    <div className="col-span-2 text-right">Trị giá tổn thất</div>
                    <div className="col-span-1 text-center">Xóa</div>
                  </div>
                  
                  <div className="space-y-3 pt-3 overflow-y-auto max-h-[450px] pr-1">
                    {dispItems.map((item, idx) => {
                      const eq = equipment.find(e => e.id === item.equipmentId);
                      const maxStock = eq?.stock || 0;
                      return (
                        <div key={item.equipmentId} className="grid grid-cols-12 gap-4 items-center py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 px-2 rounded-xl">
                          <div className="col-span-6">
                            <span className="text-[9px] font-black text-rose-600 block leading-none">{eq?.brand}</span>
                            <span className="font-extrabold text-slate-800 text-xs block mt-1">{eq?.model}</span>
                            <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Mã: {eq?.id} | Tồn: <span className="text-red-500 font-extrabold">{maxStock} {eq?.unit}</span></span>
                          </div>
                          
                          <div className="col-span-3">
                            <div className="flex items-center justify-center gap-1.5 max-w-[120px] mx-auto">
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.quantity > 1) {
                                    const newItems = [...dispItems];
                                    newItems[idx].quantity -= 1;
                                    setDispItems(newItems);
                                  }
                                }}
                                className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 active:scale-95 cursor-pointer"
                              >
                                -
                              </button>
                              <input 
                                type="number"
                                min={1}
                                max={maxStock}
                                value={item.quantity}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (val < 1) return;
                                  if (val > maxStock) {
                                    alert(`Kho chỉ còn tối đa ${maxStock} sản phẩm.`);
                                    return;
                                  }
                                  const newItems = [...dispItems];
                                  newItems[idx].quantity = val;
                                  setDispItems(newItems);
                                }}
                                className="w-12 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center font-extrabold text-xs text-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (item.quantity < maxStock) {
                                    const newItems = [...dispItems];
                                    newItems[idx].quantity += 1;
                                    setDispItems(newItems);
                                  } else {
                                    alert(`Không thể chọn vượt quá số lượng hàng hiện có trong kho.`);
                                  }
                                }}
                                className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 active:scale-95 cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="col-span-2 text-right font-extrabold text-rose-600 text-xs">
                            {formatCurrency(item.quantity * (eq?.sellingPrice || eq?.unitPrice || 0))}
                          </div>

                          <div className="col-span-1 text-center">
                            <button
                              type="button"
                              onClick={() => setDispItems(dispItems.filter(i => i.equipmentId !== item.equipmentId))}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Total Value Bar */}
              {dispItems.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between font-sans">
                  <span className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4 text-rose-500 animate-pulse" />
                    Tổng giá trị xuất hủy:
                  </span>
                  <span className="text-lg font-black text-rose-600">
                    {formatCurrency(dispItems.reduce((sum, i) => {
                      const eq = equipment.find(e => e.id === i.equipmentId);
                      return sum + (i.quantity * (eq?.sellingPrice || eq?.unitPrice || 0));
                    }, 0))}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Block: Staff & Reason details (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-xs font-sans text-xs">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-3 mb-4">
                Thông tin hội đồng xuất hủy
              </h3>
              
              <form onSubmit={handleSubmitDisposalExport} className="space-y-4">
                {/* Receipt Code Display */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Mã Phiếu</label>
                  <input
                    type="text"
                    disabled
                    value={dispReceiptId}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-100 font-mono font-bold text-slate-500 text-xs"
                  />
                </div>

                {/* Staff Selection */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Trưởng hội đồng kiểm duyệt <span className="text-red-500">*</span></label>
                  <select
                    value={dispStaff}
                    onChange={(e) => setDispStaff(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer"
                  >
                    {staffList.map(u => {
                      const name = u.displayName || u.username || 'Nhân viên';
                      const roleLabel = u.role === 'admin' ? 'Admin' : u.role === 'operator' ? 'Kỹ thuật' : 'Kế toán';
                      return (
                        <option key={u.id} value={name}>
                          {name} ({roleLabel})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Reason for Disposal */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Lý do thanh lý / hủy kho <span className="text-red-500">*</span></label>
                  <select
                    value={dispReason}
                    onChange={(e) => setDispReason(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer"
                  >
                    <option value="Thiết bị lỗi, hỏng hóc trong quá trình thi công / lưu kho">Thiết bị móp méo, vỡ tế bào quang điện (Cell) khi lưu kho</option>
                    <option value="Inverter bị hỏng bo mạch chính không thể sửa chữa bảo hành">Inverter bị chập cháy mạch chính, quá hạn bảo hành</option>
                    <option value="Phế liệu, dây cáp thi công cắt vụn dôi dư">Dây cáp, kẹp biên thừa vụn dôi dư dọn kho</option>
                    <option value="Thanh lý thiết bị cũ thu hồi của khách hàng nâng cấp">Thanh lý thu hồi thiết bị cũ của KH nâng cấp hệ thống</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleCloseThisForm(false)}
                    className="w-1/2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer text-center active:scale-95 shadow-md"
                  >
                    Duyệt & Hủy Kho
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}


      {/* ----------------------------------------------------------- */}
      {/* MODAL: VIEW DETAILED RECEIPT */}
      {/* ----------------------------------------------------------- */}
      {selectedTxForView && (
        <div id="view-tx-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] border border-slate-100 shadow-2xl p-8 flex flex-col justify-between max-h-[90vh]">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <FileText className="h-5 w-5 text-rose-500" />
                  Chi tiết phiếu xuất kho
                </h3>
                <p className="text-[11px] text-slate-400 font-black mt-1">SỐ PHIẾU: {selectedTxForView.id}</p>
              </div>
              <button 
                onClick={() => setSelectedTxForView(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 text-xs pr-1">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-sans">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Đối tượng tiếp nhận</span>
                  <span className="font-bold text-slate-900 text-sm block mt-0.5">{selectedTxForView.partnerName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Ngày xuất kho</span>
                  <span className="font-bold text-slate-900 text-sm block mt-0.5">{selectedTxForView.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Thủ kho bàn giao</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{selectedTxForView.createdByName || 'Thủ kho Solar'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Ghi chú phiếu</span>
                  <span className="font-bold text-slate-700 block mt-0.5">{selectedTxForView.note || 'Không có'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-2">Danh sách vật tư bàn giao</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {selectedTxForView.items.map((item, index) => (
                    <div key={index} className="p-3 flex justify-between items-center bg-white hover:bg-slate-50/50">
                      <div>
                        <span className="text-[9px] text-rose-600 uppercase font-extrabold block leading-none">{item.brand}</span>
                        <span className="font-bold text-slate-900 text-xs block mt-1">{item.model}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-slate-800 text-xs block">x{item.quantity} {item.unit}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Đơn giá xuất: {formatCurrency(item.unitPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 font-sans text-xs">
                <div className="flex justify-between font-bold text-slate-500">
                  <span>Tổng giá trị xuất kho:</span>
                  <span className="text-slate-900 font-black">{formatCurrency(selectedTxForView.totalValue)}</span>
                </div>
                {selectedTxForView.paidAmount !== undefined && (
                  <div className="flex justify-between font-bold text-emerald-600">
                    <span>Số tiền thu về (nếu có):</span>
                    <span>{formatCurrency(selectedTxForView.paidAmount)}</span>
                  </div>
                )}
                {selectedTxForView.debtAmount !== undefined && selectedTxForView.debtAmount > 0 ? (
                  <div className="flex justify-between font-bold text-rose-600">
                    <span>Ghi nhận nợ mới của KH:</span>
                    <span>{formatCurrency(selectedTxForView.debtAmount)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedTxForView(null)}
                className="bg-[#0054a6] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}


      {/* ----------------------------------------------------------- */}
      {/* MODAL: PRINT PREVIEW SLIP */}
      {/* ----------------------------------------------------------- */}
      {selectedTxForPrint && (
        <div id="print-tx-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] border border-slate-100 shadow-2xl p-8 flex flex-col justify-between my-8 animate-in zoom-in-95 duration-250">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Xem bản in phiếu xuất kho</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.print()}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="h-4 w-4" />
                  In ngay (Ctrl+P)
                </button>
                <button 
                  onClick={() => setSelectedTxForPrint(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Printable Area */}
            <div id="printable-invoice-paper" className="bg-white border border-slate-200 rounded-2xl p-8 text-black font-sans leading-relaxed text-xs">
              
              <div className="flex justify-between items-start border-b-2 border-slate-300 pb-6 mb-6">
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wide text-slate-900">CÔNG TY CỔ PHẦN ĐIỆN MẶT TRỜI SOLAR VIỆT NAM</h2>
                  <p className="text-slate-500 mt-1">Địa chỉ: Khu Công Nghệ Cao Quận 9, TP. Hồ Chí Minh</p>
                  <p className="text-slate-500">Điện thoại: 1900 6000 | Email: contact@solarvietnam.vn</p>
                </div>
                <div className="text-right">
                  <h1 className="text-lg font-black text-rose-600 tracking-wider">PHIẾU XUẤT KHO VẬT TƯ</h1>
                  <p className="text-slate-600 mt-1 font-bold">Số phiếu: {selectedTxForPrint.id}</p>
                  <p className="text-slate-400">Ngày xuất: {selectedTxForPrint.date}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6 text-xs border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div>
                  <span className="text-slate-400 uppercase font-bold block mb-1">ĐƠN VỊ TIẾP NHẬN (ĐỐI TÁC / DỰ ÁN)</span>
                  <span className="font-extrabold text-slate-900 text-sm block">{selectedTxForPrint.partnerName}</span>
                  <span className="text-slate-500 mt-1 block">Mã định danh: {selectedTxForPrint.partnerId}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold block mb-1">ĐƠN VỊ CẤP PHÁT (KHO HÀNG)</span>
                  <span className="font-extrabold text-slate-900 text-sm block">Kho tổng vật tư chính Solar Việt Nam</span>
                  <span className="text-slate-500 mt-1 block">Thủ kho bàn giao: {selectedTxForPrint.createdByName || 'Thủ kho Solar'}</span>
                </div>
              </div>

              <table className="w-full text-left border-collapse border border-slate-300 mb-6 font-sans">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="p-3 font-extrabold text-slate-800 border-r border-slate-300 text-center w-12">STT</th>
                    <th className="p-3 font-extrabold text-slate-800 border-r border-slate-300">Tên vật tư / Thiết bị Solar xuất bàn giao</th>
                    <th className="p-3 font-extrabold text-slate-800 border-r border-slate-300 text-center w-16">ĐVT</th>
                    <th className="p-3 font-extrabold text-slate-800 border-r border-slate-300 text-center w-20">Số lượng</th>
                    <th className="p-3 font-extrabold text-slate-800 border-r border-slate-300 text-right w-28">Đơn giá xuất</th>
                    <th className="p-3 font-extrabold text-slate-800 text-right w-32">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {selectedTxForPrint.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-3 text-center border-r border-slate-300 font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-3 border-r border-slate-300">
                        <span className="font-extrabold text-slate-900 block">{item.brand}</span>
                        <span className="text-slate-600 mt-0.5 block font-medium">{item.model}</span>
                      </td>
                      <td className="p-3 text-center border-r border-slate-300 font-bold text-slate-700">{item.unit}</td>
                      <td className="p-3 text-center border-r border-slate-300 font-black text-slate-900">{item.quantity}</td>
                      <td className="p-3 text-right border-r border-slate-300 font-semibold text-slate-700">{formatCurrency(item.unitPrice)}</td>
                      <td className="p-3 text-right font-black text-slate-900">{formatCurrency(item.quantity * item.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="w-1/2 ml-auto space-y-2 text-xs border border-slate-200 rounded-xl p-4 bg-slate-50/50 mb-8 font-sans">
                <div className="flex justify-between text-slate-500 font-bold">
                  <span>Trị giá xuất kho:</span>
                  <span className="text-slate-900 font-black">{formatCurrency(selectedTxForPrint.totalValue)}</span>
                </div>
                {selectedTxForPrint.paidAmount !== undefined && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Số tiền đã thu về:</span>
                    <span className="font-black">{formatCurrency(selectedTxForPrint.paidAmount)}</span>
                  </div>
                )}
                {selectedTxForPrint.debtAmount !== undefined && selectedTxForPrint.debtAmount > 0 ? (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Nợ ghi nhận của khách:</span>
                    <span className="font-black">{formatCurrency(selectedTxForPrint.debtAmount)}</span>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-4 text-center mt-12 pt-6 border-t border-slate-200 font-sans">
                <div>
                  <h4 className="font-extrabold text-slate-800">Người nhận hàng</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">(Ký, ghi rõ họ tên)</p>
                  <div className="h-20"></div>
                  <p className="font-bold text-slate-500">.................................</p>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800">Thủ kho bàn giao</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">(Ký, duyệt xuất kho)</p>
                  <div className="h-20"></div>
                  <p className="font-black text-slate-900">{selectedTxForPrint.createdByName || 'Thủ kho Solar'}</p>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800">Giám đốc duyệt</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">(Ký, đóng dấu công ty)</p>
                  <div className="h-20"></div>
                  <p className="font-bold text-slate-500">.................................</p>
                </div>
              </div>

            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedTxForPrint(null)}
                className="bg-[#0054a6] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Đóng bản xem trước
              </button>
            </div>

          </div>
        </div>
      )}


      {/* ----------------------------------------------------------- */}
      {/* MODAL: QUICK ADD NEW EQUIPMENT */}
      {/* ----------------------------------------------------------- */}
      {showQuickAddEquipModal && (
        <div id="quick-add-equipment-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-[2rem] border border-slate-100 shadow-2xl flex flex-col justify-between p-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 font-sans">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Thêm nhanh vật tư mới
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setShowQuickAddEquipModal(false);
                  setQuickEquipBrand('');
                  setQuickEquipModel('');
                  setQuickEquipPrice(0);
                  setQuickEquipType('inverter');
                  setQuickEquipUnit('Cái');
                }}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddEquipment} className="space-y-4 py-4 font-sans text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Hãng sản xuất <span className="text-red-500">*</span></label>
                  <input 
                    type="text"
                    required
                    placeholder="VD: Jinko, Growatt..."
                    value={quickEquipBrand}
                    onChange={(e) => setQuickEquipBrand(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Model thiết bị <span className="text-red-500">*</span></label>
                  <input 
                    type="text"
                    required
                    placeholder="VD: 550W, MIN 5000TL-X..."
                    value={quickEquipModel}
                    onChange={(e) => setQuickEquipModel(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Loại vật tư</label>
                  <select
                    value={quickEquipType}
                    onChange={(e) => setQuickEquipType(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer"
                  >
                    <option value="panel">Tấm pin Solar</option>
                    <option value="inverter">Biến tần Inverter</option>
                    <option value="battery">Pin lưu trữ</option>
                    <option value="mounting">Hệ khung giá đỡ</option>
                    <option value="accessory">Phụ kiện thi công</option>
                    <option value="other">Thiết bị khác</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Đơn vị tính</label>
                  <input 
                    type="text"
                    placeholder="VD: Cái, Tấm, Mét..."
                    value={quickEquipUnit}
                    onChange={(e) => setQuickEquipUnit(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Giá nhập tham khảo (VND)</label>
                <input 
                  type="number"
                  min={0}
                  placeholder="VD: 1500000"
                  value={quickEquipPrice || ''}
                  onChange={(e) => setQuickEquipPrice(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAddEquipModal(false);
                    setQuickEquipBrand('');
                    setQuickEquipModel('');
                    setQuickEquipPrice(0);
                    setQuickEquipType('inverter');
                    setQuickEquipUnit('Cái');
                  }}
                  className="bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-[#0054a6] hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                >
                  Tạo mới
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------- */}
      {/* MODAL: QUICK ADD NEW CUSTOMER */}
      {/* ----------------------------------------------------------- */}
      {showQuickAddCustomerModal && (
        <div id="quick-add-customer-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-[2rem] border border-slate-100 shadow-2xl flex flex-col justify-between p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 font-sans">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Thêm nhanh khách hàng mới
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setShowQuickAddCustomerModal(false);
                  setQuickCustName('');
                  setQuickCustPhone('');
                  setQuickCustEmail('');
                  setQuickCustAddress('');
                  setQuickCustDebt(0);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomer} className="space-y-4 py-4 font-sans text-xs">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Tên khách hàng / Đối tác <span className="text-red-500">*</span></label>
                <input 
                  type="text"
                  required
                  placeholder="VD: Nguyễn Văn A, Công ty Solar..."
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Số điện thoại <span className="text-red-500">*</span></label>
                  <input 
                    type="text"
                    required
                    placeholder="VD: 0912345678"
                    value={quickCustPhone}
                    onChange={(e) => setQuickCustPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Email (không bắt buộc)</label>
                  <input 
                    type="email"
                    placeholder="VD: khachhang@gmail.com"
                    value={quickCustEmail}
                    onChange={(e) => setQuickCustEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Địa chỉ</label>
                <input 
                  type="text"
                  placeholder="VD: 123 Đường ABC, Quận 1, TP. HCM"
                  value={quickCustAddress}
                  onChange={(e) => setQuickCustAddress(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Dư nợ ban đầu (VND - nếu có)</label>
                <input 
                  type="number"
                  min={0}
                  placeholder="VD: 0"
                  value={quickCustDebt || ''}
                  onChange={(e) => setQuickCustDebt(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAddCustomerModal(false);
                    setQuickCustName('');
                    setQuickCustPhone('');
                    setQuickCustEmail('');
                    setQuickCustAddress('');
                    setQuickCustDebt(0);
                  }}
                  className="bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="bg-[#0054a6] hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                >
                  Lưu khách hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
