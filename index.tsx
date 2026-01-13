
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
  Edit3,
  BookOpen,
  Lock,
  UserPlus,
  AlertCircle,
  FileDown,
  SmilePlus,
  ListChecks,
  FileSpreadsheet,
  CalendarDays,
  UserCheck,
  UserRoundPlus,
  Award,
  Lightbulb,
  PieChart,
  BarChart3,
  History,
  QrCode
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import * as XLSX from 'xlsx';

// Initialize AI
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Constants
const ADMIN_SECRET_CODE = "5433"; 
const KKM_THRESHOLD = 75; // Ambang batas tuntas

// Types
type GradeType = 'assignment' | 'exam' | 'uts';

interface Grade {
  type: GradeType;
  score: number;
  date: string;
  title: string;
}

interface AttendanceRecord {
  date: string;
  status: 'H' | 'S' | 'I' | 'A'; // Hadir, Sakit, Ijin, Alpha (Tanpa Kehadiran)
}

interface BehaviorRecord {
  date: string;
  score: number;
}

interface SubjectData {
  subjectName: string;
  attendance: AttendanceRecord[]; 
  grades: Grade[];
  behaviorHistory: BehaviorRecord[];
  behaviorScore: number; 
}

interface Student {
  id: string; 
  name: string;
  classGroup: string;
  subjects: SubjectData[];
}

const STORAGE_KEY = 'teacher_dashboard_data_v9';

