import { collection, getDocs, setDoc, doc, getDoc } from 'firebase/firestore';
import { Firestore } from 'firebase/firestore';

export const SAMPLE_EQUIPMENT_CATALOG = [
  {
    id: 'EQ001',
    type: 'panel',
    brand: 'Longi Solar',
    model: 'LR5-72HPH 550W',
    capacity: 550,
    unitPrice: 2100000,
    sellingPrice: 2800000,
    unit: 'Tấm',
    stock: 120,
    minStock: 20,
    location: 'Kệ A1-A3',
    supplier: 'Solar Sông Đà',
    details: 'Tấm pin mono half-cell hiệu suất cao 21.3%'
  },
  {
    id: 'EQ002',
    type: 'panel',
    brand: 'Jinko Solar',
    model: 'Tiger Pro 545W',
    capacity: 545,
    unitPrice: 2050000,
    sellingPrice: 2750000,
    unit: 'Tấm',
    stock: 15,
    minStock: 25,
    location: 'Kệ A4-A6',
    supplier: 'Jinko Solar APAC',
    details: 'Tấm pin công nghệ Multi-busbar giảm suy hao dòng điện'
  },
  {
    id: 'EQ003',
    type: 'inverter',
    brand: 'Growatt',
    model: 'MOD 10KTL3-X',
    capacity: 10,
    unitPrice: 18500000,
    sellingPrice: 23000000,
    unit: 'Bộ',
    stock: 8,
    minStock: 5,
    location: 'Kệ B1',
    supplier: 'Growatt Việt Nam',
    details: 'Inverter hòa lưới 3 pha, 2 MPPT, bảo hành 5 năm'
  },
  {
    id: 'EQ004',
    type: 'inverter',
    brand: 'Deye',
    model: 'SUN-12K-SG04LP3-EU',
    capacity: 12,
    unitPrice: 42000000,
    sellingPrice: 49000000,
    unit: 'Bộ',
    stock: 3,
    minStock: 5,
    location: 'Kệ B2',
    supplier: 'Growatt Việt Nam',
    details: 'Inverter Hybrid 3 pha cao cấp, hỗ trợ pin lưu trữ 48V'
  },
  {
    id: 'EQ005',
    type: 'battery',
    brand: 'Gigabox',
    model: 'Gigabox 5S 48V 100Ah',
    capacity: 100,
    unitPrice: 28000000,
    sellingPrice: 34000000,
    unit: 'Quả',
    stock: 12,
    minStock: 4,
    location: 'Kệ C1',
    supplier: 'Solar Sông Đà',
    details: 'Pin lưu trữ LiFePO4 dung lượng 4.8kWh, tuổi thọ 6000 chu kỳ'
  },
  {
    id: 'EQ006',
    type: 'mounting',
    brand: 'Trường Sơn',
    model: 'Ray Nhôm AL-6005-T5',
    capacity: 0,
    unitPrice: 180000,
    sellingPrice: 250000,
    unit: 'Thanh',
    stock: 250,
    minStock: 50,
    location: 'Kệ D1',
    supplier: 'Nhôm Định Hình Việt Pháp',
    details: 'Thanh rail nhôm anodized dài 4.2m chuyên dụng cho áp mái'
  },
  {
    id: 'CADIVI-CXV-2X10',
    type: 'other',
    brand: 'Cadivi',
    model: 'Cáp CXV-2X10 (x16)',
    capacity: 0,
    unitPrice: 85000,
    sellingPrice: 110000,
    unit: 'Mét',
    stock: 450,
    minStock: 100,
    location: 'Kệ Cuộn Cáp C2',
    supplier: 'Cáp điện Cadivi Việt Nam',
    details: 'Cáp điện lực hạ thế Cu/XLPE/PVC 0.6/1kV 2x10mm² kèm dây đồng tiếp địa trần x16mm²'
  },
  {
    id: 'CADIVI-CXV-2X16',
    type: 'other',
    brand: 'Cadivi',
    model: 'Cáp CXV 2x16 mm²',
    capacity: 0,
    unitPrice: 135000,
    sellingPrice: 165000,
    unit: 'Mét',
    stock: 300,
    minStock: 80,
    location: 'Kệ Cuộn Cáp C2',
    supplier: 'Cáp điện Cadivi Việt Nam',
    details: 'Cáp điện lực hạ thế Cu/XLPE/PVC 0.6/1kV 2x16mm² Cadivi chính hãng'
  },
  {
    id: 'CADIVI-CXV-4X16',
    type: 'other',
    brand: 'Cadivi',
    model: 'Cáp CXV 4x16 mm²',
    capacity: 0,
    unitPrice: 245000,
    sellingPrice: 295000,
    unit: 'Mét',
    stock: 200,
    minStock: 50,
    location: 'Kệ Cuộn Cáp C2',
    supplier: 'Cáp điện Cadivi Việt Nam',
    details: 'Cáp điện lực 3 pha 4 ruột đồng Cu/XLPE/PVC 4x16mm² 0.6/1kV'
  },
  {
    id: 'DC-SOLAR-4MM',
    type: 'other',
    brand: 'Leader / KBE',
    model: 'Cáp DC Solar 1x4.0 mm² (Đỏ / Đen)',
    capacity: 0,
    unitPrice: 12500,
    sellingPrice: 16500,
    unit: 'Mét',
    stock: 1500,
    minStock: 300,
    location: 'Kệ Cuộn Cáp C1',
    supplier: 'Solar Sông Đà',
    details: 'Cáp DC Solar chuyên dụng chịu tia UV 1500V tiêu chuẩn EN50618'
  },
  {
    id: 'DC-SOLAR-6MM',
    type: 'other',
    brand: 'Leader / KBE',
    model: 'Cáp DC Solar 1x6.0 mm² (Đỏ / Đen)',
    capacity: 0,
    unitPrice: 18000,
    sellingPrice: 23500,
    unit: 'Mét',
    stock: 850,
    minStock: 200,
    location: 'Kệ Cuộn Cáp C1',
    supplier: 'Solar Sông Đà',
    details: 'Cáp DC Solar chống tia cực tím UV 6mm² cho hệ công suất lớn'
  },
  {
    id: 'TIEP-DIA-M16',
    type: 'other',
    brand: 'Cadivi',
    model: 'Dây đồng trần tiếp địa M16 (C16)',
    capacity: 0,
    unitPrice: 38000,
    sellingPrice: 48000,
    unit: 'Mét',
    stock: 600,
    minStock: 100,
    location: 'Kệ Cuộn Cáp C3',
    supplier: 'Cáp điện Cadivi Việt Nam',
    details: 'Dây đồng trần xoắn C16/M16 tiếp địa chống sét cho hệ thống solar'
  },
  {
    id: 'TU-DIEN-ACDC-15KW',
    type: 'other',
    brand: 'Schneider / Chint',
    model: 'Tủ điện bảo vệ AC/DC Solar 10-15kW (IP65)',
    capacity: 0,
    unitPrice: 3200000,
    sellingPrice: 4200000,
    unit: 'Bộ',
    stock: 18,
    minStock: 5,
    location: 'Kệ Tủ Điện B3',
    supplier: 'Thiết Bị Điện Schneider',
    details: 'Tủ điện ngoài trời chống nước IP65 tích hợp chống sét SPD DC 1000V, SPD AC 275V, MCB AC, Cầu chì DC'
  }
];

