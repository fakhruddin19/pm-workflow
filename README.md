# 🗺️ WorkflowDrive - Project OS untuk Tim Spasial

**WorkflowDrive** adalah platform manajemen proyek dan alur kerja (*Workflow OS*) yang dirancang khusus untuk tim pemetaan, survei geospasial, dan GIS. Platform ini menjembatani koordinasi tahapan kerja teknis (seperti `Drafter` ➔ `Koordinator` ➔ `Submit BIG`) dengan pelacakan batas waktu (SLA), tautan deliverable Google Drive, notifikasi peran, dan diagram alur interaktif.

---

## 📁 Struktur Direktori

```text
workflow-drive/
├── backend/
│   ├── server.py              # Aplikasi FastAPI dengan 17 endpoint RESTful
│   ├── requirements.txt       # Daftar dependensi Python (FastAPI, Motor, JWT, bcrypt)
│   ├── .env                   # Variabel lingkungan backend (MongoDB, JWT)
│   └── .env.example
├── frontend/
│   ├── public/
│   │   └── index.html         # Template HTML utama
│   ├── src/
│   │   ├── components/        # Komponen UI (WorkflowDiagram, Layout, Radix UI)
│   │   ├── lib/               # Utility API axios, Auth Context, Supabase helper
│   │   ├── pages/             # Halaman: Landing, Login, Register, Dashboard, Projects, Detail, Inbox
│   │   ├── App.js             # Routing aplikasi
│   │   └── index.js
│   ├── package.json           # Dependensi React, Tailwind, Lucide, Sonner
│   ├── tailwind.config.js
│   ├── .env                   # URL backend (default: http://localhost:8001)
│   └── .env.example
└── README.md
```

---

## 🚀 Panduan Menjalankan Aplikasi

### 1. Prasyarat
- **Node.js** (v18 atau lebih baru) & **npm** / **yarn**
- **Python** (v3.10 atau lebih baru)
- **MongoDB** (bisa lokal `mongodb://localhost:27017` atau cloud via MongoDB Atlas)

---

### 2. Menjalankan Backend (FastAPI)

1. Masuk ke folder backend:
   ```bash
   cd backend
   ```
2. Buat virtual environment & aktifkan:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate
   ```
3. Pasang dependensi:
   ```bash
   pip install -r requirements.txt
   ```
4. Jalankan server:
   ```bash
   python server.py
   # atau menggunakan uvicorn:
   uvicorn server:app --host 0.0.0.0 --port 8001 --reload
   ```
   *Swagger UI Dokumentasi API dapat diakses di: `http://localhost:8001/docs`*

---

### 3. Menjalankan Frontend (React SPA)

1. Buka terminal baru dan masuk ke folder frontend:
   ```bash
   cd frontend
   ```
2. Pasang paket npm:
   ```bash
   npm install
   ```
3. Jalankan server development:
   ```bash
   npm start
   ```
   *Aplikasi frontend akan terbuka di browser pada: `http://localhost:3000`*

---

## 💡 Fitur-Fitur Utama yang Tersedia

1. **Autentikasi & Akun Demo**:
   - Pendaftaran & Login dengan JWT (HS256).
   - Fitur **"Coba Instan (Demo)"** satu klik untuk langsung mengeksplorasi aplikasi dengan contoh proyek spasial RTRW dan data tugas yang telah disiapkan.
2. **Papan Kanban & Dynamic Stages**:
   - Stage alur kerja kustom per proyek (misal: Drafter, Koordinator, Quality Control, Submit BIG).
   - Jam SLA (*Service Level Agreement*) per tahapan.
3. **Diagram Alur Otomatis (*Workflow Diagram*)**:
   - Menampilkan posisi data saat ini secara visual.
   - Peringatan status waktu SLA: Hijau (dalam SLA), Amber (mendekati batas 75%), Merah (melewati SLA).
4. **Stage Timer Auto-Reset**:
   - Durasi waktu pengerjaan dihitung otomatis per tugas dan di-reset saat tugas bergeser ke tahapan berikutnya.
5. **Google Drive Integration**:
   - Folder Google Drive terhubung di level proyek.
   - Form penyerahan berkas (*deliverable submit*) dengan catatan dan link Google Drive.
6. **Dashboard Analitik**:
   - Statistik total proyek, tugas aktif, distribusi beban kerja per stage, dan log email.

---

## 🛠️ Rencana Pengembangan Lanjutan (Next Steps)

Berikut beberapa ide peningkatan yang siap kami bantu kembangkan bersama Anda:
- [ ] **Pratinjau Peta Spasial Interaktif**: Integrasi Leaflet / Mapbox / OpenLayers untuk menampilkan preview file GeoJSON / Shapefile langsung di tab proyek.
- [ ] **Direct Google Drive API Integration**: Upload berkas langsung dari aplikasi ke folder Google Drive proyek via OAuth2 Google Picker API.
- [ ] **Layanan Email Nyata**: Integrasi SendGrid / Resend / SMTP untuk mengirim email notifikasi tugas dan undangan proyek ke email penerima yang sebenarnya.
- [ ] **Export Laporan Progres PDF/Excel**: Pembuatan rekapitulasi waktu pengerjaan drafter dan rekap deliverable proyek untuk pelaporan klien/pemerintah.
- [ ] **Validasi Topologi Geometri Otomatis**: Integrasi pengecekan topologi file spasial sederhana sebelum disubmit ke tahapan berikutnya.
