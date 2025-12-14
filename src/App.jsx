import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, getDocs, 
  query, where, doc, updateDoc, deleteDoc, onSnapshot, setDoc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged 
} from 'firebase/auth';
import { 
  Search, Upload, FileSpreadsheet, LogOut, 
  School, User, Award, Save, Trash2, Plus, Menu, X, CheckCircle, BookOpen, Calculator, Filter, Lock, Shield, Hash 
} from 'lucide-react';

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDKplM3_t5rqeVAbeTU_FnQy5fokkq1cJs",
  authDomain: "cek-nilai-fdb1c.firebaseapp.com",
  projectId: "cek-nilai-fdb1c",
  storageBucket: "cek-nilai-fdb1c.firebasestorage.app",
  messagingSenderId: "648109693012",
  appId: "1:648109693012:web:488595b1903fde8b17b5c1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-school';

// --- HELPER FUNCTIONS ---
const calculateGrade = (score) => {
  const s = Number(score);
  if (s >= 90) return 'A';
  if (s >= 80) return 'B';
  if (s >= 70) return 'C';
  if (s >= 60) return 'D';
  return 'E';
};

const getGradeColor = (grade) => {
  if (grade === 'A') return 'text-green-600 bg-green-100';
  if (grade === 'B') return 'text-blue-600 bg-blue-100';
  if (grade === 'C') return 'text-yellow-600 bg-yellow-100';
  return 'text-red-600 bg-red-100';
};

