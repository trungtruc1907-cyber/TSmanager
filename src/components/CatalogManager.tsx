import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Equipment } from '../types';
import * as XLSX from 'xlsx';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Package, 
  Cpu, 
  Battery, 
  Box, 
  X, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Warehouse, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign, 
  MapPin, 
  Calendar, 
  User,
  FileText,
  Check,
  XCircle,
  Clock,
  Send,
  Briefcase,
  ExternalLink,
  UploadCloud,
  FileSpreadsheet,
  Download,
  ArrowLeft,
  ChevronDown,
  Phone
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

type EquipmentCategory = 'panel' | 'inverter' | 'battery' | 'mounting' | 'accessory' | 'other';
type StockStatusFilter = 'all' | 'instock' | 'low' | 'outofstock';

export const getUnit = (item: { type?: string; unit?: string } | undefined) => {
  if (!item) return 'cái';
  if (item.unit) return item.unit;
  if (item.type === 'panel') return 'tấm';
  if (item.type === 'inverter' || item.type === 'battery') return 'bộ';
  return 'cái';
};

interface CatalogManagerProps {
  userId?: string;
  userRole?: string;
}

export default function CatalogManager({ userId, userRole }: CatalogManagerProps) {
  const isAdmin = userRole === 'admin' || userRole === 'manager' || userRole === 'accountant' || userRole === 'operator';
  
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('Nhân viên');
  
  // Tabs for general warehouse vs material requests
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests'>('inventory');

  // Real-time collections for material requests
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [materialRequests, setMaterialRequests] = useState<any[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  // Request creation modal states
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [searchQueryInRequest, setSearchQueryInRequest] = useState('');
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestReason, setRequestReason] = useState('');
  const [requestProjectId, setRequestProjectId] = useState('');
  const [requestItems, setRequestItems] = useState<{
    equipmentId: string;
    brand: string;
    model: string;
    type: string;
    quantity: number;
  }[]>([]);
  
  // Selection states inside request creation modal
  const [selectedEqId, setSelectedEqId] = useState('');
  const [selectedEqQty, setSelectedEqQty] = useState(1);

  // Approval/rejection states
  const [resolvingRequest, setResolvingRequest] = useState<any | null>(null);
  const [resolveAction, setResolveAction] = useState<'approve' | 'reject' | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  
  // Filters & Search
  const [categoryFilter, setCategoryFilter] = useState<EquipmentCategory | 'all'>('all');
  const [stockFilter, setStockFilter] = useState<StockStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<Equipment> | null>(null);
  
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<Equipment | null>(null);
  const [adjustType, setAdjustType] = useState<'import' | 'export'>('import');
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustNote, setAdjustNote] = useState<string>('');
  
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyItem, setHistoryItem] = useState<Equipment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Excel Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<{ data: Partial<Equipment>; errors: string[]; rowNum: number; isValid: boolean }[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const categories: { id: EquipmentCategory; label: string; icon: any }[] = [
    { id: 'panel', label: 'Tấm pin PV', icon: Package },
    { id: 'inverter', label: 'Biến tần (Inverter)', icon: Cpu },
    { id: 'battery', label: 'Lưu trữ (Battery)', icon: Battery },
    { id: 'mounting', label: 'Hệ thống khung giá', icon: Box },
    { id: 'accessory', label: 'Phụ kiện & Cáp', icon: Box },
    { id: 'other', label: 'Thiết bị khác', icon: Box },
  ];

  // Load User Name
  useEffect(() => {
    if (!userId) return;
    const loadUserName = async () => {
      try {
        const userRef = doc(db, 'users', userId);
        const snap = await getDoc(userRef).catch((err) => {
          const isOffline = err instanceof Error && (
            err.message.toLowerCase().includes('offline') ||
            err.message.toLowerCase().includes('failed to get document')
          );
          if (isOffline) {
            console.warn("Could not fetch user profile in warehouse from server (operating in offline mode):", err);
          } else {
            console.error("Error loading user profile in warehouse:", err);
          }
          return null;
        });
        if (snap && snap.exists()) {
          const data = snap.data();
          setUserName(data.name || data.displayName || 'Nhân viên');
        }
      } catch (err) {
        console.warn("Error loading user profile in warehouse (possibly offline):", err);
      }
    };
    loadUserName();
  }, [userId]);

  // Real-time equipment catalog sync
  useEffect(() => {
    if (!userId) return;
    const q = collection(db, 'equipment');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawEquipment = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment));
      rawEquipment.sort((a, b) => {
        const brandA = a.brand || '';
        const brandB = b.brand || '';
        return brandA.localeCompare(brandB);
      });
      setEquipmentList(rawEquipment);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'equipment');
    });
    return () => unsubscribe();
  }, [userId]);

  // Load Projects for select dropdown
  useEffect(() => {
    if (!userId) return;
    const q = collection(db, 'projects');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjectsList(list);
    }, (error) => {
      console.error("Error loading projects for warehouse request:", error);
    });
    return () => unsubscribe();
  }, [userId]);

  // Load Material Requests sync
  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'material_requests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMaterialRequests(list);
      setRequestsLoading(false);
    }, (error) => {
      console.error("Error loading material requests:", error);
      setRequestsLoading(false);
    });
    return () => unsubscribe();
  }, [userId]);

  // F3 Key shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F3') {
        e.preventDefault();
        const searchInput = document.getElementById('request-search-input');
        if (searchInput) {
          searchInput.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handler to initiate request directly from equipment card
  const handleOpenRequestWithItem = (item: Equipment) => {
    setRequestItems([{
      equipmentId: item.id,
      brand: item.brand,
      model: item.model,
      type: item.type,
      quantity: 1,
      unit: item.unit
    }]);
    setRequestReason(`Yêu cầu cấp phát thiết bị ${item.brand} ${item.model} phục vụ lắp đặt`);
    setRequestProjectId('');
    setActiveTab('requests');
    setIsCreatingRequest(true);
  };

  // Add selected item to the request slip list
  const handleAddRequestItem = () => {
    if (!selectedEqId) return;
    const item = equipmentList.find(e => e.id === selectedEqId);
    if (!item) return;

    if (requestItems.some(ri => ri.equipmentId === selectedEqId)) {
      setRequestItems(prev => prev.map(ri => 
        ri.equipmentId === selectedEqId 
          ? { ...ri, quantity: ri.quantity + selectedEqQty } 
          : ri
      ));
    } else {
      setRequestItems(prev => [...prev, {
        equipmentId: item.id,
        brand: item.brand,
        model: item.model,
        type: item.type,
        quantity: selectedEqQty,
        unit: item.unit
      }]);
    }

    setSelectedEqId('');
    setSelectedEqQty(1);
  };

  // Download sample CSV request file
  const handleDownloadSampleRequestFile = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Ma thiet bi,Thuong hieu,Model,Loai,So luong\n"
      + "eq_sample_1,Longi,Hi-MO 5,panel,5\n"
      + "eq_sample_2,Growatt,MIN 5000TL-X,inverter,1\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "mau_yeu_cau_vat_tu.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import requests items from a text file or CSV
  const handleImportRequestFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split('\n');
      const newItems: typeof requestItems = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length >= 4) {
          const brand = parts[1]?.trim();
          const model = parts[2]?.trim();
          const type = parts[3]?.trim();
          const quantity = parseInt(parts[4]?.trim() || '1') || 1;

          const matchedEq = equipmentList.find(eq => 
            eq.brand.toLowerCase() === brand.toLowerCase() && 
            eq.model.toLowerCase() === model.toLowerCase()
          );

          if (matchedEq) {
            newItems.push({
              equipmentId: matchedEq.id,
              brand: matchedEq.brand,
              model: matchedEq.model,
              type: matchedEq.type,
              quantity: quantity,
              unit: matchedEq.unit
            });
          }
        }
      }

      if (newItems.length > 0) {
        setRequestItems(prev => {
          const combined = [...prev];
          newItems.forEach(item => {
            const existing = combined.find(ri => ri.equipmentId === item.equipmentId);
            if (existing) {
              existing.quantity += item.quantity;
            } else {
              combined.push(item);
            }
          });
          return combined;
        });
        alert(`Đã nhập thành công ${newItems.length} vật tư từ file.`);
      } else {
        if (equipmentList.length > 0) {
          const sampleCount = Math.min(3, equipmentList.length);
          const samples: typeof requestItems = [];
          for (let j = 0; j < sampleCount; j++) {
            const eq = equipmentList[j];
            samples.push({
              equipmentId: eq.id,
              brand: eq.brand,
              model: eq.model,
              type: eq.type,
              quantity: 2 + j,
              unit: eq.unit
            });
          }
          setRequestItems(prev => [...prev, ...samples]);
          alert("Đã tải dữ liệu mẫu thành công với 3 vật tư demo từ kho hàng.");
        } else {
          alert("Không tìm thấy vật tư nào phù hợp trong hệ thống.");
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Remove item from requested slip list
  const handleRemoveRequestItem = (eqId: string) => {
    setRequestItems(prev => prev.filter(ri => ri.equipmentId !== eqId));
  };

  // Create material request in database
  const handleCreateMaterialRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requestItems.length === 0) return;

    const project = projectsList.find(p => p.id === requestProjectId);
    const projectName = project ? (project.name || project.customerName || 'Dự án') : '';

    try {
      const requestData = {
        technicianId: userId!,
        technicianName: userName,
        projectId: requestProjectId,
        projectName: projectName,
        reason: requestReason.trim(),
        items: requestItems,
        status: 'pending' as const,
        createdAt: serverTimestamp(),
        resolvedAt: null,
        resolvedBy: null,
        adminNote: ''
      };

      await addDoc(collection(db, 'material_requests'), requestData);

      // Notification to admin & manager
      await addDoc(collection(db, 'notifications'), {
        title: '📋 YÊU CẦU VẬT TƯ MỚI',
        message: `Kỹ thuật ${userName} đã tạo phiếu yêu cầu vật tư mới cho công trình: ${projectName || 'Chưa liên kết'}. Nội dung: ${requestReason.trim()}`,
        type: 'task',
        createdAt: serverTimestamp(),
        createdBy: userId!,
        createdByName: userName
      });

      setIsRequestModalOpen(false);
      setIsCreatingRequest(false);
      setRequestReason('');
      setRequestProjectId('');
      setRequestItems([]);
      setSelectedEqId('');
      setSelectedEqQty(1);
    } catch (err) {
      console.error("Error creating material request:", err);
    }
  };

  // Approve / Reject material requests
  const handleResolveRequest = async () => {
    if (!resolvingRequest || !resolveAction) return;

    try {
      const isApproved = resolveAction === 'approve';
      const resolvedRequestData = {
        status: isApproved ? 'approved' as const : 'rejected' as const,
        resolvedAt: serverTimestamp(),
        resolvedBy: userName,
        adminNote: adminNote.trim()
      };

      await updateDoc(doc(db, 'material_requests', resolvingRequest.id), resolvedRequestData);

      // Deduct stock if approved
      if (isApproved) {
        for (const reqItem of resolvingRequest.items) {
          const eqDocRef = doc(db, 'equipment', reqItem.equipmentId);
          const eqSnap = await getDoc(eqDocRef);

          if (eqSnap.exists()) {
            const currentData = eqSnap.data();
            const currentStock = currentData.stock || 0;
            const newStock = Math.max(0, currentStock - reqItem.quantity);

            const transactionLog = {
              id: Math.random().toString(36).substring(7),
              type: 'export' as const,
              quantity: reqItem.quantity,
              note: `Cấp phát theo phiếu yêu cầu của ${resolvingRequest.technicianName}. Ghi chú: ${resolvingRequest.reason}`,
              createdAt: new Date().toISOString(),
              createdBy: userId!,
              createdByName: userName
            };

            const updatedHistory = [transactionLog, ...(currentData.history || [])].slice(0, 50);

            await updateDoc(eqDocRef, {
              stock: newStock,
              history: updatedHistory
            });
          }
        }
      }

      // Live update notification
      await addDoc(collection(db, 'notifications'), {
        title: isApproved ? '✅ PHÊ DUYỆT YÊU CẦU VẬT TƯ' : '❌ TỪ CHỐI YÊU CẦU VẬT TƯ',
        message: `Phiếu yêu cầu vật tư của ${resolvingRequest.technicianName} đã được ${userName} ${isApproved ? 'PHÊ DUYỆT' : 'TỪ CHỐI'}. Ghi chú: ${adminNote.trim() || 'Không có ghi chú thêm'}`,
        type: 'task',
        createdAt: serverTimestamp(),
        createdBy: userId!,
        createdByName: userName
      });

      setIsResolveModalOpen(false);
      setResolvingRequest(null);
      setResolveAction(null);
      setAdminNote('');
    } catch (err) {
      console.error("Error resolving material request:", err);
    }
  };

  // Save / Edit technical information
  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.brand || !editingItem?.model) return;

    try {
      const dataToSave = {
        type: editingItem.type || 'panel',
        brand: editingItem.brand.trim(),
        model: editingItem.model.trim(),
        capacity: Number(editingItem.capacity) || 0,
        unitPrice: Number(editingItem.unitPrice) || 0,
        sellingPrice: Number(editingItem.sellingPrice) || 0,
        details: editingItem.details?.trim() || '',
        isThreePhase: editingItem.isThreePhase || false,
        stock: Number(editingItem.stock) >= 0 ? Number(editingItem.stock) : 0,
        minStock: Number(editingItem.minStock) >= 0 ? Number(editingItem.minStock) : 5,
        location: editingItem.location?.trim() || 'Chưa định vị',
        history: editingItem.history || [],
        unit: editingItem.unit || ''
      };

      if (editingItem.id) {
        await updateDoc(doc(db, 'equipment', editingItem.id), dataToSave);
      } else {
        // Record initial inventory if first stock is set > 0
        if (dataToSave.stock > 0) {
          const initialLog = {
            id: Math.random().toString(36).substring(7),
            type: 'import' as const,
            quantity: dataToSave.stock,
            note: 'Tạo danh mục mới với lượng khai báo ban đầu',
            createdAt: new Date().toISOString(),
            createdBy: userId!,
            createdByName: userName
          };
          dataToSave.history = [initialLog];
        }
        await addDoc(collection(db, 'equipment'), dataToSave);
      }
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error saving equipment information:", error);
    }
  };

  // Submit in/out stock transaction
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem || adjustQty <= 0) return;

    try {
      const currentStock = adjustItem.stock || 0;
      let newStock = currentStock;

      if (adjustType === 'import') {
        newStock = currentStock + adjustQty;
      } else {
        newStock = Math.max(0, currentStock - adjustQty);
      }

      const transactionLog = {
        id: Math.random().toString(36).substring(7),
        type: adjustType,
        quantity: adjustQty,
        note: adjustNote.trim() || (adjustType === 'import' ? 'Nhập bổ sung kho' : 'Xuất kho sử dụng'),
        createdAt: new Date().toISOString(),
        createdBy: userId!,
        createdByName: userName
      };

      const updatedHistory = [transactionLog, ...(adjustItem.history || [])].slice(0, 50);

      // 1. Update Equipment Firestore Document
      await updateDoc(doc(db, 'equipment', adjustItem.id), {
        stock: newStock,
        history: updatedHistory
      });

      // 2. Add dynamic Notification to feed
      await addDoc(collection(db, 'notifications'), {
        title: adjustType === 'import' ? '📥 NHẬP KHO VẬT TƯ' : '📤 XUẤT KHO VẬT TƯ',
        message: `${userName} đã ${adjustType === 'import' ? 'nhập' : 'xuất'} ${adjustQty} chiếc ${adjustItem.brand} ${adjustItem.model} (${adjustType === 'import' ? 'Vào kho' : 'Khỏi kho'}). Ghi chú: ${transactionLog.note}`,
        type: 'task',
        createdAt: serverTimestamp(),
        createdBy: userId!,
        createdByName: userName
      });

      setIsAdjustModalOpen(false);
      setAdjustItem(null);
      setAdjustQty(1);
      setAdjustNote('');
    } catch (err) {
      console.error("Error operating inventory movement:", err);
    }
  };

  const handleDeleteEquipment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'equipment', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `equipment/${id}`);
    }
  };

  // Excel template generation and download helper
  const handleDownloadTemplate = () => {
    // Standard schema for equipment
    const sampleData = [
      {
        'Loại thiết bị (*)': 'panel',
        'Thương hiệu (*)': 'Longi Solar',
        'Model (*)': 'LR5-72HPH-550M',
        'Công suất (Wp) (*)': 550,
        'Đơn giá nhập kho (VND) (*)': 2200000,
        'Đơn giá bán ra (VND) (*)': 3100000,
        'Điện 3 Pha (Có/Không) (*)': 'Không',
        'Số lượng tồn kho ban đầu (*)': 100,
        'Số lượng tối thiểu cảnh báo (*)': 10,
        'Vị trí lưu kho (*)': 'Khu A1',
        'Mô tả chi tiết': 'Tấm pin Mono Crystalline hiệu suất cao, 144 half-cell'
      },
      {
        'Loại thiết bị (*)': 'inverter',
        'Thương hiệu (*)': 'Solis',
        'Model (*)': 'Solis-110K-5G',
        'Công suất (Wp) (*)': 110000,
        'Đơn giá nhập kho (VND) (*)': 65000000,
        'Đơn giá bán ra (VND) (*)': 82000000,
        'Điện 3 Pha (Có/Không) (*)': 'Có',
        'Số lượng tồn kho ban đầu (*)': 5,
        'Số lượng tối thiểu cảnh báo (*)': 2,
        'Vị trí lưu kho (*)': 'Khu B2',
        'Mô tả chi tiết': 'Biến tần hòa lưới 3 pha 110kW, hiệu suất 98.7%, 10 MPPT'
      },
      {
        'Loại thiết bị (*)': 'battery',
        'Thương hiệu (*)': 'Sunket',
        'Model (*)': 'LFP-51.2V100AH',
        'Công suất (Wp) (*)': 5120,
        'Đơn giá nhập kho (VND) (*)': 28000000,
        'Đơn giá bán ra (VND) (*)': 36000000,
        'Điện 3 Pha (Có/Không) (*)': 'Không',
        'Số lượng tồn kho ban đầu (*)': 8,
        'Số lượng tối thiểu cảnh báo (*)': 3,
        'Vị trí lưu kho (*)': 'Khu C1',
        'Mô tả chi tiết': 'Pin lưu trữ Lithium sắt phốt phát (LiFePO4) cho hệ độc lập/hybrid'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Mau_Vat_Tu');

    // Instruction tab
    const instructionData = [
      { 'Hướng dẫn nhập dữ liệu': 'CÁC THÔNG TIN QUAN TRỌNG KHI NHẬP FILE' },
      { 'Hướng dẫn nhập dữ liệu': '1. Các cột đánh dấu (*) là bắt buộc.' },
      { 'Hướng dẫn nhập dữ liệu': '2. Loại thiết bị phải thuộc một trong các giá trị sau: panel, inverter, battery, mounting, accessory, other' },
      { 'Hướng dẫn nhập dữ liệu': '   - panel: Tấm pin năng lượng mặt trời' },
      { 'Hướng dẫn nhập dữ liệu': '   - inverter: Biến tần' },
      { 'Hướng dẫn nhập dữ liệu': '   - battery: Pin lưu trữ' },
      { 'Hướng dẫn nhập dữ liệu': '   - mounting: Hệ khung giá đỡ' },
      { 'Hướng dẫn nhập dữ liệu': '   - accessory: Phụ kiện lắp đặt, cáp điện' },
      { 'Hướng dẫn nhập dữ liệu': '   - other: Các thiết bị khác' },
      { 'Hướng dẫn nhập dữ liệu': '3. Điện 3 Pha ghi: "Có" hoặc "Không".' },
      { 'Hướng dẫn nhập dữ liệu': '4. Công suất, Đơn giá nhập, Đơn giá bán, Tồn kho ban đầu, Tối thiểu cảnh báo phải là số nguyên dương >= 0.' }
    ];
    const wsInstruction = XLSX.utils.json_to_sheet(instructionData);
    XLSX.utils.book_append_sheet(wb, wsInstruction, 'Huong_Dan_Su_Dung');

    // Adjust column widths for aesthetics
    ws['!cols'] = [
      { wch: 18 }, // Loại thiết bị
      { wch: 18 }, // Thương hiệu
      { wch: 22 }, // Model
      { wch: 18 }, // Công suất
      { wch: 28 }, // Đơn giá nhập
      { wch: 26 }, // Đơn giá bán
      { wch: 24 }, // Điện 3 Pha
      { wch: 26 }, // Tồn kho
      { wch: 28 }, // Cảnh báo
      { wch: 20 }, // Vị trí
      { wch: 50 }, // Mô tả
    ];

    wsInstruction['!cols'] = [{ wch: 80 }];

    XLSX.writeFile(wb, 'Mau_Excel_Vat_Tu_Solar.xlsx');
  };

  // Parser of uploaded Excel file
  const handleParseExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportError(null);
    setImportSuccess(null);
    setParsedItems([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);
        if (rawRows.length === 0) {
          setImportError('File Excel không có dữ liệu để phân tích.');
          return;
        }

        const allowedTypes = ['panel', 'inverter', 'battery', 'mounting', 'accessory', 'other'];

        const getRowValue = (r: any, keys: string[]) => {
          for (const key of keys) {
            if (r[key] !== undefined && r[key] !== null && r[key] !== '') {
              return r[key];
            }
          }
          return undefined;
        };

        const items = rawRows.map((row, idx) => {
          const rowNum = idx + 2; // header is row 1
          const errors: string[] = [];

          // Column extraction accommodating spelling variants using safe helper
          const typeRaw = (getRowValue(row, ['Loại thiết bị (*)', 'Loại thiết bị', 'type']) || '').toString().trim().toLowerCase();
          const brand = (getRowValue(row, ['Thương hiệu (*)', 'Thương hiệu', 'brand']) || '').toString().trim();
          const model = (getRowValue(row, ['Model (*)', 'Model', 'model']) || '').toString().trim();
          const capacityRaw = getRowValue(row, ['Công suất (Wp) (*)', 'Công suất (Wp)', 'Công suất', 'capacity']);
          const unitPriceRaw = getRowValue(row, ['Đơn giá nhập kho (VND) (*)', 'Đơn giá nhập kho (VND)', 'Đơn giá nhập', 'unitPrice']);
          const sellingPriceRaw = getRowValue(row, ['Đơn giá bán ra (VND) (*)', 'Đơn giá bán ra (VND)', 'Đơn giá bán', 'sellingPrice']);
          const isThreePhaseRaw = (getRowValue(row, ['Điện 3 Pha (Có/Không) (*)', 'Điện 3 Pha (Có/Không)', 'Điện 3 Pha', 'isThreePhase']) || '').toString().trim().toLowerCase();
          const stockRaw = getRowValue(row, ['Số lượng tồn kho ban đầu (*)', 'Số lượng tồn kho ban đầu', 'Tồn kho', 'stock']);
          const minStockRaw = getRowValue(row, ['Số lượng tối thiểu cảnh báo (*)', 'Số lượng tối thiểu cảnh báo', 'Cảnh báo tối thiểu', 'minStock']);
          const location = (getRowValue(row, ['Vị trí lưu kho (*)', 'Vị trí lưu kho', 'Vị trí', 'location']) || 'Chưa định vị').toString().trim();
          const details = (getRowValue(row, ['Mô tả chi tiết', 'Mô tả', 'details']) || '').toString().trim();
          const unitRaw = (getRowValue(row, ['Đơn vị tính (*)', 'Đơn vị tính', 'Đơn vị', 'unit']) || '').toString().trim();

          if (!typeRaw) {
            errors.push('Thiếu thông tin Loại thiết bị.');
          } else if (!allowedTypes.includes(typeRaw)) {
            errors.push(`Loại thiết bị "${typeRaw}" không hợp lệ. Phải thuộc: panel, inverter, battery, mounting, accessory, other`);
          }

          if (!brand) errors.push('Thiếu thương hiệu vật tư.');
          if (!model) errors.push('Thiếu mã model sản phẩm.');

          const capacity = capacityRaw !== undefined ? Number(capacityRaw) : 0;
          if (isNaN(capacity) || capacity < 0) {
            errors.push('Công suất không hợp lệ (phải là số >= 0).');
          }

          const unitPrice = unitPriceRaw !== undefined ? Number(unitPriceRaw) : 0;
          if (isNaN(unitPrice) || unitPrice < 0) {
            errors.push('Đơn giá nhập không hợp lệ (phải là số >= 0).');
          }

          const sellingPrice = sellingPriceRaw !== undefined ? Number(sellingPriceRaw) : 0;
          if (isNaN(sellingPrice) || sellingPrice < 0) {
            errors.push('Đơn giá bán không hợp lệ (phải là số >= 0).');
          }

          const stock = stockRaw !== undefined ? Number(stockRaw) : 0;
          if (isNaN(stock) || stock < 0) {
            errors.push('Số lượng tồn kho không hợp lệ (phải là số >= 0).');
          }

          const minStock = minStockRaw !== undefined ? Number(minStockRaw) : 0;
          if (isNaN(minStock) || minStock < 0) {
            errors.push('Sản lượng tối thiểu cảnh báo không hợp lệ (phải là số >= 0).');
          }

          const isThreePhase = isThreePhaseRaw === 'có' || isThreePhaseRaw === 'co' || isThreePhaseRaw === 'yes' || isThreePhaseRaw === 'true';

          const itemData: Partial<Equipment> = {
            type: typeRaw as any,
            brand,
            model,
            capacity,
            unitPrice,
            sellingPrice,
            isThreePhase,
            stock,
            minStock,
            location,
            details,
            unit: unitRaw || ''
          };

          return {
            data: itemData,
            errors,
            rowNum,
            isValid: errors.length === 0
          };
        });

        setParsedItems(items);
      } catch (err) {
        console.error('Error parsing uploaded file:', err);
        setImportError('Định dạng tệp không được hỗ trợ hoặc bị hỏng. Vui lòng thử lại.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Commit valid Excel rows to Firestore db
  const handleCommitImport = async () => {
    const validItems = parsedItems.filter(x => x.isValid);
    if (validItems.length === 0) {
      setImportError('Không tìm thấy bản ghi hợp lệ nào để tiến hành nhập.');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      let importedCount = 0;
      for (const item of validItems) {
        const dataToSave = {
          ...item.data,
          history: [] as any[]
        };

        // Write first movement log if stock > 0
        if (dataToSave.stock && dataToSave.stock > 0) {
          const initialLog = {
            id: Math.random().toString(36).substring(7),
            type: 'import' as const,
            quantity: dataToSave.stock,
            note: 'Tạo danh mục mới bằng phương thức nhập Excel',
            createdAt: new Date().toISOString(),
            createdBy: userId!,
            createdByName: userName
          };
          dataToSave.history = [initialLog];
        }

        await addDoc(collection(db, 'equipment'), dataToSave);
        importedCount++;
      }

      // Add general notification in feed
      await addDoc(collection(db, 'notifications'), {
        title: '📥 NHẬP KHẨU KHO THIẾT BỊ',
        message: `${userName} (Kế Toán) đã nhập khẩu thành công ${importedCount} thiết bị solar từ file Excel vào cơ sở dữ liệu kho.`,
        type: 'task',
        createdAt: serverTimestamp(),
        createdBy: userId!,
        createdByName: userName
      });

      setImportSuccess(`Nhập khẩu thành công ${importedCount} thiết bị mới vào kho.`);
      setParsedItems([]);
      setTimeout(() => {
        setIsImportModalOpen(false);
        setImportSuccess(null);
      }, 2000);

    } catch (err) {
      console.error('Firestore import commit error:', err);
      setImportError('Không thể lưu thông tin vật tư lên hệ thống database.');
    } finally {
      setIsImporting(false);
    }
  };

  // Stats Calculations
  const stats = React.useMemo(() => {
    let totalItems = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    equipmentList.forEach(item => {
      const qty = item.stock || 0;
      const min = item.minStock || 0;
      totalItems += qty;
      totalValue += qty * (item.unitPrice || 0);

      if (qty === 0) {
        outOfStockCount++;
      } else if (qty <= min) {
        lowStockCount++;
      }
    });

    return { totalItems, totalValue, lowStockCount, outOfStockCount };
  }, [equipmentList]);

  // Filtering Logic
  const filteredEquipment = React.useMemo(() => {
    return equipmentList.filter(item => {
      // 1. Category filter
      if (categoryFilter !== 'all' && item.type !== categoryFilter) return false;

      // 2. Stock status filter
      const qty = item.stock || 0;
      const min = item.minStock || 0;
      if (stockFilter === 'instock' && qty <= min) return false;
      if (stockFilter === 'low' && (qty === 0 || qty > min)) return false;
      if (stockFilter === 'outofstock' && qty > 0) return false;

      // 3. Search query filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const brand = item.brand?.toLowerCase() || '';
        const model = item.model?.toLowerCase() || '';
        const location = item.location?.toLowerCase() || '';
        if (!brand.includes(query) && !model.includes(query) && !location.includes(query)) return false;
      }

      return true;
    });
  }, [equipmentList, categoryFilter, stockFilter, searchQuery]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-16 space-y-4">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      <p className="text-slate-500 font-medium italic text-sm">Đang đồng bộ hóa kho vật tư...</p>
    </div>
  );

  return (
    <div className="space-y-6 font-sans">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-blue-600" /> Hệ Thống Quản Lý Kho & Vật Tư
          </h2>
          <p className="text-xs text-slate-500 font-medium">Theo dõi số lượng, vị trí lưu trữ, và lịch sử luân chuyển thiết bị vật tư solar.</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3">
            {(userRole === 'accountant' || userRole === 'admin' || userRole === 'manager') && (
              <button 
                onClick={() => {
                  setParsedItems([]);
                  setImportError(null);
                  setImportSuccess(null);
                  setIsImportModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-xl transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" /> Nhập kho từ Excel
              </button>
            )}
            <button 
              onClick={() => {
                setEditingItem({ type: 'panel', brand: '', model: '', capacity: 0, unitPrice: 0, sellingPrice: 0, details: '', stock: 0, minStock: 5, location: 'Khu A', unit: '' });
                setIsEditModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-lg hover:shadow-xl transition-all active:scale-95 shrink-0"
            >
              <Plus className="h-4 w-4" /> Khai báo vật tư mới
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('inventory')}
          className={cn(
            "px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2",
            activeTab === 'inventory' 
              ? "border-blue-600 text-blue-600 bg-blue-50/25" 
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          )}
        >
          <Warehouse className="h-4 w-4" /> Danh mục & Tồn kho
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            "px-6 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 relative",
            activeTab === 'requests' 
              ? "border-blue-600 text-blue-600 bg-blue-50/25" 
              : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
          )}
        >
          <FileText className="h-4 w-4" /> Phiếu yêu cầu vật tư
          {materialRequests.filter(r => r.status === 'pending').length > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-black text-[9px] w-5 h-5 rounded-full flex items-center justify-center animate-bounce shadow-md">
              {materialRequests.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'inventory' && (
        <>
          {/* Stats Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total stock items */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng Thiết Bị Trong Kho</p>
            <h3 className="text-xl font-black text-slate-800 mt-0.5">{stats.totalItems.toLocaleString('vi-VN')} <span className="text-xs font-bold text-slate-400">cái</span></h3>
          </div>
        </div>

        {/* Total Value */}
        {(userRole === 'admin' || userRole === 'accountant') && (
          <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giá Trị Tồn Kho Ước Tính</p>
              <h3 className="text-xl font-black text-emerald-600 mt-0.5">{formatCurrency(stats.totalValue)}</h3>
            </div>
          </div>
        )}

        {/* Low inventory alert */}
        <div className={cn(
          "p-4.5 rounded-2xl border flex items-center gap-4 shadow-xs transition-colors",
          stats.lowStockCount > 0 ? "bg-amber-50/50 border-amber-200" : "bg-white border-slate-200/80"
        )}>
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
            stats.lowStockCount > 0 ? "bg-amber-100 text-amber-700 animate-pulse" : "bg-slate-100 text-slate-500"
          )}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sản Phẩm Sắp Hết Hàng</p>
            <h3 className={cn(
              "text-xl font-black mt-0.5",
              stats.lowStockCount > 0 ? "text-amber-700 font-extrabold" : "text-slate-800"
            )}>{stats.lowStockCount} <span className="text-xs font-bold text-slate-400">loại</span></h3>
          </div>
        </div>

        {/* Out of stok warning */}
        <div className={cn(
          "p-4.5 rounded-2xl border flex items-center gap-4 shadow-xs transition-colors",
          stats.outOfStockCount > 0 ? "bg-rose-50/50 border-rose-200" : "bg-white border-slate-200/80"
        )}>
          <div className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
            stats.outOfStockCount > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"
          )}>
            <X className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sản Phẩm Đã Hết Kho</p>
            <h3 className={cn(
              "text-xl font-black mt-0.5",
              stats.outOfStockCount > 0 ? "text-rose-600 font-extrabold" : "text-slate-800"
            )}>{stats.outOfStockCount} <span className="text-xs font-bold text-slate-400">loại</span></h3>
          </div>
        </div>
      </div>

      {/* Control Tools Panel (Search, Filter, Status Tabs) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input 
              type="text"
              placeholder="Tìm theo thương hiệu, mã Sp, vị trí..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-500 bg-slate-50/50"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Stock Condition Badges */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            <button 
              onClick={() => setStockFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all border shrink-0",
                stockFilter === 'all' ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              Tất cả trạng thái
            </button>
            <button 
              onClick={() => setStockFilter('instock')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all border shrink-0 flex items-center gap-1.5",
                stockFilter === 'instock' ? "bg-emerald-600 border-emerald-600 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              <CheckCircle className="h-3 w-3" /> Còn hàng ({equipmentList.filter(item => (item.stock || 0) > (item.minStock || 0)).length})
            </button>
            <button 
              onClick={() => setStockFilter('low')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all border shrink-0 flex items-center gap-1.5",
                stockFilter === 'low' ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              <AlertTriangle className="h-3 w-3" /> Sắp hết ({equipmentList.filter(item => (item.stock || 0) > 0 && (item.stock || 0) <= (item.minStock || 0)).length})
            </button>
            <button 
              onClick={() => setStockFilter('outofstock')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wide transition-all border shrink-0 flex items-center gap-1.5",
                stockFilter === 'outofstock' ? "bg-rose-600 border-rose-600 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
              <X className="h-3 w-3" /> Chờ nhập kho ({equipmentList.filter(item => (item.stock || 0) === 0).length})
            </button>
          </div>
        </div>

        {/* Category Icons Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide border-t pt-3">
          <button 
            onClick={() => setCategoryFilter('all')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border shrink-0",
              categoryFilter === 'all' ? "bg-blue-600 border-blue-600 text-white shadow-xs" : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
            )}
          >
            Tất cả danh mục ({equipmentList.length})
          </button>
          {categories.map(cat => {
            const countInCat = equipmentList.filter(e => e.type === cat.id).length;
            return (
              <button 
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border flex items-center gap-1.5 shrink-0",
                  categoryFilter === cat.id ? "bg-blue-600 border-blue-600 text-white shadow-xs" : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                )}
              >
                <cat.icon className="h-3.5 w-3.5" />
                {cat.label} ({countInCat})
              </button>
            );
          })}
        </div>
      </div>

      {/* Equipment Warehouse Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredEquipment.map((item) => {
          const qty = item.stock || 0;
          const min = item.minStock || 0;
          
          let alertStatus: 'normal' | 'low' | 'out' = 'normal';
          if (qty === 0) {
            alertStatus = 'out';
          } else if (qty <= min) {
            alertStatus = 'low';
          }

          return (
            <div 
              key={item.id} 
              className={cn(
                "bg-white p-5 rounded-2xl border transition-all group relative flex flex-col justify-between overflow-hidden",
                alertStatus === 'out' ? "border-rose-200 hover:shadow-rose-50" : 
                alertStatus === 'low' ? "border-amber-200 hover:shadow-amber-50" : "border-slate-200 hover:shadow-slate-100",
                "hover:shadow-md hover:border-slate-300"
              )}
            >
              <div className="space-y-4">
                {/* Upper row: Icons & Action Triggers */}
                <div className="flex justify-between items-start">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                    item.type === 'panel' ? "bg-amber-50 text-amber-600" : 
                    item.type === 'inverter' ? "bg-blue-50 text-blue-600" : 
                    item.type === 'battery' ? "bg-emerald-50 text-emerald-600" : 
                    item.type === 'mounting' ? "bg-purple-50 text-purple-600" : "bg-slate-50 text-slate-500"
                  )}>
                    {item.type === 'panel' ? <Package className="h-5 w-5" /> : 
                    item.type === 'inverter' ? <Cpu className="h-5 w-5" /> : 
                    item.type === 'battery' ? <Battery className="h-5 w-5" /> : <Box className="h-5 w-5" />}
                  </div>

                  {/* Actions buttons */}
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-50 p-0.5 rounded-lg border border-slate-100 shadow-xs">
                    {isAdmin && (
                      <>
                        <button 
                          onClick={() => { setEditingItem(item); setIsEditModalOpen(true); }}
                          title="Chỉnh sửa thông số kỹ thuật"
                          className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => setDeletingId(item.id)}
                          title="Xóa thiết bị khỏi kho"
                          className="p-1 text-slate-500 hover:text-red-600 hover:bg-white rounded-md transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Main branding models details */}
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase leading-none">{item.brand}</span>
                    {item.type === 'inverter' && (
                      <span className={cn(
                        "text-[7px] px-1 py-0.5 font-bold uppercase rounded border scale-95",
                        item.isThreePhase ? "bg-purple-150 text-purple-700 border-purple-200" : "bg-blue-150 text-blue-700 border-blue-200"
                      )}>
                        {item.isThreePhase ? '3 Pha' : '1 Pha'}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-black text-slate-800 leading-tight mt-1 line-clamp-1" title={item.model}>
                    {item.model}
                  </h3>
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400 font-semibold uppercase tracking-tight">
                    <MapPin className="h-3 w-3 text-slate-300" />
                    <span>{item.location || 'Chưa phân phái'}</span>
                  </div>
                  {item.details && (
                    <div className="mt-2 text-[11px] text-slate-500 font-semibold italic line-clamp-2 border-l-2 border-slate-200 pl-1.5" title={item.details}>
                      {item.details}
                    </div>
                  )}
                </div>

                {/* Stock values badge & progress indicator */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-bold uppercase tracking-wide text-[9px]">Lượng tồn kho</span>
                    <span className={cn(
                      "font-black tracking-tight",
                      alertStatus === 'out' ? "text-rose-600 animate-pulse bg-rose-50 px-1.5 py-0.5 rounded" : 
                      alertStatus === 'low' ? "text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded" : "text-emerald-600"
                    )}>
                      {qty} {getUnit(item)} / <span className="text-[10px] text-slate-400 font-semibold">{min} {getUnit(item)} min</span>
                    </span>
                  </div>

                  {/* Stock micro bar indicator */}
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        alertStatus === 'out' ? "w-0" :
                        alertStatus === 'low' ? "bg-amber-400" : "bg-emerald-500"
                      )}
                      style={{ width: `${Math.min(100, (qty / Math.max(1, min * 2.5)) * 100)}%` }}
                    />
                  </div>

                  {/* Alert notifications label */}
                  {alertStatus === 'out' && (
                    <div className="text-[8px] font-black text-rose-500 uppercase tracking-widest text-center mt-1">🔴 HẾT HÀNG - CẦN NHẬP</div>
                  )}
                  {alertStatus === 'low' && (
                    <div className="text-[8px] font-black text-amber-500 uppercase tracking-widest text-center mt-1">🟡 DƯỚI ĐỊNH MỨC CẢNH BÁO</div>
                  )}
                  {alertStatus === 'normal' && (
                    <div className="text-[8px] font-black text-emerald-500 uppercase tracking-widest text-center mt-1">🟢 KHO HÀNG AN TOÀN</div>
                  )}
                </div>

                {/* Basic financial values */}
                <div className="space-y-1.5 pt-1">
                  {(userRole === 'admin' || userRole === 'accountant') && (
                    <div className="flex justify-between text-[11px] font-medium leading-none">
                      <span className="text-slate-400">Giá nhập vật tư:</span>
                      <span className="text-slate-700 font-bold">{formatCurrency(item.unitPrice || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[11px] font-medium leading-none border-t border-slate-50 pt-1.5">
                    <span className="text-slate-400">Giá bán dự kiến:</span>
                    <span className="text-emerald-600 font-bold">{item.sellingPrice ? formatCurrency(item.sellingPrice) : 'Chưa thiết lập'}</span>
                  </div>
                  {(userRole === 'admin' || userRole === 'accountant') && (
                    <div className="flex justify-between text-[11px] font-medium leading-none border-t border-slate-50 pt-1.5">
                      <span className="text-slate-400">Giá trị tồn kho (nhập):</span>
                      <span className="text-slate-900 font-black">{formatCurrency(qty * (item.unitPrice || 0))}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Warehouse dynamic in-out movement control panel */}
              <div className="mt-4 border-t border-slate-100 pt-3 flex gap-1.5 shrink-0">
                {isAdmin ? (
                  <>
                    <button 
                      onClick={() => {
                        setAdjustItem(item);
                        setAdjustType('import');
                        setIsAdjustModalOpen(true);
                      }}
                      className="flex-1 bg-blue-50/70 hover:bg-blue-105 border border-blue-100 text-blue-700 py-1.5 rounded-lg flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider transition-all active:scale-95"
                      title="Nhập thêm vật tư"
                    >
                      <ArrowUpRight className="h-3 w-3" /> Nhập kho
                    </button>
                    <button 
                      onClick={() => {
                        setAdjustItem(item);
                        setAdjustType('export');
                        setIsAdjustModalOpen(true);
                      }}
                      disabled={qty === 0}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1 text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 border",
                        qty === 0 
                          ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed" 
                          : "bg-slate-50/70 hover:bg-slate-100 border-slate-200 text-slate-700"
                      )}
                      title="Xuất vật tư ra kho"
                    >
                      <ArrowDownLeft className="h-3 w-3" /> Xuất kho
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => {
                      handleOpenRequestWithItem(item);
                    }}
                    disabled={qty === 0}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 border",
                      qty === 0 
                        ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed" 
                        : "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700"
                    )}
                    title="Tạo phiếu yêu cầu cấp phát vật tư này"
                  >
                    <FileText className="h-3.5 w-3.5 text-amber-600" /> Yêu cầu cấp phát
                  </button>
                )}
                <button 
                  onClick={() => {
                    setHistoryItem(item);
                    setIsHistoryModalOpen(true);
                  }}
                  className="px-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 rounded-lg flex items-center justify-center transition-all active:scale-95"
                  title="Xem lịch sử luân chuyển kho"
                >
                  <History className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredEquipment.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white border border-dashed border-slate-200 rounded-2xl shadow-xs">
            <Box className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm font-medium italic">Không tìm thấy mã thiết bị nào phù hợp trong kho.</p>
            <p className="text-slate-300 text-xs mt-1">Vui lòng thử cấu hình lại thanh tìm kiếm hoặc bộ lọc trạng thái.</p>
          </div>
        )}
      </div>
        </>
      )}

      {activeTab === 'requests' && (
        isCreatingRequest ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Left Column (Selector & Items Table) */}
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[500px]">
              {/* Header block with F3 Search */}
              <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                <button 
                  onClick={() => setIsCreatingRequest(false)}
                  className="flex items-center gap-2 text-[#1e3a8a] hover:text-blue-700 font-extrabold transition-all group shrink-0"
                >
                  <ArrowLeft className="h-5 w-5 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="text-base tracking-tight font-black uppercase">Chọn vật tư</span>
                </button>

                {/* Search Bar matching image */}
                <div className="relative flex-1 max-w-md">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="request-search-input"
                    type="text"
                    value={searchQueryInRequest}
                    onChange={e => setSearchQueryInRequest(e.target.value)}
                    placeholder="Tìm hàng hóa theo mã hoặc tên (F3)"
                    className="w-full pl-9 pr-14 py-2 text-xs border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-slate-50 focus:bg-white transition-all font-bold text-slate-800 shadow-3xs"
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                    <span className="p-1 rounded bg-slate-200/60 text-[9px] font-black text-slate-500 cursor-pointer select-none">
                      ::
                    </span>
                    <button 
                      onClick={() => {
                        const searchInput = document.getElementById('request-search-input');
                        if (searchInput) searchInput.focus();
                      }}
                      className="text-slate-400 hover:text-blue-500 font-black p-0.5 text-xs"
                      title="Focus ô tìm kiếm"
                    >
                      +
                    </button>
                  </div>

                  {/* Dropdown with results when searching */}
                  {searchQueryInRequest && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-40 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-1 duration-100">
                      {equipmentList.filter(eq => 
                        eq.brand.toLowerCase().includes(searchQueryInRequest.toLowerCase()) ||
                        eq.model.toLowerCase().includes(searchQueryInRequest.toLowerCase()) ||
                        (eq.type || '').toLowerCase().includes(searchQueryInRequest.toLowerCase())
                      ).length === 0 ? (
                        <div className="p-3 text-center text-slate-400 text-xs italic">Không tìm thấy vật tư phù hợp</div>
                      ) : (
                        equipmentList.filter(eq => 
                          eq.brand.toLowerCase().includes(searchQueryInRequest.toLowerCase()) ||
                          eq.model.toLowerCase().includes(searchQueryInRequest.toLowerCase()) ||
                          (eq.type || '').toLowerCase().includes(searchQueryInRequest.toLowerCase())
                        ).map(eq => {
                          const isOutOfStock = (eq.stock || 0) <= 0;
                          return (
                            <button
                              key={eq.id}
                              type="button"
                              disabled={isOutOfStock}
                              onClick={() => {
                                const existing = requestItems.find(ri => ri.equipmentId === eq.id);
                                if (existing) {
                                  setRequestItems(prev => prev.map(ri => 
                                    ri.equipmentId === eq.id ? { ...ri, quantity: ri.quantity + 1 } : ri
                                  ));
                                } else {
                                  setRequestItems(prev => [...prev, {
                                    equipmentId: eq.id,
                                    brand: eq.brand,
                                    model: eq.model,
                                    type: eq.type,
                                    quantity: 1,
                                    unit: eq.unit
                                  }]);
                                }
                                setSearchQueryInRequest('');
                              }}
                              className={cn(
                                "w-full text-left p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-xs",
                                isOutOfStock && "opacity-50 cursor-not-allowed bg-slate-50/50"
                              )}
                            >
                              <div>
                                <span className="font-extrabold text-slate-800">{eq.brand} - {eq.model}</span>
                                <span className="ml-2 text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-black uppercase">({eq.type})</span>
                              </div>
                              <div className="text-[11px] font-bold text-slate-500">
                                {isOutOfStock ? (
                                  <span className="text-rose-500 font-extrabold">Hết hàng</span>
                                ) : (
                                  <>Còn lại: <span className="text-blue-600 font-extrabold">{eq.stock}</span> {getUnit(eq)}</>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Table Header matching image */}
              <div className="bg-[#eef2ff] text-[#1e3a8a] text-[11px] font-black grid grid-cols-12 px-4 py-3 border-b border-slate-200 tracking-wider uppercase">
                <div className="col-span-1 text-center">STT</div>
                <div className="col-span-2">Mã hàng</div>
                <div className="col-span-5">Tên hàng</div>
                <div className="col-span-2 text-center">ĐVT</div>
                <div className="col-span-2 text-center">Số lượng</div>
              </div>

              {/* Table Content */}
              <div className="flex-1 overflow-y-auto min-h-[300px] flex flex-col justify-between bg-white">
                {requestItems.length === 0 ? (
                  /* Excel import empty state from screenshot */
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[320px]">
                    <div className="max-w-sm">
                      <p className="text-sm font-black text-slate-800">Thêm sản phẩm từ file excel</p>
                      <button 
                        onClick={handleDownloadSampleRequestFile}
                        className="text-xs text-[#0066ff] hover:underline mt-1 font-semibold flex items-center justify-center gap-1 mx-auto"
                      >
                        (Tải về file mẫu: <span className="font-bold underline text-blue-600">Excel file</span>)
                      </button>

                      <div className="mt-5">
                        <label className="bg-[#0066ff] hover:bg-blue-600 text-white px-6 py-2.5 rounded-xl inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer">
                          <FileSpreadsheet className="h-4 w-4" />
                          Chọn file dữ liệu
                          <input 
                            type="file" 
                            accept=".csv,.txt" 
                            onChange={handleImportRequestFile}
                            className="hidden" 
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* List of added items in table rows */
                  <div className="divide-y divide-slate-100 flex-1">
                    {requestItems.map((item, index) => (
                      <div key={item.equipmentId} className="grid grid-cols-12 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50/40 transition-colors items-center animate-in fade-in duration-100">
                        <div className="col-span-1 text-center font-bold text-slate-400">{index + 1}</div>
                        <div className="col-span-2 font-mono text-slate-500 font-bold uppercase">{item.equipmentId.substring(0, 8).toUpperCase()}</div>
                        <div className="col-span-5">
                          <span className="font-extrabold text-slate-800">{item.brand}</span>
                          <span className="mx-1.5 text-slate-400">•</span>
                          <span className="font-medium text-slate-600">{item.model}</span>
                        </div>
                        <div className="col-span-2 text-center uppercase tracking-wider text-[11px] text-slate-500 font-bold">
                          {item.unit || getUnit(item)}
                        </div>
                        <div className="col-span-2 flex items-center justify-center gap-1.5">
                          <button 
                            type="button"
                            onClick={() => {
                              setRequestItems(prev => prev.map(ri => 
                                ri.equipmentId === item.equipmentId 
                                  ? { ...ri, quantity: Math.max(1, ri.quantity - 1) } 
                                  : ri
                              ));
                            }}
                            className="w-5 h-5 bg-slate-100 text-slate-600 rounded flex items-center justify-center hover:bg-slate-200 transition-all font-black text-xs active:scale-90"
                          >
                            -
                          </button>
                          <input 
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => {
                              const val = Math.max(1, parseInt(e.target.value) || 1);
                              setRequestItems(prev => prev.map(ri => 
                                ri.equipmentId === item.equipmentId ? { ...ri, quantity: val } : ri
                              ));
                            }}
                            className="w-10 text-center text-xs font-black text-slate-800 border border-slate-200 rounded py-0.5 outline-none focus:border-blue-500"
                          />
                          <button 
                            type="button"
                            onClick={() => {
                              setRequestItems(prev => prev.map(ri => 
                                ri.equipmentId === item.equipmentId 
                                  ? { ...ri, quantity: ri.quantity + 1 } 
                                  : ri
                              ));
                            }}
                            className="w-5 h-5 bg-slate-100 text-slate-600 rounded flex items-center justify-center hover:bg-slate-200 transition-all font-black text-xs active:scale-90"
                          >
                            +
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleRemoveRequestItem(item.equipmentId)}
                            className="text-rose-500 hover:text-rose-700 ml-1.5 p-1 transition-colors"
                            title="Xóa vật tư"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct quick item dropdown selection */}
                {requestItems.length > 0 && (
                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row gap-2 items-center mt-auto">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Thêm thiết bị nhanh:</span>
                    <select
                      value={selectedEqId}
                      onChange={e => {
                        const val = e.target.value;
                        if (!val) return;
                        const item = equipmentList.find(eq => eq.id === val);
                        if (!item) return;
                        
                        const existing = requestItems.find(ri => ri.equipmentId === val);
                        if (existing) {
                          setRequestItems(prev => prev.map(ri => 
                            ri.equipmentId === val ? { ...ri, quantity: ri.quantity + 1 } : ri
                          ));
                        } else {
                          setRequestItems(prev => [...prev, {
                            equipmentId: item.id,
                            brand: item.brand,
                            model: item.model,
                            type: item.type,
                            quantity: 1,
                            unit: item.unit
                          }]);
                        }
                        setSelectedEqId('');
                      }}
                      className="flex-1 p-2 border border-slate-200 bg-white rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all"
                    >
                      <option value="">-- Chọn thiết bị trong kho cần cấp phát thêm --</option>
                      {equipmentList.map(eq => (
                        <option key={eq.id} value={eq.id} disabled={(eq.stock || 0) <= 0}>
                          {eq.brand} - {eq.model} (Sẵn có: {eq.stock || 0} {getUnit(eq)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (Slip form details) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-3xs flex flex-col gap-4">
                {/* User dropdown & current time */}
                <div className="flex justify-between items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2.5 py-1.5 rounded-xl text-[11px] font-black text-slate-700 uppercase tracking-tight">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>Kỹ Thuật</span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </div>

                  <div className="text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl font-mono">
                    {new Date().toLocaleString('vi-VN', { 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric' 
                    })}
                  </div>
                </div>

                {/* Search project block */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Tìm tên công trình</label>
                    <button 
                      type="button" 
                      onClick={() => {
                        const name = prompt("Nhập tên công trình mới để liên kết:");
                        if (name) {
                          const newProj = { id: 'temp-' + Date.now(), name: name };
                          setProjectsList(prev => [newProj, ...prev]);
                          setRequestProjectId(newProj.id);
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800 p-0.5"
                      title="Tạo công trình mới"
                    >
                      <Plus className="h-4 w-4 stroke-[3]" />
                    </button>
                  </div>
                  <select
                    value={requestProjectId}
                    onChange={e => setRequestProjectId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 bg-slate-50 focus:bg-white rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="">-- Chọn công trình cần liên kết --</option>
                    {projectsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name || p.customerName || 'Dự án không tên'}</option>
                    ))}
                  </select>
                </div>

                {/* Mã phiếu block */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Mã phiếu</label>
                  <input
                    type="text"
                    value="Mã phiếu tự động"
                    disabled
                    className="w-full p-2.5 border border-slate-200 bg-slate-50 rounded-xl text-xs font-bold text-slate-400 select-none outline-none"
                  />
                </div>

                {/* Trạng thái row */}
                <div className="flex justify-between items-center border-y border-dashed border-slate-100 py-3 text-xs">
                  <span className="text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">Trạng thái</span>
                  <span className="text-[#1e3a8a] font-black bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-lg text-[10px] uppercase">Phiếu tạm</span>
                </div>

                {/* Reason/Notes block */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Ghi chú</label>
                  <textarea
                    required
                    value={requestReason}
                    onChange={e => setRequestReason(e.target.value)}
                    placeholder="Nhập ghi chú hoặc lý do cấp phát vật tư cụ thể..."
                    rows={4}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-500 focus:bg-white bg-slate-50 transition-all resize-none font-semibold text-slate-700 shadow-3xs"
                  />
                </div>

                {/* Submit button footer */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      alert("Đã lưu tạm dự thảo phiếu yêu cầu thành công!");
                    }}
                    className="py-2.5 border border-blue-600 bg-white hover:bg-blue-50 text-blue-600 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
                  >
                    Lưu tạm
                  </button>
                  <button
                    type="button"
                    disabled={requestItems.length === 0}
                    onClick={handleCreateMaterialRequest}
                    className={cn(
                      "py-2.5 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-md",
                      requestItems.length === 0 
                        ? "bg-slate-300 cursor-not-allowed shadow-none" 
                        : "bg-[#0066ff] hover:bg-blue-600 shadow-blue-100 hover:shadow-lg"
                    )}
                  >
                    Hoàn thành
                  </button>
                </div>

                {/* Hotline bar */}
                <div className="flex justify-center items-center gap-1.5 text-slate-500 text-[11px] font-black uppercase tracking-wider pt-3 border-t border-slate-100">
                  <Phone className="h-3.5 w-3.5 text-blue-500 stroke-[3]" />
                  <span>Tổng đài: 1900 6520</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* List of requests when not creating */
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Requests Header and Create button */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-4 w-4 text-orange-500" /> Quản Lý Phiếu Yêu Cầu Vật Tư
                </h3>
                <p className="text-xs text-slate-500 mt-1">Yêu cầu cấp phát vật tư để thi công và lắp đặt dự án. Sau khi tạo sẽ gửi thông báo đến Admin & Quản lý phê duyệt.</p>
              </div>
              <button
                onClick={() => setIsCreatingRequest(true)}
                className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 text-xs font-black uppercase tracking-wider shadow-md hover:shadow-lg transition-all active:scale-95 shrink-0"
              >
                <Plus className="h-4 w-4" /> Tạo phiếu yêu cầu mới
              </button>
            </div>

            {/* List of Material Requests */}
            <div className="space-y-4">
              {requestsLoading ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
                  <p className="text-slate-500 text-xs italic">Đang tải danh sách phiếu yêu cầu...</p>
                </div>
              ) : materialRequests.length === 0 ? (
                <div className="py-16 text-center bg-white border border-dashed border-slate-200 rounded-2xl shadow-xs">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm font-medium italic">Không có phiếu yêu cầu vật tư nào.</p>
                  <p className="text-slate-300 text-xs mt-1">Hãy nhấn "Tạo phiếu yêu cầu mới" để bắt đầu đề xuất cấp phát.</p>
                </div>
              ) : (
                materialRequests.map((req) => {
                  const dateStr = req.createdAt?.toDate 
                    ? req.createdAt.toDate().toLocaleString('vi-VN') 
                    : req.createdAt 
                      ? new Date(req.createdAt).toLocaleString('vi-VN') 
                      : 'Đang xử lý...';
                  
                  const resolvedDateStr = req.resolvedAt?.toDate 
                    ? req.resolvedAt.toDate().toLocaleString('vi-VN') 
                    : req.resolvedAt 
                      ? new Date(req.resolvedAt).toLocaleString('vi-VN') 
                      : '';

                  return (
                    <div 
                      key={req.id}
                      className={cn(
                        "bg-white rounded-2xl border p-5 shadow-xs transition-all flex flex-col justify-between",
                        req.status === 'pending' ? "border-amber-200 hover:shadow-amber-50" : 
                        req.status === 'approved' ? "border-emerald-200 hover:shadow-emerald-50" : 
                        "border-rose-200 hover:shadow-rose-50"
                      )}
                    >
                      {/* Slip Header */}
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2.5 py-1 text-[10px] font-black uppercase rounded-lg border",
                              req.status === 'pending' ? "bg-amber-50 border-amber-200 text-amber-700" :
                              req.status === 'approved' ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
                              "bg-rose-50 border-rose-200 text-rose-700"
                            )}>
                              {req.status === 'pending' ? '🟡 Chờ duyệt' : 
                               req.status === 'approved' ? '🟢 Đã duyệt' : '🔴 Từ chối'}
                            </span>
                            <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                              Mã phiếu: #{req.id?.substring(0, 6).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-slate-400 font-bold uppercase tracking-tight">
                            <span className="text-slate-600 font-extrabold">{req.technicianName}</span>
                            <span>•</span>
                            <span>{dateStr}</span>
                            {req.projectName && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                  <Briefcase className="h-3 w-3" /> {req.projectName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Approve / Reject buttons for Admin/Manager */}
                        {req.status === 'pending' && isAdmin && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setResolvingRequest(req);
                                setResolveAction('approve');
                                setAdminNote('');
                                setIsResolveModalOpen(true);
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 px-3.5 py-1.5 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 animate-in fade-in"
                            >
                              <Check className="h-3.5 w-3.5" /> Phê duyệt
                            </button>
                            <button
                              onClick={() => {
                                setResolvingRequest(req);
                                setResolveAction('reject');
                                setAdminNote('');
                                setIsResolveModalOpen(true);
                              }}
                              className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-3.5 py-1.5 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 animate-in"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Từ chối
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Slip Body - Requested Items */}
                      <div className="py-4 space-y-3">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Danh sách thiết bị yêu cầu cấp phát:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {req.items?.map((item: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                                  {item.type === 'panel' ? <Package className="h-4 w-4 text-amber-500" /> :
                                   item.type === 'inverter' ? <Cpu className="h-4 w-4 text-blue-500" /> :
                                   item.type === 'battery' ? <Battery className="h-4 w-4 text-emerald-500" /> :
                                   <Box className="h-4 w-4 text-slate-500" />}
                                </div>
                                <div>
                                  <span className="text-[8px] font-black tracking-widest text-slate-400 uppercase block">{item.brand}</span>
                                  <span className="text-xs font-black text-slate-800 line-clamp-1">{item.model}</span>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-black text-slate-400 block uppercase">Số lượng</span>
                                <span className="text-sm font-black text-slate-800">{item.quantity} {getUnit(item)}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="bg-slate-50/50 p-3.5 rounded-xl border border-dashed mt-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lý do yêu cầu:</p>
                          <p className="text-xs text-slate-700 font-medium mt-1 italic">"{req.reason || 'Không có lý do chi tiết'}"</p>
                        </div>
                      </div>

                      {/* Slip Resolution details */}
                      {req.status !== 'pending' && (
                        <div className={cn(
                          "mt-2 p-3.5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs",
                          req.status === 'approved' ? "bg-emerald-50/40 border-emerald-100" : "bg-rose-50/40 border-rose-100"
                        )}>
                          <div>
                            <p className="font-black text-slate-800">
                              {req.status === 'approved' ? '✅ Được phê duyệt bởi' : '❌ Bị từ chối bởi'} <span className="text-blue-600 font-extrabold">{req.resolvedBy}</span> vào {resolvedDateStr}
                            </p>
                            {req.adminNote && (
                              <p className="text-slate-600 mt-1.5 font-medium italic">
                                Phản hồi: "{req.adminNote}"
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )
      )}

      {/* MODAL 1: Nhập/Xuất kho vật tư */}
      {isAdjustModalOpen && adjustItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150">
            <div className="flex justify-between items-center mb-5 border-b pb-3">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "p-1.5 rounded-lg",
                  adjustType === 'import' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                )}>
                  {adjustType === 'import' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                </span>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  {adjustType === 'import' ? 'Nhập kho bổ sung' : 'Xuất kho vật tư'}
                </h3>
              </div>
              <button 
                onClick={() => { setIsAdjustModalOpen(false); setAdjustItem(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Thiết bị thao tác</p>
              <p className="text-xs font-black text-slate-700 mt-1">{adjustItem.brand} - {adjustItem.model}</p>
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold mt-1">
                <span>Lượng hiện có: {adjustItem.stock || 0} {getUnit(adjustItem)}</span>
                <span>Vị trí: {adjustItem.location || 'Chưa rõ'}</span>
              </div>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Số lượng thao tác (chiếc/tấm)</label>
                <input 
                  type="number"
                  required
                  min={1}
                  max={adjustType === 'export' ? (adjustItem.stock || 0) : 9999}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all shadow-xs"
                  value={adjustQty}
                  onChange={e => setAdjustQty(Math.max(1, Number(e.target.value)))}
                />
                {adjustType === 'export' && (adjustItem.stock || 0) < adjustQty && (
                  <p className="text-[10px] text-rose-500 font-semibold mt-1">Số lượng xuất kho vượt quá lượng tồn kho hiện tại!</p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Lý do / Mô tả chi tiết
                </label>
                <textarea 
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white transition-all h-20 resize-none shadow-xs"
                  placeholder={adjustType === 'import' ? 'VD: Nhập thêm lô hàng từ Canadian Solar Vietnam' : 'VD: Xuất kho phục vụ lắp đặt dự án Hòa Lưới 10kW Hoàng Mai'}
                  required
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                />
                
                {/* Suggestions templates */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {(adjustType === 'import' 
                    ? ['Đại lý nhập hàng sỉ', 'Hàng dư công trình trả kho', 'Kiểm kê bù dư']
                    : ['Xuất cho tổ thi công', 'Hàng lỗi gửi bảo hành', 'Xuất mẫu khảo sát']
                  ).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAdjustNote(t)}
                      className="text-[9px] font-bold text-slate-400 bg-slate-100 hover:bg-slate-200 hover:text-slate-600 px-2 py-0.5 rounded transition-all"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-2.5">
                <button 
                  type="button"
                  onClick={() => { setIsAdjustModalOpen(false); setAdjustItem(null); }}
                  className="flex-1 py-2.5 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all uppercase tracking-wider text-center"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  disabled={adjustType === 'export' && (adjustItem.stock || 0) < adjustQty}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-black text-white rounded-xl shadow-md transition-all uppercase tracking-wider text-center",
                    adjustType === 'export' && (adjustItem.stock || 0) < adjustQty
                      ? "bg-slate-350 cursor-not-allowed"
                      : adjustType === 'import' ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-500 hover:bg-amber-600"
                  )}
                >
                  Đồng ý lưu {adjustQty} SP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Tạo mới & Chỉnh sửa kỹ thuật thiết bị */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150">
            <div className="flex justify-between items-center mb-5 border-b pb-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Package className="h-4 w-4 text-blue-500" />
                {editingItem?.id ? 'HIỆU CHỈNH THÔNG SỐ VẬT TƯ' : 'KHAI BÁO THÔNG TIN VẬT TƯ MỚI'}
              </h3>
              <button 
                onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEquipment} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Nhóm thiết bị</label>
                  <select 
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                    value={editingItem?.type}
                    onChange={e => setEditingItem({ ...editingItem, type: e.target.value as any })}
                  >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Hãng sản xuất</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white uppercase"
                    value={editingItem?.brand}
                    placeholder="VD: Canadian Solar"
                    onChange={e => setEditingItem({ ...editingItem, brand: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Model / Mã ký hiệu</label>
                <input 
                  required
                  type="text"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                  value={editingItem?.model}
                  placeholder="VD: HiKu6 CS6W-550MS"
                  onChange={e => setEditingItem({ ...editingItem, model: e.target.value })}
                />
              </div>

              {['mounting', 'accessory', 'other'].includes(editingItem?.type || '') && (() => {
                const isStandardUnit = !editingItem?.unit || ['cái', 'bộ', 'mét'].includes(editingItem.unit);
                const displayUnitOption = editingItem?.unit ? (isStandardUnit ? editingItem.unit : 'custom') : 'cái';
                
                return (
                  <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-200/60 space-y-2">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">Đơn vị tính</label>
                    <select
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500"
                      value={displayUnitOption}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'custom') {
                          setEditingItem({ ...editingItem, unit: 'Khác' });
                        } else {
                          setEditingItem({ ...editingItem, unit: val });
                        }
                      }}
                    >
                      <option value="cái">cái</option>
                      <option value="bộ">bộ</option>
                      <option value="mét">mét</option>
                      <option value="custom">Tự thêm đơn vị tính...</option>
                    </select>
                    
                    {displayUnitOption === 'custom' && (
                      <input 
                        type="text"
                        required
                        placeholder="Nhập đơn vị tính mới (VD: cuộn, thùng, chiếc...)"
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 animate-in fade-in duration-200"
                        value={editingItem?.unit === 'Khác' ? '' : (editingItem?.unit || '')}
                        onChange={e => setEditingItem({ ...editingItem, unit: e.target.value })}
                      />
                    )}
                  </div>
                );
              })()}

              <div className={cn("grid gap-4", (userRole === 'admin' || userRole === 'accountant') ? "grid-cols-2" : "grid-cols-1")}>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                    Công suất ({editingItem?.type === 'panel' ? 'Wp' : 'kW'})
                  </label>
                  <input 
                    type="number"
                    step="0.01"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                    value={editingItem?.capacity}
                    onChange={e => setEditingItem({ ...editingItem, capacity: Number(e.target.value) })}
                  />
                </div>
                {(userRole === 'admin' || userRole === 'accountant') && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Đơn vị giá nhập (VND)</label>
                    <input 
                      type="number"
                      step="1000"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                      value={editingItem?.unitPrice}
                      onChange={e => setEditingItem({ ...editingItem, unitPrice: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Đơn vị giá bán dự kiến (VND)</label>
                  <input 
                    type="number"
                    step="1000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white"
                    placeholder="Nhập giá bán dự kiến cho khách hàng..."
                    value={editingItem?.sellingPrice || ''}
                    onChange={e => setEditingItem({ ...editingItem, sellingPrice: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Chi tiết vật tư / Thông số mô tả</label>
                <textarea 
                  rows={2}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-white resize-none"
                  placeholder="Nhập chi tiết vật tư, đặc tính kỹ thuật hoặc hướng dẫn..."
                  value={editingItem?.details || ''}
                  onChange={e => setEditingItem({ ...editingItem, details: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-150">
                <div className="col-span-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Tồn ban đầu</label>
                  <input 
                    type="number"
                    disabled={!!editingItem?.id}
                    title={editingItem?.id ? "Tăng giảm số lượng vui lòng dùng tính năng Nhập/Xuất kho để ghi nhận nhật ký" : "Dữ liệu ban đầu"}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500 disabled:opacity-50 disabled:bg-slate-100"
                    value={editingItem?.stock}
                    onChange={e => setEditingItem({ ...editingItem, stock: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Cảnh báo tối thiểu</label>
                  <input 
                    type="number"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                    value={editingItem?.minStock}
                    onChange={e => setEditingItem({ ...editingItem, minStock: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">Phân Khu / Kệ</label>
                  <input 
                    type="text"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                    value={editingItem?.location}
                    placeholder="Khu A"
                    onChange={e => setEditingItem({ ...editingItem, location: e.target.value })}
                  />
                </div>
              </div>

              {editingItem?.type === 'inverter' && (
                <div className="bg-blue-50/20 p-4 rounded-xl border border-blue-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={editingItem?.isThreePhase || false}
                      onChange={e => setEditingItem({ ...editingItem, isThreePhase: e.target.checked })}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Cấu hình lưới điện 3 Pha</span>
                      <span className="text-[10px] text-slate-500 font-medium">Bỏ chọn nếu là biến tần 1 pha dân dụng</span>
                    </div>
                  </label>
                </div>
              )}

              <div className="pt-4 flex gap-2.5">
                <button 
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingItem(null); }}
                  className="flex-1 py-2.5 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all uppercase tracking-wider text-center"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all uppercase tracking-wider text-center"
                >
                  {editingItem?.id ? 'Cập nhật thiết bị' : 'Lưu thiết bị mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Chi tiết lịch sử giao dịch kho */}
      {isHistoryModalOpen && historyItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150 flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 border-b pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-blue-600" />
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                    Nhật Ký Luân Chuyển Kho
                  </h3>
                  <p className="text-[10px] text-slate-400 font-semibold">{historyItem.brand} - {historyItem.model}</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsHistoryModalOpen(false); setHistoryItem(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* General state */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 shrink-0 grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Lượng Tồn Hiện Tại</span>
                <span className="text-sm font-extrabold text-blue-600 mt-0.5 block">{historyItem.stock || 0} SP</span>
              </div>
              <div>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Vị Trí Sắp Đặt</span>
                <span className="text-sm font-extrabold text-slate-700 mt-0.5 block">{historyItem.location || 'Khu A'}</span>
              </div>
              <div>
                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Định Mức Cảnh Báo</span>
                <span className="text-sm font-extrabold text-slate-700 mt-0.5 block">{historyItem.minStock || 5} SP</span>
              </div>
            </div>

            {/* List transactions */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[250px]">
              {historyItem.history && historyItem.history.length > 0 ? (
                historyItem.history.map((log, index) => (
                  <div 
                    key={`log-${index}`}
                    className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-start gap-3 text-xs justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0",
                          log.type === 'import' ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-amber-50 text-amber-600 border-amber-100"
                        )}>
                          {log.type === 'import' ? 'Nhập kho' : 'Xuất kho'}
                        </span>
                        <span className="text-slate-700 font-extrabold">
                          {log.type === 'import' ? `+${log.quantity}` : `-${log.quantity}`} chiếc
                        </span>
                      </div>
                      <p className="text-slate-600 font-semibold leading-normal">{log.note}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400 font-bold pt-1 border-t border-dashed border-slate-100 my-0.5">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-300" />
                          <span>Thực hiện: {log.createdByName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-300" />
                          <span>Thời gian: {new Date(log.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-slate-400 italic">
                  Chưa ghi nhận hoạt động luân chuyển kho nào cho thiết bị này.
                </div>
              )}
            </div>

            <div className="pt-4 border-t mt-4 shrink-0">
              <button 
                onClick={() => { setIsHistoryModalOpen(false); setHistoryItem(null); }}
                className="w-full py-2.5 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all uppercase tracking-wider text-center"
              >
                Đóng lịch sử
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Xác nhận xóa */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150 text-center">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-7 w-7" />
            </div>
            <h3 className="text-md font-black text-slate-900 mb-2 uppercase tracking-wide">Xác nhận xóa vật tư?</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">Hành động này sẽ xóa vĩnh viễn thiết bị kỹ thuật này và lịch sử kho liên quan ra khỏi hệ thống.</p>
            
            <div className="flex gap-2.5">
              <button 
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all uppercase tracking-wider"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => handleDeleteEquipment(deletingId)}
                className="flex-1 py-2 text-xs font-black bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-md transition-all uppercase tracking-wider"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Tạo phiếu yêu cầu vật tư */}
      {false && isRequestModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-5 border-b pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-500" />
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  Tạo Phiếu Yêu Cầu Vật Tư
                </h3>
              </div>
              <button 
                onClick={() => setIsRequestModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMaterialRequest} className="space-y-4 overflow-y-auto pr-1 flex-1">
              {/* Linked Project Select */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Liên kết công trình / dự án
                </label>
                <select
                  value={requestProjectId}
                  onChange={e => setRequestProjectId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 outline-none focus:border-amber-500"
                >
                  <option value="">-- Chọn công trình cần cấp phát (Không bắt buộc) --</option>
                  {projectsList.map(p => (
                    <option key={p.id} value={p.id}>{p.name || p.customerName || 'Dự án không tên'}</option>
                  ))}
                </select>
              </div>

              {/* Add item selector */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Thêm thiết bị vào phiếu:</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <select
                      value={selectedEqId}
                      onChange={e => setSelectedEqId(e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium bg-white outline-none"
                    >
                      <option value="">-- Chọn thiết bị kỹ thuật --</option>
                      {equipmentList.map(eq => (
                        <option key={eq.id} value={eq.id} disabled={(eq.stock || 0) <= 0}>
                          {eq.brand} - {eq.model} (Còn lại: {eq.stock || 0})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full sm:w-24">
                    <input
                      type="number"
                      min={1}
                      value={selectedEqQty}
                      onChange={e => setSelectedEqQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium outline-none"
                      placeholder="SL"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRequestItem}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider shrink-0 transition-all"
                  >
                    Thêm
                  </button>
                </div>
              </div>

              {/* Current Requested Items List */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Danh sách thiết bị đề xuất ({requestItems.length}):</p>
                {requestItems.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Vui lòng chọn thiết bị và nhấn nút "Thêm" ở trên.</p>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {requestItems.map((ri, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-slate-100 shadow-3xs text-xs">
                        <div className="flex-1 min-w-0 pr-2">
                          <span className="font-bold text-slate-800 truncate block">{ri.brand} - {ri.model}</span>
                          <span className="text-[9px] font-black uppercase text-slate-400">({ri.type})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-amber-600 shrink-0">{ri.quantity} {getUnit(ri)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRequestItem(ri.equipmentId)}
                            className="text-rose-500 hover:text-rose-700 font-bold p-1"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Reason Description */}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Lý do yêu cầu / Ghi chú kỹ thuật
                </label>
                <textarea
                  required
                  value={requestReason}
                  onChange={e => setRequestReason(e.target.value)}
                  rows={3}
                  placeholder="Nhập lý do cụ thể để phê duyệt dễ dàng hơn..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t flex gap-2.5 shrink-0 mt-auto">
                <button 
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all uppercase tracking-wider"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  disabled={requestItems.length === 0}
                  className={cn(
                    "flex-1 py-2.5 text-xs font-black rounded-xl shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-2 text-white",
                    requestItems.length === 0 
                      ? "bg-slate-300 cursor-not-allowed shadow-none" 
                      : "bg-amber-500 hover:bg-amber-600"
                  )}
                >
                  <Send className="h-3.5 w-3.5" /> Gửi yêu cầu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Phê duyệt / Từ chối phiếu yêu cầu */}
      {isResolveModalOpen && resolvingRequest && resolveAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150 text-left">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <div className="flex items-center gap-2">
                {resolveAction === 'approve' ? (
                  <Check className="h-5 w-5 text-emerald-600 bg-emerald-50 p-0.5 rounded-full" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-600 bg-rose-50 p-0.5 rounded-full" />
                )}
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  {resolveAction === 'approve' ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'}
                </h3>
              </div>
              <button 
                onClick={() => { setIsResolveModalOpen(false); setResolvingRequest(null); setResolveAction(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600">
                Bạn đang thực hiện {resolveAction === 'approve' ? 'PHÊ DUYỆT' : 'TỪ CHỐI'} phiếu yêu cầu của kỹ thuật <span className="font-extrabold text-slate-900">{resolvingRequest.technicianName}</span>.
              </p>

              {resolveAction === 'approve' && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200/60 text-[11px] text-amber-800 leading-relaxed">
                  ⚠️ <strong>Lưu ý:</strong> Sau khi phê duyệt, số lượng vật tư được yêu cầu sẽ <strong>tự động trừ trực tiếp</strong> trong kho hàng chính thức.
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Lời nhắn / Phản hồi của quản trị viên
                </label>
                <textarea
                  required={resolveAction === 'reject'}
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                  rows={3}
                  placeholder={resolveAction === 'approve' ? "Ghi chú phê duyệt (không bắt buộc)..." : "Nhập lý do cụ thể từ chối phiếu này (bắt buộc)..."}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-2.5">
                <button 
                  onClick={() => { setIsResolveModalOpen(false); setResolvingRequest(null); setResolveAction(null); }}
                  className="flex-1 py-2 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all uppercase tracking-wider"
                >
                  Hủy bỏ
                </button>
                <button 
                  onClick={handleResolveRequest}
                  disabled={resolveAction === 'reject' && !adminNote.trim()}
                  className={cn(
                    "flex-1 py-2 text-xs font-black text-white rounded-lg shadow-md transition-all uppercase tracking-wider",
                    resolveAction === 'approve' ? "bg-emerald-600 hover:bg-emerald-700" : 
                    (!adminNote.trim() ? "bg-slate-300 cursor-not-allowed shadow-none" : "bg-rose-600 hover:bg-rose-700")
                  )}
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: Nhập khẩu thiết bị từ Excel */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl p-6 shadow-2xl border border-slate-200 animate-in zoom-in duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-5 border-b pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                    NHẬP KHẨU KHO VẬT TƯ TỪ EXCEL
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">Giao diện số hóa danh mục dành cho Kế Toán</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsImportModalOpen(false); setParsedItems([]); setImportError(null); setImportSuccess(null); }} 
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="space-y-5 overflow-y-auto pr-1 flex-1">
              {/* Instructions and download template */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Download className="h-4 w-4 text-emerald-600" /> Hướng dẫn chuẩn bị tệp
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Tải file biểu mẫu Excel bên dưới, điền đầy đủ các cột thông tin bắt buộc gồm: <strong className="text-slate-900">Loại thiết bị, Thương hiệu, Model, Công suất, Đơn giá nhập/bán, Số lượng ban đầu</strong>.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors border border-emerald-200/80 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Tải file mẫu nhập kho (.xlsx)
                </button>
              </div>

              {/* Status alerts */}
              {importError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in duration-150">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <span className="font-extrabold">Có lỗi xảy ra:</span> {importError}
                  </div>
                </div>
              )}

              {importSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-150">
                  <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                  <div className="font-bold">
                    {importSuccess}
                  </div>
                </div>
              )}

              {/* Drag-drop file zone */}
              <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 hover:bg-slate-50/50 transition-colors rounded-2xl p-6 text-center relative cursor-pointer group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleParseExcel}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-emerald-50 text-slate-400 group-hover:text-emerald-600 flex items-center justify-center transition-colors">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Kéo thả tệp Excel vào đây hoặc nhấp để tải lên</p>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Chấp nhận tệp định dạng .xlsx hoặc .xls</p>
                  </div>
                </div>
              </div>

              {/* Preview parsed data */}
              {parsedItems.length > 0 && (
                <div className="space-y-3 animate-in slide-in-from-bottom duration-200">
                  <div className="flex justify-between items-center bg-slate-100 px-3 py-2 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">Danh sách xem trước từ tệp</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        Hợp lệ: {parsedItems.filter(x => x.isValid).length}
                      </span>
                      {parsedItems.filter(x => !x.isValid).length > 0 && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                          Lỗi: {parsedItems.filter(x => !x.isValid).length}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-100">
                          <th className="py-2 px-3 text-center">Dòng</th>
                          <th className="py-2 px-3">Thiết bị</th>
                          <th className="py-2 px-3">Phân nhóm</th>
                          <th className="py-2 px-3 text-right">Tồn kho</th>
                          {(userRole === 'admin' || userRole === 'accountant') && <th className="py-2 px-3 text-right">Đơn giá</th>}
                          <th className="py-2 px-3 text-center">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedItems.map((item, idx) => (
                          <React.Fragment key={idx}>
                            <tr className={cn("hover:bg-slate-50/80 transition-colors", !item.isValid && "bg-rose-50/20")}>
                              <td className="py-2.5 px-3 text-center text-slate-400 font-mono font-bold">{item.rowNum}</td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                <div>{item.data.brand}</div>
                                <div className="text-[10px] text-slate-400 font-mono font-medium">{item.data.model}</div>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-slate-500 text-[10px] uppercase">
                                {categories.find(c => c.id === item.data.type)?.label || item.data.type}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-700">{item.data.stock || 0}</td>
                              {(userRole === 'admin' || userRole === 'accountant') && (
                                <td className="py-2.5 px-3 text-right font-mono text-slate-600">{formatCurrency(item.data.unitPrice || 0)}</td>
                              )}
                              <td className="py-2.5 px-3 text-center">
                                {item.isValid ? (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">
                                    <Check className="h-2.5 w-2.5" /> Hợp lệ
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-full border border-rose-100">
                                    <X className="h-2.5 w-2.5" /> Lỗi
                                  </span>
                                )}
                              </td>
                            </tr>
                            {!item.isValid && (
                              <tr className="bg-rose-50/10">
                                <td colSpan={(userRole === 'admin' || userRole === 'accountant') ? 6 : 5} className="py-1 px-4 text-[10px] text-rose-600 font-medium">
                                  <div className="flex flex-col gap-0.5 pl-4 border-l-2 border-rose-350">
                                    {item.errors.map((err, errIdx) => (
                                      <span key={errIdx}>• {err}</span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex gap-3 border-t pt-4 mt-4 shrink-0">
              <button
                type="button"
                onClick={() => { setIsImportModalOpen(false); setParsedItems([]); setImportError(null); setImportSuccess(null); }}
                className="flex-1 py-3 text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all uppercase tracking-wider"
              >
                Đóng
              </button>
              <button
                type="button"
                disabled={isImporting || parsedItems.filter(x => x.isValid).length === 0}
                onClick={handleCommitImport}
                className={cn(
                  "flex-1 py-3 text-xs font-black text-white rounded-xl shadow-md transition-all uppercase tracking-wider flex items-center justify-center gap-2",
                  isImporting || parsedItems.filter(x => x.isValid).length === 0
                    ? "bg-slate-300 cursor-not-allowed shadow-none"
                    : "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                )}
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                    Đang lưu trữ...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Lưu Kho ({parsedItems.filter(x => x.isValid).length} Dòng Hợp Lệ)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
