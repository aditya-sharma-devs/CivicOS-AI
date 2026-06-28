# CivicOS AI 🌐
### Hyperlocal Problem Solver & Verified Community Infrastructure Hub

**CivicOS AI** is a modern, full-stack community infrastructure reporting platform that empowers citizens to report real-world public hazards (potholes, damaged streetlights, public waste, water leakage) and utilizes Gemini AI to validate reports in real-time, matching images with descriptions to discard spam submissions.

🔗 **Live Application Link**: [civic-os-ai.vercel.app](https://civic-os-ai.vercel.app)  
🔗 **Production API Endpoint**: `https://civicos-ai.onrender.com`

---

## 🌟 Key Features

### 1. **AI-Powered Image Validation & Spam Discarding**
* Integrated with **Gemini Multimodal AI (Gemini 2.5/Pro)** to perform deep analysis of uploaded evidence photos.
* Cross-checks the citizen's selected category and description against what is actually visible in the photo.
* Automatically rejects screenshot spam, zoom/video call screenshots, documents, and unrelated images, prompting the user with a floating `"Validation warning: add valid issue"` banner without saving garbage data to MongoDB.

### 2. **Auto-Severity & AI Insights**
* The AI automatically categorizes issue severity (`Low`, `Medium`, `High`, `Critical`) based on visual hazard levels.
* Displays a detailed AI Assessment card with a confidence rating and brief description of the observed infrastructure problem.

### 3. **Smart Duplicate Merging (Location-based)**
* Prevents dashboard clutter by automatically checking if an issue of the same category has already been reported within a **~110-meter radius** (±0.001 degrees lat/lng).
* Merges multiple citizen reports on the same issue into a single card, tracking coordinates and descriptions as a timeline.

### 4. **Live Coordinates Mapping**
* Integrated browser Geolocation API utilizing `maximumAge: 0` to bypass cached coordinates and capture precision GPS locations in real-time.
* Embeds clickable coordinate links on each card that immediately pin the exact location in Google Maps.

### 5. **Premium Dark Mode Glassmorphism Dashboard**
* Custom styled with dynamic glowing ambient orbs and a modern HSL dark-theme palette.
* Features a completely responsive grid (synchronized column heights, custom thin scrollbars, and floating toast notifications).
* Admin portal to view, filter, transition statuses (`Pending` ➡️ `Under Review` ➡️ `In Progress` ➡️ `Resolved`), and delete issues.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React (Vite), Vanilla CSS, HSL Variables, Geolocation API |
| **Backend** | Node.js, Express.js, Mongoose, RESTful API structure |
| **Database** | MongoDB Atlas (Cloud Database) |
| **AI Integration** | Google Gemini API (Multimodal Vision Analysis) |
| **Media Storage** | Cloudinary (Production CDN hosting for evidence photos) |
| **Deployment** | Vercel (Frontend), Render (Backend Service) |

---

## 📂 Project Structure

```bash
CivicOS-AI/
├── backend/
│   ├── config/          # MongoDB connectivity config
│   ├── models/          # Mongoose Schemas (Issue, Admin)
│   ├── routes/          # Express API route endpoints (Issues, Auth)
│   ├── services/        # Gemini API integration service
│   ├── uploads/         # Local fallback file storage
│   └── server.js        # Main Express application server
└── frontend/
    ├── src/
    │   ├── App.jsx      # Core React application logic
    │   ├── App.css      # Custom HSL glassmorphic design system
    │   └── main.jsx     # Vite client entry point
```

---

## ⚡ Getting Started (Local Setup)

### Prerequisites
* Node.js (v18+)
* MongoDB Atlas cluster URL
* Gemini API Key (Google AI Studio)
* Cloudinary Cloud Name, API Key, and API Secret

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/aditya-sharma-devs/CivicOS-AI.git
cd CivicOS-AI

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file inside the `backend/` directory:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_token
GEMINI_API_KEY=your_google_gemini_api_key

# Cloudinary Credentials (Optional - falls back to local storage if blank)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=CivicOS_AI_v2
```

### 3. Run Locally

Start the backend server:
```bash
cd backend
npm run dev
```

Start the frontend Vite development server:
```bash
cd frontend
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## ⚙️ Deployment Configurations

* **Frontend**: Configured for continuous integration on **Vercel** with SPA route rewrites configured in `vercel.json`.
* **Backend**: Deployed on **Render** (linked to GitHub repo with automated builds on git push). Includes an automatic database purger on server startup to delete any legacy spam reports containing negations.
