import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  X, 
  Check, 
  AlertTriangle, 
  Calendar, 
  Users, 
  Briefcase, 
  CheckCircle2, 
  Package, 
  Box,
  Cpu,
  Battery,
  ArrowLeft,
  Upload,
  Phone,
  Download,
  Clock,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, setDoc, updateDoc, getDocs, onSnapshot, query, orderBy, getDoc, addDoc, increment, deleteDoc } from 'firebase/firestore';
import { MaterialRequest, Equipment, WarehouseSupplier } from './types';

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

interface MaterialRequestsProps {
  requests: MaterialRequest[];
  equipment: Equipment[];
  suppliers?: WarehouseSupplier[];
  userRole: string;
  onOpenDocument: (id: string, type: 'pn' | 'px' | 'dexuat' | 'muahang', label: string) => void;
  onOpenProject?: (id: string) => void;
}

export default function MaterialRequests({ requests, equipment, suppliers = [], userRole, onOpenDocument, onOpenProject }: MaterialRequestsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'draft'>('all');
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [reviewingRequest, setReviewingRequest] = useState<MaterialRequest | null>(null);

  // Database lists
  const [projects, setProjects] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Record<string, any>>({});
  const [projectSearch, setProjectSearch] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // Create Request Form State
  const [formProjectId, setFormProjectId] = useState('');
  const [formTechnicianName, setFormTechnicianName] = useState('Mr Lành');
  const [formReason, setFormReason] = useState('');
  const [formItems, setFormItems] = useState<Array<{ equipmentId: string, quantity: number }>>([]);

  // Search equipment in creation mode
  const [eqSearch, setEqSearch] = useState('');

  // Quick Add Goods Modal & Form States
  const [showQuickAddGoodsModal, setShowQuickAddGoodsModal] = useState(false);
  const [quickBrand, setQuickBrand] = useState('');
  const [quickModel, setQuickModel] = useState('');
  const [quickType, setQuickType] = useState<'panel' | 'inverter' | 'battery' | 'mounting' | 'accessory' | 'other'>('other');
  const [quickUnit, setQuickUnit] = useState('Cái');
  const [quickStock, setQuickStock] = useState(10);
  const [quickUnitPrice, setQuickUnitPrice] = useState(0);
  const [quickSupplier, setQuickSupplier] = useState('Chưa liên kết');

  // Quick Add Goods Handler
  const handleQuickAddGoods = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBrand.trim() || !quickModel.trim()) {
      alert('Vui lòng nhập Thương hiệu và Model.');
      return;
    }
    try {
      const newId = 'VT' + Math.floor(100 + Math.random() * 900);
      const payload: Equipment = {
        id: newId,
        brand: quickBrand.trim(),
        model: quickModel.trim(),
        type: quickType,
        capacity: 0,
        unit: quickUnit.trim(),
        stock: Number(quickStock),
        minStock: 5,
        unitPrice: Number(quickUnitPrice),
        sellingPrice: Number(quickUnitPrice * 1.2),
        location: 'Kệ A1',
        supplier: quickSupplier,
        details: 'Được thêm nhanh từ form đề xuất'
      };

      await setDoc(doc(db, 'equipment', newId), payload);
      
      // Automatically add the newly created item into the formItems of the active request
      handleAddFormItem(newId);

      // Reset Form State & Close Modal
      setShowQuickAddGoodsModal(false);
      setQuickBrand('');
      setQuickModel('');
      setQuickType('other');
      setQuickUnit('Cái');
      setQuickStock(10);
      setQuickUnitPrice(0);
      setQuickSupplier('Chưa liên kết');

      alert(`Đã thêm nhanh vật tư mới "${payload.brand} ${payload.model}" thành công và tự động chọn vào danh sách đề xuất!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'equipment');
    }
  };

  // Current formatted time for form
  const [currentTime, setCurrentTime] = useState('');

  // Review Form State
  const [reviewAdminNote, setReviewAdminNote] = useState('');

  const getProjectDisplayName = (p: any) => {
    if (!p) return '';
    const custName = p.customerName || customers[p.customerId]?.name || 'Khách hàng';
    return `Hòa Lưới ${p.systemSizeKWp || 5}kWp - ${custName}`;
  };

  // Clock update effect
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      setCurrentTime(`${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // F3 Keydown to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        const el = document.getElementById('eq-search-input');
        if (el) el.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load Projects & Customers
  useEffect(() => {
    const fetchProjectsAndCustomers = async () => {
      try {
        const snap = await getDocs(collection(db, 'projects'));
        setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() })));

        const custSnap = await getDocs(collection(db, 'customers'));
        const custMap: Record<string, any> = {};
        custSnap.docs.forEach(doc => {
          custMap[doc.id] = { id: doc.id, ...doc.data() };
        });
        setCustomers(custMap);
      } catch (err) {
        console.error('Error fetching projects or customers:', err);
      }
    };
    fetchProjectsAndCustomers();
  }, []);

  // Filter Requests
  const filteredRequests = requests.filter(req => {
    const searchMatch = 
      (req.technicianName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (req.projectName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
      (req.id || '').toLowerCase().includes((searchTerm || '').toLowerCase());

    const statusMatch = statusFilter === 'all' || req.status === statusFilter;

    return searchMatch && statusMatch;
  });

  // Filter Equipment suggestions
  const eqSuggestions = equipment.filter(eq => 
    (eq.id || '').toLowerCase().includes(eqSearch.toLowerCase()) ||
    (eq.brand || '').toLowerCase().includes(eqSearch.toLowerCase()) ||
    (eq.model || '').toLowerCase().includes(eqSearch.toLowerCase()) ||
    (eq.details || '').toLowerCase().includes(eqSearch.toLowerCase()) ||
    (eq.type || '').toLowerCase().includes(eqSearch.toLowerCase())
  );

  // Items handling for new request
  const handleAddFormItem = (equipmentId: string) => {
    if (formItems.some(item => item.equipmentId === equipmentId)) return;
    setFormItems([...formItems, { equipmentId, quantity: 1 }]);
  };

  const handleRemoveFormItem = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  const handleQtyChange = (idx: number, qty: number) => {
    if (qty < 1) return;
    const newItems = [...formItems];
    newItems[idx].quantity = qty;
    setFormItems(newItems);
  };

  // Add quick temporary project
  const handleAddQuickProject = async () => {
    const name = prompt('Nhập tên công trình thi công mới:');
    if (!name) return;
    try {
      const projId = 'PROJ-' + Math.floor(1000 + Math.random() * 9000);
      const newProj = {
        id: projId,
        customerName: name,
        systemSizeKWp: 10,
        status: 'planning',
        createdAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'projects', projId), newProj);
      setProjects(prev => [...prev, newProj]);
      setFormProjectId(projId);
    } catch (err) {
      console.error('Error adding quick project:', err);
    }
  };

  // Simulate Excel Upload
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const available = equipment.filter(eq => (eq.stock || 0) > 0);
    if (available.length === 0) {
      alert('Không có vật tư khả dụng trong kho để nhập.');
      return;
    }

    const count = Math.min(3, available.length);
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    const importedItems = selected.map(eq => ({
      equipmentId: eq.id,
      quantity: Math.min(5, eq.stock || 1)
    }));

    setFormItems(importedItems);
    alert(`Đã nhập thành công ${importedItems.length} vật tư từ tệp tin "${file.name}"!`);
  };

  // Download template CSV file
  const handleDownloadTemplate = () => {
    const headers = "STT,MÃ VẬT TƯ,TÊN VẬT TƯ,SỐ LƯỢNG\n1,EQ-01,Tấm Pin Jinko,20\n2,EQ-02,Inverter Sofar,1";
    const blob = new Blob([headers], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "mau_de_xuat_cap_vat_tu.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Start editing a draft
  const handleStartEditDraft = (req: MaterialRequest) => {
    setEditingRequestId(req.id);
    setFormProjectId(req.projectId);
    setFormTechnicianName(req.technicianName || 'Mr Lành');
    setFormReason(req.reason || '');
    setFormItems(req.items.map(item => ({
      equipmentId: item.equipmentId,
      quantity: item.quantity
    })));
    setShowAddModal(true);
  };

  // Cancel/Delete draft
  const handleDeleteDraft = async (id: string) => {
    const confirmDelete = window.confirm(`Bạn có chắc chắn muốn hủy và xóa vĩnh viễn phiếu tạm #${id}?`);
    if (!confirmDelete) return;
    try {
      await deleteDoc(doc(db, 'material_requests', id));
      alert(`Đã hủy thành công phiếu tạm #${id}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'material_requests');
    }
  };

  // Reset and close creation/edit form
  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setEditingRequestId(null);
    setFormProjectId('');
    setFormTechnicianName('Mr Lành');
    setFormReason('');
    setFormItems([]);
  };

  // Save Draft (Lưu Tạm)
  const handleSaveDraft = async () => {
    if (!formProjectId) {
      alert('Vui lòng chọn công trình cần liên kết.');
      return;
    }
    if (formItems.length === 0) {
      alert('Vui lòng chọn ít nhất 1 vật tư yêu cầu.');
      return;
    }

    try {
      const selectedProj = projects.find(p => p.id === formProjectId);
      const projName = selectedProj ? getProjectDisplayName(selectedProj) : 'Dự án Solar';
      const reqId = editingRequestId || ('DX-' + Math.floor(1000 + Math.random() * 9000));

      const payload: MaterialRequest = {
        id: reqId,
        projectId: formProjectId,
        projectName: projName,
        technicianId: 'TECH_' + Math.floor(10 + Math.random() * 90),
        technicianName: formTechnicianName || 'Mr Lành',
        reason: formReason.trim() || 'Nháp / Lưu tạm đề xuất cấp phát',
        status: 'draft',
        createdAt: new Date().toISOString(),
        items: formItems.map(item => {
          const eq = equipment.find(e => e.id === item.equipmentId);
          return {
            equipmentId: item.equipmentId,
            brand: eq?.brand || 'Chưa rõ',
            model: eq?.model || 'Vật tư',
            type: eq?.type || 'other',
            quantity: item.quantity,
            unit: eq?.unit || 'Cái'
          };
        })
      };

      await setDoc(doc(db, 'material_requests', reqId), payload);
      alert(editingRequestId ? `Cập nhật thành công phiếu tạm ${reqId}!` : `Lưu tạm thành công phiếu đề xuất ${reqId}!`);
      handleCloseAddModal();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'material_requests');
    }
  };

  // Create Material Request
  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectId || !formTechnicianName || formItems.length === 0) {
      alert('Vui lòng nhập đầy đủ thông tin dự án, kỹ thuật viên và ít nhất 1 vật tư yêu cầu.');
      return;
    }

    try {
      const selectedProj = projects.find(p => p.id === formProjectId);
      const projName = selectedProj ? getProjectDisplayName(selectedProj) : 'Dự án Solar';
      
      const reqId = editingRequestId || ('DX-' + Math.floor(1000 + Math.random() * 9000));
      
      const payload: MaterialRequest = {
        id: reqId,
        projectId: formProjectId,
        projectName: projName,
        technicianId: 'TECH_' + Math.floor(10 + Math.random() * 90),
        technicianName: formTechnicianName.trim(),
        reason: formReason.trim() || 'Cấp phát thi công công trình solar',
        status: 'pending',
        createdAt: new Date().toISOString(),
        items: formItems.map(item => {
          const eq = equipment.find(e => e.id === item.equipmentId);
          return {
            equipmentId: item.equipmentId,
            brand: eq?.brand || 'Chưa rõ',
            model: eq?.model || 'Vật tư',
            type: eq?.type || 'other',
            quantity: item.quantity,
            unit: eq?.unit || 'Cái'
          };
        })
      };

      await setDoc(doc(db, 'material_requests', reqId), payload);
      alert(editingRequestId ? `Phát hành thành công phiếu đề xuất ${reqId} từ bản nháp!` : `Tạo mới thành công đề xuất ${reqId}!`);
      handleCloseAddModal();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'material_requests');
    }
  };

  // Approve Request
  const handleApprove = async () => {
    if (!reviewingRequest) return;
    try {
      const items = reviewingRequest.items || [];
      if (items.length === 0) {
        alert('Phiếu đề xuất không có vật tư nào.');
        return;
      }

      // 1. Fetch live stock for all items
      const liveEquipData: { [id: string]: any } = {};
      for (const item of items) {
        const eqRef = doc(db, 'equipment', item.equipmentId);
        const eqSnap = await getDoc(eqRef);
        if (eqSnap.exists()) {
          liveEquipData[item.equipmentId] = eqSnap.data();
        }
      }

      // 2. Fetch suppliers to match supplier info for purchase proposals
      let suppliersList: any[] = [];
      try {
        const suppliersSnap = await getDocs(collection(db, 'suppliers'));
        suppliersList = suppliersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.error("Error fetching suppliers:", e);
      }

      // Helper to group items by supplier and create purchase proposals automatically
      const createGroupedPurchaseProposals = async (itemsToPurchase: Array<{
        equipmentId: string;
        brand: string;
        model: string;
        type: string;
        quantity: number;
        unitPrice: number;
        unit: string;
      }>, reasonType: string) => {
        const groups: { [supplierId: string]: { supplierName: string; items: typeof itemsToPurchase } } = {};
        
        for (const item of itemsToPurchase) {
          let chosenSupplierId = 'SUP001';
          let chosenSupplierName = 'Solar Sông Đà';
          
          if (suppliersList.length > 0) {
            const eq = liveEquipData[item.equipmentId];
            if (eq?.supplier) {
              const foundSup = suppliersList.find(s => 
                s.name?.toLowerCase().includes(eq.supplier!.toLowerCase()) || 
                eq.supplier!.toLowerCase().includes(s.name?.toLowerCase())
              );
              if (foundSup) {
                chosenSupplierId = foundSup.id;
                chosenSupplierName = foundSup.name;
              } else {
                chosenSupplierId = suppliersList[0].id || 'SUP001';
                chosenSupplierName = suppliersList[0].name || 'Solar Sông Đà';
              }
            } else {
              chosenSupplierId = suppliersList[0].id || 'SUP001';
              chosenSupplierName = suppliersList[0].name || 'Solar Sông Đà';
            }
          }
          
          if (!groups[chosenSupplierId]) {
            groups[chosenSupplierId] = { supplierName: chosenSupplierName, items: [] };
          }
          groups[chosenSupplierId].items.push(item);
        }
        
        const proposalIds: string[] = [];
        for (const [supId, group] of Object.entries(groups)) {
          const propId = 'MH-' + Math.floor(1000 + Math.random() * 9000);
          const totalCost = group.items.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0);
          
          const purchaseProposal = {
            id: propId,
            supplierId: supId,
            supplierName: group.supplierName,
            reason: `Mua bổ sung tự động cho đề xuất cấp phát ${reviewingRequest.id} (${reasonType})`,
            totalCost,
            status: 'pending',
            createdAt: new Date().toISOString(),
            items: group.items
          };
          await setDoc(doc(db, 'purchase_proposals', propId), purchaseProposal);
          proposalIds.push(propId);
        }
        return proposalIds;
      };

      // 3. Process items to calculate exportQty and purchaseQty
      let fullySatisfiedCount = 0;
      const processedItems: Array<{
        equipmentId: string;
        brand: string;
        model: string;
        type: string;
        unit: string;
        quantity: number;
        exportQty: number;
        purchaseQty: number;
        unitPrice: number;
      }> = [];

      for (const item of items) {
        const eq = liveEquipData[item.equipmentId];
        const currentStock = eq ? (eq.stock || 0) : 0;
        const unitPrice = eq?.unitPrice || 2000000;

        if (currentStock >= item.quantity) {
          fullySatisfiedCount++;
          processedItems.push({
            ...item,
            exportQty: item.quantity,
            purchaseQty: 0,
            unitPrice
          });
        } else {
          processedItems.push({
            ...item,
            exportQty: currentStock > 0 ? currentStock : 0,
            purchaseQty: item.quantity - (currentStock > 0 ? currentStock : 0),
            unitPrice
          });
        }
      }

      // 4. Classify the scenarios
      let scenario: 'all_satisfied' | 'partially_satisfied' | 'not_satisfied' = 'partially_satisfied';
      if (fullySatisfiedCount === items.length) {
        scenario = 'all_satisfied';
      } else if (fullySatisfiedCount === 0) {
        scenario = 'not_satisfied';
      }

      let receiptId = '';
      let proposalId = '';
      let messageSuffix = '';

      // Prepare Export & Purchase Lists based on scenario
      if (scenario === 'all_satisfied') {
        // --- CASE 1: ĐÁP ỨNG 100% ---
        receiptId = 'PX' + Math.floor(100000 + Math.random() * 899999);
        const exportItemsList = processedItems.map(item => ({
          equipmentId: item.equipmentId,
          brand: item.brand,
          model: item.model,
          type: item.type,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit
        }));
        const exportTotalValue = exportItemsList.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

        // Save Export Receipt
        const exportReceipt = {
          id: receiptId,
          type: 'export',
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          partnerId: reviewingRequest.projectId || 'PRJ_TEMP',
          partnerName: reviewingRequest.projectName || 'Dự án Solar',
          totalValue: exportTotalValue,
          note: `Xuất kho tự động - Đề xuất #${reviewingRequest.id} được đáp ứng 100%`,
          createdBy: 'system_approval',
          createdByName: 'Hệ thống tự động',
          items: exportItemsList
        };
        await setDoc(doc(db, 'inventory_transactions', receiptId), exportReceipt);

        // Deduct Stock
        for (const item of exportItemsList) {
          const eqRef = doc(db, 'equipment', item.equipmentId);
          await updateDoc(eqRef, {
            stock: increment(-item.quantity)
          });
        }

        messageSuffix = `Phiếu xuất kho #${receiptId} đã được tạo tự động và trừ tồn kho thành công.`;

      } else if (scenario === 'partially_satisfied') {
        // --- CASE 2: ĐÁP ỨNG MỘT PHẦN ---
        // Export the satisfied part (any item where exportQty > 0)
        const exportItemsList = processedItems
          .filter(item => item.exportQty > 0)
          .map(item => ({
            equipmentId: item.equipmentId,
            brand: item.brand,
            model: item.model,
            type: item.type,
            quantity: item.exportQty,
            unitPrice: item.unitPrice,
            unit: item.unit
          }));

        if (exportItemsList.length > 0) {
          receiptId = 'PX' + Math.floor(100000 + Math.random() * 899999);
          const exportTotalValue = exportItemsList.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

          const exportReceipt = {
            id: receiptId,
            type: 'export',
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            partnerId: reviewingRequest.projectId || 'PRJ_TEMP',
            partnerName: reviewingRequest.projectName || 'Dự án Solar',
            totalValue: exportTotalValue,
            note: `Xuất kho một phần tự động - Đề xuất #${reviewingRequest.id}`,
            createdBy: 'system_approval',
            createdByName: 'Hệ thống tự động',
            items: exportItemsList
          };
          await setDoc(doc(db, 'inventory_transactions', receiptId), exportReceipt);

          // Deduct Stock
          for (const item of exportItemsList) {
            const eqRef = doc(db, 'equipment', item.equipmentId);
            await updateDoc(eqRef, {
              stock: increment(-item.quantity)
            });
          }
        }

        // Generate supplementary Purchase Proposal (any item where purchaseQty > 0)
        const purchaseItemsList = processedItems
          .filter(item => item.purchaseQty > 0)
          .map(item => ({
            equipmentId: item.equipmentId,
            brand: item.brand,
            model: item.model,
            type: item.type,
            quantity: item.purchaseQty,
            unitPrice: item.unitPrice,
            unit: item.unit
          }));

        let createdProposalIds: string[] = [];
        if (purchaseItemsList.length > 0) {
          createdProposalIds = await createGroupedPurchaseProposals(purchaseItemsList, 'đáp ứng một phần');
          proposalId = createdProposalIds.join(', ');
        }

        const part1 = receiptId ? `Phiếu xuất phần đủ #${receiptId} đã được tạo và trừ tồn.` : `Không có sản phẩm nào đủ để xuất.`;
        const part2 = createdProposalIds.length > 0 
          ? ` Các phiếu đề xuất mua bổ sung #${createdProposalIds.join(', #')} cho phần thiếu đã được lưu vào mục Mua hàng.` 
          : ``;
        messageSuffix = `${part1}${part2}`;

      } else {
        // --- CASE 3: KHÔNG ĐÁP ỨNG ---
        // Do NOT export. Do NOT deduct stock.
        // Create full Purchase Proposal.
        const purchaseItemsList = processedItems.map(item => ({
          equipmentId: item.equipmentId,
          brand: item.brand,
          model: item.model,
          type: item.type,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unit: item.unit
        }));

        const createdProposalIds = await createGroupedPurchaseProposals(purchaseItemsList, 'thiếu hàng toàn bộ');
        proposalId = createdProposalIds.join(', ');

        messageSuffix = `Không có vật tư nào đủ tồn nên không xuất kho. Đã tự động tạo các Phiếu mua hàng toàn bộ #${createdProposalIds.join(', #')} cho phần thiếu.`;
      }

      // 5. Update Status on original Material Request
      const customNote = reviewAdminNote.trim() || (
        scenario === 'all_satisfied' ? 'Phê duyệt: Đáp ứng 100%' :
        scenario === 'partially_satisfied' ? 'Phê duyệt: Đáp ứng một phần, mua bổ sung' :
        'Phê duyệt: Không đáp ứng, mua hàng toàn bộ'
      );

      await updateDoc(doc(db, 'material_requests', reviewingRequest.id), {
        status: 'approved',
        adminNote: `${customNote}. (${messageSuffix})`
      });

      // 6. Broadcast Notifications to Ketoan, Kythuat, admin via 'notifications' collection
      const roles = ['Kế toán', 'Kỹ thuật', 'Admin'];
      for (const role of roles) {
        let title = '';
        let message = '';
        if (scenario === 'all_satisfied') {
          title = `[KHO - ĐÁP ỨNG 100%] Đề xuất #${reviewingRequest.id}`;
          message = `Đề xuất cấp phát #${reviewingRequest.id} của ${reviewingRequest.technicianName} cho dự án ${reviewingRequest.projectName} được DUYỆT 100%. Đã xuất kho Phiếu #${receiptId} và trừ tồn thành công.`;
        } else if (scenario === 'partially_satisfied') {
          title = `[KHO - ĐÁP ỨNG MỘT PHẦN] Đề xuất #${reviewingRequest.id}`;
          message = `Đề xuất cấp phát #${reviewingRequest.id} của ${reviewingRequest.technicianName} được DUYỆT MỘT PHẦN. Đã xuất kho Phiếu #${receiptId} và tạo yêu cầu mua bổ sung #${proposalId}.`;
        } else {
          title = `[KHO - THIẾU HÀNG TOÀN BỘ] Đề xuất #${reviewingRequest.id}`;
          message = `Đề xuất cấp phát #${reviewingRequest.id} của ${reviewingRequest.technicianName} KHÔNG ĐÁP ỨNG. Không xuất kho, đã tạo tự động Phiếu đề xuất mua toàn bộ #${proposalId}.`;
        }

        await addDoc(collection(db, 'notifications'), {
          type: 'task',
          title,
          message: `[Gửi ${role}] ${message}`,
          createdBy: 'system_approval',
          createdByName: 'Hệ thống tự động',
          createdAt: new Date().toISOString()
        });
      }

      // Success feedback
      alert(`Đã duyệt thành công đề xuất #${reviewingRequest.id}!\n\nChi tiết xử lý: ${messageSuffix}`);

      setReviewingRequest(null);
      setReviewAdminNote('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'material_requests');
    }
  };

  // Reject Request
  const handleReject = async () => {
    if (!reviewingRequest) return;
    try {
      await updateDoc(doc(db, 'material_requests', reviewingRequest.id), {
        status: 'rejected',
        adminNote: reviewAdminNote.trim() || 'Từ chối đề xuất cấp vật tư.'
      });
      setReviewingRequest(null);
      setReviewAdminNote('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'material_requests');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Search and Filters Header */}
      <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Tìm kiếm theo tên kỹ thuật, dự án, mã đề xuất..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-medium text-xs text-slate-700"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex border border-slate-200 bg-slate-50 rounded-2xl p-1 shrink-0">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'draft', label: 'Lưu tạm' },
              { id: 'pending', label: 'Chờ duyệt' },
              { id: 'approved', label: 'Đã duyệt' },
              { id: 'rejected', label: 'Từ chối' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === tab.id 
                    ? 'bg-white text-slate-800 shadow-xs' 
                    : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button 
            onClick={() => {
              setEditingRequestId(null);
              setFormProjectId('');
              setFormTechnicianName('Mr Lành');
              setFormReason('');
              setFormItems([]);
              setShowAddModal(true);
            }}
            className="bg-[#0054a6] hover:bg-blue-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 active:scale-95 shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Tạo Đề Xuất Cấp
          </button>
        </div>
      </div>

      {/* INLINE FORM: Create Material Request */}
      {showAddModal && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-200 shadow-xs animate-fade-in">
          {/* Left Pane: Chọn vật tư */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 p-6 shadow-xs relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <button 
                type="button"
                onClick={handleCloseAddModal}
                className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-blue-600 transition-all font-black text-xs uppercase tracking-wider shrink-0 bg-transparent border-0 outline-none"
              >
                <ArrowLeft className="h-4.5 w-4.5 text-blue-600" />
                <span>CHỌN VẬT TƯ</span>
              </button>

              <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl justify-end z-20">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input 
                    id="eq-search-input"
                    type="text"
                    placeholder="Tìm hàng hóa theo mã hoặc tên (F3)"
                    value={eqSearch}
                    onChange={(e) => setEqSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-[11px] font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-slate-700"
                  />
                  {eqSearch && (
                    <button onClick={() => setEqSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-transparent border-0 outline-none">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Suggestions dropdown */}
                  {eqSearch && (
                    <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-30 divide-y divide-slate-100">
                      {eqSuggestions.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 italic">Không tìm thấy vật tư nào...</div>
                      ) : (
                        eqSuggestions.map(eq => (
                          <div 
                            key={eq.id} 
                            onClick={() => {
                              handleAddFormItem(eq.id);
                              setEqSearch('');
                            }}
                            className="p-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-extrabold text-slate-800">{eq.brand} {eq.model}</span>
                              <span className="text-[10px] text-slate-400 block">Mã: {eq.id} | Tồn: {eq.stock} {eq.unit}</span>
                            </div>
                            <Plus className="h-3.5 w-3.5 text-blue-500" />
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowQuickAddGoodsModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-all active:scale-95 h-[34px]"
                >
                  <Plus className="h-4 w-4" /> Thêm nhanh hàng hóa
                </button>
              </div>

              {/* HIGH-FIDELITY MODAL: Thêm nhanh hàng hóa */}
              {showQuickAddGoodsModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-up">
                    
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <Package className="h-5 w-5 text-emerald-600" />
                        <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">THÊM NHANH HÀNG HÓA MỚI</h3>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setShowQuickAddGoodsModal(false)}
                        className="text-slate-400 hover:text-slate-600 transition-all cursor-pointer bg-transparent border-0 outline-none"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Form body */}
                    <form onSubmit={handleQuickAddGoods} className="p-6 space-y-4">
                      
                      {/* Brand & Model */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Thương hiệu *</label>
                          <input 
                            type="text"
                            required
                            placeholder="Ví dụ: Jinko, Sofar"
                            value={quickBrand}
                            onChange={(e) => setQuickBrand(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Model / Mã SP *</label>
                          <input 
                            type="text"
                            required
                            placeholder="Ví dụ: 475W, 50KTL"
                            value={quickModel}
                            onChange={(e) => setQuickModel(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                          />
                        </div>
                      </div>

                      {/* Type & Unit */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Chủng loại</label>
                          <select 
                            value={quickType}
                            onChange={(e) => setQuickType(e.target.value as any)}
                            className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700 appearance-none"
                          >
                            <option value="panel">Tấm pin Solar</option>
                            <option value="inverter">Biến tần Inverter</option>
                            <option value="battery">Pin Lithium</option>
                            <option value="mounting">Khung giá đỡ</option>
                            <option value="accessory">Phụ kiện điện</option>
                            <option value="other">Vật tư khác</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Đơn vị tính</label>
                          <input 
                            type="text"
                            placeholder="Tấm, Cái, Bộ, m..."
                            value={quickUnit}
                            onChange={(e) => setQuickUnit(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                          />
                        </div>
                      </div>

                      {/* Stock & Unit Price */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Tồn kho ban đầu</label>
                          <input 
                            type="number"
                            min={0}
                            value={quickStock}
                            onChange={(e) => setQuickStock(Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Đơn giá mua (VNĐ)</label>
                          <input 
                            type="number"
                            min={0}
                            step={1000}
                            value={quickUnitPrice}
                            onChange={(e) => setQuickUnitPrice(Number(e.target.value))}
                            className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                          />
                        </div>
                      </div>

                      {/* Supplier */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Nhà cung cấp</label>
                        <select 
                          value={quickSupplier}
                          onChange={(e) => setQuickSupplier(e.target.value)}
                          className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 text-slate-700"
                        >
                          <option value="Chưa liên kết">-- Chưa liên kết / Tự do --</option>
                          {suppliers.map(sup => (
                            <option key={sup.id} value={sup.name}>{sup.name}</option>
                          ))}
                          {suppliers.length === 0 && (
                            <>
                              <option value="Solar Sông Đà">Solar Sông Đà</option>
                              <option value="Growatt Việt Nam">Growatt Việt Nam</option>
                              <option value="Jinko Solar APAC">Jinko Solar APAC</option>
                              <option value="Nhôm Định Hình Việt Pháp">Nhôm Định Hình Việt Pháp</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-2.5">
                        <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-700 leading-relaxed font-semibold">
                          Hàng hóa được thêm sẽ lưu trực tiếp vào cơ sở dữ liệu danh mục kho và tự động thêm vào phiếu đề xuất đang tạo với số lượng mặc định là 1.
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setShowQuickAddGoodsModal(false)}
                          className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all cursor-pointer bg-transparent border-0 outline-none"
                        >
                          Hủy bỏ
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 text-[10px] font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all active:scale-95 cursor-pointer border-0"
                        >
                          Lưu & Thêm nhanh
                        </button>
                      </div>

                    </form>
                  </div>
                </div>
              )}
            </div>

            {/* Selected Items Table */}
            <div className="overflow-x-auto min-h-[300px] border border-slate-100 rounded-2xl bg-white mt-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 border-b border-slate-100">
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400">STT</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400">Mã Hàng</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400">Tên Hàng</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400">ĐVT</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400">Số Lượng</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {formItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12">
                        <div className="flex flex-col items-center justify-center text-center p-6">
                          <span className="text-slate-700 font-extrabold text-sm mb-1">Thêm sản phẩm từ file excel</span>
                          <button 
                            type="button" 
                            onClick={handleDownloadTemplate}
                            className="text-blue-600 hover:underline font-bold text-xs mb-4 inline-flex items-center gap-1 bg-transparent border-0 cursor-pointer outline-none"
                          >
                            <Download className="h-3 w-3" /> (Tải về file mẫu: Excel file)
                          </button>
                          
                          <label className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wider px-6 py-2.5 rounded-xl cursor-pointer shadow-sm flex items-center gap-2 transition-all active:scale-95">
                            <Upload className="h-3.5 w-3.5" />
                            Chọn File Dữ Liệu
                            <input 
                              type="file" 
                              accept=".xlsx,.xls,.csv" 
                              onChange={handleExcelUpload} 
                              className="hidden" 
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    formItems.map((item, idx) => {
                      const eq = equipment.find(e => e.id === item.equipmentId);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-all text-xs">
                          <td className="px-4 py-3 font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-500">#{item.equipmentId}</td>
                          <td className="px-4 py-3 font-extrabold text-slate-800">{eq?.brand} {eq?.model}</td>
                          <td className="px-4 py-3 font-semibold text-slate-500">{eq?.unit || 'Cái'}</td>
                          <td className="px-4 py-3">
                            <input 
                              type="number"
                              min={1}
                              max={eq?.stock || 9999}
                              value={item.quantity}
                              onChange={(e) => handleQtyChange(idx, Number(e.target.value))}
                              className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-center font-extrabold text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button 
                              type="button" 
                              onClick={() => handleRemoveFormItem(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-all cursor-pointer bg-transparent border-0 outline-none"
                            >
                              <X className="h-4.5 w-4.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Pane: Form panel */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xs p-6 flex flex-col justify-between">
            <div className="space-y-4">
              {/* Header select and clock */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-50 pb-3">
                <div className="relative">
                  <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <select
                    value={formTechnicianName}
                    onChange={(e) => setFormTechnicianName(e.target.value)}
                    className="pl-8 pr-6 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-extrabold text-[10px] uppercase tracking-wide focus:outline-none focus:border-blue-500 text-slate-700"
                  >
                    <option value="Mr Lành">Mr Lành</option>
                    <option value="MRHIEU">MRHIEU</option>
                    <option value="Mr Hải">Mr Hải</option>
                    <option value="Mr Hưng">Mr Hưng</option>
                  </select>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-500 shrink-0">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{currentTime}</span>
                </div>
              </div>

              {/* TÌM TÊN CÔNG TRÌNH */}
              <div className="relative">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Tìm Tên Công Trình</label>
                  <button 
                    type="button"
                    onClick={handleAddQuickProject}
                    className="w-5 h-5 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center transition-all cursor-pointer border-0 outline-none"
                    title="Thêm nhanh công trình mới"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                
                {/* Selected display button */}
                <div className="relative">
                  <button
                    id="btn-project-dropdown"
                    type="button"
                    onClick={() => setShowProjectDropdown(!showProjectDropdown)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700 flex justify-between items-center text-left transition-all"
                  >
                    <span className="truncate">
                      {formProjectId 
                        ? getProjectDisplayName(projects.find(p => p.id === formProjectId)) 
                        : '-- Chọn công trình cần liên kết --'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
                  </button>

                  {showProjectDropdown && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => {
                          setShowProjectDropdown(false);
                          setProjectSearch('');
                        }} 
                      />
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-55 p-2 flex flex-col gap-2 max-h-64 overflow-hidden">
                        {/* Search Input inside Dropdown */}
                        <div className="relative z-50">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <input
                            id="input-project-search"
                            type="text"
                            placeholder="Nhập tên công trình để tìm nhanh..."
                            value={projectSearch}
                            onChange={(e) => setProjectSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-100 focus:outline-none focus:bg-white focus:border-blue-500 text-slate-700"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        {/* Project Options List */}
                        <div className="overflow-y-auto flex-1 divide-y divide-slate-50 max-h-48 relative z-50">
                          {(() => {
                            const query = projectSearch.toLowerCase().trim();
                            const filtered = projects.filter(p => {
                              const displayName = getProjectDisplayName(p).toLowerCase();
                              const idMatch = p.id.toLowerCase().includes(query);
                              return displayName.includes(query) || idMatch;
                            });

                            if (filtered.length === 0) {
                              return (
                                <div className="py-4 text-center text-xs text-slate-400 font-semibold">
                                  Không tìm thấy công trình nào
                                </div>
                              );
                            }

                            return filtered.map(p => {
                              const isSelected = p.id === formProjectId;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => {
                                    setFormProjectId(p.id);
                                    setShowProjectDropdown(false);
                                    setProjectSearch('');
                                  }}
                                  className={`w-full px-3 py-2 text-left text-xs font-bold rounded-lg transition-colors flex items-center justify-between cursor-pointer ${
                                    isSelected 
                                      ? 'bg-blue-50 text-blue-600' 
                                      : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <div className="truncate flex-1 pr-2">
                                    <div className="truncate">{getProjectDisplayName(p)}</div>
                                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Mã: {p.id}</div>
                                  </div>
                                  {isSelected && <span className="text-blue-600 text-xs font-black">✓</span>}
                                </button>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* MÃ PHIẾU */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Mã Phiếu</label>
                <input 
                  type="text"
                  disabled
                  value={editingRequestId || ''}
                  placeholder="Mã phiếu tự động"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 font-bold text-xs text-slate-500 cursor-not-allowed"
                />
              </div>

              {/* TRẠNG THÁI */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-slate-400">Trạng Thái</span>
                <span className="px-2.5 py-1 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-wider">
                  Phiếu Tạm
                </span>
              </div>

              {/* GHI CHÚ */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Ghi Chú</label>
                <textarea 
                  rows={4}
                  placeholder="Nhập ghi chú hoặc lý do cấp phát vật tư cụ thể..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs text-slate-700"
                />
              </div>
            </div>

            {/* Actions & helpline */}
            <div className="space-y-4 pt-4 border-t border-slate-50">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center outline-none"
                >
                  Lưu Tạm
                </button>
                <button
                  type="button"
                  onClick={handleCreateRequest}
                  className="bg-[#0054a6] hover:bg-blue-700 text-white px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center active:scale-95 shadow-sm outline-none border-0"
                >
                  Hoàn Thành
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-blue-600 font-bold text-[11px] hover:underline cursor-pointer">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>TỔNG ĐÀI: 0915 586 234</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Mã đề xuất</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Kỹ thuật viên</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Thi công dự án</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Vật tư yêu cầu</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Ngày đề xuất</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400">Trạng thái</th>
                <th className="px-6 py-4.5 text-[10px] font-black uppercase tracking-wider text-slate-400 text-center">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-slate-700">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400 text-xs italic font-semibold">
                    Không có đề xuất cấp vật tư nào được tìm thấy.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4 font-mono text-[10px] font-black text-slate-400">#{req.id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-700">
                          {req.technicianName?.substring(0, 1).toUpperCase()}
                        </div>
                        <span className="text-xs font-black text-slate-800">{req.technicianName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {req.projectId && req.projectId !== 'PRJ_TEMP' && onOpenProject ? (
                        <button
                          onClick={() => onOpenProject(req.projectId)}
                          className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-xl w-fit cursor-pointer text-left focus:outline-none transition-all border border-blue-100"
                          title="Click để xem chi tiết công trình"
                        >
                          <Briefcase className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                          <span className="truncate max-w-[150px] underline decoration-dotted">{req.projectName}</span>
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-xl w-fit border border-transparent">
                          <Briefcase className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                          <span className="truncate max-w-[150px]">{req.projectName}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {req.items?.slice(0, 2).map((item, i) => (
                          <div key={i} className="text-[11px] font-bold text-slate-600">
                            • {item.brand} {item.model}: <span className="font-extrabold text-slate-800">{item.quantity} {item.unit}</span>
                          </div>
                        ))}
                        {req.items?.length > 2 && (
                          <span className="text-[9px] font-black uppercase text-slate-400">Và {req.items.length - 2} thiết bị khác...</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-400">{getSafeISOString(req.createdAt).substring(0, 10)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded-lg border tracking-wider ${
                        req.status === 'draft' ? 'bg-slate-100 border-slate-300 text-slate-600' :
                        req.status === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        req.status === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                        'bg-rose-50 border-rose-200 text-rose-700'
                      }`}>
                        {req.status === 'draft' ? '⚪ Lưu tạm' :
                         req.status === 'pending' ? '🟡 Chờ duyệt' : 
                         req.status === 'approved' ? '🟢 Đã duyệt' : '🔴 Từ chối'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {req.status === 'draft' ? (
                          <>
                            <button
                              onClick={() => handleStartEditDraft(req)}
                              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                            >
                              Nhập thêm hàng
                            </button>
                            <button
                              onClick={() => handleDeleteDraft(req.id)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                            >
                              Hủy phiếu
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => onOpenDocument(req.id, 'dexuat', `${req.id}`)}
                              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                            >
                              Mở chi tiết
                            </button>
                            {req.status === 'pending' && (userRole === 'admin' || userRole === 'manager' || userRole === 'accountant') && (
                              <button
                                onClick={() => {
                                  setReviewingRequest(req);
                                  setReviewAdminNote('');
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer border-0"
                              >
                                Duyệt phiếu
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 2: Review/Approve Request */}
      {reviewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-2xl">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-indigo-600 animate-bounce" />
                Phê duyệt phiếu cấp phát #{reviewingRequest.id}
              </h3>
              <button 
                onClick={() => setReviewingRequest(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-all cursor-pointer border-0 outline-none"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-8 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-xs">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">Thông tin đề xuất</p>
                <p className="font-bold text-slate-800">Kỹ thuật viên: <span className="font-extrabold">{reviewingRequest.technicianName}</span></p>
                <p className="font-bold text-slate-800 mt-1">
                  Dự án:{" "}
                  {reviewingRequest.projectId && reviewingRequest.projectId !== 'PRJ_TEMP' && onOpenProject ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewingRequest(null);
                        onOpenProject(reviewingRequest.projectId);
                      }}
                      className="font-extrabold text-blue-600 hover:underline cursor-pointer focus:outline-none"
                      title="Click để xem chi tiết công trình"
                    >
                      {reviewingRequest.projectName}
                    </button>
                  ) : (
                    <span className="font-extrabold">{reviewingRequest.projectName}</span>
                  )}
                </p>
                <p className="font-bold text-slate-800 mt-1">Lý do đề xuất: <span className="italic font-medium">"{reviewingRequest.reason}"</span></p>

                <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mt-4 mb-2">Chi tiết thiết bị yêu cầu</p>
                <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                  {reviewingRequest.items?.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-700">{item.brand} {item.model}</span>
                      <span className="font-extrabold text-slate-900">{item.quantity} {item.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">Ghi chú duyệt phiếu (Gửi đến thủ kho & kỹ thuật)</label>
                <textarea 
                  rows={3}
                  required
                  placeholder="Nhập ghi chú duyệt, ví dụ: 'Đồng ý xuất, thủ kho kiểm tra tình trạng đóng gói kỹ càng.' hoặc lý do từ chối..."
                  value={reviewAdminNote}
                  onChange={(e) => setReviewAdminNote(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-blue-500 font-bold text-xs"
                />
              </div>
            </div>

            <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-between gap-3">
              <button
                type="button"
                onClick={handleReject}
                className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-0 outline-none"
              >
                Từ chối cấp phát
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReviewingRequest(null)}
                  className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-0 outline-none"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 border-0 outline-none"
                >
                  Đồng ý & Duyệt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
