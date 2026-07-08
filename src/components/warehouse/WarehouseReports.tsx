import React from 'react';
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
  Line
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Package, 
  Building,
  AlertCircle
} from 'lucide-react';
import { Equipment, InventoryTransaction, WarehouseSupplier } from './types';

interface WarehouseReportsProps {
  equipment: Equipment[];
  transactions: InventoryTransaction[];
  suppliers: WarehouseSupplier[];
}

export default function WarehouseReports({ equipment, transactions, suppliers }: WarehouseReportsProps) {
  
  // Format Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // --- Stat 1: Total Warehouse Valuation
  const totalValuation = equipment.reduce((sum, item) => sum + ((item.stock || 0) * (item.unitPrice || 0)), 0);

  // --- Stat 2: Material category breakdowns
  const categoryBreakdown = equipment.reduce((acc: any, item) => {
    const type = item.type || 'other';
    const val = (item.stock || 0) * (item.unitPrice || 0);
    acc[type] = (acc[type] || 0) + val;
    return acc;
  }, {});

  const pieData = [
    { name: 'Tấm pin Solar', value: categoryBreakdown['panel'] || 0, color: '#3b82f6' },
    { name: 'Inverter Biến tần', value: categoryBreakdown['inverter'] || 0, color: '#f59e0b' },
    { name: 'Pin lưu trữ (Battery)', value: categoryBreakdown['battery'] || 0, color: '#10b981' },
    { name: 'Khung giá nhôm/Khác', value: (categoryBreakdown['mounting'] || 0) + (categoryBreakdown['other'] || 0), color: '#64748b' }
  ].filter(p => p.value > 0);

  // --- Stat 3: Monthly Import vs Export Value
  const monthlyDataMap: { [month: string]: { import: number; export: number } } = {};
  
  // Initialize last 6 months or default current months
  const months = ['02/2026', '03/2026', '04/2026', '05/2026', '06/2026', '07/2026'];
  months.forEach(m => {
    monthlyDataMap[m] = { import: 0, export: 0 };
  });

  // Aggregate actual transactions
  transactions.forEach(tx => {
    if (!tx.date) return;
    const [year, month] = tx.date.split('-');
    const formattedMonth = `${month}/${year}`;
    if (monthlyDataMap[formattedMonth]) {
      if (tx.type === 'import') {
        monthlyDataMap[formattedMonth].import += tx.totalValue || 0;
      } else {
        monthlyDataMap[formattedMonth].export += tx.totalValue || 0;
      }
    }
  });

  const barChartData = Object.keys(monthlyDataMap).map(key => ({
    name: key,
    'Nhập kho': monthlyDataMap[key].import,
    'Xuất kho': monthlyDataMap[key].export
  }));

  // --- Stat 4: Low stock alerts count
  const lowStockCount = equipment.filter(e => (e.stock || 0) <= (e.minStock || 5)).length;

  // --- Stat 5: Outstanding supplier debt
  const totalDebt = suppliers.reduce((sum, s) => sum + (s.debt || 0), 0);

  return (
    <div id="warehouse-reports-container" className="space-y-6">
      
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Stock valuation */}
        <div id="card-total-valuation" className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
            <DollarSign className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Tổng giá trị tồn kho</span>
            <span className="text-sm sm:text-base font-black text-slate-900 mt-1 block">{formatCurrency(totalValuation)}</span>
            <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Giá vốn nhập phân bổ</span>
          </div>
        </div>

        {/* Card 2: Low Stock Alert */}
        <div id="card-low-stock" className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center shrink-0">
            <AlertCircle className="h-6 w-6 text-rose-600" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Mặt hàng cần nhập thêm</span>
            <span className="text-sm sm:text-base font-black text-slate-900 mt-1 block">{lowStockCount} dòng thiết bị</span>
            <span className="text-[9px] font-bold text-rose-600 block mt-0.5">Dưới định mức an toàn</span>
          </div>
        </div>

        {/* Card 3: Total Liabilities Debt */}
        <div id="card-liabilities-debt" className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
            <TrendingUp className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Công nợ nhà cung cấp</span>
            <span className="text-sm sm:text-base font-black text-slate-900 mt-1 block">{formatCurrency(totalDebt)}</span>
            <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Nợ phải trả tích lũy</span>
          </div>
        </div>

        {/* Card 4: Suppliers Count */}
        <div id="card-suppliers" className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Building className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Đối tác nhà cung cấp</span>
            <span className="text-sm sm:text-base font-black text-slate-900 mt-1 block">{suppliers.length} nhà phân phối</span>
            <span className="text-[9px] font-bold text-slate-400 block mt-0.5">Solar panels, Inverters & Batteries</span>
          </div>
        </div>

      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart Left: Monthly Import vs Export Values */}
        <div id="chart-monthly-balance" className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-2xs lg:col-span-2 flex flex-col gap-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
              <TrendingUp className="h-4.5 w-4.5 text-blue-600" />
              Cân đối tài chính xuất nhập kho (6 tháng qua)
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">So sánh tổng giá trị xuất vật tư dự án so với nhập kho bổ sung hàng tháng</p>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} tickFormatter={(val) => `${val / 1000000}Tr`} />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(value)} 
                  contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', fontWeight: 'bold', fontSize: '11px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase' }} />
                <Bar dataKey="Nhập kho" fill="#0054a6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Xuất kho" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart Right: Category Breakdown Pie Chart */}
        <div id="chart-category-valuation" className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-2xs flex flex-col gap-4">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
              <Layers className="h-4.5 w-4.5 text-blue-600" />
              Cơ cấu giá trị kho vật tư
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-1">Tỷ lệ giá trị tồn kho phân chia theo chủng loại tấm pin, biến tần & ắc quy</p>
          </div>

          <div className="h-56 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
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
              <span className="text-[9px] font-black uppercase text-slate-400 block leading-none">Tổng giá trị</span>
              <span className="text-xs font-black text-slate-800 mt-1 block">{(totalValuation / 1000000).toFixed(1)}Tr</span>
            </div>
          </div>

          {/* Pie legend */}
          <div className="grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-wider pt-2 border-t border-slate-50">
            {pieData.map((p, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="text-slate-500 truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Supplier Liabilities Grid List */}
      <div id="supplier-debts-ledger" className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-2xs space-y-4">
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 flex items-center gap-1.5">
            <Building className="h-4.5 w-4.5 text-blue-600" />
            Bảng kê nợ đối tác cung ứng vật tư
          </h3>
          <p className="text-[10px] text-slate-400 font-bold mt-1">Giám sát dòng nợ gối đầu và thời điểm thanh toán cho nhà phân phối thiết bị điện mặt trời</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {suppliers.map(sup => (
            <div key={sup.id} className="bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-between transition-all">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[8px] font-mono text-slate-400 font-bold uppercase">Mã: #{sup.id}</span>
                  <span className="text-xs font-black text-slate-800 block mt-0.5">{sup.name}</span>
                  <span className="text-[10px] font-bold text-slate-400 block mt-1">Lĩnh vực: Cung ứng vật tư</span>
                </div>
                <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                  sup.debt > 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {sup.debt > 0 ? 'Ghi nợ' : 'Sạch nợ'}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Số dư nợ gối đầu</span>
                <span className={`font-black ${sup.debt > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {formatCurrency(sup.debt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
