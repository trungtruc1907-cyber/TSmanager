import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  X, 
  ArrowUpRight, 
  Calendar, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw, 
  ClipboardList, 
  Printer, 
  Trash2, 
  Edit, 
  Eye,
  FileSpreadsheet,
  ShoppingCart,
  ClipboardCheck,
  Database,
  ArrowRight,
  User,
  Building,
  CheckCircle2,
  Trash,
  ArrowLeft,
  Info,
  Upload
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, setDoc, updateDoc, increment, deleteDoc, collection, onSnapshot } from 'firebase/firestore';
import { InventoryTransaction, Equipment, WarehouseSupplier } from './types';
import { AppUser } from '../../types';

interface ImportReceiptsProps {
  transactions: InventoryTransaction[];
  equipment: Equipment[];
  suppliers: WarehouseSupplier[];
  onOpenDocument: (id: string, type: 'pn' | 'px' | 'dexuat' | 'muahang', label: string) => void;
  userId: string;
  purchaseProposals?: any[];
  activeSourceExternal?: 'import_goods' | 'supplier_return' | 'tech_return' | 'initial_stock' | null;
  onCloseForm?: (skipConfirm?: boolean) => void;
  onOpenFormTab?: (sourceType: 'import_goods' | 'supplier_return' | 'tech_return' | 'initial_stock') => void;
}

