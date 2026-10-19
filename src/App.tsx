import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type Page = "dashboard" | "expenses" | "reports" | "categories" | "settings";
type Category = { id: string; name: string; color: string; icon: string; custom?: boolean; budget?: number };
type Expense = { id: string; amount: number; categoryId: string; date: string; notes: string; type?: "expense" | "income"; isRecurring?: boolean; receiptImage?: string | null };
type User = { id: string; name: string; email: string; password?: string; currency: string };
type Store = { users: User[]; expenses: Record<string, Expense[]>; categories: Record<string, Category[]> };

const COLORS = ["#6366f1", "#f97316", "#0ea5e9", "#ec4899", "#10b981", "#8b5cf6", "#eab308", "#64748b"];
const CATEGORY_SEED = ["Food", "Transport", "Bills", "Shopping", "Health", "Entertainment", "Education", "Other"];
const ICONS = ["fork", "car", "bill", "bag", "heart", "film", "book", "dots"];
const today = new Date();
const dateKey = (d: Date) => d.toISOString().slice(0, 10);
const shiftDate = (days: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return dateKey(d);
};

function seedStore(): Store {
  return { users: [], expenses: {}, categories: {} };
}

function loadStore(): Store {
  try {
    const saved = localStorage.getItem("spendwise-store");
    if (!saved) return seedStore();
    const parsed = JSON.parse(saved);
    if (parsed && parsed.users) {
      parsed.users = parsed.users.filter((u: User) => u.id !== "demo-user");
      if (parsed.expenses) delete parsed.expenses["demo-user"];
      if (parsed.categories) delete parsed.categories["demo-user"];
    }
    return parsed;
  } catch {
    return seedStore();
  }
}

