# 🚀 How to Start the Servers

## Quick Start Commands

### Option 1: Start Both Servers Manually

**Terminal 1 - Frontend (React):**
```bash
npm run dev
```
Frontend will run at: `http://localhost:5173`

**Terminal 2 - Backend (Django):**
```bash
cd backend
python manage.py runserver 8000
```
Backend will run at: `http://localhost:8000`

---

### Option 2: Using PowerShell (Windows)

**Start Frontend:**
```powershell
npm run dev
```

**Start Backend (in new terminal):**
```powershell
cd backend
python manage.py runserver 8000
```

---

## ✅ Verify Servers Are Running

**Check Frontend:**
- Open browser: `http://localhost:5173`
- Should see the login page

**Check Backend:**
- Open browser: `http://localhost:8000/api/`
- Should see Django API response

**Test Authentication:**
```bash
# Test signup
curl -X POST http://localhost:8000/api/auth/signup/ \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

---

## 🔧 Important: Enable Voice Alerts

After the app loads, **you MUST call `setUserGesture()`** once after a button click to enable voice alerts:

**Option 1: From Browser Console**
```javascript
import('./src/ml/detectorAPI.ml.js').then(module => {
  module.setUserGesture();
  console.log('Voice alerts enabled!');
});
```

**Option 2: Add to Your UI (Recommended)**
Add this to your camera component's button click handler:
```javascript
import { setUserGesture } from '../ml/detectorAPI.ml.js';

// In your button click handler:
const handleEnableCamera = () => {
  setUserGesture(); // Enable voice alerts
  // ... rest of your code
};
```

---

## 📋 Server Status

- ✅ **Frontend**: React + Vite on port 5173
- ✅ **Backend**: Django REST API on port 8000
- ✅ **ML Modules**: Updated with strict thresholds
- ✅ **Voice Alerts**: Ready (requires setUserGesture() call)

---

## 🐛 Troubleshooting

**Port already in use:**
```bash
# Kill process on port 8000
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Kill process on port 5173
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

**Django not starting:**
```bash
cd backend
python manage.py check
python manage.py runserver 8000
```

**Frontend not starting:**
```bash
npm install
npm run dev
```
