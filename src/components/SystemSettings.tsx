import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, writeBatch } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { 
  Save, 
  Upload, 
  Link, 
  Building, 
  MapPin, 
  Phone, 
  Globe, 
  Image as ImageIcon, 
  AlertCircle, 
  Zap, 
  FileText, 
  Trash2, 
  CheckCircle2, 
  Cloud, 
  Plus, 
  HardDrive,
  Database,
  RefreshCw,
  RotateCcw
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SystemSettingsProps {
  userId: string;
}

interface LinkedDriveAccount {
  email: string;
  displayName: string;
  photoURL: string;
  token: string;
  connectedAt: string;
}

export default function SystemSettings({ userId }: SystemSettingsProps) {
  // General Corporate Settings State
  const [logoUrl, setLogoUrl] = useState('');
  const [printHeaderUrl, setPrintHeaderUrl] = useState('');
  const [companyName, setCompanyName] = useState('CÔNG TY CỔ PHẦN ĐẦU TƯ TM TRƯỜNG SƠN');
  const [companyBrandName, setCompanyBrandName] = useState('TRƯỜNG SƠN SOLAR');
  const [companyTagline, setCompanyTagline] = useState('Giải pháp Năng lượng Xanh chuyên nghiệp');
  const [address, setAddress] = useState('Số 151 Thôi Hữu, MB 1413, P. Đông Vệ, TP. Thanh Hóa');
  const [phone, setPhone] = useState('0912.345.678');
  const [website, setWebsite] = useState('www.truongsonsolar.vn');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Google Drive Integration State
  const [driveAccounts, setDriveAccounts] = useState<LinkedDriveAccount[]>([]);
  const [activeEmail, setActiveEmail] = useState<string | null>(null);
  const [driveLoading, setDriveLoading] = useState(true);

  // Fetch corporate & Google Drive settings on mount
  useEffect(() => {
    const fetchGeneralSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'general'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLogoUrl(data.logoUrl || '');
          setPrintHeaderUrl(data.printHeaderUrl || '');
          setCompanyName(data.companyName || '');
          setCompanyBrandName(data.companyBrandName || 'TRƯỜNG SƠN SOLAR');
          setCompanyTagline(data.companyTagline || 'Giải pháp Năng lượng Xanh chuyên nghiệp');
          setAddress(data.address || '');
          setPhone(data.phone || '');
          setWebsite(data.website || '');
        }
      } catch (err: any) {
        const isOffline = err instanceof Error && (
          err.message.toLowerCase().includes('offline') ||
          err.message.toLowerCase().includes('failed to get document')
        );
        if (isOffline) {
          console.warn("Settings fetching is currently operating in offline mode or has some network limitations.");
        } else {
          console.warn("Setting load warning:", err);
        }
      } finally {
        setLoading(false);
      }
    };

    const fetchDriveSettings = async () => {
      try {
        const docRef = doc(db, 'settings', `drive_${userId}`);
        const snap = await getDoc(docRef);
        let accounts: LinkedDriveAccount[] = [];
        let activeMail: string | null = null;

        if (snap.exists()) {
          const data = snap.data();
          accounts = data.accounts || [];
          activeMail = data.activeEmail || null;
        }

        // Migrate local storage credentials if Firestore is empty
        const localUserStr = localStorage.getItem('gdrive_crm_user');
        const localToken = localStorage.getItem('gdrive_crm_token');
        
        if (accounts.length === 0 && localUserStr && localToken) {
          try {
            const u = JSON.parse(localUserStr);
            const migratedAccount: LinkedDriveAccount = {
              email: u.email || '',
              displayName: u.displayName || '',
              photoURL: '',
              token: localToken,
              connectedAt: new Date().toLocaleDateString('vi-VN')
            };
            accounts = [migratedAccount];
            activeMail = migratedAccount.email;

            // Persist migrated config to Firestore
            await setDoc(docRef, {
              accounts,
              activeEmail: activeMail,
              updatedAt: serverTimestamp()
            });
          } catch (e) {
            console.error('Error migrating local Google Drive configurations:', e);
          }
        }

        setDriveAccounts(accounts);
        setActiveEmail(activeMail);
      } catch (err) {
        console.warn('Error fetching Google Drive accounts list:', err);
      } finally {
        setDriveLoading(false);
      }
    };

    fetchGeneralSettings();
    if (userId) {
      fetchDriveSettings();
    } else {
      setDriveLoading(false);
    }
  }, [userId]);

  // General configuration form submit handler
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await setDoc(doc(db, 'settings', 'general'), {
        logoUrl,
        printHeaderUrl,
        companyName,
        companyBrandName,
        companyTagline,
        address,
        phone,
        website,
        updatedAt: serverTimestamp()
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/general');
      setError("Không thể lưu cấu hình. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  // Google popup OAuth login flow to ADD/LINK a Google Drive account
  const handleAddNewDriveAccount = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/drive');
    provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
    provider.addScope('https://www.googleapis.com/auth/userinfo.email');

    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (!credential?.accessToken) {
        throw new Error('Không nhận được Access Token từ Google OAuth.');
      }

      const email = result.user.email || '';
      const displayName = result.user.displayName || result.user.email?.split('@')[0] || 'Unknown User';
      const photoURL = result.user.photoURL || '';
      const token = credential.accessToken;
      const connectedAt = new Date().toLocaleDateString('vi-VN');

      const newAccount: LinkedDriveAccount = {
        email,
        displayName,
        photoURL,
        token,
        connectedAt
      };

      // Add to list, update key if already existing
      const updatedAccounts = [...driveAccounts];
      const existingIdx = updatedAccounts.findIndex(acc => acc.email === email);
      if (existingIdx >= 0) {
        updatedAccounts[existingIdx] = newAccount;
      } else {
        updatedAccounts.push(newAccount);
      }

      // Automatically set as active storage account
      const nextActiveEmail = email;

      // Update Firestore
      const docRef = doc(db, 'settings', `drive_${userId}`);
      await setDoc(docRef, {
        accounts: updatedAccounts,
        activeEmail: nextActiveEmail,
        updatedAt: serverTimestamp()
      });

      // Update Local State
      setDriveAccounts(updatedAccounts);
      setActiveEmail(nextActiveEmail);

      // Save to localStorage for deep app compatibility
      localStorage.setItem('gdrive_crm_token', token);
      localStorage.setItem('gdrive_crm_user', JSON.stringify({ displayName, email }));
      localStorage.removeItem('gdrive_crm_folder_id'); // Clear folder ID cache to recreate folder on new drive

      alert(`Đã hoàn tất kết nối & kích hoạt tài khoản Google Drive: ${email}`);
    } catch (err: any) {
      console.error('Error linking Google Drive account:', err);
      alert('Kết nối Google Drive thất bại: ' + (err.message || err.code || ''));
    }
  };

  // Activate an existing Google Drive account in the list as the primary storage
  const handleSetActiveAccount = async (account: LinkedDriveAccount) => {
    try {
      const docRef = doc(db, 'settings', `drive_${userId}`);
      await setDoc(docRef, {
        accounts: driveAccounts,
        activeEmail: account.email,
        updatedAt: serverTimestamp()
      });

      setActiveEmail(account.email);

      // Sync to localStorage
      localStorage.setItem('gdrive_crm_token', account.token);
      localStorage.setItem('gdrive_crm_user', JSON.stringify({ displayName: account.displayName, email: account.email }));
      localStorage.removeItem('gdrive_crm_folder_id'); // Clear folder ID cache so it searches in the new drive

      alert(`Đã đổi kho lưu trữ mặc định sang tài khoản: ${account.email}`);
    } catch (err: any) {
      console.error('Error activating drive account:', err);
      alert('Không thể đặt tài khoản làm mặc định: ' + err.message);
    }
  };

  // Unlink/remove a Google Drive account connection
  const handleRemoveAccount = async (email: string) => {
    if (!confirm(`Bạn có chắc chắn muốn ngắt kết nối tài khoản Google Drive: ${email}? Các tệp đã tải sẽ không bị xóa, nhưng bạn tạm thời sẽ không thể thao tác tải lên drive này.`)) {
      return;
    }

    try {
      const updatedAccounts = driveAccounts.filter(acc => acc.email !== email);
      let nextActiveEmail = activeEmail;

      if (activeEmail === email) {
        nextActiveEmail = updatedAccounts.length > 0 ? updatedAccounts[0].email : null;
      }

      // Update Firestore
      const docRef = doc(db, 'settings', `drive_${userId}`);
      await setDoc(docRef, {
        accounts: updatedAccounts,
        activeEmail: nextActiveEmail,
        updatedAt: serverTimestamp()
      });

      setDriveAccounts(updatedAccounts);
      setActiveEmail(nextActiveEmail);

      // Update localStorage sync state
      if (nextActiveEmail) {
        const activeAcc = updatedAccounts.find(acc => acc.email === nextActiveEmail);
        if (activeAcc) {
          localStorage.setItem('gdrive_crm_token', activeAcc.token);
          localStorage.setItem('gdrive_crm_user', JSON.stringify({ displayName: activeAcc.displayName, email: activeAcc.email }));
        }
      } else {
        localStorage.removeItem('gdrive_crm_token');
        localStorage.removeItem('gdrive_crm_user');
      }
      localStorage.removeItem('gdrive_crm_folder_id');

      alert(`Đã ngắt kết nối Google Drive đối với tài khoản: ${email}`);
    } catch (err: any) {
      console.error('Error disconnecting drive account:', err);
      alert('Lỗi ngắt kết nối: ' + err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // Limit for Base64 document
      setError("Kích thước ảnh quá lớn (giới hạn 800KB). Vui lòng nén ảnh hoặc dùng URL.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoUrl(reader.result as string);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // Warehouse Data Administration States and Handlers
  const [clearingWarehouse, setClearingWarehouse] = useState(false);
  const [restoringWarehouse, setRestoringWarehouse] = useState(false);

  const handleClearWarehouseData = async () => {
    const isConfirmed = window.confirm(
      "CẢNH BÁO: Bạn đang thực hiện xóa TOÀN BỘ dữ liệu của module Quản lý kho!\n\n" +
      "Hành động này sẽ xóa vĩnh viễn tất cả:\n" +
      "- Danh mục Thiết bị & Vật tư tồn kho (equipment)\n" +
      "- Danh sách Nhà cung cấp & Công nợ (suppliers)\n" +
      "- Toàn bộ các đề xuất vật tư kỹ thuật (material_requests)\n" +
      "- Các đề xuất mua hàng (purchase_proposals)\n" +
      "- Tất cả hóa đơn/phiếu Nhập kho & Xuất kho (inventory_transactions)\n" +
      "- Khách hàng thương mại và công nợ liên quan (commercial customers)\n\n" +
      "Bạn có chắc chắn muốn tiếp tục?"
    );
    if (!isConfirmed) return;

    const isDoubleConfirmed = window.confirm(
      "XÁC NHẬN LẦN CUỐI: Thao tác này KHÔNG THỂ HOÀN TÁC. Bạn có chắc chắn muốn xóa sạch dữ liệu Kho?"
    );
    if (!isDoubleConfirmed) return;

    setClearingWarehouse(true);
    try {
      const collectionsToClear = [
        'equipment',
        'suppliers',
        'material_requests',
        'purchase_proposals',
        'inventory_transactions'
      ];

      for (const colName of collectionsToClear) {
        const snap = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        snap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      // Clear commercial customers
      const custSnap = await getDocs(collection(db, 'customers'));
      const custBatch = writeBatch(db);
      let deletedCustCount = 0;
      custSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.customerType === 'commercial') {
          custBatch.delete(doc.ref);
          deletedCustCount++;
        }
      });
      if (deletedCustCount > 0) {
        await custBatch.commit();
      }

      // Save a configuration flag so that it does not auto-seed on reload
      await setDoc(doc(db, 'settings', 'warehouse'), {
        cleared: true,
        seeded: false,
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert("Đã xóa toàn bộ dữ liệu module Quản lý kho thành công!");
    } catch (err) {
      console.error("Lỗi khi xóa dữ liệu kho:", err);
      alert("Xóa dữ liệu thất bại: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setClearingWarehouse(false);
    }
  };

  const handleRestoreWarehouseData = async () => {
    const isConfirmed = window.confirm(
      "Bạn có chắc chắn muốn nạp lại dữ liệu mẫu cho module Quản lý kho?\n\n" +
      "Thao tác này sẽ xóa dữ liệu kho hiện tại (nếu có) và khôi phục lại bộ dữ liệu mẫu mặc định ban đầu."
    );
    if (!isConfirmed) return;

    setRestoringWarehouse(true);
    try {
      // First, clear existing
      const collectionsToClear = [
        'equipment',
        'suppliers',
        'material_requests',
        'purchase_proposals',
        'inventory_transactions'
      ];

      for (const colName of collectionsToClear) {
        const snap = await getDocs(collection(db, colName));
        const batch = writeBatch(db);
        snap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      // Clear commercial customers
      const custSnap = await getDocs(collection(db, 'customers'));
      const custBatch = writeBatch(db);
      let deletedCustCount = 0;
      custSnap.docs.forEach((doc) => {
        const data = doc.data();
        if (data.customerType === 'commercial') {
          custBatch.delete(doc.ref);
          deletedCustCount++;
        }
      });
      if (deletedCustCount > 0) {
        await custBatch.commit();
      }

      // Mark cleared as false, so the app can seed it or we seed it directly here
      await setDoc(doc(db, 'settings', 'warehouse'), {
        cleared: false,
        seeded: true,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Import seed function dynamically
      const { seedWarehouseData } = await import('./warehouse/seedData');
      await seedWarehouseData(db);

      alert("Đã khôi phục dữ liệu mẫu thành công!");
    } catch (err) {
      console.error("Lỗi khi khôi phục dữ liệu kho:", err);
      alert("Khôi phục thất bại: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRestoringWarehouse(false);
    }
  };

  if (loading) return <div className="p-8 text-center uppercase font-black text-slate-400 animate-pulse">Đang tải cấu hình hệ thống...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Cấu hình hệ thống</h2>
          <p className="text-slate-500 font-medium">Thiết lập thông tin công ty, nhận diện thương hiệu và kho lưu trữ điện toán đám mây</p>
        </div>
        
        {success && (
          <div className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
            Đã lưu cấu hình thành công!
          </div>
        )}
      </div>

      <form onSubmit={handleSaveGeneral} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Logo ứng dụng</p>
            
            <div className="aspect-square w-full max-w-[200px] mx-auto bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center relative group overflow-hidden mb-6">
              {logoUrl ? (
                <>
                  <img src={logoUrl} alt="Preview" className="w-full h-full object-contain p-4" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="bg-white text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-transform hover:scale-105"
                    >
                      Xóa ảnh
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center p-6">
                  <ImageIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-tight">Chưa có logo</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="sr-only">Chọn tệp</span>
                <div className="relative group">
                  <div className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest cursor-pointer transition-all hover:bg-slate-800 active:scale-95 shadow-lg shadow-slate-900/10">
                    <Upload className="h-4 w-4" />
                    Tải ảnh lên
                  </div>
                  <input 
                    type="file" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    onChange={handleFileUpload} 
                    accept="image/*"
                  />
                </div>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Link className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <input 
                  type="text" 
                  placeholder="Hoặc nhập URL logo..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-xs text-slate-900 outline-none focus:border-blue-500 transition-colors"
                  value={logoUrl}
                  onChange={e => setLogoUrl(e.target.value)}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl border border-red-100 mt-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-600 font-bold leading-tight">{error}</p>
                </div>
              )}

              <p className="text-[9px] text-slate-400 font-medium italic text-center">
                * Logo này sẽ xuất hiện trên Website và các Báo giá/Hợp đồng kỹ thuật.
              </p>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Ảnh Header Bản In (Các Phiếu)</p>
            
            <div className="aspect-[16/5] w-full bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center relative group overflow-hidden mb-6">
              {printHeaderUrl ? (
                <>
                  <img src={printHeaderUrl} alt="Print Header Preview" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button 
                      type="button"
                      onClick={() => setPrintHeaderUrl('')}
                      className="bg-white text-red-500 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-transform hover:scale-105"
                    >
                      Xóa ảnh
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center p-4">
                  <ImageIcon className="h-8 w-8 text-slate-300 mx-auto mb-1" />
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-tight">Chưa có ảnh banner</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Link className="h-3.5 w-3.5 text-slate-400" />
                </div>
                <input 
                  type="text" 
                  placeholder="Nhập URL ảnh banner bản in..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-3 text-xs text-slate-900 outline-none focus:border-blue-500 transition-colors"
                  value={printHeaderUrl}
                  onChange={e => setPrintHeaderUrl(e.target.value)}
                />
              </div>

              <p className="text-[9px] text-slate-400 font-medium italic text-center">
                * Dùng cho phiếu yêu cầu vật tư và đề nghị mua hàng. Nếu bỏ trống, hệ thống sẽ dùng giao diện mặc định cực kỳ đẹp mắt.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-100 pb-4">Thông tin doanh nghiệp</p>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-500 mb-2 ml-1">
                    <Building className="h-3 w-3" />
                    Tên công ty (Đầy đủ)
                  </label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm text-slate-900 font-bold outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-500 mb-2 ml-1">
                    <Zap className="h-3 w-3" />
                    Tên thương hiệu (Ngắn)
                  </label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm text-slate-900 font-bold outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    value={companyBrandName}
                    onChange={e => setCompanyBrandName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-500 mb-2 ml-1">
                  <FileText className="h-3 w-3" />
                  Slogan / Tagline
                </label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm text-slate-900 font-bold outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  value={companyTagline}
                  onChange={e => setCompanyTagline(e.target.value)}
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-500 mb-2 ml-1">
                  <MapPin className="h-3 w-3" />
                  Địa chỉ văn phòng / Trụ sở
                </label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm text-slate-900 font-bold outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-500 mb-2 ml-1">
                    <Phone className="h-3 w-3" />
                    Số điện thoại liên hệ
                  </label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm text-slate-900 font-bold outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-[10px] uppercase font-black text-slate-500 mb-2 ml-1">
                    <Globe className="h-3 w-3" />
                    Website doanh nghiệp
                  </label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm text-slate-900 font-bold outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button 
                type="submit"
                disabled={saving}
                className={cn(
                  "flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-95 cursor-pointer",
                  saving ? "opacity-50 cursor-not-allowed" : "hover:bg-blue-700"
                )}
              >
                <Save className="h-5 w-5" />
                {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Google Drive Integration Panel */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-blue-500 via-yellow-400 to-green-500 p-3 rounded-2xl text-white shadow-md">
              <Cloud className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">KẾT NỐI ĐIỆN TOÁN ĐÁM MÂY</p>
              <h3 className="text-xl font-black text-slate-900 uppercase">Liên kết tài khoản lưu trữ Google Drive</h3>
            </div>
          </div>

          <button
            onClick={handleAddNewDriveAccount}
            type="button"
            className="flex items-center gap-2 px-5 py-3.5 bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-md hover:shadow-lg cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Liên kết tài khoản mới
          </button>
        </div>

        <p className="text-slate-600 text-sm leading-relaxed max-w-3xl">
          Tích hợp Google Drive để lưu trữ trực tiếp các tệp đính kèm (ảnh chụp thi công, văn bản khảo sát, hóa đơn, báo giá) trong luồng chăm sóc khách hàng. Các tệp tin được tải lên sẽ tự động tổ chức thư mục một cách có hệ thống, sẵn sàng đồng bộ hoá dữ liệu đám mây tiện lợi.
        </p>

        {driveLoading ? (
          <div className="p-8 text-center text-slate-400 uppercase font-black text-xs tracking-wider animate-pulse">
            Đang tải dữ liệu liên kết dịch vụ Google Drive...
          </div>
        ) : driveAccounts.length === 0 ? (
          <div className="p-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <HardDrive className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-700 font-bold text-sm">Chưa có tài khoản Google Drive nào được liên kết</p>
            <p className="text-slate-400 text-xs mt-1.5 max-w-md mx-auto">
              Bấm nút "Liên kết tài khoản mới" ở trên để kết nối không gian lưu trữ đám mây Google Drive cá nhân hoặc doanh nghiệp của bạn.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tài khoản đã liên kết ({driveAccounts.length})</p>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Thư mục tổ chức: 'Solar CRM Care Logs'</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {driveAccounts.map((account, index) => {
                const isActive = activeEmail === account.email;
                return (
                  <div 
                    key={account.email || `drive-${index}`} 
                    className={cn(
                      "p-5 rounded-2xl border transition-all flex items-start gap-4 shadow-sm relative group",
                      isActive 
                        ? "bg-emerald-50/40 border-emerald-500/30" 
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/30"
                    )}
                  >
                    {/* Status indicator pin */}
                    {isActive && (
                      <div className="absolute top-4 right-4 bg-emerald-500 text-white rounded-full p-1 shadow-sm">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </div>
                    )}

                    {/* Avatar Block */}
                    <div className="shrink-0">
                      {account.photoURL ? (
                        <img 
                          src={account.photoURL} 
                          alt={account.displayName} 
                          className="w-12 h-12 rounded-full border border-slate-100 object-cover shadow-inner"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-sm shadow-inner uppercase">
                          {account.displayName ? account.displayName.substring(0, 2) : 'GD'}
                        </div>
                      )}
                    </div>

                    {/* Informational Details */}
                    <div className="space-y-1 my-auto flex-1 min-w-0 pr-6">
                      <p className="font-extrabold text-slate-800 text-sm truncate">{account.displayName}</p>
                      <p className="text-slate-500 text-xs font-medium truncate">{account.email}</p>
                      <p className="text-[10px] text-slate-400 font-bold">Liên kết từ: {account.connectedAt || 'Không rõ'}</p>
                      
                      {/* Active Actions */}
                      <div className="flex items-center gap-3 pt-3">
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => handleSetActiveAccount(account)}
                            className="bg-slate-100 text-slate-800 hover:bg-blue-600 hover:text-white font-extrabold text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            Kích hoạt sử dụng
                          </button>
                        ) : (
                          <span className="text-emerald-700 font-extrabold text-[9px] uppercase tracking-widest bg-emerald-100/50 border border-emerald-200/50 px-2.5 py-1 rounded-lg">
                            Mặc định chính
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => handleRemoveAccount(account.email)}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ml-auto"
                          title="Hủy liên kết tài khoản này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hộp quản trị dữ liệu Module Kho */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2 text-rose-600">
                <Database className="h-5 w-5" />
                <h3 className="text-base font-black text-slate-800 tracking-tight uppercase">Quản trị dữ liệu Module Kho</h3>
              </div>
              <p className="text-slate-400 text-[10px] font-semibold mt-1">
                Các tính năng quản lý, xóa sạch hoặc khôi phục dữ liệu dùng thử cho Module Quản lý kho
              </p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={clearingWarehouse || restoringWarehouse}
                onClick={handleRestoreWarehouseData}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {restoringWarehouse ? "Đang khôi phục..." : "Nạp dữ liệu mẫu"}
              </button>

              <button
                type="button"
                disabled={clearingWarehouse || restoringWarehouse}
                onClick={handleClearWarehouseData}
                className="bg-red-500 hover:bg-red-600 text-white font-extrabold text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm shadow-red-200 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {clearingWarehouse ? "Đang xóa..." : "Xóa toàn bộ dữ liệu Kho"}
              </button>
            </div>
          </div>

          <div className="bg-red-50/50 border border-red-100 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-black text-red-800 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              Lưu ý quan trọng trước khi xóa dữ liệu
            </h4>
            <p className="text-slate-600 text-xs leading-relaxed">
              Hành động này sẽ xóa vĩnh viễn toàn bộ cơ sở dữ liệu liên quan đến Module Quản lý kho trong hệ thống Firestore.
              Dữ liệu của các phân hệ CRM khác như Lịch hẹn, Khách hàng lắp đặt chính, Chiến dịch và Công trình vẫn được giữ nguyên.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              <div className="bg-white border border-red-100/60 p-3 rounded-xl flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-slate-700 text-xs font-semibold">Mục vật tư & tồn kho (equipment)</span>
              </div>
              <div className="bg-white border border-red-100/60 p-3 rounded-xl flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-slate-700 text-xs font-semibold">Nhà cung cấp & công nợ (suppliers)</span>
              </div>
              <div className="bg-white border border-red-100/60 p-3 rounded-xl flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-slate-700 text-xs font-semibold">Giao dịch nhập/xuất (transactions)</span>
              </div>
              <div className="bg-white border border-red-100/60 p-3 rounded-xl flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-slate-700 text-xs font-semibold">Đề xuất mua hàng & Cấp phát</span>
              </div>
              <div className="bg-white border border-red-100/60 p-3 rounded-xl flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-slate-700 text-xs font-semibold">Khách hàng thương mại tự tạo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
