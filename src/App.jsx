import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, getDocs, 
  query, where, doc, updateDoc, deleteDoc, onSnapshot, setDoc, writeBatch 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously 
} from 'firebase/auth';
import { 
  Search, Upload, FileSpreadsheet, LogOut, 
  School, User, Award, Save, Trash2, Plus, X, CheckCircle, 
  BookOpen, Lock, Shield, Hash, Home, MapPin, 
  Eye, ChevronRight, ChevronLeft, Star, Quote, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Printer, Download
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
const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'default-school';
const appId = rawAppId.replace(/[^a-zA-Z0-9_-]/g, '_');

// --- CONSTANTS ---
const MOTIVATIONAL_QUOTES = [
  "Pendidikan adalah senjata paling ampuh untuk mengubah dunia.",
  "Masa depan adalah milik mereka yang percaya pada keindahan mimpi mereka.",
  "Kesuksesan tidak datang kepadamu, kamulah yang harus pergi menjemputnya.",
  "Setiap langkah kecil dalam belajar membawamu lebih dekat ke tujuan besar.",
  "Prestasi bukanlah kebetulan, melainkan hasil dari kerja keras dan doa.",
  "Ilmu itu seperti cahaya, ia akan menerangi jalan hidupmu di masa depan.",
  "Kegagalan adalah kesempatan untuk memulai lagi dengan lebih cerdas."
];

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
  if (!grade) return 'text-slate-700 bg-slate-50 border-slate-100';
  const g = String(grade).toUpperCase();
  if (g === 'A' || g.includes('SANGAT')) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (g === 'B' || g.includes('BAIK')) return 'text-blue-700 bg-blue-50 border-blue-100';
  if (g === 'C' || g.includes('CUKUP')) return 'text-amber-700 bg-amber-50 border-amber-100';
  if (g === 'D' || g.includes('KURANG')) return 'text-orange-700 bg-orange-50 border-orange-100';
  return 'text-rose-700 bg-rose-50 border-rose-100';
};