const App = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [viewMode, setViewMode] = useState<'landing' | 'guru' | 'siswa'>('landing');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'attendance' | 'grading' | 'reports'>('dashboard');
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState<string | null>(null);
  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [selectedClass, setSelectedClass] = useState<string>('Semua');
  const [selectedSubject, setSelectedSubject] = useState<string>('Semua');
  
  const [activeSubjectPortal, setActiveSubjectPortal] = useState<string | null>(null);

  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showSingleAddModal, setShowSingleAddModal] = useState(false);
  const [showBulkGradeModal, setShowBulkGradeModal] = useState(false);
  const [showBulkBehaviorModal, setShowBulkBehaviorModal] = useState(false);
  const [showManualAttendanceModal, setShowManualAttendanceModal] = useState(false);
  const [showBarcodePortal, setShowBarcodePortal] = useState(false);
  
  const [formName, setFormName] = useState('');
  const [formClass, setFormClass] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [bulkClassName, setBulkClassName] = useState('');
  const [bulkSubjectName, setBulkSubjectName] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  
  const [bulkGradeTitle, setBulkGradeTitle] = useState('');
  const [bulkGradeType, setBulkGradeType] = useState<GradeType>('assignment');
  const [tempScores, setTempScores] = useState<Record<string, number>>({});
  const [tempBehaviorScores, setTempBehaviorScores] = useState<Record<string, number>>({});
  const [tempAttendance, setTempAttendance] = useState<Record<string, 'H' | 'S' | 'I' | 'A'>>({});
  
  const [teacherLoginCode, setTeacherLoginCode] = useState('');
  const [studentLoginId, setStudentLoginId] = useState('');
  const [loggedInStudent, setLoggedInStudent] = useState<Student | null>(null);

  const scannerRef = useRef<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setStudents(JSON.parse(saved));
    } else {
      const demo: Student[] = [
        { 
          id: '1001', 
          name: 'Budi Santoso', 
          classGroup: '7-A', 
          subjects: [
            { 
              subjectName: 'Matematika', 
              attendance: [{ date: '2023-10-01', status: 'H' }], 
              grades: [
                { title: 'Tugas 1', score: 80, type: 'assignment', date: '2023-10-01' },
                { title: 'UTS Ganjil', score: 85, type: 'uts', date: '2023-10-15' },
                { title: 'Ulangan Harian 1', score: 90, type: 'exam', date: '2023-12-01' }
              ], 
              behaviorHistory: [{date: '2023-10-01', score: 85}], 
              behaviorScore: 85 
            }
          ] 
        }
      ];
      setStudents(demo);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
    if (loggedInStudent) {
      const updated = students.find(s => s.id === loggedInStudent.id);
      if (updated) setLoggedInStudent(updated);
    }
  }, [students]);

  const classGroups = ['Semua', ...Array.from(new Set(students.map(s => s.classGroup)))];
  const allSubjectsList = ['Semua', ...Array.from(new Set(students.flatMap(s => s.subjects.map(sub => sub.subjectName))))];

  const handleStudentLogin = () => {
    const student = students.find(s => s.id === studentLoginId);
    if (student) {
      setLoggedInStudent(student);
      setViewMode('siswa');
      if (student.subjects.length > 0) {
        setActiveSubjectPortal(student.subjects[0].subjectName);
      }
    } else {
      alert("ID Siswa tidak ditemukan.");
    }
  };

  const markAttendance = (studentId: string, subject: string, status: 'H' | 'S' | 'I' | 'A' = 'H') => {
    const today = new Date().toISOString().split('T')[0];
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        const newSubjects = s.subjects.map(sub => {
          if (sub.subjectName === subject) {
            const alreadyMarked = sub.attendance.find(a => a.date === today);
            if (alreadyMarked) {
              return { ...sub, attendance: sub.attendance.map(a => a.date === today ? { ...a, status } : a) };
            }
            return { ...sub, attendance: [...sub.attendance, { date: today, status }] };
          }
          return sub;
        });
        return { ...s, subjects: newSubjects };
      }
      return s;
    }));
  };

  const startScanner = () => {
    if (selectedSubject === 'Semua') {
      alert("Pilih Mata Pelajaran spesifik di filter atas sebelum scan.");
      return;
    }
    setIsScanning(true);
    setTimeout(() => {
      const html5QrCode = new (window as any).Html5Qrcode("reader");
      scannerRef.current = html5QrCode;
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          const student = students.find(s => s.id === decodedText);
          if (student) {
            markAttendance(decodedText, selectedSubject, 'H');
            setScanSuccess(true);
            setTimeout(() => setScanSuccess(false), 800);
          } else {
            alert(`ID ${decodedText} tidak ditemukan.`);
          }
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

  const handleSingleAdd = () => {
    if (!formName.trim() || !formClass.trim() || !formSubject.trim()) {
      alert("Lengkapi data.");
      return;
    }
    setStudents(prev => {
      const newId = `${formClass}-${Date.now() % 10000}`;
      const newSubData: SubjectData = {
        subjectName: formSubject.trim(),
        attendance: [],
        grades: [],
        behaviorHistory: [{ date: new Date().toISOString().split('T')[0], score: 80 }],
        behaviorScore: 80
      };
      const found = prev.find(s => s.name === formName.trim() && s.classGroup === formClass.trim());
      if (found) {
        if (found.subjects.find(sub => sub.subjectName === formSubject.trim())) {
          alert("Siswa sudah terdaftar di mapel ini.");
          return prev;
        }
        return prev.map(s => s.id === found.id ? { ...s, subjects: [...s.subjects, newSubData] } : s);
      }
      return [...prev, { id: newId, name: formName.trim(), classGroup: formClass.trim(), subjects: [newSubData] }];
    });
    setShowSingleAddModal(false);
    setFormName('');
    alert("Siswa ditambahkan.");
  };

  const handleBulkAdd = () => {
    if (!bulkClassName.trim() || !bulkSubjectName.trim()) {
      alert("Isi Kelas dan Mapel.");
      return;
    }
    const names = bulkNames.split('\n').filter(n => n.trim() !== '');
    if (names.length === 0) return alert("Isi nama.");
    setStudents(prev => {
      let updated = [...prev];
      names.forEach((name, i) => {
        const studentName = name.trim();
        const existingIdx = updated.findIndex(s => s.name === studentName && s.classGroup === bulkClassName.trim());
        const newSub: SubjectData = {
          subjectName: bulkSubjectName.trim(),
          attendance: [],
          grades: [],
          behaviorHistory: [{ date: new Date().toISOString().split('T')[0], score: 80 }],
          behaviorScore: 80
        };
        if (existingIdx !== -1) {
          if (!updated[existingIdx].subjects.find(sub => sub.subjectName === bulkSubjectName.trim())) {
            updated[existingIdx].subjects.push(newSub);
          }
        } else {
          updated.push({
            id: `${bulkClassName}-${bulkSubjectName.substring(0,2)}-${Date.now() % 1000}-${i}`,
            name: studentName,
            classGroup: bulkClassName.trim(),
            subjects: [newSub]
          });
        }
      });
      return updated;
    });
    setShowBulkModal(false);
    setBulkNames('');
    alert("Input massal sukses.");
  };

  const handleBulkGradeSave = () => {
    if (selectedSubject === 'Semua') return alert("Pilih mapel.");
    if (!bulkGradeTitle.trim()) return alert("Isi judul.");
    const date = new Date().toLocaleDateString('id-ID');
    setStudents(prev => prev.map(s => {
      if (s.classGroup === selectedClass || selectedClass === 'Semua') {
        const score = tempScores[s.id] || 0;
        return {
          ...s,
          subjects: s.subjects.map(sub => {
            if (sub.subjectName === selectedSubject) {
              return { ...sub, grades: [...sub.grades, { title: bulkGradeTitle, score, type: bulkGradeType, date }] };
            }
            return sub;
          })
        };
      }
      return s;
    }));
    setShowBulkGradeModal(false);
    setTempScores({});
    alert("Nilai massal disimpan.");
  };

  const handleManualAttendanceSave = () => {
    if (selectedSubject === 'Semua') return alert("Pilih mapel.");
    const today = new Date().toISOString().split('T')[0];
    setStudents(prev => prev.map(s => {
      if (s.classGroup === selectedClass || selectedClass === 'Semua') {
        const status = tempAttendance[s.id];
        if (status) {
          return {
            ...s,
            subjects: s.subjects.map(sub => {
              if (sub.subjectName === selectedSubject) {
                const marked = sub.attendance.find(a => a.date === today);
                if (marked) return { ...sub, attendance: sub.attendance.map(a => a.date === today ? { ...a, status } : a) };
                return { ...sub, attendance: [...sub.attendance, { date: today, status }] };
              }
              return sub;
            })
          };
        }
      }
      return s;
    }));
    setShowManualAttendanceModal(false);
    setTempAttendance({});
    alert("Presensi disimpan.");
  };

  const handleBulkBehaviorSave = () => {
    if (selectedSubject === 'Semua') {
      alert("Pilih mata pelajaran spesifik di filter atas.");
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    setStudents(prev => prev.map(s => {
      if (s.classGroup === selectedClass || selectedClass === 'Semua') {
        const score = tempBehaviorScores[s.id];
        if (score !== undefined) {
          return {
            ...s,
            subjects: s.subjects.map(sub => {
              if (sub.subjectName === selectedSubject) {
                return {
                  ...sub,
                  behaviorScore: score,
                  behaviorHistory: [...sub.behaviorHistory, { date: today, score }]
                };
              }
              return sub;
            })
          };
        }
      }
      return s;
    }));
    setShowBulkBehaviorModal(false);
    setTempBehaviorScores({});
    alert("Data sikap disimpan.");
  };

  const downloadBarcode = (id: string, name: string) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${id}`;
    fetch(qrUrl)
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QR_${name}_${id}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(() => alert("Gagal unduh QR."));
  };

  const handleExportFinalReport = () => {
    const dataToExport: any[] = [];
    students.filter(s => selectedClass === 'Semua' || s.classGroup === selectedClass).forEach(s => {
      s.subjects.forEach(sub => {
        if (selectedSubject === 'Semua' || sub.subjectName === selectedSubject) {
          const gradesTugas = sub.grades.filter(g => g.type === 'assignment');
          const gradesUjian = sub.grades.filter(g => g.type === 'exam');
          const gradesUTS = sub.grades.filter(g => g.type === 'uts');

          const avgTugas = gradesTugas.length > 0 ? (gradesTugas.reduce((a,b) => a + b.score, 0) / gradesTugas.length) : 0;
          const avgUjian = gradesUjian.length > 0 ? (gradesUjian.reduce((a,b) => a + b.score, 0) / gradesUjian.length) : 0;
          const avgUTS = gradesUTS.length > 0 ? (gradesUTS.reduce((a,b) => a + b.score, 0) / gradesUTS.length) : 0;
          
          // Hitung rata-rata total untuk status
          const totalGrades = [...gradesTugas, ...gradesUjian, ...gradesUTS];
          const avgTotal = totalGrades.length > 0 ? (totalGrades.reduce((a,b) => a + b.score, 0) / totalGrades.length) : 0;
          const statusRemidial = avgTotal >= KKM_THRESHOLD ? "Tuntas" : "Remedial";

          const attH = sub.attendance.filter(a => a.status === 'H').length;
          const attA = sub.attendance.filter(a => a.status === 'A').length;

          dataToExport.push({
            'Nama Siswa': s.name,
            'ID Siswa': s.id,
            'Kelas': s.classGroup,
            'Mata Pelajaran': sub.subjectName,
            'Rerata Nilai Tugas': avgTugas.toFixed(1),
            'Rerata Nilai Ulangan Harian': avgUjian.toFixed(1),
            'Rerata Nilai UTS': avgUTS.toFixed(1),
            'Jumlah Kehadiran (H)': attH,
            'Tanpa Kehadiran (A)': attA,
            'Skor Sikap': sub.behaviorScore,
            'Status Akademik': statusRemidial
          });
        }
      });
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Review Raport");
    XLSX.writeFile(wb, `LaporanRaport_${selectedSubject}_${selectedClass}.xlsx`);
  };

  const generateGlobalAISummary = async (student: Student) => {
    setLoadingAI(student.id);
    try {
      const summaries = student.subjects.map(sub => {
        const getAvgVal = (t: GradeType) => {
          const list = sub.grades.filter(g => g.type === t);
          return list.length > 0 ? (list.reduce((a,b) => a + b.score, 0) / list.length).toFixed(1) : "0";
        };
        const hadir = sub.attendance.filter(a => a.status === 'H').length;
        const alpha = sub.attendance.filter(a => a.status === 'A').length;
        return `${sub.subjectName}: Tugas[${getAvgVal('assignment')}], Ulangan Harian[${getAvgVal('exam')}], UTS[${getAvgVal('uts')}], Hadir[${hadir}], Tanpa Kehadiran[${alpha}]`;
      }).join('\n');

      const prompt = `Analisis rapor siswa ${student.name} berdasarkan kategori akademik (Tugas, Ulangan Harian, UTS) dan kehadiran (Hadir/Tanpa Kehadiran):\n${summaries}\n
      Berikan ringkasan akhir perkembangan belajar dan saran peningkatan konkret per kategori. Gunakan Bahasa Indonesia formal dan memotivasi.`;

      const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: prompt });
      setAiSummaries(prev => ({ ...prev, [student.id]: response.text || "Analisis selesai." }));
    } catch (e) { console.error(e); } finally { setLoadingAI(null); }
  };

  const filteredStudents = students.filter(s => {
    const classMatch = selectedClass === 'Semua' || s.classGroup === selectedClass;
    const subjectMatch = selectedSubject === 'Semua' || s.subjects.some(sub => sub.subjectName === selectedSubject);
    return classMatch && subjectMatch;
  });

  if (viewMode === 'landing') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_top_left,_#e0e7ff_0%,_transparent_40%),radial-gradient(circle_at_bottom_right,_#fef3c7_0%,_transparent_40%)]">
        <div className="max-w-4xl w-full">
          <div className="text-center mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="inline-flex items-center justify-center p-4 bg-indigo-600 rounded-3xl text-white shadow-2xl mb-8"><ClipboardList size={48} /></div>
            <h1 className="text-6xl font-black text-black mb-4 tracking-tighter">EduScan <span className="text-indigo-600">Pro</span></h1>
            <p className="text-black text-xl font-medium">Monitoring Akademik & Presensi Barcode</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-[48px] p-12 shadow-2xl border flex flex-col items-center">
              <div className="w-24 h-24 bg-indigo-100 rounded-3xl flex items-center justify-center text-indigo-600 mb-8"><ShieldCheck size={48} /></div>
              <h2 className="text-3xl font-black text-black mb-4">Akses Guru</h2>
              <input type="password" placeholder="Kode Admin" value={teacherLoginCode} onChange={(e) => setTeacherLoginCode(e.target.value)} className="w-full py-5 rounded-2xl bg-slate-50 border text-center text-black font-bold text-lg mb-4" />
              <button onClick={() => { if(teacherLoginCode===ADMIN_SECRET_CODE){ setViewMode('guru'); setTeacherLoginCode(''); }else alert('Salah'); }} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"><LogIn size={20} /> Login Guru</button>
            </div>
            <div className="bg-white rounded-[48px] p-12 shadow-2xl border flex flex-col items-center">
              <div className="w-24 h-24 bg-amber-100 rounded-3xl flex items-center justify-center text-amber-600 mb-8"><GraduationCap size={48} /></div>
              <h2 className="text-3xl font-black text-black mb-4">Akses Siswa</h2>
              <input type="text" placeholder="ID Siswa" value={studentLoginId} onChange={(e) => setStudentLoginId(e.target.value)} className="w-full py-5 rounded-2xl bg-slate-50 border text-center text-black font-bold text-lg mb-4" />
              <button onClick={handleStudentLogin} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all"><LogIn size={20} /> Masuk Portal</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'siswa' && loggedInStudent) {
    const s = loggedInStudent;
    const currentSub = s.subjects.find(sub => sub.subjectName === activeSubjectPortal);
    const getAvg = (sub: SubjectData, type: GradeType) => {
      const gList = sub.grades.filter(g => g.type === type);
      return gList.length > 0 ? (gList.reduce((a,b) => a + b.score, 0) / gList.length).toFixed(1) : "0";
    };

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
        <aside className="w-full md:w-80 bg-white border-r p-8 max-h-screen sticky top-0 overflow-y-auto">
          <div className="flex items-center gap-4 mb-10 text-indigo-600 font-black text-2xl"><GraduationCap size={32} /> EduPortal</div>
          
          <div className="mb-10 p-6 bg-slate-900 text-white rounded-[32px] shadow-xl text-center space-y-4">
             <div className="w-20 h-20 bg-indigo-600 text-white rounded-3xl mx-auto flex items-center justify-center text-3xl font-black">{s.name[0]}</div>
             <div>
               <p className="font-black text-lg mb-1">{s.name}</p>
               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{s.classGroup}</p>
             </div>
             <button onClick={() => setShowBarcodePortal(true)} className="w-full bg-white text-slate-900 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all">
               <QrCode size={16} /> ID Barcode Saya
             </button>
          </div>

          <div className="space-y-2">
             <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-4 mb-4">Mata Pelajaran</p>
             {s.subjects.map(sub => (
               <button key={sub.subjectName} onClick={() => setActiveSubjectPortal(sub.subjectName)} className={`w-full text-left p-4 rounded-2xl flex items-center justify-between transition-all ${activeSubjectPortal === sub.subjectName ? 'bg-indigo-600 text-white shadow-xl' : 'hover:bg-slate-100 text-black'}`}>
                 <span className="font-bold">{sub.subjectName}</span>
                 <ChevronRight size={18} />
               </button>
             ))}
          </div>
          <button onClick={() => setViewMode('landing')} className="mt-20 w-full flex items-center justify-center gap-3 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase hover:bg-red-600 hover:text-white transition-all"><LogOut size={16} /> Keluar</button>
        </aside>

        <main className="flex-1 p-6 md:p-12 space-y-10">
           {currentSub ? (
             <div className="space-y-10 animate-in slide-in-from-bottom-6">
                <h2 className="text-5xl font-black text-black">{currentSub.subjectName}</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border-b-8 border-indigo-600">
                    <h4 className="font-black text-black text-[10px] uppercase mb-4 tracking-widest">Rerata Tugas</h4>
                    <p className="text-5xl font-black text-black">{getAvg(currentSub, 'assignment')}</p>
                  </div>
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border-b-8 border-amber-500">
                    <h4 className="font-black text-black text-[10px] uppercase mb-4 tracking-widest">Rerata Ulangan Harian</h4>
                    <p className="text-5xl font-black text-black">{getAvg(currentSub, 'exam')}</p>
                  </div>
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border-b-8 border-emerald-500">
                    <h4 className="font-black text-black text-[10px] uppercase mb-4 tracking-widest">Rerata UTS</h4>
                    <p className="text-5xl font-black text-black">{getAvg(currentSub, 'uts')}</p>
                  </div>
                  <div className="bg-white p-8 rounded-[40px] shadow-sm border-b-8 border-slate-900">
                    <h4 className="font-black text-black text-[10px] uppercase mb-4 tracking-widest">Presensi (H / A)</h4>
                    <p className="text-5xl font-black text-black">
                      {currentSub.attendance.filter(a => a.status === 'H').length} / <span className="text-red-600">{currentSub.attendance.filter(a => a.status === 'A').length}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                   <div className="lg:col-span-2 bg-white rounded-[48px] p-10 border shadow-sm space-y-8">
                      <h3 className="text-xl font-black text-black flex items-center gap-4"><History /> Riwayat Akademik</h3>
                      <div className="space-y-4 max-h-[600px] overflow-y-auto no-scrollbar">
                        {currentSub.grades.map((g, i) => (
                          <div key={i} className="p-6 bg-slate-50 rounded-[32px] flex justify-between items-center border border-transparent hover:border-indigo-100 transition-all">
                            <div>
                              <p className="font-black text-black text-lg">{g.title}</p>
                              <span className={`text-[10px] font-black uppercase tracking-widest ${g.type === 'assignment' ? 'text-indigo-600' : g.type === 'uts' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {g.type === 'exam' ? 'Ulangan Harian' : g.type} • {g.date}
                              </span>
                            </div>
                            <div className="text-3xl font-black text-black">{g.score}</div>
                          </div>
                        ))}
                      </div>
                   </div>
                   <div className="space-y-8">
                      <div className="bg-slate-900 text-white p-10 rounded-[50px] shadow-2xl space-y-6">
                         <h3 className="text-2xl font-black flex items-center gap-3"><Lightbulb className="text-amber-400" /> Analisis Raport AI</h3>
                         <p className="text-zinc-400 font-medium leading-relaxed">Asisten AI akan menganalisis perkembangan belajar kamu dan memberikan tips khusus.</p>
                         <button onClick={() => generateGlobalAISummary(s)} disabled={loadingAI === s.id} className="w-full bg-indigo-600 py-6 rounded-3xl font-black flex items-center justify-center gap-3 active:scale-95 transition-all">
                           {loadingAI === s.id ? <Loader2 className="animate-spin" /> : <Brain />} Analisis Menyeluruh
                         </button>
                      </div>
                      {aiSummaries[s.id] && (
                        <div className="bg-white p-10 rounded-[50px] border-2 border-dashed border-indigo-100 animate-in zoom-in">
                           <p className="text-lg font-serif italic text-black leading-relaxed whitespace-pre-wrap">"{aiSummaries[s.id]}"</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
           ) : <div className="py-40 text-center font-black text-zinc-300">PILIH MATA PELAJARAN</div>}
        </main>

        {/* Modal Barcode Siswa */}
        {showBarcodePortal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-md animate-in fade-in">
             <div className="bg-white rounded-[60px] p-12 w-full max-w-md text-center space-y-8 relative shadow-2xl">
                <button onClick={() => setShowBarcodePortal(false)} className="absolute top-8 right-8 text-zinc-400 hover:text-black transition-all"><X size={32} /></button>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">ID Barcode Siswa</h3>
                  <p className="text-zinc-500 font-medium">Tunjukkan kode ini kepada guru untuk presensi</p>
                </div>
                <div className="bg-slate-50 p-10 rounded-[48px] inline-block border-4 border-slate-100">
                  <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${s.id}`} alt="QR Code" className="w-64 h-64 shadow-inner" />
                </div>
                <div>
                   <p className="text-2xl font-black text-indigo-600 tracking-widest">{s.id}</p>
                   <p className="text-sm font-bold text-slate-400 uppercase mt-2">{s.name}</p>
                </div>
             </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 flex-col md:flex-row">
      <div className="md:hidden sticky top-0 z-50 px-6 py-4 flex justify-between items-center bg-white border-b">
        <h1 className="text-xl font-black text-black">EduScan Guru</h1>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-black"><Menu size={24} /></button>
      </div>

      <aside className={`fixed inset-0 z-[60] md:relative md:z-auto transition-transform w-72 bg-white border-r p-8 h-screen ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <h1 className="text-2xl font-black text-indigo-600 mb-16">EduScan Pro</h1>
        <nav className="space-y-3 flex-1">
          {[
            { id: 'dashboard', icon: TrendingUp, label: 'Dashboard' },
            { id: 'students', icon: Users, label: 'Database Siswa' },
            { id: 'attendance', icon: ScanLine, label: 'Presensi Scan' },
            { id: 'grading', icon: Star, label: 'Input Penilaian' },
            { id: 'reports', icon: FileText, label: 'Review Raport' }
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id as any); setIsSidebarOpen(false); if(isScanning) stopScanner(); }} className={`flex items-center gap-3 w-full px-5 py-4 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-black hover:bg-slate-100'}`}>
              <tab.icon size={22} /><span className="font-bold">{tab.label}</span>
            </button>
          ))}
        </nav>
        <button onClick={() => setViewMode('landing')} className="mt-auto flex items-center justify-center gap-3 w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-red-600 hover:text-white transition-all"><LogOut size={16} /> Logout Guru</button>
      </aside>

      <main className="flex-1 p-6 md:p-12 overflow-x-hidden">
        <header className="flex flex-wrap items-center justify-between mb-12 gap-6">
          <h2 className="text-3xl font-black text-black capitalize">{activeTab}</h2>
          <div className="flex gap-4 bg-white p-3 rounded-3xl border shadow-sm">
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="bg-slate-50 px-4 py-2 rounded-xl font-black text-xs text-black outline-none border">
              {classGroups.map(c => <option key={c} value={c}>Kelas: {c}</option>)}
            </select>
            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="bg-slate-50 px-4 py-2 rounded-xl font-black text-xs text-black outline-none border">
              {allSubjectsList.map(s => <option key={s} value={s}>Mapel: {s}</option>)}
            </select>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[48px] shadow-sm border-l-8 border-indigo-600">
              <h3 className="font-black text-zinc-900 text-xs uppercase mb-4 tracking-widest">Siswa Terdaftar (Filter)</h3>
              <p className="text-7xl font-black text-black">{filteredStudents.length}</p>
            </div>
            <div className="bg-white p-10 rounded-[48px] shadow-sm border-l-8 border-amber-500">
              <h3 className="font-black text-zinc-900 text-xs uppercase mb-4 tracking-widest">Mata Pelajaran Aktif</h3>
              <p className="text-7xl font-black text-black">{allSubjectsList.length - 1}</p>
            </div>
          </div>
        )}

        {activeTab === 'grading' && (
          <div className="space-y-10">
            <div className="flex flex-wrap gap-4">
               <button onClick={() => setShowBulkGradeModal(true)} className="bg-indigo-600 text-white px-8 py-5 rounded-3xl font-black flex items-center gap-3 shadow-md hover:bg-indigo-700 transition-all"><ListChecks /> Penilaian Massal</button>
               <button onClick={() => setShowBulkBehaviorModal(true)} className="bg-amber-500 text-white px-8 py-5 rounded-3xl font-black flex items-center gap-3 shadow-md hover:bg-amber-600 transition-all"><SmilePlus /> Penilaian Sikap</button>
            </div>
            <div className="bg-white rounded-[48px] p-12 border shadow-sm">
               <h3 className="text-xl font-black text-black mb-10 flex items-center gap-3"><BarChart3 /> Penilaian Terpisah ({selectedSubject})</h3>
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-4 max-h-[500px] overflow-y-auto no-scrollbar">
                    {filteredStudents.map(s => (
                      <button key={s.id} onClick={() => setSelectedStudentId(s.id)} className={`w-full p-6 rounded-3xl border-2 flex items-center justify-between transition-all ${selectedStudentId === s.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-50 bg-white'}`}>
                        <span className="font-black text-black">{s.name}</span>
                        <ChevronRight size={18} className="text-black" />
                      </button>
                    ))}
                  </div>
                  {selectedStudentId && (
                    <div className="bg-slate-50 p-10 rounded-[40px] space-y-6 animate-in slide-in-from-right-4 border">
                       <h4 className="text-xl font-black text-indigo-700">{students.find(s => s.id === selectedStudentId)?.name}</h4>
                       <div className="space-y-4 border-t pt-6">
                          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block ml-2">Input Nilai Akademik Baru</label>
                          <input id="sgTitle" type="text" placeholder="Judul (Tugas 1 / Ulangan Harian 2 / UTS)" className="w-full p-4 rounded-2xl border text-black font-medium" />
                          <select id="sgType" className="w-full p-4 rounded-2xl border text-black font-black uppercase text-xs">
                             <option value="assignment">Tugas</option>
                             <option value="uts">UTS (Tengah Semester)</option>
                             <option value="exam">Ulangan Harian</option>
                          </select>
                          <input id="sgScore" type="number" placeholder="Skor 0-100" className="w-full p-4 rounded-2xl border text-black font-bold" />
                          <button onClick={() => {
                            const t = document.getElementById('sgTitle') as HTMLInputElement;
                            const type = document.getElementById('sgType') as HTMLSelectElement;
                            const sc = document.getElementById('sgScore') as HTMLInputElement;
                            if (t.value && sc.value) {
                              setStudents(prev => prev.map(st => {
                                 if (st.id === selectedStudentId) {
                                    return {
                                       ...st,
                                       subjects: st.subjects.map(sub => sub.subjectName === selectedSubject ? {...sub, grades: [...sub.grades, {title: t.value, score: parseInt(sc.value), type: type.value as GradeType, date: new Date().toLocaleDateString('id-ID')}]} : sub)
                                    };
                                 }
                                 return st;
                              }));
                              t.value = ''; sc.value = '';
                              alert("Nilai berhasil disimpan.");
                            }
                          }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all">Simpan Nilai</button>
                       </div>
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-8">
            <div className="bg-slate-900 text-white p-12 rounded-[56px] flex flex-wrap justify-between items-center gap-8 shadow-2xl">
               <div className="max-w-xl">
                 <h3 className="text-4xl font-black mb-4 tracking-tighter">Review & Export Raport</h3>
                 <p className="text-zinc-400 font-medium leading-relaxed">Lihat performa akhir siswa ({selectedSubject}). Format Excel kini menyertakan status <strong>Tuntas/Remedial</strong> otomatis berdasarkan KKM {KKM_THRESHOLD}.</p>
               </div>
               <button onClick={handleExportFinalReport} className="bg-emerald-500 text-white px-10 py-6 rounded-3xl font-black flex items-center gap-4 hover:scale-105 transition-all shadow-xl"><FileSpreadsheet size={24} /> Download Review (.xlsx)</button>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {filteredStudents.map(s => {
                const sub = s.subjects.find(sb => sb.subjectName === (selectedSubject === 'Semua' ? s.subjects[0]?.subjectName : selectedSubject));
                const attH = sub?.attendance.filter(a => a.status === 'H').length || 0;
                const attA = sub?.attendance.filter(a => a.status === 'A').length || 0;
                
                const avgVal = (type: GradeType) => {
                   if (!sub) return "0";
                   const list = sub.grades.filter(g => g.type === type);
                   return list.length > 0 ? (list.reduce((a,b) => a + b.score, 0) / list.length).toFixed(1) : "0";
                };

                const totalAcademic = sub?.grades || [];
                const avgAll = totalAcademic.length > 0 ? (totalAcademic.reduce((a,b) => a + b.score, 0) / totalAcademic.length) : 0;
                const isTuntas = avgAll >= KKM_THRESHOLD;

                return (
                  <div key={s.id} className="bg-white p-8 rounded-[48px] border shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:border-indigo-600 transition-all border-slate-200">
                    <div className="flex items-center gap-6">
                       <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-2xl text-black">{s.name[0]}</div>
                       <div>
                         <h4 className="text-xl font-black text-black">{s.name}</h4>
                         <div className="flex gap-2 items-center mt-1">
                            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{s.id}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${isTuntas ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                               {isTuntas ? 'Tuntas' : 'Remedial'}
                            </span>
                         </div>
                       </div>
                    </div>
                    <div className="flex flex-wrap gap-6 items-center bg-slate-50 p-6 rounded-[32px] border">
                       <div className="text-center px-4 border-r border-slate-200">
                          <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">Hadir / Absen</p>
                          <p className="font-black text-black text-lg">{attH} / <span className="text-red-600">{attA}</span></p>
                       </div>
                       <div className="text-center px-4 border-r border-slate-200">
                          <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">Rata Tugas</p>
                          <p className="font-black text-indigo-600 text-lg">{avgVal('assignment')}</p>
                       </div>
                       <div className="text-center px-4 border-r border-slate-200">
                          <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">Rata UTS</p>
                          <p className="font-black text-emerald-600 text-lg">{avgVal('uts')}</p>
                       </div>
                       <div className="text-center px-4">
                          <p className="text-[10px] font-black text-zinc-400 uppercase mb-1">Rata Ulangan</p>
                          <p className="font-black text-amber-600 text-lg">{avgVal('exam')}</p>
                       </div>
                    </div>
                    <button onClick={() => generateGlobalAISummary(s)} disabled={loadingAI === s.id} className="bg-slate-900 text-white px-8 py-5 rounded-2xl font-black flex items-center gap-3 shadow-md hover:bg-indigo-600 transition-all">
                       {loadingAI === s.id ? <Loader2 className="animate-spin" /> : <Brain />} Detail Rapor AI
                    </button>
                  </div>
                );
              })}
              {filteredStudents.length === 0 && <div className="py-20 text-center font-black text-zinc-300 tracking-widest">TIDAK ADA DATA SISWA TERFILTER</div>}
            </div>
          </div>
        )}

        {/* Tab Data Siswa */}
        {activeTab === 'students' && (
          <div className="bg-white rounded-[40px] shadow-xl overflow-hidden border">
             <div className="p-10 border-b flex flex-wrap justify-between items-center gap-6">
                <div>
                   <h3 className="text-2xl font-black text-black">Database Induk Siswa</h3>
                   <p className="text-zinc-400 text-xs font-bold uppercase mt-1 tracking-widest">Manajemen Satu ID Multi-Mapel</p>
                </div>
                <div className="flex gap-4">
                   <button onClick={() => setShowSingleAddModal(true)} className="bg-indigo-50 text-indigo-600 px-6 py-4 rounded-2xl font-black text-xs uppercase hover:bg-indigo-100 transition-all">Siswa Baru</button>
                   <button onClick={() => setShowBulkModal(true)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase hover:bg-indigo-600 transition-all">Input Massal</button>
                </div>
             </div>
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                   <tr>
                      <th className="px-10 py-6">Nama</th>
                      <th className="px-10 py-6">ID Barcode</th>
                      <th className="px-10 py-6">Mata Pelajaran</th>
                      <th className="px-10 py-6">Aksi</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                   {filteredStudents.map(s => (
                     <tr key={s.id} className="hover:bg-slate-50 group transition-all">
                        <td className="px-10 py-6"><p className="font-black text-black">{s.name}</p><span className="text-[10px] font-bold text-zinc-400">{s.classGroup}</span></td>
                        <td className="px-10 py-6 font-mono text-xs font-bold text-zinc-500">{s.id}</td>
                        <td className="px-10 py-6 flex flex-wrap gap-2">
                           {s.subjects.map(sub => <span key={sub.subjectName} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase">{sub.subjectName}</span>)}
                        </td>
                        <td className="px-10 py-6">
                           <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => downloadBarcode(s.id, s.name)} title="Download QR" className="p-3 bg-slate-100 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Download size={16} /></button>
                              <button onClick={() => setStudents(prev => prev.filter(x => x.id !== s.id))} title="Hapus Data" className="p-3 bg-slate-100 rounded-xl hover:bg-red-600 hover:text-white transition-all"><Trash2 size={16} /></button>
                           </div>
                        </td>
                     </tr>
                   ))}
                </tbody>
             </table>
          </div>
        )}

        {/* Tab Presensi */}
        {activeTab === 'attendance' && (
          <div className="flex flex-col items-center py-10 gap-10">
            <div className="flex flex-wrap justify-center gap-6">
               <button onClick={() => setShowManualAttendanceModal(true)} className="bg-indigo-600 text-white px-10 py-6 rounded-[32px] font-black flex items-center gap-4 shadow-xl active:scale-95 transition-all"><UserCheck size={24} /> Presensi Manual</button>
               <button onClick={startScanner} className="bg-slate-900 text-white px-10 py-6 rounded-[32px] font-black flex items-center gap-4 shadow-xl active:scale-95 transition-all"><ScanLine size={24} /> Aktifkan Scanner ({selectedSubject})</button>
            </div>
            <div className={`relative bg-slate-900 rounded-[48px] overflow-hidden aspect-square w-full max-w-lg flex items-center justify-center border-8 ${scanSuccess ? 'border-emerald-500' : 'border-slate-50'} shadow-2xl transition-all duration-300`}>
              {isScanning ? <div id="reader" className="w-full h-full"></div> : <p className="text-zinc-500 font-black">Scanner Belum Aktif</p>}
              {scanSuccess && <div className="absolute inset-0 bg-emerald-500/40 flex items-center justify-center animate-in zoom-in"><CheckCircle size={80} className="text-white" /></div>}
            </div>
            {isScanning && <button onClick={stopScanner} className="px-10 py-4 bg-red-50 text-red-600 font-black rounded-2xl hover:bg-red-600 hover:text-white transition-all">Matikan Kamera</button>}
          </div>
        )}

        {/* MODAL PENILAIAN MASSAL */}
        {showBulkGradeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl rounded-[50px] overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in fade-in zoom-in">
              <div className="p-10 border-b bg-indigo-600 text-white flex justify-between items-center">
                <h3 className="text-2xl font-black">Input Nilai Massal - {selectedSubject}</h3>
                <button onClick={() => setShowBulkGradeModal(false)}><X size={24} /></button>
              </div>
              <div className="p-10 overflow-y-auto space-y-8 no-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">Judul Penilaian</label>
                      <input type="text" placeholder="Tugas 1 / Ulangan Harian 2" value={bulkGradeTitle} onChange={(e) => setBulkGradeTitle(e.target.value)} className="w-full p-5 rounded-2xl bg-slate-50 border font-bold text-black" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-4">Kategori Akademik</label>
                      <select value={bulkGradeType} onChange={(e) => setBulkGradeType(e.target.value as GradeType)} className="w-full p-5 rounded-2xl bg-slate-50 border font-black text-xs uppercase text-black">
                        <option value="assignment">Tugas</option>
                        <option value="uts">UTS (Tengah Semester)</option>
                        <option value="exam">Ulangan Harian</option>
                      </select>
                   </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredStudents.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-5 bg-white rounded-3xl border shadow-sm">
                      <span className="font-bold truncate w-40 text-black">{s.name}</span>
                      <input type="number" placeholder="Skor" onChange={(e) => setTempScores(prev => ({...prev, [s.id]: parseInt(e.target.value)}))} className="w-20 p-3 rounded-xl border border-slate-200 text-center font-black text-black" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-8 border-t bg-slate-50 flex gap-4">
                <button onClick={() => setShowBulkGradeModal(false)} className="flex-1 py-5 bg-white border font-black rounded-2xl text-black">Batal</button>
                <button onClick={handleBulkGradeSave} className="flex-[2] py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl">Simpan Massal</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL INPUT SISWA BARU */}
        {showSingleAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-2xl rounded-[48px] shadow-2xl p-12 space-y-8 relative">
              <button onClick={() => setShowSingleAddModal(false)} className="absolute top-10 right-10 text-zinc-400"><X size={32} /></button>
              <h3 className="text-3xl font-black text-black tracking-tight">Daftarkan Siswa Baru</h3>
              <div className="space-y-6">
                <input type="text" placeholder="Nama Lengkap" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 font-bold text-black focus:border-indigo-600 outline-none" />
                <div className="grid grid-cols-2 gap-6">
                  <input type="text" placeholder="Kelas (contoh: 8-B)" value={formClass} onChange={(e) => setFormClass(e.target.value)} className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 font-bold text-black focus:border-indigo-600 outline-none" />
                  <input type="text" placeholder="Mapel Pertama" value={formSubject} onChange={(e) => setFormSubject(e.target.value)} className="w-full px-8 py-5 rounded-3xl bg-slate-50 border-2 font-bold text-black focus:border-indigo-600 outline-none" />
                </div>
              </div>
              <button onClick={handleSingleAdd} className="w-full py-6 bg-indigo-600 text-white rounded-[32px] font-black shadow-xl">Simpan Data</button>
            </div>
          </div>
        )}

        {/* MODAL INPUT MASSAL */}
        {showBulkModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl rounded-[50px] shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-6">
              <div className="p-10 border-b flex justify-between items-center bg-slate-900 text-white">
                <h3 className="text-2xl font-black">Input Daftar Nama Serentak</h3>
                <button onClick={() => setShowBulkModal(false)}><X size={24} /></button>
              </div>
              <div className="p-10 overflow-y-auto space-y-6 no-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                   <input type="text" placeholder="Tentukan Kelas" value={bulkClassName} onChange={(e) => setBulkClassName(e.target.value)} className="p-5 rounded-2xl bg-slate-50 border-2 font-bold text-black" />
                   <input type="text" placeholder="Tentukan Mapel" value={bulkSubjectName} onChange={(e) => setBulkSubjectName(e.target.value)} className="p-5 rounded-2xl bg-slate-50 border-2 font-bold text-black" />
                </div>
                <textarea rows={8} placeholder="Masukkan daftar nama (pisahkan dengan baris baru)..." value={bulkNames} onChange={(e) => setBulkNames(e.target.value)} className="w-full p-8 rounded-3xl bg-slate-50 border-2 text-black font-medium text-lg no-scrollbar" />
              </div>
              <div className="p-8 border-t bg-slate-50 flex gap-4">
                <button onClick={() => setShowBulkModal(false)} className="flex-1 py-5 bg-white border font-black rounded-2xl text-black">Batal</button>
                <button onClick={handleBulkAdd} className="flex-[2] py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl">Simpan Serentak</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PRESENSI MANUAL */}
        {showManualAttendanceModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl rounded-[50px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in">
              <div className="p-10 border-b flex justify-between items-center bg-indigo-600 text-white">
                <h3 className="text-2xl font-black">Presensi Manual - {selectedSubject}</h3>
                <button onClick={() => setShowManualAttendanceModal(false)}><X size={24} /></button>
              </div>
              <div className="p-10 overflow-y-auto space-y-4 no-scrollbar">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center mb-4">H = Hadir, S = Sakit, I = Ijin, A = Alpha (Tanpa Hadir)</p>
                {filteredStudents.map(s => (
                  <div key={s.id} className="p-6 bg-slate-50 rounded-[32px] flex items-center justify-between border">
                     <span className="font-bold truncate w-40 text-black">{s.name}</span>
                     <div className="flex gap-2">
                       {['H','S','I','A'].map(st => (
                         <button key={st} onClick={() => setTempAttendance(prev => ({...prev, [s.id]: st as any}))} className={`w-12 h-12 rounded-2xl font-black transition-all ${tempAttendance[s.id] === st ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'bg-white border text-black hover:bg-slate-100'}`}>{st}</button>
                       ))}
                     </div>
                  </div>
                ))}
              </div>
              <div className="p-8 border-t bg-slate-50 flex gap-4">
                <button onClick={() => setShowManualAttendanceModal(false)} className="flex-1 py-5 bg-white border font-black rounded-2xl text-black">Batal</button>
                <button onClick={handleManualAttendanceSave} className="flex-[2] py-5 bg-indigo-600 text-white font-black rounded-2xl shadow-xl">Simpan Data</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL SIKAP MASSAL */}
        {showBulkBehaviorModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-4xl rounded-[50px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-top-4">
              <div className="p-10 border-b flex justify-between items-center bg-amber-500 text-white">
                <h3 className="text-2xl font-black">Skor Sikap Pertemuan - {selectedSubject}</h3>
                <button onClick={() => setShowBulkBehaviorModal(false)}><X size={24} /></button>
              </div>
              <div className="p-10 overflow-y-auto space-y-4 no-scrollbar">
                {filteredStudents.map(s => (
                  <div key={s.id} className="p-6 bg-slate-50 rounded-[32px] flex items-center justify-between border">
                     <span className="font-bold truncate text-black">{s.name}</span>
                     <input type="number" min="0" max="100" placeholder="Skor" onChange={(e) => setTempBehaviorScores(prev => ({...prev, [s.id]: parseInt(e.target.value)}))} className="w-24 p-4 rounded-2xl border text-center font-black text-black" />
                  </div>
                ))}
              </div>
              <div className="p-8 border-t bg-slate-50 flex gap-4">
                <button onClick={() => setShowBulkBehaviorModal(false)} className="flex-1 py-5 bg-white border font-black rounded-2xl text-black">Batal</button>
                <button onClick={handleBulkBehaviorSave} className="flex-[2] py-5 bg-amber-500 text-white font-black rounded-2xl shadow-xl">Simpan Sikap</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
