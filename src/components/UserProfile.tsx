import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, User } from 'firebase/auth';
import { 
  User as UserIcon, Keyboard, Save, ShieldAlert, Phone, MapPin, 
  Check, AlertCircle, Eye, EyeOff, KeyRound, Mail, UserCheck 
} from 'lucide-react';
import { cn } from '../lib/utils';

interface UserProfileProps {
  userId: string;
  user: User;
}

export default function UserProfile({ userId, user }: UserProfileProps) {
  // Profile Details State
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('sales_rep');

  // Status & UI States
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Update State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [requiresReauth, setRequiresReauth] = useState(false);
  
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Fetch current user details from Firestore
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const docRef = doc(db, 'users', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDisplayName(data.displayName || '');
          setPhone(data.phone || '');
          setRegion(data.region || '');
          setUsername(data.username || '');
          setEmail(data.email || user.email || '');
          setRole(data.role || 'sales_rep');
        }
      } catch (err) {
        console.error("Error fetching user profile:", err);
        setProfileError("Không thể tải thông tin cá nhân từ hệ thống.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, user.email]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      const docRef = doc(db, 'users', userId);
      await updateDoc(docRef, {
        displayName: displayName.trim(),
        phone: phone.trim(),
        region: region.trim(),
        updatedAt: serverTimestamp()
      });
      
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      console.error("Profile update error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
      setProfileError("Không thể lưu thông tin cá nhân. Vui lòng kiểm tra lại dữ liệu.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword.length < 6) {
      setPasswordError("Mật khẩu mới phải có tối thiểu 6 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Xác nhận mật khẩu mới không trùng khớp.");
      return;
    }

    setUpdatingPassword(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Không thể thao tác. Người dùng chưa đăng nhập.");
      }

      // If user requires reauthentication first
      if (requiresReauth || currentUser.email?.endsWith('@truongsonsolar.local')) {
        if (!currentPassword) {
          setRequiresReauth(true);
          setPasswordError("Vui lòng cung cấp mật khẩu hiện tại để xác minh danh tính.");
          setUpdatingPassword(false);
          return;
        }

        const credential = EmailAuthProvider.credential(currentUser.email || '', currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        setRequiresReauth(false);
      }

      // Attempt simple update
      await updatePassword(currentUser, newPassword);
      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      setTimeout(() => setPasswordSuccess(false), 5000);
    } catch (err: any) {
      console.error("Password update error:", err);
      if (err.code === 'auth/requires-recent-login') {
        setRequiresReauth(true);
        setPasswordError("Để thực hiện đổi mật khẩu, vui lòng nhập mật khẩu cũ bên dưới để xác thực lại phiên làm việc.");
      } else if (err.code === 'auth/wrong-password') {
        setPasswordError("Mật khẩu cũ không chính xác. Vui lòng thử lại.");
      } else if (err.code === 'auth/weak-password') {
        setPasswordError("Mật khẩu mới quá yếu. Hãy chọn mật khẩu mạnh hơn.");
      } else {
        setPasswordError(err.message || "Không thể cập nhật mật khẩu.");
      }
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center uppercase font-black text-slate-400 animate-pulse">Đang tải thông tin cá nhân...</div>;
  }

  // Get Vietnamese role name representation
  const getRoleLabel = (roleName: string) => {
    switch (roleName) {
      case 'admin': return 'Quản trị viên (Admin)';
      case 'manager': return 'Quản lý kinh doanh (Manager)';
      case 'operator': return 'Cán bộ kỹ thuật';
      default: return 'Nhân viên kinh doanh (Sales Rep)';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Upper header */}
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Thông tin cá nhân</h2>
        <p className="text-slate-500 font-medium">Quản lý hồ sơ công vụ và bảo mật tài khoản của bạn</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Profile Details (Left Panel) */}
        <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <UserIcon className="h-4.5 w-4.5 text-blue-500" />
              Hồ sơ thành viên
            </p>
            {profileSuccess && (
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-bounce">
                <Check className="h-3.5 w-3.5" />
                Đã cập nhật
              </span>
            )}
          </div>

          {profileError && (
            <div className="bg-rose-50 border border-rose-100 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-600 font-extrabold">{profileError}</p>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Username (Disabled) */}
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 mb-2 ml-1">Tên đăng nhập (Username)</label>
                <div className="w-full bg-slate-50 border border-slate-200 text-slate-500 rounded-2xl px-5 py-4 text-sm font-bold select-none cursor-not-allowed">
                  {username}
                </div>
              </div>

              {/* Email (Disabled) */}
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 mb-2 ml-1">Địa chỉ Email</label>
                <div className="w-full bg-slate-50 border border-slate-200 text-slate-500 rounded-2xl px-5 py-4 text-sm font-bold select-none cursor-not-allowed flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="truncate">{email}</span>
                </div>
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Vai trò / Quyền hạn (Disabled) */}
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-400 mb-2 ml-1">Quyền hạn hệ thống</label>
                <div className="w-full bg-slate-50 border border-slate-200 text-slate-500 rounded-2xl px-5 py-4 text-sm font-extrabold select-none cursor-not-allowed flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-slate-400" />
                  <span className="text-blue-600 uppercase text-xs font-black">{getRoleLabel(role)}</span>
                </div>
              </div>

              {/* Tên hiển thị */}
              <div>
                <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 ml-1">Họ và Tên</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-900 font-bold outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  placeholder="Nhập họ và tên..."
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  required
                />
              </div>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Điện thoại */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] uppercase font-black text-slate-500 mb-2 ml-1">
                  <Phone className="h-3 w-3 text-slate-400" />
                  Số điện thoại
                </label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-900 font-bold outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  placeholder="Nhập số điện thoại..."
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>

              {/* Khu vực công tác */}
              <div>
                <label className="flex items-center gap-1.5 text-[10px] uppercase font-black text-slate-500 mb-2 ml-1">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  Khu vực công tác
                </label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-900 font-bold outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  placeholder="Ví dụ: Thanh Hóa, Nghệ An..."
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                />
              </div>

            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button 
                type="submit"
                disabled={savingProfile}
                className={cn(
                  "flex items-center gap-2.5 px-6 py-3.5 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md hover:bg-slate-800 active:scale-95 disabled:opacity-50"
                )}
              >
                <Save className="h-4 w-4" />
                {savingProfile ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            </div>
          </form>
        </div>

        {/* Password Security (Right Panel) */}
        <div className="lg:col-span-5 bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <KeyRound className="h-4.5 w-4.5 text-amber-500" />
              Mật khẩu bảo mật
            </p>
            {passwordSuccess && (
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1 animate-bounce">
                <Check className="h-3 w-3" />
                Thành công
              </span>
            )}
          </div>

          {passwordError && (
            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-2.5">
              <ShieldAlert className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-amber-700 font-bold leading-relaxed">{passwordError}</p>
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-5">
            
            {/* Input for Current Password if verification required */}
            {(requiresReauth || user.email?.endsWith('@truongsonsolar.local')) && (
              <div className="bg-amber-100/30 p-4 rounded-2xl border border-amber-200/50 space-y-3">
                <label className="block text-[9px] uppercase font-black text-amber-800 tracking-wider">Mật khẩu hiện tại (Cũ)</label>
                <div className="relative">
                  <input 
                    type={showCurrentPass ? "text" : "password"} 
                    className="w-full bg-white border border-amber-200 rounded-xl pl-4 pr-10 py-3 text-xs text-slate-900 font-mono outline-none focus:border-amber-500 transition-colors"
                    placeholder="Nhập mật khẩu hiện tại..."
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Mật khẩu mới */}
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 ml-1">Mật khẩu mới</label>
              <div className="relative">
                <input 
                  type={showNewPass ? "text" : "password"}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-900 font-mono outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  placeholder="Từ 6 ký tự trở lên..."
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showNewPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Nhập lại mật khẩu mới */}
            <div>
              <label className="block text-[10px] uppercase font-black text-slate-500 mb-2 ml-1">Xác nhận mật khẩu mới</label>
              <div className="relative">
                <input 
                  type={showConfirmPass ? "text" : "password"}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-900 font-mono outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
                  placeholder="Nhập lại mật khẩu mới..."
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button 
                type="submit"
                disabled={updatingPassword}
                className={cn(
                  "flex items-center gap-2.5 px-6 py-3.5 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all shadow-md hover:bg-blue-700 active:scale-95 disabled:opacity-50"
                )}
              >
                <Keyboard className="h-4 w-4" />
                {updatingPassword ? 'Đang đổi...' : 'Cập nhật mật khẩu'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
