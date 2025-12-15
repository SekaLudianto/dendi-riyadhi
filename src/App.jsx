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
  School, User, Award, Save, Trash2, Plus, Menu, X, CheckCircle, BookOpen, Calculator, Filter, Lock, Shield, Hash, Home, MapPin, Calendar, Eye, ChevronRight, Star, Quote, ArrowUpDown, ArrowUp, ArrowDown 
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

// --- CONSTANTS ---
const MOTIVATIONAL_QUOTES = [
  "Pendidikan adalah senjata paling ampuh untuk mengubah dunia. Teruslah berjuang!",
  "Jangan pernah menyerah. Pemenang tidak pernah berhenti berusaha, dan orang yang berhenti berusaha tidak pernah menang.",
  "Masa depan adalah milik mereka yang percaya pada keindahan mimpi mereka.",
  "Kesuksesan tidak datang kepadamu, kamulah yang harus pergi menjemputnya dengan belajar giat.",
  "Setiap langkah kecil dalam belajar membawamu lebih dekat ke tujuan besar dalam hidup.",
  "Prestasi bukanlah kebetulan, melainkan hasil dari kerja keras, ketekunan, dan doa.",
  "Jadikan nilai ini sebagai pijakan untuk melompat lebih tinggi. Kamu hebat!",
  "Ilmu itu seperti cahaya, ia akan menerangi jalan hidupmu di masa depan.",
  "Teruslah bersinar! Dunia menantikan karya besarmu.",
  "Kegagalan adalah kesempatan untuk memulai lagi dengan lebih cerdas. Tetap semangat!"
];

// --- HELPER FUNCTIONS ---
const calculateGrade = (score) => {
  // Fallback function jika predikat kosong
  const s = Number(score);
  if (s >= 90) return 'A';
  if (s >= 80) return 'B';
  if (s >= 70) return 'C';
  if (s >= 60) return 'D';
  return 'E';
};

const getGradeColor = (grade) => {
  if (!grade) return 'text-slate-700 bg-slate-50 border-slate-100';
  
  const g = String(grade).toUpperCase();
  // Logika warna adaptif untuk predikat huruf atau kata
  if (g === 'A' || g.includes('SANGAT') || g.includes('EXCELLENT')) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (g === 'B' || g.includes('BAIK') || g.includes('GOOD')) return 'text-blue-700 bg-blue-50 border-blue-100';
  if (g === 'C' || g.includes('CUKUP')) return 'text-amber-700 bg-amber-50 border-amber-100';
  if (g === 'D' || g.includes('KURANG')) return 'text-orange-700 bg-orange-50 border-orange-100';
  return 'text-rose-700 bg-rose-50 border-rose-100';
};

