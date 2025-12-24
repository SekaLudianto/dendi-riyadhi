import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, getDocs, 
  query, doc, updateDoc, deleteDoc, onSnapshot, setDoc, writeBatch 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously 
} from 'firebase/auth';
import { 
  Search, FileSpreadsheet, LogOut, 
  School, User, Award, Save, Trash2, X, CheckCircle, 
  BookOpen, Trophy, Medal, Star, Quote, ArrowUpDown, 
  AlertTriangle, Printer, Download, MapPin, Crown, Zap, Target,
  Edit, Camera, ChevronRight, LayoutDashboard, Settings, Menu
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

// Sanitasi appId
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-school-ranking';
const appId = rawAppId.replace(/[^a-zA-Z0-9_-]/g, '_');

// --- HELPER: GOOGLE DRIVE LINK FORMATTER ---
const formatGoogleDriveUrl = (url) => {
  if (!url) return '';
  const stringUrl = String(url);
  // Regex yang lebih tangguh menangkap ID di tengah atau akhir URL
  const driveRegex = /(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=|drive\.google\.com\/uc\?id=|drive\.google\.com\/.*?\/d\/)([-a-zA-Z0-9_]+)/;
  const match = stringUrl.match(driveRegex);
  
  if (match && match[1]) {
    // Menggunakan lh3.googleusercontent.com/d/ID yang lebih ramah hotlink
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return stringUrl;
};

// --- LOGIC RANKING & QUOTES ---
const getRankBadge = (rank) => {
  if (rank === 1) return { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', icon: Crown, label: 'Champion', gradient: 'from-yellow-400 to-amber-600' };
  if (rank === 2) return { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', icon: Medal, label: 'Runner Up', gradient: 'from-slate-300 to-slate-500' };
  if (rank === 3) return { color: 'text-amber-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: Medal, label: '3rd Place', gradient: 'from-orange-400 to-amber-700' };
  if (rank <= 10) return { color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: Star, label: 'Top 10', gradient: 'from-indigo-400 to-indigo-600' };
  return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: Award, label: 'Student', gradient: 'from-emerald-400 to-emerald-600' };
};

const getMotivationalQuote = (rank, totalStudents) => {
  const percentage = (rank / totalStudents) * 100;
  if (rank === 1) return "Luar biasa! Pertahankan prestasimu.";
  if (rank <= 3) return "Selangkah lagi menuju puncak!";
  if (rank <= 10) return "Prestasi hebat! Teruslah bersinar.";
  if (percentage <= 50) return "Potensimu besar, teruslah belajar.";
  return "Jangan menyerah, proses adalah kunci.";
};

// Fungsi untuk download template Excel
const downloadTemplate = () => {
  if (!window.XLSX) {
    alert("Library Excel sedang dimuat...");
    return;
  }
  const templateData = [
    { "NISN": "106230180", "NAMA": "CONTOH SISWA", "KELAS": "9A", "NILAI": 978, "FOTO": "Link GDrive Here" }
  ];
  const ws = window.XLSX.utils.json_to_sheet(templateData);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "DataSiswa");
  window.XLSX.writeFile(wb, "Template_Siswa.xlsx");
};

// --- MAIN COMPONENT ---
export default function App() {
  // State: App Flow
  const [view, setView] = useState('home'); 
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  
  // State: Data
  const [schoolData, setSchoolData] = useState({ 
    name: 'SMP Negeri 1 Cibingbin', 
    logo: '', 
    location: 'Cibingbin', 
    academicYear: '2025/2026',
    semesterTitle: 'Ranking Semester Ganjil'
  });
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [calculatedRank, setCalculatedRank] = useState(0);

  // State: Admin Auth
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      return localStorage.getItem('school_app_is_admin') === 'true';
    } catch (e) {
      return false; 
    }
  });
  
  const [adminCredentials, setAdminCredentials] = useState({ username: 'marquan', password: 'pirelli' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  // State: Admin View Logic
  const [searchTerm, setSearchTerm] = useState('');
  const [searchNisn, setSearchNisn] = useState(''); 
  const [foundStudentName, setFoundStudentName] = useState(null); 
  const [sortConfig, setSortConfig] = useState({ key: 'totalScore', direction: 'desc' });
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; 

  const [activeAdminTab, setActiveAdminTab] = useState('students');
  const [manualEntry, setManualEntry] = useState({
    name: '', nisn: '', class: '', totalScore: '', photoUrl: ''
  });
  const [editingStudent, setEditingStudent] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // --- INITIALIZATION ---
  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (error) { console.error("Auth error:", error); }
    };
    initAuth();

    if (!document.querySelector('script[src*="xlsx.full.min.js"]')) {
      const script = document.createElement('script');
      script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
    
    // Add Google Font
    if (!document.getElementById('google-font')) {
      const link = document.createElement('link');
      link.id = 'google-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // --- FIRESTORE LISTENERS ---
  useEffect(() => {
    try {
        const settingsDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school');
        const unsubSchool = onSnapshot(settingsDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setSchoolData(prev => ({ ...prev, ...docSnap.data() }));
          } else {
            setDoc(settingsDocRef, schoolData).catch(err => console.error(err));
          }
        });

        const adminSettingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin');
        const unsubAdmin = onSnapshot(adminSettingsRef, (docSnap) => {
          if (docSnap.exists()) setAdminCredentials(docSnap.data());
          else setDoc(adminSettingsRef, { username: 'admin', password: '123' }).catch(err => console.error(err));
        });

        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'students'));
        const unsubStudents = onSnapshot(q, (snapshot) => {
          const studentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setStudents(studentsList);
        });

        return () => { unsubSchool(); unsubAdmin(); unsubStudents(); };
    } catch (e) {
        console.error("Firestore Init Error:", e);
    }
  }, []);

  // --- LOGIC FUNCTIONS ---
  const showNotif = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAdminLogin = () => {
    if (loginForm.username === adminCredentials.username && loginForm.password === adminCredentials.password) {
      setIsAdmin(true);
      try { localStorage.setItem('school_app_is_admin', 'true'); } catch(e) {}
      setView('admin');
      showNotif('Login Berhasil');
      setLoginForm({ username: '', password: '' });
    } else {
      showNotif('Username/Password Salah', 'error');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    try { localStorage.removeItem('school_app_is_admin'); } catch(e) {}
    setView('home');
  };

  const handleDeleteAllData = () => {
    setShowDeleteModal(true);
    setDeleteConfirmationText('');
  };

  const executeDeleteAllData = async () => {
    if (deleteConfirmationText !== 'HAPUS') {
       showNotif('Kode salah.', 'error');
       return;
    }
    setLoading(true);
    setShowDeleteModal(false);
    try {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'students'));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        let count = 0;
        querySnapshot.forEach((document) => {
            if (count < 400) { batch.delete(document.ref); count++; }
        });
        await batch.commit();
        showNotif(`${count} data dihapus.`, 'success');
    } catch (error) { showNotif('Gagal menghapus.', 'error'); } 
    finally { setLoading(false); }
  };

  const handleNisnSearchInput = (e) => {
    const nisn = e.target.value;
    setSearchNisn(nisn);
    const student = students.find(s => s.nisn === nisn);
    if (student) {
      setFoundStudentName(student.name);
    } else {
      setFoundStudentName(null);
    }
  };

  const checkRanking = () => {
    const student = students.find(s => s.nisn === searchNisn);
    if (student) {
      const sortedAll = [...students].sort((a, b) => Number(b.totalScore) - Number(a.totalScore));
      const rankIndex = sortedAll.findIndex(s => s.nisn === student.nisn);
      const rank = rankIndex + 1;

      setSelectedStudent(student);
      setCalculatedRank(rank);
      setView('result');
    } else {
      showNotif('NISN tidak ditemukan.', 'error');
    }
  };

  const saveManualEntry = async () => {
    if (!manualEntry.name || !manualEntry.nisn || !manualEntry.totalScore) { 
        showNotif('Data tidak lengkap.', 'error'); return; 
    }
    const cleanNisn = String(manualEntry.nisn).trim().replace(/^0+/, '');
    
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'students'), {
        name: manualEntry.name, 
        nisn: cleanNisn, 
        class: manualEntry.class, 
        totalScore: Number(manualEntry.totalScore),
        photoUrl: manualEntry.photoUrl
      });
      showNotif('Berhasil disimpan');
      setManualEntry({ name: '', nisn: '', class: '', totalScore: '', photoUrl: '' });
    } catch (error) { showNotif('Gagal simpan', 'error'); }
  };
  
  const handleUpdateStudent = async () => {
    if (!editingStudent) return;
    try {
      const studentRef = doc(db, 'artifacts', appId, 'public', 'data', 'students', editingStudent.id);
      await updateDoc(studentRef, {
        name: editingStudent.name,
        nisn: editingStudent.nisn,
        class: editingStudent.class,
        totalScore: Number(editingStudent.totalScore),
        photoUrl: editingStudent.photoUrl
      });
      showNotif('Update berhasil', 'success');
      setEditingStudent(null);
    } catch (error) {
      showNotif('Gagal update', 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.XLSX) {
        showNotif('Library Excel belum siap.', 'error');
        return;
    }
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
        const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false });
        
        let newCount = 0, updateCount = 0;
        
        for (const row of data) {
           const cleanRow = {};
           Object.keys(row).forEach(key => cleanRow[key.toUpperCase().trim()] = row[key]);

           let rawNisn = String(cleanRow['NISN'] || '').trim();
           rawNisn = rawNisn.replace(/^'/, '').replace(/^0+/, ''); 
           
           if (!rawNisn) continue;

           const studentData = {
               nisn: rawNisn,
               name: cleanRow['NAMA'] || 'No Name',
               class: cleanRow['KELAS'] || 'Umum',
               totalScore: Number(cleanRow['NILAI'] || 0),
               photoUrl: cleanRow['FOTO'] || ''
           };

           const existingStudent = students.find(s => s.nisn === rawNisn);

           if (existingStudent) {
                const ref = doc(db, 'artifacts', appId, 'public', 'data', 'students', existingStudent.id);
                await updateDoc(ref, studentData); 
                updateCount++;
           } else {
                await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'students'), studentData);
                newCount++;
           }
        }
        showNotif(`${newCount} Baru, ${updateCount} Updated.`);
        e.target.value = null;
      } catch (err) { showNotif('Format Excel salah.', 'error'); } 
      finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };
  
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.size < 500000) { 
      const reader = new FileReader();
      reader.onloadend = () => {
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school'), { logo: reader.result });
        showNotif('Logo OK');
      };
      reader.readAsDataURL(file);
    } else { showNotif('Max 500KB', 'error'); }
  };

  const handleSaveSettings = () => {
     updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school'), schoolData);
     showNotif('Tersimpan');
  };

  const deleteStudent = async (id) => {
    if(confirm('Hapus?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', id));
      showNotif('Terhapus');
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedStudents = useMemo(() => {
    let items = [...students];
    if (searchTerm) {
      items = items.filter(s => 
        (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
        (s.nisn && s.nisn.includes(searchTerm))
      );
    }
    if (sortConfig.key) {
      items.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if(sortConfig.key === 'totalScore') {
             valA = Number(valA); valB = Number(valB);
        } else {
             valA = String(valA || '').toLowerCase(); valB = String(valB || '').toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [students, searchTerm, sortConfig]);

  const paginatedStudents = sortedStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(sortedStudents.length / itemsPerPage);

  // --- RENDERERS ---
  const renderHeader = () => (
    <header className="sticky top-0 z-40 print:hidden transition-all duration-300">
      <div className="absolute inset-0 bg-white/90 backdrop-blur-md border-b border-slate-200/50 shadow-sm"></div>
      <div className="relative max-w-7xl mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4 cursor-pointer group" onClick={() => setView('home')}>
          <div className="relative">
            {schoolData.logo ? 
              <img src={schoolData.logo} alt="Logo" className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl object-contain bg-white shadow-sm" /> : 
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <School className="text-white" size={20} />
              </div>
            }
          </div>
          <div className="max-w-[140px] sm:max-w-none">
            <h1 className="font-bold text-slate-800 text-xs sm:text-base leading-tight truncate">{schoolData.name}</h1>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">Academic Portal</p>
          </div>
        </div>
        <div>
          {isAdmin ? (
            <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-full bg-rose-50 text-rose-600 font-semibold text-xs sm:text-sm hover:bg-rose-100 transition-all">
              <LogOut size={14} strokeWidth={2.5} /> <span className="hidden sm:inline">Keluar</span>
            </button>
          ) : (
            <button onClick={() => setView('login_admin')} className="flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-full bg-slate-100 text-slate-600 font-semibold text-xs sm:text-sm hover:bg-slate-200 transition-all">
              <User size={14} strokeWidth={2.5} /> <span className="hidden sm:inline">Guru</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );

  const renderResultView = () => {
     if (!selectedStudent) return null;
     const badgeData = getRankBadge(calculatedRank);
     const BadgeIcon = badgeData.icon;
     const quote = getMotivationalQuote(calculatedRank, students.length);
     const displayPhotoUrl = formatGoogleDriveUrl(selectedStudent.photoUrl);

     return (
        <div className="min-h-screen bg-slate-50 p-2 sm:p-6 pb-24 print:bg-white print:p-0">
          <style>{`
            @media print {
              .print\\:hidden { display: none !important; }
              .print\\:shadow-none { box-shadow: none !important; border: none !important; background: none !important; }
              .print\\:bg-white { background-color: white !important; }
              @page { size: A4; margin: 0; }
              body { -webkit-print-color-adjust: exact; font-family: 'Plus Jakarta Sans', sans-serif; }
            }
          `}</style>
    
          <div className="max-w-3xl mx-auto print:w-full print:max-w-none">
            {/* Breadcrumb & Actions */}
            <div className="flex justify-between items-center mb-4 sm:mb-8 print:hidden px-2">
              <button onClick={() => setView('home')} className="group flex items-center text-slate-500 hover:text-indigo-600 font-semibold text-xs sm:text-sm px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200 transition-all">
                <ChevronRight size={14} className="mr-1 rotate-180" /> Kembali
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 sm:px-6 sm:py-2.5 rounded-full shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all font-semibold text-xs sm:text-sm">
                <Printer size={14} /> <span className="hidden sm:inline">Cetak</span>
              </button>
            </div>
    
            {/* CERTIFICATE CARD */}
            <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] shadow-xl shadow-slate-200/60 overflow-hidden border border-slate-100 relative print:shadow-none print:border print:border-slate-300 print:rounded-none">
                
                {/* Header Background */}
                <div className="h-48 sm:h-64 relative overflow-hidden bg-slate-900">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-800 opacity-90"></div>
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
                    
                    <div className="relative z-10 flex flex-col items-center justify-center h-full text-white pb-6 sm:pb-8">
                        <div className="flex items-center gap-2 mb-2 opacity-90">
                           {schoolData.logo && <img src={schoolData.logo} className="h-6 w-6 sm:h-8 sm:w-8 object-contain bg-white rounded-full p-0.5"/>}
                           <span className="font-bold tracking-wider uppercase text-xs sm:text-sm">{schoolData.name}</span>
                        </div>
                        <h2 className="font-extrabold text-xl sm:text-3xl tracking-tight text-center px-4">{schoolData.semesterTitle}</h2>
                        <p className="text-xs sm:text-sm font-medium text-indigo-100 mt-1 opacity-80">{schoolData.academicYear}</p>
                    </div>
                </div>

                {/* Content Body */}
                <div className="relative px-4 sm:px-8 pb-8 sm:pb-12 -mt-16 sm:-mt-20 flex flex-col items-center">
                    
                    {/* Photo & Rank */}
                    <div className="relative mb-6 group">
                        <div className="w-28 h-28 sm:w-40 sm:h-40 rounded-full border-[6px] border-white shadow-xl overflow-hidden bg-slate-100 relative z-10">
                            {displayPhotoUrl ? (
                                <img 
                                  src={displayPhotoUrl} 
                                  className="w-full h-full object-cover" 
                                  alt={selectedStudent.name} 
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                      e.target.onerror = null; 
                                      // Fallback ke UI Avatars jika gambar gagal load
                                      e.target.src=`https://ui-avatars.com/api/?name=${selectedStudent.name}&background=random&color=fff&size=256`
                                  }} 
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300">
                                    <User size={48} />
                                </div>
                            )}
                        </div>
                        
                        {/* 3D Floating Rank Badge */}
                        <div className={`absolute -bottom-2 -right-2 z-20 w-12 h-12 sm:w-16 sm:h-16 rounded-full border-[4px] sm:border-[5px] border-white flex items-center justify-center text-white shadow-xl bg-gradient-to-br ${badgeData.gradient}`}>
                            <div className="flex flex-col items-center -space-y-0.5 sm:-space-y-1">
                                <span className="text-[8px] sm:text-[10px] font-bold uppercase opacity-90">Rank</span>
                                <span className="font-black text-lg sm:text-2xl leading-none">{calculatedRank}</span>
                            </div>
                        </div>
                    </div>

                    {/* Identity */}
                    <div className="text-center mb-8 w-full">
                        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 mb-2 sm:mb-3 tracking-tight leading-tight">{selectedStudent.name}</h1>
                        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-slate-500 font-medium">
                            <span className="bg-slate-50 border border-slate-200 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[10px] sm:text-xs uppercase tracking-wide font-bold">Kelas {selectedStudent.class}</span>
                            <span className="bg-slate-50 border border-slate-200 px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[10px] sm:text-xs uppercase tracking-wide font-bold">NISN: {selectedStudent.nisn}</span>
                        </div>
                    </div>

                    {/* Score Cards (Compact Grid on Mobile) */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full max-w-2xl mb-8">
                        {/* Rank Card */}
                        <div className={`relative overflow-hidden p-4 sm:p-6 rounded-2xl sm:rounded-3xl border ${badgeData.border} ${badgeData.bg} flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-2 sm:gap-5`}>
                            <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white shadow-sm flex items-center justify-center ${badgeData.color}`}>
                                <BadgeIcon size={20} className="sm:w-7 sm:h-7" strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${badgeData.color} opacity-70`}>Peringkat</p>
                                <h3 className={`text-xl sm:text-3xl font-black ${badgeData.color}`}>#{calculatedRank}</h3>
                            </div>
                        </div>

                        {/* Score Card */}
                        <div className="relative overflow-hidden p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-emerald-100 bg-emerald-50/50 flex flex-col sm:flex-row items-center sm:items-center text-center sm:text-left gap-2 sm:gap-5">
                             <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-white shadow-sm flex items-center justify-center text-emerald-600">
                                <Zap size={20} className="sm:w-7 sm:h-7" strokeWidth={2.5} />
                            </div>
                            <div>
                                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-600 opacity-70">Total Nilai</p>
                                <h3 className="text-xl sm:text-3xl font-black text-emerald-700">{selectedStudent.totalScore}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Quote Box */}
                    <div className="w-full max-w-lg text-center relative px-6 py-2">
                        <Quote size={24} className="absolute -top-2 left-0 text-slate-200 fill-current sm:w-10 sm:h-10 sm:-top-4" />
                        <Quote size={24} className="absolute -bottom-2 right-0 text-slate-200 fill-current rotate-180 sm:w-10 sm:h-10 sm:-bottom-4" />
                        <p className="text-slate-600 font-medium text-sm sm:text-lg leading-relaxed italic px-2">
                            "{quote}"
                        </p>
                    </div>

                    {/* Print Footer */}
                    <div className="hidden print:flex flex-col items-center mt-12 w-full pt-8 border-t border-slate-200">
                         <div className="flex justify-between w-full px-8 mb-16">
                            <div className="text-center w-1/3">
                                <p className="text-xs text-slate-500 mb-12">Mengetahui,<br/>Orang Tua/Wali</p>
                                <div className="border-b border-slate-400"></div>
                            </div>
                            <div className="text-center w-1/3">
                                <p className="text-xs text-slate-500 mb-12">{schoolData.location}, {new Date().toLocaleDateString('id-ID')}<br/>Kepala Sekolah</p>
                                <div className="border-b border-slate-400"></div>
                            </div>
                         </div>
                    </div>

                </div>
            </div>
          </div>
        </div>
     );
  };

  const renderAdminDashboard = () => (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 pb-24">
      <div className="flex flex-col lg:grid lg:grid-cols-[260px_1fr] gap-6">
        
        {/* Responsive Sidebar (Horizontal Scroll on Mobile) */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-lg shadow-slate-200/50 border border-slate-100 p-2 sm:p-6 h-fit sticky top-20 z-30 lg:block overflow-x-auto lg:overflow-visible">
           <div className="mb-6 px-2 hidden lg:block">
              <h3 className="font-extrabold text-slate-800 text-lg">Admin Panel</h3>
              <p className="text-xs text-slate-400 font-medium">Manage School Data</p>
           </div>
           
           <nav className="flex lg:flex-col gap-2 min-w-max lg:min-w-0">
              {[
                {id: 'students', label: 'Data Ranking', icon: User},
                {id: 'manual', label: 'Input Manual', icon: BookOpen},
                {id: 'import', label: 'Import Excel', icon: FileSpreadsheet},
                {id: 'settings', label: 'Pengaturan', icon: Settings},
              ].map(item => (
                <button 
                  key={item.id} 
                  onClick={() => setActiveAdminTab(item.id)} 
                  className={`flex items-center gap-2 sm:gap-3 px-4 py-2 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap ${activeAdminTab === item.id ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-500 hover:bg-slate-50 bg-slate-50/50 lg:bg-transparent'}`}
                >
                  <item.icon size={16} strokeWidth={2.5} />
                  {item.label}
                </button>
              ))}
           </nav>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] border border-slate-100 shadow-sm p-4 sm:p-8 min-h-[500px]">
          
          {activeAdminTab === 'students' && (
            <div className="animate-fade-in">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                   <h2 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Data Ranking</h2>
                   <p className="text-xs sm:text-sm text-slate-400 mt-1">Total {students.length} Siswa</p>
                </div>
                <div className="relative w-full sm:w-auto">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Cari..." 
                    className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 focus:bg-white outline-none" 
                    value={searchTerm} 
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                  />
                </div>
              </div>
              
              <div className="overflow-x-auto border border-slate-100 rounded-xl sm:rounded-2xl shadow-sm -mx-2 sm:mx-0">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 text-xs uppercase">
                    <tr>
                      <th className="py-3 px-4 w-14">Foto</th>
                      <th className="py-3 px-4" onClick={() => handleSort('totalScore')}>Nilai <ArrowUpDown size={10} className="inline ml-1 opacity-50"/></th>
                      <th className="py-3 px-4" onClick={() => handleSort('name')}>Nama</th>
                      <th className="py-3 px-4 hidden sm:table-cell">Kelas</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedStudents.length > 0 ? paginatedStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 border border-white shadow-sm overflow-hidden">
                                {s.photoUrl ? 
                                    <img src={formatGoogleDriveUrl(s.photoUrl)} className="w-full h-full object-cover" onError={(e) => {e.target.onerror=null;e.target.src=`https://ui-avatars.com/api/?name=${s.name}&background=random`}} /> 
                                    : <div className="w-full h-full flex items-center justify-center text-slate-300"><User size={14}/></div>
                                }
                            </div>
                        </td>
                        <td className="py-3 px-4">
                            <span className="font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded text-xs">{s.totalScore}</span>
                        </td>
                        <td className="py-3 px-4">
                            <div className="font-bold text-slate-700 text-xs sm:text-sm truncate max-w-[120px] sm:max-w-xs">{s.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{s.nisn}</div>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell"><span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{s.class}</span></td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                              <button onClick={() => setEditingStudent(s)} className="text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 p-1.5 sm:p-2 rounded-lg transition-all"><Edit size={14} /></button>
                              <button onClick={() => deleteStudent(s.id)} className="text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 p-1.5 sm:p-2 rounded-lg transition-all"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                        <tr><td colSpan="5" className="py-8 text-center text-slate-400 text-xs">Data kosong</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Modern Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6">
                   <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 bg-slate-50 text-xs font-semibold text-slate-600">Prev</button>
                   <span className="text-xs font-medium text-slate-400">{currentPage}/{totalPages}</span>
                   <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 bg-slate-50 text-xs font-semibold text-slate-600">Next</button>
                </div>
              )}
            </div>
          )}

          {activeAdminTab === 'manual' && (
            <div className="max-w-xl animate-fade-in">
              <h2 className="text-xl font-bold text-slate-800 mb-2">Input Manual</h2>
              <div className="space-y-4">
                <input className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Nama Lengkap" value={manualEntry.name} onChange={e => setManualEntry({...manualEntry, name: e.target.value})} />
                <div className="grid grid-cols-2 gap-4">
                    <input className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="NISN" type="number" value={manualEntry.nisn} onChange={e => setManualEntry({...manualEntry, nisn: e.target.value})} />
                    <input className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Kelas" value={manualEntry.class} onChange={e => setManualEntry({...manualEntry, class: e.target.value})} />
                </div>
                <div className="relative">
                    <input className="w-full p-3 bg-emerald-50/50 border-none rounded-xl text-sm font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-100 outline-none" placeholder="Nilai Total" type="number" value={manualEntry.totalScore} onChange={e => setManualEntry({...manualEntry, totalScore: e.target.value})} />
                </div>
                <input className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Link Foto GDrive (Opsional)" value={manualEntry.photoUrl} onChange={e => setManualEntry({...manualEntry, photoUrl: e.target.value})} />

                <button onClick={saveManualEntry} className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 mt-2">
                    <Save size={18} /> Simpan Data
                </button>
              </div>
            </div>
          )}

          {activeAdminTab === 'import' && (
             <div className="flex flex-col items-center justify-center min-h-[300px] animate-fade-in text-center p-4">
               <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                   <FileSpreadsheet className="text-emerald-500" size={30}/>
               </div>
               <h2 className="text-lg font-bold text-slate-800 mb-1">Import Excel</h2>
               <p className="text-xs text-slate-500 mb-6">Upload .xlsx untuk input massal.</p>
               
               <div className="flex flex-col gap-3 w-full max-w-xs">
                   <button onClick={downloadTemplate} className="py-2.5 bg-white border border-slate-200 text-slate-600 font-semibold rounded-xl text-xs hover:bg-slate-50">
                     Download Template
                   </button>
                   <div className="relative group w-full">
                     <input className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" type="file" accept=".xlsx" onChange={handleFileUpload} disabled={loading} />
                     <button className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-md group-hover:bg-emerald-700 transition-all text-sm flex items-center justify-center gap-2">
                        {loading ? 'Processing...' : 'Upload File Excel'}
                     </button>
                   </div>
               </div>
             </div>
          )}

          {activeAdminTab === 'settings' && (
            <div className="max-w-xl animate-fade-in space-y-5">
               <h2 className="text-xl font-bold text-slate-800">Pengaturan</h2>
               <input className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Nama Sekolah" value={schoolData.name} onChange={e => setSchoolData({...schoolData, name: e.target.value})} />
               <div className="grid grid-cols-2 gap-4">
                    <input className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Tahun" value={schoolData.academicYear} onChange={e => setSchoolData({...schoolData, academicYear: e.target.value})} />
                    <input className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="Judul" value={schoolData.semesterTitle} onChange={e => setSchoolData({...schoolData, semesterTitle: e.target.value})} />
               </div>
               <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-3">
                    {schoolData.logo ? <img src={schoolData.logo} className="w-10 h-10 object-contain bg-white rounded-lg p-1" /> : <School className="text-slate-300" size={24}/>}
                    <input type="file" onChange={handleLogoUpload} className="text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-100 file:text-indigo-700 cursor-pointer w-full" />
               </div>
               <button onClick={handleSaveSettings} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg">Simpan</button>
               <button onClick={handleDeleteAllData} className="w-full py-3 bg-rose-50 text-rose-600 font-bold rounded-xl border border-rose-100 text-sm mt-4">Reset Database</button>
            </div>
          )}
        </div>
      </div>

      {/* Modals & Other UI Elements (Tetap sama, hanya penyesuaian styling minor otomatis terwaris) */}
      {/* ... (Modal code remains functionally the same, utilizing global tailwind classes) ... */}
      {editingStudent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Edit Siswa</h3>
            <div className="space-y-3">
               <input className="w-full p-2.5 bg-slate-50 rounded-lg text-sm font-semibold outline-none" value={editingStudent.name} onChange={e => setEditingStudent({...editingStudent, name: e.target.value})} />
               <input className="w-full p-2.5 bg-slate-50 rounded-lg text-sm font-semibold outline-none" value={editingStudent.nisn} onChange={e => setEditingStudent({...editingStudent, nisn: e.target.value})} />
               <input className="w-full p-2.5 bg-slate-50 rounded-lg text-sm font-semibold outline-none" value={editingStudent.class} onChange={e => setEditingStudent({...editingStudent, class: e.target.value})} />
               <input className="w-full p-2.5 bg-slate-50 rounded-lg text-sm font-bold text-indigo-600 outline-none" type="number" value={editingStudent.totalScore} onChange={e => setEditingStudent({...editingStudent, totalScore: e.target.value})} />
               <input className="w-full p-2.5 bg-slate-50 rounded-lg text-sm outline-none" value={editingStudent.photoUrl} onChange={e => setEditingStudent({...editingStudent, photoUrl: e.target.value})} />
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditingStudent(null)} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl text-sm">Batal</button>
              <button onClick={handleUpdateStudent} className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg text-sm">Simpan</button>
            </div>
          </div>
        </div>
      )}
      
       {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full p-6 text-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Hapus Semua?</h3>
            <p className="text-slate-500 text-xs mb-4">Ketik <strong>"HAPUS"</strong></p>
            <input type="text" value={deleteConfirmationText} onChange={(e) => setDeleteConfirmationText(e.target.value)} className="w-full px-4 py-2 border-2 border-slate-200 rounded-xl mb-4 text-center font-bold uppercase" placeholder="HAPUS" />
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2 bg-white border border-slate-200 text-slate-600 font-bold rounded-lg text-xs">Batal</button>
              <button onClick={executeDeleteAllData} disabled={deleteConfirmationText !== 'HAPUS'} className="flex-1 py-2 bg-rose-600 text-white font-bold rounded-lg disabled:opacity-50 text-xs">Hapus</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  // --- MAIN RENDER ---
  return (
    <div className="min-h-screen bg-[#F8FAFC] font-['Plus_Jakarta_Sans',sans-serif] text-slate-800 selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      
      {/* GLOBAL TOAST */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-full shadow-2xl font-bold text-xs sm:text-sm animate-in slide-in-from-top-4 fade-in duration-300 flex items-center gap-2 whitespace-nowrap ${notification.type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white'}`}>
          {notification.type === 'error' ? <AlertTriangle size={16}/> : <CheckCircle size={16} className="text-emerald-400"/>}
          {notification.msg}
        </div>
      )}

      {renderHeader()}

      <main className="relative z-10">
        {view === 'home' && (
          <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 text-center relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-[80px] sm:blur-[128px] opacity-20 animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-[80px] sm:blur-[128px] opacity-20 animate-pulse delay-1000"></div>

            <div className="relative z-10 max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="mb-8 sm:mb-10">
                {schoolData.logo ? (
                  <div className="w-20 h-20 sm:w-28 sm:h-28 mx-auto mb-4 sm:mb-6 rounded-[1.5rem] sm:rounded-[2rem] bg-white shadow-xl shadow-indigo-100 flex items-center justify-center p-2">
                     <img src={schoolData.logo} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-[1.5rem] sm:rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-200 flex items-center justify-center text-white">
                     <School size={40} />
                  </div>
                )}
                <h1 className="text-3xl sm:text-6xl font-black text-slate-900 mb-2 sm:mb-4 tracking-tight leading-tight">{schoolData.name}</h1>
                <p className="text-slate-500 text-sm sm:text-xl font-medium max-w-xs sm:max-w-lg mx-auto">{schoolData.semesterTitle} <span className="text-indigo-600 font-bold block sm:inline">{schoolData.academicYear}</span></p>
              </div>

              {/* Modern Search Box */}
              <div className="w-full max-w-md mx-auto relative group">
                 <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-2xl blur opacity-20 group-focus-within:opacity-50 transition duration-500"></div>
                 <div className="relative bg-white p-1.5 sm:p-2 rounded-2xl shadow-xl shadow-slate-200/50 flex items-center border border-slate-100">
                    <div className="pl-3 sm:pl-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors"><Search size={20} className="sm:w-6 sm:h-6"/></div>
                    <input 
                        type="number" 
                        placeholder="Masukkan NISN..." 
                        className="w-full p-3 sm:p-4 outline-none text-base sm:text-lg font-bold text-slate-700 placeholder:font-medium placeholder:text-slate-300 bg-transparent"
                        value={searchNisn}
                        onChange={handleNisnSearchInput}
                        onKeyDown={(e) => e.key === 'Enter' && checkRanking()}
                    />
                    <button 
                        onClick={checkRanking}
                        className="bg-slate-900 hover:bg-indigo-600 text-white p-3 sm:p-4 rounded-xl transition-all shadow-lg active:scale-95"
                    >
                        <ArrowUpDown size={20} className="rotate-90 sm:w-6 sm:h-6"/>
                    </button>
                 </div>
              </div>

              {/* Name Preview */}
              {foundStudentName && (
                <div className="mt-6 animate-in fade-in slide-in-from-top-2">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 text-xs sm:text-sm font-bold border border-emerald-100 shadow-sm">
                    <CheckCircle size={14} fill="currentColor" className="text-emerald-200"/> 
                    {foundStudentName}
                  </span>
                </div>
              )}

              <p className="mt-8 sm:mt-12 text-slate-400 text-[10px] sm:text-xs font-medium uppercase tracking-widest">
                Portal Informasi Akademik Resmi
              </p>
            </div>
          </div>
        )}

        {view === 'result' && renderResultView()}

        {view === 'admin' && renderAdminDashboard()}

        {view === 'login_admin' && (
          <div className="min-h-[85vh] flex items-center justify-center p-4 relative overflow-hidden">
            <div className="relative z-10 bg-white/80 backdrop-blur-xl p-6 sm:p-12 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl shadow-slate-200 border border-white w-full max-w-sm sm:max-w-md animate-in zoom-in-95 duration-300">
               <div className="text-center mb-8 sm:mb-10">
                 <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 sm:mb-6 text-white shadow-xl shadow-slate-300 transform rotate-3">
                    <User size={28} className="sm:w-9 sm:h-9" strokeWidth={1.5} />
                 </div>
                 <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mb-2">Login Guru</h2>
                 <p className="text-slate-500 font-medium text-xs sm:text-sm">Masuk untuk mengelola data nilai.</p>
               </div>
               
               <div className="space-y-4">
                 <div className="space-y-1">
                   <input className="w-full p-3.5 sm:p-4 bg-slate-50 border-none rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none" placeholder="Username" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} />
                 </div>
                 <div className="space-y-1">
                   <input type="password" className="w-full p-3.5 sm:p-4 bg-slate-50 border-none rounded-2xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all outline-none" placeholder="Password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
                 </div>
                 
                 <div className="pt-2 space-y-3">
                    <button onClick={handleAdminLogin} className="w-full py-3.5 sm:py-4 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-slate-200 hover:shadow-indigo-200 transition-all active:scale-95 text-sm">Masuk Dashboard</button>
                    <button onClick={() => setView('home')} className="w-full py-3 bg-transparent text-slate-400 hover:text-slate-600 font-bold text-xs sm:text-sm transition-colors">Batal</button>
                 </div>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}