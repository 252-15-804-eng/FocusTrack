
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Clock, ChartNoAxesColumn, History,
  Target, Settings, BookOpen, Smartphone, Pause, Play,
  Square, Moon, Sun, User, CalendarDays, TrendingUp,
  Timer, Trash2, Plus, Menu, X, LogOut,
  FileText, FileUp, Download, Eye, Save
} from "lucide-react";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, PieChart, Pie, Cell
} from "recharts";

import Auth from "./Auth";
import "./App.css";

const API_URL = "http://127.0.0.1:8001";

const todayKey = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
};

const todayKeyFromTimestamp = (timestamp) => {
  const d = new Date(timestamp);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
};

const formatTime = (seconds) => {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;

  return [h, m, s]
    .map(v => String(v).padStart(2, "0"))
    .join(":");
};

const formatHours = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  return `${h}h ${m}m`;
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });

const formatClock = (value) =>
  new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });

const toLocalISOString = (timestamp) => {
  const d = new Date(timestamp);
  const pad = n => String(n).padStart(2, "0");

  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
};

const mapSession = (item) => {
  const startTime = new Date(
    String(item.start_time).replace(" ", "T")
  ).getTime();

  const endTime = item.end_time
    ? new Date(String(item.end_time).replace(" ", "T")).getTime()
    : startTime + (Number(item.duration_seconds) || 0) * 1000;

  return {
    id: String(item.id),
    activity: item.activity,
    subject: item.subject || "",
    duration: Number(item.duration_seconds) || 0,
    startTime,
    endTime,
    day: todayKeyFromTimestamp(startTime)
  };
};

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Tracker", icon: Clock },
  { name: "Analytics", icon: ChartNoAxesColumn },
  { name: "History", icon: History },
  { name: "Goals", icon: Target },
  { name: "Notes & PDFs", icon: FileText },
  { name: "Settings", icon: Settings }
];

async function apiRequest(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.detail || "API request failed");
  }

  return data;
}

