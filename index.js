/* global process */
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, "data.json");
const PORT = process.env.PORT || 4000;

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 587);
const EMAIL_SECURE = process.env.EMAIL_SECURE === "true";
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
let EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

let emailTransporter = null;

async function configureEmailTransporter() {
  if (!EMAIL_HOST) {
    console.warn("Email SMTP host is not configured. Skipping email transporter setup.");
    return;
  }

  try {
    if (EMAIL_HOST === "smtp.gmail.com") {
      // Gmail SMTP configuration
      if (!EMAIL_USER || !EMAIL_PASS) {
        console.error("❌ Gmail SMTP requires EMAIL_USER and EMAIL_PASS to be set.");
        console.error("   Please set your Gmail address and App Password in .env");
        return;
      }

      emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
        },
      });

      console.log("🔧 Gmail SMTP transport configured for production email delivery.");
      console.log(`   From: ${EMAIL_FROM}`);
      console.log("   ✅ Ready to send real emails to students!");

    } else if (EMAIL_HOST === "smtp.ethereal.email") {
      // Ethereal test configuration (fallback)
      const shouldUseEtherealTestAccount =
        !EMAIL_USER || !EMAIL_PASS || EMAIL_USER === "testuser@ethereal.email" || EMAIL_PASS === "testpass123";

      if (shouldUseEtherealTestAccount) {
        const testAccount = await nodemailer.createTestAccount();
        emailTransporter = nodemailer.createTransport({
          host: EMAIL_HOST,
          port: EMAIL_PORT,
          secure: EMAIL_SECURE,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });

        if (!EMAIL_FROM || EMAIL_FROM === "testuser@ethereal.email") {
          EMAIL_FROM = testAccount.user;
        }

        console.log("🔧 Ethereal email transport configured for local testing.");
        console.log(`   Login: https://ethereal.email/login`);
        console.log(`   Username: ${testAccount.user}`);
        console.log(`   Password: ${testAccount.pass}`);
        console.log("   ⚠️  NOTE: This sends test emails only. Use Gmail for real delivery.");
      } else {
        // Custom Ethereal configuration
        emailTransporter = nodemailer.createTransport({
          host: EMAIL_HOST,
          port: EMAIL_PORT,
          secure: EMAIL_SECURE,
          auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS,
          },
        });
      }
    } else {
      // Generic SMTP configuration
      if (!EMAIL_USER || !EMAIL_PASS) {
        console.warn("Email credentials are missing. Email notifications will be disabled.");
        return;
      }

      emailTransporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: EMAIL_PORT,
        secure: EMAIL_SECURE,
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
        },
      });

      console.log(`🔧 Custom SMTP transport configured: ${EMAIL_HOST}:${EMAIL_PORT}`);
    }
  } catch (error) {
    console.error("Failed to configure email transporter:", error.message);
    console.error("Please check your .env configuration.");
    console.error(error);
  }
}

await configureEmailTransporter();

const app = express();

// ========== CORS CONFIGURATION (FIXED) ==========
// Allow all origins temporarily to fix CORS errors
app.use(cors());
app.options('*', cors()); // Handle preflight requests

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

async function readData() {
  const raw = await readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw);
}

async function writeData(data) {
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

async function sendNotificationEmail(to, subject, text) {
  if (!emailTransporter) {
    console.log("Email not sent: SMTP is not configured.", { to, subject });
    console.log("To configure email, set these environment variables:");
    console.log("  EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM");
    return;
  }

  try {
    console.log(`Sending email with transporter config to ${to}...`);
    const result = await emailTransporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      text,
    });

    console.log(`Email sent successfully to ${to}. Message ID: ${result.messageId}`);

    const previewUrl = nodemailer.getTestMessageUrl(result);
    if (previewUrl) {
      console.log(`Preview URL: ${previewUrl}`);
      console.log("NOTE: This is an Ethereal test email. Open the preview URL to view the message in your browser.");
    }
  } catch (error) {
    console.error("Failed to send email notification:", error.message);
    console.error("Error details:", error);
  }
}