function getAuthHeaders() {
  const token = localStorage.getItem("spendwise-token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function exportToCsv(expenses: Expense[], categories: Category[], currency: string) {
  const headers = ["ID", "Date", "Type", "Category", `Amount (${currency})`, "Notes", "Recurring"];
  const rows = expenses.map((e) => {
    const cat = categories.find((c) => c.id === e.categoryId)?.name || "General";
    return [
      e.id,
      e.date,
      (e.type || "expense").toUpperCase(),
      `"${cat.replace(/"/g, '""')}"`,
      e.amount,
      `"${(e.notes || "").replace(/"/g, '""')}"`,
      e.isRecurring ? "Yes" : "No",
    ];
  });
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `spendwise_records_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const paths: Record<string, ReactNode> = {
  logo: <><path d="M4 13.5 10 7l4 4 6-7" /><path d="M20 9V4h-5" /><path d="M5 20h14" /></>,
  dashboard: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  expenses: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" /><path d="M9 7h6M9 11h6M9 15h3" /></>,
  reports: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></>,
  categories: <><path d="M20 13 11 4H4v7l9 9a2 2 0 0 0 3 0l4-4a2 2 0 0 0 0-3Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  plus: <path d="M12 5v14M5 12h14" />, close: <path d="m6 6 12 12M18 6 6 18" />,
  edit: <><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z" /><path d="m13.5 7 3.5 3.5" /></>,
  trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5" /></>,
  alert: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
  repeat: <><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>,
  trendingUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  moon: <path d="M21 14.5A8 8 0 0 1 9.5 3 9 9 0 1 0 21 14.5Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  arrow: <path d="m9 18 6-6-6-6" />, eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></>,
  camera: <><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" /><circle cx="12" cy="13" r="3" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  check: <path d="m5 12 4 4L19 6" />, user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  fork: <><path d="M7 3v8M4 3v5c0 2 6 2 6 0V3M7 11v10M16 3c-3 3-3 8 0 9v9M16 3v9" /></>,
  car: <><path d="m4 14 2-6h12l2 6v5h-3v-2H7v2H4v-5Z" /><path d="M6 14h12M8 11h.01M16 11h.01" /></>,
  bill: <><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z" /><path d="M9 7h6M9 11h6M9 15h4" /></>,
  bag: <><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 10V6a3 3 0 0 1 6 0v4" /></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
  film: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z" /><path d="M8 7h8M8 11h6" /></>,
  dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
};

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.dots}</svg>;
}

function money(value: number, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(e) => e.stopPropagation()}>{children}</div></div>;
}

function ReceiptLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop" style={{ zIndex: 250 }} onMouseDown={onClose}>
      <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "85vh", display: "flex", flexDirection: "column", alignItems: "center" }} onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "-38px",
            right: "0",
            background: "rgba(255,255,255,0.25)",
            color: "#fff",
            border: "0",
            borderRadius: "50%",
            width: "30px",
            height: "30px",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
          }}
          aria-label="Close receipt preview"
        >
          <Icon name="close" size={16} />
        </button>
        <img
          src={src}
          alt="Receipt preview"
          style={{ maxWidth: "100%", maxHeight: "80vh", borderRadius: "12px", boxShadow: "0 20px 60px rgba(0,0,0,.5)", objectFit: "contain" }}
        />
      </div>
    </div>
  );
}

function ReceiptPreview({ src, onRemove }: { src: string; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className="receipt-preview">
        <img src={src} alt="Receipt thumbnail" onClick={() => setExpanded(true)} />
        <button type="button" className="receipt-remove" onClick={onRemove} aria-label="Remove receipt">
          <Icon name="close" size={14} />
        </button>
      </div>
      {expanded && <ReceiptLightbox src={src} onClose={() => setExpanded(false)} />}
    </>
  );
}

function ExpenseForm({ categories, initial, onSave, onClose }: { categories: Category[]; initial?: Expense; onSave: (e: Omit<Expense, "id">) => void; onClose: () => void }) {
  const [amount, setAmount] = useState(initial ? initial.amount.toString() : "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId || categories[0]?.id || "");
  const [date, setDate] = useState(initial?.date || dateKey(today));
  const [notes, setNotes] = useState(initial?.notes || "");
  const [type, setType] = useState<"expense" | "income">(initial?.type || "expense");
  const [isRecurring, setIsRecurring] = useState(initial?.isRecurring || false);
  const [receiptImage, setReceiptImage] = useState<string | null>(initial?.receiptImage || null);
  const [error, setError] = useState("");

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload a valid image file (PNG, JPG, etc.).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Receipt image must be under 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReceiptImage(reader.result as string);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const parsedAmount = Number(amount);
    if (!amount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      return setError("Please enter a valid amount greater than ₱0.");
    }
    if (parsedAmount > 10000000) {
      return setError("Amount cannot exceed ₱10,000,000.");
    }
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) {
      return setError("Amount can only include up to 2 decimal places (e.g. 150.50).");
    }
    if (!categoryId) {
      return setError("Please choose a category for this transaction.");
    }
    if (!date) {
      return setError("Please specify a valid date.");
    }
    if (notes.trim().length > 150) {
      return setError("Notes cannot exceed 150 characters.");
    }
    onSave({
      amount: Number(parsedAmount.toFixed(2)),
      categoryId,
      date,
      notes: notes.trim(),
      type,
      isRecurring,
      receiptImage,
    });
  };

  return <Modal onClose={onClose}>
    <div className="modal-head">
      <div>
        <span className="eyebrow">{initial ? "Update transaction" : "New transaction"}</span>
        <h2>{initial ? (type === "income" ? "Edit income" : "Edit expense") : (type === "income" ? "Record income" : "Add an expense")}</h2>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
    </div>

    {/* Transaction Type Segment */}
    <div style={{ display: "flex", gap: "8px", background: "var(--soft)", padding: "4px", borderRadius: "12px", marginBottom: "14px" }}>
      <button
        type="button"
        onClick={() => setType("expense")}
        className={`btn ${type === "expense" ? "primary" : "ghost"}`}
        style={{ flex: 1, padding: "8px", fontSize: "13px" }}
      >
        − Expense
      </button>
      <button
        type="button"
        onClick={() => setType("income")}
        className={`btn ${type === "income" ? "primary" : "ghost"}`}
        style={{ flex: 1, padding: "8px", fontSize: "13px", ...(type === "income" ? { background: "#10b981", borderColor: "#10b981", color: "#fff" } : {}) }}
      >
        + Income
      </button>
    </div>

    <form onSubmit={submit} className="form-stack">
      <label className="amount-field">
        <span>Amount ({type === "income" ? "Earned" : "Spent"})</span>
        <div><b>₱</b><input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" /></div>
      </label>
      <div className="form-grid">
        <label><span>Category</span><select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      </div>
      <label>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Notes <small>(optional)</small></span>
          <span style={{ fontSize: "11px", color: notes.length > 150 ? "#e53e3e" : "var(--muted)" }}>{notes.length}/150</span>
        </div>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was this for?" rows={3} maxLength={150} />
      </label>

      {/* Receipt Image Upload */}
      <div>
        <span style={{ fontSize: "13px", fontWeight: 700, display: "block", marginBottom: "7px" }}>Receipt <small style={{ fontWeight: 400 }}>(optional)</small></span>
        {receiptImage ? (
          <ReceiptPreview src={receiptImage} onRemove={() => setReceiptImage(null)} />
        ) : (
          <label className="receipt-upload">
            <Icon name="camera" size={20} />
            <span>Upload receipt photo</span>
            <small>PNG, JPG up to 5 MB</small>
            <input type="file" accept="image/*" onChange={handleReceiptUpload} style={{ display: "none" }} />
          </label>
        )}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", userSelect: "none" }}>
        <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
        <span>Repeat monthly subscription / recurring transaction</span>
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
        <button className="btn primary">{initial ? "Save changes" : (type === "income" ? "Record income" : "Add expense")}</button>
      </div>
    </form>
  </Modal>;
}

function Toast({ text }: { text: string }) {
  return <div className="toast"><span><Icon name="check" size={16} /></span>{text}</div>;
}

function Landing({ onAuth }: { onAuth: (mode: "login" | "signup") => void }) {
  return <div className="landing">
    <header className="land-nav"><Brand /><div><button className="btn ghost" onClick={() => onAuth("login")}>Log in</button><button className="btn primary" onClick={() => onAuth("signup")}>Get started</button></div></header>
    <main>
      <section className="hero">
        <div className="hero-copy"><span className="pill"><span /> Your money, made clear</span><h1>Spend smarter.<br /><em>Live better.</em></h1><p>All your daily spending, organized beautifully. Build better habits with a simple view of where your money goes.</p><div className="hero-actions"><button className="btn primary large" onClick={() => onAuth("signup")}>Start tracking free <Icon name="arrow" /></button><button className="btn secondary large" onClick={() => onAuth("login")}>Sign in to account</button></div><small>Secure PostgreSQL storage · Set up in seconds</small></div>
        <DashboardPreview />
      </section>
      <section className="features"><div className="section-heading"><span className="eyebrow">Everything you need</span><h2>A calmer way to manage money</h2></div><div className="feature-grid">
        {[["expenses","Track effortlessly","Log daily spending in seconds, wherever you are."],["categories","Make it yours","Smart categories turn a messy list into a clear story."],["reports","See the full picture","Simple reports reveal trends without the spreadsheets."],["check","Stay in control","Know exactly where you stand every day of the month."]].map(([icon,title,copy]) => <article key={title}><span className="feature-icon"><Icon name={icon} /></span><h3>{title}</h3><p>{copy}</p></article>)}
      </div></section>
    </main>
    <footer><Brand /><p>Thoughtful money management for everyday life.</p><span>© 2025 SpendWise</span></footer>
  </div>;
}

function Brand() {
  return <div className="brand"><span><Icon name="logo" /></span><b>SpendWise</b></div>;
}

function DashboardPreview() {
  return <div className="preview-wrap"><div className="preview-dot dot-one" /><div className="preview-dot dot-two" /><div className="preview">
    <div className="preview-top"><Brand /><span className="preview-avatar">AM</span></div>
    <p>This month</p><h2>₱24,680</h2><div className="preview-change">↓ 12% from last month</div>
    <div className="preview-chart"><div className="donut"><span>61%</span></div><div className="mini-legend"><span><i className="indigo" />Food <b>₱8,240</b></span><span><i className="orange" />Bills <b>₱6,190</b></span><span><i className="green" />Others <b>₱10,250</b></span></div></div>
    <div className="preview-row"><span className="cat-icon food"><Icon name="fork" /></span><span><b>Lunch at Wildflour</b><small>Food · Today</small></span><strong>−₱485</strong></div>
    <div className="preview-row"><span className="cat-icon car"><Icon name="car" /></span><span><b>Grab ride</b><small>Transport · Today</small></span><strong>−₱240</strong></div>
  </div></div>;
}

function Auth({ mode: initialMode, store, onLogin, onBack }: { mode: "login" | "signup"; store: Store; onLogin: (u: User, next?: Store) => void; onBack: () => void }) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return setError("Please enter your email address.");
    }
    if (!emailRegex.test(cleanEmail)) {
      return setError("Please enter a valid email address (e.g. name@domain.com).");
    }
    if (!password) {
      return setError("Please enter your password.");
    }
    if (password.length < 6) {
      return setError("Password must contain at least 6 characters.");
    }

    if (mode === "signup") {
      const cleanName = name.trim();
      if (!cleanName || cleanName.length < 2) {
        return setError("Please enter your full name (minimum 2 characters).");
      }
      if (password !== confirm) {
        return setError("Passwords do not match. Please verify your password.");
      }
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const res = await fetch("http://localhost:5001/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: cleanEmail, password }),
        });

        if (res.ok) {
          const data = await res.json();
          onLogin(data.user);
          return;
        }

        if (res.status === 401) {
          setError("Incorrect email or password. Please verify your credentials.");
          return;
        }

        // Local cache fallback
        const localUser = store.users.find(
          (u) => u.email.toLowerCase() === cleanEmail.toLowerCase() && u.password === password
        );
        if (localUser) {
          onLogin(localUser);
        } else {
          setError("Incorrect email or password. Please try again.");
        }
      } else {
        const newUser: User = {
          id: crypto.randomUUID(),
          name: name.trim(),
          email: cleanEmail,
          password,
          currency: "PHP",
        };

        const res = await fetch("http://localhost:5001/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newUser),
        });

        if (res.ok) {
          const data = await res.json();
          onLogin(data.user, data.token);
          return;
        }

        if (res.status === 400) {
          const data = await res.json();
          setError(data.error || "An account with this email already exists.");
          return;
        }

        // Local store fallback
        if (store.users.some((u) => u.email.toLowerCase() === cleanEmail.toLowerCase())) {
          return setError("An account with this email already exists.");
        }
        const next: Store = {
          ...store,
          users: [...store.users, newUser],
          expenses: { ...store.expenses, [newUser.id]: [] },
          categories: { ...store.categories, [newUser.id]: [] },
        };
        onLogin(newUser, undefined, next);
      }
    } catch (err) {
      console.warn("Auth network fallback:", err);
      if (mode === "login") {
        const localUser = store.users.find(
          (u) => u.email.toLowerCase() === cleanEmail.toLowerCase() && u.password === password
        );
        if (localUser) onLogin(localUser);
        else setError("Could not reach database. Please check your credentials and connection.");
      } else {
        setError("Could not complete registration. Please check your server connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return <div className="auth-page"><button className="auth-brand" onClick={onBack}><Brand /></button><div className="auth-layout">
    <section className="auth-copy"><span className="pill light"><span /> Personal finance, simplified</span><h1>Small choices.<br /><em>Big difference.</em></h1><p>Join thousands building a healthier relationship with money, one expense at a time.</p><blockquote>“SpendWise helped me finally understand my habits without making money feel overwhelming.”<footer><span>JM</span><b>Jamie M.<small>Tracking since 2024</small></b></footer></blockquote></section>
    <section className="auth-card"><div><span className="eyebrow">{mode === "login" ? "Welcome back" : "Get started"}</span><h2>{mode === "login" ? "Log in to SpendWise" : "Create your account"}</h2><p>{mode === "login" ? "Your spending story is waiting for you." : "Start making sense of your money today."}</p></div>
      <form onSubmit={submit} className="form-stack">
        {mode === "signup" && <label><span>Full name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" required minLength={2} /></label>}
        <label><span>Email address</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
        <label><span>Password</span><div className="password-field"><input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} /><button type="button" onClick={() => setShow(!show)} aria-label="Show password"><Icon name="eye" /></button></div></label>
        {mode === "signup" && <label><span>Confirm password</span><div className="password-field"><input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your password" required minLength={6} /></div></label>}
        {mode === "login" && <div className="remember"><label><input type="checkbox" defaultChecked /> Remember me</label><span>Forgot password?</span></div>}
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary full" disabled={loading}>
          {loading ? (mode === "login" ? "Logging in..." : "Creating account...") : (mode === "login" ? "Log in" : "Create free account")} <Icon name="arrow" />
        </button>
      </form>
      <p className="auth-switch">{mode === "login" ? "New to SpendWise?" : "Already have an account?"} <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>{mode === "login" ? "Create an account" : "Log in"}</button></p>
    </section>
  </div></div>;
}

const navItems: { id: Page; label: string }[] = [
  { id: "dashboard", label: "Overview" }, { id: "expenses", label: "Expenses" }, { id: "reports", label: "Reports" }, { id: "categories", label: "Categories" }, { id: "settings", label: "Settings" },
];

function Shell({ user, page, setPage, logout, children, add }: { user: User; page: Page; setPage: (p: Page) => void; logout: () => void; children: ReactNode; add: () => void }) {
  return <div className="app-shell"><aside><Brand /><nav>{navItems.map((item) => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}><Icon name={item.id === "dashboard" ? "dashboard" : item.id} /><span>{item.label}</span></button>)}</nav><div className="side-user"><span>{user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</span><div><b>{user.name}</b><small>{user.email}</small></div><button onClick={logout} aria-label="Log out"><Icon name="logout" /></button></div></aside>
    <main className="app-main">{children}</main>
    <button className="fab mobile-fab" onClick={add} aria-label="Add transaction"><Icon name="plus" /></button>
    <nav className="mobile-nav">{navItems.slice(0, 4).map((item) => <button key={item.id} className={page === item.id ? "active" : ""} onClick={() => setPage(item.id)}><Icon name={item.id === "dashboard" ? "dashboard" : item.id} /><span>{item.label}</span></button>)}</nav>
  </div>;
}

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <header className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header>;
}

function Dashboard({ user, expenses, categories, add, edit, remove }: { user: User; expenses: Expense[]; categories: Category[]; add: () => void; edit: (e: Expense) => void; remove: (e: Expense) => void }) {
  const currentMonth = dateKey(today).slice(0, 7);
  const monthItems = expenses.filter((e) => e.date.startsWith(currentMonth));
  const monthIncome = monthItems.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const monthSpent = monthItems.filter((e) => !e.type || e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const netSavings = monthIncome - monthSpent;
  const todayTotal = expenses.filter((e) => e.date === dateKey(today) && (!e.type || e.type === "expense")).reduce((s, e) => s + e.amount, 0);
  const byCat = categories.map((c) => ({ ...c, total: monthItems.filter((e) => e.categoryId === c.id && (!e.type || e.type === "expense")).reduce((s, e) => s + e.amount, 0) })).sort((a, b) => b.total - a.total);
  const top = byCat[0];
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const maxCat = Math.max(...byCat.map((c) => c.total), 1);
  const hour = new Date().getHours();
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const budgetAlerts = categories
    .filter((c) => c.budget && c.budget > 0)
    .map((c) => {
      const spent = monthItems.filter((e) => e.categoryId === c.id && (!e.type || e.type === "expense")).reduce((s, e) => s + e.amount, 0);
      const pct = Math.round((spent / (c.budget || 1)) * 100);
      return { ...c, spent, pct, isOver: spent > (c.budget || 0) };
    })
    .filter((c) => c.pct >= 80)
    .sort((a, b) => b.pct - a.pct);

  return <>
    <PageHeader eyebrow={new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric" })} title={`Good ${hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, ${user.name.split(" ")[0]}`} description="Here’s the story your finances tell this month." action={<button className="btn primary desktop-add" onClick={add}><Icon name="plus" /> Add transaction</button>} />
    <section className="summary-grid">
      <article className="summary-card featured">
        <span>Net Balance (This month)</span>
        <strong style={{ color: netSavings >= 0 ? "#10b981" : "#ef4444" }}>
          {netSavings >= 0 ? "+" : "−"}{money(Math.abs(netSavings), user.currency)}
        </strong>
        <small><b style={{ color: netSavings >= 0 ? "#10b981" : "#ef4444" }}>{netSavings >= 0 ? "✓ In the green" : "⚠ Deficit"}</b> this month</small>
        <div className="sparkline"><i /><i /><i /><i /><i /><i /><i /><i /></div>
      </article>
      <article className="summary-card">
        <span>Total Income</span>
        <strong style={{ color: "#10b981" }}>+{money(monthIncome, user.currency)}</strong>
        <small>{monthItems.filter((e) => e.type === "income").length} income entries</small>
      </article>
      <article className="summary-card">
        <span>Total Expenses</span>
        <strong>−{money(monthSpent, user.currency)}</strong>
        <small>Spent today: {money(todayTotal, user.currency)}</small>
      </article>
      <article className="summary-card">
        <span>Top Category</span>
        <strong>{top?.name || "—"}</strong>
        <small>{top ? money(top.total, user.currency) : "No spending yet"}</small>
      </article>
    </section>

    {budgetAlerts.length > 0 && (
      <section className="budget-alerts-banner">
        <div className="budget-alerts-head">
          <span className="alert-badge"><Icon name="alert" size={15} /> Budget Alerts ({budgetAlerts.length})</span>
          <small>Categories close to or exceeding your monthly spending limits</small>
        </div>
        <div className="budget-alerts-grid">
          {budgetAlerts.map((c) => (
            <div key={c.id} className={`budget-alert-card ${c.isOver ? "danger" : "warning"}`}>
              <div className="alert-header">
                <span><i style={{ background: c.color }} /> {c.name}</span>
                <span className="alert-pct">{c.pct}%</span>
              </div>
              <div className="alert-bar">
                <div style={{ width: `${Math.min(100, c.pct)}%`, background: c.isOver ? "#ef4444" : "#f59e0b" }} />
              </div>
              <div className="alert-sub">
                <span>{money(c.spent, user.currency)} of {money(c.budget || 0, user.currency)}</span>
                <span className="alert-status">{c.isOver ? "⚠ Exceeded" : "Near limit"}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    )}

    <section className="dashboard-grid">
      <article className="panel spending-panel"><div className="panel-head"><div><span className="eyebrow">Breakdown</span><h2>Spending by category</h2></div><span className="muted">This month</span></div>
        {monthItems.length ? <div className="category-chart"><div className="big-donut" style={{ background: `conic-gradient(${byCat.filter(c=>c.total).map((c,i,a)=>`${c.color} ${a.slice(0,i).reduce((s,x)=>s+x.total,0)/(monthSpent||1)*100}% ${a.slice(0,i+1).reduce((s,x)=>s+x.total,0)/(monthSpent||1)*100}%`).join(",")})` }}><span><small>Total Spent</small>{money(monthSpent, user.currency)}</span></div><div className="category-bars">{byCat.filter((c) => c.total).slice(0, 5).map((c) => <div key={c.id}><div><span><i style={{ background: c.color }} />{c.name}</span><b>{money(c.total, user.currency)}</b></div><progress max={maxCat} value={c.total} style={{ accentColor: c.color }} /></div>)}</div></div> : <Empty onAdd={add} />}
      </article>
      <article className="panel transactions"><div className="panel-head"><div><span className="eyebrow">Activity</span><h2>Recent transactions</h2></div></div>
        {recent.length ? <div>{recent.map((e) => <ExpenseRow key={e.id} expense={e} category={categories.find((c) => c.id === e.categoryId)} currency={user.currency} onEdit={() => edit(e)} onDelete={() => remove(e)} onViewReceipt={setViewingReceipt} />)}</div> : <Empty onAdd={add} />}
      </article>
    </section>
    {viewingReceipt && <ReceiptLightbox src={viewingReceipt} onClose={() => setViewingReceipt(null)} />}
  </>;
}

function ExpenseRow({ expense, category, currency, onEdit, onDelete, onViewReceipt }: { expense: Expense; category?: Category; currency: string; onEdit: () => void; onDelete: () => void; onViewReceipt?: (src: string) => void }) {
  const isIncome = expense.type === "income";
  return <div className="expense-row">
    <span className="cat-icon" style={{ background: isIncome ? "rgba(16, 185, 129, 0.14)" : `${category?.color}18`, color: isIncome ? "#10b981" : category?.color }}>
      <Icon name={isIncome ? "trendingUp" : category?.icon || "dots"} />
    </span>
    <div className="expense-info">
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <b>{expense.notes || category?.name || (isIncome ? "Income" : "Expense")}</b>
        {expense.isRecurring && (
          <span className="pill light" style={{ fontSize: "10px", padding: "1px 6px" }}>
            <Icon name="repeat" size={10} /> Monthly
          </span>
        )}
        {expense.receiptImage && (
          <button
            type="button"
            className="receipt-badge-btn"
            onClick={(e) => { e.stopPropagation(); onViewReceipt?.(expense.receiptImage!); }}
            title="View attached receipt photo"
          >
            <Icon name="camera" size={10} /> Receipt
          </button>
        )}
      </div>
      <small>{category?.name} · {new Date(`${expense.date}T12:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}</small>
    </div>
    <strong style={{ color: isIncome ? "#10b981" : undefined }}>
      {isIncome ? "+" : "−"}{money(expense.amount, currency)}
    </strong>
    <div className="row-actions">
      <button onClick={onEdit} aria-label="Edit"><Icon name="edit" size={17} /></button>
      <button onClick={onDelete} aria-label="Delete"><Icon name="trash" size={17} /></button>
    </div>
  </div>;
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return <div className="empty"><div><Icon name="expenses" /></div><h3>No transactions yet</h3><p>Log your first expense or income to start tracking your cashflow.</p><button className="btn primary" onClick={onAdd}><Icon name="plus" /> Add transaction</button></div>;
}

function ExpensesPage({ user, expenses, categories, add, edit, remove }: { user: User; expenses: Expense[]; categories: Category[]; add: () => void; edit: (e: Expense) => void; remove: (e: Expense) => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">("all");
  const [datePreset, setDatePreset] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [sort, setSort] = useState("newest");
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const curMonthKey = dateKey(today).slice(0, 7);
    return [...expenses].filter((e) => {
      const matchSearch = e.notes.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === "all" || e.categoryId === category;
      const matchType = typeFilter === "all" || (e.type || "expense") === typeFilter;
      
      let matchDate = true;
      if (datePreset === "thisMonth") {
        matchDate = e.date.startsWith(curMonthKey);
      } else if (datePreset === "last7") {
        matchDate = e.date >= shiftDate(7);
      } else if (datePreset === "last30") {
        matchDate = e.date >= shiftDate(30);
      } else if (datePreset === "thisQuarter") {
        matchDate = e.date >= shiftDate(90);
      } else if (datePreset === "custom") {
        if (customStart && e.date < customStart) matchDate = false;
        if (customEnd && e.date > customEnd) matchDate = false;
      }

      return matchSearch && matchCategory && matchType && matchDate;
    }).sort((a,b) => sort === "newest" ? b.date.localeCompare(a.date) : sort === "oldest" ? a.date.localeCompare(b.date) : sort === "high" ? b.amount-a.amount : a.amount-b.amount);
  }, [expenses, search, category, typeFilter, datePreset, customStart, customEnd, sort]);

  const totalSpent = filtered.filter(e => !e.type || e.type === "expense").reduce((s,e) => s + e.amount, 0);
  const totalIncome = filtered.filter(e => e.type === "income").reduce((s,e) => s + e.amount, 0);

  return <>
    <PageHeader
      eyebrow="Transactions"
      title="All transactions"
      description={`${filtered.length} records · Spent: ${money(totalSpent, user.currency)} · Income: ${money(totalIncome, user.currency)}`}
      action={
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn secondary" onClick={() => exportToCsv(filtered, categories, user.currency)} title="Export transaction list as CSV spreadsheet">
            <Icon name="download" size={16} /> Export CSV
          </button>
          <button className="btn primary desktop-add" onClick={add}>
            <Icon name="plus" /> Add transaction
          </button>
        </div>
      }
    />
    <div style={{ display: "grid", gap: "10px", marginBottom: "14px" }}>
      <div className="filters" style={{ marginBottom: 0 }}>
        <label className="search"><Icon name="search" /><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search notes..." /></label>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
          <option value="all">All types</option>
          <option value="expense">Expenses only</option>
          <option value="income">Income only</option>
        </select>
        <select value={category} onChange={(e)=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={sort} onChange={(e)=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="high">Highest amount</option><option value="low">Lowest amount</option></select>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div className="date-preset-pills">
          {[
            { id: "all", label: "All time" },
            { id: "thisMonth", label: "This month" },
            { id: "last7", label: "Last 7 days" },
            { id: "last30", label: "Last 30 days" },
            { id: "thisQuarter", label: "This quarter" },
            { id: "custom", label: "Custom range" },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              className={`date-pill ${datePreset === p.id ? "active" : ""}`}
              onClick={() => setDatePreset(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {datePreset === "custom" && (
          <div className="custom-date-inputs">
            <span>From:</span>
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <span>To:</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        )}
      </div>
    </div>
    <section className="panel expense-list">
      <div className="table-head"><span>Transaction</span><span>Category</span><span>Date</span><span>Amount</span><span /></div>
      {filtered.length ? filtered.map(e => {
        const c = categories.find(x => x.id === e.categoryId);
        const isIncome = e.type === "income";
        return <div className="table-row" key={e.id}>
          <div className="table-note">
            <span className="cat-icon" style={{ background: isIncome ? "rgba(16, 185, 129, 0.14)" : `${c?.color}18`, color: isIncome ? "#10b981" : c?.color }}>
              <Icon name={isIncome ? "trendingUp" : c?.icon || "dots"} />
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <b>{e.notes || (isIncome ? "Income" : "Untitled expense")}</b>
                {e.receiptImage && (
                  <button
                    type="button"
                    className="receipt-badge-btn"
                    onClick={(ev) => { ev.stopPropagation(); setViewingReceipt(e.receiptImage!); }}
                    title="View attached receipt photo"
                  >
                    <Icon name="camera" size={10} /> Receipt
                  </button>
                )}
              </div>
              {e.isRecurring && <small style={{ display: "block", color: "var(--primary)" }}>Monthly recurring</small>}
            </div>
          </div>
          <span className="category-badge" style={{ background: `${c?.color}15`, color: c?.color }}>{c?.name || "General"}</span>
          <span>{new Date(`${e.date}T12:00`).toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"})}</span>
          <strong style={{ color: isIncome ? "#10b981" : undefined }}>{isIncome ? "+" : "−"}{money(e.amount, user.currency)}</strong>
          <div className="row-actions">
            <button onClick={() => edit(e)} aria-label="Edit"><Icon name="edit" size={17} /></button>
            <button onClick={() => remove(e)} aria-label="Delete"><Icon name="trash" size={17} /></button>
          </div>
        </div>;
      }) : <Empty onAdd={add}/>}
    </section>
    {viewingReceipt && <ReceiptLightbox src={viewingReceipt} onClose={() => setViewingReceipt(null)} />}
  </>;
}

function Reports({ user, expenses, categories }: { user: User; expenses: Expense[]; categories: Category[] }) {
  const current = dateKey(today).slice(0,7);
  const [month, setMonth] = useState(current);
  const [rangePreset, setRangePreset] = useState<"month" | "last3" | "last6" | "year" | "all">("month");

  const selected = useMemo(() => {
    return expenses.filter((e) => {
      if (rangePreset === "month") return e.date.startsWith(month);
      if (rangePreset === "last3") return e.date >= shiftDate(90);
      if (rangePreset === "last6") return e.date >= shiftDate(180);
      if (rangePreset === "year") return e.date.startsWith(today.getFullYear().toString());
      if (rangePreset === "all") return true;
      return true;
    });
  }, [expenses, rangePreset, month]);

  const totalSpent = selected.filter(e => !e.type || e.type === "expense").reduce((s,e) => s + e.amount, 0);
  const totalIncome = selected.filter(e => e.type === "income").reduce((s,e) => s + e.amount, 0);
  const net = totalIncome - totalSpent;

  const grouped = categories.map(c => ({
    ...c,
    total: selected.filter(e => e.categoryId === c.id && (!e.type || e.type === "expense")).reduce((s,e) => s + e.amount, 0)
  })).sort((a,b) => b.total - a.total);

  const months = Array.from({length: 6}, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
    const key = dateKey(d).slice(0, 7);
    return {
      key,
      label: d.toLocaleDateString("en-PH", { month: "short" }),
      total: expenses.filter(e => e.date.startsWith(key) && (!e.type || e.type === "expense")).reduce((s, e) => s + e.amount, 0)
    };
  });
  const max = Math.max(...months.map(m => m.total), 1);

  return <>
    <PageHeader
      eyebrow="Insights"
      title="Reports & analytics"
      description="Understand your cashflow, track budget limits, and analyze your spending trends."
      action={
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <div className="date-preset-pills">
            <button type="button" className={`date-pill ${rangePreset === "month" ? "active" : ""}`} onClick={() => setRangePreset("month")}>Month</button>
            <button type="button" className={`date-pill ${rangePreset === "last3" ? "active" : ""}`} onClick={() => setRangePreset("last3")}>90 Days</button>
            <button type="button" className={`date-pill ${rangePreset === "last6" ? "active" : ""}`} onClick={() => setRangePreset("last6")}>6 Months</button>
            <button type="button" className={`date-pill ${rangePreset === "year" ? "active" : ""}`} onClick={() => setRangePreset("year")}>This Year</button>
          </div>
          {rangePreset === "month" && (
            <input className="month-picker" type="month" value={month} onChange={e => setMonth(e.target.value)} />
          )}
        </div>
      }
    />
    <section className="report-highlights">
      <article>
        <span>Net Savings</span>
        <strong style={{ color: net >= 0 ? "#10b981" : "#ef4444" }}>{net >= 0 ? "+" : "−"}{money(Math.abs(net), user.currency)}</strong>
        <small>{net >= 0 ? "Savings surplus" : "Deficit in this period"}</small>
      </article>
      <article>
        <span>Total Spending</span>
        <strong>{money(totalSpent, user.currency)}</strong>
        <small>{selected.filter(e => !e.type || e.type === "expense").length} expense records</small>
      </article>
      <article>
        <span>Total Income</span>
        <strong style={{ color: "#10b981" }}>+{money(totalIncome, user.currency)}</strong>
        <small>{selected.filter(e => e.type === "income").length} income entries</small>
      </article>
    </section>
    <section className="reports-grid">
      <article className="panel">
        <div className="panel-head"><div><span className="eyebrow">6 month trend</span><h2>Monthly spending comparison</h2></div></div>
        <div className="bar-chart">
          {months.map(m => <div key={m.key}><span>{m.total ? money(m.total, user.currency) : ""}</span><i style={{ height: `${Math.max(4, (m.total / max) * 100)}%` }} className={m.key === current ? "current" : ""} /><small>{m.label}</small></div>)}
        </div>
      </article>
      <article className="panel">
        <div className="panel-head"><div><span className="eyebrow">Distribution & Budgets</span><h2>Category totals vs budgets</h2></div></div>
        <div className="report-categories">
          {grouped.filter(c => c.total || (c.budget && c.budget > 0)).map(c => {
            const hasBudget = c.budget && c.budget > 0;
            const pctBudget = hasBudget ? Math.round((c.total / (c.budget || 1)) * 100) : null;
            const isOver = hasBudget && c.total > (c.budget || 0);

            return <div key={c.id}>
              <div>
                <span><i style={{ background: c.color }} /><b>{c.name}</b></span>
                <span style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <b>{money(c.total, user.currency)}</b>
                  {hasBudget ? (
                    <small style={{ color: isOver ? "#ef4444" : pctBudget! >= 80 ? "#f59e0b" : "var(--muted)", fontWeight: isOver ? 700 : 400 }}>
                      of {money(c.budget || 0, user.currency)} ({pctBudget}%)
                    </small>
                  ) : (
                    <small>{totalSpent ? Math.round((c.total / totalSpent) * 100) : 0}% of spend</small>
                  )}
                </span>
              </div>
              <div style={{ width: "100%", height: "6px", background: "var(--soft)", borderRadius: "99px", overflow: "hidden" }}>
                <div style={{
                  width: `${hasBudget ? Math.min(100, pctBudget!) : (totalSpent ? Math.min(100, Math.round((c.total / totalSpent) * 100)) : 0)}%`,
                  height: "100%",
                  background: isOver ? "#ef4444" : pctBudget && pctBudget >= 80 ? "#f59e0b" : c.color,
                  borderRadius: "99px",
                  transition: "width 0.3s ease"
                }} />
              </div>
              {isOver && (
                <small style={{ color: "#ef4444", fontWeight: 700, display: "block", marginTop: "3px" }}>
                  ⚠ Over budget by {money(c.total - (c.budget || 0), user.currency)}
                </small>
              )}
            </div>;
          })}
          {!totalSpent && <div className="mini-empty">No spending in this selected period.</div>}
        </div>
      </article>
    </section>
  </>;
}

function Categories({ user, categories, expenses, onSave, onDelete }: { user: User; categories: Category[]; expenses: Expense[]; onSave: (c: Category) => void; onDelete: (c: Category) => void }) {
  const [editing, setEditing] = useState<Category | null>(null);
  const [adding, setAdding] = useState(false);

  return <>
    <PageHeader eyebrow="Organization" title="Categories & budgets" description="Set spending limits and shape SpendWise around how you live." action={<button className="btn primary" onClick={() => setAdding(true)}><Icon name="plus" /> New category</button>} />
    <div className="category-grid">
      {categories.map((c) => {
        const total = expenses.filter((e) => e.categoryId === c.id && (!e.type || e.type === "expense")).reduce((s, e) => s + e.amount, 0);
        const hasBudget = c.budget && c.budget > 0;
        const isOver = hasBudget && total > (c.budget || 0);
        const pct = hasBudget ? Math.round((total / (c.budget || 1)) * 100) : 0;

        return <article className="category-card" key={c.id}>
          <div className="category-card-head">
            <span className="cat-icon large" style={{ background: `${c.color}18`, color: c.color }}>
              <Icon name={c.icon} size={22} />
            </span>
            {c.custom && (
              <div className="row-actions">
                <button onClick={() => setEditing(c)} aria-label="Edit category" title="Edit category">
                  <Icon name="edit" size={16} />
                </button>
                <button onClick={() => onDelete(c)} aria-label="Delete category" title="Delete category">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="category-card-body">
            <h3>{c.name}</h3>
            <p className="category-card-spent">
              <b>{money(total, user.currency)}</b> spent
            </p>

            {hasBudget ? (
              <div className="category-budget-wrap">
                <div className="category-budget-meta">
                  <span>Budget: <b>{money(c.budget || 0, user.currency)}</b></span>
                  <span style={{ color: isOver ? "#ef4444" : pct >= 80 ? "#f59e0b" : "var(--muted)", fontWeight: 700 }}>
                    {pct}%
                  </span>
                </div>
                <div className="category-budget-bar">
                  <div style={{
                    width: `${Math.min(100, pct)}%`,
                    background: isOver ? "#ef4444" : pct >= 80 ? "#f59e0b" : c.color,
                  }} />
                </div>
                {isOver && (
                  <div className="category-budget-alert">
                    <Icon name="alert" size={12} /> Over budget by {money(total - (c.budget || 0), user.currency)}
                  </div>
                )}
              </div>
            ) : (
              <small style={{ color: "var(--muted)", display: "block", marginTop: "4px", fontSize: "11px" }}>
                No budget limit set
              </small>
            )}
          </div>
        </article>;
      })}
    </div>
    {(adding || editing) && (
      <CategoryModal
        categories={categories}
        currency={user.currency}
        initial={editing || undefined}
        onClose={() => { setAdding(false); setEditing(null); }}
        onSave={(c) => { onSave(c); setAdding(false); setEditing(null); }}
      />
    )}
  </>;
}

function CategoryModal({ initial, categories, currency, onClose, onSave }: { initial?: Category; categories: Category[]; currency: string; onClose: () => void; onSave: (c: Category) => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [budget, setBudget] = useState(initial?.budget ? initial.budget.toString() : "");
  const [color, setColor] = useState(initial?.color || COLORS[0]);
  const [icon, setIcon] = useState(initial?.icon || "dots");
  const [error, setError] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = name.trim();
    if (!trimmed) {
      return setError("Please enter a category name.");
    }
    if (trimmed.length < 2) {
      return setError("Category name must be at least 2 characters.");
    }
    if (trimmed.length > 25) {
      return setError("Category name cannot exceed 25 characters.");
    }
    const duplicate = categories.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase() && c.id !== initial?.id
    );
    if (duplicate) {
      return setError(`A category named "${trimmed}" already exists.`);
    }
    onSave({
      id: initial?.id || crypto.randomUUID(),
      name: trimmed,
      color,
      icon,
      custom: true,
      budget: Number(budget) || 0,
    });
  };

  return <Modal onClose={onClose}>
    <div className="modal-head"><div><span className="eyebrow">Personalize</span><h2>{initial ? "Edit category" : "New category"}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="close" /></button></div>
    <form className="form-stack" onSubmit={submit}>
      <label><span>Category name</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Subscriptions" maxLength={25} /></label>
      <label><span>Monthly Budget ({currency}) <small>(optional limit)</small></span><input type="number" min="0" step="50" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. 5000" /></label>
      <label><span>Color</span><div className="color-picker">{COLORS.map((c) => <button type="button" key={c} onClick={() => setColor(c)} className={color === c ? "selected" : ""} style={{ background: c }} aria-label={`Select ${c}`} />)}</div></label>
      <label><span>Icon</span><div className="icon-picker">{ICONS.map((i) => <button type="button" key={i} onClick={() => setIcon(i)} className={icon === i ? "selected" : ""} aria-label={`Icon ${i}`}><Icon name={i} /></button>)}</div></label>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={onClose}>Cancel</button><button className="btn primary">Save category</button></div>
    </form>
  </Modal>;
}

function Settings({ user, onUpdate, onDelete, dark, setDark }: { user: User; onUpdate: (u: User) => void; onDelete: () => void; dark: boolean; setDark: (d: boolean) => void }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submitProfile = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    if (cleanName.length < 2) {
      return setError("Full name must be at least 2 characters.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return setError("Please enter a valid email address.");
    }
    if (password && password.length < 6) {
      return setError("New password must contain at least 6 characters.");
    }
    onUpdate({ ...user, name: cleanName, email: cleanEmail, password: password || user.password });
    setPassword("");
  };

  return <>
    <PageHeader eyebrow="Your account" title="Settings" description="Manage your profile and SpendWise preferences." />
    <div className="settings-grid">
      <section className="panel settings-section">
        <div className="settings-title"><span><Icon name="user" /></span><div><h2>Profile details</h2><p>Update your personal information.</p></div></div>
        <form className="form-stack" onSubmit={submitProfile}>
          <div className="form-grid">
            <label><span>Full name</span><input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} /></label>
            <label><span>Email address</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          </div>
          <label><span>New password <small>(leave blank to keep current, min 6 characters)</small></span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" minLength={6} /></label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn primary align-start">Save changes</button>
        </form>
      </section>
      <section className="panel settings-section">
        <div className="settings-title"><span><Icon name="settings" /></span><div><h2>Preferences</h2><p>Make the experience feel like yours.</p></div></div>
        <div className="preference-row"><div><b>Currency</b><small>Used across all totals</small></div><select value={user.currency} onChange={(e) => onUpdate({ ...user, currency: e.target.value })}><option value="PHP">PHP — Philippine peso</option><option value="USD">USD — US dollar</option><option value="EUR">EUR — Euro</option></select></div>
        <div className="preference-row"><div><b>Appearance</b><small>Choose your preferred theme</small></div><button className="theme-toggle" onClick={() => setDark(!dark)}><span className={!dark ? "active" : ""}><Icon name="sun" size={16} /> Light</span><span className={dark ? "active" : ""}><Icon name="moon" size={16} /> Dark</span></button></div>
      </section>
      <section className="panel settings-section danger-zone">
        <div><h2>Delete account</h2><p>Permanently delete your account and all financial records from PostgreSQL.</p></div>
        <button className="btn danger" onClick={onDelete}>Delete my account</button>
      </section>
    </div>
  </>;
}

export default function App() {
  const [store, setStore] = useState<Store>(loadStore);
  const [userId, setUserId] = useState<string | null>(() => {
    const saved = localStorage.getItem("spendwise-user");
    return saved === "demo-user" ? null : saved;
  });
  const [screen, setScreen] = useState<"landing" | "auth">("landing");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [page, setPage] = useState<Page>("dashboard");
  const [editing, setEditing] = useState<Expense | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [toast, setToast] = useState("");
  const [dark, setDark] = useState(() => localStorage.getItem("spendwise-theme") === "dark");

  const user = store.users.find((u) => u.id === userId);
  const expenses = user ? store.expenses[user.id] || [] : [];
  const categories = user ? store.categories[user.id] || [] : [];

  useEffect(() => { localStorage.setItem("spendwise-store", JSON.stringify(store)); }, [store]);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("spendwise-theme", dark ? "dark" : "light"); }, [dark]);

  // Keyboard shortcuts: 'N' to add transaction, 'Esc' to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isInput = activeTag === "input" || activeTag === "textarea" || activeTag === "select";

      if ((e.key === "n" || e.key === "N") && !isInput && !adding && !editing && user) {
        e.preventDefault();
        setAdding(true);
      }
      if (e.key === "Escape") {
        if (adding) setAdding(false);
        if (editing) setEditing(null);
        if (deleting) setDeleting(null);
        if (deletingCategory) setDeletingCategory(null);
        if (loggingOut) setLoggingOut(false);
        if (deletingAccount) setDeletingAccount(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [adding, editing, deleting, deletingCategory, loggingOut, deletingAccount, user]);

  // Load live data from PostgreSQL database via backend
  useEffect(() => {
    if (!userId) return;
    fetch(`http://localhost:5001/api/store/${userId}`, {
      headers: getAuthHeaders(),
    })
      .then((res) => {
        if (res.status === 404 || res.status === 401) {
          // Stale session, reset cleanly
          setUserId(null);
          localStorage.removeItem("spendwise-user");
          localStorage.removeItem("spendwise-token");
          setScreen("landing");
          return null;
        }
        if (!res.ok) throw new Error("Server error");
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        if (data && data.categories) {
          setStore((prev) => ({
            ...prev,
            expenses: { ...prev.expenses, [userId]: data.expenses || [] },
            categories: { ...prev.categories, [userId]: data.categories || [] },
            users: data.user
              ? prev.users.some((u) => u.id === data.user.id)
                ? prev.users.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u))
                : [...prev.users, data.user]
              : prev.users,
          }));
        }
      })
      .catch((err) => {
        console.warn("PostgreSQL server offline or sync error:", err);
      });
  }, [userId]);

  const notify = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 2800); };
  
  const login = (u: User, token?: string, next?: Store) => {
    if (next) setStore(next);
    if (token) localStorage.setItem("spendwise-token", token);
    setUserId(u.id);
    localStorage.setItem("spendwise-user", u.id);
    setPage("dashboard");
    notify(`Welcome back, ${u.name}!`);
  };

  const confirmLogout = () => {
    setUserId(null);
    localStorage.removeItem("spendwise-user");
    localStorage.removeItem("spendwise-token");
    setLoggingOut(false);
    setScreen("landing");
    notify("You have been signed out.");
  };

  const saveExpense = async (value: Omit<Expense, "id">) => {
    if (!user) return;
    const targetId = editing ? editing.id : crypto.randomUUID();
    const item: Expense = { ...value, id: targetId };
    const list = editing ? expenses.map((e) => (e.id === editing.id ? item : e)) : [item, ...expenses];

    // Optimistic state update
    setStore({ ...store, expenses: { ...store.expenses, [user.id]: list } });
    notify(editing ? "Transaction updated successfully" : (item.type === "income" ? "Income recorded successfully" : "Expense added successfully"));
    setEditing(null);
    setAdding(false);

    // Persist to PostgreSQL database
    try {
      await fetch("http://localhost:5001/api/expenses", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...item, userId: user.id }),
      });
    } catch (err) {
      console.error("Failed to save expense in PostgreSQL:", err);
    }
  };

  const deleteExpense = async () => {
    if (!user || !deleting) return;
    const targetId = deleting.id;
    setStore({ ...store, expenses: { ...store.expenses, [user.id]: expenses.filter((e) => e.id !== targetId) } });
    setDeleting(null);
    notify("Transaction removed from records");

    // Delete in PostgreSQL database
    try {
      await fetch(`http://localhost:5001/api/expenses/${targetId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error("Failed to delete expense in PostgreSQL:", err);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!user || !deletingCategory) return;
    const targetId = deletingCategory.id;
    setStore({ ...store, categories: { ...store.categories, [user.id]: categories.filter((x) => x.id !== targetId) } });
    setDeletingCategory(null);
    notify("Category deleted successfully");

    try {
      await fetch(`http://localhost:5001/api/categories/${targetId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error("Failed to delete category in PostgreSQL:", err);
    }
  };

  const updateUserProfile = async (u: User) => {
    setStore({
      ...store,
      users: store.users.map((x) => (x.id === u.id ? u : x)),
    });
    notify("Settings saved successfully");
    try {
      await fetch(`http://localhost:5001/api/users/${u.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(u),
      });
    } catch (err) {
      console.error("Failed to update user in PostgreSQL:", err);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!user) return;
    try {
      await fetch(`http://localhost:5001/api/users/${user.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
    } catch (err) {
      console.error("Failed to delete user in PostgreSQL:", err);
    }
    setStore({ ...store, users: store.users.filter((x) => x.id !== user.id) });
    setDeletingAccount(false);
    setUserId(null);
    localStorage.removeItem("spendwise-user");
    localStorage.removeItem("spendwise-token");
    setScreen("landing");
    notify("Account and all data deleted.");
  };

  if (!user) {
    if (screen === "auth") return <Auth mode={authMode} store={store} onLogin={login} onBack={() => setScreen("landing")} />;
    return <Landing onAuth={(mode) => { setAuthMode(mode); setScreen("auth"); }} />;
  }

  return (
    <Shell user={user} page={page} setPage={setPage} logout={() => setLoggingOut(true)} add={() => setAdding(true)}>
      {page === "dashboard" && <Dashboard user={user} expenses={expenses} categories={categories} add={() => setAdding(true)} edit={setEditing} remove={setDeleting} />}
      {page === "expenses" && <ExpensesPage user={user} expenses={expenses} categories={categories} add={() => setAdding(true)} edit={setEditing} remove={setDeleting} />}
      {page === "reports" && <Reports user={user} expenses={expenses} categories={categories} />}
      {page === "categories" && (
        <Categories
          user={user}
          categories={categories}
          expenses={expenses}
          onSave={(c) => {
            setStore({ ...store, categories: { ...store.categories, [user.id]: categories.some((x) => x.id === c.id) ? categories.map((x) => (x.id === c.id ? c : x)) : [...categories, c] } });
            notify("Category saved successfully");
            fetch("http://localhost:5001/api/categories", {
              method: "POST",
              headers: getAuthHeaders(),
              body: JSON.stringify({ ...c, userId: user.id }),
            }).catch(console.error);
          }}
          onDelete={(c) => setDeletingCategory(c)}
        />
      )}
      {page === "settings" && (
        <Settings
          user={user}
          dark={dark}
          setDark={setDark}
          onUpdate={updateUserProfile}
          onDelete={() => setDeletingAccount(true)}
        />
      )}

      {/* Add or Edit Transaction Modal */}
      {(adding || editing) && (
        <ExpenseForm
          categories={categories}
          initial={editing || undefined}
          onSave={saveExpense}
          onClose={() => { setAdding(false); setEditing(null); }}
        />
      )}

      {/* Expense Delete Confirmation Modal */}
      {deleting && (
        <Modal onClose={() => setDeleting(null)}>
          <div className="confirm-dialog">
            <span className="danger-icon"><Icon name="trash" /></span>
            <h2>Delete this {deleting.type === "income" ? "income entry" : "expense"}?</h2>
            <p>
              This will permanently remove “{deleting.notes || (deleting.type === "income" ? "Income" : "Expense")}” ({money(deleting.amount, user.currency)}) from your records and database.
            </p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setDeleting(null)}>Cancel</button>
              <button className="btn danger" onClick={deleteExpense}>Delete transaction</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Category Delete Confirmation / Warning Modal */}
      {deletingCategory && (
        <Modal onClose={() => setDeletingCategory(null)}>
          <div className="confirm-dialog">
            {expenses.some((e) => e.categoryId === deletingCategory.id) ? (
              <>
                <span className="danger-icon" style={{ background: "#fff7ed", color: "#ea580c" }}><Icon name="alert" /></span>
                <h2>Category is currently in use</h2>
                <p>
                  “{deletingCategory.name}” is linked to {expenses.filter((e) => e.categoryId === deletingCategory.id).length} transaction(s). Please edit or delete those transactions before removing this category.
                </p>
                <div className="modal-actions">
                  <button className="btn primary" onClick={() => setDeletingCategory(null)}>Got it</button>
                </div>
              </>
            ) : (
              <>
                <span className="danger-icon"><Icon name="trash" /></span>
                <h2>Delete “{deletingCategory.name}”?</h2>
                <p>This custom category and its budget will be removed from your list and database.</p>
                <div className="modal-actions">
                  <button className="btn secondary" onClick={() => setDeletingCategory(null)}>Cancel</button>
                  <button className="btn danger" onClick={confirmDeleteCategory}>Delete category</button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Logout Confirmation Modal */}
      {loggingOut && (
        <Modal onClose={() => setLoggingOut(false)}>
          <div className="confirm-dialog">
            <span className="danger-icon" style={{ background: "rgba(99, 102, 241, 0.12)", color: "var(--primary)" }}>
              <Icon name="logout" />
            </span>
            <h2>Log out of SpendWise?</h2>
            <p>You can sign back in anytime with your email and password.</p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setLoggingOut(false)}>Stay logged in</button>
              <button className="btn primary" onClick={confirmLogout}>Log out</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Account Deletion Confirmation Modal */}
      {deletingAccount && (
        <Modal onClose={() => setDeletingAccount(false)}>
          <div className="confirm-dialog">
            <span className="danger-icon"><Icon name="trash" /></span>
            <h2>Permanently delete account?</h2>
            <p>
              Warning: This will permanently delete your account (<b>{user.email}</b>) along with all transaction records, budgets, and categories from the PostgreSQL database. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setDeletingAccount(false)}>Keep account</button>
              <button className="btn danger" onClick={confirmDeleteAccount}>Yes, delete everything</button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast text={toast} />}
    </Shell>
  );
}

