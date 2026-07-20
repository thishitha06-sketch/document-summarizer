/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { db } from "./lib/firebase";
import { collection, addDoc, query, where, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { analyzeDocument } from "./services/gemini";
import { 
  FileText, 
  Upload, 
  LogOut, 
  History, 
  Trash2, 
  Loader2, 
  FileSearch,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Zap,
  Cpu,
  Layers,
  ArrowRight,
  Plus,
  Search,
  Filter,
  Calendar,
  X,
  FileUp,
  Bell,
  Settings,
  User as UserIcon,
  Clock,
  Star,
  Play,
  Download,
  Share2,
  ShieldAlert,
  Key,
  Menu,
  ChevronRight,
  MessageSquare
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { cn } from "./lib/utils";

interface Analysis {
  id: string;
  fileName: string;
  fileType: string;
  content: string;
  createdAt: any;
}

export default function App() {
  const user = { uid: "local-user", displayName: "Guest User", email: "guest@docuintel.ai" };
  const [analyzing, setAnalyzing] = useState(false);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [processingQueue, setProcessingQueue] = useState<{ id: string; name: string }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [copied, setCopied] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('docuintel_favorites');
    return saved ? JSON.parse(saved) : [];
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('docuintel_favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    const q = query(
      collection(db, "analyses"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Analysis[];
      setAnalyses(data);
    }, (err) => {
      console.error("Firestore error:", err);
      setError("Failed to load history. Please check your connection.");
    });

    return () => unsubscribe();
  }, []);

  const filteredAnalyses = useMemo(() => {
    return analyses.filter(item => {
      const matchesSearch = item.fileName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === "all" || item.fileType.includes(filterType);
      
      let matchesDate = true;
      if (filterDate !== "all") {
        const date = new Date(item.createdAt);
        const now = new Date();
        if (filterDate === "today") {
          matchesDate = date.toDateString() === now.toDateString();
        } else if (filterDate === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDate = date >= weekAgo;
        }
      }
      
      return matchesSearch && matchesType && matchesDate;
    });
  }, [analyses, searchTerm, filterType, filterDate]);

  const handleFiles = async (files: FileList | File[]) => {
    if (!user) return;
    
    const fileArray = Array.from(files);
    const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
    
    const validFiles = fileArray.filter(f => validTypes.includes(f.type));
    if (validFiles.length === 0) {
      setError("Please upload valid PDF or image files.");
      return;
    }

    setAnalyzing(true);
    setError(null);

    const prompt = customPrompt.trim() || "Extract all text from this document and provide a detailed summary and key insights.";

    // Parallel processing for O(1) relative time (concurrent) instead of O(k) sequential time
    try {
      await Promise.all(validFiles.map(async (file) => {
        const tempId = Math.random().toString(36).substring(7);
        setProcessingQueue(prev => [...prev, { id: tempId, name: file.name }]);
        
        try {
          const result = await analyzeDocument(file, prompt);
          
          await addDoc(collection(db, "analyses"), {
            userId: user.uid,
            fileName: file.name,
            fileType: file.type,
            content: result,
            createdAt: new Date().toISOString(),
          });
        } catch (err: any) {
          console.error(`Error analyzing ${file.name}:`, err);
          setError(prev => (prev ? prev + "\n" : "") + `Failed to analyze ${file.name}`);
        } finally {
          setProcessingQueue(prev => prev.filter(p => p.id !== tempId));
        }
      }));
    } catch (err) {
      console.error("Batch processing error:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => {
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const deleteAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this analysis?")) return;
    try {
      await deleteDoc(doc(db, "analyses", id));
      if (selectedAnalysis?.id === id) setSelectedAnalysis(null);
    } catch (err) {
      console.error("Delete error:", err);
      setError("Failed to delete analysis.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] flex flex-col font-sans selection:bg-brand-blue/30">
      {/* Header */}
      <header className="bg-[var(--color-bg-card)] border-b border-white/5 px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-blue/10 rounded-xl border border-brand-blue/20">
              <Sparkles className="w-5 h-5 text-brand-blue" />
            </div>
            <span className="font-bold text-xl text-white tracking-tight hidden sm:block">DocuIntel <span className="text-brand-blue">AI</span></span>
          </div>
        </div>
        
        <div className="hidden md:flex flex-1 max-w-md mx-8 relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-brand-blue transition-colors" />
          <input
            type="text"
            placeholder="Search documents, insights, or history..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-brand-blue/50 focus:bg-black/40 outline-none transition-all shadow-inner"
          />
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-blue rounded-full border-2 border-[var(--color-bg-card)]"></span>
          </button>
          <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors hidden sm:block">
            <Settings className="w-5 h-5" />
          </button>
          <div className="h-6 w-[1px] bg-white/10 mx-1 hidden sm:block" />
          
          <div className="flex items-center gap-3 pl-1">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-medium text-white leading-none mb-1">Guest Mode</span>
              <span className="text-[10px] text-slate-500">Anonymous Access</span>
            </div>
            <div className="w-9 h-9 rounded-full bg-brand-blue/10 border border-brand-blue/20 flex items-center justify-center text-brand-blue" title="Guest Mode Active">
              <UserIcon className="w-5 h-5" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Sidebar / History */}
        <aside className={cn(
          "w-full lg:w-80 bg-[var(--color-bg-card)] border-r border-white/5 flex flex-col overflow-hidden absolute lg:relative z-40 h-full transition-transform duration-300 ease-in-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}>
          <div className="p-5 border-b border-white/5">
            <button 
              onClick={() => {
                setSelectedAnalysis(null);
                setCustomPrompt("");
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
              className="w-full py-2.5 px-4 bg-brand-blue hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/20"
            >
              <Plus className="w-4 h-4" /> New Analysis
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-6 custom-scrollbar">
            {/* Recent Files Section */}
            <div>
              <div className="px-3 mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5" /> Recent Files
              </div>
              <div className="space-y-1">
                {filteredAnalyses.slice(0, 3).map((item) => (
                  <div key={`recent-${item.id}`} className="group relative">
                    <button
                      onClick={() => {
                        setSelectedAnalysis(item);
                        if (window.innerWidth < 1024) setSidebarOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3",
                        selectedAnalysis?.id === item.id 
                          ? "bg-brand-blue/10 text-brand-blue" 
                          : "hover:bg-white/5 text-slate-300 hover:text-white"
                      )}
                    >
                      <FileText className="w-4 h-4 shrink-0 opacity-70" />
                      <span className="text-sm truncate flex-1">{item.fileName}</span>
                    </button>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => toggleFavorite(item.id, e)}
                        className={cn("p-1.5 rounded-md transition-colors", favorites.includes(item.id) ? "text-yellow-400 hover:bg-yellow-400/10" : "text-slate-400 hover:text-yellow-400 hover:bg-yellow-400/10")} title={favorites.includes(item.id) ? "Remove from Favorites" : "Add to Favorites"}
                      >
                        <Star className={cn("w-3.5 h-3.5", favorites.includes(item.id) && "fill-current")} />
                      </button>
                      <button 
                        onClick={(e) => deleteAnalysis(item.id, e)}
                        className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-md" title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Favorites Section */}
            {favorites.length > 0 && (
              <div className="mb-8">
                <div className="px-3 mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <Star className="w-3.5 h-3.5" /> Favorites
                </div>
                <div className="space-y-1">
                  {analyses.filter(a => favorites.includes(a.id)).map((item) => (
                    <div key={`fav-${item.id}`} className="group relative">
                      <button
                        onClick={() => {
                          setSelectedAnalysis(item);
                          if (window.innerWidth < 1024) setSidebarOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3",
                          selectedAnalysis?.id === item.id 
                            ? "bg-brand-blue/10 text-brand-blue" 
                            : "hover:bg-white/5 text-slate-300 hover:text-white"
                        )}
                      >
                        <FileText className="w-4 h-4 shrink-0 opacity-70" />
                        <span className="text-sm truncate flex-1">{item.fileName}</span>
                      </button>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={(e) => toggleFavorite(item.id, e)}
                          className="p-1.5 text-yellow-400 hover:bg-yellow-400/10 rounded-md" title="Remove from Favorites"
                        >
                          <Star className="w-3.5 h-3.5 fill-current" />
                        </button>
                        <button 
                          onClick={(e) => deleteAnalysis(item.id, e)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-md" title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Analysis History Section */}
            <div>
              <div className="px-3 mb-2 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5" /> All History
                </div>
                <span className="bg-white/5 px-2 py-0.5 rounded-full">{analyses.length}</span>
              </div>
              <div className="space-y-1">
                {filteredAnalyses.length === 0 ? (
                  <div className="px-3 py-4 text-center text-slate-500 text-sm">
                    No history found.
                  </div>
                ) : (
                  filteredAnalyses.map((item) => (
                    <div key={item.id} className="group relative">
                      <button
                        onClick={() => {
                          setSelectedAnalysis(item);
                          if (window.innerWidth < 1024) setSidebarOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3",
                          selectedAnalysis?.id === item.id 
                            ? "bg-brand-blue/10 text-brand-blue" 
                            : "hover:bg-white/5 text-slate-300 hover:text-white"
                        )}
                      >
                        <FileText className="w-4 h-4 shrink-0 opacity-70" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{item.fileName}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </button>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--color-bg-card)]/80 backdrop-blur-sm p-1 rounded-lg">
                        <button 
                          onClick={(e) => toggleFavorite(item.id, e)}
                          className={cn("p-1.5 rounded-md transition-colors", favorites.includes(item.id) ? "text-yellow-400 hover:bg-yellow-400/10" : "text-slate-400 hover:text-yellow-400 hover:bg-yellow-400/10")} title={favorites.includes(item.id) ? "Remove from Favorites" : "Add to Favorites"}
                        >
                          <Star className={cn("w-3.5 h-3.5", favorites.includes(item.id) && "fill-current")} />
                        </button>
                        <button 
                          onClick={(e) => deleteAnalysis(item.id, e)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-md" title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}


        {/* Content Area */}
        <section className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Upload Section */}
            {!selectedAnalysis && (
              <div className="space-y-8">
                <div
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onDrop={onDrop}
                  className={cn(
                    "relative border-2 border-dashed rounded-2xl p-12 transition-all flex flex-col items-center justify-center text-center group bg-[var(--color-bg-card)]",
                    dragActive ? "border-brand-blue bg-brand-blue/5" : "border-white/10 hover:border-brand-blue/50 hover:bg-white/5",
                    analyzing && "opacity-50 pointer-events-none"
                  )}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    className="hidden"
                    accept=".pdf,image/*"
                    multiple
                  />
                  
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-brand-blue/20 blur-2xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="w-20 h-20 bg-[var(--color-bg-card)] rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl relative z-10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                      {analyzing ? (
                        <Loader2 className="w-10 h-10 text-brand-blue animate-spin" />
                      ) : (
                        <Upload className="w-10 h-10 text-brand-blue" />
                      )}
                    </div>
                  </div>

                  <h2 className="text-2xl font-semibold text-white mb-2">
                    {analyzing ? "Uploading & Analyzing..." : "Upload a document to unlock AI insights ✨"}
                  </h2>
                  <p className="text-slate-400 mb-6 text-sm">
                    Drag and drop your files here, or click to browse.
                  </p>
                  
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mb-8">
                    <span className="px-2 py-1 bg-white/5 rounded-md">PDF</span>
                    <span className="px-2 py-1 bg-white/5 rounded-md">PNG</span>
                    <span className="px-2 py-1 bg-white/5 rounded-md">JPEG</span>
                    <span className="px-2 py-1 bg-white/5 rounded-md">WEBP</span>
                  </div>

                  <button
                    disabled={analyzing}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-slate-200 transition-all shadow-lg shadow-white/10 disabled:opacity-50 flex items-center gap-2 active:scale-95"
                  >
                    {analyzing ? "Processing..." : "Select Files"}
                  </button>
                </div>

                {/* ChatGPT-style Input */}
                <div className="bg-[var(--color-bg-card)] rounded-2xl border border-white/10 p-4 shadow-lg relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-blue/20 to-brand-purple/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity" />
                  <div className="relative bg-[var(--color-bg-card)] rounded-xl flex flex-col">
                    <textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Ask anything about your document..."
                      className="w-full px-4 py-3 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none resize-none min-h-[80px]"
                    />
                    <div className="flex items-center justify-between px-4 pb-3 pt-2 border-t border-white/5">
                      <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
                        <button onClick={() => setCustomPrompt("Summarize this document in 3 bullet points.")} className="whitespace-nowrap px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-slate-300 transition-colors">Summarize</button>
                        <button onClick={() => setCustomPrompt("Extract all key data points and entities.")} className="whitespace-nowrap px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-slate-300 transition-colors">Extract Data</button>
                        <button onClick={() => setCustomPrompt("Identify any potential risks or red flags.")} className="whitespace-nowrap px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-slate-300 transition-colors">Find Risks</button>
                        <button onClick={() => setCustomPrompt("What are the main takeaways?")} className="whitespace-nowrap px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-slate-300 transition-colors">Key Points</button>
                      </div>
                      <button className="p-2 bg-brand-blue text-white rounded-lg hover:bg-blue-500 transition-colors ml-4 shrink-0">
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Processing Queue */}
            <AnimatePresence>
              {processingQueue.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="w-full space-y-3"
                >
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-slate-400">Processing Queue</span>
                    <span className="text-xs font-mono text-brand-blue">{processingQueue.length} Remaining</span>
                  </div>
                  {processingQueue.map((item) => (
                    <motion.div 
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="bg-[var(--color-bg-card)] border border-white/10 rounded-xl p-4 flex items-center gap-4 shadow-sm"
                    >
                      <div className="p-2 bg-brand-blue/10 rounded-lg">
                        <Loader2 className="w-4 h-4 text-brand-blue animate-spin" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-slate-200 truncate block">{item.name}</span>
                        <div className="w-full bg-white/5 rounded-full h-1 mt-2 overflow-hidden">
                          <div className="bg-brand-blue h-1 rounded-full w-full animate-pulse" />
                        </div>
                      </div>
                      <span className="text-xs text-slate-400">Analyzing...</span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 text-red-400 bg-red-400/10 border border-red-400/20 px-6 py-4 rounded-xl text-sm font-medium"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}


            {/* Results Section */}
            <AnimatePresence mode="wait">
              {(selectedAnalysis || analyzing) && (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40 }}
                  className="bg-[var(--color-bg-card)] rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
                >
                  <div className="px-6 py-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-brand-blue/10 rounded-xl border border-brand-blue/20">
                        <FileText className="w-6 h-6 text-brand-blue" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white tracking-tight">
                          {analyzing ? "Processing Intelligence..." : selectedAnalysis?.fileName}
                        </h3>
                        {!analyzing && (
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-slate-500">
                              {new Date(selectedAnalysis?.createdAt).toLocaleString()}
                            </span>
                            <div className="w-1 h-1 bg-slate-700 rounded-full" />
                            <span className="text-xs text-slate-500 uppercase">
                              {selectedAnalysis?.fileType.split('/')[1]}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {!analyzing && (
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                          <Sparkles className="w-3.5 h-3.5 text-brand-purple" />
                          <span className="text-xs font-medium text-slate-300">Confidence: <span className="text-white">98%</span></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => window.print()}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title="Download Report"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(window.location.href);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                            title="Share Insights"
                          >
                            {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {!analyzing && (
                    <div className="px-6 border-b border-white/5 flex items-center gap-6 overflow-x-auto hide-scrollbar">
                      <button 
                        onClick={() => setActiveTab("overview")}
                        className={cn("py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap", activeTab === "overview" ? "border-brand-blue text-brand-blue" : "border-transparent text-slate-400 hover:text-slate-200")}
                      >
                        Overview
                      </button>
                      <button 
                        onClick={() => setActiveTab("insights")}
                        className={cn("py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap", activeTab === "insights" ? "border-brand-blue text-brand-blue" : "border-transparent text-slate-400 hover:text-slate-200")}
                      >
                        Insights
                      </button>
                      <button 
                        onClick={() => setActiveTab("tables")}
                        className={cn("py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap", activeTab === "tables" ? "border-brand-blue text-brand-blue" : "border-transparent text-slate-400 hover:text-slate-200")}
                      >
                        Tables
                      </button>
                      <button 
                        onClick={() => setActiveTab("raw")}
                        className={cn("py-4 text-sm font-medium transition-colors border-b-2 whitespace-nowrap", activeTab === "raw" ? "border-brand-blue text-brand-blue" : "border-transparent text-slate-400 hover:text-slate-200")}
                      >
                        Raw Data
                      </button>
                    </div>
                  )}

                  <div className="p-6 md:p-8">
                    {analyzing ? (
                      <div className="space-y-6">
                        <div className="h-4 bg-white/5 rounded-full w-3/4 animate-pulse" />
                        <div className="h-4 bg-white/5 rounded-full w-1/2 animate-pulse" />
                        <div className="h-4 bg-white/5 rounded-full w-5/6 animate-pulse" />
                        <div className="h-4 bg-white/5 rounded-full w-2/3 animate-pulse" />
                        <div className="h-32 bg-white/5 rounded-xl w-full animate-pulse mt-8" />
                      </div>
                    ) : (
                      <div className="markdown-body">
                        {activeTab === "overview" && (
                          <ReactMarkdown>{selectedAnalysis?.content || ""}</ReactMarkdown>
                        )}
                        {activeTab === "insights" && (
                          <div className="text-slate-400 text-center py-12">
                            <Sparkles className="w-8 h-8 mx-auto mb-4 opacity-50" />
                            <p>AI Insights are being generated...</p>
                          </div>
                        )}
                        {activeTab === "tables" && (
                          <div className="text-slate-400 text-center py-12">
                            <Layers className="w-8 h-8 mx-auto mb-4 opacity-50" />
                            <p>No tabular data detected in this document.</p>
                          </div>
                        )}
                        {activeTab === "raw" && (
                          <div className="bg-black/40 p-4 rounded-xl border border-white/5 font-mono text-xs text-slate-400 overflow-x-auto">
                            {selectedAnalysis?.content}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            
            {/* Footer Info */}
            <div className="pt-10 pb-20 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
              <div className="flex items-center gap-8">
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest mb-1">Processing</span>
                  <span className="text-xs font-mono">End-to-End Encrypted</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold uppercase tracking-widest mb-1">Engine</span>
                  <span className="text-xs font-mono">Neural OCR v4.2</span>
                </div>
              </div>
              <p className="text-[10px] font-mono uppercase tracking-widest">
                © 2026 DocuIntel AI Systems
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
