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
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { seedWarehouseData } from './seedData';
import { 
  WarehouseTab, 
  Equipment, 
  WarehouseSupplier, 
  MaterialRequest, 
  PurchaseProposal, 
  InventoryTransaction 
} from './types';

// Sub-views
import WarehouseDashboard from './WarehouseDashboard';
import InventoryStock from './InventoryStock';
import MaterialRequests from './MaterialRequests';
import PurchaseProposals from './PurchaseProposals';
import ImportReceipts from './ImportReceipts';
import ExportReceipts from './ExportReceipts';
import WarehouseReports from './WarehouseReports';
import DocumentDetailTab from './DocumentDetailTab';

interface WarehouseManagerProps {
  userRole: string;
  userId: string;
  activeTabId?: string;
  setActiveTabId?: (id: string) => void;
  tabs?: WarehouseTab[];
  setTabs?: React.Dispatch<React.SetStateAction<WarehouseTab[]>>;
}

export default function WarehouseManager({ 
  userRole, 
  userId,
  activeTabId: externalActiveTabId,
  setActiveTabId: externalSetActiveTabId,
  tabs: externalTabs,
  setTabs: externalSetTabs
}: WarehouseManagerProps) {
  
  // Real-time Firestore states
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [suppliers, setSuppliers] = useState<WarehouseSupplier[]>([]);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [purchaseProposals, setPurchaseProposals] = useState<PurchaseProposal[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Default standard tabs
  const defaultTabs: WarehouseTab[] = [
    { id: 'dashboard', label: 'DASHBOARD', icon: '🏡', closable: false },
    { id: 'kho', label: 'KHO', icon: '📦', closable: false },
    { id: 'dexuat', label: 'ĐỀ XUẤT', icon: '📝', closable: false },
    { id: 'muahang', label: 'MUA HÀNG', icon: '🛒', closable: false },
    { id: 'nhapkho', label: 'NHẬP KHO', icon: '🚚', closable: false },
    { id: 'xuatkho', label: 'XUẤT KHO', icon: '📤', closable: false },
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
        // Trigger seeding if database collections are empty
        await seedWarehouseData(db);
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

      return () => {
        unsubEquip();
        unsubSup();
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
  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering tab switch on close icon click
    const filteredTabs = tabs.filter(t => t.id !== tabId);
    setTabs(filteredTabs);

    // If closing active tab, redirect to dashboard or nearest tab
    if (activeTabId === tabId) {
      const closedIndex = tabs.findIndex(t => t.id === tabId);
      const nextActiveIndex = Math.max(0, closedIndex - 1);
      setActiveTabId(filteredTabs[nextActiveIndex]?.id || 'dashboard');
    }
  };

  // Render correct content
  const renderTabContent = () => {
    // If it is a dynamic document tab (not matches standard)
    const activeTabObj = tabs.find(t => t.id === activeTabId);
    if (activeTabObj && activeTabObj.closable && activeTabObj.documentType) {
      return (
        <DocumentDetailTab 
          documentId={activeTabObj.id}
          documentType={activeTabObj.documentType}
          equipment={equipment}
          transactions={transactions}
          requests={materialRequests}
          proposals={purchaseProposals}
        />
      );
    }

    switch (activeTabId) {
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
          />
        );
      case 'dexuat':
        return (
          <MaterialRequests 
            requests={materialRequests}
            equipment={equipment}
            userRole={userRole}
            onOpenDocument={handleOpenDocument}
          />
        );
      case 'muahang':
        return (
          <PurchaseProposals 
            proposals={purchaseProposals}
            equipment={equipment}
            suppliers={suppliers}
            userRole={userRole}
            onOpenDocument={handleOpenDocument}
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
          />
        );
      case 'xuatkho':
        return (
          <ExportReceipts 
            transactions={transactions}
            equipment={equipment}
            onOpenDocument={handleOpenDocument}
            userId={userId}
          />
        );
      case 'baocao':
        return (
          <WarehouseReports 
            equipment={equipment}
            transactions={transactions}
            suppliers={suppliers}
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
    <div id="warehouse-management-module" className="flex flex-col w-full lg:-mt-10 lg:-mx-10">
      
      {/* Dynamic Tab Horizontal Navigation Rail - Mobile & Tablet Only */}
      <div className="lg:hidden w-full bg-white border-b border-slate-200 sticky top-0 z-20 px-4 flex items-end overflow-x-auto scrollbar-none gap-1.5 pt-3 shadow-xs">
        <div className="w-full flex items-end gap-1.5">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const tabIcon = tab.icon || (
              tab.id === 'dashboard' ? '🏡' :
              tab.id === 'kho' ? '📦' :
              tab.id === 'dexuat' ? '📝' :
              tab.id === 'muahang' ? '🛒' :
              tab.id === 'nhapkho' ? '🚚' :
              tab.id === 'xuatkho' ? '📤' :
              tab.id === 'baocao' ? '📊' : '📄'
            );
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border-t-2 border-x transition-all shrink-0 cursor-pointer ${
                  isActive 
                    ? 'bg-white border-blue-600 border-x-slate-200 text-blue-600 rounded-t-lg z-10 -mb-px' 
                    : 'bg-slate-50/40 border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-50/80 rounded-t-md'
                }`}
              >
                <span>{tabIcon}</span>
                <span>{tab.label}</span>
                {tab.closable && (
                  <X 
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="h-3.5 w-3.5 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 transition-all shrink-0 p-0.5 ml-0.5" 
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab View Renderer */}
      <div className="w-full max-w-7xl mx-auto px-4 lg:px-10 pt-6 pb-12">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center text-slate-400 gap-4">
            <RefreshCw className="h-10 w-10 text-blue-600 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Đang nạp dữ liệu kho...</span>
          </div>
        ) : (
          renderTabContent()
        )}
      </div>

    </div>
  );
}
