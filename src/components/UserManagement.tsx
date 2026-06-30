import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, setDoc, serverTimestamp, getFirestore } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUser, UserRole } from '../types';
import { 
  UserCog, 
  UserPlus, 
  Shield, 
  ShieldCheck, 
  User, 
  Search, 
  MoreVertical,
  CheckCircle2,
  XCircle,
  Mail,
  ShieldAlert,
  Settings,
  ClipboardList,
  Key,
  Calculator,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface UserManagementProps {
  userId?: string;
}

export default function UserManagement({ userId }: UserManagementProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'active' | 'inactive' | 'hidden'>('all');

  const [newUser, setNewUser] = useState({
    username: '',
    displayName: '',
    role: 'sales_rep' as UserRole,
    password: 'Truongson@' + Math.floor(1000 + Math.random() * 9000)
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // States for resetting password
  const [resettingUser, setResettingUser] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [iamDetails, setIamDetails] = useState<{ serviceAccount: string; projectId: string; instructions: string } | null>(null);

  const handleSendResetEmail = async () => {
    if (!resettingUser || !resettingUser.email) return;
    setIsSendingEmail(true);
    setResetError(null);
    setResetSuccess(null);
    try {
      await sendPasswordResetEmail(auth, resettingUser.email);
      setResetSuccess(`Đã gửi email khôi phục mật khẩu thành công đến "${resettingUser.email}". Hãy hướng dẫn nhân sự kiểm tra hộp thư.`);
      setNewPassword('');
    } catch (err: any) {
      console.error("Error sending reset email:", err);
      let msg = err.message || "Không thể gửi email khôi phục mật khẩu.";
      if (err.code === "auth/user-not-found") {
        msg = "Không tìm thấy người dùng với thuộc tính email này trên hệ thống Auth.";
      } else if (err.code === "auth/invalid-email") {
        msg = "Địa chỉ email của nhân sự không đúng định dạng.";
      }
      setResetError(msg);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !newPassword) return;

    setIsResetting(true);
    setResetError(null);
    setResetSuccess(null);
    setIamDetails(null);

    try {
      const currentAuthUser = auth.currentUser;
      if (!currentAuthUser) {
        throw new Error("Không thể lấy thông tin đăng nhập hiện tại của bạn.");
      }

      // Force refresh of current ID token
      const idToken = await currentAuthUser.getIdToken(true);

      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          targetUserId: resettingUser.id,
          newPassword: newPassword
        })
      });

      let result: any = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await response.json().catch(() => ({}));
      } else {
        const text = await response.text().catch(() => '');
        console.error("Non-JSON returned by password reset API:", text);
        throw new Error(text.includes('permission') || text.includes('IAM') || text.includes('403')
          ? "Thất bại: Lỗi phân quyền Service Account (IAM) trên Google Cloud / Firebase."
          : "Lỗi kết nối máy chủ không trả về định dạng JSON hợp lệ."
        );
      }

      if (!response.ok || result.success === false) {
        if (result.isIamError) {
          setIamDetails({
            serviceAccount: result.serviceAccount,
            projectId: result.projectId,
            instructions: result.instructions
          });
          throw new Error(result.error || "Lỗi phân quyền IAM dự án.");
        }
        throw new Error(result.error || "Không thể thực hiện cấp lại mật khẩu.");
      }

      setResetSuccess(`Cấp lại mật khẩu cho tài khoản "${resettingUser.username}" thành công.`);
      setNewPassword('');
      // Delay closing of modal for user feedback
      setTimeout(() => {
        setResettingUser(null);
        setResetSuccess(null);
        setIamDetails(null);
      }, 2000);
    } catch (err: any) {
      console.error("Reset password error:", err);
      setResetError(err.message || "Lỗi không xác định khi đổi mật khẩu.");
    } finally {
      setIsResetting(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) return;
    
    setIsSubmitting(true);
    setErrorMsg(null);
    
    // Create a unique internal email from username
    const cleanUsername = newUser.username.toLowerCase().trim();
    const internalEmail = `${cleanUsername}@truongsonsolar.local`;

    // 1. Check if username already exists in Firestore users collection
    const usernameExists = users.some(u => u.username === cleanUsername);
    if (usernameExists) {
      setErrorMsg("Tên đăng nhập này đã tồn tại trong hệ thống. Vui lòng chọn tên khác.");
      setIsSubmitting(false);
      return;
    }
    
    // Secondary Firebase app to create user without logging out current admin
    const tempAppName = `temp-user-creator-${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);
    const tempDb = getFirestore(tempApp, (firebaseConfig as any).firestoreDatabaseId);

    try {
      const userCredential = await createUserWithEmailAndPassword(tempAuth, internalEmail, newUser.password);
      const uid = userCredential.user.uid;
      
      // Create user document using the temporary app's context (authenticated as the new user)
      await setDoc(doc(tempDb, 'users', uid), {
        username: cleanUsername,
        displayName: newUser.displayName || newUser.username.toUpperCase(),
        email: internalEmail,
        role: newUser.role,
        status: 'active',
        createdAt: serverTimestamp()
      });

      // Cleanup
      await signOut(tempAuth);
      await deleteApp(tempApp);
      
      setIsAddingUser(false);
      setNewUser({
        username: '',
        displayName: '',
        role: 'sales_rep',
        password: 'Truongson@' + Math.floor(1000 + Math.random() * 9000)
      });
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.code === 'auth/email-already-in-use') {
        setErrorMsg("Tên đăng nhập này đã được sử dụng (trong Auth). Vui lòng thử lại với tên khác.");
      } else {
        setErrorMsg(error.message || "Không thể tạo tài khoản mới.");
      }
      // Cleanup on error
      try {
        await deleteApp(tempApp);
      } catch (ce) {}
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    const q = collection(db, 'users');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rawUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      rawUsers.sort((a, b) => {
        const t1 = a.createdAt ? (a.createdAt as any).seconds || 0 : 0;
        const t2 = b.createdAt ? (b.createdAt as any).seconds || 0 : 0;
        return t2 - t1;
      });
      setUsers(rawUsers);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return () => unsubscribe();
  }, [userId]);

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        role,
        updatedAt: serverTimestamp() 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleApprove = async (userId: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        status: 'active',
        role,
        updatedAt: serverTimestamp() 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleUpdateUser = async (userId: string, data: Partial<AppUser>) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        ...data,
        updatedAt: serverTimestamp() 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: string) => {
    try {
      await updateDoc(doc(db, 'users', userId), { 
        status: currentStatus === 'active' ? 'inactive' : 'active',
        updatedAt: serverTimestamp() 
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'hidden') return matchesSearch && u.isHidden === true;
    return matchesSearch && u.status === filterStatus;
  });

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return <ShieldAlert className="h-4 w-4 text-red-500" />;
      case 'manager': return <ShieldCheck className="h-4 w-4 text-blue-500" />;
      case 'operator': return <Settings className="h-4 w-4 text-amber-500" />;
      case 'accountant': return <Calculator className="h-4 w-4 text-emerald-500" />;
      default: return <Shield className="h-4 w-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-1 rounded-lg bg-green-50 text-green-600 text-[9px] font-black uppercase tracking-tighter inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Hoạt động
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-tighter inline-flex items-center gap-1">
            <ClipboardList className="h-3 w-3" /> Chờ duyệt
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-lg bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-tighter inline-flex items-center gap-1">
            <XCircle className="h-3 w-3" /> Khóa
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3 uppercase">
            <UserCog className="h-6 w-6 text-blue-600" />
            Quản lý Tài khoản
          </h1>
          <p className="text-xs text-slate-500 font-medium">Quản lý quyền truy cập, phê duyệt thành viên và gán vai trò.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button 
            onClick={() => setIsAddingUser(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-95"
          >
            <UserPlus className="h-4 w-4" /> Thêm nhân sự
          </button>
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Tìm username, tên..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-white border border-slate-200 rounded-xl p-1 shrink-0">
             {(['all', 'pending', 'active', 'hidden'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all",
                    filterStatus === s ? "bg-slate-900 text-white shadow-md" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  {s === 'all' ? 'Tất cả' : s === 'pending' ? 'Chờ duyệt' : s === 'active' ? 'Đã duyệt' : 'Bị ẩn'}
                </button>
             ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[10px] uppercase tracking-widest font-bold border-b border-slate-100">
                <th className="px-6 py-4">Người dùng</th>
                <th className="px-6 py-4">Thông tin liên hệ</th>
                <th className="px-6 py-4">Vai trò</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Truy cập cuối</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((user, index) => (
                <tr key={user.id || `user-${index}`} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600 font-black text-xs uppercase relative">
                        {user.username.substring(0, 2)}
                        {user.status === 'pending' && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white animate-bounce" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-800">{user.displayName || user.username}</div>
                        <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {user.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          placeholder="Số điện thoại"
                          defaultValue={user.phone}
                          onBlur={(e) => handleUpdateUser(user.id, { phone: e.target.value })}
                          className="text-[10px] font-black text-slate-700 bg-slate-50 hover:bg-white border border-transparent focus:border-blue-200 px-1.5 py-0.5 rounded outline-none transition-all w-24"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                         <input 
                          type="text"
                          placeholder="Khu vực"
                          defaultValue={user.region}
                          onBlur={(e) => handleUpdateUser(user.id, { region: e.target.value })}
                          className="text-[10px] font-bold text-slate-500 bg-transparent border border-transparent focus:border-blue-100 px-1.5 py-0.5 rounded outline-none transition-all w-24"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getRoleIcon(user.role)}
                      <select 
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                        className="text-[11px] font-bold text-slate-700 bg-transparent outline-none cursor-pointer uppercase tracking-tight"
                      >
                        <option value="admin">Quản trị viên</option>
                        <option value="manager">Quản lý</option>
                        <option value="sales_rep">Sale / Kinh doanh</option>
                        <option value="operator">Điều hành / KT</option>
                        <option value="accountant">Kế toán</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5 items-start">
                      {getStatusBadge(user.status)}
                      {user.isHidden && (
                        <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[9px] font-black uppercase tracking-tighter inline-flex items-center gap-1 shrink-0">
                          <EyeOff className="h-3 w-3" /> Bị ẩn
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[10px] text-slate-500 font-medium">
                      {user.lastLogin ? new Date(user.lastLogin.seconds * 1000).toLocaleString('vi-VN') : 'Chưa có'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="text-[10px] text-slate-400 font-medium mr-4 hidden md:block">
                        {user.lastLogin ? new Date(user.lastLogin.seconds * 1000).toLocaleDateString('vi-VN') : 'Chưa log'}
                      </div>
                      {user.status === 'pending' ? (
                        <>
                          <button 
                            onClick={() => handleApprove(user.id, user.role)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
                          >
                            <CheckCircle2 className="h-3 w-3" /> Duyệt
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              setResettingUser(user);
                              setNewPassword('TS@' + Math.floor(100000 + Math.random() * 900000));
                            }}
                            className="p-2 rounded-lg border border-slate-100 text-slate-500 hover:bg-slate-50 hover:border-blue-100 hover:text-blue-600 transition-all"
                            title="Cấu hình / Cấp lại mật khẩu"
                          >
                            <Key className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleUpdateUser(user.id, { isHidden: !user.isHidden })}
                            className={cn(
                              "p-2 rounded-lg border transition-all",
                              user.isHidden 
                                ? "border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100" 
                                : "border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                            )}
                            title={user.isHidden ? "Hiển thị nhân sự" : "Ẩn nhân sự khỏi toàn hệ thống"}
                          >
                            {user.isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                          <button 
                            onClick={() => handleToggleStatus(user.id, user.status)}
                            className={cn(
                              "p-2 rounded-lg border transition-all",
                              user.status === 'active' 
                                ? "border-red-100 text-red-500 hover:bg-red-50" 
                                : "border-green-100 text-green-500 hover:bg-green-50"
                            )}
                            title={user.status === 'active' ? "Khóa tài khoản" : "Mở khóa"}
                          >
                            {user.status === 'active' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 && !loading && (
            <div className="px-6 py-12 text-center text-slate-400">
               <User className="h-12 w-12 mx-auto mb-4 opacity-10" />
               <p className="text-sm font-medium italic uppercase tracking-widest">Không tìm thấy tài khoản phù hợp</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
          <div className="flex items-start gap-3">
             <ShieldAlert className="h-5 w-5 text-blue-600 mt-0.5" />
             <div>
                <p className="text-xs font-black text-blue-900 uppercase mb-1">Lưu ý bảo mật</p>
                <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                  Tất cả tài khoản đăng nhập bằng username sẽ được ánh xạ về email nội bộ. Các tài khoản mới được tạo cần được Quản trị viên kích hoạt và gán vai trò để truy cập các tính năng nâng cao.
                </p>
             </div>
          </div>
      </div>

      <AnimatePresence>
        <AddUserModal 
          isOpen={isAddingUser} 
          onClose={() => setIsAddingUser(false)} 
          onSubmit={handleAddUser}
          newUser={newUser}
          setNewUser={setNewUser}
          isSubmitting={isSubmitting}
          errorMsg={errorMsg}
        />

        {resettingUser && (
          <ResetPasswordModal
            isOpen={resettingUser !== null}
            onClose={() => {
              setResettingUser(null);
              setResetError(null);
              setResetSuccess(null);
              setIamDetails(null);
            }}
            onSubmit={handleResetPasswordSubmit}
            user={resettingUser}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            isSubmitting={isResetting}
            isSendingEmail={isSendingEmail}
            onSendResetEmail={handleSendResetEmail}
            errorMsg={resetError}
            successMsg={resetSuccess}
            iamDetails={iamDetails}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AddUserModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  newUser, 
  setNewUser, 
  isSubmitting, 
  errorMsg 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSubmit: (e: React.FormEvent) => void; 
  newUser: any; 
  setNewUser: any;
  isSubmitting: boolean;
  errorMsg: string | null;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 md:p-10 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Thêm nhân sự mới</h3>
            <UserPlus className="h-6 w-6 text-blue-600" />
          </div>

          {errorMsg && (
            <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-red-500" />
              <p className="text-xs font-bold text-red-600">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Tên đăng nhập (Username)</label>
              <input 
                required
                className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-600 transition-all shadow-inner"
                placeholder="VD: minh.nguyen"
                value={newUser.username}
                onChange={e => setNewUser({...newUser, username: e.target.value.toLowerCase().replace(/\s/g, '')})}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Tên hiển thị</label>
              <input 
                required
                className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-blue-600 transition-all shadow-inner"
                placeholder="VD: Nguyễn Văn Minh"
                value={newUser.displayName}
                onChange={e => setNewUser({...newUser, displayName: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Vai trò</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-100 px-4 py-4 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-blue-600 transition-all appearance-none"
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                >
                  <option value="sales_rep">Kinh doanh</option>
                  <option value="operator">Kỹ thuật</option>
                  <option value="accountant">Kế toán</option>
                  <option value="manager">Quản lý</option>
                  <option value="admin">Quản trị</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Mật khẩu mặc định</label>
                <input 
                  required
                  className="w-full bg-slate-50 border border-slate-100 px-4 py-4 rounded-2xl text-xs font-mono font-bold outline-none focus:bg-white focus:border-blue-600 transition-all shadow-inner"
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                disabled={isSubmitting}
              >
                Hủy
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 flex items-center justify-center"
              >
                {isSubmitting ? "Đang tạo..." : "Xác nhận"}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  user: AppUser;
  newPassword: string;
  setNewPassword: (val: string) => void;
  isSubmitting: boolean;
  isSendingEmail: boolean;
  onSendResetEmail: () => void;
  errorMsg: string | null;
  successMsg: string | null;
  iamDetails: { serviceAccount: string; projectId: string; instructions: string } | null;
}

function ResetPasswordModal({
  isOpen,
  onClose,
  onSubmit,
  user,
  newPassword,
  setNewPassword,
  isSubmitting,
  isSendingEmail,
  onSendResetEmail,
  errorMsg,
  successMsg,
  iamDetails
}: ResetPasswordModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-8 md:p-10 space-y-6 overflow-y-auto custom-sidebar-scrollbar flex-1">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Cấp lại Mật khẩu</h3>
              <p className="text-xs text-slate-500 font-bold mt-1">Xử lý tài khoản cho: {user.displayName || user.username}</p>
            </div>
            <Key className="h-6 w-6 text-blue-600 shrink-0" />
          </div>

          {errorMsg && (
            <div className="space-y-2.5">
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-3">
                <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                <p className="text-xs font-bold text-red-600">{errorMsg}</p>
              </div>
              <div className="p-3.5 bg-blue-50/70 border border-blue-100/50 rounded-2xl text-blue-800 text-[11px] font-semibold leading-relaxed">
                💡 <strong>Mẹo khôi phục nhanh:</strong> Bạn có thể sử dụng giải pháp thay thế đơn giản bằng cách bấm nút <strong>"Gửi Email đặt lại mật khẩu"</strong> ở bên dưới để gửi liên kết đặt lại mật khẩu trực tiếp cho nhân viên qua email, không cần phải cấu hình phân quyền Google Cloud phức tạp!
              </div>
            </div>
          )}

          {iamDetails && (
            <div className="p-5 bg-amber-50/70 rounded-2xl border border-amber-100 space-y-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-amber-800 uppercase tracking-wider">Cần Phân Quyền (IAM)</h4>
                  <p className="text-[11px] text-amber-700 font-medium leading-relaxed mt-1">
                    Hệ thống không thể kết nối trực tiếp với dự án của bạn để cập nhật cơ sở dữ liệu Auth do thiếu quyền. Hãy bổ sung quyền sau:
                  </p>
                </div>
              </div>

              <div className="space-y-4 bg-white p-4 rounded-xl border border-amber-100">
                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">BƯỚC 1: Mở trang quản trị IAM</p>
                  <a 
                    href={`https://console.cloud.google.com/iam-admin/iam?project=${iamDetails.projectId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-blue-600 font-bold hover:underline transition-all inline-flex items-center gap-1"
                  >
                    Bấm để mở trang IAM Google Cloud ↗
                  </a>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">BƯỚC 2: Sao chép Email Service Account</p>
                  <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 mt-1">
                    <code className="text-[10px] font-mono font-bold text-slate-700 break-all select-all flex-1 leading-tight">{iamDetails.serviceAccount}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(iamDetails.serviceAccount);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-[9px] font-black rounded-lg uppercase tracking-wider transition-all shadow-md shadow-blue-100 shrink-0"
                    >
                      {copied ? "Đã chép!" : "Sao chép"}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">BƯỚC 3: Nhấp "Grant Access" / "Thêm thành viên"</p>
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                    Dán Email vừa sao chép ở trên vào ô <strong>"New principals"</strong>, chọn vai trò (Role) là <strong>"Firebase Authentication Admin"</strong> (hoặc <strong>"Editor"</strong>) và lưu lại. Sau 1 phút, quay lại đây bấm thực hiện đổi mật khẩu.
                  </p>
                </div>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-green-50 rounded-2xl border border-green-100 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              <p className="text-xs font-bold text-green-600">{successMsg}</p>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Email tài khoản</label>
              <input 
                disabled
                className="w-full bg-slate-100 border border-transparent px-6 py-4 rounded-2xl text-sm text-slate-500 font-bold outline-none cursor-not-allowed"
                value={user.email}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mật khẩu mới trực tiếp</label>
                <button
                  type="button"
                  onClick={() => setNewPassword('TS@' + Math.floor(100000 + Math.random() * 900000))}
                  className="text-[10px] text-blue-600 font-bold uppercase tracking-wider hover:underline animate-pulse"
                >
                  Tạo mã ngẫu nhiên
                </button>
              </div>
              <input 
                required
                className="w-full bg-slate-50 border border-slate-100 px-6 py-4 rounded-2xl text-sm font-mono font-bold outline-none focus:bg-white focus:border-blue-600 transition-all shadow-inner"
                placeholder="Nhập tối thiểu 6 ký tự"
                type="text"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-5 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer"
                  disabled={isSubmitting || isSendingEmail}
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting || isSendingEmail || !!successMsg}
                  className="flex-1 px-5 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 disabled:opacity-50 flex items-center justify-center cursor-pointer"
                >
                  {isSubmitting ? "Đang xử lý..." : "Đổi trực tiếp"}
                </button>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-100"></div>
                <span className="flex-shrink mx-4 text-[9px] font-black uppercase tracking-widest text-slate-400 select-none">Hoặc</span>
                <div className="flex-grow border-t border-slate-100"></div>
              </div>

              <button
                type="button"
                onClick={onSendResetEmail}
                disabled={isSubmitting || isSendingEmail || !!successMsg}
                className="w-full py-4 px-6 bg-slate-50 border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mail className="h-4 w-4 text-blue-500" /> {isSendingEmail ? "Đang gửi email..." : "Gửi Email đặt lại mật khẩu"}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
