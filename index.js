/* global process */
import express from "express";
import cors from "cors";
import * as brevo from '@getbrevo/brevo';
import dotenv from "dotenv";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "data.json");
const PORT = process.env.PORT || 4000;

// Initialize Brevo API client
let brevoApiInstance = null;
if (process.env.BREVO_API_KEY) {
  brevoApiInstance = new brevo.TransactionalEmailsApi();
  brevoApiInstance.apiKey = process.env.BREVO_API_KEY;
  console.log("✅ Brevo configured for email sending");
} else {
  console.warn("⚠️ BREVO_API_KEY missing. Email notifications disabled.");
}

const app = express();

// CORS (allow all)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

async function readData() {
  const raw = await readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeData(data) {
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// Email via Brevo (HTTPS API – works on Render free tier)
async function sendNotificationEmail(to, subject, text) {
  if (!brevoApiInstance) {
    console.log("Email not sent: Brevo API not configured.");
    return;
  }
  if (!to) {
    console.warn("No recipient email address.");
    return;
  }

  const fromEmail = process.env.EMAIL_FROM || "nyuydinecedric@gmail.com";
  const fromName = "UBa Complaint System";

  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.to = [{ email: to }];
  sendSmtpEmail.textContent = text;
  sendSmtpEmail.sender = { name: fromName, email: fromEmail };

  try {
    const response = await brevoApiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`✅ Email sent to ${to} via Brevo. Message ID: ${response.messageId}`);
  } catch (error) {
    console.error("❌ Brevo error:", error.response?.body || error.message);
  }
}

// Health check
app.get("/api/health", (_, res) => res.json({ status: "ok" }));

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const newUser = req.body;
    const data = await readData();
    const existing = data.users.find(u => u.matricule === newUser.matricule || u.email === newUser.email);
    if (existing) return res.status(400).json({ message: "Already registered." });
    const createdUser = { ...newUser, id: Date.now().toString(), role: newUser.role || "student", createdAt: new Date().toISOString() };
    data.users.push(createdUser);
    await writeData(data);
    res.status(201).json(createdUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to register." });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, matricule } = req.body;
    const data = await readData();
    const found = data.users.find(u => u.email === email && u.password === password && u.matricule === matricule);
    if (!found) return res.status(401).json({ message: "Invalid credentials." });
    res.json(found);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to login." });
  }
});

// Update user
app.put("/api/users/:matricule", async (req, res) => {
  try {
    const matricule = req.params.matricule;
    const updates = req.body;
    const data = await readData();
    const index = data.users.findIndex(u => u.matricule === matricule);
    if (index === -1) return res.status(404).json({ message: "User not found." });
    data.users[index] = { ...data.users[index], ...updates };
    await writeData(data);
    res.json(data.users[index]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update user." });
  }
});

// Get all complaints
app.get("/api/complaints", async (_, res) => {
  try {
    const data = await readData();
    res.json(data.complaints || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load complaints." });
  }
});

// Get single complaint
app.get("/api/complaints/:id", async (req, res) => {
  try {
    const data = await readData();
    const complaint = data.complaints.find(c => c.id === req.params.id);
    if (!complaint) return res.status(404).json({ message: "Not found." });
    res.json(complaint);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load complaint." });
  }
});

// Create complaint
app.post("/api/complaints", async (req, res) => {
  try {
    const complaint = req.body;
    const data = await readData();
    const created = { ...complaint, id: Date.now().toString(), submittedDate: new Date().toISOString(), lastUpdate: new Date().toISOString(), status: complaint.status || "pending" };
    data.complaints.unshift(created);
    await writeData(data);
    res.status(201).json(created);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create complaint." });
  }
});

// Update complaint (send email on status change)
app.put("/api/complaints/:id", async (req, res) => {
  try {
    const updates = req.body;
    const data = await readData();
    const index = data.complaints.findIndex(c => c.id === req.params.id);
    if (index === -1) return res.status(404).json({ message: "Not found." });
    const old = data.complaints[index];
    const updated = { ...old, ...updates, lastUpdate: new Date().toISOString() };
    data.complaints[index] = updated;
    await writeData(data);

    if (updates.status && updates.status !== old.status) {
      console.log(`Status update: ${old.status} -> ${updates.status}, email: ${old.email}`);
      if (old.email) {
        const statusText = updates.status.charAt(0).toUpperCase() + updates.status.slice(1);
        const subject = `UBa Complaint System - Status Update: ${statusText}`;
        const message = `Dear ${old.name || "Student"},\n\nYour complaint #${old.id} status changed to ${statusText}.\n\nLog in to view details.\n\nRegards,\nUBa System`;
        await sendNotificationEmail(old.email, subject, message);
      } else {
        console.warn("No email address on complaint");
      }
    }
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Update failed." });
  }
});

// Delete complaint
app.delete("/api/complaints/:id", async (req, res) => {
  try {
    const data = await readData();
    const exists = data.complaints.some(c => c.id === req.params.id);
    if (!exists) return res.status(404).json({ message: "Not found." });
    data.complaints = data.complaints.filter(c => c.id !== req.params.id);
    await writeData(data);
    res.json({ message: "Deleted." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Delete failed." });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));