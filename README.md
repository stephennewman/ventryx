# Krezzo - Real-time Budget Consultant

A modern financial management application that helps you track your transactions and manage your budget in real-time. Built with React, TypeScript, Tailwind CSS, and Plaid API.

## Features

- Google Authentication
- Real-time bank account connection via Plaid
- Transaction tracking and display
- Account balance monitoring
- Modern, responsive UI
- Secure API handling

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ventryx.git
cd ventryx
```

2. Install dependencies:
```bash
npm install
cd server && npm install
```

3. Create environment variables:
Create a `.env` file in the root directory and a `.env` file in the server directory with the following variables:

Root `.env`:
```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

Server `.env`:
```
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
PORT=5176
```

4. Start the development servers:

Backend:
```bash
cd server && node server.js
```

Frontend:
```bash
npm run dev
```

## Deployment

The application is set up for deployment on Netlify with the following considerations:

1. Frontend deployment:
   - Add the environment variables in Netlify's deployment settings
   - Enable automatic deployments from GitHub

2. Backend deployment:
   - Deploy the server to a platform of your choice (e.g., Heroku, DigitalOcean)
   - Update the API endpoint URLs in the frontend code
   - Set up environment variables on the hosting platform

## Technologies Used

- React
- TypeScript
- Tailwind CSS
- Firebase Authentication
- Plaid API
- Express.js
- Vite

## License

MIT