export default function ImportReceipts({ 
  transactions, 
  equipment, 
  suppliers, 
  onOpenDocument,
  userId,
  purchaseProposals = [],
  activeSourceExternal,
  onCloseForm,
  onOpenFormTab
}: ImportReceiptsProps) {
  
  // Tab/Source States
  const [localActiveSource, setLocalActiveSource] = useState<'import_goods' | 'supplier_return' | 'tech_return' | 'initial_stock' | null>(null);
  const activeSource = activeSourceExternal !== undefined ? activeSourceExternal : localActiveSource;
  const setActiveSource = (val: 'import_goods' | 'supplier_return' | 'tech_return' | 'initial_stock' | null) => {
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

  const [formProposalId, setFormProposalId] = useState('');

  // Filter States for history
  const [importedSearchTerm, setImportedSearchTerm] = useState('');
  const [importedCurrentPage, setImportedCurrentPage] = useState(1);
  const [importedPageSize, setImportedPageSize] = useState(10);

  // View, Print, Edit Modals
  const [selectedTxForView, setSelectedTxForView] = useState<InventoryTransaction | null>(null);
  const [selectedTxForPrint, setSelectedTxForPrint] = useState<InventoryTransaction | null>(null);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTxId, setEditingTxId] = useState('');
  const [editSupplierId, setEditSupplierId] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editPaidAmount, setEditPaidAmount] = useState(0);
  const [editItems, setEditItems] = useState<Array<{ equipmentId: string, quantity: number, unitPrice: number }>>([]);

  // Add Receipt Modal (Manual import)
  const [showAddModal, setShowAddModal] = useState(false);
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formPaidAmount, setFormPaidAmount] = useState(0);
  const [formItems, setFormItems] = useState<Array<{ equipmentId: string, quantity: number, unitPrice: number }>>([]);

  // POS Nhập hàng (import_goods) States
  const [posItems, setPosItems] = useState<Array<{ equipmentId: string, quantity: number, unitPrice: number }>>([]);
  const [posSupplierId, setPosSupplierId] = useState('');
  const [posPaidAmount, setPosPaidAmount] = useState(0);
  const [posSearchTerm, setPosSearchTerm] = useState('');
  const [posSupplierSearch, setPosSupplierSearch] = useState('');
  const [importStaff, setImportStaff] = useState('Chống Thấm 36');
  const [importReceiptId, setImportReceiptId] = useState('');
  const [importOrderCode, setImportOrderCode] = useState('');
  const [importStatus, setImportStatus] = useState('Phiếu tạm');
  const [importInvoiceNo, setImportInvoiceNo] = useState('');
  const [importNote, setImportNote] = useState('');

  // POS Trả hàng NCC (supplier_return) States
  const [returnItems, setReturnItems] = useState<Array<{ equipmentId: string, quantity: number, unitPrice: number }>>([]);
  const [returnSupplierId, setReturnSupplierId] = useState('');
  const [returnPaidAmount, setReturnPaidAmount] = useState(0); // NCC hoàn lại bằng tiền mặt
  const [returnReceiptId, setReturnReceiptId] = useState('');
  const [returnNote, setReturnNote] = useState('');
  const [returnSearchTerm, setReturnSearchTerm] = useState('');
  const [returnStaff, setReturnStaff] = useState('Chống Thấm 36');
  const [returnSupplierQuery, setReturnSupplierQuery] = useState('');
  const [isReturnSupplierDropdownOpen, setIsReturnSupplierDropdownOpen] = useState(false);

  // Thêm nhanh vật tư (Quick Add Equipment) States
  const [showQuickAddEquipModal, setShowQuickAddEquipModal] = useState(false);
  const [quickEquipBrand, setQuickEquipBrand] = useState('');
  const [quickEquipModel, setQuickEquipModel] = useState('');
  const [quickEquipType, setQuickEquipType] = useState('inverter');
  const [quickEquipUnit, setQuickEquipUnit] = useState('Cái');
  const [quickEquipPrice, setQuickEquipPrice] = useState(0);

  // Thêm nhanh nhà cung cấp (Quick Add Supplier) States
  const [showQuickAddSupplierModal, setShowQuickAddSupplierModal] = useState(false);
  const [quickSupName, setQuickSupName] = useState('');
  const [quickSupPhone, setQuickSupPhone] = useState('');
  const [quickSupAddress, setQuickSupAddress] = useState('');

  // Search & Filter state variables
  const [users, setUsers] = useState<AppUser[]>([]);
  const [supplierQuery, setSupplierQuery] = useState('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);

  // Technician Return Form States
  const [techName, setTechName] = useState('');
  const [techProject, setTechProject] = useState('');
  const [techReason, setTechReason] = useState('Dư thừa vật tư sau thi công');
  const [selectedTechEquipId, setSelectedTechEquipId] = useState('');
  const [techQtyToAdd, setTechQtyToAdd] = useState(1);
  const [techItems, setTechItems] = useState<Array<{ equipmentId: string, quantity: number }>>([]);

  // Initial Stock Form States
  const [selectedInitialEquipId, setSelectedInitialEquipId] = useState('');
  const [initialQtyToAdd, setInitialQtyToAdd] = useState(1);
  const [initialPriceToAdd, setInitialPriceToAdd] = useState(0);
  const [initialItems, setInitialItems] = useState<Array<{ equipmentId: string, quantity: number, unitPrice: number }>>([]);

  React.useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => {
      setUsers(s.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return () => unsubUsers();
  }, []);

  const importStaffList = React.useMemo(() => {
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Filter pending purchase proposals (status === 'approved' or 'ordering')
  const pendingProposals = React.useMemo(() => {
    return purchaseProposals.filter(p => p.status === 'approved' || p.status === 'ordering');
  }, [purchaseProposals]);

  const selectedSupplierObj = React.useMemo(() => {
    if (posSupplierId === 'INITIAL_STOCK') {
      return { id: 'INITIAL_STOCK', name: 'Nhập tồn đầu kỳ (Hệ thống)', phone: '', debt: 0 };
    }
    if (posSupplierId === 'TECH_RETURN') {
      return { id: 'TECH_RETURN', name: 'Kỹ thuật trả vật tư (Hệ thống)', phone: '', debt: 0 };
    }
    return suppliers.find(s => s.id === posSupplierId);
  }, [posSupplierId, suppliers]);

  const filteredSuppliers = React.useMemo(() => {
    const q = supplierQuery.toLowerCase().trim();
    const systemOptions = [
      { id: 'INITIAL_STOCK', name: 'Nhập tồn đầu kỳ (Hệ thống)', phone: '', debt: 0 },
      { id: 'TECH_RETURN', name: 'Kỹ thuật trả vật tư (Hệ thống)', phone: '', debt: 0 }
    ];
    const allOptions = [
      ...suppliers.map(s => ({ id: s.id, name: s.name, phone: s.phone || '', debt: s.debt || 0 })),
      ...systemOptions
    ];
    if (!q) return allOptions;
    return allOptions.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.phone && s.phone.toLowerCase().includes(q))
    );
  }, [supplierQuery, suppliers]);

  const selectedReturnSupplierObj = React.useMemo(() => {
    return suppliers.find(s => s.id === returnSupplierId);
  }, [returnSupplierId, suppliers]);

  const filteredReturnSuppliers = React.useMemo(() => {
    const q = returnSupplierQuery.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.phone && s.phone.toLowerCase().includes(q))
    );
  }, [returnSupplierQuery, suppliers]);

  React.useEffect(() => {
    if (importStaffList.length > 0) {
      const defaultUser = importStaffList[0];
      const defaultName = defaultUser.displayName || defaultUser.username || '';
      if (defaultName) {
        setImportStaff(defaultName);
        setReturnStaff(defaultName);
      }
    }
  }, [importStaffList]);

  // Filtered Imported List (type === 'import' or PX-TRA-...)
  const importedTxList = React.useMemo(() => {
    return transactions
      .filter(tx => tx.type === 'import' || tx.id.startsWith('PX-TRA'))
      .filter(tx => {
        if (!importedSearchTerm) return true;
        const term = importedSearchTerm.toLowerCase();
        
        // Search inside item descriptions
        const itemsMatch = tx.items.some(item => 
          (item.brand || '').toLowerCase().includes(term) ||
          (item.model || '').toLowerCase().includes(term)
        );

        return (
          tx.id.toLowerCase().includes(term) ||
          tx.partnerName.toLowerCase().includes(term) ||
          (tx.note && tx.note.toLowerCase().includes(term)) ||
          itemsMatch
        );
      })
      .sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  }, [transactions, importedSearchTerm]);

  // Pagination for Imported List
  const totalImportedItems = importedTxList.length;
  const importedTotalPages = Math.ceil(totalImportedItems / importedPageSize) || 1;
  const indexFirstImported = (importedCurrentPage - 1) * importedPageSize;
  const indexLastImported = indexFirstImported + importedPageSize;
  const currentImportedTx = importedTxList.slice(indexFirstImported, indexLastImported);

  // Helper page numbers for Imported List
  const getImportedPageNumbers = () => {
    const pages = [];
    for (let i = 1; i <= importedTotalPages; i++) {
      pages.push(i);
    }
    return pages;
  };

  // Add receipt handlers
  const handleAddItem = (equipmentId: string) => {
    if (formItems.some(item => item.equipmentId === equipmentId)) return;
    const eq = equipment.find(e => e.id === equipmentId);
    setFormItems([...formItems, { 
      equipmentId, 
      quantity: 1, 
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

  // Submit Receipt Action (Ký duyệt & Nhập kho)
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

      // 2. Loop & increment stock of equipment in Firestore
      for (const item of formItems) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(item.quantity)
        });
      }

      // 3. Update Supplier liabilities debt if any remaining
      if (debtVal > 0 && formSupplierId !== 'INITIAL_STOCK' && formSupplierId !== 'TECH_RETURN') {
        const supRef = doc(db, 'suppliers', formSupplierId);
        await updateDoc(supRef, {
          debt: increment(debtVal)
        });
      }

      // 4. If imported from a purchase proposal, mark it as completed
      if (formProposalId) {
        const propRef = doc(db, 'purchase_proposals', formProposalId);
        await updateDoc(propRef, {
          status: 'completed'
        });
      }

      setShowAddModal(false);
      setFormSupplierId('');
      setFormNote('');
      setFormPaidAmount(0);
      setFormItems([]);
      setFormProposalId('');
      alert(`Đã lập và duyệt thành công Phiếu Nhập Kho #${receiptId}! Số lượng tồn kho đã được đồng bộ tăng.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  // Start pre-filled import from a specific purchase proposal
  const handleImportFromProposal = (proposal: any) => {
    setFormSupplierId(proposal.supplierId);
    setFormNote(`Nhập kho từ đơn mua hàng #${proposal.id}`);
    setFormPaidAmount(proposal.paidAmount || 0);
    setFormProposalId(proposal.id);
    
    // Prefill items
    const mappedItems = proposal.items.map((item: any) => ({
      equipmentId: item.equipmentId,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    }));
    setFormItems(mappedItems);
    setShowAddModal(true);
  };

  // Technician Return Actions
  const handleAddTechItem = () => {
    if (!selectedTechEquipId) return;
    if (techItems.some(i => i.equipmentId === selectedTechEquipId)) {
      alert('Vật tư này đã có trong danh sách trả.');
      return;
    }
    setTechItems([...techItems, { equipmentId: selectedTechEquipId, quantity: techQtyToAdd }]);
    setSelectedTechEquipId('');
    setTechQtyToAdd(1);
  };

  const handleRemoveTechItem = (idx: number) => {
    setTechItems(techItems.filter((_, i) => i !== idx));
  };

  const handleTechQtyChange = (idx: number, qty: number) => {
    if (qty < 1) return;
    const updated = [...techItems];
    updated[idx].quantity = qty;
    setTechItems(updated);
  };

  const handleSubmitTechReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techName || !techProject || techItems.length === 0) {
      alert('Vui lòng điền đầy đủ tên kỹ thuật, dự án và thêm ít nhất 1 vật tư hoàn trả.');
      return;
    }

    try {
      const receiptId = 'PN-TRA-' + Math.floor(100000 + Math.random() * 899999);
      
      let totalValue = 0;
      const itemsPayload = techItems.map(item => {
        const eq = equipment.find(e => e.id === item.equipmentId);
        const itemVal = item.quantity * (eq?.unitPrice || 0);
        totalValue += itemVal;
        return {
          equipmentId: item.equipmentId,
          brand: eq?.brand || 'Chưa rõ',
          model: eq?.model || 'Thiết bị',
          type: eq?.type || 'other',
          quantity: item.quantity,
          unitPrice: eq?.unitPrice || 0,
          unit: eq?.unit || 'Cái'
        };
      });

      const payload: InventoryTransaction = {
        id: receiptId,
        type: 'import',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        partnerId: 'TECH_RETURN',
        partnerName: `Kỹ thuật: ${techName}`,
        totalValue: totalValue,
        paidAmount: totalValue, // Nội bộ
        debtAmount: 0,
        note: `Kỹ thuật ${techName} trả vật tư dự án ${techProject}. Lý do: ${techReason}`,
        createdBy: userId,
        createdByName: 'Thủ kho Solar',
        items: itemsPayload
      };

      // 1. Save receipt document to Firestore
      await setDoc(doc(db, 'inventory_transactions', receiptId), payload);

      // 2. Loop & increment stock of equipment in Firestore
      for (const item of techItems) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(item.quantity)
        });
      }

      setTechName('');
      setTechProject('');
      setTechReason('Dư thừa vật tư sau thi công');
      setTechItems([]);
      alert(`Đã nhận hoàn trả vật tư thành công! Phiếu nhập kho hoàn trả #${receiptId} đã lập và tăng tồn kho tương ứng.`);
      handleCloseThisForm(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  // Initial Stock Actions
  const handleAddInitialItem = () => {
    if (!selectedInitialEquipId) return;
    if (initialItems.some(i => i.equipmentId === selectedInitialEquipId)) {
      alert('Vật tư này đã có trong danh sách tồn đầu kỳ.');
      return;
    }
    const eq = equipment.find(e => e.id === selectedInitialEquipId);
    setInitialItems([...initialItems, { 
      equipmentId: selectedInitialEquipId, 
      quantity: initialQtyToAdd, 
      unitPrice: initialPriceToAdd || eq?.unitPrice || 1000000 
    }]);
    setSelectedInitialEquipId('');
    setInitialQtyToAdd(1);
    setInitialPriceToAdd(0);
  };

  const handleRemoveInitialItem = (idx: number) => {
    setInitialItems(initialItems.filter((_, i) => i !== idx));
  };

  const handleInitialQtyChange = (idx: number, qty: number) => {
    if (qty < 1) return;
    const updated = [...initialItems];
    updated[idx].quantity = qty;
    setInitialItems(updated);
  };

  const handleInitialPriceChange = (idx: number, price: number) => {
    if (price < 0) return;
    const updated = [...initialItems];
    updated[idx].unitPrice = price;
    setInitialItems(updated);
  };

  const handleSubmitInitialStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (initialItems.length === 0) {
      alert('Vui lòng chọn thiết bị và số lượng tồn đầu kỳ để lập phiếu.');
      return;
    }

    try {
      const receiptId = 'PN-DK-' + Math.floor(100000 + Math.random() * 899999);
      
      let totalValue = 0;
      const itemsPayload = initialItems.map(item => {
        totalValue += (item.quantity * item.unitPrice);
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
      });

      const payload: InventoryTransaction = {
        id: receiptId,
        type: 'import',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        partnerId: 'INITIAL_STOCK',
        partnerName: 'Hàng tồn kho đầu kỳ',
        totalValue: totalValue,
        paidAmount: totalValue,
        debtAmount: 0,
        note: 'Nhập số liệu hàng tồn kho đầu kỳ',
        createdBy: userId,
        createdByName: 'Thủ kho Solar',
        items: itemsPayload
      };

      // 1. Save receipt document to Firestore
      await setDoc(doc(db, 'inventory_transactions', receiptId), payload);

      // 2. Loop & increment stock of equipment in Firestore
      for (const item of initialItems) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(item.quantity)
        });
      }

      setInitialItems([]);
      alert(`Đã nhập hàng tồn đầu kỳ thành công! Phiếu nhập #${receiptId} đã lập và đồng bộ số dư tồn kho.`);
      handleCloseThisForm(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  // Start Edit Receipt Handler
  const startEditReceipt = (tx: InventoryTransaction) => {
    setEditingTxId(tx.id);
    setEditSupplierId(tx.partnerId || '');
    setEditNote(tx.note || '');
    setEditPaidAmount(tx.paidAmount || 0);
    setEditItems(tx.items.map(item => ({
      equipmentId: item.equipmentId,
      quantity: item.quantity,
      unitPrice: item.unitPrice
    })));
    setShowEditModal(true);
  };

  // Edit form helpers
  const handleAddEditItem = (equipmentId: string) => {
    const existingIdx = editItems.findIndex(item => item.equipmentId === equipmentId);
    if (existingIdx > -1) {
      const newItems = [...editItems];
      newItems[existingIdx].quantity += 1;
      setEditItems(newItems);
    } else {
      const eq = equipment.find(e => e.id === equipmentId);
      setEditItems([
        ...editItems,
        {
          equipmentId,
          quantity: 1,
          unitPrice: eq?.unitPrice || 1000000
        }
      ]);
    }
  };

  const handleRemoveEditItem = (idx: number) => {
    const newItems = editItems.filter((_, i) => i !== idx);
    setEditItems(newItems);
  };

  const handleEditQtyChange = (idx: number, qty: number) => {
    if (qty < 1) return;
    const newItems = [...editItems];
    newItems[idx].quantity = qty;
    setEditItems(newItems);
  };

  const handleEditPriceChange = (idx: number, price: number) => {
    if (price < 0) return;
    const newItems = [...editItems];
    newItems[idx].unitPrice = price;
    setEditItems(newItems);
  };

  const calculateEditTotalValue = () => {
    return editItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  // Update Submit Handler
  const handleUpdateReceiptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSupplierId || editItems.length === 0) {
      alert('Vui lòng chọn nhà cung cấp và thêm ít nhất 1 vật tư.');
      return;
    }

    try {
      const originalTx = transactions.find(t => t.id === editingTxId);
      if (!originalTx) {
        alert('Không tìm thấy phiếu nhập gốc.');
        return;
      }

      const selectedSup = suppliers.find(s => s.id === editSupplierId) || 
        (editSupplierId === 'INITIAL_STOCK' ? { name: 'Hàng tồn kho đầu kỳ' } : { name: 'Kỹ thuật trả vật tư' });
      const supName = selectedSup.name;

      const totalVal = calculateEditTotalValue();
      const debtVal = Math.max(0, totalVal - editPaidAmount);

      // 1. Revert original stock quantities (decrement)
      for (const originalItem of originalTx.items) {
        const eqRef = doc(db, 'equipment', originalItem.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(-originalItem.quantity)
        });
      }

      // 2. Revert original supplier debt
      if (originalTx.debtAmount && originalTx.debtAmount > 0 && originalTx.partnerId && originalTx.partnerId !== 'INITIAL_STOCK' && originalTx.partnerId !== 'TECH_RETURN') {
        try {
          const supRef = doc(db, 'suppliers', originalTx.partnerId);
          await updateDoc(supRef, {
            debt: increment(-originalTx.debtAmount)
          });
        } catch (supErr) {
          console.error('Error reverting old supplier debt:', supErr);
        }
      }

      // 3. Apply new stock quantities (increment)
      for (const item of editItems) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(item.quantity)
        });
      }

      // 4. Apply new supplier debt
      if (debtVal > 0 && editSupplierId !== 'INITIAL_STOCK' && editSupplierId !== 'TECH_RETURN') {
        try {
          const supRef = doc(db, 'suppliers', editSupplierId);
          await updateDoc(supRef, {
            debt: increment(debtVal)
          });
        } catch (supErr) {
          console.error('Error applying new supplier debt:', supErr);
        }
      }

      // 5. Update receipt in Firestore
      const payload: InventoryTransaction = {
        ...originalTx,
        partnerId: editSupplierId,
        partnerName: supName,
        totalValue: totalVal,
        paidAmount: editPaidAmount,
        debtAmount: debtVal,
        note: editNote.trim() || 'Nhập kho lô vật tư thiết bị solar mới (Đã cập nhật)',
        items: editItems.map(item => {
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

      await setDoc(doc(db, 'inventory_transactions', editingTxId), payload);

      setShowEditModal(false);
      alert(`Đã cập nhật thành công Phiếu Nhập Hàng #${editingTxId}! Tồn kho và công nợ đã được đồng bộ lại.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  // Cancel / Delete Receipt Handler
  const handleCancelReceipt = async (tx: InventoryTransaction) => {
    const isConfirmed = window.confirm(
      `Bạn có chắc chắn muốn hủy phiếu nhập hàng #${tx.id} không?\nHành động này sẽ:\n1. GIẢM số lượng tồn kho của tất cả vật tư trong phiếu tương ứng.\n2. GIẢM số nợ của nhà cung cấp ${tx.partnerName} đi ${formatCurrency(tx.debtAmount || 0)}.\n\nLưu ý: Không thể hoàn tác hành động này!`
    );
    if (!isConfirmed) return;

    try {
      // 1. Revert stock
      for (const item of tx.items) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(-item.quantity)
        });
      }

      // 2. Revert supplier debt
      if (tx.debtAmount && tx.debtAmount > 0 && tx.partnerId && tx.partnerId !== 'INITIAL_STOCK' && tx.partnerId !== 'TECH_RETURN') {
        try {
          const supRef = doc(db, 'suppliers', tx.partnerId);
          await updateDoc(supRef, {
            debt: increment(-tx.debtAmount)
          });
        } catch (supErr) {
          console.error('Error reverting supplier debt:', supErr);
        }
      }

      // 3. Delete document
      await deleteDoc(doc(db, 'inventory_transactions', tx.id));

      alert(`Đã hủy thành công phiếu nhập hàng #${tx.id}! Số lượng tồn kho và công nợ đã được điều chỉnh giảm.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  // Export to CSV function
  const handleExportCSV = () => {
    try {
      const headers = ['Mã phiếu', 'Ngày nhập', 'Đối tác / Nhà cung cấp', 'Vật tư', 'Tổng trị giá', 'Đã thanh toán', 'Còn nợ', 'Ghi chú'];
      const rows = importedTxList.map(tx => [
        tx.id,
        tx.date,
        tx.partnerName,
        tx.items.map(item => `${item.brand} ${item.model} (x${item.quantity})`).join('; '),
        tx.totalValue,
        tx.paidAmount || 0,
        tx.debtAmount || 0,
        tx.note || ''
      ]);
      
      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Danh_sach_phieu_nhap_hang_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('Không thể xuất Excel vào lúc này.');
    }
  };

  // Quick Add Equipment Action
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
      setQuickEquipBrand('');
      setQuickEquipModel('');
      setQuickEquipPrice(0);
    } catch (err) {
      alert('Không thể thêm vật tư nhanh.');
    }
  };

  // Quick Add Supplier Action
  const handleQuickAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupName || !quickSupPhone) {
      alert('Vui lòng nhập tên nhà cung cấp và số điện thoại.');
      return;
    }
    try {
      const newId = 'SUP' + Math.floor(1000 + Math.random() * 9000);
      const payload = {
        id: newId,
        name: quickSupName.trim(),
        phone: quickSupPhone.trim(),
        address: quickSupAddress.trim(),
        debt: 0,
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'suppliers', newId), payload);
      alert(`Đã thêm thành công nhà cung cấp ${quickSupName}!`);
      setShowQuickAddSupplierModal(false);
      setQuickSupName('');
      setQuickSupPhone('');
      setQuickSupAddress('');
    } catch (err) {
      alert('Không thể thêm nhà cung cấp nhanh.');
    }
  };

  // POS Nhập hàng Action
  const handleSubmitPosReceipt = async (isDraft: boolean) => {
    if (!posSupplierId) {
      alert('Vui lòng chọn nhà cung cấp.');
      return;
    }
    if (posItems.length === 0) {
      alert('Vui lòng thêm ít nhất 1 vật tư vào phiếu nhập.');
      return;
    }

    try {
      const selectedSup = suppliers.find(s => s.id === posSupplierId) || { name: 'Nhà cung cấp' };
      const supName = selectedSup.name;
      
      const receiptId = importReceiptId.trim() || ('PN' + Math.floor(200000 + Math.random() * 799999));
      
      // Calculate total value
      const totalVal = posItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const paidVal = posPaidAmount;
      const debtVal = Math.max(0, totalVal - paidVal);

      const payload: InventoryTransaction = {
        id: receiptId,
        type: 'import',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        partnerId: posSupplierId,
        partnerName: supName,
        totalValue: totalVal,
        paidAmount: paidVal,
        debtAmount: debtVal,
        note: importNote.trim() || (isDraft ? 'Phiếu tạm nhập hàng' : 'Nhập hàng hóa từ nhà cung cấp'),
        createdBy: userId,
        createdByName: importStaff,
        items: posItems.map(item => {
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

      // 2. Loop & increment stock of equipment in Firestore
      for (const item of posItems) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(item.quantity)
        });
      }

      // 3. Update Supplier liabilities debt if any remaining
      if (debtVal > 0 && posSupplierId !== 'INITIAL_STOCK' && posSupplierId !== 'TECH_RETURN') {
        const supRef = doc(db, 'suppliers', posSupplierId);
        await updateDoc(supRef, {
          debt: increment(debtVal)
        });
      }

      alert(`Đã lập thành công Phiếu Nhập Hàng #${receiptId}! Số lượng tồn kho và công nợ nhà cung cấp đã được đồng bộ tăng.`);
      
      // Clear form and return to list
      setPosItems([]);
      setPosSupplierId('');
      setPosPaidAmount(0);
      setImportReceiptId('');
      setImportOrderCode('');
      setImportInvoiceNo('');
      setImportNote('');
      handleCloseThisForm(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  // POS Trả hàng NCC Action
  const handleSubmitReturnReceipt = async () => {
    if (!returnSupplierId) {
      alert('Vui lòng chọn nhà cung cấp nhận hàng trả.');
      return;
    }
    if (returnItems.length === 0) {
      alert('Vui lòng thêm ít nhất 1 vật tư vào danh sách trả.');
      return;
    }

    // Check stock limits before returning
    for (const item of returnItems) {
      const eq = equipment.find(e => e.id === item.equipmentId);
      const currentStock = eq?.stock || 0;
      if (item.quantity > currentStock) {
        alert(`Không thể trả hàng! Số lượng trả (${item.quantity}) vượt quá số lượng tồn kho hiện tại (${currentStock}) của thiết bị ${eq?.brand} ${eq?.model}.`);
        return;
      }
    }

    try {
      const selectedSup = suppliers.find(s => s.id === returnSupplierId) || { name: 'Nhà cung cấp' };
      const supName = selectedSup.name;
      
      const receiptId = returnReceiptId.trim() || ('PX-TRA-' + Math.floor(200000 + Math.random() * 799999));
      
      // Calculate total value
      const totalVal = returnItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
      const cashRefund = returnPaidAmount; // Tiền mặt nhận lại
      const debtDeduction = Math.max(0, totalVal - cashRefund); // Cấn trừ nợ nhà cung cấp

      const payload: InventoryTransaction = {
        id: receiptId,
        type: 'export', // Xuất trả hàng
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        partnerId: returnSupplierId,
        partnerName: `Trả hàng NCC: ${supName}`,
        totalValue: totalVal,
        paidAmount: cashRefund, // NCC hoàn tiền
        debtAmount: debtDeduction, // Cấn trừ nợ
        note: returnNote.trim() || 'Xuất trả hàng lỗi/thừa cho nhà cung cấp',
        createdBy: userId,
        createdByName: returnStaff,
        items: returnItems.map(item => {
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

      // 1. Save return receipt document to Firestore
      await setDoc(doc(db, 'inventory_transactions', receiptId), payload);

      // 2. Loop & decrement stock of equipment in Firestore
      for (const item of returnItems) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        await updateDoc(eqRef, {
          stock: increment(-item.quantity)
        });
      }

      // 3. Revert/Deduct Supplier debt (reduce what we owe them)
      if (debtDeduction > 0) {
        const supRef = doc(db, 'suppliers', returnSupplierId);
        await updateDoc(supRef, {
          debt: increment(-debtDeduction)
        });
      }

      alert(`Đã lập thành công Phiếu Trả Hàng NCC #${receiptId}! Tồn kho vật tư và công nợ nhà cung cấp đã được giảm tương ứng.`);
      
      // Clear form and return to list
      setReturnItems([]);
      setReturnSupplierId('');
      setReturnPaidAmount(0);
      setReturnReceiptId('');
      setReturnNote('');
      handleCloseThisForm(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_transactions');
    }
  };

  // Giả lập Import file Excel/CSV mẫu
  const handleFakeExcelImport = () => {
    if (equipment.length === 0) {
      alert('Không có vật tư nào trong hệ thống để import.');
      return;
    }
    // Lấy ngẫu nhiên 2 vật tư từ database
    const itemsToImport = [];
    const count = Math.min(equipment.length, 2);
    for (let i = 0; i < count; i++) {
      const eq = equipment[i];
      if (!posItems.some(item => item.equipmentId === eq.id)) {
        itemsToImport.push({
          equipmentId: eq.id,
          quantity: 5,
          unitPrice: eq.unitPrice || 1500000
        });
      }
    }
    if (itemsToImport.length === 0) {
      alert('Tất cả các sản phẩm mẫu đã có trong danh sách!');
      return;
    }
    setPosItems([...posItems, ...itemsToImport]);
    alert('Đã import thành công dữ liệu mẫu từ File Excel!');
  };

  return (
    <div id="import-receipts-container" className="space-y-8 font-sans">
      
      {/* Title Header with "+ Lập phiếu nhập kho" Action */}
      {activeSource === null && (
        <div id="import-header-section" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="space-y-1">
            <h1 id="import-main-title" className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-blue-600" />
              Nhập kho
            </h1>
            <p id="import-sub-title" className="text-slate-500 text-xs font-semibold">
              Chọn nguồn nhập kho để bắt đầu lập phiếu hoặc xem lịch sử giao dịch nhập hàng
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="btn-export-csv-list"
              onClick={handleExportCSV}
              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-xs active:scale-95"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Xuất Excel
            </button>
          </div>
        </div>
      )}

      {/* FOUR SOURCE CHOOSE SELECTOR ROW - MATCHES SCREENSHOT */}
      {activeSource === null && (
        <div id="import-sources-selection-container" className="space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Nguồn nhập kho</h3>
            <span className="text-[11px] text-slate-400 font-bold">Chọn một phương thức để thực hiện nhập xuất kho</span>
          </div>
          
          <div id="import-sources-row" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Nhập hàng */}
            <div 
              id="source-card-import-goods"
              onClick={() => {
                if (onOpenFormTab) {
                  onOpenFormTab('import_goods');
                } else {
                  setActiveSource('import_goods');
                  setPosItems([]);
                  setPosSupplierId('');
                  setPosPaidAmount(0);
                }
              }}
              className="p-5 rounded-3xl border-2 transition-all cursor-pointer flex items-center gap-4 border-slate-100 bg-white hover:border-blue-500 hover:bg-slate-50/50 hover:shadow-md group"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all bg-blue-50 text-blue-600 group-hover:scale-105">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-xs tracking-wide">Nhập hàng</h4>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Nhập kho lô hàng mới từ NCC (Mẫu POS)</p>
              </div>
            </div>

            {/* Card 2: Trả hàng NCC */}
            <div 
              id="source-card-supplier-return"
              onClick={() => {
                if (onOpenFormTab) {
                  onOpenFormTab('supplier_return');
                } else {
                  setActiveSource('supplier_return');
                  setReturnItems([]);
                  setReturnSupplierId('');
                  setReturnPaidAmount(0);
                }
              }}
              className="p-5 rounded-3xl border-2 transition-all cursor-pointer flex items-center gap-4 border-slate-100 bg-white hover:border-rose-500 hover:bg-slate-50/50 hover:shadow-md group"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all bg-rose-50 text-rose-600 group-hover:scale-105">
                <ArrowRight className="h-5 w-5 transform rotate-180" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-xs tracking-wide">Trả hàng NCC</h4>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Xuất kho trả lại hàng lỗi, thừa cho NCC</p>
              </div>
            </div>

            {/* Card 3: Kỹ thuật trả vật tư */}
            <div 
              id="source-card-tech"
              onClick={() => {
                if (onOpenFormTab) {
                  onOpenFormTab('tech_return');
                } else {
                  setActiveSource('tech_return');
                  setTechItems([]);
                  setTechName('');
                  setTechProject('');
                }
              }}
              className="p-5 rounded-3xl border-2 transition-all cursor-pointer flex items-center gap-4 border-slate-100 bg-white hover:border-blue-500 hover:bg-slate-50/50 hover:shadow-md group"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all bg-slate-100 text-slate-400 group-hover:scale-105">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-xs tracking-wide">Kỹ thuật trả vật tư</h4>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Nhập kho từ vật tư kỹ thuật trả lại sau thi công</p>
              </div>
            </div>

            {/* Card 4: Nhập hàng tồn đầu kỳ */}
            <div 
              id="source-card-initial"
              onClick={() => {
                if (onOpenFormTab) {
                  onOpenFormTab('initial_stock');
                } else {
                  setActiveSource('initial_stock');
                  setInitialItems([]);
                }
              }}
              className="p-5 rounded-3xl border-2 transition-all cursor-pointer flex items-center gap-4 border-slate-100 bg-white hover:border-blue-500 hover:bg-slate-50/50 hover:shadow-md group"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all bg-slate-100 text-slate-400 group-hover:scale-105">
                <Database className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-slate-900 text-xs tracking-wide">Nhập hàng tồn đầu kỳ</h4>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Nhập số dư tồn kho hàng hóa ban đầu</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ACTIVE SOURCE AREA DETAILS WORKFLOWS */}
      <div id="active-source-view-area" className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        
        {/* VIEW 1: POS NHẬP HÀNG (import_goods) - MATCHES SCREENSHOT */}
        {activeSource === 'import_goods' && (
          <div id="pos-import-goods-view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Items Search & Table (lg:col-span-8) */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Header with Back Button */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-150 shadow-xs">
                <button
                  type="button"
                  onClick={() => handleCloseThisForm(false)}
                  className="p-2 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200 cursor-pointer active:scale-95"
                  title="Quay lại danh sách"
                >
                  <ArrowLeft className="h-4 w-4 text-slate-700" />
                </button>
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-base font-black text-slate-900 tracking-tight">Nhập hàng</h2>
                  
                  {/* Search Equipment Input with autocomplete */}
                  <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={posSearchTerm}
                      onChange={(e) => setPosSearchTerm(e.target.value)}
                      placeholder="Tìm hàng hóa theo mã hoặc tên (F3)"
                      className="w-full pl-9 pr-10 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowQuickAddEquipModal(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-[#0054a6] hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors"
                      title="Thêm nhanh thiết bị mới"
                    >
                      <Plus className="h-3 w-3" />
                    </button>

                    {/* Autocomplete Results Panel */}
                    {posSearchTerm.trim() !== '' && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-55 max-h-52 overflow-y-auto divide-y divide-slate-50">
                        {equipment
                          .filter(eq => {
                            const keywords = posSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
                            const searchableText = `${eq.brand || ''} ${eq.model || ''} ${eq.id || ''} ${eq.type || ''} ${eq.details || ''} ${eq.location || ''} ${eq.unit || ''} ${(eq as any).description || ''} ${eq.supplier || ''}`.toLowerCase();
                            return keywords.every(kw => searchableText.includes(kw));
                          })
                          .map(eq => (
                            <div 
                              key={eq.id}
                              onClick={() => {
                                const exists = posItems.find(item => item.equipmentId === eq.id);
                                if (exists) {
                                  setPosItems(posItems.map(item => item.equipmentId === eq.id ? { ...item, quantity: item.quantity + 1 } : item));
                                } else {
                                  setPosItems([...posItems, { equipmentId: eq.id, quantity: 1, unitPrice: eq.unitPrice || 1500000 }]);
                                }
                                setPosSearchTerm('');
                              }}
                              className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs"
                            >
                              <div>
                                <span className="font-extrabold text-slate-800 block">{eq.brand} {eq.model}</span>
                                <span className="text-[9px] text-slate-400 font-bold">Mã: {eq.id} | Tồn: {eq.stock} {eq.unit}</span>
                              </div>
                              <span className="font-black text-blue-600">{formatCurrency(eq.unitPrice || 0)}</span>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Table / Form Items */}
              <div className="bg-white border border-slate-150 rounded-[2rem] p-6 shadow-xs min-h-[400px] flex flex-col justify-between">
                
                {posItems.length === 0 ? (
                  // Vùng trống hiển thị Excel Template Match screenshot
                  <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-700">Thêm sản phẩm từ file excel</p>
                      <p className="text-[10px] text-slate-400 font-bold">
                        Nhập trực tiếp danh sách hoặc nạp dữ liệu từ file để xử lý nhanh
                      </p>
                      <button 
                        type="button" 
                        onClick={handleFakeExcelImport}
                        className="text-[10px] text-blue-600 font-extrabold hover:underline block pt-1 cursor-pointer"
                      >
                        (Tải về file mẫu: Excel file)
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleFakeExcelImport}
                      className="bg-[#0054a6] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      Chọn file dữ liệu
                    </button>
                  </div>
                ) : (
                  // Bảng POS danh sách sản phẩm đã chọn nhập
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-150 pb-3">
                          <th className="py-3 font-bold text-slate-400 text-center w-12">STT</th>
                          <th className="py-3 font-bold text-slate-400 w-24">Mã hàng</th>
                          <th className="py-3 font-bold text-slate-400">Tên hàng</th>
                          <th className="py-3 font-bold text-slate-400 text-center w-16">ĐVT</th>
                          <th className="py-3 font-bold text-slate-400 text-center w-28">Số lượng</th>
                          <th className="py-3 font-bold text-slate-400 text-right w-28">Đơn giá</th>
                          <th className="py-3 font-bold text-slate-400 text-right w-32">Thành tiền</th>
                          <th className="py-3 font-bold text-slate-400 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {posItems.map((item, idx) => {
                          const eq = equipment.find(e => e.id === item.equipmentId);
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-4 font-mono font-bold text-slate-850">{item.equipmentId}</td>
                              <td className="py-4 font-extrabold text-slate-800">
                                {eq?.brand} {eq?.model}
                              </td>
                              <td className="py-4 text-center font-bold text-slate-500">{eq?.unit || 'Cái'}</td>
                              
                              {/* Số lượng */}
                              <td className="py-4">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = Math.max(1, item.quantity - 1);
                                      setPosItems(posItems.map((pi, i) => i === idx ? { ...pi, quantity: val } : pi));
                                    }}
                                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-black cursor-pointer flex items-center justify-center"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const val = Math.max(1, Number(e.target.value));
                                      setPosItems(posItems.map((pi, i) => i === idx ? { ...pi, quantity: val } : pi));
                                    }}
                                    className="w-12 py-1 border border-slate-200 rounded text-center font-bold text-xs bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPosItems(posItems.map((pi, i) => i === idx ? { ...pi, quantity: pi.quantity + 1 } : pi));
                                    }}
                                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-black cursor-pointer flex items-center justify-center"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>

                              {/* Đơn giá */}
                              <td className="py-4">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.unitPrice}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setPosItems(posItems.map((pi, i) => i === idx ? { ...pi, unitPrice: val } : pi));
                                  }}
                                  className="w-24 px-2 py-1 border border-slate-200 rounded text-right font-bold text-xs bg-white"
                                />
                              </td>

                              {/* Thành tiền */}
                              <td className="py-4 text-right font-black text-slate-900">
                                {formatCurrency(item.quantity * item.unitPrice)}
                              </td>

                              {/* Trash */}
                              <td className="py-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setPosItems(posItems.filter((_, i) => i !== idx))}
                                  className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                  title="Xóa thiết bị khỏi đơn"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Clear All List button */}
                {posItems.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPosItems([])}
                      className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 hover:text-slate-700 font-bold transition-all text-xs cursor-pointer"
                    >
                      Xóa toàn bộ hàng chờ
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Checkout Sidebar (lg:col-span-4) - MATCHES SCREENSHOT */}
            <div className="lg:col-span-4 space-y-4 font-sans text-xs">
              
              {/* Payment Detail Card */}
              <div className="bg-white border border-slate-150 rounded-[2rem] p-6 shadow-xs space-y-4">
                
                {/* Staff Selection row */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-500 font-semibold">
                    <User className="h-4 w-4 text-slate-400" />
                    <span>Nhân viên</span>
                  </div>
                  <select
                    value={importStaff}
                    onChange={(e) => setImportStaff(e.target.value)}
                    className="bg-transparent text-right font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[150px] truncate"
                  >
                    {importStaffList.map(u => {
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

                {/* Date Row */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-500 font-semibold">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>Thời gian</span>
                  </div>
                  <span className="font-bold text-slate-800">
                    {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Supplier search & select */}
                <div className="space-y-1.5 border-b border-slate-100 pb-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Chọn nhà cung cấp</span>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddSupplierModal(true)}
                      className="text-[10px] text-blue-600 font-black hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Thêm nhanh
                    </button>
                  </div>
                  
                  {/* Searchable Combobox for Supplier */}
                  <div className="relative font-sans text-xs">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="🔍 Tìm nhanh nhà cung cấp..."
                        value={isSupplierDropdownOpen ? supplierQuery : (selectedSupplierObj?.name || '')}
                        onChange={(e) => {
                          setSupplierQuery(e.target.value);
                          setIsSupplierDropdownOpen(true);
                        }}
                        onFocus={() => {
                          setSupplierQuery('');
                          setIsSupplierDropdownOpen(true);
                        }}
                        onBlur={() => {
                          // Wait for click event on options to register
                          setTimeout(() => {
                            setIsSupplierDropdownOpen(false);
                          }, 250);
                        }}
                        className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 placeholder:text-slate-400"
                      />
                      <Search className="absolute left-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      {posSupplierId && (
                        <button
                          type="button"
                          onClick={() => {
                            setPosSupplierId('');
                            setSupplierQuery('');
                          }}
                          className="absolute right-3 hover:bg-slate-200 p-0.5 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {isSupplierDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg font-sans">
                        {filteredSuppliers.length === 0 ? (
                          <div className="px-3 py-2.5 text-slate-400 text-xs italic">
                            Không tìm thấy nhà cung cấp nào
                          </div>
                        ) : (
                          filteredSuppliers.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setPosSupplierId(s.id);
                                setSupplierQuery(s.name);
                                setIsSupplierDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors flex flex-col gap-0.5 border-b border-slate-50 last:border-b-0 cursor-pointer ${
                                posSupplierId === s.id ? 'bg-blue-50/70 text-blue-700' : 'text-slate-700'
                              }`}
                            >
                              <span className="font-bold text-xs">{s.name}</span>
                              {s.phone && (
                                <span className="text-[10px] text-slate-400 font-medium">SĐT: {s.phone}</span>
                              )}
                              {s.id !== 'INITIAL_STOCK' && s.id !== 'TECH_RETURN' && (
                                <span className="text-[10px] text-slate-500 font-medium">
                                  Nợ hiện tại: <span className="text-red-500 font-bold">{formatCurrency(s.debt)}</span>
                                </span>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Invoice Code */}
                <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Mã phiếu nhập</label>
                    <input
                      type="text"
                      placeholder="Mã phiếu tự động"
                      value={importReceiptId}
                      onChange={(e) => setImportReceiptId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Mã đặt hàng nhập</label>
                    <input
                      type="text"
                      placeholder="Nhập mã đặt hàng"
                      value={importOrderCode}
                      onChange={(e) => setImportOrderCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                    />
                  </div>
                </div>

                {/* Status & Invoice detail row */}
                <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Trạng thái</label>
                    <select
                      value={importStatus}
                      onChange={(e) => setImportStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer"
                    >
                      <option value="Phiếu tạm">Phiếu tạm</option>
                      <option value="Hoàn thành">Hoàn thành</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Số hóa đơn đầu vào</label>
                    <input
                      type="text"
                      placeholder="Nhập số hóa đơn đầu..."
                      value={importInvoiceNo}
                      onChange={(e) => setImportInvoiceNo(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                    />
                  </div>
                </div>

                {/* Total calculations area with dashed separator */}
                <div className="pt-2 space-y-3 font-sans">
                  
                  {/* Total goods value */}
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      Tổng tiền hàng
                      <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" title="Tổng giá trị hàng nhập kho thực tế" />
                    </span>
                    <span className="text-slate-950 font-black text-sm">
                      {formatCurrency(posItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0))}
                    </span>
                  </div>

                  {/* Supplier prepayment */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase block">Tiền trả nhà cung cấp (VND)</label>
                    <input
                      type="number"
                      min={0}
                      value={posPaidAmount}
                      onChange={(e) => setPosPaidAmount(Number(e.target.value))}
                      placeholder="Nhập số tiền đã trả cho NCC"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                    />
                  </div>

                  {/* Account liabilities */}
                  <div className="flex justify-between items-center text-xs font-black pt-1">
                    <span className="text-slate-500">Tính vào công nợ</span>
                    <span className="text-blue-600 text-sm">
                      {formatCurrency(Math.max(0, posItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) - posPaidAmount))}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1 pt-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase block">Ghi chú phiếu nhập</label>
                  <textarea
                    rows={2}
                    value={importNote}
                    onChange={(e) => setImportNote(e.target.value)}
                    placeholder="Nhập ghi chú chi tiết phiếu nhập..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-semibold text-xs text-slate-700 shadow-xs resize-none"
                  />
                </div>

                {/* POS Buttons Section */}
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => handleSubmitPosReceipt(true)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase tracking-wider py-3 rounded-2xl transition-all cursor-pointer text-[10px] text-center"
                  >
                    Lưu tạm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmitPosReceipt(false)}
                    className="w-full bg-[#0054a6] hover:bg-blue-700 text-white font-black uppercase tracking-wider py-3 rounded-2xl transition-all shadow-md cursor-pointer text-[10px] text-center"
                  >
                    Hoàn thành
                  </button>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* VIEW 2: POS TRẢ HÀNG NCC (supplier_return) */}
        {activeSource === 'supplier_return' && (
          <div id="pos-supplier-return-view" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Items Search & Table (lg:col-span-8) */}
            <div className="lg:col-span-8 space-y-4">
              
              {/* Header with Back Button */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-150 shadow-xs">
                <button
                  type="button"
                  onClick={() => handleCloseThisForm(false)}
                  className="p-2 hover:bg-slate-100 rounded-2xl transition-all border border-slate-200 cursor-pointer active:scale-95"
                  title="Quay lại danh sách"
                >
                  <ArrowLeft className="h-4 w-4 text-slate-700" />
                </button>
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h2 className="text-base font-black text-rose-700 tracking-tight">Trả hàng NCC</h2>
                  
                  {/* Search Equipment Input with autocomplete */}
                  <div className="relative w-full sm:w-80">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={returnSearchTerm}
                      onChange={(e) => setReturnSearchTerm(e.target.value)}
                      placeholder="Tìm vật tư trả NCC theo mã hoặc tên"
                      className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-rose-500 font-bold text-xs"
                    />

                    {/* Autocomplete Results Panel */}
                    {returnSearchTerm.trim() !== '' && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-55 max-h-52 overflow-y-auto divide-y divide-slate-50">
                        {equipment
                          .filter(eq => eq.stock > 0) // Chỉ xuất trả những hàng còn tồn trong kho
                          .filter(eq => {
                            const keywords = returnSearchTerm.toLowerCase().split(/\s+/).filter(Boolean);
                            const searchableText = `${eq.brand || ''} ${eq.model || ''} ${eq.id || ''} ${eq.type || ''} ${eq.details || ''} ${eq.location || ''} ${eq.unit || ''} ${(eq as any).description || ''} ${eq.supplier || ''}`.toLowerCase();
                            return keywords.every(kw => searchableText.includes(kw));
                          })
                          .map(eq => (
                            <div 
                              key={eq.id}
                              onClick={() => {
                                const exists = returnItems.find(item => item.equipmentId === eq.id);
                                if (exists) {
                                  const newVal = Math.min(eq.stock, exists.quantity + 1);
                                  setReturnItems(returnItems.map(item => item.equipmentId === eq.id ? { ...item, quantity: newVal } : item));
                                } else {
                                  setReturnItems([...returnItems, { equipmentId: eq.id, quantity: 1, unitPrice: eq.unitPrice || 1500000 }]);
                                }
                                setReturnSearchTerm('');
                              }}
                              className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs"
                            >
                              <div>
                                <span className="font-extrabold text-slate-800 block">{eq.brand} {eq.model}</span>
                                <span className="text-[9px] text-slate-400 font-bold">Mã: {eq.id} | Tồn hiện có: {eq.stock} {eq.unit}</span>
                              </div>
                              <span className="font-black text-rose-600">{formatCurrency(eq.unitPrice || 0)}</span>
                            </div>
                          ))
                        }
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Table / Form Items */}
              <div className="bg-white border border-slate-150 rounded-[2rem] p-6 shadow-xs min-h-[400px] flex flex-col justify-between">
                
                {returnItems.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-slate-50 border border-dashed border-slate-350 flex items-center justify-center text-rose-500">
                      <ArrowRight className="h-6 w-6 transform rotate-180" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-700">Chưa có sản phẩm nào xuất trả</p>
                      <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                        Tìm kiếm và lựa chọn các sản phẩm còn hàng trong kho Solar để tạo phiếu trả cho nhà cung cấp
                      </p>
                    </div>
                  </div>
                ) : (
                  // Bảng POS xuất trả hàng
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-150 pb-3">
                          <th className="py-3 font-bold text-slate-400 text-center w-12">STT</th>
                          <th className="py-3 font-bold text-slate-400 w-24">Mã hàng</th>
                          <th className="py-3 font-bold text-slate-400">Tên hàng</th>
                          <th className="py-3 font-bold text-slate-400 text-center w-16">ĐVT</th>
                          <th className="py-3 font-bold text-slate-400 text-center w-28">Số lượng trả</th>
                          <th className="py-3 font-bold text-slate-400 text-right w-28">Đơn giá trả</th>
                          <th className="py-3 font-bold text-slate-400 text-right w-32">Thành tiền</th>
                          <th className="py-3 font-bold text-slate-400 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {returnItems.map((item, idx) => {
                          const eq = equipment.find(e => e.id === item.equipmentId);
                          const maxStock = eq?.stock || 1;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                              <td className="py-4 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="py-4 font-mono font-bold text-slate-850">{item.equipmentId}</td>
                              <td className="py-4 font-extrabold text-slate-800">
                                {eq?.brand} {eq?.model}
                                <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Tồn thực tế trong kho: {maxStock} {eq?.unit}</span>
                              </td>
                              <td className="py-4 text-center font-bold text-slate-500">{eq?.unit || 'Cái'}</td>
                              
                              {/* Số lượng trả */}
                              <td className="py-4">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = Math.max(1, item.quantity - 1);
                                      setReturnItems(returnItems.map((pi, i) => i === idx ? { ...pi, quantity: val } : pi));
                                    }}
                                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-black cursor-pointer flex items-center justify-center"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    max={maxStock}
                                    value={item.quantity}
                                    onChange={(e) => {
                                      const val = Math.min(maxStock, Math.max(1, Number(e.target.value)));
                                      setReturnItems(returnItems.map((pi, i) => i === idx ? { ...pi, quantity: val } : pi));
                                    }}
                                    className="w-12 py-1 border border-slate-200 rounded text-center font-bold text-xs bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = Math.min(maxStock, item.quantity + 1);
                                      setReturnItems(returnItems.map((pi, i) => i === idx ? { ...pi, quantity: val } : pi));
                                    }}
                                    className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-black cursor-pointer flex items-center justify-center"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>

                              {/* Đơn giá trả */}
                              <td className="py-4">
                                <input
                                  type="number"
                                  min={0}
                                  value={item.unitPrice}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    setReturnItems(returnItems.map((pi, i) => i === idx ? { ...pi, unitPrice: val } : pi));
                                  }}
                                  className="w-24 px-2 py-1 border border-slate-200 rounded text-right font-bold text-xs bg-white"
                                />
                              </td>

                              {/* Thành tiền */}
                              <td className="py-4 text-right font-black text-slate-900">
                                {formatCurrency(item.quantity * item.unitPrice)}
                              </td>

                              {/* Trash */}
                              <td className="py-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setReturnItems(returnItems.filter((_, i) => i !== idx))}
                                  className="text-slate-400 hover:text-rose-650 transition-colors cursor-pointer"
                                  title="Xóa thiết bị"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Clear All List button */}
                {returnItems.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setReturnItems([])}
                      className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 hover:text-slate-700 font-bold transition-all text-xs cursor-pointer"
                    >
                      Xóa toàn bộ
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Checkout Sidebar (lg:col-span-4) */}
            <div className="lg:col-span-4 space-y-4 font-sans text-xs">
              
              {/* Return Detail Card */}
              <div className="bg-white border border-slate-150 rounded-[2rem] p-6 shadow-xs space-y-4">
                
                {/* Staff Selection row */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-500 font-semibold">
                    <User className="h-4 w-4 text-slate-400" />
                    <span>Nhân viên trả hàng</span>
                  </div>
                  <select
                    value={returnStaff}
                    onChange={(e) => setReturnStaff(e.target.value)}
                    className="bg-transparent text-right font-bold text-slate-800 focus:outline-none cursor-pointer max-w-[150px] truncate"
                  >
                    {importStaffList.map(u => {
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

                {/* Date Row */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 text-slate-500 font-semibold">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>Thời gian</span>
                  </div>
                  <span className="font-bold text-slate-800">
                    {new Date().toLocaleDateString('vi-VN')} {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Supplier search & select */}
                <div className="space-y-1.5 border-b border-slate-100 pb-3 relative">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Chọn nhà cung cấp nhận trả</label>
                  </div>
                  
                  {/* Searchable Combobox for Supplier (Return) */}
                  <div className="relative font-sans text-xs">
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="🔍 Tìm nhanh nhà cung cấp..."
                        value={isReturnSupplierDropdownOpen ? returnSupplierQuery : (selectedReturnSupplierObj?.name || '')}
                        onChange={(e) => {
                          setReturnSupplierQuery(e.target.value);
                          setIsReturnSupplierDropdownOpen(true);
                        }}
                        onFocus={() => {
                          setReturnSupplierQuery('');
                          setIsReturnSupplierDropdownOpen(true);
                        }}
                        onBlur={() => {
                          // Wait for click event on options to register
                          setTimeout(() => {
                            setIsReturnSupplierDropdownOpen(false);
                          }, 250);
                        }}
                        className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-rose-500 font-bold text-xs text-slate-700 placeholder:text-slate-400"
                      />
                      <Search className="absolute left-3 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                      {returnSupplierId && (
                        <button
                          type="button"
                          onClick={() => {
                            setReturnSupplierId('');
                            setReturnSupplierQuery('');
                          }}
                          className="absolute right-3 hover:bg-slate-200 p-0.5 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {isReturnSupplierDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg font-sans">
                        {filteredReturnSuppliers.length === 0 ? (
                          <div className="px-3 py-2.5 text-slate-400 text-xs italic">
                            Không tìm thấy nhà cung cấp nào
                          </div>
                        ) : (
                          filteredReturnSuppliers.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setReturnSupplierId(s.id);
                                setReturnSupplierQuery(s.name);
                                setIsReturnSupplierDropdownOpen(false);
                              }}
                              className={`w-full px-3 py-2 text-left hover:bg-rose-50 transition-colors flex flex-col gap-0.5 border-b border-slate-50 last:border-b-0 cursor-pointer ${
                                returnSupplierId === s.id ? 'bg-rose-50/70 text-rose-700' : 'text-slate-700'
                              }`}
                            >
                              <span className="font-bold text-xs">{s.name}</span>
                              {s.phone && (
                                <span className="text-[10px] text-slate-400 font-medium">SĐT: {s.phone}</span>
                              )}
                              <span className="text-[10px] text-slate-500 font-semibold">Nợ hiện tại: {formatCurrency(s.debt || 0)}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Invoice Code */}
                <div className="border-b border-slate-100 pb-3 space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase block">Mã phiếu xuất trả</label>
                  <input
                    type="text"
                    placeholder="Mã phiếu tự động (PX-TRA-...)"
                    value={returnReceiptId}
                    onChange={(e) => setReturnReceiptId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-rose-500 font-bold text-xs"
                  />
                </div>

                {/* Total calculations area */}
                <div className="pt-2 space-y-3 font-sans">
                  
                  {/* Total goods value */}
                  <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      Tổng tiền trả hàng
                    </span>
                    <span className="text-slate-950 font-black text-sm">
                      {formatCurrency(returnItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0))}
                    </span>
                  </div>

                  {/* Cash refund from Supplier */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase block">Tiền NCC hoàn lại (Tiền mặt/CK)</label>
                    <input
                      type="number"
                      min={0}
                      value={returnPaidAmount}
                      onChange={(e) => setReturnPaidAmount(Number(e.target.value))}
                      placeholder="Số tiền NCC trả lại trực tiếp"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-rose-500 font-bold text-xs"
                    />
                  </div>

                  {/* Account liabilities reduction */}
                  <div className="flex justify-between items-center text-xs font-black pt-1">
                    <span className="text-slate-500">Trừ vào công nợ (NCC)</span>
                    <span className="text-rose-600 text-sm font-extrabold">
                      {formatCurrency(Math.max(0, returnItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) - returnPaidAmount))}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1 pt-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase block">Ghi chú trả hàng</label>
                  <textarea
                    rows={2}
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                    placeholder="Nhập ghi chú xuất trả hàng..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-rose-500 font-semibold text-xs text-slate-700 shadow-xs resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => handleCloseThisForm(false)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black uppercase tracking-wider py-3 rounded-2xl transition-all cursor-pointer text-[10px] text-center"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitReturnReceipt}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-wider py-3 rounded-2xl transition-all shadow-md cursor-pointer text-[10px] text-center"
                  >
                    Hoàn thành
                  </button>
                </div>

              </div>
            </div>

          </div>
        )}

        {/* VIEW 3: Kỹ thuật trả vật tư */}
        {activeSource === 'tech_return' && (
          <div id="tech-return-subview" className="bg-white border border-slate-150 rounded-[2.5rem] p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-black uppercase text-slate-900 tracking-wider">Phiếu kỹ thuật trả vật tư thừa về kho</h2>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Tiếp nhận và tăng tồn kho cho các vật tư được kỹ thuật hoàn trả lại sau thi công</p>
              </div>
              <button
                type="button"
                onClick={() => handleCloseThisForm(false)}
                className="p-2 hover:bg-slate-100 rounded-2xl border border-slate-200 text-slate-600"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitTechReturn} className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-xs">
              
              {/* Form Input fields */}
              <div className="lg:col-span-5 space-y-4 border-r border-slate-100 pr-0 lg:pr-8">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Thông tin hoàn trả</span>
                
                <div className="space-y-3 font-sans">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Tên kỹ thuật viên trả hàng *</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input 
                        type="text"
                        required
                        placeholder="Ví dụ: Nguyễn Văn Hùng, Trần Minh Tuấn..."
                        value={techName}
                        onChange={(e) => setTechName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 shadow-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Dự án / Công trình thi công *</label>
                    <div className="relative">
                      <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <input 
                        type="text"
                        required
                        placeholder="Ví dụ: Dự án Solar áp mái Quận 2, Nhà máy dệt Long An..."
                        value={techProject}
                        onChange={(e) => setTechProject(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 shadow-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Lý do hoàn trả *</label>
                    <select
                      value={techReason}
                      onChange={(e) => setTechReason(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer shadow-xs"
                    >
                      <option value="Dư thừa vật tư sau thi công">Dư thừa vật tư sau thi công</option>
                      <option value="Vật tư bị lỗi / Cần đổi trả">Vật tư bị lỗi / Cần bảo hành</option>
                      <option value="Thay đổi bản thiết kế kỹ thuật">Thay đổi bản thiết kế kỹ thuật</option>
                      <option value="Khác">Lý do khác</option>
                    </select>
                  </div>
                </div>

                {/* Quick Add equipment tool */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-3 pt-4">
                  <span className="text-[9px] font-black uppercase text-blue-600 tracking-wider block">Thêm thiết bị hoàn trả</span>
                  <div className="space-y-2 font-sans">
                    <div>
                      <select
                        value={selectedTechEquipId}
                        onChange={(e) => setSelectedTechEquipId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer shadow-xs"
                      >
                        <option value="">-- Chọn vật tư cần trả --</option>
                        {equipment.map(eq => (
                          <option key={eq.id} value={eq.id}>{eq.brand} - {eq.model} (Tồn: {eq.stock} {eq.unit})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-1/2">
                        <input 
                          type="number"
                          min={1}
                          placeholder="SL trả"
                          value={techQtyToAdd}
                          onChange={(e) => setTechQtyToAdd(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-center"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddTechItem}
                        disabled={!selectedTechEquipId}
                        className="w-1/2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Plus className="h-4 w-4" />
                        Đưa vào danh sách
                      </button>
                    </div>
                  </div>
                </div>

              </div>

              {/* Items List of return */}
              <div className="lg:col-span-7 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                    Danh sách vật tư trả kho ({techItems.length})
                  </span>
                  
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {techItems.length === 0 ? (
                      <div className="py-16 text-center text-slate-400 italic text-[11px] font-semibold bg-slate-50/30">
                        Chưa có vật tư nào được chọn. Hãy chọn vật tư ở cột trái để đưa vào danh sách trả kho.
                      </div>
                    ) : (
                      techItems.map((item, idx) => {
                        const eq = equipment.find(e => e.id === item.equipmentId);
                        return (
                          <div key={idx} className="p-4 flex items-center justify-between bg-white hover:bg-slate-50/50 transition-colors">
                            <div className="min-w-0">
                              <span className="text-[9px] font-bold text-blue-600 block uppercase leading-none">{eq?.brand}</span>
                              <span className="font-extrabold text-slate-800 text-xs block mt-1">{eq?.model}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">Mã thiết bị: {item.equipmentId}</span>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase">SL trả:</label>
                                <input 
                                  type="number"
                                  min={1}
                                  value={item.quantity}
                                  onChange={(e) => handleTechQtyChange(idx, Number(e.target.value))}
                                  className="w-16 px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs"
                                />
                                <span className="font-bold text-slate-600 text-xs">{eq?.unit || 'Cái'}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveTechItem(idx)}
                                className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all border border-transparent hover:border-rose-100 cursor-pointer"
                              >
                                <Trash className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleCloseThisForm(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer"
                  >
                    Đóng lại
                  </button>
                  <button
                    type="submit"
                    className="bg-[#0054a6] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Ký nhận trả kho & Tăng tồn
                  </button>
                </div>

              </div>

            </form>
          </div>
        )}

        {/* VIEW 4: Nhập hàng tồn đầu kỳ */}
        {activeSource === 'initial_stock' && (
          <div id="initial-stock-subview" className="bg-white border border-slate-150 rounded-[2.5rem] p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4 flex justify-between items-center">
              <div>
                <h2 className="text-sm font-black uppercase text-slate-900 tracking-wider">Khai báo hàng tồn kho đầu kỳ</h2>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Nhập số dư tồn kho ban đầu cho các thiết bị để bắt đầu quản lý số liệu hệ thống</p>
              </div>
              <button
                type="button"
                onClick={() => handleCloseThisForm(false)}
                className="p-2 hover:bg-slate-100 rounded-2xl border border-slate-200 text-slate-600"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitInitialStock} className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-xs">
              
              {/* Selector Tools Left */}
              <div className="lg:col-span-5 space-y-4 border-r border-slate-100 pr-0 lg:pr-8">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Khai báo thiết bị đầu kỳ</span>
                
                <div className="space-y-4 font-sans bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Chọn vật tư / Thiết bị *</label>
                    <select
                      value={selectedInitialEquipId}
                      onChange={(e) => {
                        setSelectedInitialEquipId(e.target.value);
                        const eq = equipment.find(item => item.id === e.target.value);
                        setInitialPriceToAdd(eq?.unitPrice || 0);
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer shadow-xs"
                    >
                      <option value="">-- Chọn vật tư --</option>
                      {equipment.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.brand} - {eq.model} (Tồn hiện tại: {eq.stock} {eq.unit})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Số lượng tồn kho *</label>
                      <input 
                        type="number"
                        min={1}
                        placeholder="Số lượng"
                        value={initialQtyToAdd}
                        onChange={(e) => setInitialQtyToAdd(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Đơn giá trị đầu kỳ (VND)</label>
                      <input 
                        type="number"
                        min={0}
                        placeholder="Đơn giá"
                        value={initialPriceToAdd}
                        onChange={(e) => setInitialPriceToAdd(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-center"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddInitialItem}
                    disabled={!selectedInitialEquipId}
                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm vào danh sách đầu kỳ
                  </button>
                </div>
              </div>

              {/* Added items list right */}
              <div className="lg:col-span-7 flex flex-col justify-between gap-6">
                <div className="space-y-3 font-sans">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                    Danh sách vật tư tồn đầu kỳ chờ duyệt ({initialItems.length})
                  </span>
                  
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {initialItems.length === 0 ? (
                      <div className="py-16 text-center text-slate-400 italic text-[11px] font-semibold bg-slate-50/30">
                        Chưa chọn vật tư nào. Chọn thiết bị và nhập số dư đầu kỳ ở bên trái để lập phiếu.
                      </div>
                    ) : (
                      initialItems.map((item, idx) => {
                        const eq = equipment.find(e => e.id === item.equipmentId);
                        return (
                          <div key={idx} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white hover:bg-slate-50/50 transition-colors text-xs">
                            <div className="min-w-0">
                              <span className="text-[9px] font-bold text-blue-600 block uppercase leading-none">{eq?.brand}</span>
                              <span className="font-extrabold text-slate-800 text-xs block mt-1">{eq?.model}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">Mã thiết bị: {item.equipmentId}</span>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-4">
                              <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-black text-slate-400 uppercase">SL:</span>
                                  <input 
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => handleInitialQtyChange(idx, Number(e.target.value))}
                                    className="w-14 px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs"
                                  />
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-black text-slate-400 uppercase">Giá:</span>
                                  <input 
                                    type="number"
                                    min={0}
                                    value={item.unitPrice}
                                    onChange={(e) => handleInitialPriceChange(idx, Number(e.target.value))}
                                    className="w-24 px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs"
                                  />
                                </div>
                              </div>
                              
                              <button
                                type="button"
                                onClick={() => handleRemoveInitialItem(idx)}
                                className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all border border-transparent hover:border-rose-100 cursor-pointer shrink-0"
                              >
                                <Trash className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 font-sans">
                  <button
                    type="button"
                    onClick={() => handleCloseThisForm(false)}
                    className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[10px] transition-all cursor-pointer"
                  >
                    Đóng lại
                  </button>
                  <button
                    type="submit"
                    className="bg-[#0054a6] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Khai báo tồn đầu kỳ
                  </button>
                </div>

              </div>

            </form>
          </div>
        )}

      </div>

      {/* HISTORICAL IMPORT TRANSACTIONS LISTING (LỊCH SỬ PHIẾU NHẬP) */}
      {activeSource === null && (
        <div id="imported-list-panel" className="space-y-4 pt-6 border-t border-slate-100 animate-in fade-in duration-200">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">Danh sách nhập hàng</h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Danh sách các phiếu nhập đã lập kèm hành động xem, in, cập nhật, hủy phiếu</p>
          </div>
        </div>

        {/* Filtering Bar */}
        <div id="imported-filtering-bar" className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input 
              type="text"
              placeholder="Tìm kiếm theo mã phiếu, tên đối tác, loại thiết bị..."
              value={importedSearchTerm}
              onChange={(e) => {
                setImportedSearchTerm(e.target.value);
                setImportedCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 placeholder-slate-400/75 shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2 font-sans">
            <span className="bg-blue-50 text-blue-700 px-3.5 py-2.5 rounded-2xl text-xs font-black border border-blue-100 shadow-xs shrink-0">
              Tổng số: {totalImportedItems} phiếu
            </span>

            <button 
              id="btn-reset-imported-filters"
              onClick={() => {
                setImportedSearchTerm('');
                setImportedCurrentPage(1);
              }}
              className="p-2.5 border border-slate-200 rounded-2xl hover:bg-slate-50 text-slate-500 hover:text-slate-700 transition-all cursor-pointer shadow-xs bg-white"
              title="Đặt lại bộ lọc"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table View */}
        <div id="imported-table-container" className="bg-white rounded-[2.5rem] border border-slate-150 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50">
                  <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Mã phiếu</th>
                  <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Ngày nhập</th>
                  <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Đối tác / Nhà cung cấp</th>
                  <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Vật tư nhập</th>
                  <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-right">Tổng trị giá</th>
                  <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Thanh toán / Nợ</th>
                  <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Ghi chú</th>
                  <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 text-xs">
                {currentImportedTx.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-400 italic font-semibold">
                      Không tìm thấy phiếu nhập kho nào.
                    </td>
                  </tr>
                ) : (
                  currentImportedTx.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/40 transition-all">
                      
                      {/* ID */}
                      <td className="px-6 py-5 font-mono font-black text-slate-900">
                        {tx.id}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-5 font-bold text-slate-600">
                        {tx.date}
                      </td>

                      {/* Partner Name */}
                      <td className="px-6 py-5">
                        <span className="font-extrabold text-slate-800 block">{tx.partnerName}</span>
                        <span className="text-[10px] text-slate-400 font-bold">Mã: {tx.partnerId}</span>
                      </td>

                      {/* Items List Preview */}
                      <td className="px-6 py-5">
                        <div className="max-w-[220px] truncate font-semibold text-slate-700" title={tx.items.map(item => `${item.brand} ${item.model} (x${item.quantity})`).join(', ')}>
                          {tx.items.map(item => `${item.brand} ${item.model} (x${item.quantity})`).join(', ')}
                        </div>
                        <span className="text-[10px] text-blue-600 font-extrabold">{tx.items.length} mặt hàng</span>
                      </td>

                      {/* Total Value */}
                      <td className="px-6 py-5 font-black text-slate-900 text-right">
                        {formatCurrency(tx.totalValue)}
                      </td>

                      {/* Paid / Debt */}
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-emerald-600 font-bold">Đã trả: {formatCurrency(tx.paidAmount || 0)}</span>
                          {tx.debtAmount && tx.debtAmount > 0 ? (
                            <span className="text-rose-500 font-bold">Còn nợ: {formatCurrency(tx.debtAmount)}</span>
                          ) : (
                            <span className="text-slate-400 text-[10px] font-bold">Đã thanh toán hết</span>
                          )}
                        </div>
                      </td>

                      {/* Note */}
                      <td className="px-6 py-5 text-slate-500 italic max-w-[150px] truncate font-medium">
                        {tx.note || 'Không có ghi chú'}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-center gap-1.5">
                          
                          {/* Action: Xem */}
                          <button
                            onClick={() => setSelectedTxForView(tx)}
                            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-xs hover:text-slate-800"
                            title="Xem chi tiết"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {/* Action: Cập nhật */}
                          <button
                            onClick={() => startEditReceipt(tx)}
                            className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 rounded-xl transition-all cursor-pointer shadow-xs hover:text-blue-800"
                            title="Cập nhật phiếu"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          {/* Action: In phiếu */}
                          <button
                            onClick={() => setSelectedTxForPrint(tx)}
                            className="p-2 bg-sky-50 hover:bg-sky-100 text-sky-600 border border-sky-100 rounded-xl transition-all cursor-pointer shadow-xs hover:text-sky-800"
                            title="In phiếu"
                          >
                            <Printer className="h-4 w-4" />
                          </button>

                          {/* Action: Hủy phiếu */}
                          <button
                            onClick={() => handleCancelReceipt(tx)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl transition-all cursor-pointer shadow-xs hover:text-rose-800"
                            title="Hủy phiếu nhập"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                        </div>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div id="imported-pagination-row" className="px-6 py-4 border-t border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/30">
            <div className="text-xs text-slate-500 font-semibold">
              Hiển thị <span className="font-bold text-slate-800">{indexFirstImported + 1}</span> - <span className="font-bold text-slate-800">{Math.min(indexLastImported, totalImportedItems)}</span> của <span className="font-bold text-slate-800">{totalImportedItems}</span> phiếu nhập
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setImportedCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={importedCurrentPage === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              {getImportedPageNumbers().map((p) => (
                <button
                  key={p}
                  onClick={() => setImportedCurrentPage(p)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                    p === importedCurrentPage 
                      ? 'bg-[#0054a6] text-white shadow-xs scale-105' 
                      : 'border border-slate-150 text-slate-600 hover:bg-slate-50/80'
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setImportedCurrentPage(prev => Math.min(importedTotalPages, prev + 1))}
                disabled={importedCurrentPage === importedTotalPages}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="relative shrink-0 font-sans">
              <select
                value={importedPageSize}
                onChange={(e) => {
                  setImportedPageSize(Number(e.target.value));
                  setImportedCurrentPage(1);
                }}
                className="appearance-none pl-4 pr-10 py-1.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 cursor-pointer shadow-xs"
              >
                <option value={5}>5 / trang</option>
                <option value={10}>10 / trang</option>
                <option value={20}>20 / trang</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

        </div>

      </div>

    )}

      {/* MODAL: Lập phiếu nhập kho mới (Popup thủ công) */}
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
                onClick={() => {
                  setShowAddModal(false);
                  setFormProposalId('');
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmitReceipt} className="p-8 space-y-5 overflow-y-auto flex-1 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Supplier Selection */}
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
                    <option value="INITIAL_STOCK">Nhập tồn đầu kỳ</option>
                    <option value="TECH_RETURN">Kỹ thuật trả vật tư</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Ghi chú phiếu nhập</label>
                  <input 
                    type="text"
                    placeholder="Ví dụ: Nhập kho bổ sung hoặc nhập hàng theo HĐ..."
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>

              </div>

              {/* Items Selection Catalogue */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">Lựa chọn vật tư nhập kho</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Equipment Catalogue List */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Danh mục thiết bị hiện có</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl divide-y divide-slate-50">
                      {equipment.map(eq => (
                        <div key={eq.id} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                          <div className="min-w-0">
                            <span className="text-[9px] font-bold text-blue-600 block leading-none">{eq.brand}</span>
                            <span className="font-bold text-slate-800 truncate block mt-0.5">{eq.model}</span>
                            <span className="text-[9px] text-slate-400 font-bold block mt-1">Tồn hiện có: {eq.stock || 0} {eq.unit}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddItem(eq.id)}
                            className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50 active:scale-95 cursor-pointer shrink-0"
                          >
                            Chọn
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chosen Items Details Form */}
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Danh sách đã chọn ({formItems.length})</span>
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
                                  className="text-slate-400 hover:text-rose-650 cursor-pointer"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2 font-sans">
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Số lượng</label>
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

              {/* Summary Calculations */}
              {formItems.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 font-sans">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Tổng giá trị hàng nhập:</span>
                    <span className="text-slate-950 font-black text-sm">{formatCurrency(calculateTotalValue())}</span>
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
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Ghi nợ NCC (Công nợ)</label>
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
                onClick={() => {
                  setShowAddModal(false);
                  setFormProposalId('');
                }}
                className="bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                id="btn-submit-import-receipt"
                onClick={handleSubmitReceipt}
                className="bg-[#0054a6] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Ký duyệt & Nhập kho
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: View Receipt Details */}
      {selectedTxForView && (
        <div id="view-tx-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] border border-slate-100 shadow-2xl p-8 flex flex-col justify-between max-h-[90vh]">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  Chi tiết phiếu nhập kho
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
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Nhà cung cấp / Đối tác</span>
                  <span className="font-bold text-slate-900 text-sm block mt-0.5">{selectedTxForView.partnerName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Ngày nhập kho</span>
                  <span className="font-bold text-slate-900 text-sm block mt-0.5">{selectedTxForView.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Người lập phiếu</span>
                  <span className="font-bold text-slate-900 block mt-0.5">{selectedTxForView.createdByName || 'Thủ kho Solar'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Ghi chú</span>
                  <span className="font-bold text-slate-700 block mt-0.5">{selectedTxForView.note || 'Không có'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block mb-2">Danh sách thiết bị nhập kho</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {selectedTxForView.items.map((item, index) => (
                    <div key={index} className="p-3 flex justify-between items-center bg-white hover:bg-slate-50/50">
                      <div>
                        <span className="text-[9px] text-blue-600 uppercase font-extrabold block leading-none">{item.brand}</span>
                        <span className="font-bold text-slate-900 text-xs block mt-1">{item.model}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-slate-800 text-xs block">x{item.quantity} {item.unit}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Đơn giá: {formatCurrency(item.unitPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 font-sans text-xs">
                <div className="flex justify-between font-bold text-slate-500">
                  <span>Tổng giá trị đơn hàng:</span>
                  <span className="text-slate-900 font-black">{formatCurrency(selectedTxForView.totalValue)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-600">
                  <span>Đã thanh toán:</span>
                  <span>{formatCurrency(selectedTxForView.paidAmount || 0)}</span>
                </div>
                {selectedTxForView.debtAmount && selectedTxForView.debtAmount > 0 ? (
                  <div className="flex justify-between font-bold text-rose-600">
                    <span>Còn ghi nợ:</span>
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

      {/* MODAL: Xem bản in phiếu nhập (Print area) */}
      {selectedTxForPrint && (
        <div id="print-tx-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-[2.5rem] border border-slate-100 shadow-2xl p-8 flex flex-col justify-between my-8 animate-in zoom-in-95 duration-250">
            
            <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Xem bản in phiếu nhập</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.print()}
                  className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="h-4 w-4" />
                  In ngay
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
                  <h1 className="text-lg font-black text-slate-900 tracking-wider">PHIẾU NHẬP KHO</h1>
                  <p className="text-slate-600 mt-1 font-bold">Số phiếu: {selectedTxForPrint.id}</p>
                  <p className="text-slate-400">Ngày nhập: {selectedTxForPrint.date}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6 text-xs border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                <div>
                  <span className="text-slate-400 uppercase font-bold block mb-1">ĐƠN VỊ GIAO HÀNG (ĐỐI TÁC)</span>
                  <span className="font-extrabold text-slate-900 text-sm block">{selectedTxForPrint.partnerName}</span>
                  <span className="text-slate-500 mt-1 block">Mã nhà cung cấp: {selectedTxForPrint.partnerId}</span>
                </div>
                <div>
                  <span className="text-slate-400 uppercase font-bold block mb-1">ĐƠN VỊ TIẾP NHẬN (KHO HÀNG)</span>
                  <span className="font-extrabold text-slate-900 text-sm block">Kho vật tư chính Solar Việt Nam</span>
                  <span className="text-slate-500 mt-1 block">Người lập phiếu: {selectedTxForPrint.createdByName || 'Thủ kho Solar'}</span>
                </div>
              </div>

              <table className="w-full text-left border-collapse border border-slate-300 mb-6 font-sans">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="p-3 font-extrabold text-slate-800 border-r border-slate-300 text-center w-12">STT</th>
                    <th className="p-3 font-extrabold text-slate-800 border-r border-slate-300">Tên vật tư / Thiết bị Solar</th>
                    <th className="p-3 font-extrabold text-slate-800 border-r border-slate-300 text-center w-16">ĐVT</th>
                    <th className="p-3 font-extrabold text-slate-800 border-r border-slate-300 text-center w-20">Số lượng</th>
                    <th className="p-3 font-extrabold text-slate-800 border-r border-slate-300 text-right w-28">Đơn giá</th>
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
                  <span>Cộng tiền hàng:</span>
                  <span className="text-slate-900 font-black">{formatCurrency(selectedTxForPrint.totalValue)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Đã thanh toán:</span>
                  <span className="font-black">{formatCurrency(selectedTxForPrint.paidAmount || 0)}</span>
                </div>
                {selectedTxForPrint.debtAmount && selectedTxForPrint.debtAmount > 0 ? (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Còn ghi nợ:</span>
                    <span className="font-black">{formatCurrency(selectedTxForPrint.debtAmount)}</span>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-4 text-center mt-12 pt-6 border-t border-slate-200 font-sans">
                <div>
                  <h4 className="font-extrabold text-slate-800">Người giao hàng</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">(Ký, ghi rõ họ tên)</p>
                  <div className="h-20"></div>
                  <p className="font-bold text-slate-500">.................................</p>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800">Người nhận hàng (Thủ kho)</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">(Ký, đóng dấu nếu có)</p>
                  <div className="h-20"></div>
                  <p className="font-black text-slate-900">{selectedTxForPrint.createdByName || 'Thủ kho Solar'}</p>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800">Kế toán trưởng</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">(Ký, duyệt thanh toán)</p>
                  <div className="h-20"></div>
                  <p className="font-bold text-slate-500">.................................</p>
                </div>
              </div>

            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedTxForPrint(null)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Đóng xem trước
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Cập nhật phiếu nhập kho */}
      {showEditModal && (
        <div id="edit-receipt-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] border border-slate-100 shadow-2xl flex flex-col justify-between max-h-[90vh]">
            
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600" />
                Cập nhật phiếu nhập kho #{editingTxId}
              </h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateReceiptSubmit} className="p-8 space-y-5 overflow-y-auto flex-1 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Đối tác / Nhà cung cấp *</label>
                  <select
                    required
                    value={editSupplierId}
                    onChange={(e) => setEditSupplierId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  >
                    <option value="">-- Chọn Nhà cung cấp --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    <option value="INITIAL_STOCK">Hàng tồn kho đầu kỳ</option>
                    <option value="TECH_RETURN">Kỹ thuật trả vật tư</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Ghi chú phiếu nhập</label>
                  <input 
                    type="text"
                    placeholder="Ghi chú phiếu nhập..."
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                  />
                </div>
              </div>

              {/* Items Table Area */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-slate-50/50">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-3">Lựa chọn vật tư nhập kho</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Danh mục thiết bị</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl divide-y divide-slate-50">
                      {equipment.map(eq => (
                        <div key={eq.id} className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs">
                          <div className="min-w-0">
                            <span className="text-[9px] font-bold text-blue-600 block leading-none">{eq.brand}</span>
                            <span className="font-bold text-slate-800 truncate block mt-0.5">{eq.model}</span>
                            <span className="text-[9px] text-slate-400 font-bold block mt-1">Tồn hiện tại: {eq.stock || 0} {eq.unit}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddEditItem(eq.id)}
                            className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border border-blue-100 text-blue-600 hover:bg-blue-50 active:scale-95 cursor-pointer shrink-0"
                          >
                            Chọn
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">Danh sách chọn ({editItems.length})</span>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 bg-white rounded-xl p-2 space-y-2">
                      {editItems.length === 0 ? (
                        <div className="h-40 flex flex-col items-center justify-center text-center text-slate-400 italic text-[11px] font-semibold p-4">
                          Chọn thiết bị ở cột trái để thêm vào phiếu nhập kho.
                        </div>
                      ) : (
                        editItems.map((item, idx) => {
                          const eq = equipment.find(e => e.id === item.equipmentId);
                          return (
                            <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-2 text-xs">
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-bold text-slate-800 line-clamp-1">{eq?.brand} {eq?.model}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditItem(idx)}
                                  className="text-slate-400 hover:text-rose-650 cursor-pointer"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-2 font-sans">
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Số lượng</label>
                                  <input 
                                    type="number"
                                    min={1}
                                    value={item.quantity}
                                    onChange={(e) => handleEditQtyChange(idx, Number(e.target.value))}
                                    className="w-full px-2 py-1 rounded border border-slate-200 text-center font-bold text-xs bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="text-[8px] font-black text-slate-400 uppercase block mb-0.5">Đơn giá nhập</label>
                                  <input 
                                    type="number"
                                    min={0}
                                    value={item.unitPrice}
                                    onChange={(e) => handleEditPriceChange(idx, Number(e.target.value))}
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

              {editItems.length > 0 && (
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 font-sans">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Tổng trị giá nhập kho:</span>
                    <span className="text-slate-950 font-black">{formatCurrency(calculateEditTotalValue())}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Đã thanh toán (VND)</label>
                      <input 
                        type="number"
                        min={0}
                        max={calculateEditTotalValue()}
                        value={editPaidAmount}
                        onChange={(e) => setEditPaidAmount(Number(e.target.value))}
                        className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Ghi nợ nhà cung cấp</label>
                      <div className="px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 font-extrabold text-xs text-rose-600">
                        {formatCurrency(Math.max(0, calculateEditTotalValue() - editPaidAmount))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </form>

            <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleUpdateReceiptSubmit}
                className="bg-[#0054a6] hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Lưu cập nhật
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Thêm nhanh nhà cung cấp mới */}
      {showQuickAddSupplierModal && (
        <div id="quick-add-supplier-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-[2rem] border border-slate-100 shadow-2xl flex flex-col justify-between p-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-150">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Building className="h-5 w-5 text-blue-600" />
                Thêm Nhà Cung Cấp Mới
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setShowQuickAddSupplierModal(false);
                  setQuickSupName('');
                  setQuickSupPhone('');
                  setQuickSupAddress('');
                }}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer border border-slate-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddSupplier} className="space-y-4 py-4 font-sans text-xs">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Tên nhà cung cấp <span className="text-red-500">*</span></label>
                <input 
                  type="text"
                  required
                  placeholder="Nhập tên nhà cung cấp"
                  value={quickSupName}
                  onChange={(e) => setQuickSupName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Số điện thoại <span className="text-red-500">*</span></label>
                <input 
                  type="text"
                  required
                  placeholder="Nhập số điện thoại"
                  value={quickSupPhone}
                  onChange={(e) => setQuickSupPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Địa chỉ</label>
                <textarea 
                  placeholder="Nhập địa chỉ"
                  value={quickSupAddress}
                  onChange={(e) => setQuickSupAddress(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAddSupplierModal(false);
                    setQuickSupName('');
                    setQuickSupPhone('');
                    setQuickSupAddress('');
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

      {/* MODAL: Thêm nhanh vật tư mới */}
      {showQuickAddEquipModal && (
        <div id="quick-add-equipment-modal" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-[2rem] border border-slate-100 shadow-2xl flex flex-col justify-between p-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-150">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Thêm Vật Tư Mới
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

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-150">
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

    </div>
  );
}