// --- MAIN COMPONENT ---
export default function App() {
  // State: App Flow
  const [view, setView] = useState('home'); // home, result, admin, login_admin
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // State: Data
  const [schoolData, setSchoolData] = useState({ name: 'Sekolah Demo Indonesia', logo: '' });
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // State: Admin Auth
  const [adminCredentials, setAdminCredentials] = useState({ username: 'marquan', password: 'pirelli' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  // State: Search (Updated Logic)
  const [searchTerm, setSearchTerm] = useState(''); // Akan terisi otomatis by NISN
  const [searchNisn, setSearchNisn] = useState(''); // Input utama
  const [foundStudentName, setFoundStudentName] = useState(null); // Untuk validasi UI

  // Admin Forms
  const [activeAdminTab, setActiveAdminTab] = useState('students');
  
  // State untuk Input Manual
  const [manualEntry, setManualEntry] = useState({
    name: '',
    nisn: '',
    class: '',
    semester: 'Ganjil',
    subjects: [{ name: 'Matematika', score: '' }]
  });

  // State untuk Import Excel
  const [importConfig, setImportConfig] = useState({
    subjectName: '',
    className: '',
    semester: 'Ganjil'
  });

  // --- INITIALIZATION ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Auth error:", error);
      }
    };
    initAuth();

    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // --- FIRESTORE LISTENERS ---
  useEffect(() => {
    // 1. Listen to School Settings
    const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school');
    const unsubSchool = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) setSchoolData(docSnap.data());
      else setDoc(settingsDocRef, { name: 'Sekolah Unggulan', logo: '' });
    }, (error) => console.log("School listener error:", error));

    // 2. Listen to Admin Settings
    const adminSettingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin');
    const unsubAdmin = onSnapshot(adminSettingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setAdminCredentials(docSnap.data());
      } else {
        setDoc(adminSettingsRef, { username: 'marquan', password: 'pirelli' });
      }
    }, (error) => console.log("Admin creds listener error:", error));

    // 3. Listen to Students Data
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'students'));
    const unsubStudents = onSnapshot(q, (snapshot) => {
      const studentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsList);
    }, (error) => console.log("Students listener error:", error));

    return () => {
      unsubSchool();
      unsubAdmin();
      unsubStudents();
    };
  }, []);

  // --- HELPER FUNCTIONS ---
  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // --- ADMIN LOGIC ---
  const handleAdminLogin = () => {
    if (loginForm.username === adminCredentials.username && loginForm.password === adminCredentials.password) {
      setIsAdmin(true);
      setView('admin');
      showNotif('Login Admin Berhasil');
      setLoginForm({ username: '', password: '' });
    } else {
      showNotif('Username atau Password Salah!', 'error');
    }
  };

  const handleUpdateAdminCreds = async () => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin'), {
        username: adminCredentials.username,
        password: adminCredentials.password
      });
      showNotif('Data Login Admin berhasil diperbarui!');
    } catch (e) {
      showNotif('Gagal update data login', 'error');
    }
  };

  // --- MANUAL INPUT HANDLERS ---
  const handleSubjectChange = (index, field, value) => {
    const newSubjects = [...manualEntry.subjects];
    newSubjects[index][field] = value;
    setManualEntry({ ...manualEntry, subjects: newSubjects });
  };

  const addSubjectRow = () => {
    setManualEntry({
      ...manualEntry,
      subjects: [...manualEntry.subjects, { name: '', score: '' }]
    });
  };

  const removeSubjectRow = (index) => {
    const newSubjects = manualEntry.subjects.filter((_, i) => i !== index);
    setManualEntry({ ...manualEntry, subjects: newSubjects });
  };

  const saveManualEntry = async () => {
    if (!manualEntry.name || !manualEntry.nisn) {
      showNotif('Nama dan NISN wajib diisi', 'error');
      return;
    }
    
    const validSubjects = manualEntry.subjects.filter(s => s.name.trim() !== '' && s.score !== '');
    
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'students'), {
        name: manualEntry.name,
        nisn: manualEntry.nisn,
        class: manualEntry.class,
        semester: manualEntry.semester,
        grades: validSubjects
      });
      showNotif('Data siswa berhasil disimpan!');
      setManualEntry({
        name: '',
        nisn: '',
        class: '',
        semester: 'Ganjil',
        subjects: [{ name: 'Matematika', score: '' }]
      });
    } catch (error) {
      console.error(error);
      showNotif('Gagal menyimpan data', 'error');
    }
  };

  // --- STUDENT FLOW (UPDATED: NISN FIRST) ---
  const handleNisnSearchInput = (e) => {
    const nisn = e.target.value;
    setSearchNisn(nisn);

    // Real-time lookup
    const student = students.find(s => s.nisn === nisn);
    if (student) {
      setFoundStudentName(student.name);
      setSearchTerm(student.name); // Auto fill for UI consistency
    } else {
      setFoundStudentName(null);
      setSearchTerm('');
    }
  };

  const checkGrades = () => {
    const student = students.find(s => s.nisn === searchNisn);
    if (student) {
      setSelectedStudent(student);
      setView('result');
    } else {
      showNotif('NISN tidak ditemukan di database.', 'error');
    }
  };

  // --- EXCEL IMPORT LOGIC ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!importConfig.subjectName) {
      showNotif('Harap isi Nama Mata Pelajaran terlebih dahulu!', 'error');
      e.target.value = null;
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = window.XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = window.XLSX.utils.sheet_to_json(ws);

        let newCount = 0;
        let updateCount = 0;

        for (const row of data) {
          const cleanRow = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.toLowerCase().trim().replace(/\s+/g, '_');
            cleanRow[cleanKey] = row[key];
          });

          const nisn = String(cleanRow['nisn'] || '').trim();
          const name = cleanRow['nama_siswa'] || cleanRow['nama'] || 'No Name';
          const score = String(cleanRow['nilai'] || cleanRow['score'] || '0');
          
          if (!nisn) continue;

          const existingStudent = students.find(s => s.nisn === nisn);

          if (existingStudent) {
            const currentGrades = existingStudent.grades || [];
            const otherGrades = currentGrades.filter(g => g.name.toLowerCase() !== importConfig.subjectName.toLowerCase());
            const updatedGrades = [...otherGrades, { name: importConfig.subjectName, score: score }];
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', existingStudent.id), { grades: updatedGrades });
            updateCount++;
          } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'students'), {
              name: name,
              nisn: nisn,
              class: importConfig.className || 'Umum',
              semester: importConfig.semester,
              grades: [{ name: importConfig.subjectName, score: score }]
            });
            newCount++;
          }
        }
        showNotif(`Sukses! ${newCount} siswa baru, ${updateCount} nilai diupdate.`);
        e.target.value = null;
      } catch (err) {
        console.error(err);
        showNotif('Gagal membaca file Excel. Pastikan format benar.', 'error');
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.size < 100000) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school'), {
          logo: base64String
        });
        showNotif('Logo berhasil diperbarui');
      };
      reader.readAsDataURL(file);
    } else {
      showNotif('Ukuran file terlalu besar (Max 100KB)', 'error');
    }
  };

  const handleSaveSettings = () => {
     updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school'), { name: schoolData.name });
     showNotif('Pengaturan disimpan!');
  };

  const deleteStudent = async (id) => {
    if(confirm('Hapus data siswa ini?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', id));
      showNotif('Data dihapus');
    }
  };

  // --- RENDER FUNCTIONS ---

  const renderHeader = () => (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
          {schoolData.logo ? (
            <img src={schoolData.logo} alt="Logo" className="h-10 w-10 object-contain" />
          ) : (
            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <School size={24} />
            </div>
          )}
          <div>
            <h1 className="font-bold text-gray-900 leading-tight">{schoolData.name || 'Sekolah'}</h1>
            <p className="text-xs text-gray-500">Portal Akademik Siswa</p>
          </div>
        </div>
        <div>
          {isAdmin ? (
            <button onClick={() => { setIsAdmin(false); setView('home'); }} className="text-red-600 hover:bg-red-50 p-2 rounded-full transition">
              <LogOut size={20} />
            </button>
          ) : (
            <button onClick={() => setView('login_admin')} className="text-gray-500 hover:text-blue-600 font-medium text-sm">
              Admin
            </button>
          )}
        </div>
      </div>
    </header>
  );

  const renderStudentSearchView = () => (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
        <div className="bg-blue-600 p-8 text-center">
          <Award className="w-16 h-16 text-blue-100 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white">Cek Nilai Ujian</h2>
          <p className="text-blue-100 text-sm mt-2">Masukkan NISN untuk melihat hasil studi</p>
        </div>
        
        <div className="p-8 space-y-6">
          {/* Input NISN Utama */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Induk Siswa Nasional (NISN)</label>
            <div className="relative">
              <Hash className="absolute left-3 top-3 text-gray-400" size={18} />
              <input 
                type="text" 
                value={searchNisn}
                onChange={handleNisnSearchInput}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition font-mono text-lg tracking-wide"
                placeholder="Contoh: 0051234567"
                autoFocus
              />
            </div>
          </div>

          {/* Read-Only Name Display for Confirmation */}
          <div className={`transition-all duration-300 ${foundStudentName ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-2'}`}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Siswa (Konfirmasi)</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={18} />
              <input 
                type="text" 
                value={foundStudentName || ''}
                readOnly
                className={`w-full pl-10 pr-4 py-2.5 border rounded-lg outline-none transition ${foundStudentName ? 'bg-green-50 border-green-200 text-green-800 font-semibold' : 'bg-gray-100 border-gray-200 text-gray-400'}`}
                placeholder={searchNisn ? "Mencari data..." : "Nama akan muncul otomatis"}
              />
              {foundStudentName && (
                <CheckCircle className="absolute right-3 top-3 text-green-600" size={18} />
              )}
            </div>
            {foundStudentName ? (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle size={12} /> Data ditemukan. Silakan lanjut.
              </p>
            ) : searchNisn.length > 3 ? (
               <p className="text-xs text-red-400 mt-1">Data tidak ditemukan.</p>
            ) : null}
          </div>

          <button 
            onClick={checkGrades}
            disabled={!foundStudentName}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-lg transform transition active:scale-95 ${!foundStudentName ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}
          >
            Lihat Nilai
          </button>
        </div>
      </div>
    </div>
  );

  const renderStudentResultView = () => (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-20">
      <button onClick={() => setView('home')} className="mb-6 flex items-center text-gray-500 hover:text-blue-600 transition">
        <span className="mr-2">←</span> Kembali ke Pencarian
      </button>

      {selectedStudent && (
        <div className="animate-fade-in-up">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{selectedStudent.name}</h2>
              <div className="flex gap-4 mt-2 text-sm text-gray-600">
                <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full border border-blue-100">NISN: {selectedStudent.nisn}</span>
                <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-100">Kelas: {selectedStudent.class}</span>
                <span className="bg-gray-50 text-gray-700 px-3 py-1 rounded-full border border-gray-100">Semester: {selectedStudent.semester}</span>
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-gray-400 text-sm">Tahun Ajaran</p>
              <p className="font-semibold text-gray-700">2024/2025</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedStudent.grades && selectedStudent.grades.map((subject, idx) => {
              const grade = calculateGrade(subject.score);
              return (
                <div key={idx} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                  <div>
                    <h3 className="font-semibold text-gray-700 text-lg mb-1">{subject.name}</h3>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">Mata Pelajaran</p>
                  </div>
                  <div className="mt-4 flex items-end justify-between border-t border-gray-50 pt-4">
                    <div>
                      <span className="text-3xl font-bold text-gray-900">{subject.score}</span>
                      <span className="text-gray-400 text-sm">/100</span>
                    </div>
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-xl ${getGradeColor(grade)}`}>
                      {grade}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-8 bg-blue-900 text-white rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center shadow-lg shadow-blue-900/20">
            <div>
              <h4 className="text-xl font-bold">Ringkasan Prestasi</h4>
              <p className="text-blue-200 text-sm">Rata-rata nilai keseluruhan kamu.</p>
            </div>
            <div className="mt-4 sm:mt-0 text-4xl font-bold">
              {(selectedStudent.grades.reduce((a, b) => a + Number(b.score), 0) / (selectedStudent.grades.length || 1)).toFixed(1)}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAdminLogin = () => (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm relative overflow-hidden animate-fade-in-up">
        {/* Decorative Top Bar */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-purple-600"></div>
        
        <div className="text-center mb-8 mt-2">
           {schoolData.logo ? (
             <img src={schoolData.logo} alt="Logo" className="w-16 h-16 object-contain mx-auto mb-4" />
          ) : (
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
               <Shield size={32} />
            </div>
          )}
          <h2 className="text-2xl font-bold text-gray-800">Admin Portal</h2>
          <p className="text-gray-500 text-sm">Akses aman data sekolah</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-400" size={18} />
              <input 
                type="text" 
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Masukkan username"
                autoFocus 
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
              <input 
                type="password" 
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        <button 
          onClick={handleAdminLogin}
          className="w-full mt-6 bg-gray-900 text-white py-3.5 rounded-xl font-bold hover:bg-gray-800 transition shadow-lg shadow-gray-900/20 transform active:scale-95"
        >
          Masuk Dashboard
        </button>
        <button onClick={() => setView('home')} className="w-full mt-4 text-gray-400 text-sm hover:text-gray-600 font-medium">
          ← Kembali ke Beranda
        </button>
      </div>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 pb-20">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
          <button 
            onClick={() => setActiveAdminTab('students')}
            className={`p-3 rounded-lg text-left flex items-center gap-3 whitespace-nowrap ${activeAdminTab === 'students' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <User size={18} /> Data Siswa
          </button>
          <button 
            onClick={() => setActiveAdminTab('manual')}
            className={`p-3 rounded-lg text-left flex items-center gap-3 whitespace-nowrap ${activeAdminTab === 'manual' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <BookOpen size={18} /> Input Manual
          </button>
          <button 
            onClick={() => setActiveAdminTab('import')}
            className={`p-3 rounded-lg text-left flex items-center gap-3 whitespace-nowrap ${activeAdminTab === 'import' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <FileSpreadsheet size={18} /> Import Excel
          </button>
          <button 
            onClick={() => setActiveAdminTab('settings')}
            className={`p-3 rounded-lg text-left flex items-center gap-3 whitespace-nowrap ${activeAdminTab === 'settings' ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <School size={18} /> Pengaturan Sekolah
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-[60vh] bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          
          {activeAdminTab === 'students' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-800">Daftar Siswa ({students.length})</h3>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Cari..." 
                    className="pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                    value={searchTerm} // Explicit binding
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-500 text-sm">
                      <th className="py-3 px-2">Nama</th>
                      <th className="py-3 px-2">NISN</th>
                      <th className="py-3 px-2">Kelas</th>
                      <th className="py-3 px-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {students
                      .filter(s => s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(s => (
                      <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 group">
                        <td className="py-3 px-2 font-medium text-gray-800">{s.name}</td>
                        <td className="py-3 px-2 text-gray-500">{s.nisn}</td>
                        <td className="py-3 px-2 text-gray-500">{s.class}</td>
                        <td className="py-3 px-2 text-right">
                          <button onClick={() => deleteStudent(s.id)} className="text-red-400 hover:text-red-600 p-1">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {students.length === 0 && <p className="text-center py-10 text-gray-400">Belum ada data siswa.</p>}
              </div>
            </div>
          )}

          {activeAdminTab === 'manual' && (
            <div className="max-w-2xl">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Input Data Siswa Manual</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                  <input 
                    type="text" 
                    value={manualEntry.name}
                    onChange={(e) => setManualEntry({...manualEntry, name: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 outline-none"
                    placeholder="Contoh: Ahmad"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NISN</label>
                  <input 
                    type="text" 
                    value={manualEntry.nisn}
                    onChange={(e) => setManualEntry({...manualEntry, nisn: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 outline-none"
                    placeholder="12345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
                  <input 
                    type="text" 
                    value={manualEntry.class}
                    onChange={(e) => setManualEntry({...manualEntry, class: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 outline-none"
                    placeholder="XII IPA 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                  <select 
                    value={manualEntry.semester}
                    onChange={(e) => setManualEntry({...manualEntry, semester: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 outline-none"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
              </div>

              <div className="mt-8 mb-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                    <BookOpen size={18} /> Mata Pelajaran & Nilai
                  </h4>
                  <button onClick={addSubjectRow} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center">
                    <Plus size={16} className="mr-1" /> Tambah Mapel
                  </button>
                </div>
                
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {manualEntry.subjects.map((subj, idx) => (
                    <div key={idx} className="flex gap-2 items-center animate-fade-in-up">
                      <div className="flex-1">
                        <input 
                          type="text" 
                          placeholder="Nama Mapel (Cth: Matematika)"
                          value={subj.name}
                          onChange={(e) => handleSubjectChange(idx, 'name', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <div className="w-24">
                        <input 
                          type="number" 
                          placeholder="Nilai"
                          value={subj.score}
                          onChange={(e) => handleSubjectChange(idx, 'score', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                      <button 
                        onClick={() => removeSubjectRow(idx)}
                        disabled={manualEntry.subjects.length === 1}
                        className={`p-2 rounded-lg ${manualEntry.subjects.length === 1 ? 'text-gray-300' : 'text-red-500 hover:bg-red-50'}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={saveManualEntry}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
              >
                Simpan Data Siswa
              </button>
            </div>
          )}

          {activeAdminTab === 'import' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileSpreadsheet className="text-green-600" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Import Nilai per Mapel</h3>
              <p className="text-gray-500 max-w-md mx-auto mt-1 mb-6 text-sm">
                Upload daftar nilai untuk 1 mata pelajaran sekaligus. <br/>
                Sistem akan otomatis menambah nilai ke siswa berdasarkan NISN.
              </p>

              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 max-w-md mx-auto mb-6 text-left">
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Mata Pelajaran (Wajib)</label>
                  <input 
                    type="text" 
                    placeholder="Contoh: Bahasa Indonesia"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 outline-none"
                    value={importConfig.subjectName}
                    onChange={(e) => setImportConfig({...importConfig, subjectName: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kelas (Untuk Siswa Baru)</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: XII IPA 1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 outline-none"
                      value={importConfig.className}
                      onChange={(e) => setImportConfig({...importConfig, className: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                    <select 
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 outline-none"
                      value={importConfig.semester}
                      onChange={(e) => setImportConfig({...importConfig, semester: e.target.value})}
                    >
                      <option value="Ganjil">Ganjil</option>
                      <option value="Genap">Genap</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <label className={`inline-flex items-center px-6 py-3 font-medium rounded-xl transition shadow-lg ${importConfig.subjectName ? 'bg-green-600 text-white hover:bg-green-700 cursor-pointer shadow-green-600/20' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}>
                <Upload size={20} className="mr-2" />
                {loading ? 'Memproses...' : 'Pilih File Excel'}
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={!importConfig.subjectName || loading}
                />
              </label>

              <div className="mt-6 text-xs text-gray-400 border-t border-gray-100 pt-4">
                Format Excel: Kolom <strong>NISN</strong>, <strong>Nama Siswa</strong>, dan <strong>NILAI</strong> wajib ada.
              </div>
            </div>
          )}

          {activeAdminTab === 'settings' && (
            <div className="max-w-lg">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Identitas Sekolah</h3>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Logo Sekolah</label>
                <div className="flex items-center gap-4">
                  {schoolData.logo ? (
                    <img src={schoolData.logo} className="w-20 h-20 object-contain border rounded-lg" />
                  ) : (
                    <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">No Logo</div>
                  )}
                  <label className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition">
                    Ubah Logo
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-2">Maksimal 100KB. Format PNG/JPG.</p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Nama Sekolah</label>
                <input 
                  type="text" 
                  value={schoolData.name}
                  onChange={(e) => setSchoolData({...schoolData, name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <button 
                onClick={handleSaveSettings}
                className="flex items-center bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition"
              >
                <Save size={18} className="mr-2" /> Simpan Perubahan
              </button>

              <div className="mt-10 border-t border-gray-200 pt-8">
                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                   <Shield size={20} className="text-blue-600" /> Keamanan Admin
                </h3>
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username Baru</label>
                      <input 
                        type="text" 
                        value={adminCredentials.username}
                        onChange={(e) => setAdminCredentials({...adminCredentials, username: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 outline-none bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                      <input 
                        type="text" 
                        value={adminCredentials.password}
                        onChange={(e) => setAdminCredentials({...adminCredentials, password: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-blue-500 outline-none bg-white"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleUpdateAdminCreds}
                    className="w-full md:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                  >
                    Update Login Admin
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] px-6 py-3 rounded-lg shadow-xl text-white font-medium flex items-center animate-bounce-in ${notification.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
           {notification.type === 'success' && <CheckCircle size={18} className="mr-2" />}
           {notification.msg}
        </div>
      )}

      {renderHeader()}
      
      <main>
        {view === 'home' && renderStudentSearchView()}
        {view === 'result' && renderStudentResultView()}
        {view === 'login_admin' && renderAdminLogin()}
        {view === 'admin' && renderAdminDashboard()}
      </main>
    </div>
  );
}