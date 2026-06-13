import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Instruct Google APIs / Firebase Admin SDK to charge quota and API enablement check to target Project ID,
// avoiding the identitytoolkit API omission error on the container sandbox hosting project.
process.env.GOOGLE_CLOUD_QUOTA_PROJECT = "gen-lang-client-0349240272";

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
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Yêu cầu cung cấp Token xác thực." });
      }

      const idToken = authHeader.split('Bearer ')[1];
      const { targetUserId, newPassword } = req.body || {};

      if (!targetUserId || !newPassword) {
        return res.status(400).json({ error: "Thiếu mã tài khoản hoặc mật khẩu mới." });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Mật khẩu mới phải có tối thiểu 6 ký tự." });
      }

      const authAdmin = getAuth();
      const appInstance = getApps()[0];
      const firestoreAdmin = getFirestore(appInstance, "ai-studio-b2d8e0e9-52cd-42ef-bb50-f9a1cebfcf8b");

      // Verify user's ID token through Firebase Admin auth
      const decodedToken = await authAdmin.verifyIdToken(idToken);
      const adminUid = decodedToken.uid;

      let adminData: any = null;

      try {
        const userRef = firestoreAdmin.collection('users').doc(adminUid);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          adminData = userSnap.data();
        }
      } catch (firestoreErr: any) {
        console.warn("[PASS_RESET] Firestore Admin SDK read failed, attempting REST API fallback:", firestoreErr.message || firestoreErr);
        try {
          const configJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
          const projectId = configJson.projectId;
          const databaseId = configJson.firestoreDatabaseId;
          const apiKey = configJson.apiKey;
          const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${adminUid}?key=${apiKey}`;
          
          const restRes = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          });
          
          if (!restRes.ok) {
            const errText = await restRes.text();
            throw new Error(`REST fail: ${restRes.status} - ${errText}`);
          }
          
          const restJson: any = await restRes.json();
          const fields = restJson.fields || {};
          const parsedData: Record<string, any> = {};
          
          for (const [key, valObj] of Object.entries(fields)) {
            const typedVal = valObj as any;
            if ('stringValue' in typedVal) {
              parsedData[key] = typedVal.stringValue;
            } else if ('integerValue' in typedVal) {
              parsedData[key] = parseInt(typedVal.integerValue, 10);
            } else if ('doubleValue' in typedVal) {
              parsedData[key] = parseFloat(typedVal.doubleValue);
            } else if ('booleanValue' in typedVal) {
              parsedData[key] = typedVal.booleanValue;
            } else if ('nullValue' in typedVal) {
              parsedData[key] = null;
            } else {
              parsedData[key] = typedVal;
            }
          }
          adminData = parsedData;
        } catch (restErr: any) {
          console.error("[PASS_RESET] REST API fallback also failed:", restErr.message || restErr);
          throw firestoreErr; // Throw original error if fallback also fails
        }
      }

      if (!adminData) {
        return res.status(403).json({ error: "Tài khoản quản trị không tồn tại trên hệ thống dữ liệu." });
      }

      const role = adminData.role;
      const status = adminData.status;

      if (status !== 'active' || (role !== 'admin' && role !== 'manager')) {
        return res.status(403).json({ error: "Tài khoản của bạn không có quyền thực hiện chức năng này." });
      }

      // Reset the password in Firebase Auth using Admin SDK
      await authAdmin.updateUser(targetUserId, { password: newPassword });

      console.log(`[PASS_RESET] Admin/Manager "${adminData.username || adminUid}" reset password for UID: ${targetUserId}`);
      return res.json({ success: true, message: "Cấp lại mật khẩu thành công." });
    } catch (err: any) {
      console.error("[PASS_RESET] Exception occurred:", err);
      
      const errMsg = err.message || "";
      const isIamError = errMsg.includes("permission") || 
                         errMsg.includes("IAM") || 
                         errMsg.includes("quota") ||
                         errMsg.includes("identitytoolkit") ||
                         errMsg.includes("used in project") ||
                         err.code === "auth/insufficient-permission" ||
                         err.code === "auth/internal-error" ||
                         errMsg.includes("403") ||
                         errMsg.includes("credentials");

      if (isIamError) {
        const scEmail = "711060358240-compute@developer.gserviceaccount.com";
        return res.status(403).json({
          error: "Service Account chưa được phân quyền trong dự án Firebase của bạn.",
          isIamError: true,
          serviceAccount: scEmail,
          projectId: "gen-lang-client-0349240272",
          instructions: `Vui lòng cấp quyền (IAM) cho Service Account sau trong bảng điều khiển dự án Google Cloud/Firebase của bạn:\n\nEmail: ${scEmail}\nRole: "Firebase Authentication Admin" hoặc "Editor".\n\nXem hướng dẫn chi tiết bên dưới.`
        });
      }

      return res.status(500).json({ error: errMsg || "Lỗi máy chủ khi cập nhật mật khẩu." });
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
