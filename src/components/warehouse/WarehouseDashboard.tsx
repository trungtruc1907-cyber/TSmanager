import React, { useState } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  Package, 
  ArrowUpRight, 
  ArrowDownLeft, 
  FileText,
  Calendar,
  Layers3,
  ChevronRight,
  Settings,
  ShoppingCart,
  Truck,
  RotateCcw,
  ClipboardList,
  CheckCircle,
  Clock,
  Briefcase,
  HelpCircle,
  Plus,
  ArrowRightLeft,
  DollarSign
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';
import { Equipment, InventoryTransaction, MaterialRequest, PurchaseProposal, WarehouseSupplier } from './types';

interface WarehouseDashboardProps {
  equipment: Equipment[];
  transactions: InventoryTransaction[];
  requests: MaterialRequest[];
  proposals?: PurchaseProposal[];
  suppliers?: WarehouseSupplier[];
  onOpenDocument: (id: string, type: 'pn' | 'px' | 'dexuat' | 'muahang', label: string) => void;
  onNavigateTab: (tabId: string) => void;
}

export default function WarehouseDashboard({ 
  equipment, 
  transactions, 
  requests, 
  proposals = [],
  suppliers = [],
  onOpenDocument,
  onNavigateTab
}: WarehouseDashboardProps) {

  const [timeRange, setTimeRange] = useState('7 ngày qua');

  // Helper function to check if a date/timestamp is today
  const isToday = (dateVal: any): boolean => {
    if (!dateVal) return false;
    let d: Date;
    if (typeof dateVal.toDate === 'function') {
      d = dateVal.toDate();
    } else if (typeof dateVal === 'object' && dateVal.seconds !== undefined) {
      d = new Date(dateVal.seconds * 1000);
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return false;
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  };

  // Helper function to convert Firestore/String timestamps safely
  const getSafeTime = (dateVal: any): number => {
    if (!dateVal) return 0;
    if (typeof dateVal.toDate === 'function') {
      return dateVal.toDate().getTime();
    }
    if (typeof dateVal === 'object' && dateVal.seconds !== undefined) {
      return dateVal.seconds * 1000;
    }
    if (dateVal instanceof Date) {
      return dateVal.getTime();
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  // Dynamic relative time string helper
  const getRelativeTimeStr = (timestamp: number): string => {
    if (!timestamp) return 'Gần đây';
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('vi-VN');
  };

  // Compute live KPI Data
  const kpiData = React.useMemo(() => {
    const totalStockVal = equipment.reduce((sum, eq) => sum + (eq.stock || 0) * (eq.unitPrice || 0), 0);
    const totalItemsQty = equipment.reduce((sum, eq) => sum + (eq.stock || 0), 0);
    
    const pendingReqs = requests.filter(r => r.status === 'pending').length;
    const deliveryProposals = proposals.filter(p => p.status === 'ordering' || p.status === 'approved').length;
    const importsToday = transactions.filter(t => t.type === 'import' && isToday(t.createdAt)).length;
    const exportsToday = transactions.filter(t => t.type === 'export' && isToday(t.createdAt)).length;

    return [
      {
        title: 'Tổng giá trị tồn kho',
        value: formatCurrency(totalStockVal),
        unit: 'VND',
        trend: '↑ Đồng bộ thời gian thực',
        trendType: 'up',
        bgColor: 'bg-blue-50',
        iconColor: 'text-blue-600',
        icon: Package,
      },
      {
        title: 'Tổng số vật tư',
        value: equipment.length.toLocaleString('vi-VN'),
        unit: 'Mã hàng',
        trend: `Tổng: ${totalItemsQty.toLocaleString('vi-VN')} chiếc/tấm`,
        trendType: 'up',
        bgColor: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        icon: Layers3,
      },
      {
        title: 'Đề xuất chờ xử lý',
        value: pendingReqs.toString(),
        unit: 'Phiếu',
        trend: pendingReqs > 0 ? `Cần duyệt gấp` : 'Đã duyệt hết',
        trendType: pendingReqs > 0 ? 'down' : 'up',
        bgColor: 'bg-amber-50',
        iconColor: 'text-amber-600',
        icon: FileText,
      },
      {
        title: 'Đơn mua đang giao',
        value: deliveryProposals.toString(),
        unit: 'Đơn hàng',
        trend: 'Đang vận chuyển',
        trendType: 'up',
        bgColor: 'bg-purple-50',
        iconColor: 'text-purple-600',
        icon: ShoppingCart,
      },
      {
        title: 'Nhập kho hôm nay',
        value: importsToday.toString(),
        unit: 'Phiếu nhập',
        trend: 'Hôm nay',
        trendType: 'up',
        bgColor: 'bg-cyan-50',
        iconColor: 'text-cyan-600',
        icon: Truck,
      },
      {
        title: 'Xuất kho hôm nay',
        value: exportsToday.toString(),
        unit: 'Phiếu xuất',
        trend: 'Hôm nay',
        trendType: 'up',
        bgColor: 'bg-rose-50',
        iconColor: 'text-rose-600',
        icon: ArrowUpRight,
      }
    ];
  }, [equipment, requests, proposals, transactions]);

  // Compute live lineChartData for past 7 days
  const lineChartData = React.useMemo(() => {
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      return {
        dateObj: d,
        name: dayStr,
        nhap: 0,
        xuat: 0,
        ton: 0
      };
    });

    // Populate nhap/xuat from transactions
    transactions.forEach(tx => {
      const txTime = getSafeTime(tx.createdAt);
      if (!txTime) return;
      const txDate = new Date(txTime);
      const dayStr = txDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      const dayData = last7Days.find(d => d.name === dayStr);
      if (dayData) {
        const totalQty = tx.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
        if (tx.type === 'import') {
          dayData.nhap += totalQty;
        } else {
          dayData.xuat += totalQty;
        }
      }
    });

    // Compute cumulative stock
    let currentCumulativeStock = equipment.reduce((sum, eq) => sum + (eq.stock || 0), 0);
    for (let i = 6; i >= 0; i--) {
      last7Days[i].ton = Math.max(10, currentCumulativeStock);
      currentCumulativeStock = currentCumulativeStock - last7Days[i].nhap + last7Days[i].xuat;
    }

    return last7Days;
  }, [equipment, transactions]);

  // Compute live groupData (Tồn kho theo nhóm vật tư)
  const groupData = React.useMemo(() => {
    const groups: Record<string, { name: string; value: number; color: string }> = {
      panel: { name: 'Tấm pin Solar', value: 0, color: '#2563eb' },
      inverter: { name: 'Bộ hòa lưới (Inverter)', value: 0, color: '#10b981' },
      battery: { name: 'Pin lưu trữ (Battery)', value: 0, color: '#f59e0b' },
      mounting: { name: 'Khung giá đỡ (Mounting)', value: 0, color: '#8b5cf6' },
      accessory: { name: 'Phụ kiện', value: 0, color: '#ef4444' },
      other: { name: 'Thiết bị khác', value: 0, color: '#64748b' }
    };

    equipment.forEach(eq => {
      const type = eq.type || 'other';
      const groupKey = groups[type] ? type : 'other';
      groups[groupKey].value += (eq.stock || 0) * (eq.unitPrice || 0);
    });

    const totalVal = Object.values(groups).reduce((sum, g) => sum + g.value, 0);
    
    return Object.values(groups).map(g => {
      const pct = totalVal > 0 ? ((g.value / totalVal) * 100).toFixed(1) : '0.0';
      const valInBillion = Number((g.value / 1000000000).toFixed(3));
      return {
        name: g.name,
        value: valInBillion,
        color: g.color,
        percent: `${pct}%`,
        rawVal: g.value
      };
    });
  }, [equipment]);

  const totalValueInBillion = React.useMemo(() => {
    const rawSum = equipment.reduce((sum, eq) => sum + (eq.stock || 0) * (eq.unitPrice || 0), 0);
    return (rawSum / 1000000000).toFixed(3);
  }, [equipment]);

  // Compute live conditionData (Tình trạng vật tư)
  const conditionData = React.useMemo(() => {
    const total = equipment.length;
    const normal = equipment.filter(eq => (eq.stock || 0) > (eq.minStock || 5)).length;
    const low = equipment.filter(eq => (eq.stock || 0) > 0 && (eq.stock || 0) <= (eq.minStock || 5)).length;
    const out = equipment.filter(eq => (eq.stock || 0) === 0).length;

    const normalPct = total > 0 ? ((normal / total) * 100).toFixed(1) : '0.0';
    const lowPct = total > 0 ? ((low / total) * 100).toFixed(1) : '0.0';
    const outPct = total > 0 ? ((out / total) * 100).toFixed(1) : '0.0';

    return [
      { name: 'Bình thường', value: normal, color: '#10b981', percent: `${normalPct}%` },
      { name: 'Sắp hết', value: low, color: '#f59e0b', percent: `${lowPct}%` },
      { name: 'Hết hàng', value: out, color: '#ef4444', percent: `${outPct}%` }
    ].filter(c => c.value > 0 || total === 0);
  }, [equipment]);

  // Compute top 5 items by stock value
  const topItems = React.useMemo(() => {
    return [...equipment]
      .map(eq => {
        const stockVal = eq.stock || 0;
        const priceVal = eq.unitPrice || 0;
        const totalVal = stockVal * priceVal;
        return {
          id: eq.id,
          name: `${eq.brand} ${eq.model}`,
          stock: `${stockVal} ${eq.unit || 'Cái'}`,
          value: formatCurrency(totalVal),
          rawVal: totalVal
        };
      })
      .sort((a, b) => b.rawVal - a.rawVal)
      .slice(0, 5);
  }, [equipment]);

  // Compute top suppliers
  const topSuppliers = React.useMemo(() => {
    const supplierPurchaseValues: Record<string, { name: string; purchaseValue: number; debt: number }> = {};

    suppliers.forEach(sup => {
      supplierPurchaseValues[sup.id || sup.name] = {
        name: sup.name,
        purchaseValue: 0,
        debt: sup.debt || 0
      };
    });

    transactions.forEach(tx => {
      if (tx.type === 'import') {
        const key = tx.partnerId || tx.partnerName;
        if (!supplierPurchaseValues[key]) {
          supplierPurchaseValues[key] = {
            name: tx.partnerName,
            purchaseValue: 0,
            debt: tx.debtAmount || 0
          };
        }
        supplierPurchaseValues[key].purchaseValue += tx.totalValue || 0;
      }
    });

    return Object.values(supplierPurchaseValues)
      .sort((a, b) => b.purchaseValue - a.purchaseValue)
      .slice(0, 5)
      .map(s => ({
        name: s.name,
        value: formatCurrency(s.purchaseValue),
        debt: formatCurrency(s.debt),
        rawPurchase: s.purchaseValue
      }));
  }, [suppliers, transactions]);

  // Compute live total debt
  const totalDebt = React.useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (s.debt || 0), 0);
  }, [suppliers]);

  const deHanDebt = React.useMemo(() => {
    return Math.round(totalDebt * 0.8);
  }, [totalDebt]);

  const quaHanDebt = React.useMemo(() => {
    return totalDebt - deHanDebt;
  }, [totalDebt, deHanDebt]);

  // Compute live activities feed
  const activities = React.useMemo(() => {
    const rawActivities: any[] = [];

    transactions.forEach(tx => {
      const time = getSafeTime(tx.createdAt);
      rawActivities.push({
        name: tx.createdByName || 'Thủ kho Solar',
        action: tx.type === 'import' ? 'Nhập kho' : 'Xuất kho',
        ref: tx.id,
        timestamp: time,
        color: tx.type === 'import' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
      });
    });

    requests.forEach(req => {
      const time = getSafeTime(req.createdAt);
      rawActivities.push({
        name: req.technicianName || 'Kỹ thuật viên',
        action: 'Tạo đề xuất vật tư',
        ref: req.id,
        timestamp: time,
        color: 'bg-blue-100 text-blue-700'
      });
    });

    proposals.forEach(prop => {
      const time = getSafeTime(prop.createdAt);
      rawActivities.push({
        name: 'Đề xuất mua',
        action: prop.status === 'pending' ? 'Tạo đề xuất mua' : 'Duyệt đề xuất mua',
        ref: prop.id,
        timestamp: time,
        color: 'bg-amber-100 text-amber-700'
      });
    });

    return rawActivities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 6)
      .map(act => ({
        ...act,
        time: getRelativeTimeStr(act.timestamp)
      }));
  }, [transactions, requests, proposals]);

  // Compute live todo list
  const todoList = React.useMemo(() => {
    const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;
    const pendingProposalsCount = proposals.filter(p => p.status === 'pending').length;
    const orderingProposalsCount = proposals.filter(p => p.status === 'ordering').length;
    const lowStockCount = equipment.filter(eq => (eq.stock || 0) <= (eq.minStock || 5)).length;
    const overDebtCount = suppliers.filter(s => s.debt > 50000000).length;

    return [
      { label: `${pendingRequestsCount} đề xuất vật tư chờ duyệt`, count: pendingRequestsCount, type: 'dexuat', color: 'bg-amber-50 text-amber-600 border-amber-100' },
      { label: `${pendingProposalsCount} đơn mua chờ xác nhận`, count: pendingProposalsCount, type: 'muahang', color: 'bg-orange-50 text-orange-600 border-orange-100' },
      { label: `${orderingProposalsCount} đơn mua đang giao`, count: orderingProposalsCount, type: 'muahang', color: 'bg-blue-50 text-blue-600 border-blue-100' },
      { label: `${lowStockCount} vật tư sắp hết / hết hàng`, count: lowStockCount, type: 'kho', color: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
      { label: `${overDebtCount} NCC có công nợ lớn (>50M)`, count: overDebtCount, type: 'baocao', color: 'bg-rose-50 text-rose-600 border-rose-100' },
    ].filter(t => t.count > 0);
  }, [requests, proposals, equipment, suppliers]);

  const totalTodoCount = React.useMemo(() => {
    return todoList.reduce((sum, t) => sum + t.count, 0);
  }, [todoList]);

  // Compute live low stock progress cards
  const lowStockProgress = React.useMemo(() => {
    return equipment
      .filter(eq => (eq.stock || 0) <= (eq.minStock || 5))
      .map(eq => {
        const stockVal = eq.stock || 0;
        const minVal = eq.minStock || 5;
        const pct = minVal > 0 ? Math.min(100, Math.round((stockVal / minVal) * 100)) : 0;
        return {
          name: `${eq.brand} ${eq.model}`,
          stock: `${stockVal} ${eq.unit || 'Cái'}`,
          min: `${minVal} ${eq.unit || 'Cái'}`,
          pct,
          color: pct <= 20 ? 'bg-rose-500' : 'bg-amber-500'
        };
      })
      .slice(0, 4);
  }, [equipment]);

  return (
    <div className="space-y-6" id="warehouse-dashboard-container">
      
      {/* Upper Module Title & Header Actions Row */}
      <div className="bg-white py-3 px-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-base font-black text-slate-800 tracking-tight">Tổng quan</h2>
          <p className="text-slate-400 text-[10px] font-semibold">Cập nhật tình hình kho hàng theo thời gian thực</p>
        </div>
      </div>

      {/* Main Grid: Left Section (75% / 3 Columns) and Right Sidebar Section (25% / 1 Column) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* LEFT MAIN MODULE */}
        <div className="xl:col-span-3 space-y-6">
          
          {/* Row 1: KPI Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {kpiData.map((kpi, idx) => {
              const IconComp = kpi.icon;
              return (
                <div 
                  key={idx} 
                  className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs hover:shadow-md hover:border-slate-200 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl ${kpi.bgColor} flex items-center justify-center shrink-0`}>
                      <IconComp className={`h-4.5 w-4.5 ${kpi.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-slate-400 text-[10px] font-black uppercase tracking-wider block truncate">
                        {kpi.title}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-3.5">
                    <div className="flex items-baseline gap-1 flex-wrap">
                      <span className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                        {kpi.value}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">
                        {kpi.unit}
                      </span>
                    </div>
                    
                    <span className={`text-[9px] font-black mt-1.5 block leading-tight ${
                      kpi.trendType === 'up' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {kpi.trend}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row 2: Three Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Chart 1: Biến động nhập - xuất - tồn kho */}
            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-50 pb-3 mb-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  Biến động nhập - xuất - tồn kho
                </h3>
                <div className="relative">
                  <select 
                    value={timeRange} 
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none cursor-pointer"
                  >
                    <option value="7 ngày qua">7 ngày qua</option>
                    <option value="30 ngày qua">30 ngày qua</option>
                  </select>
                </div>
              </div>

              {/* Chart Legend indicators */}
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-wider mb-2 text-slate-500">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Nhập kho</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Xuất kho</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span>Tồn kho</span>
                </div>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fontWeight: 'bold', fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '12px' }} />
                    <Line type="monotone" dataKey="nhap" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="xuat" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="ton" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Giá trị tồn kho theo nhóm vật tư */}
            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
              <div className="border-b border-slate-50 pb-3 mb-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  Giá trị tồn kho theo nhóm vật tư
                </h3>
              </div>

              {/* Centered Donut Hole details inside standard CSS Flex stack */}
              <div className="relative w-full h-44 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {groupData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} Tỷ VND`, 'Giá trị']} />
                  </PieChart>
                </ResponsiveContainer>
                
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Tổng giá trị</span>
                  <span className="text-xl font-black text-slate-800 tracking-tight leading-none my-1">{totalValueInBillion}</span>
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase">Tỷ VND</span>
                </div>
              </div>

              {/* Custom Legend layout to perfectly match the photo design */}
              <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-50">
                {groupData.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-2 font-bold text-slate-600 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className="font-black text-slate-800 shrink-0 ml-2">
                      {item.value} Tỷ ({item.percent})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 3: Tình trạng vật tư */}
            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
              <div className="border-b border-slate-50 pb-3 mb-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                  Tình trạng vật tư
                </h3>
              </div>

              {/* Centered Donut details */}
              <div className="relative w-full h-44 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={conditionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {conditionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} mặt hàng`, 'Số lượng']} />
                  </PieChart>
                </ResponsiveContainer>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Tổng số</span>
                  <span className="text-xl font-black text-slate-800 tracking-tight leading-none my-1">{equipment.length.toLocaleString('vi-VN')}</span>
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase">mặt hàng</span>
                </div>
              </div>

              {/* Custom detailed Legend indicators matching the mockup */}
              <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-50">
                {conditionData.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-2 font-bold text-slate-600 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <span className="font-black text-slate-800 shrink-0 ml-2">
                      {item.value.toLocaleString('vi-VN')} ({item.percent})
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Row 3: 3 Lists/Tables columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Column 1: Top 5 vật tư có giá trị tồn cao nhất */}
            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="border-b border-slate-50 pb-3 mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Top 5 vật tư giá trị tồn cao nhất
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-black uppercase tracking-wider">
                        <th className="py-2 pr-1 text-center w-6">#</th>
                        <th className="py-2 px-1">Mã VT</th>
                        <th className="py-2 px-1">Tên vật tư</th>
                        <th className="py-2 px-1 text-right">Tồn kho</th>
                        <th className="py-2 pl-1 text-right">Giá trị (VND)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-slate-600">
                      {topItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 pr-1 text-center font-black text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-1 font-mono font-black text-slate-800">{item.id}</td>
                          <td className="py-2.5 px-1 font-medium text-slate-700 truncate max-w-[120px]" title={item.name}>
                            {item.name}
                          </td>
                          <td className="py-2.5 px-1 text-right text-slate-800">{item.stock}</td>
                          <td className="py-2.5 pl-1 text-right font-black text-slate-800">{item.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-50">
                <button 
                  onClick={() => onNavigateTab('kho')}
                  className="w-full text-center text-[10px] font-black uppercase text-blue-600 tracking-wider hover:underline hover:text-blue-700 cursor-pointer"
                >
                  Xem tất cả
                </button>
              </div>
            </div>

            {/* Column 2: Top 5 nhà cung cấp mua nhiều nhất */}
            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="border-b border-slate-50 pb-3 mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Top 5 nhà cung cấp mua nhiều nhất
                  </h3>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[10px] border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-black uppercase tracking-wider">
                        <th className="py-2 pr-1 text-center w-6">#</th>
                        <th className="py-2 px-1">Nhà cung cấp</th>
                        <th className="py-2 px-1 text-right">Giá trị mua</th>
                        <th className="py-2 pl-1 text-right">Công nợ (VND)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 font-bold text-slate-600">
                      {topSuppliers.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 pr-1 text-center font-black text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-1 font-medium text-slate-700 truncate max-w-[130px]" title={item.name}>
                            {item.name}
                          </td>
                          <td className="py-2.5 px-1 text-right text-slate-800 font-black">{item.value}</td>
                          <td className="py-2.5 pl-1 text-right font-black text-rose-600">{item.debt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-50">
                <button 
                  onClick={() => onNavigateTab('muahang')}
                  className="w-full text-center text-[10px] font-black uppercase text-blue-600 tracking-wider hover:underline hover:text-blue-700 cursor-pointer"
                >
                  Xem tất cả
                </button>
              </div>
            </div>

            {/* Column 3: Công nợ nhà cung cấp */}
            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="border-b border-slate-50 pb-3 mb-3 flex items-center justify-between">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                    Công nợ nhà cung cấp
                  </h3>
                  <select className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-1.5 py-0.5 outline-none cursor-pointer">
                    <option>Tất cả</option>
                  </select>
                </div>

                {/* KPI Total Debt display card */}
                <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 mb-4">
                  <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider block">
                    Tổng công nợ
                  </span>
                  <span className="text-base font-black text-slate-800 block mt-1">
                    {formatCurrency(totalDebt)} VND
                  </span>
                </div>

                {/* Sub KPI boxes (Đến hạn, Quá hạn) */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-100/50">
                    <span className="text-amber-600 text-[9px] font-black uppercase tracking-wider block">Đến hạn</span>
                    <span className="text-xs font-black text-amber-700 mt-1 block">{formatCurrency(deHanDebt)}</span>
                  </div>
                  <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100/50">
                    <span className="text-rose-600 text-[9px] font-black uppercase tracking-wider block">Quá hạn</span>
                    <span className="text-xs font-black text-rose-700 mt-1 block">{formatCurrency(quaHanDebt)}</span>
                  </div>
                </div>

                {/* Mini suppliers list */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] border-b border-slate-50 pb-2">
                    <span className="font-black text-slate-500 uppercase tracking-wider">Chi tiết công nợ</span>
                    <button className="text-[9px] font-black text-blue-600 hover:underline uppercase tracking-wider">
                      Xem tất cả
                    </button>
                  </div>
                  
                  {topSuppliers.length === 0 ? (
                    <div className="text-center text-[10px] text-slate-400 py-3">Không có công nợ</div>
                  ) : (
                    topSuppliers.map((sup, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[10px] font-bold text-slate-600">
                        <span className="truncate max-w-[170px]">{sup.name}</span>
                        <span className="font-black text-slate-800">{sup.debt}</span>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>

          </div>

          {/* Row 4: Hoạt động gần đây */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs">
            <div className="border-b border-slate-50 pb-3 mb-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Hoạt động gần đây
              </h3>
            </div>
            
            {/* Horizontal flowable list of activity widgets */}
            <div className="flex items-center gap-4 overflow-x-auto scrollbar-thin pb-2">
              {activities.map((act, idx) => (
                <div 
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-slate-50/60 hover:bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-200 transition-all min-w-[200px] max-w-[220px] shrink-0"
                >
                  <div className="flex flex-col h-full justify-between gap-1 w-full">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-slate-800 truncate block">
                        {act.name}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold leading-snug">
                      {act.action} <span className="font-mono text-[9px] font-black bg-white border border-slate-200 rounded px-1 text-slate-700">{act.ref}</span>
                    </p>
                    <span className="text-[9px] text-slate-400 font-bold mt-1 block flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 text-slate-400" />
                      {act.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT SIDEBAR MODULE */}
        <div className="xl:col-span-1 space-y-6">
          
          {/* Sidebar Box 1: Việc cần làm */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs">
            <div className="border-b border-slate-50 pb-3 mb-4 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Việc cần làm ({totalTodoCount})
              </h3>
            </div>

            <div className="space-y-2.5">
              {todoList.map((todo, idx) => (
                <div 
                  key={idx}
                  onClick={() => onNavigateTab(todo.type)}
                  className="flex items-center justify-between p-3 bg-slate-50/60 hover:bg-slate-100/50 border border-slate-100 hover:border-slate-200 rounded-2xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg ${todo.color} border flex items-center justify-center shrink-0`}>
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <span className="text-[11px] font-black text-slate-700 truncate">
                      {todo.label}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors shrink-0" />
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Box 2: Vật tư sắp hết */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs">
            <div className="border-b border-slate-50 pb-3 mb-4 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Vật tư sắp hết
              </h3>
              <button 
                onClick={() => onNavigateTab('kho')}
                className="text-[9px] font-black text-blue-600 hover:underline uppercase tracking-wider"
              >
                Xem tất cả
              </button>
            </div>

            {/* Custom progress bars matching design mockup */}
            <div className="space-y-4">
              {lowStockProgress.map((item, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-700">
                    <span className="truncate">{item.name}</span>
                  </div>
                  
                  {/* Outer container */}
                  <div className="relative w-full h-5 bg-slate-100 rounded-full overflow-hidden flex items-center">
                    {/* Progress Fill bar */}
                    <div 
                      className={`h-full ${item.color} rounded-full transition-all`}
                      style={{ width: `${item.pct}%` }}
                    />
                    {/* Absolutely centered inner stock count */}
                    <span className="absolute left-3 text-[9px] font-black text-slate-800">
                      Tồn: {item.stock}
                    </span>
                  </div>
                  
                  {/* Under stats */}
                  <div className="text-right">
                    <span className="text-[9px] text-slate-400 font-extrabold">
                      Min: {item.min}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Box 3: Thao tác nhanh */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-xs">
            <div className="border-b border-slate-50 pb-3 mb-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">
                Thao tác nhanh
              </h3>
            </div>

            {/* Grid of action buttons */}
            <div className="grid grid-cols-2 gap-3">
              
              {/* Card 1: Tạo đề xuất */}
              <div 
                onClick={() => onNavigateTab('dexuat')}
                className="flex flex-col items-center justify-center p-4 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100/40 rounded-2xl text-center cursor-pointer transition-all active:scale-95 group"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2 group-hover:scale-105 transition-transform">
                  <FileText className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-black text-indigo-950 uppercase tracking-wider">
                  Tạo đề xuất
                </span>
              </div>

              {/* Card 2: Tạo đơn mua */}
              <div 
                onClick={() => onNavigateTab('muahang')}
                className="flex flex-col items-center justify-center p-4 bg-purple-50/50 hover:bg-purple-50 border border-purple-100/40 rounded-2xl text-center cursor-pointer transition-all active:scale-95 group"
              >
                <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600 mb-2 group-hover:scale-105 transition-transform">
                  <ShoppingCart className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-black text-purple-950 uppercase tracking-wider">
                  Tạo đơn mua
                </span>
              </div>

              {/* Card 3: Nhập kho */}
              <div 
                onClick={() => onNavigateTab('nhapkho')}
                className="flex flex-col items-center justify-center p-4 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100/40 rounded-2xl text-center cursor-pointer transition-all active:scale-95 group"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-2 group-hover:scale-105 transition-transform">
                  <Truck className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-black text-emerald-950 uppercase tracking-wider">
                  Nhập kho
                </span>
              </div>

              {/* Card 4: Xuất kho */}
              <div 
                onClick={() => onNavigateTab('xuatkho')}
                className="flex flex-col items-center justify-center p-4 bg-rose-50/50 hover:bg-rose-50 border border-rose-100/40 rounded-2xl text-center cursor-pointer transition-all active:scale-95 group"
              >
                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 mb-2 group-hover:scale-105 transition-transform">
                  <ArrowUpRight className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-black text-rose-950 uppercase tracking-wider">
                  Xuất kho
                </span>
              </div>

              {/* Card 5: Điều chuyển */}
              <div 
                onClick={() => onNavigateTab('kho')}
                className="flex flex-col items-center justify-center p-4 bg-blue-50/50 hover:bg-blue-50 border border-blue-100/40 rounded-2xl text-center cursor-pointer transition-all active:scale-95 group"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 mb-2 group-hover:scale-105 transition-transform">
                  <ArrowRightLeft className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-black text-blue-950 uppercase tracking-wider">
                  Điều chuyển
                </span>
              </div>

              {/* Card 6: Kiểm kê */}
              <div 
                onClick={() => onNavigateTab('kho')}
                className="flex flex-col items-center justify-center p-4 bg-teal-50/50 hover:bg-teal-50 border border-teal-100/40 rounded-2xl text-center cursor-pointer transition-all active:scale-95 group"
              >
                <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center text-teal-600 mb-2 group-hover:scale-105 transition-transform">
                  <ClipboardList className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-black text-teal-950 uppercase tracking-wider">
                  Kiểm kê
                </span>
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
