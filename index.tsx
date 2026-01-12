
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Users, 
  ScanLine, 
  ClipboardList, 
  FileText, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Star, 
  TrendingUp, 
  ChevronRight,
  UserPlus,
  ArrowLeft,
  Loader2,
  Brain,
  Download,
  Menu,
  X,
  Layers,
  Save,
  LogIn,
  LogOut,
  GraduationCap,
  ShieldCheck,
  Share2,
  RefreshCw,
  Globe,
  Link as LinkIcon,
  Settings,
  Edit3,
  BookOpen
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// Initialize AI
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Types
interface Grade {
  type: 'assignment' | 'exam';
  score: number;
  date: string;
  title: string;
  subject?: string;
}

interface Student {
  id: string; // Akun Belajar / Barcode ID
  name: string;
  classGroup: string;
  subject: string; // Mata Pelajaran
  attendance: string[]; // YYYY-MM-DD
  grades: Grade[];
  behaviorScore: number; // 0-100
  isClassroomSync?: boolean;
}

const STORAGE_KEY = 'teacher_dashboard_data_v4';

const App = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [viewMode, setViewMode] = useState<'landing' | 'guru' | 'siswa'>('landing');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'attendance' | 'grading' | 'reports' | 'classroom'>('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState<string | null>(null);
  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Filters
  const [selectedClass, setSelectedClass] = useState<string>('Semua');
  const [selectedSubject, setSelectedSubject] = useState<string>('Semua');
  
  // Modals & UI States
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkClassName, setBulkClassName] = useState('');
  const [bulkSubjectName, setBulkSubjectName] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  
  // Google Classroom State
  const [isClassroomConnected, setIsClassroomConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Student Auth & Profile State
  const [studentLoginId, setStudentLoginId] = useState('');
  const [loggedInStudent, setLoggedInStudent] = useState<Student | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newName, setNewName] = useState('');

  const scannerRef = useRef<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setStudents(JSON.parse(saved));
    } else {
      const demo: Student[] = [
        { id: '1001', name: 'Budi Santoso', classGroup: '7-A', subject: 'Matematika', attendance: [], grades: [], behaviorScore: 85, isClassroomSync: true },
        { id: '1002', name: 'Siti Aminah', classGroup: '7-A', subject: 'Matematika', attendance: [], grades: [], behaviorScore: 92, isClassroomSync: true },
      ];
      setStudents(demo);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    // Update loggedInStudent if students change (for name updates)
    if (loggedInStudent) {
      const updated = students.find(s => s.id === loggedInStudent.id);
      if (updated) setLoggedInStudent(updated);
    }
  }, [students]);

  const classGroups = ['Semua', ...Array.from(new Set(students.map(s => s.classGroup)))];
  const subjects = ['Semua', ...Array.from(new Set(students.map(s => s.subject)))];

  const connectClassroom = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsClassroomConnected(true);
      setIsSyncing(false);
    }, 1200);
  };

  const importFromClassroom = (courseName: string, subjectName: string) => {
    setIsSyncing(true);
    setTimeout(() => {
      const mockClassroomStudents: Student[] = [
        { id: `GC-${courseName}-${subjectName}-01`, name: 'Rendra Wijaya', classGroup: courseName, subject: subjectName, attendance: [], grades: [], behaviorScore: 80, isClassroomSync: true },
        { id: `GC-${courseName}-${subjectName}-02`, name: 'Dewi Lestari', classGroup: courseName, subject: subjectName, attendance: [], grades: [], behaviorScore: 80, isClassroomSync: true },
      ];
      setStudents(prev => [...prev, ...mockClassroomStudents]);
      setIsSyncing(false);
      alert(`Berhasil sinkronisasi siswa dari ${courseName} - ${subjectName}`);
    }, 1500);
  };

  const markAttendance = (studentId: string) => {
    const today = new Date().toISOString().split('T')[0];
    setStudents(prev => prev.map(s => {
      if (s.id === studentId && !s.attendance.includes(today)) {
        return { ...s, attendance: [...s.attendance, today] };
      }
      return s;
    }));
  };

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const html5QrCode = new (window as any).Html5Qrcode("reader");
      scannerRef.current = html5QrCode;
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          markAttendance(decodedText);
          const student = students.find(s => s.id === decodedText);
          if (student) alert(`Presensi: ${student.name} (${student.classGroup} - ${student.subject}) Berhasil!`);
          else alert(`ID ${decodedText} tidak ditemukan.`);
        },
        () => {}
      ).catch(() => setIsScanning(false));
    }, 100);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop();
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleBulkAdd = () => {
    if (!bulkClassName.trim() || !bulkSubjectName.trim()) {
      alert("Isi Nama Kelas dan Mata Pelajaran.");
      return;
    }
    const names = bulkNames.split('\n').filter(n => n.trim() !== '');
    const newOnes: Student[] = names.map((name, i) => ({
      id: `${bulkClassName}-${bulkSubjectName}-${Date.now()}-${i}`,
      name: name.trim(),
      classGroup: bulkClassName.trim(),
      subject: bulkSubjectName.trim(),
      attendance: [],
      grades: [],
      behaviorScore: 80
    }));
    setStudents(prev => [...prev, ...newOnes]);
    setShowBulkModal(false);
    setBulkNames('');
  };

  const handleUpdateName = () => {
    if (!newName.trim()) return;
    setStudents(prev => prev.map(s => s.id === loggedInStudent?.id ? { ...s, name: newName.trim() } : s));
    setIsEditingProfile(false);
    alert("Nama akun berhasil diubah!");
  };

  // Fix: Implemented handleStudentLogin to allow students to access their portal
  const handleStudentLogin = () => {
    if (!studentLoginId.trim()) {
      alert("Silakan masukkan ID Akun Belajar Anda.");
      return;
    }
    const student = students.find(s => s.id === studentLoginId.trim());
    if (student) {
      setLoggedInStudent(student);
      setViewMode('siswa');
    } else {
      alert("ID Akun Belajar tidak ditemukan.");
    }
  };

  // Fix: Implemented downloadBarcode to enable barcode saving for students
  const downloadBarcode = async (id: string, name: string) => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${id}`;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `barcode-${name.replace(/\s+/g, '-')}-${id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error("Gagal mengunduh barcode", e);
      alert("Gagal mengunduh barcode. Silakan coba lagi.");
    }
  };

  const generateSummary = async (student: Student) => {
    setLoadingAI(student.id);
    try {
      const avg = student.grades.length > 0 ? student.grades.reduce((a, b) => a + b.score, 0) / student.grades.length : 0;
      const prompt = `Berikan narasi rapor singkat (2-3 kalimat) untuk:
      Nama: ${student.name}
      Kelas: ${student.classGroup}
      Mata Pelajaran: ${student.subject}
      Rata-rata Nilai: ${avg.toFixed(1)}
      Sikap: ${student.behaviorScore}/100.
      Bahasa Indonesia yang formal namun memotivasi.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      setAiSummaries(prev => ({ ...prev, [student.id]: response.text || "Analisis selesai." }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAI(null);
    }
  };

  const filteredStudents = students.filter(s => 
    (selectedClass === 'Semua' || s.classGroup === selectedClass) && 
    (selectedSubject === 'Semua' || s.subject === selectedSubject)
  );

  const classAvg = filteredStudents.length > 0 ? (filteredStudents.reduce((acc, s) => {
    const avg = s.grades.length > 0 ? s.grades.reduce((a, g) => a + g.score, 0) / s.grades.length : 0;
    return acc + avg;
  }, 0) / filteredStudents.length).toFixed(1) : '0';

  if (viewMode === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top_left,_#e0e7ff_0%,_transparent_40%),radial-gradient(circle_at_bottom_right,_#fef3c7_0%,_transparent_40%)]">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="inline-flex items-center justify-center p-4 bg-indigo-600 rounded-3xl text-white shadow-2xl mb-8">
              <ClipboardList size={48} />
            </div>
            <h1 className="text-6xl font-black text-slate-900 mb-4 tracking-tighter">EduScan <span className="text-indigo-600">Pro</span></h1>
            <p className="text-slate-500 text-xl font-medium">Sistem Terintegrasi Google Classroom & Barcode Harian</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div 
              className="bg-white rounded-[48px] p-12 shadow-2xl border-2 border-slate-50 group hover:border-indigo-600 transition-all cursor-pointer flex flex-col items-center text-center" 
              onClick={() => setViewMode('guru')}
            >
              <div className="w-24 h-24 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600 mb-8 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                <ShieldCheck size={48} />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-3">Login Guru</h2>
              <p className="text-slate-500 text-sm mb-10 leading-relaxed">Kelola pengelompokan kelas & mata pelajaran, absensi, dan publikasi rapor digital.</p>
              <button className="mt-auto bg-indigo-600 text-white font-black py-5 px-12 rounded-2xl shadow-xl shadow-indigo-100 uppercase tracking-widest text-xs">Admin Dashboard</button>
            </div>

            <div className="bg-white rounded-[48px] p-12 shadow-2xl border-2 border-slate-50 group hover:border-amber-500 transition-all flex flex-col">
              <div className="w-24 h-24 bg-amber-100 rounded-3xl flex items-center justify-center text-amber-600 mb-8 mx-auto">
                <GraduationCap size={48} />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-3 text-center">Portal Siswa</h2>
              <p className="text-slate-500 text-sm mb-10 text-center leading-relaxed">Pantau capaian belajar, ubah profil, dan akses Akun Belajar Anda secara aman.</p>
              <div className="space-y-4">
                <input 
                  type="text" 
                  placeholder="ID Akun Belajar" 
                  value={studentLoginId}
                  onChange={(e) => setStudentLoginId(e.target.value)}
                  className="w-full px-8 py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-amber-500 outline-none font-bold text-center text-lg"
                />
                <button 
                  onClick={handleStudentLogin}
                  className="w-full bg-slate-900 text-white font-black py-5 px-10 rounded-2xl shadow-2xl uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-slate-800 transition-all"
                >
                  <LogIn size={20} /> Masuk Portal
                </button>
              </div>
            </div>
          </div>
          <p className="text-center mt-20 text-slate-400 font-bold text-[10px] uppercase tracking-[0.5em] opacity-50">Global Classroom Standard v4.0</p>
        </div>
      </div>
    );
  }

  // Student Portal View
  if (viewMode === 'siswa' && loggedInStudent) {
    const s = loggedInStudent;
    const finalScore = s.grades.length > 0 
      ? (s.grades.reduce((a, b) => a + b.score, 0) / s.grades.length * 0.8 + s.behaviorScore * 0.2).toFixed(1)
      : '0';

    return (
      <div className="min-h-screen bg-slate-50 animate-in fade-in duration-500">
        <header className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white p-12 pb-32 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-12 opacity-5"><GraduationCap size={300} /></div>
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-10 relative z-10">
            <div className="flex items-center gap-8">
              <div className="relative group">
                <div className="w-32 h-32 rounded-[40px] bg-white text-indigo-700 flex items-center justify-center text-5xl font-black shadow-2xl">
                  {s.name[0]}
                </div>
                <button 
                  onClick={() => { setIsEditingProfile(!isEditingProfile); setNewName(s.name); }}
                  className="absolute -bottom-2 -right-2 bg-amber-500 text-white p-3 rounded-2xl shadow-lg hover:scale-110 transition-all border-4 border-indigo-700"
                >
                  <Edit3 size={20} />
                </button>
              </div>
              <div>
                <span className="text-indigo-200 text-xs font-black uppercase tracking-[0.4em]">Siswa Terdaftar</span>
                {isEditingProfile ? (
                  <div className="flex items-center gap-3 mt-2">
                    <input 
                      type="text" 
                      value={newName} 
                      onChange={(e) => setNewName(e.target.value)}
                      className="bg-white/10 border-2 border-white/20 rounded-xl px-4 py-2 text-2xl font-black outline-none focus:border-white/50"
                    />
                    <button onClick={handleUpdateName} className="bg-white text-indigo-700 p-2 rounded-xl shadow-lg"><Save size={20} /></button>
                  </div>
                ) : (
                  <h1 className="text-4xl md:text-6xl font-black mt-1 leading-tight">{s.name}</h1>
                )}
                <div className="flex flex-wrap gap-4 mt-4">
                  <span className="bg-white/10 px-4 py-1.5 rounded-full text-xs font-bold border border-white/10 uppercase tracking-widest">{s.classGroup}</span>
                  <span className="bg-white/10 px-4 py-1.5 rounded-full text-xs font-bold border border-white/10 uppercase tracking-widest">{s.subject}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => { setViewMode('landing'); setLoggedInStudent(null); }}
              className="bg-white/10 hover:bg-white/20 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 backdrop-blur-xl border border-white/20 transition-all"
            >
              <LogOut size={20} /> Logout
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto -mt-20 p-6 pb-24 relative z-20 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-10 rounded-[48px] shadow-2xl border-b-8 border-indigo-600 flex flex-col items-center">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Skor Kumulatif</h3>
              <p className="text-7xl font-black text-slate-900">{finalScore}</p>
            </div>
            <div className="bg-white p-10 rounded-[48px] shadow-2xl border-b-8 border-green-500 flex flex-col items-center">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Total Kehadiran</h3>
              <p className="text-7xl font-black text-slate-900">{s.attendance.length}</p>
              <p className="text-[10px] font-bold text-slate-300 mt-2 uppercase tracking-tighter">Hari Terpindai Barcode</p>
            </div>
            <div className="bg-white p-10 rounded-[48px] shadow-2xl border-b-8 border-amber-500 flex flex-col items-center">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Sikap / Karakter</h3>
              <p className="text-7xl font-black text-slate-900">{s.behaviorScore}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-[48px] p-12 shadow-xl border border-slate-100">
               <div className="flex items-center justify-between mb-10">
                 <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                   <BookOpen className="text-indigo-600" /> Detail Nilai {s.subject}
                 </h3>
               </div>
               <div className="space-y-4">
                 {s.grades.map((g, i) => (
                   <div key={i} className="flex items-center justify-between p-6 bg-slate-50 rounded-[32px] border border-slate-100 hover:bg-white hover:shadow-md transition-all">
                      <div>
                        <p className="font-black text-slate-800 text-lg">{g.title}</p>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{g.type} • {g.date}</span>
                      </div>
                      <div className="text-3xl font-black text-indigo-700">{g.score}</div>
                   </div>
                 ))}
                 {s.grades.length === 0 && <div className="text-center py-20 text-slate-300 font-bold italic">Belum ada data nilai masuk.</div>}
               </div>
            </div>
            <div className="space-y-8">
              {aiSummaries[s.id] && (
                <div className="bg-slate-900 text-white rounded-[40px] p-10 shadow-2xl relative">
                  <Brain size={32} className="text-indigo-400 mb-6" />
                  <h4 className="font-black text-xs uppercase tracking-[0.3em] mb-4 opacity-50">Narasi AI Gemini</h4>
                  <p className="text-lg font-serif italic leading-relaxed text-indigo-100">"{aiSummaries[s.id]}"</p>
                </div>
              )}
              <div className="bg-white rounded-[40px] p-10 shadow-xl border border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Barcode Digital Presensi</p>
                <div className="bg-slate-50 p-8 rounded-[40px] border-4 border-dashed border-slate-200 inline-block mb-8">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${s.id}`} alt="QR" className="w-40 h-40 mix-blend-multiply" />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed px-4">Tunjukkan kode ini ke guru pengampu <strong>{s.subject}</strong> untuk melakukan absensi.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Teacher UI Logic
  const SidebarItem = ({ icon: Icon, label, id }: { icon: any, label: string, id: typeof activeTab }) => (
    <button
      onClick={() => { setActiveTab(id); setIsSidebarOpen(false); if (isScanning) stopScanner(); }}
      className={`flex items-center gap-3 w-full px-5 py-4 rounded-2xl transition-all ${
        activeTab === id ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon size={22} />
      <span className="font-bold tracking-tight">{label}</span>
    </button>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 flex-col md:flex-row font-inter">
      {/* Mobile Top Header */}
      <div className="md:hidden glass-card sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><ClipboardList size={20} /></div>
          <h1 className="text-xl font-black text-slate-900">EduScan</h1>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-slate-600 bg-slate-100 rounded-xl">
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <aside className={`fixed inset-0 z-[60] md:relative md:z-auto transition-transform duration-300 md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} w-72 glass-card border-r flex flex-col p-8 h-screen overflow-y-auto`}>
        <div className="hidden md:flex items-center gap-4 mb-16 px-2">
          <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-xl"><ClipboardList size={28} /></div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter">EduScan <span className="text-indigo-600">Pro</span></h1>
        </div>
        
        <nav className="space-y-3 flex-1">
          <SidebarItem icon={TrendingUp} label="Dashboard" id="dashboard" />
          <SidebarItem icon={Users} label="Database Siswa" id="students" />
          <SidebarItem icon={ScanLine} label="Scan Barcode" id="attendance" />
          <SidebarItem icon={Star} label="Input Penilaian" id="grading" />
          <SidebarItem icon={FileText} label="Review Rapor" id="reports" />
          <SidebarItem icon={Globe} label="Google Classroom" id="classroom" />
        </nav>

        <div className="pt-8 border-t mt-auto text-center space-y-6">
          <button onClick={() => setViewMode('landing')} className="flex items-center justify-center gap-3 w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all">
            <LogOut size={16} /> Keluar Admin
          </button>
          <div className="opacity-30">
            <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest">Version 4.0.0</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-12 overflow-x-hidden">
        {/* Global Filter Bar */}
        <div className="flex flex-wrap items-center justify-between mb-12 gap-6">
          <div className="flex-1 min-w-[300px]">
            <h2 className="text-3xl font-black text-slate-900 capitalize tracking-tight leading-none mb-2">{activeTab}</h2>
            <p className="text-slate-400 font-medium">Monitoring pendidikan terpusat</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
              <Layers size={16} className="text-indigo-600" />
              <select 
                value={selectedClass} 
                onChange={(e) => setSelectedClass(e.target.value)}
                className="bg-transparent font-black text-slate-700 text-xs outline-none cursor-pointer"
              >
                {classGroups.map(c => <option key={c} value={c}>Kelas: {c}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
              <BookOpen size={16} className="text-amber-600" />
              <select 
                value={selectedSubject} 
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-transparent font-black text-slate-700 text-xs outline-none cursor-pointer"
              >
                {subjects.map(s => <option key={s} value={s}>Mapel: {s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* TAB: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-card p-10 rounded-[48px] shadow-sm border-l-8 border-l-blue-600 transition-transform hover:scale-[1.02]">
              <div className="flex items-center gap-6 mb-6">
                <div className="bg-blue-100 p-4 rounded-3xl text-blue-600 shadow-inner"><Users size={32} /></div>
                <h3 className="font-black text-slate-500 text-xs uppercase tracking-widest">Siswa Terfilter</h3>
              </div>
              <p className="text-7xl font-black text-slate-900">{filteredStudents.length}</p>
            </div>
            <div className="glass-card p-10 rounded-[48px] shadow-sm border-l-8 border-l-indigo-600 transition-transform hover:scale-[1.02]">
              <div className="flex items-center gap-6 mb-6">
                <div className="bg-indigo-100 p-4 rounded-3xl text-indigo-600 shadow-inner"><Star size={32} /></div>
                <h3 className="font-black text-slate-500 text-xs uppercase tracking-widest">Rata-rata Nilai</h3>
              </div>
              <p className="text-7xl font-black text-slate-900">{classAvg}</p>
            </div>
            <div className="glass-card p-10 rounded-[48px] shadow-sm border-l-8 border-l-emerald-600 transition-transform hover:scale-[1.02]">
              <div className="flex items-center gap-6 mb-6">
                <div className="bg-emerald-100 p-4 rounded-3xl text-emerald-600 shadow-inner"><Globe size={32} className={isSyncing ? 'animate-spin' : ''} /></div>
                <h3 className="font-black text-slate-500 text-xs uppercase tracking-widest">Koneksi Cloud</h3>
              </div>
              <p className={`text-2xl font-black uppercase tracking-widest ${isClassroomConnected ? 'text-emerald-600' : 'text-slate-300'}`}>
                {isClassroomConnected ? 'Terhubung' : 'Terputus'}
              </p>
            </div>
          </div>
        )}

        {/* TAB: CLASSROOM */}
        {activeTab === 'classroom' && (
          <div className="space-y-10 animate-in fade-in duration-700">
            <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white p-12 rounded-[56px] shadow-2xl flex flex-wrap items-center justify-between gap-10 relative overflow-hidden">
               <div className="absolute -right-10 -bottom-10 opacity-5"><Globe size={400} /></div>
               <div className="max-w-xl relative z-10">
                 <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-80 mb-6 block">Google Workspace for Education</span>
                 <h3 className="text-5xl font-black mb-4 leading-tight">Sync Kelas & Mapel</h3>
                 <p className="text-emerald-50 text-lg font-medium opacity-90 leading-relaxed">Hubungkan EduScan untuk menarik data spesifik per mata pelajaran langsung dari kursus Google Classroom Anda.</p>
               </div>
               {!isClassroomConnected ? (
                 <button onClick={connectClassroom} disabled={isSyncing} className="bg-white text-emerald-800 px-12 py-6 rounded-[32px] font-black shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-4 relative z-10">
                   {isSyncing ? <Loader2 className="animate-spin" /> : <LinkIcon size={24} />} Hubungkan Layanan
                 </button>
               ) : (
                 <div className="bg-white/10 px-10 py-6 rounded-[32px] backdrop-blur-2xl border-2 border-white/20 flex items-center gap-4 relative z-10">
                    <div className="w-4 h-4 bg-emerald-300 rounded-full animate-pulse"></div>
                    <span className="font-black text-sm uppercase tracking-widest">Layanan Cloud Aktif</span>
                 </div>
               )}
            </div>

            {isClassroomConnected && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[
                  { name: '10-IPA-2', subject: 'Biologi' },
                  { name: '9-H', subject: 'Matematika' },
                  { name: '12-IPS-1', subject: 'Sosiologi' }
                ].map((course, idx) => (
                  <div key={idx} className="bg-white p-10 rounded-[48px] shadow-xl border border-slate-100 hover:border-emerald-500 transition-all group">
                    <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-all">
                      <BookOpen size={28} />
                    </div>
                    <h4 className="text-2xl font-black text-slate-800 mb-2">{course.name}</h4>
                    <p className="text-emerald-600 font-bold text-sm uppercase tracking-widest mb-8">{course.subject}</p>
                    <button 
                      onClick={() => importFromClassroom(course.name, course.subject)}
                      disabled={isSyncing}
                      className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} /> Tarik Data
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: STUDENTS */}
        {activeTab === 'students' && (
          <div className="bg-white rounded-[48px] shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-10 border-b bg-white flex flex-wrap justify-between items-center gap-8">
              <div>
                <h3 className="font-black text-slate-900 text-2xl tracking-tight">Management Basis Data</h3>
                <p className="text-slate-400 font-bold text-xs uppercase mt-2 tracking-widest">Filter: {selectedClass} • {selectedSubject}</p>
              </div>
              <button onClick={() => setShowBulkModal(true)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl flex items-center gap-3 font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all">
                <Plus size={20} /> Input Group Siswa
              </button>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[900px]">
                <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">
                  <tr>
                    <th className="px-10 py-8">Identitas Siswa</th>
                    <th className="px-10 py-8">ID / Akun Belajar</th>
                    <th className="px-10 py-8">Kelas & Mapel</th>
                    <th className="px-10 py-8">Sumber Data</th>
                    <th className="px-10 py-8">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredStudents.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-all group">
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-lg">{s.name[0]}</div>
                          <span className="font-black text-slate-800 text-lg">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6 font-mono text-xs text-slate-400 font-bold">{s.id}</td>
                      <td className="px-10 py-6">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-700 text-sm uppercase">{s.classGroup}</span>
                          <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{s.subject}</span>
                        </div>
                      </td>
                      <td className="px-10 py-6">
                        {s.isClassroomSync ? (
                          <span className="bg-emerald-100 text-emerald-700 text-[9px] font-black px-4 py-1.5 rounded-full border border-emerald-200 uppercase tracking-widest">Classroom Sync</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-400 text-[9px] font-black px-4 py-1.5 rounded-full border uppercase tracking-widest">Manual Input</span>
                        )}
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => downloadBarcode(s.id, s.name)} className="bg-indigo-50 text-indigo-600 p-3 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Download size={18} /></button>
                          <button onClick={() => setStudents(prev => prev.filter(x => x.id !== s.id))} className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={18} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr><td colSpan={5} className="py-32 text-center text-slate-300 font-black italic uppercase tracking-widest opacity-30">Tidak ada siswa ditemukan</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL BULK */}
        {showBulkModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" onClick={() => setShowBulkModal(false)}></div>
            <div className="relative bg-white rounded-[56px] w-full max-w-3xl overflow-hidden shadow-2xl shadow-indigo-500/20">
              <div className="p-12 bg-indigo-600 text-white flex justify-between items-center">
                <div>
                  <h3 className="text-4xl font-black mb-2 leading-none">Input Cepat Group</h3>
                  <p className="opacity-80 font-medium">Buat pengelompokan kelas dan mata pelajaran.</p>
                </div>
                <button onClick={() => setShowBulkModal(false)} className="p-4 bg-white/10 hover:bg-white/20 rounded-3xl transition-all"><X size={32} /></button>
              </div>
              <div className="p-12 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Nama Kelas</label>
                    <input type="text" placeholder="Contoh: 10-A" value={bulkClassName} onChange={(e) => setBulkClassName(e.target.value)} className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold" />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Mata Pelajaran</label>
                    <input type="text" placeholder="Contoh: Fisika" value={bulkSubjectName} onChange={(e) => setBulkSubjectName(e.target.value)} className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-bold" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-4">Daftar Nama (Satu baris per siswa)</label>
                  <textarea rows={6} placeholder="Budi Santoso&#10;Siti Aminah..." value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} className="w-full px-8 py-6 rounded-[32px] bg-slate-50 border-2 border-transparent focus:border-indigo-600 outline-none font-medium resize-none"></textarea>
                </div>
                <button onClick={handleBulkAdd} className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl shadow-2xl text-sm uppercase tracking-widest hover:bg-indigo-700 transition-all duration-500">
                  Eksekusi & Simpan Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="flex flex-col items-center py-10">
            <div className="w-full max-w-2xl bg-white rounded-[64px] p-16 text-center shadow-2xl border-t-[12px] border-t-indigo-600">
              <h3 className="text-4xl font-black text-slate-900 mb-4">Presensi Mapel</h3>
              <p className="text-slate-400 font-medium mb-12">Scan kartu barcode untuk presensi: <span className="text-indigo-600 font-black">{selectedSubject}</span></p>
              <div className="relative bg-slate-900 rounded-[48px] overflow-hidden aspect-square mb-12 flex items-center justify-center border-8 border-slate-50 shadow-inner group">
                {!isScanning ? (
                  <button onClick={startScanner} className="bg-indigo-600 text-white px-16 py-6 rounded-3xl font-black shadow-2xl hover:scale-105 transition-all text-xs uppercase tracking-[0.2em]">Aktifkan Scanner</button>
                ) : (
                  <div id="reader" className="w-full h-full"></div>
                )}
              </div>
              {isScanning && <button onClick={stopScanner} className="bg-red-50 text-red-600 px-12 py-5 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-all">Nonaktifkan Kamera</button>}
            </div>
          </div>
        )}

        {/* TAB: GRADING */}
        {activeTab === 'grading' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="bg-white rounded-[56px] p-10 shadow-xl max-h-[800px] overflow-y-auto no-scrollbar border border-slate-50">
              <h3 className="font-black text-slate-900 text-xl mb-10 uppercase tracking-widest opacity-30">Daftar Siswa {selectedClass}</h3>
              <div className="space-y-4">
                {filteredStudents.map(s => (
                  <button 
                    key={s.id} 
                    onClick={() => setSelectedStudentId(s.id)} 
                    className={`w-full text-left p-6 rounded-[32px] border-2 transition-all flex items-center justify-between ${
                      selectedStudentId === s.id ? 'border-indigo-600 bg-indigo-50 shadow-2xl ring-8 ring-indigo-50' : 'bg-white border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${selectedStudentId === s.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{s.name[0]}</div>
                      <div>
                        <p className="font-black text-slate-800 text-lg leading-tight">{s.name}</p>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{s.subject}</p>
                      </div>
                    </div>
                    <ChevronRight size={22} className={selectedStudentId === s.id ? 'text-indigo-600' : 'text-slate-200'} />
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-[56px] p-12 shadow-2xl border border-slate-50">
               {selectedStudentId ? (
                 <div className="animate-in slide-in-from-right-4 duration-500">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em] mb-4 block">Input Nilai Manual</span>
                    <h3 className="text-4xl font-black text-slate-900 mb-12">{students.find(s => s.id === selectedStudentId)?.name}</h3>
                    <section className="bg-slate-50 p-10 rounded-[48px] border-4 border-dashed border-slate-200 space-y-6">
                       <input id="gradeTitle" type="text" placeholder="Judul Tugas / Ulangan" className="w-full px-8 py-5 rounded-3xl bg-white shadow-sm outline-none font-bold focus:ring-4 focus:ring-indigo-100" />
                       <div className="grid grid-cols-2 gap-6">
                         <select id="gradeType" className="w-full px-8 py-5 rounded-3xl bg-white shadow-sm font-black text-xs uppercase tracking-widest outline-none"><option value="assignment">Tugas</option><option value="exam">Ujian</option></select>
                         <input id="gradeScore" type="number" placeholder="Skor 0-100" className="w-full px-8 py-5 rounded-3xl bg-white shadow-sm font-black text-2xl outline-none" />
                       </div>
                       <button 
                         onClick={() => {
                           const t = document.getElementById('gradeTitle') as HTMLInputElement;
                           const s = document.getElementById('gradeScore') as HTMLInputElement;
                           const ty = document.getElementById('gradeType') as HTMLSelectElement;
                           if (t.value && s.value) {
                             const stId = selectedStudentId!;
                             setStudents(prev => prev.map(st => st.id === stId ? {...st, grades: [...st.grades, {title: t.value, score: parseInt(s.value), type: ty.value as any, date: new Date().toLocaleDateString('id-ID'), subject: st.subject}]} : st));
                             t.value = ''; s.value = '';
                             alert("Nilai berhasil disimpan.");
                           }
                         }}
                         className="w-full bg-indigo-600 text-white font-black py-6 rounded-3xl shadow-2xl shadow-indigo-200 uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all duration-500"
                       >
                         Submit Penilaian
                       </button>
                    </section>
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center py-40 text-slate-200 opacity-20">
                   <Star size={120} className="mb-8" />
                   <p className="text-xl font-black uppercase tracking-widest">Pilih Siswa</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* TAB: REPORTS */}
        {activeTab === 'reports' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
            <div className="bg-slate-900 text-white p-12 rounded-[56px] shadow-2xl flex flex-wrap items-center justify-between gap-10">
               <div className="max-w-lg">
                 <h3 className="text-5xl font-black mb-4 tracking-tighter">Analisis Akhir</h3>
                 <p className="text-slate-400 font-medium leading-relaxed">Review narasi AI Gemini berdasarkan pengelompokan Mapel: <span className="text-indigo-400 font-black">{selectedSubject}</span>.</p>
               </div>
               <div className="bg-white/10 p-8 rounded-[32px] backdrop-blur-3xl border border-white/10 text-center">
                 <Brain size={48} className="text-indigo-400 mx-auto mb-4" />
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-50">AI Reporting Engine</p>
               </div>
            </div>
            {filteredStudents.map(s => (
              <div key={s.id} className="bg-white rounded-[48px] p-10 shadow-xl border border-slate-100 transition-all hover:shadow-2xl hover:border-indigo-100 group">
                 <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
                    <div className="flex items-center gap-8">
                      <div className="w-20 h-20 bg-slate-100 text-slate-900 rounded-[28px] flex items-center justify-center text-3xl font-black group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">{s.name[0]}</div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-900">{s.name}</h3>
                        <div className="flex gap-4 mt-2">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.id}</span>
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{s.subject}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => generateSummary(s)} 
                      disabled={loadingAI === s.id}
                      className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 shadow-xl hover:bg-indigo-600 transition-all active:scale-95"
                    >
                      {loadingAI === s.id ? <Loader2 size={20} className="animate-spin" /> : <Brain size={20} />}
                      Generate AI Summary
                    </button>
                 </div>
                 {aiSummaries[s.id] && (
                    <div className="mt-10 p-10 bg-indigo-50/50 rounded-[40px] border-2 border-indigo-100 font-serif italic text-slate-700 text-lg leading-relaxed shadow-inner">
                      "{aiSummaries[s.id]}"
                    </div>
                 )}
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* Sidebar Overlay */}
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/60 z-50 md:hidden backdrop-blur-md" onClick={() => setIsSidebarOpen(false)}></div>}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
