import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
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
  ShieldAlert
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function UserManagement() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return () => unsubscribe();
  }, []);

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

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return <ShieldAlert className="h-4 w-4 text-red-500" />;
      case 'manager': return <ShieldCheck className="h-4 w-4 text-blue-500" />;
      default: return <Shield className="h-4 w-4 text-slate-400" />;
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
          <p className="text-xs text-slate-500 font-medium">Quản lý quyền truy cập và vai trò người dùng trong hệ thống.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
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
          <button 
            disabled
            title="Sử dụng màn hình đăng nhập để tạo user mới"
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-400 rounded-xl text-sm font-bold uppercase cursor-not-allowed border border-slate-200"
          >
            <UserPlus className="h-4 w-4" /> Thêm
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[10px] uppercase tracking-widest font-bold border-b border-slate-100">
                <th className="px-6 py-4">Người dùng</th>
                <th className="px-6 py-4">Vai trò</th>
                <th className="px-6 py-4">Trạng thái</th>
                <th className="px-6 py-4">Truy cập cuối</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600 font-black text-xs uppercase">
                        {user.username.substring(0, 2)}
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
                    <div className="flex items-center gap-2">
                      {getRoleIcon(user.role)}
                      <select 
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value as UserRole)}
                        className="text-[11px] font-bold text-slate-700 bg-transparent outline-none cursor-pointer uppercase tracking-tight"
                      >
                        <option value="admin">Quản trị viên</option>
                        <option value="manager">Quản lý</option>
                        <option value="sales_rep">Kinh doanh</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter inline-flex items-center gap-1",
                      user.status === 'active' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                    )}>
                      {user.status === 'active' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                      {user.status === 'active' ? 'Hoạt động' : 'Khóa'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-[10px] text-slate-500 font-medium">
                      {user.lastLogin ? new Date(user.lastLogin.seconds * 1000).toLocaleString('vi-VN') : 'Chưa có'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
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
    </div>
  );
}