// Fungsi untuk download template Excel
const downloadTemplate = () => {
  const templateData = [
    { "No": 1, "NISN": "12345678", "Nama Siswa": "Contoh Siswa", "Mata Pelajaran": "Matematika", "Nilai": 85, "Predikat": "B" },
    { "No": 2, "NISN": "12345678", "Nama Siswa": "Contoh Siswa", "Mata Pelajaran": "Bhs Indonesia", "Nilai": 90, "Predikat": "A" }
  ];
  const ws = window.XLSX.utils.json_to_sheet(templateData);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, "Template");
  window.XLSX.writeFile(wb, "Template_Nilai_Siswa.xlsx");
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
    logo: 'logo.jpg', 
    location: 'Cibingbin, Kuningan', 
    academicYear: '2025/2026',
    semesterTitle: 'Semester Ganjil'
  });
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [currentQuote, setCurrentQuote] = useState("");

  // State: Admin Auth
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('school_app_is_admin') === 'true');
  const [adminCredentials, setAdminCredentials] = useState({ username: 'marquan', password: 'pirelli' });
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  // State: Admin View Logic
  const [viewingStudentGrades, setViewingStudentGrades] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchNisn, setSearchNisn] = useState(''); 
  const [foundStudentName, setFoundStudentName] = useState(null); 
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Admin Forms
  const [activeAdminTab, setActiveAdminTab] = useState('students');
  const [manualEntry, setManualEntry] = useState({
    name: '', nisn: '', class: '', semester: 'Ganjil',
    subjects: [{ name: 'Matematika', score: '', predicate: '' }]
  });
  const [importConfig, setImportConfig] = useState({ className: '', semester: 'Ganjil' });

  // State: Delete Modal (Zona Bahaya)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // --- INITIALIZATION ---
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

    // Meta Viewport
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
    });

    const adminSettingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin');
    const unsubAdmin = onSnapshot(adminSettingsRef, (docSnap) => {
      if (docSnap.exists()) setAdminCredentials(docSnap.data());
      else setDoc(adminSettingsRef, { username: 'marquan', password: 'pirelli' });
    });

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'students'));
    const unsubStudents = onSnapshot(q, (snapshot) => {
      const studentsList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentsList);
    });

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
      showNotif('Login Admin diperbarui!');
    } catch (e) { showNotif('Gagal update', 'error'); }
  };

  // Trigger Modal Hapus
  const handleDeleteAllData = () => {
    setShowDeleteModal(true);
    setDeleteConfirmationText('');
  };

  // Eksekusi Hapus Data
  const executeDeleteAllData = async () => {
    if (deleteConfirmationText !== 'HAPUS') {
       showNotif('Kode konfirmasi salah.', 'error');
       return;
    }
    
    setLoading(true);
    setShowDeleteModal(false);

    try {
        const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'students'));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        let count = 0;
        
        // Batch limit is 500, safety 400
        querySnapshot.forEach((document) => {
            if (count < 400) { batch.delete(document.ref); count++; }
        });
        
        await batch.commit();
        showNotif(`Berhasil menghapus ${count} data siswa.`, 'success');
    } catch (error) { 
        console.error(error);
        showNotif('Gagal menghapus data.', 'error'); 
    } finally { 
        setLoading(false); 
    }
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
      setCurrentQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);
      setView('result');
    } else {
      showNotif('NISN tidak ditemukan.', 'error');
    }
  };

  // Manual Entry Logic
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
    if (!manualEntry.name || !manualEntry.nisn) { showNotif('Nama & NISN wajib diisi', 'error'); return; }
    
    // FIX: Sanitasi NISN manual (hapus 0 di depan)
    const cleanNisn = String(manualEntry.nisn).trim().replace(/^0+/, '');
    
    const validSubjects = manualEntry.subjects.filter(s => s.name.trim() !== '' && s.score !== '');
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'students'), {
        name: manualEntry.name, 
        nisn: cleanNisn, 
        class: manualEntry.class, semester: manualEntry.semester, grades: validSubjects
      });
      showNotif('Data siswa disimpan!');
      setManualEntry({ name: '', nisn: '', class: '', semester: 'Ganjil', subjects: [{ name: 'Matematika', score: '', predicate: '' }] });
    } catch (error) { showNotif('Gagal simpan', 'error'); }
  };
  
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = window.XLSX.read(evt.target.result, { type: 'binary' });
        // Menggunakan raw: false agar angka dibaca sebagai string sesuai tampilan Excel
        const data = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { raw: false });
        
        const groupedData = {};

        for (const row of data) {
          const cleanRow = {};
          Object.keys(row).forEach(key => cleanRow[key.toLowerCase().trim().replace(/\s+/g, '_')] = row[key]);
          
          // FIX: Sanitasi NISN import
          let rawNisn = String(cleanRow['nisn'] || '').trim();
          rawNisn = rawNisn.replace(/^'/, ''); // Hapus tanda kutip jika ada
          const nisn = rawNisn.replace(/^0+/, ''); // Hapus 0 di depan
          
          if (!nisn) continue;

          const name = cleanRow['nami_siswa'] || cleanRow['nama_siswa'] || cleanRow['nama'] || 'No Name';
          const subject = cleanRow['mata_pelajaran'] || cleanRow['mapel'] || 'Umum';
          const score = String(Math.round(Number(cleanRow['nilai'] || cleanRow['score'] || 0)));
          const predicate = cleanRow['predikat'] || cleanRow['predicate'] || '';

          if (!groupedData[nisn]) groupedData[nisn] = { name, nisn, newGrades: [] };
          groupedData[nisn].newGrades.push({ name: subject, score, predicate });
        }

        let newCount = 0, updateCount = 0;
        for (const nisn of Object.keys(groupedData)) {
          const { name, newGrades } = groupedData[nisn];
          const existingStudent = students.find(s => s.nisn === nisn);
          
          if (existingStudent) {
            const newSubjectNames = newGrades.map(g => g.name.toLowerCase());
            const keptGrades = (existingStudent.grades || []).filter(g => !newSubjectNames.includes(g.name.toLowerCase()));
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', existingStudent.id), { grades: [...keptGrades, ...newGrades] });
            updateCount++;
          } else {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'students'), {
              name, nisn, class: importConfig.className || 'Umum', semester: importConfig.semester, grades: newGrades
            });
            newCount++;
          }
        }
        showNotif(`Sukses! ${newCount} baru, ${updateCount} update.`);
        e.target.value = null;
      } catch (err) { console.error(err); showNotif('Gagal baca Excel.', 'error'); } finally { setLoading(false); }
    };
    reader.readAsBinaryString(file);
  };
  
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.size < 100000) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school'), { logo: reader.result });
        showNotif('Logo diperbarui');
      };
      reader.readAsDataURL(file);
    } else { showNotif('Max 100KB', 'error'); }
  };

  const handleSaveSettings = () => {
     updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'school'), schoolData);
     showNotif('Pengaturan disimpan!');
  };

  const deleteStudent = async (id) => {
    if(confirm('Hapus siswa ini?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', id));
      showNotif('Data dihapus');
    }
  };

  const handleDeleteSubject = async (studentId, subjectIdx) => {
    if(!confirm('Hapus mapel ini?')) return;
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const updatedGrades = [...student.grades];
    updatedGrades.splice(subjectIdx, 1);
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'students', studentId), { grades: updatedGrades });
      setViewingStudentGrades({ ...student, grades: updatedGrades });
      showNotif('Mapel dihapus');
    } catch (e) { showNotif('Gagal hapus', 'error'); }
  };

  const handlePrint = () => {
    window.print();
  };

  // --- SORTING & PAGINATION ---
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedStudents = React.useMemo(() => {
    let items = [...students];
    if (searchTerm) {
      items = items.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        s.nisn.includes(searchTerm) ||
        (s.class && s.class.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    if (sortConfig.key) {
      items.sort((a, b) => {
        const valA = a[sortConfig.key] ? String(a[sortConfig.key]).toLowerCase() : '';
        const valB = b[sortConfig.key] ? String(b[sortConfig.key]).toLowerCase() : '';
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
    <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100 sticky top-0 z-40 print:hidden">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('home')}>
          {view !== 'home' ? (
            <>
              {schoolData.logo ? <img src={schoolData.logo} alt="Logo" className="h-10 w-10 rounded-full border" /> : <School className="text-indigo-900" size={32} />}
              <div>
                <h1 className="font-bold text-gray-900 text-sm sm:text-base uppercase">{schoolData.name}</h1>
              </div>
            </>
          ) : (
             <div className="text-gray-400 text-xs font-semibold tracking-wider uppercase">Portal Akademik</div>
          )}
        </div>
        <div className="hidden md:block">
          {isAdmin ? (
            <button onClick={handleLogout} className="text-rose-600 hover:bg-rose-50 px-4 py-2 rounded-full font-medium text-sm flex gap-2"><LogOut size={16} /> Keluar</button>
          ) : (
            <button onClick={() => setView('login_admin')} className="text-slate-500 hover:text-indigo-900 font-medium text-sm">Akses Guru</button>
          )}
        </div>
      </div>
    </header>
  );

  const renderStudentResultView = () => (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 pb-24 print:bg-white print:p-0">
       {/* Styles khusus Print */}
       <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { shadow: none !important; box-shadow: none !important; border: none !important; }
          .print\\:bg-white { background-color: white !important; }
          .print\\:text-black { color: black !important; }
          .print\\:w-full { width: 100% !important; max-width: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:m-0 { margin: 0 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { size: A4; margin: 2cm; }
        }
      `}</style>

      <div className="max-w-4xl mx-auto print:w-full">
        <div className="flex justify-between items-center mb-6 print:hidden">
          <button onClick={() => setView('home')} className="flex items-center text-slate-500 hover:text-indigo-700 font-medium text-sm px-4 py-2 bg-white rounded-full shadow-sm border">
            <ChevronLeft size={16} className="mr-1" /> Kembali
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-full shadow-lg hover:bg-indigo-700 transition">
            <Printer size={18} /> Cetak / PDF
          </button>
        </div>

        {selectedStudent && (
          <div className="space-y-6 print:space-y-4">
            {/* Kop Surat (Hanya Muncul saat Print) */}
            <div className="hidden print:flex items-center gap-4 border-b-2 border-black pb-4 mb-6">
               {schoolData.logo && <img src={schoolData.logo} className="h-20 w-20 object-contain" />}
               <div className="text-center flex-1">
                  <h1 className="text-2xl font-bold uppercase">{schoolData.name}</h1>
                  <p className="text-sm">{schoolData.location}</p>
                  <p className="text-sm font-bold mt-1">LAPORAN HASIL BELAJAR SISWA</p>
               </div>
            </div>

            {/* ID Card Display */}
            <div className="bg-white rounded-3xl shadow-xl border p-6 sm:p-8 relative overflow-hidden print:shadow-none print:border-none print:rounded-none print:p-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full print:hidden"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start gap-6 relative z-10">
                <div className="w-full">
                  <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight print:text-2xl print:mb-2">{selectedStudent.name}</h2>
                  <div className="grid grid-cols-2 md:flex gap-4 mt-4 text-sm font-medium print:grid-cols-2 print:gap-2">
                     <div className="print:border print:px-2 print:py-1">
                        <span className="text-slate-400 text-xs block uppercase">NISN</span>
                        <span className="text-indigo-900 font-bold">{selectedStudent.nisn}</span>
                     </div>
                     <div className="print:border print:px-2 print:py-1">
                        <span className="text-slate-400 text-xs block uppercase">Kelas</span>
                        <span className="text-slate-800 font-bold">{selectedStudent.class}</span>
                     </div>
                     <div className="print:border print:px-2 print:py-1">
                        <span className="text-slate-400 text-xs block uppercase">Semester</span>
                        <span className="text-slate-800 font-bold">{selectedStudent.semester}</span>
                     </div>
                     <div className="print:border print:px-2 print:py-1">
                        <span className="text-slate-400 text-xs block uppercase">Tahun Ajaran</span>
                        <span className="text-slate-800 font-bold">{schoolData.academicYear}</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quote (Hidden on Print) */}
            {currentQuote && (
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 flex gap-4 items-start shadow-sm print:hidden">
                <Quote size={20} className="text-orange-400 shrink-0" />
                <div>
                  <p className="text-orange-900 font-medium italic text-sm">"{currentQuote}"</p>
                </div>
              </div>
            )}

            {/* Grades Table */}
            <div className="bg-white rounded-3xl shadow-xl border overflow-hidden print:shadow-none print:border print:rounded-none">
              <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center print:bg-white print:border-b-2 print:border-black">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <BookOpen size={20} className="text-indigo-600 print:hidden"/> Transkrip Nilai
                </h3>
              </div>
              
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-xs font-bold text-slate-400 uppercase tracking-wider print:text-black print:border-black">
                    <th className="px-6 py-4 print:px-2 print:py-2">Mata Pelajaran</th>
                    <th className="px-6 py-4 text-center w-32 print:px-2 print:py-2">Nilai</th>
                    <th className="px-6 py-4 text-center w-48 print:px-2 print:py-2">Predikat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 print:divide-black">
                  {selectedStudent.grades && selectedStudent.grades.map((subject, idx) => {
                    const grade = subject.predicate || calculateGrade(subject.score);
                    const scoreNum = Number(subject.score);
                    // Hitung lebar bar untuk visualisasi (max 100)
                    const barWidth = Math.min(scoreNum, 100); 
                    
                    return (
                      <tr key={idx} className="print:border-b print:border-slate-200">
                        <td className="px-6 py-4 font-semibold text-slate-700 print:px-2 print:py-2 print:text-black">
                          {subject.name}
                          {/* Visual Bar (Hidden on Print to save ink, or keep if needed) */}
                          <div className="h-1.5 w-full bg-slate-100 rounded-full mt-2 overflow-hidden print:hidden">
                             <div className="h-full bg-indigo-500 rounded-full" style={{width: `${barWidth}%`}}></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-800 print:px-2 print:py-2 print:text-black">{subject.score}</td>
                        <td className="px-6 py-4 text-center print:px-2 print:py-2">
                          <span className={`inline-flex items-center justify-center px-4 py-1 rounded-full text-xs font-bold border print:border-black print:text-black ${getGradeColor(grade)}`}>
                            {grade}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Signature Area (Only Print) */}
            <div className="hidden print:flex justify-end mt-12 pt-8">
                <div className="text-center w-64">
                    <p className="mb-20">{schoolData.location}, {new Date().toLocaleDateString('id-ID')}</p>
                    <p className="font-bold underline">Kepala Sekolah / Wali Kelas</p>
                    <p>NIP. .......................</p>
                </div>
            </div>

            {/* Footer Summary (Screen Only) */}
            <div className="bg-indigo-900 text-white rounded-3xl p-8 flex justify-between items-center shadow-2xl print:hidden">
              <div>
                <h4 className="text-xl font-bold">Rata-Rata</h4>
                <p className="text-indigo-200 text-xs">Semester {selectedStudent.semester}</p>
              </div>
              <div className="text-4xl font-black">
                {(selectedStudent.grades.reduce((a, b) => a + Number(b.score), 0) / (selectedStudent.grades.length || 1)).toFixed(1)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderAdminDashboard = () => (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 pb-24">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-hide">
          {['students', 'manual', 'import', 'settings'].map(tab => (
            <button key={tab} onClick={() => setActiveAdminTab(tab)} className={`p-4 rounded-xl text-left flex items-center gap-3 font-medium transition-all ${activeAdminTab === tab ? 'bg-indigo-900 text-white shadow-lg translate-x-1' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
              {tab === 'students' && <User size={20} />}
              {tab === 'manual' && <BookOpen size={20} />}
              {tab === 'import' && <FileSpreadsheet size={20} />}
              {tab === 'settings' && <School size={20} />}
              <span className="capitalize">{tab === 'students' ? 'Data Siswa' : tab}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-[60vh] bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm relative">
          
          {/* MODAL DETAIL NILAI */}
          {viewingStudentGrades && (
            <div className="absolute inset-0 z-50 bg-white rounded-3xl p-6 flex flex-col animate-fade-in-up">
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <div><h3 className="text-xl font-bold">{viewingStudentGrades.name}</h3><p className="text-sm text-slate-500">{viewingStudentGrades.nisn}</p></div>
                <button onClick={() => setViewingStudentGrades(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 font-bold text-slate-500 uppercase">
                    <tr><th className="px-4 py-3">Mapel</th><th className="px-4 py-3 text-center">Nilai</th><th className="px-4 py-3 text-right">Aksi</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {viewingStudentGrades.grades.map((g, i) => (
                      <tr key={i}>
                        <td className="px-4 py-3">{g.name}</td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-700">{g.score}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => handleDeleteSubject(viewingStudentGrades.id, i)} className="text-rose-500 hover:bg-rose-50 p-1 rounded"><Trash2 size={16}/></button>
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
              <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h3 className="text-2xl font-bold text-slate-800">Daftar Siswa</h3>
                <div className="relative w-full sm:w-auto">
                  <Search size={18} className="absolute left-3 top-3 text-slate-400" />
                  <input type="text" placeholder="Cari..." className="w-full sm:w-64 pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
                </div>
              </div>
              
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500 uppercase text-xs font-bold">
                      <th className="py-3 px-2 cursor-pointer" onClick={() => handleSort('name')}>Nama <ArrowUpDown size={12} className="inline"/></th>
                      <th className="py-3 px-2">NISN</th>
                      <th className="py-3 px-2 hidden sm:table-cell">Kelas</th>
                      <th className="py-3 px-2 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {paginatedStudents.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50 group">
                        <td className="py-3 px-2 font-semibold text-slate-700">{s.name}</td>
                        <td className="py-3 px-2 font-mono text-slate-500">{s.nisn}</td>
                        <td className="py-3 px-2 hidden sm:table-cell"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{s.class}</span></td>
                        <td className="py-3 px-2 text-right flex justify-end gap-2">
                          <button onClick={() => setViewingStudentGrades(s)} className="text-indigo-600 p-2 hover:bg-indigo-50 rounded"><Eye size={18} /></button>
                          <button onClick={() => deleteStudent(s.id)} className="text-rose-400 p-2 hover:bg-rose-50 rounded"><Trash2 size={18} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center border-t pt-4">
                  <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16}/></button>
                  <span className="text-xs text-slate-500">Hal {currentPage} dari {totalPages}</span>
                  <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 border rounded hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16}/></button>
                </div>
              )}
            </div>
          )}

          {activeAdminTab === 'manual' && (
            <div className="max-w-2xl">
              <h3 className="text-xl font-bold mb-4">Input Manual</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <input className="border p-2 rounded" placeholder="Nama" value={manualEntry.name} onChange={e => setManualEntry({...manualEntry, name: e.target.value})} />
                <input className="border p-2 rounded" placeholder="NISN" type="number" value={manualEntry.nisn} onChange={e => setManualEntry({...manualEntry, nisn: e.target.value})} />
                <input className="border p-2 rounded" placeholder="Kelas" value={manualEntry.class} onChange={e => setManualEntry({...manualEntry, class: e.target.value})} />
                <select className="border p-2 rounded" value={manualEntry.semester} onChange={e => setManualEntry({...manualEntry, semester: e.target.value})}>
                   <option value="Ganjil">Ganjil</option><option value="Genap">Genap</option>
                </select>
              </div>
              <div className="space-y-2 mb-4">
                 {manualEntry.subjects.map((s, i) => (
                   <div key={i} className="flex gap-2">
                      <input className="border p-2 rounded flex-1" placeholder="Mapel" value={s.name} onChange={e => handleSubjectChange(i, 'name', e.target.value)} />
                      <input className="border p-2 rounded w-20" placeholder="Nilai" type="number" value={s.score} onChange={e => handleSubjectChange(i, 'score', e.target.value)} />
                      <button onClick={() => removeSubjectRow(i)} className="text-rose-500"><Trash2/></button>
                   </div>
                 ))}
                 <button onClick={addSubjectRow} className="text-xs font-bold text-indigo-600 flex items-center gap-1">+ Mapel</button>
              </div>
              <button onClick={saveManualEntry} className="bg-indigo-600 text-white w-full py-2 rounded font-bold">Simpan</button>
            </div>
          )}

          {activeAdminTab === 'import' && (
             <div className="text-center py-10">
               <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><FileSpreadsheet className="text-emerald-600" size={32}/></div>
               <h3 className="text-xl font-bold mb-2">Import Excel</h3>
               <button onClick={downloadTemplate} className="text-emerald-600 text-sm font-bold hover:underline mb-6 flex items-center justify-center gap-1">
                 <Download size={14}/> Download Template Excel
               </button>
               <input className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 mb-4" type="file" accept=".xlsx" onChange={handleFileUpload} disabled={loading} />
               <input className="border p-2 rounded w-full mb-4" placeholder="Kelas Default (Opsional)" value={importConfig.className} onChange={e => setImportConfig({...importConfig, className: e.target.value})} />
             </div>
          )}

          {activeAdminTab === 'settings' && (
            <div className="max-w-lg space-y-4">
               <h3 className="font-bold text-lg">Sekolah</h3>
               <input className="border p-2 rounded w-full" placeholder="Nama Sekolah" value={schoolData.name} onChange={e => setSchoolData({...schoolData, name: e.target.value})} />
               <input className="border p-2 rounded w-full" placeholder="Alamat" value={schoolData.location} onChange={e => setSchoolData({...schoolData, location: e.target.value})} />
               <div className="flex gap-2">
                 <input className="border p-2 rounded w-1/2" placeholder="Tahun Ajaran" value={schoolData.academicYear} onChange={e => setSchoolData({...schoolData, academicYear: e.target.value})} />
                 <input className="border p-2 rounded w-1/2" placeholder="Semester" value={schoolData.semesterTitle} onChange={e => setSchoolData({...schoolData, semesterTitle: e.target.value})} />
               </div>
               <input type="file" onChange={handleLogoUpload} className="text-xs" />
               <button onClick={handleSaveSettings} className="bg-slate-800 text-white w-full py-2 rounded font-bold"><Save size={16} className="inline mr-2"/> Simpan</button>
               
               <div className="border-t pt-4 mt-6">
                 <h3 className="font-bold text-lg text-rose-600">Zona Bahaya</h3>
                 <button onClick={handleDeleteAllData} className="bg-rose-100 text-rose-600 w-full py-2 rounded font-bold text-sm mt-2 border border-rose-200">Hapus SEMUA Data Siswa</button>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL KONFIRMASI HAPUS SEMUA DATA (ZONA BAHAYA) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border-2 border-rose-100 scale-100 animate-bounce-in">
            <div className="flex items-center gap-3 text-rose-600 mb-4">
              <div className="p-3 bg-rose-50 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold">Hapus Semua Data?</h3>
            </div>
            
            <p className="text-slate-600 mb-6 text-sm leading-relaxed">
              Tindakan ini akan menghapus <strong>SELURUH DATA SISWA & NILAI</strong> secara permanen. 
              Data yang sudah dihapus tidak dapat dikembalikan lagi.
            </p>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Ketik "HAPUS" untuk konfirmasi
              </label>
              <input 
                type="text" 
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                className="w-full px-4 py-3 border-2 border-rose-200 rounded-xl focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none font-bold text-rose-600 tracking-wider placeholder:text-rose-200"
                placeholder="HAPUS"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition"
              >
                Batal
              </button>
              <button 
                onClick={executeDeleteAllData}
                disabled={deleteConfirmationText !== 'HAPUS'}
                className="flex-1 px-4 py-3 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-rose-200"
              >
                {loading ? 'Menghapus...' : 'Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-0 safe-area-bottom print:bg-white print:pb-0">
      {notification && <div className={`fixed top-4 right-4 z-[100] px-6 py-3 rounded-xl shadow-xl text-white font-bold flex items-center ${notification.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}`}><CheckCircle size={18} className="mr-2"/>{notification.msg}</div>}
      
      {view !== 'home' && view !== 'result' && renderHeader()}
      {view === 'home' && (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-blue-50 relative overflow-hidden">
           <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center relative z-10 border border-white/50 backdrop-blur-sm">
              <div className="w-24 h-24 bg-white rounded-full mx-auto mb-6 shadow-lg flex items-center justify-center overflow-hidden p-1">
                {schoolData.logo ? <img src={schoolData.logo} className="object-cover w-full h-full rounded-full"/> : <BookOpen className="text-indigo-600"/>}
              </div>
              <h1 className="font-black text-2xl text-slate-800 mb-2">{schoolData.name}</h1>
              
              {/* Lokasi Sekolah dengan Icon */}
              <div className="flex items-center justify-center gap-1.5 text-slate-500 text-sm font-medium mb-6 bg-slate-50 py-1.5 px-4 rounded-full inline-flex mx-auto border border-slate-100 shadow-sm">
                 <MapPin size={14} className="text-rose-500" fill="currentColor" fillOpacity={0.2} />
                 {schoolData.location}
              </div>

              {/* Judul Pengumuman */}
              <h2 className="text-lg font-bold text-slate-800 mb-1">Pengumuman Nilai Rapor Online</h2>

              <p className="text-indigo-600 font-bold text-sm uppercase mb-8">{schoolData.semesterTitle} {schoolData.academicYear}</p>
              
              <div className="text-left space-y-4">
                 <div className="relative">
                    <Hash className="absolute left-3 top-3.5 text-slate-400" size={18}/>
                    <input type="number" value={searchNisn} onChange={handleNisnSearchInput} placeholder="Masukkan NISN" className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-lg font-mono"/>
                 </div>
                 {foundStudentName && (
                   <div className="bg-emerald-50 text-emerald-800 px-4 py-3 rounded-xl font-bold flex justify-between items-center border border-emerald-100 animate-fade-in-up">
                     <span className="truncate">{foundStudentName}</span>
                     <CheckCircle size={18} className="shrink-0"/>
                   </div>
                 )}
                 <button onClick={checkGrades} disabled={!foundStudentName} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition disabled:bg-slate-300 disabled:shadow-none">Lihat Rapor</button>
              </div>
              <div className="mt-8 text-center">
                <button onClick={() => setView('login_admin')} className="text-slate-400 text-xs font-bold hover:text-indigo-600">Login Guru / Admin</button>
              </div>
           </div>
        </div>
      )}
      
      {view === 'result' && renderStudentResultView()}
      {view === 'login_admin' && (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm">
            <h2 className="text-2xl font-bold text-center mb-6">Admin Login</h2>
            <input className="border p-3 rounded-xl w-full mb-3" placeholder="Username" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} />
            <input className="border p-3 rounded-xl w-full mb-6" type="password" placeholder="Password" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
            <button onClick={handleAdminLogin} className="w-full bg-indigo-900 text-white py-3 rounded-xl font-bold">Masuk</button>
            <button onClick={() => setView('home')} className="w-full mt-4 text-slate-400 text-sm">Kembali ke Beranda</button>
          </div>
        </div>
      )}
      
      {view === 'admin' && renderAdminDashboard()}
    </div>
  );
}