export async function seedWarehouseData(db: Firestore) {
  try {
    // 1. Seed Equipment (ensure all essential equipment items exist)
    for (const eq of SAMPLE_EQUIPMENT_CATALOG) {
      try {
        const docRef = doc(db, 'equipment', eq.id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
          console.log(`Seeding equipment item: ${eq.id} - ${eq.model}`);
          await setDoc(docRef, eq);
        }
      } catch (err) {
        console.warn(`Error seeding equipment item ${eq.id}:`, err);
      }
    }

    // 2. Seed Suppliers
    const suppliersSnap = await getDocs(collection(db, 'suppliers'));
    if (suppliersSnap.empty) {
      console.log('Seeding suppliers...');
      const sampleSuppliers = [
        {
          id: 'SUP001',
          name: 'Solar Sông Đà',
          contactName: 'Lê Hoàng Long',
          phone: '0987654321',
          email: 'long.le@solarsongda.vn',
          address: 'Khu công nghệ cao Hòa Lạc, Hà Nội',
          debt: 45000000,
          createdAt: new Date().toISOString()
        },
        {
          id: 'SUP002',
          name: 'Growatt Việt Nam',
          contactName: 'Nguyễn Minh Tuấn',
          phone: '0912345678',
          email: 'tuan.nguyen@growatt.vn',
          address: 'Tòa nhà Landmark 81, TP. Hồ Chí Minh',
          debt: 0,
          createdAt: new Date().toISOString()
        },
        {
          id: 'SUP003',
          name: 'Jinko Solar APAC',
          contactName: 'Ms. Sophia Chen',
          phone: '+65 6789 0123',
          email: 'sophia.chen@jinkosolar.com',
          address: 'Marina Bay Financial Centre, Singapore',
          debt: 120000000,
          createdAt: new Date().toISOString()
        },
        {
          id: 'SUP004',
          name: 'Cáp điện Cadivi Việt Nam',
          contactName: 'Trần Văn Cường',
          phone: '0903889977',
          email: 'sales@cadivi.vn',
          address: '70-72 Nam Kỳ Khởi Nghĩa, Q.1, TP.HCM',
          debt: 0,
          createdAt: new Date().toISOString()
        }
      ];

      for (const sup of sampleSuppliers) {
        const id = sup.id || doc(collection(db, 'suppliers')).id;
        await setDoc(doc(db, 'suppliers', id), { ...sup, id });
      }
    } else {
      const cadiviRef = doc(db, 'suppliers', 'SUP004');
      const cadiviSnap = await getDoc(cadiviRef);
      if (!cadiviSnap.exists()) {
        await setDoc(cadiviRef, {
          id: 'SUP004',
          name: 'Cáp điện Cadivi Việt Nam',
          contactName: 'Trần Văn Cường',
          phone: '0903889977',
          email: 'sales@cadivi.vn',
          address: '70-72 Nam Kỳ Khởi Nghĩa, Q.1, TP.HCM',
          debt: 0,
          createdAt: new Date().toISOString()
        });
      }
    }

    // 3. Seed Material Requests (Đề xuất)
    const reqSnap = await getDocs(collection(db, 'material_requests'));
    if (reqSnap.empty) {
      console.log('Seeding material requests...');
      const sampleRequests = [
        {
          id: 'DX-0001',
          projectId: 'PRJ001',
          projectName: 'Khách sạn Mường Thanh Hà Nội',
          technicianId: 'TECH_01',
          technicianName: 'Nguyễn Văn Hùng',
          reason: 'Thi công hệ thống hòa lưới 10kWp cho khách hàng doanh nghiệp',
          status: 'pending',
          createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(), // 2 days ago
          items: [
            { equipmentId: 'EQ001', brand: 'Longi Solar', model: 'LR5-72HPH 550W', type: 'panel', quantity: 20, unit: 'Tấm' },
            { equipmentId: 'EQ003', brand: 'Growatt', model: 'MOD 10KTL3-X', type: 'inverter', quantity: 1, unit: 'Bộ' },
            { equipmentId: 'EQ006', brand: 'Trường Sơn', model: 'Ray Nhôm AL-6005-T5', type: 'mounting', quantity: 12, unit: 'Thanh' }
          ]
        },
        {
          id: 'DX-0002',
          projectId: 'PRJ002',
          projectName: 'Biệt thự Vinhomes Riverside',
          technicianId: 'TECH_02',
          technicianName: 'Trần Thanh Sơn',
          reason: 'Thi công hệ Hybrid 12kWp kết hợp pin lưu trữ cao cấp',
          status: 'approved',
          createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(), // 5 days ago
          items: [
            { equipmentId: 'EQ002', brand: 'Jinko Solar', model: 'Tiger Pro 545W', type: 'panel', quantity: 24, unit: 'Tấm' },
            { equipmentId: 'EQ004', brand: 'Deye', model: 'SUN-12K-SG04LP3-EU', type: 'inverter', quantity: 1, unit: 'Bộ' },
            { equipmentId: 'EQ005', brand: 'Gigabox', model: 'Gigabox 5S 48V 100Ah', type: 'battery', quantity: 2, unit: 'Quả' }
          ],
          adminNote: 'Đã xuất kho đầy đủ, kỹ thuật nhận hàng trực tiếp tại kho.'
        }
      ];

      for (const req of sampleRequests) {
        await setDoc(doc(db, 'material_requests', req.id), req);
      }
    }

    // 4. Seed Purchase Proposals (Mua hàng)
    const propSnap = await getDocs(collection(db, 'purchase_proposals'));
    if (propSnap.empty) {
      console.log('Seeding purchase proposals...');
      const sampleProposals = [
        {
          id: 'MH-0001',
          supplierId: 'SUP001',
          supplierName: 'Solar Sông Đà',
          reason: 'Nhập bổ sung lượng tồn kho tấm pin Longi 550W do sắp hết hàng',
          totalCost: 105000000, // 50 * 2.1M
          status: 'ordering',
          createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
          items: [
            { equipmentId: 'EQ001', brand: 'Longi Solar', model: 'LR5-72HPH 550W', type: 'panel', quantity: 50, unitPrice: 2100000, unit: 'Tấm' }
          ]
        },
        {
          id: 'MH-0002',
          supplierId: 'SUP002',
          supplierName: 'Growatt Việt Nam',
          reason: 'Dự phòng dòng inverter hybrid cao cấp phục vụ mùa nóng',
          totalCost: 210000000, // 5 * 42M
          status: 'pending',
          createdAt: new Date().toISOString(),
          items: [
            { equipmentId: 'EQ004', brand: 'Deye', model: 'SUN-12K-SG04LP3-EU', type: 'inverter', quantity: 5, unitPrice: 42000000, unit: 'Bộ' }
          ]
        }
      ];

      for (const prop of sampleProposals) {
        await setDoc(doc(db, 'purchase_proposals', prop.id), prop);
      }
    }

    // 5. Seed Inventory Transactions (Nhập kho / Xuất kho)
    const txSnap = await getDocs(collection(db, 'inventory_transactions'));
    if (txSnap.empty) {
      console.log('Seeding inventory transactions...');
      const sampleTransactions = [
        {
          id: 'PN000235', // THE EXACT ONE REQUESTED BY THE USER!
          type: 'import',
          date: new Date(Date.now() - 3600000 * 12).toISOString().split('T')[0], // Today, 12h ago
          createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
          partnerId: 'SUP001',
          partnerName: 'Solar Sông Đà',
          totalValue: 63000000, // 30 * 2.1M
          paidAmount: 40000000,
          debtAmount: 23000000,
          note: 'Nhập hàng tấm pin Longi 550W theo hóa đơn mua hàng số HD-8849',
          createdBy: 'ADMIN_01',
          createdByName: 'Trần Thị Thu (Thủ kho)',
          items: [
            { equipmentId: 'EQ001', brand: 'Longi Solar', model: 'LR5-72HPH 550W', type: 'panel', quantity: 30, unitPrice: 2100000, unit: 'Tấm' }
          ]
        },
        {
          id: 'PN000234',
          type: 'import',
          date: new Date(Date.now() - 3600000 * 24 * 4).toISOString().split('T')[0],
          createdAt: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
          partnerId: 'SUP002',
          partnerName: 'Growatt Việt Nam',
          totalValue: 92500000, // 5 * 18.5M
          paidAmount: 92500000,
          debtAmount: 0,
          note: 'Nhập inverter Growatt 10kWp chính hãng',
          createdBy: 'ADMIN_01',
          createdByName: 'Trần Thị Thu (Thủ kho)',
          items: [
            { equipmentId: 'EQ003', brand: 'Growatt', model: 'MOD 10KTL3-X', type: 'inverter', quantity: 5, unitPrice: 18500000, unit: 'Bộ' }
          ]
        },
        {
          id: 'PX000124',
          type: 'export',
          date: new Date(Date.now() - 3600000 * 24 * 1).toISOString().split('T')[0],
          createdAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
          partnerId: 'PRJ002',
          partnerName: 'Biệt Thự Vinhomes Riverside (Anh Sơn)',
          totalValue: 147200000, // 24*2.05 + 1*42 + 2*28
          note: 'Xuất kho thiết bị chính thi công lắp đặt dự án Vinhomes Riverside',
          createdBy: 'ADMIN_01',
          createdByName: 'Trần Thị Thu (Thủ kho)',
          items: [
            { equipmentId: 'EQ002', brand: 'Jinko Solar', model: 'Tiger Pro 545W', type: 'panel', quantity: 24, unitPrice: 2050000, unit: 'Tấm' },
            { equipmentId: 'EQ004', brand: 'Deye', model: 'SUN-12K-SG04LP3-EU', type: 'inverter', quantity: 1, unitPrice: 42000000, unit: 'Bộ' },
            { equipmentId: 'EQ005', brand: 'Gigabox', model: 'Gigabox 5S 48V 100Ah', type: 'battery', quantity: 2, unitPrice: 28000000, unit: 'Quả' }
          ]
        }
      ];

      for (const tx of sampleTransactions) {
        await setDoc(doc(db, 'inventory_transactions', tx.id), tx);
      }
    }
  } catch (error) {
    console.error('Error seeding warehouse data:', error);
  }
}
