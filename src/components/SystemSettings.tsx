import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Save, Upload, Link, Building, MapPin, Phone, Globe, Image as ImageIcon, AlertCircle, Zap, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

interface SystemSettingsProps {
  userId: string;
}

export default function SystemSettings({ userId }: SystemSettingsProps) {
  const [logoUrl, setLogoUrl] = useState('');
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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'general'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLogoUrl(data.logoUrl || '');
          setCompanyName(data.companyName || '');
          setCompanyBrandName(data.companyBrandName || 'TRƯỜNG SƠN SOLAR');
          setCompanyTagline(data.companyTagline || 'Giải pháp Năng lượng Xanh chuyên nghiệp');
          setAddress(data.address || '');
          setPhone(data.phone || '');
          setWebsite(data.website || '');
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await setDoc(doc(db, 'settings', 'general'), {
        logoUrl,
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // Approx 800KB limit for base64 in Firestore document
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

  if (loading) return <div className="p-8 text-center uppercase font-black text-slate-400 animate-pulse">Đang tải cấu hình hệ thống...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Cấu hình hệ thống</h2>
          <p className="text-slate-500 font-medium">Thiết lập thông tin công ty và nhận diện thương hiệu</p>
        </div>
        
        {success && (
          <div className="bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
            Đã lưu cấu hình thành công!
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                  "flex items-center gap-3 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-95",
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
    </div>
  );
}
