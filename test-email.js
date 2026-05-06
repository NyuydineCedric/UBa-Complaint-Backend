#!/usr/bin/env node

// Email Configuration Test Script
// Run this to test your email configuration before deploying

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 587);
const EMAIL_SECURE = process.env.EMAIL_SECURE === "true";
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;

async function createTestAccount() {
  // Create a test account on Ethereal Email
  console.log('🔧 Creating test email account on Ethereal...');
  const testAccount = await nodemailer.createTestAccount();

  console.log('✅ Test account created!');
  console.log(`📧 Email: ${testAccount.user}`);
  console.log(`🔑 Password: ${testAccount.pass}`);
  console.log(`🌐 Web Interface: https://ethereal.email/login\n`);

  return testAccount;
}

async function testEmailConfiguration() {
  console.log('🔧 Testing Email Configuration...\n');

  let account;
  if (EMAIL_HOST === 'smtp.gmail.com') {
    // Gmail configuration
    account = {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    };
    console.log('📧 Using Gmail SMTP for real email delivery');
  } else if (EMAIL_HOST === 'smtp.ethereal.email' && EMAIL_USER === 'testuser@ethereal.email') {
    // Use dynamic test account creation
    account = await createTestAccount();
  } else {
    // Use configured credentials
    account = {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    };
  }

  // Check if required environment variables are set
  if (!EMAIL_HOST || !account.user || !account.pass) {
    console.log('❌ Missing required environment variables:');
    console.log('   - EMAIL_HOST');
    console.log('   - EMAIL_USER');
    console.log('   - EMAIL_PASS');
    console.log('\n📝 Please update your .env file with the required values.');
    console.log('📖 See .env.example for configuration instructions.\n');
    return;
  }

  console.log('✅ Environment variables loaded');
  console.log(`📧 SMTP Host: ${EMAIL_HOST}`);
  console.log(`🔌 SMTP Port: ${EMAIL_PORT}`);
  console.log(`🔒 Secure: ${EMAIL_SECURE ? 'Yes (SSL)' : 'No (TLS)'}`);
  console.log(`👤 Email User: ${account.user}`);
  console.log(`📤 From Address: ${EMAIL_FROM}\n`);

  // Create transporter
  let transporter;
  if (EMAIL_HOST === 'smtp.gmail.com') {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_SECURE,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });
  }

  try {
    // Test connection
    console.log('🔌 Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!\n');

    // Send test email
    console.log('📤 Sending test email...');
    const testEmail = EMAIL_HOST === 'smtp.gmail.com' ? account.user : account.user; // Send to yourself for Gmail

    const mailOptions = {
      from: EMAIL_FROM,
      to: testEmail,
      subject: 'UBa Complaint System - Email Test',
      text: `Hello!

This is a test email from the UBa Complaint Management System.

If you received this email, your email configuration is working correctly!

Configuration Details:
- SMTP Host: ${EMAIL_HOST}
- Email User: ${account.user}
- Service: ${EMAIL_HOST === 'smtp.gmail.com' ? 'Gmail (Production)' : 'Ethereal (Testing)'}

You can now receive notifications when complaint statuses change.

Best regards,
UBa Complaint Management System`,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log(`📧 Message ID: ${result.messageId}`);
    console.log(`📧 Sent to: ${testEmail}`);

    if (EMAIL_HOST === 'smtp.ethereal.email') {
      console.log(`🌐 View email at: https://ethereal.email/message/${result.messageId}`);
      console.log(`🔗 Or login at: https://ethereal.email/login`);
      console.log(`   Username: ${account.user}`);
      console.log(`   Password: ${account.pass}`);
    } else if (EMAIL_HOST === 'smtp.gmail.com') {
      console.log('📧 Check your Gmail inbox for the test email!');
      console.log('   If you don\'t see it, check your spam folder.');
    }

    console.log('\n🎉 Email configuration is working! Students will now receive notifications when their complaint status changes.');

  } catch (error) {
    console.log('❌ Email configuration test failed:');
    console.log(`Error: ${error.message}\n`);

    if (error.code === 'EAUTH') {
      console.log('🔐 Authentication failed. Please check:');
      console.log('   - Email address is correct');
      console.log('   - Password is correct (use App Password for Gmail)');
      console.log('   - 2FA is enabled (for Gmail)');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('🌐 Connection failed. Please check:');
      console.log('   - SMTP host is correct');
      console.log('   - SMTP port is correct');
      console.log('   - Firewall/antivirus is not blocking the connection');
    }

    console.log('\n📖 See .env.example for detailed setup instructions.');
  }
}

testEmailConfiguration().catch(console.error);