// --- MAIN COMPONENT ---
export default function App() {
  // State: App Flow
  const [view, setView] = useState('home'); // home, result, admin, login_admin
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // State: Data
  const [schoolData, setSchoolData] = useState({ 
    name: 'SMP Negeri 1 Cibingbin', 
    logo: 'logo.jpg', 
    location: 'Cibingbin, Kuningan', 
    academicYear: '2025/2026',
    semesterTitle: 'Semester Ganjil'
  });
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  
  // State: Motivation
  const [currentQuote, setCurrentQuote] = useState("");

  // State: Admin Auth (Modified to use localStorage)
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('school_app_is_admin') === 'true';
  });
  
  const [adminCredentials, setAdminCredentials] = useState({ username: 'marquan', password: 'pirelli' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  // State: Admin View Detail
  const [viewingStudentGrades, setViewingStudentGrades] = useState(null);

  // State: Search & Sort
  const [searchTerm, setSearchTerm] = useState('');
  const [searchNisn, setSearchNisn] = useState(''); 
  const [foundStudentName, setFoundStudentName] = useState(null); 
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  // Admin Forms
  const [activeAdminTab, setActiveAdminTab] = useState('students');
  
  // State Input Manual
  const [manualEntry, setManualEntry] = useState({
    name: '', nisn: '', class: '', semester: 'Ganjil',
    subjects: [{ name: 'Matematika', score: '', predicate: '' }]
  });

  // State Import Excel
  const [importConfig, setImportConfig] = useState({
    subjectName: '', className: '', semester: 'Ganjil'
  });

  // --- INITIALIZATION & META VIEWPORT ---
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (error) { console.error("Auth error:", error); }
    };
    initAuth();

    // Load SheetJS
    const script = document.createElement('script');
    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.async = true;
    document.body.appendChild(script);

    // Set Meta Viewport
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
  }, []);

  // --- FIRESTORE LISTENERS ---
  useEffect(() => {
    const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school');
    const unsubSchool = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setSchoolData({
          name: 'SMP Negeri 1 Cibingbin',
          location: 'Cibingbin, Kuningan',
          academicYear: '2025/2026',
          semesterTitle: 'Semester Ganjil',
          logo: 'logo.jpg',
          ...docSnap.data()
        });
      } else {
        setDoc(settingsDocRef, { 
          name: 'SMP Negeri 1 Cibingbin', 
          logo: 'logo.jpg',
          location: 'Cibingbin, Kuningan',
          academicYear: '2025/2026',
          semesterTitle: 'Semester Ganjil'
        });
      }
    }, (error) => console.log("School listener error:", error));

    const adminSettingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin');
    const unsubAdmin = onSnapshot(adminSettingsRef, (docSnap) => {
      if (docSnap.exists()) setAdminCredentials(docSnap.data());
      else setDoc(adminSettingsRef, { username: 'marquan', password: 'pirelli' });
    }, (error) => console.log("Admin creds listener error:", error));

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'students'));
    const unsubStudents = onSnapshot(q, (snapshot) => {
      const studentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsList);
    }, (error) => console.log("Students listener error:", error));

    return () => { unsubSchool(); unsubAdmin(); unsubStudents(); };
  }, []);

  // --- LOGIC FUNCTIONS ---
  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAdminLogin = () => {
    if (loginForm.username === adminCredentials.username && loginForm.password === adminCredentials.password) {
      setIsAdmin(true);
      localStorage.setItem('school_app_is_admin', 'true');
      setView('admin');
      showNotif('Login Admin Berhasil');
      setLoginForm({ username: '', password: '' });
    } else {
      showNotif('Username atau Password Salah!', 'error');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('school_app_is_admin');
    setView('home');
  };

  const handleUpdateAdminCreds = async () => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin'), {
        username: adminCredentials.username,
        password: adminCredentials.password
      });
      showNotif('Data Login Admin berhasil diperbarui!');
    } catch (e) { showNotif('Gagal update data login', 'error'); }
  };

  const handleNisnSearchInput = (e) => {
    const nisn = e.target.value;
    setSearchNisn(nisn);
    const student = students.find(s => s.nisn === nisn);
    if (student) {
      setFoundStudentName(student.name);
      setSearchTerm(student.name);
    } else {
      setFoundStudentName(null);
      setSearchTerm('');
    }
  };

  const checkGrades = () => {
    const student = students.find(s => s.nisn === searchNisn);
    if (student) {
      setSelectedStudent(student);
      // Select random motivational quote
      const randomQuote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
      setCurrentQuote(randomQuote);
      setView('result');
    } else {
      showNotif('NISN tidak ditemukan di database.', 'error');
    }
  };

  const handleSubjectChange = (index, field, value) => {
    const newSubjects = [...manualEntry.subjects];
    newSubjects[index][field] = value;
    setManualEntry({ ...manualEntry, subjects: newSubjects });
  };
  
  const addSubjectRow = () => setManualEntry({ 
    ...manualEntry, 
    subjects: [...manualEntry.subjects, { name: '', score: '', predicate: '' }] 
  });
  
  const removeSubjectRow = (index) => {
    const newSubjects = manualEntry.subjects.filter((_, i) => i !== index);
    setManualEntry({ ...manualEntry, subjects: newSubjects });
  };
  
  const saveManualEntry = async () => {
    if (!manualEntry.name || !manualEntry.nisn) { showNotif('Nama dan NISN wajib diisi', 'error'); return; }
    
    // Validate subjects
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
      setManualEntry({ name: '', nisn: '', class: '', semester: 'Ganjil', subjects: [{ name: 'Matematika', score: '', predicate: '' }] });
    } catch (error) { console.error(error); showNotif('Gagal menyimpan data', 'error'); }
  };
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!importConfig.subjectName) { showNotif('Harap isi Nama Mata Pelajaran terlebih dahulu!', 'error'); e.target.value = null; return; }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
        const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let newCount = 0, updateCount = 0;
        
        for (const row of data) {
          const cleanRow = {};
          Object.keys(row).forEach(key => cleanRow[key.toLowerCase().trim().replace(/\s+/g, '_')] = row[key]);
          
          const nisn = String(cleanRow['nisn'] || '').trim();
          const name = cleanRow['nama_siswa'] || cleanRow['nama'] || 'No Name';
          const score = String(cleanRow['nilai'] || cleanRow['score'] || '0');
          // Extract Predicate from Excel
          const predicate = cleanRow['predikat'] || cleanRow['predicate'] || cleanRow['ket'] || '';
          
          if (!nisn) continue;
          
          const existingStudent = students.find(s => s.nisn === nisn);
          if (existingStudent) {
            const otherGrades = (existingStudent.grades || []).filter(g => g.name.toLowerCase() !== importConfig.subjectName.toLowerCase());
            const updatedGrades = [...otherGrades, { 
              name: importConfig.subjectName, 
              score: score, 
              predicate: predicate 
            }];
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', existingStudent.id), { grades: updatedGrades });
            updateCount++;
          } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'students'), {
              name: name, 
              nisn: nisn, 
              class: importConfig.className || 'Umum', 
              semester: importConfig.semester, 
              grades: [{ 
                name: importConfig.subjectName, 
                score: score, 
                predicate: predicate 
              }]
            });
            newCount++;
          }
        }
        showNotif(`Sukses! ${newCount} siswa baru, ${updateCount} nilai diupdate.`);
        e.target.value = null;
      } catch (err) { console.error(err); showNotif('Gagal membaca file Excel.', 'error'); } 
      finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };
  
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.size < 100000) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school'), { logo: reader.result });
        showNotif('Logo berhasil diperbarui');
      };
      reader.readAsDataURL(file);
    } else { showNotif('Ukuran file terlalu besar (Max 100KB)', 'error'); }
  };
  const handleSaveSettings = () => {
     updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school'), { 
       name: schoolData.name,
       location: schoolData.location || '',
       academicYear: schoolData.academicYear || '',
       semesterTitle: schoolData.semesterTitle || ''
     });
     showNotif('Pengaturan disimpan!');
  };
  const deleteStudent = async (id) => {
    if(confirm('Hapus data siswa ini?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', id));
      showNotif('Data dihapus');
    }
  };

  // --- SORTING LOGIC ---
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedStudents = React.useMemo(() => {
    let sortableItems = [...students];
    if (searchTerm) {
      sortableItems = sortableItems.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.nisn.includes(searchTerm) ||
        (s.class && s.class.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key] ? String(a[sortConfig.key]).toLowerCase() : '';
        const valB = b[sortConfig.key] ? String(b[sortConfig.key]).toLowerCase() : '';
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [students, searchTerm, sortConfig]);

  // --- RENDER FUNCTIONS ---

  const renderHeader = () => (
    <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 sticky top-0 z-40 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {view !== 'home' ? (
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setView('home')}>
            <div className="relative">
              {schoolData.logo ? (
                <img src={schoolData.logo} alt="Logo" className="h-10 w-10 object-cover rounded-full border border-gray-100 group-hover:scale-105 transition-transform" />
              ) : (
                <div className="h-10 w-10 bg-indigo-900 rounded-full flex items-center justify-center text-white shadow-md group-hover:shadow-lg transition-all">
                  <School size={20} />
                </div>
              )}
            </div>
            <div>
              <h1 className="font-bold text-gray-900 leading-tight text-sm sm:text-base uppercase tracking-tight">{schoolData.name || 'Sekolah'}</h1>
              {schoolData.location && <p className="text-[10px] sm:text-xs text-gray-500 font-medium">{schoolData.location}</p>}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
             <div className="text-gray-400 text-xs font-semibold tracking-wider uppercase">Portal Akademik</div>
          </div>
        )}

        <div className="hidden md:block">
          {isAdmin ? (
            <button onClick={handleLogout} className="text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-full transition font-medium text-sm flex items-center gap-2">
              <LogOut size={16} /> Keluar
            </button>
          ) : (
            <button onClick={() => setView('login_admin')} className="text-slate-500 hover:text-indigo-900 font-medium text-sm transition-colors">
              Akses Guru
            </button>
          )}
        </div>
      </div>
    </header>
  );

  const renderMobileBottomNav = () => (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-200 px-6 py-2 flex justify-around items-center z-50 shadow-2xl safe-area-pb">
      <button 
        onClick={() => setView('home')}
        className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 ${view === 'home' || view === 'result' ? 'text-indigo-700 bg-indigo-50 -translate-y-1' : 'text-slate-400'}`}
      >
        <Home size={24} strokeWidth={view === 'home' || view === 'result' ? 2.5 : 2} />
        <span className="text-[10px] font-bold">Beranda</span>
      </button>
      
      <button 
        onClick={() => setView(isAdmin ? 'admin' : 'login_admin')}
        className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all duration-300 ${view === 'admin' || view === 'login_admin' ? 'text-indigo-700 bg-indigo-50 -translate-y-1' : 'text-slate-400'}`}
      >
        <Shield size={24} strokeWidth={view === 'admin' || view === 'login_admin' ? 2.5 : 2} />
        <span className="text-[10px] font-bold">Admin</span>
      </button>
    </div>
  );

  const renderStudentSearchView = () => (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-50"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-white/50 p-8 text-center relative z-10 backdrop-blur-sm">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-28 h-28 rounded-full bg-white flex items-center justify-center shadow-xl mb-6 overflow-hidden ring-4 ring-indigo-50 p-1">
             {schoolData.logo ? (
                <img src={schoolData.logo} alt="Logo" className="w-full h-full object-cover rounded-full" />
             ) : (
                <div className="w-full h-full bg-gradient-to-br from-indigo-800 to-blue-700 rounded-full flex items-center justify-center">
                  <BookOpen size={48} className="text-white opacity-90" />
                </div>
             )}
          </div>
          
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 uppercase tracking-tight leading-tight mb-2">
            {schoolData.name || 'NAMA SEKOLAH'}
          </h1>
          
          <div className="flex items-center gap-1.5 text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-full text-xs">
            <MapPin size={12} />
            {schoolData.location || 'Lokasi Sekolah'}
          </div>

          <div className="w-12 h-1 bg-indigo-600 rounded-full my-6 opacity-20"></div>

          <h2 className="text-lg font-bold text-slate-800 mb-1">
            Pengumuman Nilai Rapor
          </h2>
          
          <p className="text-indigo-600 font-semibold text-sm uppercase tracking-wide">
             {schoolData.semesterTitle || 'Semester Ganjil'}
          </p>
          
          <p className="text-slate-400 text-xs mt-1">
             Tahun Pelajaran {schoolData.academicYear || '2025/2026'}
          </p>
        </div>

        <div className="space-y-4 text-left">
          <div className="relative group">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 ml-1">NISN Siswa</label>
            <div className="relative">
              <Hash className="absolute left-3 top-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
              <input 
                type="number" 
                pattern="[0-9]*"
                inputMode="numeric"
                value={searchNisn}
                onChange={handleNisnSearchInput}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-lg tracking-wide text-slate-700 placeholder:text-slate-300 shadow-sm"
                placeholder="00XXXXXX"
              />
            </div>
          </div>

          <div className={`transition-all duration-500 ease-out ${foundStudentName ? 'opacity-100 translate-y-0 max-h-20' : 'opacity-0 -translate-y-2 max-h-0 overflow-hidden'}`}>
            <div className="relative">
              <User className="absolute left-3 top-3.5 text-emerald-600" size={18} />
              <input 
                type="text" 
                value={foundStudentName || ''}
                readOnly
                className="w-full pl-10 pr-10 py-3 border border-emerald-200 rounded-xl outline-none bg-emerald-50 text-emerald-900 font-bold shadow-sm"
              />
              <CheckCircle className="absolute right-3 top-3.5 text-emerald-600 animate-pulse" size={18} />
            </div>
          </div>

          <button 
            onClick={checkGrades}
            disabled={!foundStudentName}
            className={`w-full py-4 rounded-xl font-bold text-white text-lg shadow-lg shadow-indigo-200 transform transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 ${!foundStudentName ? 'bg-slate-300 cursor-not-allowed text-slate-100 shadow-none' : 'bg-gradient-to-r from-indigo-700 to-blue-600 hover:from-indigo-800 hover:to-blue-700'}`}
          >
            {loading ? 'Memuat...' : (
              <>
                <BookOpen size={20} /> Lihat Rapor
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const renderStudentResultView = () => (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 p-4 sm:p-6 pb-24">
      <div className="max-w-4xl mx-auto">
        <button onClick={() => setView('home')} className="mb-6 flex items-center text-slate-500 hover:text-indigo-700 transition-colors font-medium text-sm group bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100 w-fit">
          <ChevronRight className="mr-1 rotate-180 group-hover:-translate-x-1 transition-transform" size={16} /> Kembali
        </button>

        {selectedStudent && (
          <div className="animate-fade-in-up space-y-6">
            {/* ID Card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-white p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-50 to-transparent rounded-bl-full"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">{selectedStudent.name}</h2>
                  <div className="flex flex-wrap gap-2 mt-4 text-xs sm:text-sm font-medium">
                    <span className="bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-1"><Hash size={14}/> {selectedStudent.nisn}</span>
                    <span className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200">{selectedStudent.class}</span>
                    <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100">{selectedStudent.semester}</span>
                  </div>
                </div>
                <div className="w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-dashed border-slate-200 md:text-right">
                  <p className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">Tahun Ajaran</p>
                  <p className="font-bold text-slate-800 text-xl font-mono bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 inline-block">{schoolData.academicYear || '2025/2026'}</p>
                </div>
              </div>
            </div>

            {/* Motivational Quote Banner */}
            {currentQuote && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-5 flex gap-4 items-start shadow-sm relative overflow-hidden">
                <div className="bg-amber-100 p-2 rounded-full text-amber-600 shrink-0 relative z-10">
                  <Quote size={20} fill="currentColor" />
                </div>
                <div className="relative z-10">
                  <p className="text-amber-900 font-medium italic text-sm sm:text-base leading-relaxed">"{currentQuote}"</p>
                  <p className="text-amber-600/60 text-xs font-bold mt-2 uppercase tracking-widest">— Pesan Semangat</p>
                </div>
                {/* Decor */}
                <Star className="absolute -bottom-4 -right-4 text-amber-200/50 w-24 h-24 rotate-12" fill="currentColor" />
              </div>
            )}

            {/* Grades Table */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-white overflow-hidden">
              <div className="bg-slate-50/50 px-6 py-5 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                  <BookOpen size={20} className="text-indigo-600"/> Hasil Belajar
                </h3>
                <span className="text-xs font-bold bg-white border border-slate-200 px-2 py-1 rounded text-slate-400">RAPOR</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-4">Mata Pelajaran</th>
                      <th className="px-6 py-4 text-center w-32">Nilai</th>
                      <th className="px-6 py-4 text-center w-48">Predikat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedStudent.grades && selectedStudent.grades.map((subject, idx) => {
                      // Gunakan predikat dari data, jika tidak ada baru hitung
                      const grade = subject.predicate || calculateGrade(subject.score);
                      return (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                          <td className="px-6 py-4 font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors">{subject.name}</td>
                          <td className="px-6 py-4 text-center font-bold text-slate-800 font-mono text-lg">{subject.score}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center justify-center px-4 py-1.5 min-w-[3rem] rounded-xl text-sm font-bold border-2 ${getGradeColor(grade)} shadow-sm whitespace-nowrap`}>
                              {grade}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {(!selectedStudent.grades || selectedStudent.grades.length === 0) && (
                <div className="p-12 text-center flex flex-col items-center text-slate-400 gap-2">
                  <FileSpreadsheet size={40} strokeWidth={1.5} className="opacity-50" />
                  <p>Belum ada data nilai tersedia.</p>
                </div>
              )}
            </div>

            {/* Summary Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-blue-900 text-white rounded-3xl p-8 flex flex-col sm:flex-row justify-between items-center shadow-2xl shadow-indigo-900/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
              <div className="relative z-10 text-center sm:text-left mb-6 sm:mb-0">
                <h4 className="text-2xl font-bold mb-1">Rata-Rata Nilai</h4>
                <p className="text-indigo-200 text-sm font-medium">Akumulasi pencapaian akademik semester ini</p>
              </div>
              <div className="relative z-10 flex items-center justify-center">
                <div className="text-5xl font-black bg-white/10 px-8 py-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-inner">
                  {(selectedStudent.grades.reduce((a, b) => a + Number(b.score), 0) / (selectedStudent.grades.length || 1)).toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderAdminLogin = () => (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-slate-50">
      <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-2xl shadow-slate-200 border border-white w-full max-w-sm relative overflow-hidden animate-fade-in-up">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-600 to-blue-500"></div>
        
        <div className="text-center mb-10 mt-2">
           <div className="w-20 h-20 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center justify-center mx-auto mb-5 rotate-3 hover:rotate-0 transition-transform duration-300 shadow-sm border border-indigo-100">
              <Shield size={36} />
           </div>
          <h2 className="text-2xl font-bold text-slate-800">Admin Portal</h2>
          <p className="text-slate-500 text-sm mt-1">Verifikasi identitas untuk melanjutkan</p>
        </div>

        <div className="space-y-5">
          <div className="group">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Username</label>
            <div className="relative">
              <User className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
              <input 
                type="text" 
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-slate-700 font-medium"
                placeholder="Username admin"
              />
            </div>
          </div>
          <div className="group">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-indigo-600 transition-colors" size={18} />
              <input 
                type="password" 
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-slate-700 font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        <button 
          onClick={handleAdminLogin}
          className="w-full mt-8 bg-indigo-900 text-white py-4 rounded-xl font-bold hover:bg-indigo-800 transition shadow-lg shadow-indigo-900/20 transform active:scale-[0.98]"
        >
          Masuk Dashboard
        </button>
      </div>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 pb-24">
      {/* Tab Menu */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-64 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-hide">
          <button onClick={() => setActiveAdminTab('students')} className={`p-4 rounded-xl text-left flex items-center gap-3 whitespace-nowrap transition-all duration-200 font-medium ${activeAdminTab === 'students' ? 'bg-indigo-900 text-white shadow-lg shadow-indigo-900/20 translate-x-1' : 'bg-white text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}>
            <User size={20} /> Data Siswa
          </button>
          <button onClick={() => setActiveAdminTab('manual')} className={`p-4 rounded-xl text-left flex items-center gap-3 whitespace-nowrap transition-all duration-200 font-medium ${activeAdminTab === 'manual' ? 'bg-indigo-900 text-white shadow-lg shadow-indigo-900/20 translate-x-1' : 'bg-white text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}>
            <BookOpen size={20} /> Input Manual
          </button>
          <button onClick={() => setActiveAdminTab('import')} className={`p-4 rounded-xl text-left flex items-center gap-3 whitespace-nowrap transition-all duration-200 font-medium ${activeAdminTab === 'import' ? 'bg-indigo-900 text-white shadow-lg shadow-indigo-900/20 translate-x-1' : 'bg-white text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}>
            <FileSpreadsheet size={20} /> Import Excel
          </button>
          <button onClick={() => setActiveAdminTab('settings')} className={`p-4 rounded-xl text-left flex items-center gap-3 whitespace-nowrap transition-all duration-200 font-medium ${activeAdminTab === 'settings' ? 'bg-indigo-900 text-white shadow-lg shadow-indigo-900/20 translate-x-1' : 'bg-white text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-200'}`}>
            <School size={20} /> Pengaturan
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-[60vh] bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm relative">
          
          {/* MODAL: VIEW STUDENT GRADES */}
          {viewingStudentGrades && (
            <div className="absolute inset-0 z-50 bg-white rounded-3xl p-6 flex flex-col animate-fade-in-up">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{viewingStudentGrades.name}</h3>
                  <p className="text-sm text-slate-500 flex items-center gap-1"><Hash size={12}/> {viewingStudentGrades.nisn}</p>
                </div>
                <button onClick={() => setViewingStudentGrades(null)} className="p-2 hover:bg-slate-100 rounded-full transition">
                  <X size={24} className="text-slate-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 uppercase font-bold">
                      <th className="px-4 py-3 rounded-l-lg">Mata Pelajaran</th>
                      <th className="px-4 py-3 text-center w-24">Nilai</th>
                      <th className="px-4 py-3 text-center rounded-r-lg w-32">Predikat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {viewingStudentGrades.grades && viewingStudentGrades.grades.map((subject, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 text-slate-700 font-medium">{subject.name}</td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-700 bg-indigo-50/50">{subject.score}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-bold border ${getGradeColor(subject.predicate || calculateGrade(subject.score))}`}>
                            {subject.predicate || calculateGrade(subject.score)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeAdminTab === 'students' && (
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <h3 className="text-2xl font-bold text-slate-800">Daftar Siswa</h3>
                <div className="relative w-full sm:w-auto">
                  <Search size={18} className="absolute left-3 top-3 text-slate-400" />
                  <input type="text" placeholder="Cari nama..." className="w-full sm:w-72 pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                  <table className="min-w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase font-bold tracking-wider">
                        <th className="py-4 px-3">No</th>
                        <th className="py-4 px-3 cursor-pointer group hover:bg-slate-50 transition" onClick={() => handleSort('name')}>
                          <div className="flex items-center gap-1">
                            Nama
                            {sortConfig.key === 'name' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                            ) : <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50" />}
                          </div>
                        </th>
                        <th className="py-4 px-3 cursor-pointer group hover:bg-slate-50 transition" onClick={() => handleSort('nisn')}>
                          <div className="flex items-center gap-1">
                            NISN
                            {sortConfig.key === 'nisn' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                            ) : <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50" />}
                          </div>
                        </th>
                        <th className="py-4 px-3 hidden sm:table-cell cursor-pointer group hover:bg-slate-50 transition" onClick={() => handleSort('class')}>
                          <div className="flex items-center gap-1">
                            Kelas
                            {sortConfig.key === 'class' ? (
                              sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                            ) : <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50" />}
                          </div>
                        </th>
                        <th className="py-4 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-50">
                      {sortedStudents.map((s, index) => (
                        <tr key={s.id} className="hover:bg-slate-50 group transition">
                          <td className="py-4 px-3 text-slate-500">{index + 1}</td>
                          <td className="py-4 px-3 font-semibold text-slate-700">{s.name}</td>
                          <td className="py-4 px-3 text-slate-500 font-mono">{s.nisn}</td>
                          <td className="py-4 px-3 hidden sm:table-cell text-slate-500"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{s.class}</span></td>
                          <td className="py-4 px-3 text-right flex justify-end gap-2">
                            <button onClick={() => setViewingStudentGrades(s)} className="text-indigo-600 hover:text-indigo-800 p-2 hover:bg-indigo-50 rounded-lg transition" title="Lihat Detail">
                              <Eye size={18} />
                            </button>
                            <button onClick={() => deleteStudent(s.id)} className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded-lg transition" title="Hapus">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ... (Manual Input, Import, Settings code similar structure but refined styles) ... */}
          {activeAdminTab === 'manual' && (
            <div className="max-w-2xl">
              <h3 className="text-2xl font-bold text-slate-800 mb-6">Input Data Manual</h3>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">Nama Lengkap</label><input type="text" value={manualEntry.name} onChange={(e) => setManualEntry({...manualEntry, name: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Cth: Ahmad" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">NISN</label><input type="number" value={manualEntry.nisn} onChange={(e) => setManualEntry({...manualEntry, nisn: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Nomor Induk" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 mb-1">Kelas</label><input type="text" value={manualEntry.class} onChange={(e) => setManualEntry({...manualEntry, class: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Cth: IX A" /></div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Semester</label>
                    <select value={manualEntry.semester} onChange={(e) => setManualEntry({...manualEntry, semester: e.target.value})} className="w-full px-4 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="Ganjil">Ganjil</option><option value="Genap">Genap</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-slate-700">Mata Pelajaran & Nilai</h4>
                  <button onClick={addSubjectRow} className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 transition flex items-center gap-1"><Plus size={14} /> Tambah Baris</button>
                </div>
                <div className="space-y-2">
                  {manualEntry.subjects.map((subj, idx) => (
                    <div key={idx} className="flex gap-2 items-center animate-fade-in-up">
                      <input type="text" placeholder="Nama Mapel" value={subj.name} onChange={(e) => handleSubjectChange(idx, 'name', e.target.value)} className="flex-1 px-4 py-2 border rounded-lg text-sm focus:border-indigo-500 outline-none" />
                      <input type="number" placeholder="Nilai" value={subj.score} onChange={(e) => handleSubjectChange(idx, 'score', e.target.value)} className="w-20 px-4 py-2 border rounded-lg text-sm text-center focus:border-indigo-500 outline-none" />
                      <input type="text" placeholder="Predikat" value={subj.predicate} onChange={(e) => handleSubjectChange(idx, 'predicate', e.target.value)} className="w-24 px-4 py-2 border rounded-lg text-sm text-center focus:border-indigo-500 outline-none" />
                      <button onClick={() => removeSubjectRow(idx)} disabled={manualEntry.subjects.length === 1} className="p-2 text-slate-400 hover:text-rose-500 transition"><Trash2 size={18} /></button>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={saveManualEntry} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition">Simpan Data Siswa</button>
            </div>
          )}

          {activeAdminTab === 'import' && (
            <div className="text-center py-10">
              <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
                <FileSpreadsheet className="text-emerald-600" size={40} />
              </div>
              <h3 className="text-2xl font-bold text-slate-800 mb-2">Import Excel</h3>
              <p className="text-slate-500 text-sm mb-8 max-w-sm mx-auto">Upload file Excel berisi rekap nilai per mata pelajaran untuk mempercepat input data.</p>
              
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 max-w-md mx-auto mb-8 text-left space-y-4">
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Mapel (Wajib)</label><input type="text" className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Cth: Bahasa Indonesia" value={importConfig.subjectName} onChange={(e) => setImportConfig({...importConfig, subjectName: e.target.value})} /></div>
                <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kelas (Opsional)</label><input type="text" className="w-full px-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Untuk siswa baru" value={importConfig.className} onChange={(e) => setImportConfig({...importConfig, className: e.target.value})} /></div>
              </div>
              
              <label className={`inline-flex items-center px-8 py-4 rounded-xl font-bold transition shadow-lg gap-2 ${importConfig.subjectName ? 'bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer hover:-translate-y-1' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
                <Upload size={20} />
                {loading ? 'Sedang Memproses...' : 'Pilih File Excel'}
                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} disabled={!importConfig.subjectName || loading} />
              </label>
            </div>
          )}

          {activeAdminTab === 'settings' && (
            <div className="max-w-lg">
              <h3 className="text-2xl font-bold text-slate-800 mb-6">Pengaturan Sekolah</h3>
              
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                <div className="flex items-center gap-6 mb-6">
                  {schoolData.logo ? 
                    <img src={schoolData.logo} className="w-20 h-20 object-cover border rounded-full shadow-md" /> : 
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 border border-dashed border-slate-300">No Logo</div>
                  }
                  <div>
                    <label className="cursor-pointer bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-900 transition inline-block mb-2">
                      Ganti Logo
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                    <p className="text-[10px] text-slate-400">Max 100KB (PNG/JPG)</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Sekolah</label><input type="text" value={schoolData.name} onChange={(e) => setSchoolData({...schoolData, name: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none" /></div>
                  <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Alamat</label><input type="text" value={schoolData.location || ''} onChange={(e) => setSchoolData({...schoolData, location: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tahun Ajaran</label><input type="text" value={schoolData.academicYear || ''} onChange={(e) => setSchoolData({...schoolData, academicYear: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none" /></div>
                    <div><label className="block text-xs font-bold text-slate-500 uppercase mb-1">Semester</label><input type="text" value={schoolData.semesterTitle || ''} onChange={(e) => setSchoolData({...schoolData, semesterTitle: e.target.value})} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-slate-400 outline-none" /></div>
                  </div>
                </div>
                
                <button onClick={handleSaveSettings} className="w-full mt-6 bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition flex items-center justify-center gap-2">
                  <Save size={18} /> Simpan Perubahan
                </button>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h4 className="text-sm font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Shield size={14}/> Akun Admin</h4>
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
                  <input type="text" value={adminCredentials.username} onChange={(e) => setAdminCredentials({...adminCredentials, username: e.target.value})} className="w-full px-4 py-2 border rounded-lg bg-white text-sm" placeholder="Username Baru" />
                  <input type="text" value={adminCredentials.password} onChange={(e) => setAdminCredentials({...adminCredentials, password: e.target.value})} className="w-full px-4 py-2 border rounded-lg bg-white text-sm" placeholder="Password Baru" />
                  <button onClick={handleUpdateAdminCreds} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition">Update Login</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-0 safe-area-bottom">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 left-4 md:left-auto z-[100] px-6 py-4 rounded-2xl shadow-2xl shadow-slate-300 text-white font-bold flex items-center justify-center md:justify-start animate-bounce-in backdrop-blur-md ${notification.type === 'error' ? 'bg-rose-500/90' : 'bg-emerald-500/90'}`}>
           {notification.type === 'success' && <CheckCircle size={20} className="mr-2" />}
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

      {renderMobileBottomNav()}
    </div>
  );
}