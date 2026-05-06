# Backend server

This project includes a simple Express backend for users and complaints.

## Run the backend

1. Install dependencies from the project root:
   ```bash
   npm install
   ```
2. Configure email notifications (optional but recommended):
   - Copy `.env.example` to `.env`
   - Update the email configuration with your SMTP credentials
   - Test the configuration: `node server/test-email.js`
3. Start the backend server:
   ```bash
   npm run server
   ```

The API will be available at `http://localhost:4000/api`.

## Email Notifications

The system automatically sends email notifications to students when their complaint status changes (e.g., from "pending" to "resolved").

### Email Configuration

1. Copy the example environment file:
   ```bash
   cp server/.env.example server/.env
   ```

2. Update `server/.env` with your email provider settings:
   - **Gmail**: Use App Password (enable 2FA first)
   - **Other providers**: Check your email provider's SMTP settings

3. Test your configuration:
   ```bash
   node server/test-email.js
   ```

### Email Content

When a complaint status changes, students receive an email with:
- Complaint ID and details
- Previous and new status
- Timestamp of the update
- Link to view more details in their dashboard

## Frontend proxy

The frontend uses Vite proxy configuration so `/api` requests are forwarded to the backend.

## Data storage

User and complaint data are stored in `server/data.json`.
