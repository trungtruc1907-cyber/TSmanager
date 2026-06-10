import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK using ES import syntax
if (!getApps().length) {
  try {
    initializeApp({
      projectId: "gen-lang-client-0349240272"
    });
    console.log("Firebase Admin initialized successfully (Modular SDK).");
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Reset another user's password (Admin/Manager only)
  app.post('/api/admin/reset-password', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Yêu cầu cung cấp Token xác thực." });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const { targetUserId, newPassword } = req.body;

    if (!targetUserId || !newPassword) {
      return res.status(400).json({ error: "Thiếu mã tài khoản hoặc mật khẩu mới." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Mật khẩu mới phải có tối thiểu 6 ký tự." });
    }

    try {
      const authAdmin = getAuth();
      const firestoreAdmin = getFirestore("ai-studio-b2d8e0e9-52cd-42ef-bb50-f9a1cebfcf8b");

      // Verify user's ID token through Firebase Admin auth
      const decodedToken = await authAdmin.verifyIdToken(idToken);
      const adminUid = decodedToken.uid;

      // Double-check authorization inside Firestore to ensure they are admin/manager
      const userRef = firestoreAdmin.collection('users').doc(adminUid);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return res.status(403).json({ error: "Tài khoản quản trị không tồn tại trên hệ thống dữ liệu." });
      }

      const adminData = userSnap.data();
      const role = adminData?.role;
      const status = adminData?.status;

      if (status !== 'active' || (role !== 'admin' && role !== 'manager')) {
        return res.status(403).json({ error: "Tài khoản của bạn không có quyền thực hiện chức năng này." });
      }

      // Reset the password in Firebase Auth using Admin SDK
      await authAdmin.updateUser(targetUserId, { password: newPassword });

      console.log(`[PASS_RESET] Admin/Manager "${adminData?.username || adminUid}" reset password for UID: ${targetUserId}`);
      return res.json({ success: true, message: "Cấp lại mật khẩu thành công." });
    } catch (err: any) {
      console.error("[PASS_RESET] Exception occurred:", err);
      return res.status(500).json({ error: err.message || "Lỗi máy chủ khi cập nhật mật khẩu." });
    }
  });

  // Standard health check route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Vite development / production middleware integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
