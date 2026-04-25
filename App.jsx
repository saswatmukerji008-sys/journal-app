import { useState, useEffect, useRef } from "react";

// ─── Storage ──────────────────────────────────────────────────────────────────
const SK = "aijp_v3";

function load() {
  try {
    const data = localStorage.getItem(SK);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Load error:", e);
    return null;
  }
}

function save(s) {
  try {
    localStorage.setItem(SK, JSON.stringify(s));
    return true;
  } catch (e) {
    console.error("Save error:", e);
    return false;
  }
}

const defaultState = { journals: {}, tasks: {}, moods: {}, onboarded: false, lastReportDate: "" };

// ─── Date helpers ─────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const dateLabel = (str) => new Date(str + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const fullDateLabel = (str) => new Date(str + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
function getNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().slice(0, 10);
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ["📅 Today", "📓 Journal", "✅ Tasks", "😊 Mood", "📊 Progress", "🗓️ 21-Day Log", "🤖 AI Insights"];
const PRIORITIES = [
  { value: "high", label: "🔴 High", color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  { value: "medium", label: "🟡 Medium", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  { value: "low", label: "🟢 Low", color: "#4ade80", bg: "rgba(74,222,128,0.15)" },
];
const CATEGORIES = ["Work", "Personal", "Health", "Learning", "Finance", "Other"];
const MOODS = [
  { score: 1, emoji: "😞", label: "Rough" },
  { score: 2, emoji: "😕", label: "Meh" },
  { score: 3, emoji: "😐", label: "Okay" },
  { score: 4, emoji: "😊", label: "Good" },
  { score: 5, emoji: "🤩", label: "Great" },
];
const STATUS_OPTIONS = [
  { value: "done", label: "✅ Completed", color: "#4ade80", bg: "rgba(74,222,128,0.15)" },
  { value: "partial", label: "⏳ Partial", color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  { value: "missed", label: "❌ Missed", color: "#ef4444", bg: "rgba(239,68,68,0.15)" },
  { value: "deferred", label: "📅 Deferred", color: "#60a5fa", bg: "rgba(96,165,250,0.15)" },
];

// ─── AI call ──────────────────────────────────────────────────────────────────
async function callAI(prompt, maxTokens = 1000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] })
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ─── PDF Export (jsPDF) ───────────────────────────────────────────────────────
async function generatePDFReport(state) {
  // Load jsPDF from CDN
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  script.onload = () => {
    const days = getNDays(7);
    const totalTasks7 = days.reduce((a, d) => a + (state.tasks[d]?.length || 0), 0);
    const doneTasks7 = days.reduce((a, d) => a + (state.tasks[d]?.filter(t => t.done).length || 0), 0);
    const journalDays7 = days.filter(d => state.journals[d]?.trim()).length;
    const moods = days.map(d => state.moods[d]).filter(Boolean);
    const avgMood = moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : "—";

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h1 style="color: #7c3aed; text-align: center; border-bottom: 3px solid #7c3aed; padding-bottom: 10px;">
          📊 My Weekly Progress Report
        </h1>
        <p style="text-align: center; color: #666; font-size: 12px; margin-top: 5px;">
          Generated on ${new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>

        <h2 style="color: #2563eb; margin-top: 20px; border-left: 4px solid #2563eb; padding-left: 10px;">📈 7-Day Summary</h2>
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <tr style="background: #f3f4f6;">
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Total Tasks</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Completed</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Completion %</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Journal Days</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;"><strong>Avg Mood</strong></td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;"><strong>${totalTasks7}</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center; color: #4ade80;"><strong>${doneTasks7}</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;"><strong>${totalTasks7 ? Math.round((doneTasks7 / totalTasks7) * 100) : 0}%</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;"><strong>${journalDays7}/7</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd; text-align: center;"><strong>${avgMood}/5</strong></td>
          </tr>
        </table>

        <h2 style="color: #2563eb; margin-top: 20px; border-left: 4px solid #2563eb; padding-left: 10px;">📅 Daily Breakdown</h2>
        ${days.map(d => {
          const tasks = state.tasks[d] || [];
          const done = tasks.filter(t => t.done).length;
          const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
          const mood = MOODS.find(m => m.score === state.moods[d]);
          const journal = state.journals[d];
          return `
            <div style="margin: 12px 0; padding: 12px; background: #f9fafb; border-left: 4px solid ${pct >= 80 ? "#4ade80" : pct >= 50 ? "#f59e0b" : "#ef4444"}; border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <strong style="color: #111;">${dateLabel(d)} (${fullDateLabel(d).split(" ").slice(0, 1)[0]})</strong>
                <span style="color: #666; font-size: 12px;">${done}/${tasks.length} tasks | ${mood ? mood.emoji : "—"} ${mood ? mood.label : ""}</span>
              </div>
              <div style="width: 100%; background: #e5e7eb; height: 8px; border-radius: 4px; margin-bottom: 6px; overflow: hidden;">
                <div style="width: ${pct}%; height: 100%; background: ${pct >= 80 ? "#4ade80" : pct >= 50 ? "#f59e0b" : "#ef4444"};"></div>
              </div>
              ${journal ? `<div style="color: #555; font-size: 13px; font-style: italic; margin-bottom: 6px;">"${journal.slice(0, 150)}${journal.length > 150 ? "..." : ""}"</div>` : ""}
              ${tasks.length > 0 ? `<div style="font-size: 12px; color: #666;">Tasks: ${tasks.map(t => `${t.done ? "✓" : "○"} ${t.title}`).join(", ")}</div>` : ""}
            </div>
          `;
        }).join("")}

        <h2 style="color: #2563eb; margin-top: 20px; border-left: 4px solid #2563eb; padding-left: 10px;">🏆 Highlights</h2>
        <ul style="color: #555; line-height: 1.8;">
          <li>✅ Completed <strong>${doneTasks7}</strong> tasks this week</li>
          <li>📝 Journaled <strong>${journalDays7}</strong> out of 7 days</li>
          <li>😊 Average mood: <strong>${avgMood}/5.0</strong> ${avgMood >= 4 ? "🌟" : avgMood >= 3 ? "👍" : "💪"}</li>
          <li>📈 Task completion rate: <strong>${totalTasks7 ? Math.round((doneTasks7 / totalTasks7) * 100) : 0}%</strong></li>
        </ul>

        <div style="margin-top: 30px; padding: 15px; background: #eff6ff; border-left: 4px solid #0284c7; border-radius: 4px;">
          <p style="color: #0c4a6e; font-size: 13px; margin: 0;">
            <strong>💡 Keep up the momentum!</strong> Review this report weekly to spot trends and adjust your priorities. Small consistent progress compounds into big wins. 🚀
          </p>
        </div>
      </div>
    `;

    const element = document.createElement("div");
    element.innerHTML = html;

    const opt = {
      margin: 10,
      filename: `Weekly-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
    };

    window.html2pdf().set(opt).from(element).save();
  };
  document.head.appendChild(script);
}

// ─── OneLiner component ───────────────────────────────────────────────────────
function OneLiner({ text, tasks }) {
  const [summary, setSummary] = useState(""); const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!text?.trim()) return;
    setLoading(true);
    const done = tasks.filter(t => t.done).map(t => t.title).join(", ");
    callAI(`Summarize this journal entry in ONE sentence (max 12 words), capturing key mood/highlight. Journal: "${text.slice(0, 300)}" ${done ? `Completed: ${done}` : ""}. Just the one-liner, no quotes.`, 60)
      .then(setSummary).catch(() => setSummary("Journal entry logged.")).finally(() => setLoading(false));
  }, []);
  if (loading) return <div style={{ fontSize: 12, color: "#7c3aed" }}>✨ Summarizing...</div>;
  if (!summary) return null;
  return <div style={{ fontSize: 13, color: "#c4b5fd", fontStyle: "italic" }}>✨ {summary}</div>;
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [state, setState] = useState(() => {
    const loaded = { ...defaultState };
    return loaded;
  });
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState(0);
  const [showWelcome, setShowWelcome] = useState(true);
  const [welcomeName, setWelcomeName] = useState("");
  const [welcomeDOB, setWelcomeDOB] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [journalText, setJournalText] = useState("");
  const [taskInput, setTaskInput] = useState({ title: "", time: "", date: todayStr(), priority: "medium", category: "Work" });
  const [taskFilter, setTaskFilter] = useState({ priority: "all", category: "all", status: "all" });
  const [searchQ, setSearchQ] = useState("");
  const [aiResult, setAiResult] = useState(""); const [aiLoading, setAiLoading] = useState(false);
  const [statusModal, setStatusModal] = useState(null);
  const [statusForm, setStatusForm] = useState({ status: "done", note: "" });
  const [notif, setNotif] = useState(null);
  const [exportMsg, setExportMsg] = useState("");
  const [showOnboarding, setShowOnboarding] = useState(!state.onboarded);
  const [onboardStep, setOnboardStep] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const notifTimers = useRef({});
  const audioRef = useRef(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const data = load();
    if (data) {
      setState(s => ({ ...s, ...data }));
      if (data.userName) setShowWelcome(false);
    }
    setLoaded(true);
  }, []);

  useEffect(() => { 
    if (loaded) {
      save(state);
    }
  }, [state, loaded]);

  useEffect(() => {
    const j = state.journals[todayStr()] || "";
    setJournalText(j);
  }, [tab]);

  // Reminder checker with sound
  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      const ns = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
      (state.tasks[todayStr()] || []).forEach(t => {
        if (t.time === ns && !t.done && !notifTimers.current[t.id]) {
          notifTimers.current[t.id] = true;
          playNotifSound();
          showNotif(`⏰ REMINDER: "${t.title}" is now!`, 8000);
        }
      });
    }, 30000);
    return () => clearInterval(iv);
  }, [state.tasks]);

  function playNotifSound() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.setValueAtTime(600, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.setValueAtTime(0, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  function showNotif(msg, dur = 3000) { setNotif(msg); setTimeout(() => setNotif(null), dur); }

  function upd(fn) { setState(s => { const ns = fn(s); save(ns); return ns; }); }

  function submitWelcome() {
    if (!welcomeName.trim() || !welcomeDOB) { 
      alert("❌ Please fill in all fields");
      return; 
    }
    const newState = { ...state, userName: welcomeName.trim(), userDOB: welcomeDOB };
    setState(newState);
    save(newState);
    setShowWelcome(false);
  }

  function saveJournal() {
    upd(s => ({ ...s, journals: { ...s.journals, [todayStr()]: journalText } }));
    showNotif("✅ Journal saved!");
  }

  function addTask() {
    if (!taskInput.title.trim() || !taskInput.date) return;
    const task = { id: Date.now(), title: taskInput.title.trim(), time: taskInput.time, priority: taskInput.priority, category: taskInput.category, done: false, status: null, note: "", carried: false };
    upd(s => ({ ...s, tasks: { ...s.tasks, [taskInput.date]: [...(s.tasks[taskInput.date] || []), task] } }));
    setTaskInput(p => ({ ...p, title: "", time: "" }));
    showNotif("✅ Task added!");
  }

  function toggleTask(date, id) {
    upd(s => ({ ...s, tasks: { ...s.tasks, [date]: (s.tasks[date] || []).map(t => t.id === id ? { ...t, done: !t.done, status: !t.done ? "done" : null } : t) } }));
  }

  function deleteTask(date, id) {
    upd(s => ({ ...s, tasks: { ...s.tasks, [date]: (s.tasks[date] || []).filter(t => t.id !== id) } }));
  }

  function updateStatus(date, id, status, note) {
    upd(s => ({ ...s, tasks: { ...s.tasks, [date]: (s.tasks[date] || []).map(t => t.id === id ? { ...t, status, note, done: status === "done" } : t) } }));
  }

  function logMood(date, score) {
    upd(s => ({ ...s, moods: { ...s.moods, [date]: score } }));
    showNotif("😊 Mood logged!");
  }

  // ─── SMART CARRY-FORWARD (cascades multi-day) ───────────────────────────────
  function carryForward() {
    const today = todayStr();
    const days21 = getNDays(21);
    const carried = [];

    // Look back up to 14 days for deferred/missed tasks
    for (let i = 1; i <= 14; i++) {
      const dayIndex = i;
      if (dayIndex >= days21.length) break;
      const pastDay = days21[dayIndex];
      const pastTasks = (state.tasks[pastDay] || []).filter(t => (t.status === "deferred" || t.status === "missed") && !t.carried);
      
      pastTasks.forEach(t => {
        const newTask = { ...t, id: Date.now() + Math.random(), status: null, done: false, carried: true, note: `↩️ Carried from ${dateLabel(pastDay)}` };
        carried.push(newTask);
      });
    }

    if (!carried.length) { showNotif("✅ Nothing to carry forward!"); return; }

    upd(s => ({ ...s, tasks: { ...s.tasks, [today]: [...(s.tasks[today] || []), ...carried] } }));
    showNotif(`✅ ${carried.length} task(s) carried to today! 🔄`);
  }

  // ─── PDF EXPORT ──────────────────────────────────────────────────────────────
  function exportPDF() {
    setPdfLoading(true);
    setTimeout(() => {
      generatePDFReport(state);
      showNotif("📊 PDF generated and downloading...");
      setPdfLoading(false);
    }, 500);
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ journals: state.journals, tasks: state.tasks, moods: state.moods }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "journal_export.json"; a.click();
    setExportMsg("✅ Exported!"); setTimeout(() => setExportMsg(""), 2500);
  }

  async function generateWeeklyReport() {
    setAiLoading(true); setAiResult(""); setTab(6);
    const days = getNDays(7);
    let ctx = "You are a productivity coach. Analyze this user's last 7 days. Give:\n1. Week Summary (2-3 sentences)\n2. Mood trend\n3. Task completion analysis\n4. Top 3 wins\n5. Top 3 actionable improvement suggestions\n\n--- DATA ---\n";
    days.forEach(d => {
      const j = state.journals[d] || "(no entry)"; const tasks = state.tasks[d] || [];
      const done = tasks.filter(t => t.done).length; const mood = state.moods[d] ? MOODS.find(m => m.score === state.moods[d])?.label : "not logged";
      ctx += `\nDate: ${fullDateLabel(d)}\nMood: ${mood}\nJournal: ${j.slice(0, 200)}\nTasks: ${tasks.length} total, ${done} done\n`;
    });
    const result = await callAI(ctx).catch(() => "Could not generate report.");
    setAiResult(result); setAiLoading(false);
  }

  // ─── Derived stats ─────────────────────────────────────────────────────────
  const today = todayStr();
  const days7 = getNDays(7); const days21 = getNDays(21);
  const todayTasks = state.tasks[today] || [];
  const tomorrowTasks = state.tasks[tomorrowStr()] || [];
  const totalTasks7 = days7.reduce((a, d) => a + (state.tasks[d]?.length || 0), 0);
  const doneTasks7 = days7.reduce((a, d) => a + (state.tasks[d]?.filter(t => t.done).length || 0), 0);
  const journalDays7 = days7.filter(d => state.journals[d]?.trim()).length;
  const avgMood7 = (() => { const ms = days7.map(d => state.moods[d]).filter(Boolean); return ms.length ? (ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1) : "—"; })();
  const streak = (() => { let s = 0; for (const d of days21) { if (state.journals[d]?.trim()) s++; else break; } return s; })();

  // Filtered tasks
  const filteredTasks = (state.tasks[selectedDate] || []).filter(t => {
    if (taskFilter.priority !== "all" && t.priority !== taskFilter.priority) return false;
    if (taskFilter.category !== "all" && t.category !== taskFilter.category) return false;
    if (taskFilter.status === "done" && !t.done) return false;
    if (taskFilter.status === "pending" && t.done) return false;
    return true;
  }).sort((a, b) => { const order = { high: 0, medium: 1, low: 2 }; return (order[a.priority] || 1) - (order[b.priority] || 1); });

  // Search results
  const searchResults = searchQ.trim().length > 1 ? (() => {
    const q = searchQ.toLowerCase(); const results = [];
    days21.forEach(d => {
      if (state.journals[d]?.toLowerCase().includes(q)) results.push({ type: "journal", date: d, text: state.journals[d] });
      (state.tasks[d] || []).filter(t => t.title.toLowerCase().includes(q)).forEach(t => results.push({ type: "task", date: d, task: t }));
    });
    return results;
  })() : [];

  // ─── Styles ────────────────────────────────────────────────────────────────
  const S = {
    app: { minHeight: "100vh", background: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)", fontFamily: "'Segoe UI',sans-serif", color: "#e0e0ff", paddingBottom: 60 },
    header: { background: "rgba(255,255,255,0.05)", backdropFilter: "blur(12px)", padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 },
    title: { fontSize: 20, fontWeight: 800, background: "linear-gradient(90deg,#a78bfa,#60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    tabBar: { display: "flex", gap: 4, overflowX: "auto", padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)", scrollbarWidth: "none" },
    tab: (a) => ({ padding: "7px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", background: a ? "linear-gradient(135deg,#7c3aed,#2563eb)" : "rgba(255,255,255,0.06)", color: a ? "#fff" : "#9ca3af", transition: "all .2s" }),
    page: { maxWidth: 700, margin: "0 auto", padding: "16px 12px" },
    card: { background: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.1)", padding: 18, marginBottom: 14 },
    h2: { fontSize: 16, fontWeight: 700, marginBottom: 14, color: "#c4b5fd" },
    input: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.07)", color: "#e0e0ff", fontSize: 14, outline: "none", boxSizing: "border-box" },
    select: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "#1e1b4b", color: "#e0e0ff", fontSize: 14, outline: "none", boxSizing: "border-box" },
    textarea: { width: "100%", minHeight: 130, padding: "12px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.07)", color: "#e0e0ff", fontSize: 14, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 },
    btn: (c) => ({ padding: "10px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 13, background: c || "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff" }),
    badge: (bg, c) => ({ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color: c || "#fff" }),
    label: { fontSize: 12, color: "#9ca3af", marginBottom: 4, display: "block" },
    stat: { background: "rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 10px", textAlign: "center", flex: 1, minWidth: 70 },
    modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
    modalBox: { background: "#1e1b4b", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 18, padding: 22, width: "100%", maxWidth: 400 },
    notif: { position: "fixed", top: 16, right: 16, background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff", padding: "11px 18px", borderRadius: 12, zIndex: 9999, fontWeight: 700, fontSize: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.5)", maxWidth: 300, animation: "slideIn 0.3s ease" },
    aiBox: { background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 12, padding: 16, whiteSpace: "pre-wrap", lineHeight: 1.8, fontSize: 14, color: "#e0e0ff" },
    row: { display: "flex", gap: 10, flexWrap: "wrap" },
  };

  const priorityOf = (p) => PRIORITIES.find(x => x.value === p) || PRIORITIES[1];
  const statusOf = (v) => STATUS_OPTIONS.find(x => x.value === v);

  // ─── Onboarding ────────────────────────────────────────────────────────────
  const onboardSteps = [
    { icon: "📓", title: "Welcome to Your Journal & Planner!", body: "This is your personal space to journal daily, plan tasks, track mood, and get AI-powered insights — all in one place." },
    { icon: "✅", title: "Plan Your Day", body: "Use the Tasks tab to add to-dos with time, priority, and category. Set reminders and log end-of-day status for each task." },
    { icon: "📊", title: "Track Your Progress", body: "The Progress tab shows your 7-day task completion, mood trends, and charts. The 21-Day Log gives you a full history at a glance." },
    { icon: "🤖", title: "Get AI Insights", body: "Every Monday, a weekly report is auto-generated. You can also trigger it anytime from the AI Insights tab for personalised suggestions." },
  ];

  if (showOnboarding) {
    const step = onboardSteps[onboardStep];
    return (
      <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ ...S.card, maxWidth: 400, margin: "0 16px", textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>{step.icon}</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 12, color: "#c4b5fd" }}>{step.title}</div>
          <div style={{ fontSize: 14, color: "#a0aec0", lineHeight: 1.7, marginBottom: 24 }}>{step.body}</div>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20 }}>
            {onboardSteps.map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i === onboardStep ? "#7c3aed" : "rgba(255,255,255,0.2)" }} />)}
          </div>
          <button style={S.btn()} onClick={() => {
            if (onboardStep < onboardSteps.length - 1) setOnboardStep(o => o + 1);
            else { upd(s => ({ ...s, onboarded: true })); setShowOnboarding(false); }
          }}>{onboardStep < onboardSteps.length - 1 ? "Next →" : "🚀 Get Started"}</button>
        </div>
      </div>
    );
  }

  // ─── Welcome Screen ────────────────────────────────────────────────────────
  if (showWelcome) {
    return (
      <div style={{ ...S.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div style={{ ...S.card, maxWidth: 450, margin: "0 16px", padding: 40 }}>
          <div style={{ fontSize: 64, textAlign: "center", marginBottom: 20 }}>📓✨</div>
          <div style={{ fontSize: 28, fontWeight: 800, textAlign: "center", color: "#c4b5fd", marginBottom: 12 }}>Welcome! 👋</div>
          <div style={{ fontSize: 16, color: "#a0aec0", textAlign: "center", marginBottom: 32, lineHeight: 1.7 }}>Let's get to know you. Fill in your details to get started with your personal journal & planner.</div>
          
          <div style={{ marginBottom: 18 }}>
            <label style={S.label}>📝 What's Your Name? *</label>
            <input 
              style={S.input}
              type="text"
              value={welcomeName}
              onChange={e => setWelcomeName(e.target.value)}
              placeholder="e.g. John, Sarah, Alex..."
              onKeyDown={e => e.key === "Enter" && submitWelcome()}
            />
          </div>

          <div style={{ marginBottom: 28 }}>
            <label style={S.label}>🎂 What's Your Date of Birth? *</label>
            <input 
              style={S.input}
              type="date"
              value={welcomeDOB}
              onChange={e => setWelcomeDOB(e.target.value)}
            />
          </div>

          <button 
            style={{ ...S.btn(), width: "100%", fontSize: 16, padding: "14px 20px", fontWeight: 800 }}
            onClick={submitWelcome}
          >
            🚀 Let's Go!
          </button>

          <div style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginTop: 16 }}>
            Your information is stored securely and privately. ✅
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(400px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      {notif && <div style={S.notif}>{notif}</div>}

      {/* Status Modal */}
      {statusModal && (
        <div style={S.modal} onClick={() => setStatusModal(null)}>
          <div style={S.modalBox} onClick={e => e.stopPropagation()}>
            <div style={S.h2}>📋 Log End-of-Day Status</div>
            <div style={{ fontSize: 13, color: "#c4b5fd", marginBottom: 14, fontWeight: 600 }}>"{statusModal.task.title}"</div>
            <label style={S.label}>How did it go?</label>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 14 }}>
              {STATUS_OPTIONS.map(o => (
                <button key={o.value} onClick={() => setStatusForm(s => ({ ...s, status: o.value }))}
                  style={{ padding: "7px 12px", borderRadius: 8, border: `2px solid ${statusForm.status === o.value ? o.color : "transparent"}`, background: statusForm.status === o.value ? o.bg : "rgba(255,255,255,0.06)", color: "#e0e0ff", cursor: "pointer", fontWeight: 600, fontSize: 12 }}>
                  {o.label}
                </button>
              ))}
            </div>
            <label style={S.label}>Notes (optional)</label>
            <textarea style={{ ...S.textarea, minHeight: 70 }} value={statusForm.note} onChange={e => setStatusForm(s => ({ ...s, note: e.target.value }))} placeholder="e.g. Completed 80%, blocked by review..." />
            <div style={{ ...S.row, marginTop: 12 }}>
              <button style={S.btn()} onClick={() => { updateStatus(statusModal.date, statusModal.task.id, statusForm.status, statusForm.note); setStatusModal(null); showNotif("✅ Status logged!"); }}>💾 Save</button>
              <button style={S.btn("rgba(255,255,255,0.08)")} onClick={() => setStatusModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={S.header}>
        <div style={S.title}>📓 {state.userName ? `${state.userName}'s Journal` : "My Journal & Planner"}</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, color: "#c4b5fd", fontWeight: 700, background: "rgba(124,58,237,0.2)", padding: "6px 12px", borderRadius: 10 }}>
            🕐 {currentTime.toLocaleTimeString("en-IN")}
          </div>
          <div style={{ fontSize: 13, color: "#60a5fa", fontWeight: 700, background: "rgba(96,165,250,0.2)", padding: "6px 12px", borderRadius: 10 }}>
            📅 {currentTime.toLocaleDateString("en-IN", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
          </div>
          {state.userName && <span style={{ fontSize: 12, color: "#9ca3af" }}>🎂 {state.userDOB}</span>}
          <span style={S.badge("linear-gradient(135deg,#f59e0b,#ef4444)")}>🔥 {streak} day streak</span>
          <button style={{ ...S.btn("rgba(255,255,255,0.08)"), padding: "6px 12px", fontSize: 12 }} onClick={exportJSON}>📤 JSON</button>
          <button style={{ ...S.btn("rgba(255,255,255,0.08)"), padding: "6px 12px", fontSize: 12 }} onClick={exportPDF} disabled={pdfLoading}>{pdfLoading ? "⏳..." : "📊 PDF"}</button>
          {exportMsg && <span style={{ fontSize: 12, color: "#4ade80" }}>{exportMsg}</span>}
        </div>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map((t, i) => <button key={i} style={S.tab(tab === i)} onClick={() => setTab(i)}>{t}</button>)}
      </div>

      {/* Search bar */}
      <div style={{ maxWidth: 700, margin: "12px auto 0", padding: "0 12px" }}>
        <input style={S.input} value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="🔍 Search journals & tasks..." />
        {searchResults.length > 0 && (
          <div style={{ ...S.card, marginTop: 8 }}>
            <div style={{ fontSize: 13, color: "#a0aec0", marginBottom: 8 }}>{searchResults.length} result(s)</div>
            {searchResults.slice(0, 8).map((r, i) => (
              <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", marginBottom: 6, fontSize: 13 }}>
                <span style={S.badge(r.type === "journal" ? "rgba(124,58,237,0.3)" : "rgba(37,99,235,0.3)")}>{r.type === "journal" ? "📓" : "✅"}</span>
                <span style={{ marginLeft: 8, color: "#9ca3af" }}>{dateLabel(r.date)}</span>
                <div style={{ color: "#e0e0ff", marginTop: 4 }}>{r.type === "journal" ? r.text.slice(0, 80) + "..." : r.task.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.page}>

        {/* ── TODAY ── */}
        {tab === 0 && (
          <>
            <div style={S.card}>
              <div style={S.h2}>🌟 {currentTime.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</div>
              <div style={{ ...S.row, marginBottom: 0 }}>
                <div style={S.stat}><div style={{ fontSize: 24, fontWeight: 800, color: "#a78bfa" }}>{todayTasks.filter(t => t.done).length}/{todayTasks.length}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>Today's Tasks</div></div>
                <div style={S.stat}><div style={{ fontSize: 24, fontWeight: 800, color: "#60a5fa" }}>{totalTasks7 ? Math.round((doneTasks7/totalTasks7)*100) : 0}%</div><div style={{ fontSize: 11, color: "#9ca3af" }}>Weekly Rate</div></div>
                <div style={S.stat}><div style={{ fontSize: 24, fontWeight: 800, color: "#4ade80" }}>{journalDays7}/7</div><div style={{ fontSize: 11, color: "#9ca3af" }}>Journal Days</div></div>
                <div style={S.stat}><div style={{ fontSize: 24, fontWeight: 800, color: "#f472b6" }}>{avgMood7}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>Avg Mood</div></div>
                <div style={S.stat}><div style={{ fontSize: 24, fontWeight: 800, color: "#fb923c" }}>{streak}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>🔥 Streak</div></div>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={S.h2} >Today's Tasks</div>
                <button style={{ ...S.btn("rgba(96,165,250,0.2)"), padding: "6px 12px", fontSize: 12 }} onClick={carryForward}>📥 Carry Forward</button>
              </div>
              {todayTasks.length === 0 && <div style={{ color: "#9ca3af", fontSize: 14 }}>No tasks yet. Add from the Tasks tab.</div>}
              {[...todayTasks].sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority])).map(t => {
                const p = priorityOf(t.priority); const st = statusOf(t.status);
                return (
                  <div key={t.id} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px", marginBottom: 8, borderLeft: `3px solid ${p.color}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={t.done} onChange={() => toggleTask(today, t.id)} style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
                      <span style={{ flex: 1, textDecoration: t.done ? "line-through" : "none", color: t.done ? "#6b7280" : "#e0e0ff", fontSize: 14 }}>{t.title}</span>
                      {t.time && <span style={S.badge("rgba(124,58,237,0.4)")}>⏰ {t.time}</span>}
                      {st && <span style={S.badge(st.bg, st.color)}>{st.label}</span>}
                    </div>
                    {t.note && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, marginLeft: 24 }}>📝 {t.note}</div>}
                  </div>
                );
              })}
            </div>

            {tomorrowTasks.length > 0 && (
              <div style={S.card}>
                <div style={S.h2}>📅 Tomorrow's Plan</div>
                {tomorrowTasks.map(t => <div key={t.id} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, alignItems: "center" }}><span style={S.badge(priorityOf(t.priority).bg, priorityOf(t.priority).color)}>●</span>{t.title}{t.time && <span style={{ color: "#9ca3af" }}>⏰ {t.time}</span>}</div>)}
              </div>
            )}
          </>
        )}

        {/* ── JOURNAL ── */}
        {tab === 1 && (
          <>
            <div style={S.card}>
              <div style={S.h2}>✍️ Today's Journal — {currentTime.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</div>
              <textarea style={S.textarea} value={journalText} onChange={e => setJournalText(e.target.value)} placeholder="How was your day? What did you achieve? What are you grateful for?" />
              <button style={{ ...S.btn(), marginTop: 10 }} onClick={saveJournal}>💾 Save Entry</button>
            </div>
            <div style={S.card}>
              <div style={S.h2}>📖 Browse Past Entries</div>
              <select style={{ ...S.select, marginBottom: 12 }} value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>
                {days21.map(d => <option key={d} value={d}>{dateLabel(d)}{state.journals[d] ? " ✍️" : ""}</option>)}
              </select>
              <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 14, minHeight: 80, fontSize: 14, lineHeight: 1.7, color: state.journals[selectedDate] ? "#e0e0ff" : "#6b7280" }}>
                {state.journals[selectedDate] || "No entry for this day."}
              </div>
            </div>
          </>
        )}

        {/* ── TASKS ── */}
        {tab === 2 && (
          <>
            <div style={S.card}>
              <div style={S.h2}>➕ Add New Task</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div><label style={S.label}>Task Title *</label><input style={S.input} value={taskInput.title} onChange={e => setTaskInput(s => ({ ...s, title: e.target.value }))} placeholder="e.g. Review project proposal" onKeyDown={e => e.key === "Enter" && addTask()} /></div>
                <div style={S.row}>
                  <div style={{ flex: 1 }}><label style={S.label}>Date *</label><input type="date" style={S.input} value={taskInput.date} onChange={e => setTaskInput(s => ({ ...s, date: e.target.value }))} /></div>
                  <div style={{ flex: 1 }}><label style={S.label}>Reminder Time</label><input type="time" style={S.input} value={taskInput.time} onChange={e => setTaskInput(s => ({ ...s, time: e.target.value }))} /></div>
                </div>
                <div style={S.row}>
                  <div style={{ flex: 1 }}>
                    <label style={S.label}>Priority</label>
                    <div style={{ display: "flex", gap: 6 }}>
                      {PRIORITIES.map(p => <button key={p.value} onClick={() => setTaskInput(s => ({ ...s, priority: p.value }))} style={{ flex: 1, padding: "7px 4px", borderRadius: 8, border: `2px solid ${taskInput.priority === p.value ? p.color : "transparent"}`, background: taskInput.priority === p.value ? p.bg : "rgba(255,255,255,0.05)", color: "#e0e0ff", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>{p.label}</button>)}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}><label style={S.label}>Category</label><select style={S.select} value={taskInput.category} onChange={e => setTaskInput(s => ({ ...s, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                </div>
                <button style={S.btn()} onClick={addTask}>➕ Add Task</button>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={S.h2}>📋 Tasks for {currentTime.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</div>
                <button style={{ ...S.btn("rgba(96,165,250,0.2)"), padding: "6px 12px", fontSize: 12 }} onClick={carryForward}>📥 Carry Forward</button>
              </div>
              <div style={S.row}>
                <select style={{ ...S.select, flex: 1 }} value={selectedDate} onChange={e => setSelectedDate(e.target.value)}>{days21.map(d => <option key={d} value={d}>{dateLabel(d)}{(state.tasks[d]?.length) ? ` (${state.tasks[d].length})` : ""}</option>)}</select>
              </div>
              <div style={{ ...S.row, marginTop: 10, marginBottom: 14 }}>
                <select style={{ ...S.select, flex: 1, fontSize: 12, padding: "7px 10px" }} value={taskFilter.priority} onChange={e => setTaskFilter(s => ({ ...s, priority: e.target.value }))}><option value="all">All Priorities</option>{PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
                <select style={{ ...S.select, flex: 1, fontSize: 12, padding: "7px 10px" }} value={taskFilter.category} onChange={e => setTaskFilter(s => ({ ...s, category: e.target.value }))}><option value="all">All Categories</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                <select style={{ ...S.select, flex: 1, fontSize: 12, padding: "7px 10px" }} value={taskFilter.status} onChange={e => setTaskFilter(s => ({ ...s, status: e.target.value }))}><option value="all">All</option><option value="done">Done</option><option value="pending">Pending</option></select>
              </div>
              {filteredTasks.length === 0 && <div style={{ color: "#9ca3af", fontSize: 14 }}>No tasks found.</div>}
              {filteredTasks.map(t => {
                const p = priorityOf(t.priority); const st = statusOf(t.status);
                return (
                  <div key={t.id} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px", marginBottom: 8, borderLeft: `3px solid ${p.color}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <input type="checkbox" checked={t.done} onChange={() => toggleTask(selectedDate, t.id)} style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
                      <span style={{ flex: 1, textDecoration: t.done ? "line-through" : "none", color: t.done ? "#6b7280" : "#e0e0ff", fontSize: 14, minWidth: 80 }}>{t.title}</span>
                      <span style={S.badge(p.bg, p.color)}>{p.label}</span>
                      <span style={S.badge("rgba(255,255,255,0.08)")}>{t.category}</span>
                      {t.time && <span style={S.badge("rgba(124,58,237,0.4)")}>⏰ {t.time}</span>}
                      {st && <span style={S.badge(st.bg, st.color)}>{st.label}</span>}
                      {t.carried && <span style={{ fontSize: 10, color: "#a0aec0" }}>↩️ carried</span>}
                      <button onClick={() => { setStatusForm({ status: t.status || "done", note: t.note || "" }); setStatusModal({ date: selectedDate, task: t }); }} style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 6, color: "#c4b5fd", cursor: "pointer", padding: "3px 8px", fontSize: 11, fontWeight: 700 }}>📋 Log</button>
                      <button onClick={() => deleteTask(selectedDate, t.id)} style={{ background: "rgba(239,68,68,0.15)", border: "none", borderRadius: 6, color: "#f87171", cursor: "pointer", padding: "3px 7px", fontSize: 11 }}>🗑️</button>
                    </div>
                    {t.note && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, marginLeft: 24, fontStyle: "italic" }}>📝 {t.note}</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── MOOD ── */}
        {tab === 3 && (
          <>
            <div style={S.card}>
              <div style={S.h2}>😊 How are you feeling today?</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {MOODS.map(m => (
                  <button key={m.score} onClick={() => logMood(today, m.score)}
                    style={{ padding: "14px 16px", borderRadius: 14, border: `2px solid ${state.moods[today] === m.score ? "#a78bfa" : "transparent"}`, background: state.moods[today] === m.score ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.06)", cursor: "pointer", textAlign: "center", transition: "all .2s" }}>
                    <div style={{ fontSize: 28 }}>{m.emoji}</div>
                    <div style={{ fontSize: 12, color: "#a0aec0", marginTop: 4 }}>{m.label}</div>
                  </button>
                ))}
              </div>
              {state.moods[today] && <div style={{ textAlign: "center", marginTop: 14, color: "#c4b5fd", fontWeight: 700 }}>Today: {MOODS.find(m => m.score === state.moods[today])?.emoji} {MOODS.find(m => m.score === state.moods[today])?.label}</div>}
            </div>
            <div style={S.card}>
              <div style={S.h2}>📈 7-Day Mood History</div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80, marginBottom: 8 }}>
                {days7.reverse().map(d => {
                  const m = state.moods[d]; const h = m ? (m / 5) * 64 : 4;
                  return (
                    <div key={d} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: "100%", height: h, background: m ? `hsl(${m * 30 + 60},70%,60%)` : "rgba(255,255,255,0.1)", borderRadius: 4, transition: "height .3s" }} title={m ? MOODS.find(x => x.score === m)?.label : "Not logged"} />
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>{dateLabel(d).slice(0, 3)}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center" }}>Average: {avgMood7} / 5.0 {avgMood7 >= 4 ? "🌟" : avgMood7 >= 3 ? "👍" : "💪"}</div>
            </div>
            <div style={S.card}>
              <div style={S.h2}>📅 21-Day Mood Log</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {days21.map(d => {
                  const m = state.moods[d]; const mood = MOODS.find(x => x.score === m);
                  return (
                    <div key={d} style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)", fontSize: 12, textAlign: "center", minWidth: 56 }}>
                      <div style={{ fontSize: 18 }}>{mood?.emoji || "⬜"}</div>
                      <div style={{ color: "#9ca3af", marginTop: 2 }}>{dateLabel(d).slice(0, 6)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── PROGRESS ── */}
        {tab === 4 && (
          <>
            <div style={S.card}>
              <div style={S.h2}>📊 7-Day Summary</div>
              <div style={{ ...S.row, marginBottom: 16 }}>
                <div style={S.stat}><div style={{ fontSize: 22, fontWeight: 800, color: "#a78bfa" }}>{totalTasks7 ? Math.round((doneTasks7/totalTasks7)*100) : 0}%</div><div style={{ fontSize: 11, color: "#9ca3af" }}>Completion</div></div>
                <div style={S.stat}><div style={{ fontSize: 22, fontWeight: 800, color: "#60a5fa" }}>{journalDays7}/7</div><div style={{ fontSize: 11, color: "#9ca3af" }}>Journal Days</div></div>
                <div style={S.stat}><div style={{ fontSize: 22, fontWeight: 800, color: "#4ade80" }}>{doneTasks7}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>Done</div></div>
                <div style={S.stat}><div style={{ fontSize: 22, fontWeight: 800, color: "#f472b6" }}>{totalTasks7 - doneTasks7}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>Pending</div></div>
                <div style={S.stat}><div style={{ fontSize: 22, fontWeight: 800, color: "#fb923c" }}>{avgMood7}/5</div><div style={{ fontSize: 11, color: "#9ca3af" }}>Avg Mood</div></div>
              </div>
              <div style={S.h2}>Daily Breakdown</div>
              {days7.map(d => {
                const tasks = state.tasks[d] || []; const done = tasks.filter(t => t.done).length;
                const pct = tasks.length ? Math.round((done/tasks.length)*100) : 0;
                const mood = state.moods[d]; const moodObj = MOODS.find(m => m.score === mood);
                return (
                  <div key={d} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span>{dateLabel(d)}</span>
                      <span style={{ color: "#9ca3af" }}>{done}/{tasks.length} {state.journals[d] ? "✍️" : "📭"} {moodObj ? moodObj.emoji : "—"}</span>
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: pct >= 80 ? "#4ade80" : pct >= 50 ? "#f59e0b" : "#ef4444", borderRadius: 6 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={S.card}>
              <div style={S.h2}>🏷️ Tasks by Category (This Week)</div>
              {CATEGORIES.map(cat => {
                const total = days7.reduce((a, d) => a + (state.tasks[d] || []).filter(t => t.category === cat).length, 0);
                const done = days7.reduce((a, d) => a + (state.tasks[d] || []).filter(t => t.category === cat && t.done).length, 0);
                if (!total) return null;
                return (
                  <div key={cat} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}><span>{cat}</span><span style={{ color: "#9ca3af" }}>{done}/{total}</span></div>
                    <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 6, height: 6, overflow: "hidden" }}>
                      <div style={{ width: `${Math.round((done/total)*100)}%`, height: "100%", background: "linear-gradient(90deg,#7c3aed,#2563eb)", borderRadius: 6 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── 21-DAY LOG ── */}
        {tab === 5 && (
          <div style={S.card}>
            <div style={S.h2}>🗓️ 21-Day Activity Log</div>
            {days21.map((d, i) => {
              const tasks = state.tasks[d] || []; const done = tasks.filter(t => t.done).length;
              const hasJ = !!state.journals[d]?.trim(); const mood = MOODS.find(m => m.score === state.moods[d]);
              return (
                <div key={d} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "12px 14px", marginBottom: 8, border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{dateLabel(d)}</span>
                      {i === 0 && <span style={S.badge("linear-gradient(135deg,#7c3aed,#2563eb)")}>Today</span>}
                      {mood && <span style={{ fontSize: 18 }} title={mood.label}>{mood.emoji}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      <span style={S.badge(hasJ ? "rgba(124,58,237,0.4)" : "rgba(107,114,128,0.2)")}>{hasJ ? "✍️ Journaled" : "📭 No Entry"}</span>
                      {tasks.length > 0 && <span style={S.badge(done === tasks.length ? "rgba(74,222,128,0.25)" : done > 0 ? "rgba(245,158,11,0.25)" : "rgba(239,68,68,0.25)")}>{done}/{tasks.length} tasks</span>}
                    </div>
                  </div>
                  {hasJ && <OneLiner text={state.journals[d]} tasks={tasks} />}
                  {tasks.length > 0 && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                      {tasks.map(t => {
                        const p = priorityOf(t.priority);
                        return <span key={t.id} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 8, background: t.done ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.06)", color: t.done ? "#4ade80" : "#9ca3af", borderLeft: `2px solid ${p.color}` }}>{t.done ? "✅" : "⭕"} {t.title}</span>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── AI INSIGHTS ── */}
        {tab === 6 && (
          <>
            <div style={S.card}>
              <div style={S.h2}>🤖 AI-Powered Insights</div>
              <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 14 }}>Get a full 7-day productivity + mood report with personalised suggestions. Auto-generated every Monday.</p>
              <div style={S.row}>
                <button style={S.btn()} onClick={generateWeeklyReport} disabled={aiLoading}>{aiLoading ? "⏳ Analyzing..." : "📊 Generate Weekly Report"}</button>
                <button style={S.btn("linear-gradient(135deg,#059669,#0891b2)")} onClick={async () => {
                  setAiLoading(true); setAiResult("");
                  const j = state.journals[today] || "(no entry)";
                  const tasks = state.tasks[today] || [];
                  const mood = MOODS.find(m => m.score === state.moods[today])?.label || "not logged";
                  const r = await callAI(`Journal: "${j}"\nMood today: ${mood}\nTasks: ${JSON.stringify(tasks)}\n\nGive:\n1. Writing prompt for tomorrow\n2. Mood observation\n3. Task prioritisation tip\n4. One encouraging insight`).catch(() => "Could not generate.");
                  setAiResult(r); setAiLoading(false);
                }} disabled={aiLoading}>{aiLoading ? "⏳ Thinking..." : "✍️ Today's Insights"}</button>
              </div>
            </div>
            {aiLoading && <div style={{ ...S.card, textAlign: "center", padding: 32 }}><div style={{ fontSize: 40, marginBottom: 8 }}>🤖</div><div style={{ color: "#a78bfa", fontWeight: 600 }}>AI is analyzing your data...</div></div>}
            {aiResult && (
              <div style={S.card}>
                <div style={S.h2}>📋 AI Report</div>
                <div style={S.aiBox}>{aiResult}</div>
              </div>
            )}
            {!aiResult && !aiLoading && <div style={{ ...S.card, textAlign: "center", color: "#9ca3af", padding: 32 }}><div style={{ fontSize: 40, marginBottom: 8 }}>🧠</div><div>Click a button above to generate your personalized AI insights.</div></div>}
          </>
        )}
      </div>
    </div>
  );
}