export default function App() {
  const [authToken, setAuthToken] = useState(
    () => localStorage.getItem("ft_token")
  );

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem("ft_user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [page, setPage] = useState("Dashboard");
  const [dark, setDark] = useState(true);

  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);

  const [goals, setGoals] = useState({
    study: 6,
    phone: 3
  });

  // Notes and PDF states
  const [notes, setNotes] = useState([]);
  const [pdfs, setPdfs] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteSubject, setNoteSubject] = useState("");
  const [pdfSubject, setPdfSubject] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [pdfPreviewName, setPdfPreviewName] = useState("");

  const [active, setActive] = useState(null);
  const [subject, setSubject] = useState("General Study");
  const [newSubject, setNewSubject] = useState("");

  const [now, setNow] = useState(Date.now());
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadingData, setLoadingData] = useState(false);

  const [adminStats, setAdminStats] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [selectedAdminUser, setSelectedAdminUser] = useState(null);
  const [selectedAdminSessions, setSelectedAdminSessions] = useState([]);

  const activeStorageKey = currentUser
    ? `ft_active_${currentUser.id}`
    : null;

  // ==========================================
  // AUTHENTICATION
  // ==========================================

  const handleLogin = (token, user) => {
    localStorage.setItem("ft_token", token);
    localStorage.setItem("ft_user", JSON.stringify(user));

    setAuthToken(token);
    setCurrentUser(user);
    setPage("Dashboard");
  };

  const handleLogout = () => {
    if (activeStorageKey) {
      localStorage.removeItem(activeStorageKey);
    }

    localStorage.removeItem("ft_token");
    localStorage.removeItem("ft_user");

    setAuthToken(null);
    setCurrentUser(null);

    setSessions([]);
    setSubjects([]);
    setNotes([]);
    setPdfs([]);
    setSelectedNoteId(null);
    setNoteTitle("");
    setNoteContent("");
    setNoteSubject("");

    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }

    setPdfPreviewUrl("");
    setPdfPreviewName("");
    setActive(null);
    setGoals({ study: 6, phone: 3 });

    setAdminStats(null);
    setAdminUsers([]);
    setSelectedAdminUser(null);
    setSelectedAdminSessions([]);

    setPage("Dashboard");
  };

  // ==========================================
  // LOAD USER DATA FROM BACKEND
  // ==========================================

  useEffect(() => {
    if (!authToken || !currentUser) return;

    let cancelled = false;

    const loadData = async () => {
      setLoadingData(true);

      try {
        const me = await apiRequest("/auth/me", authToken);

        if (cancelled) return;

        if (String(me.id) !== String(currentUser.id)) {
          throw new Error("Account session mismatch. Please login again.");
        }

        const isAdmin = currentUser.role === "admin";

        const requests = [
          apiRequest("/sessions", authToken),
          apiRequest("/subjects", authToken),
          apiRequest("/goals", authToken),
          apiRequest("/settings", authToken)
        ];

        if (!isAdmin) {
          requests.push(
            apiRequest("/notes", authToken),
            apiRequest("/pdfs", authToken)
          );
        }

        const result = await Promise.all(requests);

        if (cancelled) return;

        const [sessionData, subjectData, goalData, settingsData] = result;

        setSessions(sessionData.map(mapSession));
        setSubjects(subjectData.map(item => item.name));

        setGoals({
          study: Number(goalData.study_goal) || 6,
          phone: Number(goalData.phone_limit) || 3
        });

        setDark(settingsData.theme !== "light");

        if (!isAdmin) {
          setNotes(result[4] || []);
          setPdfs(result[5] || []);
        }

        const savedActive = localStorage.getItem(activeStorageKey);

        if (savedActive) {
          try {
            const parsed = JSON.parse(savedActive);

            if (
              parsed &&
              parsed.activity &&
              parsed.startedAt &&
              Date.now() - parsed.startedAt < 86400000
            ) {
              setActive(parsed);
            } else {
              setActive(null);
              localStorage.removeItem(activeStorageKey);
            }
          } catch {
            setActive(null);
            localStorage.removeItem(activeStorageKey);
          }
        } else {
          setActive(null);
        }

      } catch (error) {
        if (!cancelled) {
          setNotice(error.message);

          if (
            error.message.toLowerCase().includes("token") ||
            error.message.toLowerCase().includes("login") ||
            error.message.toLowerCase().includes("expired") ||
            error.message.toLowerCase().includes("mismatch")
          ) {
            handleLogout();
          }
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [authToken, currentUser?.id]);

  // ==========================================
  // SAVE ACTIVE TIMER PER USER
  // ==========================================

  useEffect(() => {
    if (!activeStorageKey) return;

    if (active) {
      localStorage.setItem(
        activeStorageKey,
        JSON.stringify(active)
      );
    } else {
      localStorage.removeItem(activeStorageKey);
    }
  }, [active, activeStorageKey]);

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(id);
  }, []);

  const elapsed = active
    ? (active.elapsedBeforePause || 0) +
      (active.running
        ? Math.max(
            0,
            Math.floor((now - active.startedAt) / 1000)
          )
        : 0)
    : 0;

  // ==========================================
  // NOTES FUNCTIONS
  // ==========================================

  const selectNote = (note) => {
    setSelectedNoteId(note.id);
    setNoteTitle(note.title || "");
    setNoteContent(note.content || "");
    setNoteSubject(note.subject || "");
  };

  const resetNoteEditor = () => {
    setSelectedNoteId(null);
    setNoteTitle("");
    setNoteContent("");
    setNoteSubject("");
  };

  const saveNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) {
      setNotice("Please enter note title and content.");
      return;
    }

    const noteData = {
      title: noteTitle.trim(),
      content: noteContent,
      subject: noteSubject || "General Study"
    };

    try {
      if (selectedNoteId) {
        const updated = await apiRequest(
          `/notes/${selectedNoteId}`,
          authToken,
          {
            method: "PUT",
            body: JSON.stringify(noteData)
          }
        );

        setNotes(prev =>
          prev.map(note =>
            note.id === selectedNoteId ? updated : note
          )
        );

        setNotice("Note updated successfully!");

      } else {
        const created = await apiRequest(
          "/notes",
          authToken,
          {
            method: "POST",
            body: JSON.stringify(noteData)
          }
        );

        setNotes(prev => [created, ...prev]);
        setNotice("Note saved successfully!");
      }

      resetNoteEditor();

    } catch (error) {
      setNotice(error.message);
    }
  };

  const deleteNote = async (id) => {
    if (!window.confirm("Are you sure you want to delete this note?")) {
      return;
    }

    try {
      await apiRequest(`/notes/${id}`, authToken, {
        method: "DELETE"
      });

      setNotes(prev => prev.filter(note => note.id !== id));

      if (selectedNoteId === id) {
        resetNoteEditor();
      }

      setNotice("Note deleted successfully!");

    } catch (error) {
      setNotice(error.message);
    }
  };

  // ==========================================
  // PDF FUNCTIONS
  // ==========================================

  const handlePdfUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.type !== "application/pdf") {
      setNotice("Only PDF files are allowed.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setNotice("PDF file size must be less than 10 MB.");
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("subject", pdfSubject || "General Study");

    setPdfBusy(true);

    try {
      const response = await fetch(`${API_URL}/pdfs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`
        },
        body: formData
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.detail || "PDF upload failed.");
      }

      setPdfs(prev => [result, ...prev]);
      setNotice("PDF uploaded successfully!");

    } catch (error) {
      setNotice(error.message);

    } finally {
      setPdfBusy(false);
      event.target.value = "";
    }
  };

  const openPdf = async (pdf) => {
    try {
      const response = await fetch(
        `${API_URL}/pdfs/${pdf.id}/view`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Could not open PDF.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }

      setPdfPreviewUrl(url);
      setPdfPreviewName(
        pdf.original_filename || pdf.filename || "PDF Preview"
      );

    } catch (error) {
      setNotice(error.message);
    }
  };

  const downloadPdf = async (pdf) => {
    try {
      const response = await fetch(
        `${API_URL}/pdfs/${pdf.id}/download`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      if (!response.ok) {
        throw new Error("Could not download PDF.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download =
        pdf.original_filename || pdf.filename || "document.pdf";

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

    } catch (error) {
      setNotice(error.message);
    }
  };

  const deletePdf = async (id) => {
    if (!window.confirm("Are you sure you want to delete this PDF?")) {
      return;
    }

    try {
      await apiRequest(`/pdfs/${id}`, authToken, {
        method: "DELETE"
      });

      setPdfs(prev => prev.filter(pdf => pdf.id !== id));
      setNotice("PDF deleted successfully!");

    } catch (error) {
      setNotice(error.message);
    }
  };

  // ==========================================
  // USER SESSION FUNCTIONS
  // ==========================================

  const saveSession = async (session, duration) => {
    if (!session || duration <= 0) return;

    const endTime = Date.now();
    const startTime = endTime - duration * 1000;

    try {
      const saved = await apiRequest("/sessions", authToken, {
        method: "POST",
        body: JSON.stringify({
          activity: session.activity,
          subject: session.subject || "General",
          duration_seconds: Math.floor(duration),
          start_time: toLocalISOString(startTime),
          end_time: toLocalISOString(endTime)
        })
      });

      setSessions(prev => [
        mapSession(saved),
        ...prev
      ]);

      setNotice("Session saved successfully!");

    } catch (error) {
      setNotice(`Could not save session: ${error.message}`);
    }
  };

  const startActivity = (type) => {
    if (active) {
      if (active.running) {
        setNotice("Pause or stop your current session first.");
        return;
      }

      saveSession(active, elapsed);
    }

    setActive({
      activity: type,
      subject: type === "Study" ? subject : "",
      startedAt: Date.now(),
      elapsedBeforePause: 0,
      running: true
    });

    setNotice("");
    setPage("Tracker");
  };

  const pauseTimer = () => {
    if (!active || !active.running) return;

    setActive({
      ...active,
      elapsedBeforePause: elapsed,
      running: false,
      startedAt: null
    });
  };

  const resumeTimer = () => {
    if (!active || active.running) return;

    setActive({
      ...active,
      startedAt: Date.now(),
      running: true
    });
  };

  const stopTimer = async () => {
    if (!active) return;

    const session = active;
    const duration = elapsed;

    setActive(null);

    await saveSession(session, duration);
  };

  const deleteSession = async (id) => {
    try {
      await apiRequest(`/sessions/${id}`, authToken, {
        method: "DELETE"
      });

      setSessions(prev =>
        prev.filter(item => item.id !== String(id))
      );

      setNotice("Session deleted successfully.");

    } catch (error) {
      setNotice(error.message);
    }
  };

  // ==========================================
  // SUBJECTS
  // ==========================================

  const addSubject = async () => {
    const value = newSubject.trim();

    if (!value) return;

    try {
      const result = await apiRequest("/subjects", authToken, {
        method: "POST",
        body: JSON.stringify({ name: value })
      });

      setSubjects(prev => [...prev, result.name]);
      setSubject(result.name);
      setNewSubject("");
      setNotice("Subject added successfully.");

    } catch (error) {
      setNotice(error.message);
    }
  };

  const deleteSubject = async (name) => {
    const item = subjects.find(s => s === name);

    if (!item) return;

    try {
      const allSubjects = await apiRequest("/subjects", authToken);
      const found = allSubjects.find(s => s.name === name);

      if (!found) return;

      await apiRequest(`/subjects/${found.id}`, authToken, {
        method: "DELETE"
      });

      setSubjects(prev => prev.filter(s => s !== name));

      if (subject === name) {
        setSubject(
          subjects.find(s => s !== name) || "General Study"
        );
      }

      setNotice("Subject deleted successfully.");

    } catch (error) {
      setNotice(error.message);
    }
  };

  // ==========================================
  // GOALS AND SETTINGS
  // ==========================================

  const updateGoals = async (nextGoals) => {
    setGoals(nextGoals);

    try {
      await apiRequest("/goals", authToken, {
        method: "PUT",
        body: JSON.stringify({
          study_goal: nextGoals.study,
          phone_limit: nextGoals.phone
        })
      });
    } catch (error) {
      setNotice(error.message);
    }
  };

  const toggleTheme = async () => {
    const next = !dark;
    setDark(next);

    try {
      await apiRequest("/settings", authToken, {
        method: "PUT",
        body: JSON.stringify({
          theme: next ? "dark" : "light"
        })
      });
    } catch (error) {
      setNotice(error.message);
    }
  };

  // ==========================================
  // ADMIN DATA
  // ==========================================

  const loadAdminData = async () => {
    try {
      const [stats, users] = await Promise.all([
        apiRequest("/admin/stats", authToken),
        apiRequest("/admin/users", authToken)
      ]);

      setAdminStats(stats);
      setAdminUsers(users);

    } catch (error) {
      setNotice(error.message);
    }
  };

  useEffect(() => {
    if (
      authToken &&
      currentUser?.role === "admin"
    ) {
      loadAdminData();
    }
  }, [authToken, currentUser?.id, currentUser?.role]);

  const viewAdminUser = async (user) => {
    try {
      const result = await apiRequest(
        `/admin/users/${user.id}/sessions`,
        authToken
      );

      setSelectedAdminUser(result.user);
      setSelectedAdminSessions(
        result.sessions.map(mapSession)
      );

    } catch (error) {
      setNotice(error.message);
    }
  };

  // ==========================================
  // ADMIN DASHBOARD
  // ==========================================

  const renderAdminDashboard = () => (
    <section className="page-content">
      <PageTitle
        title="Admin Dashboard"
        subtitle="Manage FocusTrack users and monitor platform activity."
      />

      {adminStats ? (
        <>
          <div className="stats-grid">
            <StatCard
              icon={<User />}
              title="Total Users"
              value={adminStats.total_users}
              color="green"
            />

            <StatCard
              icon={<TrendingUp />}
              title="Active Today"
              value={adminStats.active_today}
              color="blue"
            />

            <StatCard
              icon={<CalendarDays />}
              title="Active This Week"
              value={adminStats.active_this_week}
              color="purple"
            />

            <StatCard
              icon={<BookOpen />}
              title="Total Study Time"
              value={formatHours(adminStats.total_study_seconds)}
              color="pink"
            />
          </div>

          <div className="panel full-history">
            <div className="panel-heading">
              <h3><User size={20} /> Registered Users</h3>

              <button
                className="text-button"
                onClick={loadAdminData}
              >
                Refresh
              </button>
            </div>

            {adminUsers.length === 0 ? (
              <p className="empty">No registered users yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email / Phone</th>
                      <th>Study Time</th>
                      <th>Sessions</th>
                      <th>Details</th>
                    </tr>
                  </thead>

                  <tbody>
                    {adminUsers.map(user => (
                      <tr key={user.id}>
                        <td>{user.name}</td>
                        <td>{user.identifier}</td>
                        <td>
                          {formatHours(user.total_study_seconds)}
                        </td>
                        <td>{user.total_sessions}</td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => viewAdminUser(user)}
                          >
                            View Sessions
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedAdminUser && (
            <div className="panel full-history">
              <div className="panel-heading">
                <div>
                  <h3>{selectedAdminUser.name}</h3>
                  <p className="muted">
                    {selectedAdminUser.identifier}
                  </p>
                </div>

                <button
                  className="text-button"
                  onClick={() => {
                    setSelectedAdminUser(null);
                    setSelectedAdminSessions([]);
                  }}
                >
                  Close
                </button>
              </div>

              <SessionTable sessions={selectedAdminSessions} />
            </div>
          )}
        </>
      ) : (
        <p className="empty">
          {loadingData ? "Loading admin data..." : "Admin data unavailable."}
        </p>
      )}
    </section>
  );

  // ==========================================
  // USER DASHBOARD CALCULATIONS
  // ==========================================

  const today = todayKey();

  const todaySessions = useMemo(
    () => sessions.filter(s => s.day === today),
    [sessions, today]
  );

  const studyTime =
    todaySessions
      .filter(s => s.activity === "Study")
      .reduce((sum, s) => sum + s.duration, 0) +
    (active?.activity === "Study" ? elapsed : 0);

  const phoneTime =
    todaySessions
      .filter(s => s.activity === "Phone")
      .reduce((sum, s) => sum + s.duration, 0) +
    (active?.activity === "Phone" ? elapsed : 0);

  const studyPercent = goals.study > 0
    ? Math.min(
        100,
        Math.round(studyTime / (goals.study * 3600) * 100)
      )
    : 0;

  const phonePercent = goals.phone > 0
    ? Math.min(
        100,
        Math.round(phoneTime / (goals.phone * 3600) * 100)
      )
    : 0;

  const productivity = studyTime + phoneTime > 0
    ? Math.round(
        studyTime / (studyTime + phoneTime) * 100
      )
    : 0;

  const weeklyData = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();

      date.setDate(date.getDate() - (6 - index));

      const key = todayKeyFromTimestamp(date.getTime());

      const daySessions = sessions.filter(s => s.day === key);

      let study = daySessions
        .filter(s => s.activity === "Study")
        .reduce((sum, s) => sum + s.duration, 0);

      let phone = daySessions
        .filter(s => s.activity === "Phone")
        .reduce((sum, s) => sum + s.duration, 0);

      if (key === today) {
        if (active?.activity === "Study") study += elapsed;
        if (active?.activity === "Phone") phone += elapsed;
      }

      return {
        day: date.toLocaleDateString("en-US", {
          weekday: "short"
        }),
        study: Number((study / 3600).toFixed(2)),
        phone: Number((phone / 3600).toFixed(2))
      };
    });
  }, [sessions, today, active, elapsed]);

  const totalStudyWeek = weeklyData.reduce(
    (sum, d) => sum + d.study,
    0
  );

  const totalPhoneWeek = weeklyData.reduce(
    (sum, d) => sum + d.phone,
    0
  );

  const subjectRows = subjects.map(name => {
    const saved = sessions.filter(
      s => s.activity === "Study" && s.subject === name
    );

    const liveSeconds =
      active?.activity === "Study" && active.subject === name
        ? elapsed
        : 0;

    return {
      name,
      seconds: saved.reduce(
        (sum, item) => sum + item.duration,
        0
      ) + liveSeconds,
      count: saved.length
    };
  });

  const totalSubjectTime = subjectRows.reduce(
    (sum, item) => sum + item.seconds,
    0
  );

  const totalSubjectSessions = subjectRows.reduce(
    (sum, item) => sum + item.count,
    0
  );

  const changePage = (name) => {
    setPage(name);
    setMobileMenu(false);
    setNotice("");
  };

  // ==========================================
  // RESET DATA
  // ==========================================

  const resetAllData = async () => {
    const confirmed = window.confirm(
      "Delete all your saved sessions? This cannot be undone."
    );

    if (!confirmed) return;

    try {
      await Promise.all(
        sessions.map(item =>
          apiRequest(`/sessions/${item.id}`, authToken, {
            method: "DELETE"
          })
        )
      );

      setSessions([]);
      setActive(null);
      setNotice("All your sessions have been deleted.");

    } catch (error) {
      setNotice(error.message);
    }
  };

  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });

  // ==========================================
  // NOTES & PDF LIBRARY PAGE
  // ==========================================

  const renderNotesLibrary = () => (
    <section className="page-content">
      <PageTitle
        title="Notes & PDFs"
        subtitle="Save your study notes and manage your PDF documents."
      />

      <div className="library-tabs">
        <div>
          <h3><FileText size={20} /> My Study Library</h3>
          <p className="muted">
            Your personal notes and PDF documents.
          </p>
        </div>

        <span className="status">
          {notes.length} Notes · {pdfs.length} PDFs
        </span>
      </div>

      <div className="library-layout">

        {/* NOTES SECTION */}

        <div className="panel library-editor">
          <div className="panel-heading">
            <h3>
              <FileText size={20} />
              {selectedNoteId ? "Edit Note" : "Create New Note"}
            </h3>

            <button
              className="text-button"
              onClick={resetNoteEditor}
            >
              New Note
            </button>
          </div>

          <div className="note-form">
            <label>Note Title</label>

            <input
              type="text"
              placeholder="Enter note title..."
              value={noteTitle}
              onChange={e => setNoteTitle(e.target.value)}
            />

            <label>Subject</label>

            <select
              value={noteSubject}
              onChange={e => setNoteSubject(e.target.value)}
            >
              <option value="">Select Subject</option>

              {subjects.map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <label>Note Content</label>

            <textarea
              rows={12}
              placeholder="Write your study notes here..."
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
            />

            <div className="library-actions">
              <button
                className="primary-button"
                onClick={saveNote}
              >
                <Save size={17} />
                {selectedNoteId ? "Update Note" : "Save Note"}
              </button>

              <button
                className="text-button"
                onClick={resetNoteEditor}
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* SAVED NOTES */}

        <div className="panel library-sidebar">
          <h3>Saved Notes</h3>

          {notes.length === 0 ? (
            <p className="empty">
              No notes yet. Create your first note.
            </p>
          ) : (
            <div className="note-list">
              {notes.map(note => (
                <div
                  className={`note-item ${
                    selectedNoteId === note.id ? "selected" : ""
                  }`}
                  key={note.id}
                >
                  <button
                    className="note-item-content"
                    onClick={() => selectNote(note)}
                  >
                    <strong>{note.title}</strong>

                    <small>
                      {note.subject || "General Study"}
                    </small>

                    <p>
                      {note.content?.slice(0, 75)}
                      {note.content?.length > 75 ? "..." : ""}
                    </p>
                  </button>

                  <button
                    className="delete-button"
                    title="Delete note"
                    onClick={() => deleteNote(note.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PDF UPLOAD */}

      <div className="panel pdf-upload-area">
        <h3>
          <FileUp size={21} /> Upload Study PDF
        </h3>

        <p className="muted">
          Upload your lecture slides, books, and study materials.
          Maximum file size: 10 MB.
        </p>

        <label>Choose Subject</label>

        <select
          value={pdfSubject}
          onChange={e => setPdfSubject(e.target.value)}
        >
          <option value="">Select Subject</option>

          {subjects.map(item => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <div className="upload-control">
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={handlePdfUpload}
            disabled={pdfBusy}
          />

          {pdfBusy && <p>Uploading PDF...</p>}
        </div>
      </div>

      {/* PDF LIST */}

      <div className="panel">
        <div className="panel-heading">
          <h3>
            <FileText size={20} /> My PDF Documents
          </h3>

          <span className="status">
            {pdfs.length} Documents
          </span>
        </div>

        {pdfs.length === 0 ? (
          <p className="empty">
            No PDF documents uploaded yet.
          </p>
        ) : (
          <div className="pdf-grid">
            {pdfs.map(pdf => (
              <div className="pdf-card" key={pdf.id}>
                <FileText size={35} />

                <h4>
                  {pdf.original_filename ||
                    pdf.filename ||
                    "PDF Document"}
                </h4>

                <p className="muted">
                  {pdf.subject || "General Study"}
                </p>

                <div className="pdf-card-actions">
                  <button
                    className="text-button"
                    onClick={() => openPdf(pdf)}
                    title="View PDF"
                  >
                    <Eye size={17} /> View
                  </button>

                  <button
                    className="text-button"
                    onClick={() => downloadPdf(pdf)}
                    title="Download PDF"
                  >
                    <Download size={17} /> Download
                  </button>

                  <button
                    className="delete-button"
                    onClick={() => deletePdf(pdf.id)}
                    title="Delete PDF"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PDF PREVIEW */}

      {pdfPreviewUrl && (
        <div className="panel pdf-preview">
          <div className="panel-heading">
            <h3>{pdfPreviewName}</h3>

            <button
              className="text-button"
              onClick={() => {
                URL.revokeObjectURL(pdfPreviewUrl);
                setPdfPreviewUrl("");
                setPdfPreviewName("");
              }}
            >
              <X size={17} /> Close
            </button>
          </div>

          <iframe
            src={pdfPreviewUrl}
            title="PDF Preview"
            width="100%"
            height="600px"
          />
        </div>
      )}
    </section>
  );
  
  // ==========================================
  // USER DASHBOARD
  // ==========================================

  const renderDashboard = () => (
    <>
      <section className="welcome">
        <h1>
          Good {
            new Date().getHours() < 12
              ? "Morning"
              : new Date().getHours() < 18
                ? "Afternoon"
                : "Evening"
          }! 👋
        </h1>

        <p>
          Welcome, {currentUser?.name}. Make today productive!
        </p>
      </section>

      <section className="stats-grid">
        <StatCard
          icon={<BookOpen />}
          title="Study Time (Today)"
          value={formatTime(studyTime)}
          color="green"
        />

        <StatCard
          icon={<Smartphone />}
          title="Phone Time (Today)"
          value={formatTime(phoneTime)}
          color="blue"
        />

        <ProgressCard
          icon={<Target />}
          title="Study Goal"
          value={formatHours(studyTime)}
          goal={`${goals.study.toFixed(1)} hrs`}
          percent={studyPercent}
          color="purple"
        />

        <ProgressCard
          icon={<Smartphone />}
          title="Phone Limit"
          value={formatHours(phoneTime)}
          goal={`${goals.phone.toFixed(1)} hrs`}
          percent={phonePercent}
          color="pink"
        />
      </section>

      <SubjectTracker
        rows={subjectRows}
        totalTime={totalSubjectTime}
        totalSessions={totalSubjectSessions}
      />

      <section className="dashboard-grid">
        <CurrentSession
          active={active}
          elapsed={elapsed}
          running={!!active?.running}
          pause={pauseTimer}
          resume={resumeTimer}
          stop={stopTimer}
        />

        <div className="panel overview-panel">
          <h3>Today's Overview</h3>

          <div className="overview-content">
            <div
              className="donut"
              style={{
                background: `conic-gradient(#20d783 ${productivity}%, #3488f5 0)`
              }}
            >
              <div className="donut-inner">
                <strong>{productivity}%</strong>
                <small>Study</small>
              </div>
            </div>

            <div className="legend">
              <p>
                <span className="dot green-dot" />
                Study <b>{formatHours(studyTime)}</b>
              </p>

              <p>
                <span className="dot blue-dot" />
                Phone <b>{formatHours(phoneTime)}</b>
              </p>
            </div>
          </div>
        </div>

        <div className="panel productivity-panel">
          <h3>Productivity</h3>
          <TrendingUp size={40} className="trend-icon" />
          <h1>{productivity}%</h1>
          <p>Today's Focus Score</p>
        </div>

        <div className="panel start-panel">
          <h3><Timer size={20} /> Start New Activity</h3>

          <div className="subject-select">
            <label>Study subject</label>

            <select
              value={subject}
              onChange={e => setSubject(e.target.value)}
            >
              {subjects.map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="activity-buttons">
            <button
              className="start-study"
              onClick={() => startActivity("Study")}
            >
              <BookOpen size={30} />
              <strong>Study</strong>
            </button>

            <button
              className="start-phone"
              onClick={() => startActivity("Phone")}
            >
              <Smartphone size={30} />
              <strong>Phone</strong>
            </button>
          </div>
        </div>

        <div className="panel chart-panel">
          <h3>Study vs Phone (Last 7 Days)</h3>

          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--grid)"
                />
                <XAxis dataKey="day" stroke="var(--muted)" />
                <YAxis stroke="var(--muted)" />
                <Tooltip />

                <Bar
                  dataKey="study"
                  name="Study (hours)"
                  fill="#20d783"
                  radius={[4, 4, 0, 0]}
                />

                <Bar
                  dataKey="phone"
                  name="Phone (hours)"
                  fill="#3488f5"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel history-panel">
          <div className="panel-heading">
            <h3><Clock size={20} /> Recent Sessions</h3>

            <button
              className="text-button"
              onClick={() => changePage("History")}
            >
              View All →
            </button>
          </div>

          <SessionTable sessions={sessions.slice(0, 4)} />
        </div>

        <div className="panel goals-panel">
          <h3><Target size={20} /> Goals Progress</h3>

          <GoalLine
            title="Daily Study Goal"
            value={formatHours(studyTime)}
            target={`${goals.study}h`}
            percent={studyPercent}
          />

          <GoalLine
            title="Daily Phone Limit"
            value={formatHours(phoneTime)}
            target={`${goals.phone}h`}
            percent={phonePercent}
            pink
          />
        </div>
      </section>
    </>
  );

  // ==========================================
  // TRACKER PAGE
  // ==========================================

  const renderTracker = () => (
    <section className="page-content">
      <PageTitle
        title="Activity Tracker"
        subtitle="Track every minute of your study and phone usage."
      />

      <div className="panel tracker-box">
        <div className="tracker-status">
          <span className={active?.running ? "online" : ""}>
            {active?.running ? "● Running" : "○ Not Running"}
          </span>
        </div>

        <div className="session-type">
          {active?.activity === "Phone"
            ? <Smartphone />
            : <BookOpen />}

          <span>
            {active ? `${active.activity} Session` : "Ready to Start"}
          </span>
        </div>

        {active?.subject && (
          <p className="muted">{active.subject}</p>
        )}

        <div className="big-timer">
          {formatTime(elapsed)}
        </div>

        <p className="muted">
          {active?.running
            ? "Your session is being tracked."
            : active
              ? "Timer paused. Resume when ready."
              : "Choose an activity to begin."}
        </p>

        <div className="subject-select tracker-subject">
          <label>Study subject</label>

          <select
            value={subject}
            onChange={e => setSubject(e.target.value)}
          >
            {subjects.map(s => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="activity-buttons">
          <button
            className="start-study"
            onClick={() => startActivity("Study")}
          >
            <BookOpen />
            <strong>Start Study</strong>
          </button>

          <button
            className="start-phone"
            onClick={() => startActivity("Phone")}
          >
            <Smartphone />
            <strong>Start Phone</strong>
          </button>
        </div>

        <div className="timer-buttons">
          {active && active.running && (
            <button className="pause-button" onClick={pauseTimer}>
              <Pause size={18} /> Pause
            </button>
          )}

          {active && !active.running && (
            <button className="pause-button" onClick={resumeTimer}>
              <Play size={18} /> Resume
            </button>
          )}

          {active && (
            <button className="stop-button" onClick={stopTimer}>
              <Square size={17} /> Stop & Save
            </button>
          )}
        </div>
      </div>

      <div className="panel tracker-info">
        <h3>Today's Summary</h3>

        <div className="summary-grid">
          <div>
            <BookOpen />
            <span>Study</span>
            <strong>{formatTime(studyTime)}</strong>
          </div>

          <div>
            <Smartphone />
            <span>Phone</span>
            <strong>{formatTime(phoneTime)}</strong>
          </div>

          <div>
            <Timer />
            <span>Sessions</span>
            <strong>{todaySessions.length}</strong>
          </div>
        </div>
      </div>

      <SubjectTracker
        rows={subjectRows}
        totalTime={totalSubjectTime}
        totalSessions={totalSubjectSessions}
      />
    </section>
  );

  // ==========================================
  // ANALYTICS PAGE
  // ==========================================

  const renderAnalytics = () => (
    <section className="page-content">
      <PageTitle
        title="Analytics"
        subtitle="Understand how you spend your time."
      />

      <div className="stats-grid analytics-stats">
        <StatCard
          icon={<BookOpen />}
          title="Study This Week"
          value={`${totalStudyWeek.toFixed(1)} hrs`}
          color="green"
        />

        <StatCard
          icon={<Smartphone />}
          title="Phone This Week"
          value={`${totalPhoneWeek.toFixed(1)} hrs`}
          color="blue"
        />

        <StatCard
          icon=<TrendingUp />
          title="Total Sessions"
          value={sessions.length}
          color="purple"
        />

        <StatCard
          icon={<TrendingUp />}
          title="Today's Focus Score"
          value={`${productivity}%`}
          color="pink"
        />
      </div>

      <div className="panel analytics-chart">
        <h3>Weekly Activity (Hours)</h3>

        <div className="large-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--grid)"
              />
              <XAxis dataKey="day" stroke="var(--muted)" />
              <YAxis stroke="var(--muted)" />
              <Tooltip />

              <Bar
                dataKey="study"
                name="Study"
                fill="#20d783"
                radius={[5, 5, 0, 0]}
              />

              <Bar
                dataKey="phone"
                name="Phone"
                fill="#3488f5"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel analytics-chart">
        <h3>Today's Time Distribution</h3>

        <div className="pie-area">
          {studyTime + phoneTime === 0 ? (
            <p className="muted">
              Start tracking to see your time distribution.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Study", value: studyTime },
                    { name: "Phone", value: phoneTime }
                  ].filter(d => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  label
                >
                  <Cell fill="#20d783" />
                  <Cell fill="#3488f5" />
                </Pie>

                <Tooltip formatter={v => formatTime(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </section>
  );

  // ==========================================
  // HISTORY PAGE
  // ==========================================

  const renderHistory = () => (
    <section className="page-content">
      <PageTitle
        title="Session History"
        subtitle="Review and manage your recorded sessions."
      />

      <div className="history-summary">
        <div className="panel">
          <span>Total Sessions</span>
          <strong>{sessions.length}</strong>
        </div>

        <div className="panel">
          <span>Study Sessions</span>
          <strong>
            {sessions.filter(s => s.activity === "Study").length}
          </strong>
        </div>

        <div className="panel">
          <span>Phone Sessions</span>
          <strong>
            {sessions.filter(s => s.activity === "Phone").length}
          </strong>
        </div>
      </div>

      <div className="panel full-history">
        <h3>All Sessions</h3>

        {sessions.length === 0 ? (
          <p className="empty">
            No sessions saved yet. Go to Tracker to start.
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Subject</th>
                  <th>Date</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Duration</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td>
                      {s.activity === "Study" ? "📚 Study" : "📱 Phone"}
                    </td>

                    <td>{s.subject || "—"}</td>
                    <td>{formatDate(s.startTime)}</td>
                    <td>{formatClock(s.startTime)}</td>
                    <td>{formatClock(s.endTime)}</td>
                    <td>{formatTime(s.duration)}</td>

                    <td>
                      <button
                        className="delete-button"
                        onClick={() => deleteSession(s.id)}
                        title="Delete session"
                      >
                        <Trash2 size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );

  // ==========================================
  // GOALS PAGE
  // ==========================================

  const renderGoals = () => (
    <section className="page-content">
      <PageTitle
        title="Goals & Limits"
        subtitle="Set realistic daily targets for your routine."
      />

      <div className="goals-settings-grid">
        <div className="panel goal-setting-card">
          <div className="stat-icon green">
            <BookOpen />
          </div>

          <h3>Daily Study Goal</h3>
          <p className="muted">
            How many hours do you want to study?
          </p>

          <div className="goal-number">
            {goals.study} <small>hours</small>
          </div>

          <input
            type="range"
            min="0.5"
            max="16"
            step="0.5"
            value={goals.study}
            onChange={e => updateGoals({
              ...goals,
              study: Number(e.target.value)
            })}
          />

          <div className="range-labels">
            <span>30 min</span>
            <span>16 hours</span>
          </div>

          <GoalLine
            title="Today's progress"
            value={formatHours(studyTime)}
            target={`${goals.study}h`}
            percent={studyPercent}
          />
        </div>

        <div className="panel goal-setting-card">
          <div className="stat-icon pink">
            <Smartphone />
          </div>

          <h3>Daily Phone Limit</h3>
          <p className="muted">
            Set your maximum phone usage.
          </p>

          <div className="goal-number">
            {goals.phone} <small>hours</small>
          </div>

          <input
            type="range"
            min="0"
            max="12"
            step="0.5"
            value={goals.phone}
            onChange={e => updateGoals({
              ...goals,
              phone: Number(e.target.value)
            })}
          />

          <div className="range-labels">
            <span>0 hours</span>
            <span>12 hours</span>
          </div>

          <GoalLine
            title="Today's usage"
            value={formatHours(phoneTime)}
            target={`${goals.phone}h`}
            percent={phonePercent}
            pink
          />
        </div>
      </div>

      <div className="panel goal-advice">
        <Target size={25} />

        <div>
          <h3>Your Daily Targets</h3>
          <p>
            Study for {goals.study} hours and keep phone usage
            under {goals.phone} hours.
          </p>
        </div>
      </div>
    </section>
  );

  // ==========================================
  // SETTINGS PAGE
  // ==========================================

  const renderSettings = () => (
    <section className="page-content">
      <PageTitle
        title="Settings"
        subtitle="Customize your FocusTrack experience."
      />

      <div className="panel settings-card">
        <h3>Account</h3>

        <div className="setting-row">
          <div>
            <strong>{currentUser?.name}</strong>
            <p className="muted">{currentUser?.identifier}</p>
            <p className="muted">Role: {currentUser?.role}</p>
          </div>

          <button className="stop-button" onClick={handleLogout}>
            <LogOut size={17} /> Logout
          </button>
        </div>
      </div>

      <div className="panel settings-card">
        <h3>Appearance</h3>

        <div className="setting-row">
          <div>
            <strong>Dark Mode</strong>
            <p className="muted">
              Choose your preferred appearance.
            </p>
          </div>

          <button className="toggle-button" onClick={toggleTheme}>
            {dark ? <Moon size={18} /> : <Sun size={18} />}
            {dark ? "Dark" : "Light"}
          </button>
        </div>
      </div>

      <div className="panel settings-card">
        <h3>Study Subjects</h3>

        <p className="muted">
          Manage the subjects available in your Study Tracker.
        </p>

        <div className="subject-list">
          {subjects.map(s => (
            <div className="subject-chip" key={s}>
              {s}

              <button
                onClick={() => deleteSubject(s)}
                title={`Remove ${s}`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <div className="add-subject">
          <input
            value={newSubject}
            onChange={e => setNewSubject(e.target.value)}
            placeholder="Enter a new subject"
            onKeyDown={e => {
              if (e.key === "Enter") addSubject();
            }}
          />

          <button className="primary-button" onClick={addSubject}>
            <Plus size={17} /> Add Subject
          </button>
        </div>
      </div>

      <div className="panel settings-card danger-zone">
        <h3>Data Management</h3>

        <p className="muted">
          Delete all your saved sessions and active timer.
        </p>

        <button
          className="stop-button reset-button"
          onClick={resetAllData}
        >
          <Trash2 size={17} /> Reset All Data
        </button>
      </div>

      <p className="muted settings-note">
        FocusTrack v3.0 · Your personal data is stored in the database.
      </p>
    </section>
  );

  // ==========================================
  // AUTH CHECK
  // ==========================================

  if (!authToken || !currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  const isAdmin = currentUser.role === "admin";

  const pageContent = isAdmin
    ? {
        Dashboard: renderAdminDashboard,
        Settings: renderSettings
      }
    : {
        Dashboard: renderDashboard,
        Tracker: renderTracker,
        Analytics: renderAnalytics,
        History: renderHistory,
        Goals: renderGoals,
        Settings: renderSettings,
        "Notes & PDFs": renderNotesLibrary
      };

  const visibleNavItems = isAdmin
    ? [
        { name: "Dashboard", icon: LayoutDashboard },
        { name: "Settings", icon: Settings }
      ]
    : navItems;

  const currentPage = pageContent[page] ? page : "Dashboard";

  // ==========================================
  // MAIN APP LAYOUT
  // ==========================================

  return (
    <div className={`app ${dark ? "dark" : "light"}`}>
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <Timer size={30} />
          </div>

          <div>
            <h2>FocusTrack</h2>
            <p>
              {isAdmin ? "Admin Panel" : "Study & Phone Time Tracker"}
            </p>
          </div>

          <button
            className="mobile-close"
            onClick={() => setMobileMenu(false)}
          >
            <X />
          </button>
        </div>

        <nav className="navigation">
          {visibleNavItems.map(item => {
            const Icon = item.icon;

            return (
              <button
                key={item.name}
                className={`nav-item ${
                  currentPage === item.name ? "active" : ""
                }`}
                onClick={() => changePage(item.name)}
              >
                <Icon size={21} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar">
              <User />
            </div>

            <div>
              <strong>{currentUser.name}</strong>
              <small>
                {isAdmin ? "Administrator" : "Personal Account"}
              </small>
            </div>
          </div>

          <p className="version">FocusTrack v3.0</p>
        </div>
      </aside>

      {mobileMenu && (
        <button
          className="mobile-backdrop"
          onClick={() => setMobileMenu(false)}
          aria-label="Close menu"
        />
      )}

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              onClick={() => setMobileMenu(true)}
            >
              <Menu />
            </button>

            <h2>{currentPage}</h2>
          </div>

          <div className="top-actions">
            <span>
              <CalendarDays size={18} /> {dateLabel}
            </span>

            <button className="icon-button" onClick={toggleTheme}>
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>

            <div className="avatar">
              <User size={19} />
            </div>
          </div>
        </header>

        {notice && (
          <div className="global-notice">
            {notice}

            <button onClick={() => setNotice("")}>
              <X size={15} />
            </button>
          </div>
        )}

        {loadingData ? (
          <div className="page-content">
            <p className="empty">
              Loading your FocusTrack data...
            </p>
          </div>
        ) : (
          pageContent[currentPage]()
        )}

        <footer>
          FocusTrack © {new Date().getFullYear()} · Make every minute count.
        </footer>
      </main>
    </div>
  );
}


// ==========================================
// REUSABLE COMPONENTS
// ==========================================

function SubjectTracker({ rows, totalTime, totalSessions }) {
  return (
    <section className="panel subject-tracker-panel">
      <div className="panel-heading">
        <h3><BookOpen size={20} /> Subject Study Tracker</h3>
        <span className="status">Individual totals</span>
      </div>

      {rows.length === 0 ? (
        <p className="empty">
          Add a subject in Settings to start tracking it.
        </p>
      ) : (
        <div className="subject-stats-grid">
          {rows.map(item => (
            <div className="subject-stat-card" key={item.name}>
              <div className="subject-stat-header">
                <div>
                  <h4>{item.name}</h4>
                  <p>
                    {item.count} completed{" "}
                    {item.count === 1 ? "session" : "sessions"}
                  </p>
                </div>

                <BookOpen size={21} />
              </div>

              <div className="subject-stat-time">
                {formatTime(item.seconds)}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="subject-total-summary">
        <div>
          <span>Total Study Time</span>
          <strong>{formatTime(totalTime)}</strong>
        </div>

        <div>
          <span>Total Completed Study Sessions</span>
          <strong>{totalSessions}</strong>
        </div>
      </div>

      <p className="muted subject-history-note">
        Your subject totals are calculated from your saved History.
      </p>
    </section>
  );
}


function PageTitle({ title, subtitle }) {
  return (
    <div className="page-title">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}


function StatCard({ icon, title, value, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        {icon}
      </div>

      <div>
        <p>{title}</p>
        <h2>{value}</h2>
      </div>
    </div>
  );
}


function ProgressCard({ icon, title, value, goal, percent, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        {icon}
      </div>

      <div className="stat-content">
        <p>{title}</p>

        <h2>
          {value} <small>/ {goal}</small>
        </h2>

        <div
          className={`progress ${
            color === "pink" ? "pink-progress" : ""
          }`}
        >
          <span style={{ width: `${percent}%` }} />
        </div>

        <small>
          {percent}% {color === "pink" ? "used" : "completed"}
        </small>
      </div>
    </div>
  );
}


function CurrentSession({
  active, elapsed, running, pause, resume, stop
}) {
  return (
    <div className="panel current-panel">
      <div className="panel-heading">
        <h3>Current Session</h3>

        <span className={`status ${running ? "online" : ""}`}>
          {running ? "● Running" : "○ Not Running"}
        </span>
      </div>

      <div className="session-type">
        {active?.activity === "Phone"
          ? <Smartphone />
          : <BookOpen />}

        <span>
          {active ? `${active.activity} Session` : "No Active Session"}
        </span>
      </div>

      {active?.subject && (
        <p className="muted center-text">{active.subject}</p>
      )}

      <div className="big-timer">
        {formatTime(elapsed)}
      </div>

      {active && (
        <div className="timer-buttons">
          {running ? (
            <button className="pause-button" onClick={pause}>
              <Pause size={18} /> Pause
            </button>
          ) : (
            <button className="pause-button" onClick={resume}>
              <Play size={18} /> Resume
            </button>
          )}

          <button className="stop-button" onClick={stop}>
            <Square size={17} /> Stop
          </button>
        </div>
      )}
    </div>
  );
}


function GoalLine({
  title, value, target, percent, pink = false
}) {
  return (
    <div className="goal-line">
      <div>
        <span>{title}</span>
        <b>{value} / {target} ({percent}%)</b>
      </div>

      <div className={`wide-progress ${pink ? "pink-progress" : ""}`}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}


function SessionTable({ sessions }) {
  if (!sessions.length) {
    return (
      <p className="empty">
        No sessions yet. Start tracking your time!
      </p>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Activity</th>
            <th>Start</th>
            <th>End</th>
            <th>Duration</th>
          </tr>
        </thead>

        <tbody>
          {sessions.map(s => (
            <tr key={s.id}>
              <td>
                {s.activity === "Study" ? "📚 Study" : "📱 Phone"}
              </td>

              <td>{formatClock(s.startTime)}</td>
              <td>{formatClock(s.endTime)}</td>
              <td>{formatTime(s.duration)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

