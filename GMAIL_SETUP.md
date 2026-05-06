# Gmail SMTP Setup Guide

## Step 1: Enable 2-Factor Authentication (2FA)
1. Go to https://myaccount.google.com/security
2. Under "Signing in to Google", click "2-Step Verification"
3. Follow the steps to enable 2FA on your Gmail account

## Step 2: Generate App Password
1. Go to https://myaccount.google.com/apppasswords
2. Sign in if prompted
3. Under "Select app", choose "Mail"
4. Under "Select device", choose "Other (custom name)"
5. Enter "UBa Complaint System" as the custom name
6. Click "Generate"
7. **Copy the 16-character password** (ignore spaces)

## Step 3: Update .env file
Replace the placeholder values in `server/.env`:

```
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-character-app-password
```

## Step 4: Restart the server
```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run server
```

## Step 5: Test
1. Update a complaint status in the admin panel
2. Check the student's Gmail inbox for the notification email

## Troubleshooting
- If you get "Authentication failed" error, double-check your App Password
- Make sure 2FA is enabled on your Gmail account
- The App Password should be exactly 16 characters (no spaces)
- Try generating a new App Password if the first one doesn't work

## Security Notes
- App Passwords are specific to this application
- You can revoke App Passwords anytime from your Google account
- Never share your App Password or regular Gmail password