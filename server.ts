import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
// We expect FIREBASE_SERVICE_ACCOUNT_KEY to be set in .env
if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Failed to initialize Firebase Admin:", error);
  }
} else {
  console.warn("FIREBASE_SERVICE_ACCOUNT_KEY not found. Backend notifications will be limited.");
}

const db = admin.apps.length ? getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId) : null;
const fcm = admin.apps.length ? admin.messaging() : null;

// Mock Email Transporter (Use real credentials in production)
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn("EMAIL_USER or EMAIL_PASS not found. Email notifications will be disabled.");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Trigger Notification API (Simulating Cloud Functions trigger)
  // In a real environment, this would be a Firestore Trigger.
  // Here, we expose an endpoint the client can call or we use a pub/sub simulation.
  app.post("/api/notify", async (req, res) => {
    const { type, payload } = req.body;

    if (!db) return res.status(500).json({ error: "Firebase not initialized" });

    try {
      switch (type) {
        case "NEW_EXPENSE":
          await handleNewExpenseNotification(payload);
          break;
        case "PAYMENT_SETTLED":
          await handlePaymentSettledNotification(payload);
          break;
        case "PAYMENT_REMINDER":
          await handlePaymentReminderNotification(payload);
          break;
        case "NEW_CHAT_MESSAGE":
          await handleNewChatMessageNotification(payload);
          break;
        case "BULK_NOTIFY":
          // Security Check: Ideally verify Firebase Auth token here
          // For now, we perform a simple check if the payload requester is the owner email
          if (payload.requesterEmail !== 'dhruvsharmads0506@gmail.com') {
            return res.status(403).json({ error: "Unauthorized: Only Owner can send broadcast notifications." });
          }
          await handleBulkNotification(payload);
          break;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Notification error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Handler Functions (Logic similar to Cloud Functions)
async function handleNewExpenseNotification(payload: any) {
  const { expenseId, groupId, creatorId, description, amount, currency } = payload;
  if (!db) return;

  const groupSnap = await db.collection("groups").doc(groupId).get();
  const groupData = groupSnap.data();
  if (!groupData) return;

  const members = groupData.members.filter((uid: string) => uid !== creatorId);

  for (const userId of members) {
    const userSnap = await db.collection("users").doc(userId).get();
    const userData = userSnap.data();
    if (!userData) continue;

    const title = "New Expense Added";
    const message = `${groupData.name}: ${description} (${currency}${amount})`;

    // 1. Store in Firestore
    await db.collection("notifications").add({
      userId,
      title,
      message,
      type: "expense_added",
      isRead: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { expenseId, groupId }
    });

    // 2. Send Push (if enabled and token exists)
    if (userData.pushNotificationsEnabled !== false && userData.fcmToken && fcm) {
      await fcm.send({
        token: userData.fcmToken,
        notification: { title, body: message },
        data: { type: "expense_added", groupId, expenseId }
      }).catch(e => console.error("FCM Error for user", userId, e));
    }

    // 3. Send Email (if enabled)
    if (userData.emailNotificationsEnabled !== false && userData.email) {
      const emailBody = `Hi ${userData.displayName},\n\n${message}\n\nYou can view the expense details and your updated balance in the SplitShare app.\n\nThank you for using SplitShare!`;
      await sendEmailNotification(userData.email, title, emailBody);
    }
  }
}

async function handlePaymentSettledNotification(payload: any) {
  const { fromId, toId, amount, currency, groupId, recorderId } = payload;
  if (!db) return;

  const groupSnap = await db.collection("groups").doc(groupId).get();
  const groupName = groupSnap.data()?.name || "the group";

  const senderSnap = await db.collection("users").doc(fromId).get();
  const senderName = senderSnap.data()?.displayName || "Someone";
  
  const receiverSnap = await db.collection("users").doc(toId).get();
  const receiverName = receiverSnap.data()?.displayName || "Someone";

  // Notify both parties of the settlement
  // Financial settlements are critical, so it's good to notify both even if one recorded it.
  const targetIds = Array.from(new Set([fromId, toId]));

  for (const targetId of targetIds) {
    const targetSnap = await db.collection("users").doc(targetId).get();
    const targetData = targetSnap.data();

    if (targetData) {
      const title = "Payment Settled";
      let message = "";
      
      if (targetId === toId) {
        // Target is the one who RECEIVED money
        message = `${senderName} has paid you ₹${amount} in ${groupName}`;
      } else {
        // Target is the one who PAID money (confirmed by receiver)
        message = `${receiverName} has confirmed receiving ₹${amount} from you in ${groupName}`;
      }

      await db.collection("notifications").add({
        userId: targetId,
        title,
        message,
        type: "payment_settled",
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: { fromId, toId, groupId }
      });

      if (targetData.pushNotificationsEnabled !== false && targetData.fcmToken && fcm) {
        await fcm.send({
          token: targetData.fcmToken,
          notification: { title, body: message },
          data: { type: "payment_settled", groupId }
        }).catch(e => console.error("FCM Error", e));
      }

      if (targetData.emailNotificationsEnabled !== false && targetData.email) {
        const emailBody = `Hi ${targetData.displayName},\n\n${message}\n\nThis settlement has been recorded in SplitShare. You can view the updated balances in the app.\n\nThank you for using SplitShare!`;
        await sendEmailNotification(targetData.email, title, emailBody);
      }
    }
  }
}

async function handlePaymentReminderNotification(payload: any) {
  const { fromId, toId, amount, currency, groupId } = payload;
  if (!db) return;

  const senderSnap = await db.collection("users").doc(fromId).get();
  const senderName = senderSnap.data()?.displayName || "Someone";

  const receiverSnap = await db.collection("users").doc(toId).get();
  const receiverData = receiverSnap.data();

  if (receiverData) {
    const title = "Payment Reminder";
    const message = `${senderName} is reminding you of ${currency}${amount} due.`;

    await db.collection("notifications").add({
      userId: toId,
      title,
      message,
      type: "payment_reminder",
      isRead: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { fromId, groupId }
    });

    if (receiverData.pushNotificationsEnabled !== false && receiverData.fcmToken && fcm) {
      await fcm.send({
        token: receiverData.fcmToken,
        notification: { title, body: message },
      }).catch(e => console.error("FCM Error", e));
    }

    if (receiverData.emailNotificationsEnabled !== false && receiverData.email) {
      const emailBody = `Hi ${receiverData.displayName},\n\n${message}\n\nPlease settle this payment when convenient.\n\nThank you for using SplitShare!`;
      await sendEmailNotification(receiverData.email, title, emailBody);
    }
  }
}

async function handleNewChatMessageNotification(payload: any) {
  const { messageId, groupId, senderId, senderName, messageText, groupName } = payload;
  if (!db) return;

  const groupSnap = await db.collection("groups").doc(groupId).get();
  const groupData = groupSnap.data();
  if (!groupData) return;

  // Get all group members except the sender
  const targetMembers = groupData.members.filter((uid: string) => uid !== senderId);

  for (const memberId of targetMembers) {
    const memberSnap = await db.collection("users").doc(memberId).get();
    const memberData = memberSnap.data();
    if (!memberData) continue;

    const title = `New message in ${groupName}`;
    const message = `${senderName}: ${messageText}`;

    // Store in Firestore notifications
    await db.collection("notifications").add({
      userId: memberId,
      title,
      message,
      type: "chat_message",
      isRead: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { messageId, groupId, senderId, senderName }
    });

    // Send Push Notification (if enabled)
    if (memberData.pushNotificationsEnabled !== false && memberData.fcmToken && fcm) {
      await fcm.send({
        token: memberData.fcmToken,
        notification: { 
          title, 
          body: messageText.length > 100 ? messageText.substring(0, 100) + "..." : messageText 
        },
        data: { type: "chat_message", groupId, messageId }
      }).catch(e => console.error("FCM Error for chat message", e));
    }

    // Send Email (if enabled) - only for important messages or @mentions
    // For now, we'll skip email notifications for chat messages to avoid spam
    // But you can enable it by uncommenting the code below:
    /*
    if (memberData.emailNotificationsEnabled !== false && memberData.email) {
      const emailBody = `Hi ${memberData.displayName},\n\n${senderName} sent a message in ${groupName}:\n\n"${messageText}"\n\nView the conversation in SplitShare.`;
      await sendEmailNotification(memberData.email, title, emailBody);
    }
    */
  }
}

async function handleBulkNotification(payload: any) {
  const { title, message, targetType, targetUserId } = payload;
  if (!db) return;

  if (targetType === 'ALL') {
    const usersSnap = await db.collection("users").get();
    for (const docLine of usersSnap.docs) {
      const userData = docLine.data();
      await sendSingleNotification(docLine.id, userData, title, message);
    }
  } else if (targetType === 'SPECIFIC' && targetUserId) {
    const userSnap = await db.collection("users").doc(targetUserId).get();
    const userData = userSnap.data();
    if (userData) {
      await sendSingleNotification(targetUserId, userData, title, message);
    }
  }
}

async function sendSingleNotification(userId: string, userData: any, title: string, message: string) {
  if (!db) return;
  
  // 1. Store in Firestore
  await db.collection("notifications").add({
    userId,
    title,
    message,
    type: "admin_broadcast",
    isRead: false,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  // 2. Send Push
  if (userData.pushNotificationsEnabled !== false && userData.fcmToken && fcm) {
    await fcm.send({
      token: userData.fcmToken,
      notification: { title, body: message },
    }).catch(e => console.error("FCM Broadcast Error", e));
  }

  // 3. Send Email
  if (userData.emailNotificationsEnabled !== false && userData.email) {
    await sendEmailNotification(userData.email, title, message);
  }
}

async function sendEmailNotification(to: string, subject: string, text: string) {
  if (!process.env.EMAIL_USER) return;
  
  // Create HTML version for better formatting
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">${subject}</h2>
      <p style="font-size: 16px; line-height: 1.5; color: #374151;">${text.replace(/\n/g, '<br>')}</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
      <p style="font-size: 14px; color: #6b7280;">
        This is an automated notification from SplitShare.<br>
        Visit the app to view more details.
      </p>
    </div>
  `;
  
  await transporter.sendMail({
    from: `"SplitShare" <${process.env.EMAIL_USER}>`,
    to,
    subject: `[SplitShare] ${subject}`,
    text,
    html: htmlContent,
  }).catch(e => console.error("Email Error:", e));
}

startServer();
