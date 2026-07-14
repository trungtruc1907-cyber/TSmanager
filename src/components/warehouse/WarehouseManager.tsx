import React, { useState, useEffect } from 'react';
import { 
  X, 
  Home, 
  Package, 
  FileText, 
  ShoppingCart, 
  ArrowUpRight, 
  ArrowDownLeft, 
  BarChart2, 
  Database,
  RefreshCw
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { seedWarehouseData } from './seedData';
import { 
  WarehouseTab, 
  Equipment, 
  WarehouseSupplier, 
  MaterialRequest, 
  PurchaseProposal, 
  InventoryTransaction 
} from './types';
import { Customer } from '../../types';

// Sub-views
import WarehouseDashboard from './WarehouseDashboard';
import InventoryStock from './InventoryStock';
import ImportReceipts from './ImportReceipts';
import ExportReceipts from './ExportReceipts';
import WarehouseCustomers from './WarehouseCustomers';
import WarehouseSuppliers from './WarehouseSuppliers';
import WarehouseReports from './WarehouseReports';
import DocumentDetailTab from './DocumentDetailTab';

interface WarehouseManagerProps {
  userRole: string;
  userId: string;
  activeTabId?: string;
  setActiveTabId?: (id: string) => void;
  tabs?: WarehouseTab[];
  setTabs?: React.Dispatch<React.SetStateAction<WarehouseTab[]>>;
  onOpenProject?: (id: string) => void;
  onCloseFormTab?: (tabId: string, skipConfirm?: boolean) => void;
}

export default function WarehouseManager({ 
  userRole, 
  userId,
  activeTabId: externalActiveTabId,
  setActiveTabId: externalSetActiveTabId,
  tabs: externalTabs,
  setTabs: externalSetTabs,
  onOpenProject,
  onCloseFormTab
}: WarehouseManagerProps) {
  
  // Real-time Firestore states
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [suppliers, setSuppliers] = useState<WarehouseSupplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [purchaseProposals, setPurchaseProposals] = useState<PurchaseProposal[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Default standard tabs
  const defaultTabs: WarehouseTab[] = [
    { id: 'dashboard', label: 'DASHBOARD', icon: '🏡', closable: false },
    { id: 'kho', label: 'KHO', icon: '📦', closable: false },
    { id: 'nhapkho', label: 'NHẬP HÀNG', icon: '🚚', closable: false },
    { id: 'xuatkho', label: 'XUẤT KHO', icon: '📤', closable: false },
    { id: 'khachhang', label: 'KHÁCH HÀNG', icon: '👥', closable: false },
    { id: 'nhacungcap', label: 'NHÀ CUNG CẤP', icon: '🏢', closable: false },
    { id: 'baocao', label: 'BÁO CÁO', icon: '📊', closable: false },
  ];

  const [localTabs, setLocalTabs] = useState<WarehouseTab[]>(defaultTabs);
  const [localActiveTabId, setLocalActiveTabId] = useState<string>('dashboard');

  const tabs = externalTabs !== undefined ? externalTabs : localTabs;
  const setTabs = externalSetTabs !== undefined ? externalSetTabs : setLocalTabs;
  const activeTabId = externalActiveTabId !== undefined ? externalActiveTabId : localActiveTabId;
  const setActiveTabId = externalSetActiveTabId !== undefined ? externalSetActiveTabId : setLocalActiveTabId;

  // Trigger seeding & Realtime listening
  useEffect(() => {
    const initAndSubscribe = async () => {
      try {
        // Check if warehouse data has been explicitly cleared
        const settingsSnap = await getDoc(doc(db, 'settings', 'warehouse'));
        const warehouseSettings = settingsSnap.exists() ? settingsSnap.data() : null;
        
        if (!warehouseSettings?.cleared) {
          // Trigger seeding if database collections are empty
          await seedWarehouseData(db);
        }
      } catch (err) {
        console.error('Error seeding initial data:', err);
      }

      // Set up real-time listener subscriptions
      const unsubEquip = onSnapshot(collection(db, 'equipment'), 
        (snap) => {
          setEquipment(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Equipment)));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'equipment')
      );

      const unsubSup = onSnapshot(collection(db, 'suppliers'), 
        (snap) => {
          setSuppliers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WarehouseSupplier)));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'suppliers')
      );

      const unsubReq = onSnapshot(collection(db, 'material_requests'), 
        (snap) => {
          setMaterialRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaterialRequest)));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'material_requests')
      );

      const unsubProp = onSnapshot(collection(db, 'purchase_proposals'), 
        (snap) => {
          setPurchaseProposals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseProposal)));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'purchase_proposals')
      );

      const unsubTx = onSnapshot(collection(db, 'inventory_transactions'), 
        (snap) => {
          setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryTransaction)));
          setLoading(false);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'inventory_transactions')
      );

      const unsubCust = onSnapshot(collection(db, 'customers'), 
        (snap) => {
          setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
      );

      const unsubProj = onSnapshot(collection(db, 'projects'), 
        (snap) => {
          setProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
      );

      return () => {
        unsubEquip();
        unsubSup();
        unsubCust();
        unsubProj();
        unsubReq();
        unsubProp();
        unsubTx();
      };
    };

    const unsubAll = initAndSubscribe();
    return () => {
      unsubAll.then(unsub => unsub?.());
    };
  }, []);

  // Handler to open document inside dynamic tab
  const handleOpenDocument = (docId: string, docType: 'pn' | 'px' | 'dexuat' | 'muahang', label: string) => {
    // Check if tab already exists
    const tabExists = tabs.some(t => t.id === docId);
    if (!tabExists) {
      const newTab: WarehouseTab = {
        id: docId,
        label: `📄 ${label}`,
        closable: true,
        documentType: docType
      };
      setTabs([...tabs, newTab]);
    }
    setActiveTabId(docId);
  };

  // Handler to close dynamic tab
  const handleCloseFormTab = (tabId: string, skipConfirm = false) => {
    if (onCloseFormTab) {
      onCloseFormTab(tabId, skipConfirm);
    } else {
      const filteredTabs = tabs.filter(t => t.id !== tabId);
      setTabs(filteredTabs);
      if (activeTabId === tabId) {
        const closedIndex = tabs.findIndex(t => t.id === tabId);
        const nextActiveIndex = Math.max(0, closedIndex - 1);
        setActiveTabId(filteredTabs[nextActiveIndex]?.id || 'dashboard');
      }
    }
  };

  // Render correct content for a specific tab
  const renderSpecificTabContent = (tabObj: WarehouseTab) => {
    // 1. Dynamic document detail tabs
    if (tabObj.closable && tabObj.documentType) {
      return (
        <DocumentDetailTab 
          documentId={tabObj.id}
          documentType={tabObj.documentType}
          equipment={equipment}
          transactions={transactions}
          requests={materialRequests}
          proposals={purchaseProposals}
          suppliers={suppliers}
          onOpenProject={onOpenProject}
          onClose={() => {
            const catTabId = tabObj.documentType === 'pn' ? 'nhapkho' :
                             tabObj.documentType === 'px' ? 'xuatkho' : 'dashboard';
            
            const filteredTabs = tabs.filter(t => t.id !== tabObj.id);
            setTabs(filteredTabs);
            setActiveTabId(catTabId);
          }}
        />
      );
    }

    // 2. Dynamic form tabs (Nhập kho forms)
    if (tabObj.id === 'form_import_goods' || tabObj.id === 'form_supplier_return' || tabObj.id === 'form_tech_return' || tabObj.id === 'form_initial_stock') {
      const sourceMap: Record<string, 'import_goods' | 'supplier_return' | 'tech_return' | 'initial_stock'> = {
        'form_import_goods': 'import_goods',
        'form_supplier_return': 'supplier_return',
        'form_tech_return': 'tech_return',
        'form_initial_stock': 'initial_stock'
      };
      const activeSourceVal = sourceMap[tabObj.id];

      return (
        <ImportReceipts 
          transactions={transactions}
          equipment={equipment}
          suppliers={suppliers}
          onOpenDocument={handleOpenDocument}
          userId={userId}
          purchaseProposals={purchaseProposals}
          activeSourceExternal={activeSourceVal}
          onCloseForm={(skipConfirm?: boolean) => {
            handleCloseFormTab(tabObj.id, skipConfirm);
          }}
        />
      );
    }

    // 3. Dynamic form tabs (Xuất kho forms)
    if (tabObj.id === 'form_construction_export' || tabObj.id === 'form_commercial_export' || tabObj.id === 'form_disposal_export') {
      const sourceMap: Record<string, 'construction_export' | 'commercial_export' | 'disposal_export'> = {
        'form_construction_export': 'construction_export',
        'form_commercial_export': 'commercial_export',
        'form_disposal_export': 'disposal_export'
      };
      const activeSourceVal = sourceMap[tabObj.id];

      return (
        <ExportReceipts 
          transactions={transactions}
          equipment={equipment}
          onOpenDocument={handleOpenDocument}
          userId={userId}
          activeSourceExternal={activeSourceVal}
          onCloseForm={(skipConfirm?: boolean) => {
            handleCloseFormTab(tabObj.id, skipConfirm);
          }}
        />
      );
    }

    // 4. Standard static tabs
    switch (tabObj.id) {
      case 'dashboard':
        return (
          <WarehouseDashboard 
            equipment={equipment}
            transactions={transactions}
            requests={materialRequests}
            proposals={purchaseProposals}
            suppliers={suppliers}
            onOpenDocument={handleOpenDocument}
            onNavigateTab={(tabId) => setActiveTabId(tabId)}
          />
        );
      case 'kho':
        return (
          <InventoryStock 
            equipment={equipment}
            transactions={transactions}
            userRole={userRole}
            suppliers={suppliers}
          />
        );
      case 'nhapkho':
        return (
          <ImportReceipts 
            transactions={transactions}
            equipment={equipment}
            suppliers={suppliers}
            onOpenDocument={handleOpenDocument}
            userId={userId}
            purchaseProposals={purchaseProposals}
            onOpenFormTab={(sourceType) => {
              const tabId = `form_${sourceType}`;
              const labelMap: Record<string, string> = {
                'import_goods': '🚚 Nhập hàng',
                'supplier_return': '↩️ Trả hàng NCC',
                'tech_return': '🛠️ Kỹ thuật trả vật tư',
                'initial_stock': '📦 Nhập tồn đầu kỳ'
              };
              const iconMap: Record<string, string> = {
                'import_goods': '🚚',
                'supplier_return': '↩️',
                'tech_return': '🛠️',
                'initial_stock': '📦'
              };
              const tabExists = tabs.some(t => t.id === tabId);
              if (!tabExists) {
                const newTab: WarehouseTab = {
                  id: tabId,
                  label: labelMap[sourceType],
                  icon: iconMap[sourceType],
                  closable: true
                };
                setTabs([...tabs, newTab]);
              }
              setActiveTabId(tabId);
            }}
          />
        );
      case 'xuatkho':
        return (
          <ExportReceipts 
            transactions={transactions}
            equipment={equipment}
            onOpenDocument={handleOpenDocument}
            userId={userId}
            onOpenFormTab={(sourceType) => {
              const tabId = `form_${sourceType}`;
              const labelMap: Record<string, string> = {
                'construction_export': '🏗️ Xuất kho thi công',
                'commercial_export': '🛍️ Xuất kho thương mại',
                'disposal_export': '🗑️ Xuất hủy/Thanh lý'
              };
              const iconMap: Record<string, string> = {
                'construction_export': '🏗️',
                'commercial_export': '🛍️',
                'disposal_export': '🗑️'
              };
              const tabExists = tabs.some(t => t.id === tabId);
              if (!tabExists) {
                const newTab: WarehouseTab = {
                  id: tabId,
                  label: labelMap[sourceType],
                  icon: iconMap[sourceType],
                  closable: true
                };
                setTabs([...tabs, newTab]);
              }
              setActiveTabId(tabId);
            }}
          />
        );
      case 'khachhang':
        return (
          <WarehouseCustomers 
            customers={customers}
            transactions={transactions}
            userRole={userRole}
          />
        );
      case 'nhacungcap':
        return (
          <WarehouseSuppliers 
            suppliers={suppliers}
            userRole={userRole}
          />
        );
      case 'baocao':
        return (
          <WarehouseReports 
            equipment={equipment}
            transactions={transactions}
            suppliers={suppliers}
            customers={customers}
            projects={projects}
          />
        );
      default:
        return (
          <div className="bg-white rounded-2xl p-12 text-center text-slate-400 font-bold">
            Không tìm thấy tab chức năng yêu cầu.
          </div>
        );
    }
  };

  return (
    <div id="warehouse-management-module" className="flex flex-col w-full">
      
      {/* Main Tab View Renderer */}
      <div className="w-full max-w-7xl mx-auto py-6">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center text-slate-400 gap-4">
            <RefreshCw className="h-10 w-10 text-blue-600 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Đang nạp dữ liệu kho...</span>
          </div>
        ) : (
          <div className="relative w-full">
            {tabs.map((tab) => {
              const isActive = tab.id === activeTabId;
              return (
                <div key={tab.id} className={isActive ? "block animate-in fade-in duration-200" : "hidden"}>
                  {renderSpecificTabContent(tab)}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
