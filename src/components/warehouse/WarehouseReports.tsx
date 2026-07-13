import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Package, 
  Building,
  AlertCircle,
  Calendar,
  User,
  Search,
  Filter,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Activity,
  Briefcase,
  FileSpreadsheet,
  RefreshCw,
  Eye
} from 'lucide-react';
import { Equipment, InventoryTransaction, WarehouseSupplier } from './types';
import { Customer } from '../../types';

interface WarehouseReportsProps {
  equipment: Equipment[];
  transactions: InventoryTransaction[];
  suppliers: WarehouseSupplier[];
  customers: any[];
  projects?: any[];
}

type ReportTab = 'overview' | 'construction' | 'commercial' | 'suppliers' | 'inventory' | 'sales';

export default function WarehouseReports({ 
  equipment, 
  transactions, 
  suppliers, 
  customers, 
  projects = [] 
}: WarehouseReportsProps) {
  
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');

  // --- Search & Filter States ---
  const [searchConst, setSearchConst] = useState('');
  const [constStatusFilter, setConstStatusFilter] = useState('all');

  const [searchComm, setSearchComm] = useState('');
  const [commDebtFilter, setCommDebtFilter] = useState('all');

  const [searchSupplier, setSearchSupplier] = useState('');
  const [supDebtFilter, setSupDebtFilter] = useState('all');

  const [searchInventory, setSearchInventory] = useState('');
  const [invTypeFilter, setInvTypeFilter] = useState('all');
  const [invStockFilter, setInvStockFilter] = useState('all');

  const [salesPeriod, setSalesPeriod] = useState<'7days' | '30days' | 'month' | 'prevmonth' | 'all'>('30days');
  const [salesStartDate, setSalesStartDate] = useState('');
  const [salesEndDate, setSalesEndDate] = useState('');

  // --- Row Expansion States ---
  const [expandedConstId, setExpandedConstId] = useState<string | null>(null);
  const [expandedCommId, setExpandedCommId] = useState<string | null>(null);
  const [expandedSupId, setExpandedSupId] = useState<string | null>(null);

  // Helper: Format Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Helper: Format Date
  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Translate project status
  const translateProjectStatus = (status: string) => {
    switch (status) {
      case 'lead': return 'Khai thác';
      case 'survey': return 'Khảo sát';
      case 'proposal': return 'Báo giá';
      case 'contract': return 'Hợp đồng';
      case 'installation': return 'Thi công';
      case 'completed': return 'Hoàn thành';
      default: return status;
    }
  };

  // Translate equipment type
  const translateEquipmentType = (type: string) => {
    switch (type) {
      case 'panel': return 'Tấm pin Solar';
      case 'inverter': return 'Biến tần (Inverter)';
      case 'battery': return 'Pin lưu trữ';
      case 'mounting': return 'Khung giá nhôm';
      case 'accessory': return 'Phụ kiện điện';
      default: return 'Khác';
    }
  };

  // ==========================================
  // DATA COMPUTATIONS - OVERVIEW
  // ==========================================
  const totalValuation = useMemo(() => {
    return equipment.reduce((sum, item) => sum + ((item.stock || 0) * (item.unitPrice || 0)), 0);
  }, [equipment]);

  const categoryBreakdown = useMemo(() => {
    return equipment.reduce((acc: any, item) => {
      const type = item.type || 'other';
      const val = (item.stock || 0) * (item.unitPrice || 0);
      acc[type] = (acc[type] || 0) + val;
      return acc;
    }, {});
  }, [equipment]);

  const pieData = useMemo(() => {
    return [
      { name: 'Tấm pin Solar', value: categoryBreakdown['panel'] || 0, color: '#3b82f6' },
      { name: 'Inverter Biến tần', value: categoryBreakdown['inverter'] || 0, color: '#f59e0b' },
      { name: 'Pin lưu trữ (Battery)', value: categoryBreakdown['battery'] || 0, color: '#10b981' },
      { name: 'Khung nhôm/Phụ kiện', value: (categoryBreakdown['mounting'] || 0) + (categoryBreakdown['accessory'] || 0) + (categoryBreakdown['other'] || 0), color: '#64748b' }
    ].filter(p => p.value > 0);
  }, [categoryBreakdown]);

  // Monthly Import vs Export Value (last 6 months)
  const barChartData = useMemo(() => {
    const monthlyDataMap: { [month: string]: { import: number; export: number } } = {};
    const monthsList = ['02/2026', '03/2026', '04/2026', '05/2026', '06/2026', '07/2026'];
    monthsList.forEach(m => {
      monthlyDataMap[m] = { import: 0, export: 0 };
    });

    transactions.forEach(tx => {
      if (!tx.date) return;
      const [year, month] = tx.date.split('-');
      if (!year || !month) return;
      const formattedMonth = `${month}/${year}`;
      if (monthlyDataMap[formattedMonth]) {
        if (tx.type === 'import') {
          monthlyDataMap[formattedMonth].import += tx.totalValue || 0;
        } else {
          monthlyDataMap[formattedMonth].export += tx.totalValue || 0;
        }
      }
    });

    return Object.keys(monthlyDataMap).map(key => ({
      name: key,
      'Nhập kho': monthlyDataMap[key].import,
      'Xuất kho': monthlyDataMap[key].export
    }));
  }, [transactions]);

  const lowStockCount = useMemo(() => {
    return equipment.filter(e => (e.stock || 0) <= (e.minStock || 5)).length;
  }, [equipment]);

  const totalSupplierDebt = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (s.debt || 0), 0);
  }, [suppliers]);

  const totalCommercialCustomerDebt = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.debt || 0), 0);
  }, [customers]);

  // ==========================================
  // DATA COMPUTATIONS - KHÁCH HÀNG THI CÔNG
  // ==========================================
  const constructionReports = useMemo(() => {
    const q = searchConst.toLowerCase().trim();
    
    // Filter projects matching search & status
    const filtered = projects.filter(p => {
      const matchSearch = !q || 
        (p.customerName || '').toLowerCase().includes(q) ||
        (p.id || '').toLowerCase().includes(q) ||
        (p.address || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q);

      const matchStatus = constStatusFilter === 'all' || p.status === constStatusFilter;

      return matchSearch && matchStatus;
    });

    // Enriched construction records
    const records = filtered.map(p => {
      // Find all export transactions associated with this project id
      const projTx = transactions.filter(t => t.type === 'export' && t.partnerId === p.id);
      const totalExportedValue = projTx.reduce((sum, t) => sum + (t.totalValue || 0), 0);
      
      // Collect aggregate item quantities
      const itemsMap: { [equipId: string]: { name: string; type: string; qty: number; unit: string } } = {};
      projTx.forEach(t => {
        (t.items || []).forEach(item => {
          const key = item.equipmentId;
          const label = `${item.brand} ${item.model}`;
          if (itemsMap[key]) {
            itemsMap[key].qty += item.quantity;
          } else {
            itemsMap[key] = { name: label, type: item.type, qty: item.quantity, unit: item.unit };
          }
        });
      });

      return {
        project: p,
        txCount: projTx.length,
        exportedValue: totalExportedValue,
        itemsList: Object.values(itemsMap),
        allTx: projTx
      };
    });

    // Summary stats
    const totalCap = filtered.reduce((sum, p) => sum + (p.systemSizeKWp || 0), 0);
    const totalVal = records.reduce((sum, r) => sum + r.exportedValue, 0);

    return {
      records,
      summary: {
        totalProjects: filtered.length,
        activeProjects: filtered.filter(p => p.status === 'installation').length,
        completedProjects: filtered.filter(p => p.status === 'completed').length,
        totalCapacityKWp: totalCap,
        totalMaterialExportValue: totalVal
      }
    };
  }, [projects, transactions, searchConst, constStatusFilter]);

  // ==========================================
  // DATA COMPUTATIONS - KHÁCH HÀNG THƯƠNG MẠI
  // ==========================================
  const commercialReports = useMemo(() => {
    const q = searchComm.toLowerCase().trim();

    const filtered = customers.filter(c => {
      const matchSearch = !q ||
        (c.name || '').toLowerCase().includes(q) ||
        (c.id || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q);

      const matchDebt = commDebtFilter === 'all' ||
        (commDebtFilter === 'debt' && (c.debt || 0) > 0) ||
        (commDebtFilter === 'nodebt' && (c.debt || 0) <= 0);

      return matchSearch && matchDebt;
    });

    const records = filtered.map(c => {
      // Find all transactions matching commercial exports
      // In commercial exports, the partnerId will be the customer's id
      const custTx = transactions.filter(t => t.type === 'export' && t.partnerId === c.id);
      const totalPurchased = custTx.reduce((sum, t) => sum + (t.totalValue || 0), 0);
      const totalPaid = custTx.reduce((sum, t) => sum + (t.paidAmount || 0), 0);

      // Collect item list bought
      const itemsMap: { [equipId: string]: { name: string; type: string; qty: number; unit: string } } = {};
      custTx.forEach(t => {
        (t.items || []).forEach(item => {
          const key = item.equipmentId;
          const label = `${item.brand} ${item.model}`;
          if (itemsMap[key]) {
            itemsMap[key].qty += item.quantity;
          } else {
            itemsMap[key] = { name: label, type: item.type, qty: item.quantity, unit: item.unit };
          }
        });
      });

      return {
        customer: c,
        txCount: custTx.length,
        purchasedValue: totalPurchased,
        paidValue: totalPaid,
        outstandingDebt: c.debt || 0,
        itemsBought: Object.values(itemsMap),
        allTx: custTx
      };
    });

    const totalRev = records.reduce((sum, r) => sum + r.purchasedValue, 0);
    const totalDebt = filtered.reduce((sum, c) => sum + (c.debt || 0), 0);

    return {
      records,
      summary: {
        totalCustomers: filtered.length,
        totalSalesRevenue: totalRev,
        totalOutstandingDebt: totalDebt,
        averagePurchase: filtered.length > 0 ? (totalRev / filtered.length) : 0
      }
    };
  }, [customers, transactions, searchComm, commDebtFilter]);

  // ==========================================
  // DATA COMPUTATIONS - NHÀ CUNG CẤP
  // ==========================================
  const supplierReports = useMemo(() => {
    const q = searchSupplier.toLowerCase().trim();

    const filtered = suppliers.filter(s => {
      const matchSearch = !q ||
        (s.name || '').toLowerCase().includes(q) ||
        (s.id || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.contactName || '').toLowerCase().includes(q);

      const matchDebt = supDebtFilter === 'all' ||
        (supDebtFilter === 'debt' && (s.debt || 0) > 0) ||
        (supDebtFilter === 'nodebt' && (s.debt || 0) <= 0);

      return matchSearch && matchDebt;
    });

    const records = filtered.map(s => {
      // Find all imports associated with this supplier
      const supTx = transactions.filter(t => t.type === 'import' && t.partnerId === s.id);
      const totalImported = supTx.reduce((sum, t) => sum + (t.totalValue || 0), 0);
      const totalPaid = supTx.reduce((sum, t) => sum + (t.paidAmount || 0), 0);

      return {
        supplier: s,
        txCount: supTx.length,
        importedValue: totalImported,
        paidValue: totalPaid,
        outstandingDebt: s.debt || 0,
        allTx: supTx
      };
    });

    const totalImpVal = records.reduce((sum, r) => sum + r.importedValue, 0);
    const totalDebt = filtered.reduce((sum, s) => sum + (s.debt || 0), 0);

    return {
      records,
      summary: {
        totalSuppliers: filtered.length,
        totalImportedValue: totalImpVal,
        totalOutstandingDebt: totalDebt
      }
    };
  }, [suppliers, transactions, searchSupplier, supDebtFilter]);

  // ==========================================
  // DATA COMPUTATIONS - BÁO CÁO TỒN KHO
  // ==========================================
  const inventoryReports = useMemo(() => {
    const q = searchInventory.toLowerCase().trim();

    const filtered = equipment.filter(e => {
      const matchSearch = !q ||
        (e.brand || '').toLowerCase().includes(q) ||
        (e.model || '').toLowerCase().includes(q) ||
        (e.id || '').toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q) ||
        (e.details || '').toLowerCase().includes(q);

      const matchType = invTypeFilter === 'all' || e.type === invTypeFilter;

      const stockVal = e.stock || 0;
      const minStockVal = e.minStock || 5;
      let matchStock = true;
      if (invStockFilter === 'low') {
        matchStock = stockVal <= minStockVal && stockVal > 0;
      } else if (invStockFilter === 'out') {
        matchStock = stockVal === 0;
      } else if (invStockFilter === 'instock') {
        matchStock = stockVal > minStockVal;
      }

      return matchSearch && matchType && matchStock;
    });

    const records = filtered.map(e => {
      // Calculate transaction frequency
      let importQty = 0;
      let exportQty = 0;
      let importCount = 0;
      let exportCount = 0;

      transactions.forEach(t => {
        const foundItem = (t.items || []).find(item => item.equipmentId === e.id);
        if (foundItem) {
          if (t.type === 'import') {
            importQty += foundItem.quantity;
            importCount++;
          } else {
            exportQty += foundItem.quantity;
            exportCount++;
          }
        }
      });

      return {
        equipment: e,
        value: (e.stock || 0) * (e.unitPrice || 0),
        importQty,
        exportQty,
        importCount,
        exportCount
      };
    });

    const totalVal = records.reduce((sum, r) => sum + r.value, 0);
    const totalItems = filtered.reduce((sum, r) => sum + (r.stock || 0), 0);
    const alertCount = filtered.filter(e => (e.stock || 0) <= (e.minStock || 5)).length;

    return {
      records,
      summary: {
        totalSkus: filtered.length,
        totalQuantityInStock: totalItems,
        totalValuation: totalVal,
        lowStockSkus: alertCount
      }
    };
  }, [equipment, transactions, searchInventory, invTypeFilter, invStockFilter]);

  // ==========================================
  // DATA COMPUTATIONS - BÁN HÀNG THEO THỜI GIAN
  // ==========================================
  const salesReports = useMemo(() => {
    // 1. Determine Date Boundaries based on Period
    let startLimit: Date | null = null;
    let endLimit: Date | null = null;
    const now = new Date();

    if (salesPeriod === '7days') {
      startLimit = new Date();
      startLimit.setDate(now.getDate() - 7);
    } else if (salesPeriod === '30days') {
      startLimit = new Date();
      startLimit.setDate(now.getDate() - 30);
    } else if (salesPeriod === 'month') {
      startLimit = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (salesPeriod === 'prevmonth') {
      startLimit = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      endLimit = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
    }

    // Override if custom date picker is specified
    if (salesStartDate) {
      startLimit = new Date(salesStartDate);
    }
    if (salesEndDate) {
      endLimit = new Date(salesEndDate);
      endLimit.setHours(23, 59, 59, 999);
    }

    // 2. Filter Export Transactions in range
    const exportTx = transactions.filter(t => {
      if (t.type !== 'export') return false;
      if (!t.date) return false;
      const txDate = new Date(t.date);
      if (startLimit && txDate < startLimit) return false;
      if (endLimit && txDate > endLimit) return false;
      return true;
    });

    // 3. Compute stats
    let totalSalesVal = 0;
    let commercialSalesVal = 0;
    let constructionSalesVal = 0;
    let disposalSalesVal = 0;

    const itemSalesMap: { [equipId: string]: { name: string; brand: string; model: string; type: string; qty: number; value: number } } = {};
    const dailyTrendMap: { [day: string]: number } = {};

    exportTx.forEach(t => {
      totalSalesVal += t.totalValue || 0;
      
      // Determine export sub-type based on partner code / id / format
      // PN... PX... PX-DISP / PX-COMM / PX-CONS
      const isCons = t.id.includes('PX-CONS') || projects.some(p => p.id === t.partnerId);
      const isDisp = t.id.includes('PX-DISP') || t.id.includes('HUY');
      
      if (isDisp) {
        disposalSalesVal += t.totalValue || 0;
      } else if (isCons) {
        constructionSalesVal += t.totalValue || 0;
      } else {
        commercialSalesVal += t.totalValue || 0;
      }

      // Aggregate items sold
      (t.items || []).forEach(item => {
        const key = item.equipmentId;
        const subVal = item.quantity * item.unitPrice;
        if (itemSalesMap[key]) {
          itemSalesMap[key].qty += item.quantity;
          itemSalesMap[key].value += subVal;
        } else {
          itemSalesMap[key] = {
            name: `${item.brand} ${item.model}`,
            brand: item.brand,
            model: item.model,
            type: item.type,
            qty: item.quantity,
            value: subVal
          };
        }
      });

      // Daily Trend
      const dKey = t.date; // YYYY-MM-DD
      dailyTrendMap[dKey] = (dailyTrendMap[dKey] || 0) + t.totalValue;
    });

    // Format daily trend data for chart
    const trendList = Object.keys(dailyTrendMap).sort().map(date => {
      // Format to short date dd/mm
      const [, m, d] = date.split('-');
      return {
        rawDate: date,
        dateLabel: `${d}/${m}`,
        'Doanh thu': dailyTrendMap[date]
      };
    });

    // Best Sellers List sorted by quantity
    const bestSellers = Object.values(itemSalesMap).sort((a, b) => b.qty - a.qty);

    return {
      transactions: exportTx,
      trend: trendList,
      bestSellers,
      summary: {
        totalOutflowValue: totalSalesVal,
        totalTransactions: exportTx.length,
        commercialRevenue: commercialSalesVal,
        constructionMaterialValue: constructionSalesVal,
        disposedValue: disposalSalesVal
      }
    };
  }, [transactions, salesPeriod, salesStartDate, salesEndDate, projects]);


  return (
    <div id="warehouse-reports-panel" className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xs font-sans">
        <div className="space-y-1">
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Layers className="h-5.5 w-5.5 text-blue-600" />
            Báo Cáo Chi Tiết Hoạt Động Kho
          </h2>
          <p className="text-[11px] text-slate-400 font-bold block">
            Giám sát công nợ, xuất hàng thi công, bán lẻ thương mại và quản lý định mức tồn kho thông minh
          </p>
        </div>
        
        {/* REPORT SUB-TABS */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
          {(['overview', 'construction', 'commercial', 'suppliers', 'inventory', 'sales'] as ReportTab[]).map(tabKey => {
            const labelMap: { [key: string]: string } = {
              overview: 'Tổng quan',
              construction: 'KH Thi Công',
              commercial: 'KH Thương mại',
              suppliers: 'Nhà cung cấp',
              inventory: 'Báo cáo Tồn kho',
              sales: 'Báo cáo Bán hàng'
            };
            const active = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                type="button"
                onClick={() => setActiveTab(tabKey)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  active 
                    ? 'bg-blue-600 text-white shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {labelMap[tabKey]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. REPORT VIEW: OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div id="report-view-overview" className="space-y-6">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
            <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <DollarSign className="h-5.5 w-5.5 text-blue-600" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Tổng giá trị tồn kho</span>
                <span className="text-sm font-black text-slate-900 mt-1 block">{formatCurrency(totalValuation)}</span>
                <span className="text-[8px] font-bold text-slate-400 block mt-0.5">Dựa trên giá vốn nhập kho</span>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5.5 w-5.5 text-amber-600" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Dòng hàng cần bổ sung</span>
                <span className="text-sm font-black text-amber-600 mt-1 block">{lowStockCount} SKU</span>
                <span className="text-[8px] font-bold text-slate-400 block mt-0.5">Số lượng dưới định mức an toàn</span>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5.5 w-5.5 text-rose-600" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Phải trả nhà cung cấp</span>
                <span className="text-sm font-black text-rose-600 mt-1 block">{formatCurrency(totalSupplierDebt)}</span>
                <span className="text-[8px] font-bold text-slate-400 block mt-0.5">Tổng nợ đọng NCC</span>
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-xs flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                <User className="h-5.5 w-5.5 text-emerald-600" />
              </div>
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Khách hàng thương mại nợ</span>
                <span className="text-sm font-black text-emerald-700 mt-1 block">{formatCurrency(totalCommercialCustomerDebt)}</span>
                <span className="text-[8px] font-bold text-slate-400 block mt-0.5">Tổng nợ từ khách hàng bán lẻ</span>
              </div>
            </div>
          </div>

          {/* Interactive Recharts Balance & Structure Graphs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
            {/* Chart: Import vs Export */}
            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xs lg:col-span-2 flex flex-col gap-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  Cân đối tài chính nhập xuất kho (6 tháng qua)
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  Biểu đồ giá trị vật tư nhập kho bổ sung gối đầu so với giá trị xuất kho thi công & thương mại hàng tháng
                </p>
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} tickFormatter={(val) => `${(val / 1000000).toFixed(0)}Tr`} />
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(value)} 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', fontWeight: 'bold', fontSize: '10px' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'black', textTransform: 'uppercase' }} />
                    <Bar dataKey="Nhập kho" fill="#0054a6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Xuất kho" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart: Structure */}
            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xs flex flex-col justify-between gap-4">
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-blue-600" />
                  Cơ cấu giá trị kho vật tư
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  Tỷ lệ cấu thành giá trị kho chia theo nhóm sản phẩm cốt lõi
                </p>
              </div>

              <div className="h-48 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center label */}
                <div className="absolute text-center">
                  <span className="text-[8px] font-black uppercase text-slate-400 block leading-none">Tổng giá trị</span>
                  <span className="text-xs font-black text-slate-800 mt-1 block">{(totalValuation / 1000000).toFixed(1)}Tr</span>
                </div>
              </div>

              {/* Pie legend */}
              <div className="grid grid-cols-2 gap-2 text-[9px] font-black uppercase tracking-wider pt-2 border-t border-slate-100">
                {pieData.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-slate-500 truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Critical Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-sans">
            {/* Top Critical Low Stock */}
            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-rose-600 flex items-center gap-1.5">
                  <AlertCircle className="h-4.5 w-4.5" />
                  Cảnh báo thiết bị sắp hết hoặc đã hết hàng
                </h4>
                <span className="text-[9px] font-black bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full uppercase">
                  {lowStockCount} SKU
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-2.5">Thiết bị</th>
                      <th className="py-2.5 text-center">Phân loại</th>
                      <th className="py-2.5 text-right">Tồn hiện tại</th>
                      <th className="py-2.5 text-right">Định mức an toàn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                    {equipment
                      .filter(e => (e.stock || 0) <= (e.minStock || 5))
                      .slice(0, 5)
                      .map(e => (
                        <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2 font-bold text-slate-900">
                            {e.brand} {e.model}
                            <span className="block font-mono text-[8px] text-slate-400 uppercase tracking-widest font-normal">Mã: #{e.id}</span>
                          </td>
                          <td className="py-2 text-center font-bold text-[10px] text-slate-500">{translateEquipmentType(e.type)}</td>
                          <td className="py-2 text-right font-black text-rose-600">{e.stock || 0} {e.unit || 'Cái'}</td>
                          <td className="py-2 text-right font-bold text-slate-400">{e.minStock || 5} {e.unit || 'Cái'}</td>
                        </tr>
                      ))}
                    {lowStockCount === 0 && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 italic">Mọi mặt hàng đều đạt mức dự trữ an toàn.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Outstanding Supplier Debts */}
            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-900 flex items-center gap-1.5">
                  <Building className="h-4.5 w-4.5 text-blue-600" />
                  Đối tác có số dư nợ lớn nhất
                </h4>
                <span className="text-[9px] font-black bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full uppercase">
                  Nợ gối đầu
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-400">
                      <th className="py-2.5">Nhà cung cấp</th>
                      <th className="py-2.5">Điện thoại</th>
                      <th className="py-2.5 text-right">Dư nợ hiện tại</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs text-slate-700">
                    {suppliers
                      .filter(s => s.debt > 0)
                      .sort((a, b) => b.debt - a.debt)
                      .slice(0, 5)
                      .map(s => (
                        <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2 font-bold text-slate-900">
                            {s.name}
                            <span className="block font-mono text-[8px] text-slate-400 uppercase tracking-widest font-normal">Mã: #{s.id}</span>
                          </td>
                          <td className="py-2 font-bold text-slate-500">{s.phone}</td>
                          <td className="py-2 text-right font-black text-rose-600">{formatCurrency(s.debt)}</td>
                        </tr>
                      ))}
                    {suppliers.filter(s => s.debt > 0).length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-6 text-center text-slate-400 italic">Hiện không nợ đọng bất kỳ đối tác cung ứng nào.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. REPORT VIEW: KHÁCH HÀNG THI CÔNG (CONSTRUCTION REPORT) */}
      {/* ========================================================================= */}
      {activeTab === 'construction' && (
        <div id="report-view-construction" className="space-y-6 font-sans">
          
          {/* Metrics Summary Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tổng số dự án</span>
              <span className="text-base font-black text-slate-900 block mt-1">{constructionReports.summary.totalProjects} Công trình</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Đang thi công</span>
              <span className="text-base font-black text-amber-500 block mt-1">{constructionReports.summary.activeProjects} Công trình</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Đã hoàn thành</span>
              <span className="text-base font-black text-emerald-600 block mt-1">{constructionReports.summary.completedProjects} Công trình</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs col-span-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tổng công suất lắp đặt</span>
              <span className="text-base font-black text-blue-600 block mt-1">{constructionReports.summary.totalCapacityKWp.toFixed(1)} kWp</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs col-span-2 lg:col-span-1">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tổng giá trị xuất vật tư</span>
              <span className="text-base font-black text-indigo-700 block mt-1">{formatCurrency(constructionReports.summary.totalMaterialExportValue)}</span>
            </div>
          </div>

          {/* Search, Filter Tools */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 inset-y-0 my-auto h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm nhanh tên công trình, SĐT, mã dự án..."
                value={searchConst}
                onChange={(e) => setSearchConst(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={constStatusFilter}
                onChange={(e) => setConstStatusFilter(e.target.value)}
                className="w-full sm:w-44 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="installation">Đang thi công</option>
                <option value="completed">Đã hoàn thành</option>
                <option value="contract">Hợp đồng</option>
                <option value="proposal">Báo giá</option>
              </select>
            </div>
          </div>

          {/* Detailed Data List */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                <Briefcase className="h-4.5 w-4.5 text-blue-600" />
                Danh sách vật tư xuất kho theo công trình
              </h3>
              <span className="text-[10px] font-bold text-slate-400 italic">Bấm vào hàng để xem chi tiết danh sách vật tư đã cấp</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Công trình / Chủ đầu tư</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                    <th className="py-3 px-4 text-center">Công suất</th>
                    <th className="py-3 px-4">Số điện thoại</th>
                    <th className="py-3 px-4 text-right">Tổng giá trị vật tư xuất</th>
                    <th className="py-3 px-4 text-center">Phiếu xuất</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {constructionReports.records.map(({ project, txCount, exportedValue, itemsList, allTx }) => {
                    const isOpen = expandedConstId === project.id;
                    return (
                      <React.Fragment key={project.id}>
                        <tr 
                          onClick={() => setExpandedConstId(isOpen ? null : project.id)}
                          className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        >
                          <td className="py-4 px-4 font-black text-slate-900">
                            {project.customerName || 'KH Solar'}
                            <span className="block font-mono text-[9px] text-slate-400 uppercase tracking-widest font-normal mt-0.5">Mã DA: #{project.id} | Đ/c: {project.address || 'Chưa cập nhật'}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                              project.status === 'completed' 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : project.status === 'installation'
                                ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {translateProjectStatus(project.status)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center font-bold text-slate-800">{project.systemSizeKWp || 5} kWp</td>
                          <td className="py-4 px-4 font-bold text-slate-500">{project.phone || 'Chưa cập nhật'}</td>
                          <td className="py-4 px-4 text-right font-black text-blue-900">{formatCurrency(exportedValue)}</td>
                          <td className="py-4 px-4 text-center font-bold text-slate-400">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">{txCount} phiếu</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                          </td>
                        </tr>

                        {/* Expandable row with detailed items list */}
                        {isOpen && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="p-6">
                              <div className="space-y-4">
                                <div className="border-l-4 border-blue-500 pl-3">
                                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Bảng kê chi tiết xuất kho thi công</h4>
                                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">Báo cáo kiểm kê các dòng pin, biến tần và phụ kiện cấu thành công trình</p>
                                </div>

                                {itemsList.length === 0 ? (
                                  <div className="text-center py-4 text-slate-400 italic bg-white rounded-xl border border-slate-100">
                                    Chưa có giao dịch xuất kho thực tế cho công trình này.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Sub-table: Items Aggregate */}
                                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-2">Tổng hợp vật tư đã cấp</span>
                                      <div className="space-y-2">
                                        {itemsList.map((item, idx) => (
                                          <div key={idx} className="flex justify-between items-center text-xs">
                                            <div>
                                              <span className="font-bold text-slate-800">{item.name}</span>
                                              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">{translateEquipmentType(item.type)}</span>
                                            </div>
                                            <span className="font-black text-slate-900">{item.qty} {item.unit}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Sub-table: Transactions List */}
                                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-2">Nhật ký các đợt xuất kho</span>
                                      <div className="space-y-2 overflow-y-auto max-h-48">
                                        {allTx.map((tx) => (
                                          <div key={tx.id} className="flex justify-between items-center text-xs border-b border-slate-50 last:border-b-0 pb-1.5 last:pb-0">
                                            <div>
                                              <span className="font-bold font-mono text-blue-600">#{tx.id}</span>
                                              <span className="block text-[9px] font-bold text-slate-400">{formatDateString(tx.date)} | Người lập: {tx.createdByName}</span>
                                            </div>
                                            <span className="font-black text-slate-800">{formatCurrency(tx.totalValue)}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {constructionReports.records.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic">Không tìm thấy công trình nào phù hợp điều kiện tìm kiếm.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. REPORT VIEW: KHÁCH HÀNG THƯƠNG MẠI (COMMERCIAL REPORT) */}
      {/* ========================================================================= */}
      {activeTab === 'commercial' && (
        <div id="report-view-commercial" className="space-y-6 font-sans">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Khách hàng thương mại</span>
              <span className="text-base font-black text-slate-900 block mt-1">{commercialReports.summary.totalCustomers} Đối tác</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tổng doanh số thương mại</span>
              <span className="text-base font-black text-blue-600 block mt-1">{formatCurrency(commercialReports.summary.totalSalesRevenue)}</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tổng nợ từ khách hàng</span>
              <span className="text-base font-black text-rose-600 block mt-1">{formatCurrency(commercialReports.summary.totalOutstandingDebt)}</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Doanh số trung bình / KH</span>
              <span className="text-base font-black text-emerald-700 block mt-1">{formatCurrency(commercialReports.summary.averagePurchase)}</span>
            </div>
          </div>

          {/* Search, Filter Tools */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 inset-y-0 my-auto h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm nhanh tên khách hàng, SĐT, mã số..."
                value={searchComm}
                onChange={(e) => setSearchComm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={commDebtFilter}
                onChange={(e) => setCommDebtFilter(e.target.value)}
                className="w-full sm:w-44 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tất cả tình trạng nợ</option>
                <option value="debt">Đang có dư nợ {`>`} 0</option>
                <option value="nodebt">Không có dư nợ</option>
              </select>
            </div>
          </div>

          {/* Detailed Customer Sales List */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                <User className="h-4.5 w-4.5 text-blue-600" />
                Tổng hợp doanh số và công nợ khách hàng thương mại
              </h3>
              <span className="text-[10px] font-bold text-slate-400 italic">Bấm vào hàng để xem chi tiết hóa đơn xuất bán</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Tên khách hàng / Đối tác</th>
                    <th className="py-3 px-4">Số điện thoại</th>
                    <th className="py-3 px-4">Địa chỉ</th>
                    <th className="py-3 px-4 text-right">Tổng giá trị đã mua</th>
                    <th className="py-3 px-4 text-right">Dư nợ hiện tại</th>
                    <th className="py-3 px-4 text-center">Số đơn</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {commercialReports.records.map(({ customer, txCount, purchasedValue, outstandingDebt, itemsBought, allTx }) => {
                    const isOpen = expandedCommId === customer.id;
                    return (
                      <React.Fragment key={customer.id}>
                        <tr 
                          onClick={() => setExpandedCommId(isOpen ? null : customer.id)}
                          className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        >
                          <td className="py-4 px-4 font-black text-slate-900">
                            {customer.name}
                            <span className="block font-mono text-[9px] text-slate-400 uppercase tracking-widest font-normal mt-0.5">Mã KH: #{customer.id}</span>
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-500">{customer.phone}</td>
                          <td className="py-4 px-4 text-slate-500 font-medium truncate max-w-xs">{customer.address || 'Hệ thống'}</td>
                          <td className="py-4 px-4 text-right font-black text-blue-900">{formatCurrency(purchasedValue)}</td>
                          <td className="py-4 px-4 text-right font-black">
                            <span className={outstandingDebt > 0 ? 'text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg' : 'text-slate-800'}>
                              {formatCurrency(outstandingDebt)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-bold text-[10px]">{txCount}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                          </td>
                        </tr>

                        {/* Detailed expansion */}
                        {isOpen && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="p-6">
                              <div className="space-y-4">
                                <div className="border-l-4 border-emerald-500 pl-3">
                                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Chi tiết hóa đơn và vật tư thương mại</h4>
                                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">Kê khai các đợt mua sắm lẻ, phụ kiện gối đầu</p>
                                </div>

                                {allTx.length === 0 ? (
                                  <div className="text-center py-4 text-slate-400 italic bg-white rounded-xl border border-slate-100">
                                    Chưa phát sinh hóa đơn bán hàng trực tiếp nào.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Items list aggregate */}
                                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-2">Tổng sản phẩm đã mua</span>
                                      <div className="space-y-2">
                                        {itemsBought.map((item, idx) => (
                                          <div key={idx} className="flex justify-between items-center text-xs">
                                            <div>
                                              <span className="font-bold text-slate-800">{item.name}</span>
                                              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">{translateEquipmentType(item.type)}</span>
                                            </div>
                                            <span className="font-black text-slate-900">{item.qty} {item.unit}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Detailed receipts ledger */}
                                    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
                                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-2">Nhật ký hóa đơn</span>
                                      <div className="space-y-2 overflow-y-auto max-h-48">
                                        {allTx.map((tx) => (
                                          <div key={tx.id} className="flex justify-between items-center text-xs border-b border-slate-50 last:border-b-0 pb-1.5 last:pb-0">
                                            <div>
                                              <span className="font-bold font-mono text-emerald-600">#{tx.id}</span>
                                              <span className="block text-[9px] font-bold text-slate-400">{formatDateString(tx.date)} | Người lập: {tx.createdByName}</span>
                                            </div>
                                            <div className="text-right">
                                              <span className="font-black text-slate-800 block">{formatCurrency(tx.totalValue)}</span>
                                              <span className="text-[9px] text-slate-400 block">Đã trả: {formatCurrency(tx.paidAmount || 0)}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {commercialReports.records.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic">Không tìm thấy khách hàng nào phù hợp điều kiện tìm kiếm.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. REPORT VIEW: NHÀ CUNG CẤP (SUPPLIER REPORT) */}
      {/* ========================================================================= */}
      {activeTab === 'suppliers' && (
        <div id="report-view-suppliers" className="space-y-6 font-sans">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Đối tác nhà phân phối</span>
              <span className="text-base font-black text-slate-900 block mt-1">{supplierReports.summary.totalSuppliers} Doanh nghiệp</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tổng giá trị đã nhập</span>
              <span className="text-base font-black text-blue-600 block mt-1">{formatCurrency(supplierReports.summary.totalImportedValue)}</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tổng công nợ NCC</span>
              <span className="text-base font-black text-rose-600 block mt-1">{formatCurrency(supplierReports.summary.totalOutstandingDebt)}</span>
            </div>
          </div>

          {/* Search, Filter Tools */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 inset-y-0 my-auto h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm nhanh nhà cung cấp, SĐT, người liên hệ..."
                value={searchSupplier}
                onChange={(e) => setSearchSupplier(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={supDebtFilter}
                onChange={(e) => setSupDebtFilter(e.target.value)}
                className="w-full sm:w-44 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tất cả nợ NCC</option>
                <option value="debt">Đang có nợ phải trả</option>
                <option value="nodebt">Không nợ đọng</option>
              </select>
            </div>
          </div>

          {/* Detailed Suppliers List */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                <Building className="h-4.5 w-4.5 text-blue-600" />
                Quản lý công nợ gối đầu và nhập hàng Nhà Cung Cấp
              </h3>
              <span className="text-[10px] font-bold text-slate-400 italic">Bấm vào hàng để xem chi tiết lịch sử nhập hàng</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Tên Nhà Cung Cấp</th>
                    <th className="py-3 px-4">Người liên hệ</th>
                    <th className="py-3 px-4">Số điện thoại</th>
                    <th className="py-3 px-4 text-right">Tổng giá trị đã nhập</th>
                    <th className="py-3 px-4 text-right">Dư nợ phải trả</th>
                    <th className="py-3 px-4 text-center">Số lô nhập</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {supplierReports.records.map(({ supplier, txCount, importedValue, outstandingDebt, allTx }) => {
                    const isOpen = expandedSupId === supplier.id;
                    return (
                      <React.Fragment key={supplier.id}>
                        <tr 
                          onClick={() => setExpandedSupId(isOpen ? null : supplier.id)}
                          className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                        >
                          <td className="py-4 px-4 font-black text-slate-900">
                            {supplier.name}
                            <span className="block font-mono text-[9px] text-slate-400 uppercase tracking-widest font-normal mt-0.5">Mã NCC: #{supplier.id}</span>
                          </td>
                          <td className="py-4 px-4 font-bold text-slate-600">{supplier.contactName || 'Chưa cập nhật'}</td>
                          <td className="py-4 px-4 font-bold text-slate-500">{supplier.phone}</td>
                          <td className="py-4 px-4 text-right font-black text-slate-900">{formatCurrency(importedValue)}</td>
                          <td className="py-4 px-4 text-right font-black">
                            <span className={outstandingDebt > 0 ? 'text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100' : 'text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg'}>
                              {formatCurrency(outstandingDebt)}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono font-bold text-[10px]">{txCount}</span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                          </td>
                        </tr>

                        {/* Expandable detailed historical view */}
                        {isOpen && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="p-6">
                              <div className="space-y-4">
                                <div className="border-l-4 border-amber-500 pl-3">
                                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Lịch sử phiếu nhập và công nợ với {supplier.name}</h4>
                                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">Theo dõi chi tiết các đợt nhập pin năng lượng, inverter biến tần và công nợ</p>
                                </div>

                                {allTx.length === 0 ? (
                                  <div className="text-center py-4 text-slate-400 italic bg-white rounded-xl border border-slate-100">
                                    Chưa phát sinh phiếu nhập kho lưu trữ nào từ đối tác này.
                                  </div>
                                ) : (
                                  <div className="bg-white rounded-2xl border border-slate-100 p-4 overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                      <thead>
                                        <tr className="border-b border-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                          <th className="py-2">Mã phiếu</th>
                                          <th className="py-2">Ngày nhập</th>
                                          <th className="py-2">Sản phẩm</th>
                                          <th className="py-2 text-right">Tổng giá trị</th>
                                          <th className="py-2 text-right">Đã thanh toán</th>
                                          <th className="py-2 text-right">Dư nợ còn</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50 text-xs">
                                        {allTx.map((tx) => (
                                          <tr key={tx.id} className="hover:bg-slate-50/50">
                                            <td className="py-2 font-mono font-bold text-blue-600">#{tx.id}</td>
                                            <td className="py-2 font-bold text-slate-500">{formatDateString(tx.date)}</td>
                                            <td className="py-2 font-medium text-slate-700 max-w-xs truncate">
                                              {(tx.items || []).map(i => `${i.brand} ${i.model} (x${i.quantity})`).join(', ')}
                                            </td>
                                            <td className="py-2 text-right font-black text-slate-900">{formatCurrency(tx.totalValue)}</td>
                                            <td className="py-2 text-right font-bold text-emerald-600">{formatCurrency(tx.paidAmount || 0)}</td>
                                            <td className="py-2 text-right font-black text-rose-600">{formatCurrency(tx.debtAmount || 0)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {supplierReports.records.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic">Không tìm thấy nhà cung cấp nào phù hợp điều kiện tìm kiếm.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. REPORT VIEW: BÁO CÁO TỒN KHO CHI TIẾT (INVENTORY REPORT) */}
      {/* ========================================================================= */}
      {activeTab === 'inventory' && (
        <div id="report-view-inventory" className="space-y-6 font-sans">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Số dòng sản phẩm (SKU)</span>
              <span className="text-base font-black text-slate-900 block mt-1">{inventoryReports.summary.totalSkus} SKU</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tổng số thiết bị trong kho</span>
              <span className="text-base font-black text-blue-600 block mt-1">{inventoryReports.summary.totalQuantityInStock} đơn vị</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Tổng định mức tồn kho</span>
              <span className="text-base font-black text-indigo-700 block mt-1">{formatCurrency(inventoryReports.summary.totalValuation)}</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Mặt hàng dưới định mức an toàn</span>
              <span className="text-base font-black text-rose-600 block mt-1">{inventoryReports.summary.lowStockSkus} SKU</span>
            </div>
          </div>

          {/* Search, Filter Tools */}
          <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 inset-y-0 my-auto h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm nhanh theo thương hiệu, dòng sản phẩm, vị trí kho..."
                value={searchInventory}
                onChange={(e) => setSearchInventory(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                value={invTypeFilter}
                onChange={(e) => setInvTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tất cả phân loại</option>
                <option value="panel">Tấm pin Solar</option>
                <option value="inverter">Biến tần (Inverter)</option>
                <option value="battery">Pin lưu trữ</option>
                <option value="mounting">Khung giá nhôm</option>
                <option value="accessory">Phụ kiện điện</option>
              </select>

              <select
                value={invStockFilter}
                onChange={(e) => setInvStockFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tất cả mức tồn</option>
                <option value="instock">Tồn kho an toàn</option>
                <option value="low">Sắp hết hàng ({`<=`} định mức)</option>
                <option value="out">Đã cháy hàng (0 tồn)</option>
              </select>
            </div>
          </div>

          {/* Detailed Inventory Ledger Table */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                <Package className="h-4.5 w-4.5 text-blue-600" />
                Báo cáo kiểm kê tồn kho và tần suất xuất nhập
              </h3>
              <span className="text-[10px] font-black bg-blue-50 text-blue-700 px-3 py-1 rounded-full uppercase">
                {inventoryReports.records.length} SKU thiết bị
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Mã SKU</th>
                    <th className="py-3 px-4">Tên hàng / Dòng thiết bị</th>
                    <th className="py-3 px-4 text-center">Vị trí lưu trữ</th>
                    <th className="py-3 px-4 text-right">Giá vốn</th>
                    <th className="py-3 px-4 text-right">Tồn kho hiện tại</th>
                    <th className="py-3 px-4 text-right">Tổng giá trị tồn</th>
                    <th className="py-3 px-4 text-center">Xuất / Nhập lũy kế</th>
                    <th className="py-3 px-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {inventoryReports.records.map(({ equipment: e, value, importQty, exportQty, importCount, exportCount }) => {
                    const isOut = (e.stock || 0) === 0;
                    const isLow = (e.stock || 0) <= (e.minStock || 5) && !isOut;
                    return (
                      <tr key={e.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-black text-slate-500 uppercase">#{e.id}</td>
                        <td className="py-3.5 px-4">
                          <span className="font-black text-slate-900 block">{e.brand} {e.model}</span>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wide mt-0.5">{translateEquipmentType(e.type)}</span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-500">{e.location || 'Khu A'}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-600">{formatCurrency(e.unitPrice)}</td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-900">
                          {e.stock || 0} <span className="text-[10px] text-slate-400 font-bold">{e.unit || 'Cái'}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-blue-900">{formatCurrency(value)}</td>
                        <td className="py-3.5 px-4 text-center font-bold">
                          <span className="block text-[9px] text-emerald-600">Nhập: +{importQty} ({importCount} lần)</span>
                          <span className="block text-[9px] text-amber-600">Xuất: -{exportQty} ({exportCount} lần)</span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            isOut 
                              ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                              : isLow 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {isOut ? 'Hết hàng' : isLow ? 'Sắp hết' : 'An toàn'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {inventoryReports.records.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 italic">Không có mặt hàng nào phù hợp với bộ lọc tìm kiếm.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. REPORT VIEW: BÁO CÁO BÁN HÀNG THEO THỜI GIAN (SALES TIME REPORT) */}
      {/* ========================================================================= */}
      {activeTab === 'sales' && (
        <div id="report-view-sales" className="space-y-6 font-sans">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Doanh số xuất kho (Trong kỳ)</span>
              <span className="text-base font-black text-slate-900 block mt-1">{formatCurrency(salesReports.summary.totalOutflowValue)}</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Bán thương mại</span>
              <span className="text-base font-black text-emerald-600 block mt-1">{formatCurrency(salesReports.summary.commercialRevenue)}</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Cấp phát thi công</span>
              <span className="text-base font-black text-blue-600 block mt-1">{formatCurrency(salesReports.summary.constructionMaterialValue)}</span>
            </div>
            <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-2xs">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Số lượng đơn xuất kho</span>
              <span className="text-base font-black text-indigo-700 block mt-1">{salesReports.summary.totalTransactions} đơn</span>
            </div>
          </div>

          {/* Time Picker & Period Controls */}
          <div className="flex flex-col lg:flex-row items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-xs">
            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-2xl border border-slate-200">
              {([
                { key: '7days', label: '7 ngày qua' },
                { key: '30days', label: '30 ngày qua' },
                { key: 'month', label: 'Tháng này' },
                { key: 'prevmonth', label: 'Tháng trước' },
                { key: 'all', label: 'Tất cả lịch sử' }
              ]).map((item) => {
                const act = salesPeriod === item.key && !salesStartDate && !salesEndDate;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setSalesPeriod(item.key as any);
                      setSalesStartDate('');
                      setSalesEndDate('');
                    }}
                    className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      act 
                        ? 'bg-[#0054a6] text-white shadow-2xs' 
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Range Date Pickers */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">Hoặc chọn từ ngày:</span>
              <input
                type="date"
                value={salesStartDate}
                onChange={(e) => setSalesStartDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
              />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">đến:</span>
              <input
                type="date"
                value={salesEndDate}
                onChange={(e) => setSalesEndDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Charts & Graphs block */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Trend line chart */}
            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xs lg:col-span-2 flex flex-col justify-between gap-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                  <Activity className="h-4.5 w-4.5 text-blue-600" />
                  Xu hướng xuất kho & doanh số hàng ngày
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Giám sát dao động và khối lượng bán ra theo ngày</p>
              </div>

              <div className="h-64">
                {salesReports.trend.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400 italic">Không có dữ liệu trong mốc thời gian đã chọn.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={salesReports.trend} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="dateLabel" stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={9} fontWeight="bold" tickLine={false} tickFormatter={(val) => `${(val / 1000000).toFixed(0)}Tr`} />
                      <Tooltip 
                        formatter={(value: any) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', fontWeight: 'bold', fontSize: '10px' }}
                      />
                      <Area type="monotone" dataKey="Doanh thu" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#salesGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Right: Best sellers list */}
            <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-xs flex flex-col justify-between gap-4">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
                  <TrendingUp className="h-4.5 w-4.5 text-blue-600" />
                  Sản phẩm bán chạy nhất (Trong kỳ)
                </h4>
                <p className="text-[10px] text-slate-400 font-bold mt-1">Xếp hạng theo khối lượng và giá trị xuất kho gộp</p>
              </div>

              <div className="flex-1 overflow-y-auto max-h-64 divide-y divide-slate-50 space-y-2 pr-1">
                {salesReports.bestSellers.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-2 text-xs">
                    <div className="space-y-0.5">
                      <span className="font-black text-slate-800 block">{item.name}</span>
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{translateEquipmentType(item.type)}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-slate-900 block">{item.qty} chiếc</span>
                      <span className="text-[9px] text-slate-400 font-bold block">{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                ))}
                {salesReports.bestSellers.length === 0 && (
                  <div className="py-8 text-center text-slate-400 italic">Không có hàng hóa xuất kho trong khoảng thời gian này.</div>
                )}
              </div>
            </div>
          </div>

          {/* Sales Transactions detailed list */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">
                Nhật ký xuất hàng trong khoảng thời gian lọc ({salesReports.transactions.length} đơn xuất)
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Mã Phiếu</th>
                    <th className="py-3 px-4">Ngày xuất</th>
                    <th className="py-3 px-4">Khách hàng / Công trình</th>
                    <th className="py-3 px-4">Loại hình xuất</th>
                    <th className="py-3 px-4">Mặt hàng xuất</th>
                    <th className="py-3 px-4 text-right">Tổng giá trị xuất</th>
                    <th className="py-3 px-4">Người lập</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {salesReports.transactions.map((tx) => {
                    const isCons = tx.id.includes('PX-CONS') || projects.some(p => p.id === tx.partnerId);
                    const isDisp = tx.id.includes('PX-DISP') || tx.id.includes('HUY');
                    const labelType = isDisp ? 'Hủy bỏ' : isCons ? 'Thi công' : 'Thương mại';
                    const colorType = isDisp ? 'bg-rose-50 text-rose-700' : isCons ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700';

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-black text-blue-600">#{tx.id}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-500">{formatDateString(tx.date)}</td>
                        <td className="py-3.5 px-4 font-black text-slate-900">
                          {tx.partnerName || 'Chưa phân loại'}
                          <span className="block font-normal text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">Mã KH: {tx.partnerId}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${colorType}`}>
                            {labelType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-600 max-w-xs truncate">
                          {(tx.items || []).map(i => `${i.brand} ${i.model} (x${i.quantity})`).join(', ')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-slate-950">{formatCurrency(tx.totalValue)}</td>
                        <td className="py-3.5 px-4 text-slate-500 font-bold">{tx.createdByName || 'Admin'}</td>
                      </tr>
                    );
                  })}
                  {salesReports.transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic">Không tìm thấy giao dịch nào trong khoảng thời gian này.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