app.get("/api/health", (_, res) => {
  res.json({ status: "ok" });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const newUser = req.body;
    const data = await readData();
    const existing = data.users.find(
      (user) => user.matricule === newUser.matricule || user.email === newUser.email,
    );

    if (existing) {
      return res.status(400).json({ message: "This matricule or email is already registered." });
    }

    const createdUser = {
      ...newUser,
      id: Date.now().toString(),
      role: newUser.role || "student",
      createdAt: new Date().toISOString(),
    };

    data.users.push(createdUser);
    await writeData(data);

    res.status(201).json(createdUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to register user." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, matricule } = req.body;
    const data = await readData();
    const found = data.users.find(
      (user) =>
        user.email === email &&
        user.password === password &&
        user.matricule === matricule,
    );

    if (!found) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    res.json(found);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to login." });
  }
});

app.put("/api/users/:matricule", async (req, res) => {
  try {
    const matricule = req.params.matricule;
    const updates = req.body;
    const data = await readData();
    const index = data.users.findIndex((user) => user.matricule === matricule);

    if (index === -1) {
      return res.status(404).json({ message: "User not found." });
    }

    data.users[index] = { ...data.users[index], ...updates };
    await writeData(data);

    res.json(data.users[index]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update user." });
  }
});

app.get("/api/complaints", async (_, res) => {
  try {
    const data = await readData();
    res.json(data.complaints || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load complaints." });
  }
});

app.get("/api/complaints/:id", async (req, res) => {
  try {
    const data = await readData();
    const complaint = data.complaints.find((item) => item.id === req.params.id);
    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found." });
    }
    res.json(complaint);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to load complaint." });
  }
});

app.post("/api/complaints", async (req, res) => {
  try {
    const complaint = req.body;
    const data = await readData();
    const createdComplaint = {
      ...complaint,
      id: Date.now().toString(),
      submittedDate: complaint.submittedDate || new Date().toISOString(),
      lastUpdate: complaint.lastUpdate || new Date().toISOString(),
      status: complaint.status || "pending",
    };

    data.complaints.unshift(createdComplaint);
    await writeData(data);

    res.status(201).json(createdComplaint);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to create complaint." });
  }
});

app.put("/api/complaints/:id", async (req, res) => {
  try {
    const updates = req.body;
    const data = await readData();
    const index = data.complaints.findIndex((item) => item.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ message: "Complaint not found." });
    }

    const existingComplaint = data.complaints[index];
    const updatedComplaint = {
      ...existingComplaint,
      ...updates,
      lastUpdate: new Date().toISOString(),
    };

    data.complaints[index] = updatedComplaint;
    await writeData(data);

    if (
      updates.status &&
      updates.status !== existingComplaint.status
    ) {
      console.log(`Status update triggered for complaint ${req.params.id}: ${existingComplaint.status} -> ${updates.status}`);
      console.log(`Email address: ${existingComplaint.email}`);

      const statusText = updates.status.charAt(0).toUpperCase() + updates.status.slice(1);
      const subject = `UBa Complaint System - Status Update: ${statusText}`;

      const message = `Dear ${existingComplaint.name || "Student"},

Your complaint has been updated with the following details:

Complaint ID: ${existingComplaint.id}
Course: ${existingComplaint.courseTitle || existingComplaint.course}
Type: ${existingComplaint.type}
Previous Status: ${existingComplaint.status.charAt(0).toUpperCase() + existingComplaint.status.slice(1)}
New Status: ${statusText}
Updated Date: ${new Date().toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
})}

Please log in to your student dashboard to view more details about your complaint.

If you have any questions, please contact the UBa Complaint Support Team.

Best regards,
UBa Complaint Management System
University of Bamenda`;

      if (existingComplaint.email) {
        console.log(`Attempting to send email to ${existingComplaint.email}`);
        await sendNotificationEmail(existingComplaint.email, subject, message);
      } else {
        console.warn(`No email address found for complaint ${req.params.id}`);
      }
    }

    res.json(updatedComplaint);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to update complaint." });
  }
});

app.delete("/api/complaints/:id", async (req, res) => {
  try {
    const data = await readData();
    const existing = data.complaints.find((item) => item.id === req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Complaint not found." });
    }

    data.complaints = data.complaints.filter((item) => item.id !== req.params.id);
    await writeData(data);

    res.json({ message: "Complaint deleted." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Unable to delete complaint." });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});