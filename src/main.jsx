import React, { useState, useEffect, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  Sun,
  Moon,
  ShieldCheck,
  Power,
  Activity,
  Command,
  Plus,
  LogOut,
  Settings,
  Eye,
  EyeOff,
  X,
  Check,
  Trash2,
  Search,
  ChevronRight,
  VolumeX,
  Pause,
  Play,
  LockKeyhole,
  Download,
  Layers,
  Radio,
  Orbit,
  LoaderCircle,
  Menu,
  User,
  KeyRound,
} from "lucide-react";
import "./styles.css";
const Reactor = lazy(() => import("./Reactor.jsx"));
let accessToken = "";
async function api(url, options = {}) {
  const res = await fetch("/api" + url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const e = new Error(
      data.message || "Connection interrupted. Please try again.",
    );
    e.status = res.status;
    throw e;
  }
  return data;
}
const date = (value) =>
  new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
function App() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [theme, setTheme] = useState(
      () => localStorage.getItem("nexora-theme") || "dark",
    ),
    [authMode, setAuthMode] = useState(null),
    [view, setView] = useState(
      location.pathname === "/account" ? "account" : "overview",
    ),
    [paused, setPaused] = useState(false),
    [boost, setBoost] = useState(false),
    [toast, setToast] = useState(""),
    [data, setData] = useState({ missions: [], activity: [], sessions: 1 }),
    [modal, setModal] = useState(false),
    [filter, setFilter] = useState("all"),
    [search, setSearch] = useState(""),
    [busy, setBusy] = useState(false),
    [deleteTarget, setDeleteTarget] = useState(null),
    [offline, setOffline] = useState(false);
  const notify = (m) => setToast(m);
  useEffect(() => {
    document.documentElement.dataset.motion = paused ? "paused" : "running";
  }, [paused]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("nexora-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  useEffect(() => {
    api("/auth/session")
      .then((d) => {
        accessToken = d.token;
        setUser(d.user);
      })
      .catch((e) => {
        if (e.status !== 401) setOffline(true);
      })
      .finally(() => setLoading(false));
    const pop = () =>
      setView(location.pathname === "/account" ? "account" : "overview");
    addEventListener("popstate", pop);
    return () => removeEventListener("popstate", pop);
  }, []);
  async function refresh() {
    try {
      setData(await api("/dashboard"));
      setOffline(false);
    } catch (e) {
      if (e.status === 401) {
        accessToken = "";
        setUser(null);
        notify(e.message);
      } else {
        setOffline(true);
        notify("Unable to sync. Check your connection and retry.");
      }
    }
  }
  useEffect(() => {
    if (user) refresh();
  }, [user]);
  function navigate(v) {
    setView(v);
    history.pushState({}, "", v === "account" ? "/account" : "/console");
  }
  function signedIn(d) {
    accessToken = d.token;
    setUser(d.user);
    setAuthMode(null);
    navigate("overview");
    notify(`Welcome aboard, ${d.user.name.split(" ")[0]}.`);
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      accessToken = "";
      setUser(null);
      setData({ missions: [], activity: [], sessions: 1 });
      history.pushState({}, "", "/");
      notify("You have been securely signed out.");
    } catch (e) {
      notify(e.message);
    }
  }
  async function updateMission(m) {
    try {
      await api("/missions/" + m.id, {
        method: "PATCH",
        body: {
          status:
            m.status === "queued"
              ? "active"
              : m.status === "active"
                ? "complete"
                : "queued",
        },
      });
      await refresh();
      notify("Mission status updated.");
    } catch (e) {
      notify(e.message);
    }
  }
  async function remove() {
    try {
      await api("/missions/" + deleteTarget.id, { method: "DELETE" });
      setDeleteTarget(null);
      await refresh();
      notify("Mission deleted.");
    } catch (e) {
      notify(e.message);
    }
  }
  function exportMissions() {
    const blob = new Blob(
      [
        JSON.stringify(
          data.missions.map(({ user_id, ...m }) => m),
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const u = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = u;
    a.download = "nexora-missions.json";
    a.click();
    URL.revokeObjectURL(u);
    notify("Mission archive exported.");
  }
  const complete = data.missions.filter((m) => m.status === "complete").length,
    active = data.missions.filter((m) => m.status === "active").length;
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="ambient-grid" />
      <header className="topbar">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            user ? navigate("overview") : history.pushState({}, "", "/");
          }}
          aria-label="Nexora home"
        >
          <span className="brand-symbol">N</span>
          <span>
            NEXORA<small>PERSONAL COMMAND SYSTEM</small>
          </span>
        </a>
        <div className="top-center">
          <span className="status-dot" />{" "}
          {offline ? "CONNECTION INTERRUPTED" : "SYSTEMS ONLINE"}{" "}
          <span className="nav-divider" /> <span>MARK VII / V.01</span>
        </div>
        <div className="top-actions">
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {user ? (
            <button
              className="profile-button"
              onClick={() => navigate("account")}
            >
              <span>{user.name.slice(0, 1).toUpperCase()}</span>
              <b>{user.name.split(" ")[0]}</b>
              <Settings size={15} />
            </button>
          ) : (
            <button className="nav-signin" onClick={() => setAuthMode("login")}>
              Operator access <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      </header>
      {loading ? (
        <main className="loading-screen">
          <LoaderCircle className="spin" />
          <p>Establishing secure connection</p>
        </main>
      ) : !user ? (
        <main id="main">
          <section className="hero">
            <div className="hero-meta">
              <span>
                <i /> AVENGERS INITIATIVE / INDEPENDENT CONCEPT
              </span>
              <span className="hero-coordinate">40°43′ N &nbsp; 73°59′ W</span>
            </div>
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="tiny-cross">+</span> BUILT FOR THE
                EXTRAORDINARY
              </div>
              <h1>
                Not just access.
                <br />
                Your <em>origin story.</em>
              </h1>
              <p>
                A secure identity. A powerful workspace.
                <br />
                One command center. Suit up for what’s next.
              </p>
              <div className="hero-cta">
                <button
                  className="metal-button"
                  onClick={() => setAuthMode("register")}
                >
                  <span className="button-index">01</span>
                  <span>INITIALIZE ACCESS</span>
                  <ArrowUpRight size={20} />
                </button>
                <button
                  className="text-link"
                  onClick={() => setAuthMode("login")}
                >
                  Already an operator? <ArrowRight size={16} />
                </button>
              </div>
              <div className="security-caption">
                <ShieldCheck size={16} />
                <span>YOUR IDENTITY, UNDER ARMOR.</span>
              </div>
            </div>
            <div className="reactor-stage">
              <div className="orbit-line orbit-one" />
              <div className="orbit-line orbit-two" />
              <div className="reactor-hud top">
                <span>ARC REACTOR</span>
                <b>MK. VII</b>
              </div>
              <Suspense fallback={<div className="reactor-placeholder">△</div>}>
                <Reactor paused={paused} boost={boost} />
              </Suspense>
              <div className="reactor-hud left">
                <span>CORE INTEGRITY</span>
                <strong>
                  100<span>%</span>
                </strong>
                <div className="signal-bars">▂ ▄ ▆ █ ▆ ▄ ▂</div>
              </div>
              <div className="reactor-hud right">
                <span>POWER SOURCE</span>
                <b>PALLADIUM</b>
                <i>STABLE OUTPUT</i>
              </div>
              <div className="reactor-base" />
              <div className="reactor-caption">
                <span className="status-dot" />{" "}
                {boost ? "OVERDRIVE ENGAGED" : "SELF-SUSTAINING ENERGY CORE"}
                <button
                  onClick={() => {
                    setBoost(!boost);
                  }}
                  aria-label={
                    boost
                      ? "Disable reactor overdrive"
                      : "Enable reactor overdrive"
                  }
                >
                  <Power size={15} />
                </button>
              </div>
              <div className="reactor-tag">
                REACTOR 01 <span>↗ INTERACTIVE MODEL</span>
              </div>
            </div>
            <div className="hero-bottom">
              <span>01 — THE INITIATIVE</span>
              <span className="scroll-prompt">
                SCROLL TO EXPLORE <span>↓</span>
              </span>
              <span>SECURE BY DESIGN. EXTRAORDINARY BY NATURE.</span>
            </div>
          </section>
          <section
            className="capability-strip"
            aria-label="System capabilities"
          >
            <div>
              <span className="cap-index">01 /</span>
              <ShieldCheck />
              <div>
                <h3>Armor-grade identity</h3>
                <p>Secure sign-in. Your access, protected.</p>
              </div>
            </div>
            <div>
              <span className="cap-index">02 /</span>
              <Orbit />
              <div>
                <h3>Your mission. Your control.</h3>
                <p>Plan, prioritize, and move things forward.</p>
              </div>
            </div>
            <div>
              <span className="cap-index">03 /</span>
              <Layers />
              <div>
                <h3>Built for your universe</h3>
                <p>Seamless across screens. Day or night.</p>
              </div>
            </div>
          </section>
          <section className="initiative-section">
            <div>
              <div className="eyebrow">THE NEXORA PROTOCOL</div>
              <h2>
                Great things begin
                <br />
                with a single <em>command.</em>
              </h2>
            </div>
            <div className="protocol-steps">
              <article>
                <b>01</b>
                <div>
                  <h3>Establish your identity</h3>
                  <p>
                    Create your operator profile and enter your secure
                    workspace.
                  </p>
                </div>
              </article>
              <article>
                <b>02</b>
                <div>
                  <h3>Define the mission</h3>
                  <p>
                    Set priorities, track progress, and focus on the work that
                    matters.
                  </p>
                </div>
              </article>
              <article>
                <b>03</b>
                <div>
                  <h3>Take command</h3>
                  <p>
                    Control your account, review activity, and keep your
                    sessions secure.
                  </p>
                </div>
              </article>
            </div>
          </section>
        </main>
      ) : (
        <main id="main" className="console">
          <nav className="console-nav" aria-label="Workspace">
            <button
              className={view === "overview" ? "selected" : ""}
              onClick={() => navigate("overview")}
            >
              <Command size={17} /> Command center <span>01</span>
            </button>
            <button
              className={view === "account" ? "selected" : ""}
              onClick={() => navigate("account")}
            >
              <User size={17} /> Operator profile <span>02</span>
            </button>
            <button onClick={logout}>
              <LogOut size={17} /> Sign out
            </button>
          </nav>
          <div className="console-content">
            <div className="console-heading">
              <div>
                <div className="eyebrow">
                  <span className="status-dot" /> AUTHORIZED PERSONNEL / LEVEL
                  01
                </div>
                <h1>
                  {view === "account"
                    ? "Operator profile."
                    : `At your command, ${user.name.split(" ")[0]}.`}
                </h1>
                <p>
                  {view === "account"
                    ? "Your identity. Your security. Your control."
                    : "Every extraordinary outcome starts with a mission."}
                </p>
              </div>
              <span className="console-emblem">△</span>
            </div>
            {offline && (
              <div className="connection-banner" role="alert">
                Connection interrupted. Your data may be out of date.{" "}
                <button onClick={refresh}>Retry sync</button>
              </div>
            )}
            {view === "account" ? (
              <Account
                user={user}
                setUser={setUser}
                notify={notify}
                sessions={data.sessions}
                refresh={refresh}
              />
            ) : (
              <>
                <section className="metrics">
                  <div>
                    <span>MISSION INVENTORY</span>
                    <strong>
                      {String(data.missions.length).padStart(2, "0")}
                    </strong>
                    <Layers size={25} />
                  </div>
                  <div>
                    <span>ACTIVE OPERATIONS</span>
                    <strong>{String(active).padStart(2, "0")}</strong>
                    <Radio size={25} />
                  </div>
                  <div>
                    <span>MISSIONS ACCOMPLISHED</span>
                    <strong>{String(complete).padStart(2, "0")}</strong>
                    <ShieldCheck size={25} />
                  </div>
                  <div className="integrity">
                    <span>ACCESS INTEGRITY</span>
                    <strong>
                      SECURE <LockKeyhole size={18} />
                    </strong>
                    <small>JWT session verified</small>
                  </div>
                </section>
                <div className="mission-layout">
                  <section className="mission-panel">
                    <div className="section-heading">
                      <div>
                        <div className="eyebrow">
                          OPERATIONS /{" "}
                          {String(data.missions.length).padStart(2, "0")}
                        </div>
                        <h2>Mission control</h2>
                      </div>
                      <button
                        className="metal-button small"
                        onClick={() => setModal(true)}
                      >
                        <Plus size={16} />
                        <span>NEW MISSION</span>
                      </button>
                    </div>
                    <div className="mission-toolbar">
                      <div className="filters">
                        {["all", "queued", "active", "complete"].map((f) => (
                          <button
                            key={f}
                            className={filter === f ? "selected" : ""}
                            onClick={() => setFilter(f)}
                          >
                            {f === "all"
                              ? "All missions"
                              : f[0].toUpperCase() + f.slice(1)}
                          </button>
                        ))}
                      </div>
                      <label className="search">
                        <Search size={15} />
                        <input
                          aria-label="Search missions"
                          placeholder="Search missions"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="mission-list">
                      {data.missions
                        .filter(
                          (m) =>
                            (filter === "all" || m.status === filter) &&
                            m.title
                              .toLowerCase()
                              .includes(search.toLowerCase()),
                        )
                        .map((m, i) => (
                          <article className="mission" key={m.id}>
                            <span className={`mission-marker ${m.status}`}>
                              {m.status === "complete" ? (
                                <Check size={16} />
                              ) : (
                                String(i + 1).padStart(2, "0")
                              )}
                            </span>
                            <div className="mission-title">
                              <h3>{m.title}</h3>
                              <span>
                                {m.priority.toUpperCase()} PRIORITY <i />{" "}
                                {date(m.created_at)}
                              </span>
                            </div>
                            <button
                              className={`status-button ${m.status}`}
                              onClick={() => updateMission(m)}
                              title="Advance mission status"
                            >
                              {m.status}
                              <ChevronRight size={13} />
                            </button>
                            <button
                              className="icon-btn delete-btn"
                              onClick={() => setDeleteTarget(m)}
                              aria-label={`Delete ${m.title}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          </article>
                        ))}
                      {!data.missions.filter(
                        (m) =>
                          (filter === "all" || m.status === filter) &&
                          m.title.toLowerCase().includes(search.toLowerCase()),
                      ).length && (
                        <div className="empty-state">
                          <Orbit size={44} />
                          <h3>
                            {data.missions.length
                              ? "No matching missions"
                              : "Your next mission awaits."}
                          </h3>
                          <p>
                            {data.missions.length
                              ? "Try another search or mission filter."
                              : "Create your first mission. Make the extraordinary happen."}
                          </p>
                          {!data.missions.length && (
                            <button
                              className="text-link"
                              onClick={() => setModal(true)}
                            >
                              Initialize a mission <ArrowUpRight size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="panel-footer">
                      <span>
                        PRIVATE WORKSPACE / {user.id.slice(0, 8).toUpperCase()}
                      </span>
                      <button className="text-link" onClick={exportMissions}>
                        <Download size={14} /> Export
                      </button>
                    </div>
                  </section>
                  <aside className="activity-panel">
                    <div className="eyebrow">SYSTEM LOG</div>
                    <h2>
                      Activity feed <Activity size={20} />
                    </h2>
                    <div className="activity-list">
                      {data.activity.length ? (
                        data.activity.slice(0, 7).map((a, i) => (
                          <div className="activity-item" key={i}>
                            <i />
                            <div>
                              <p>{a.event}</p>
                              <time>{date(a.created_at)}</time>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p>No activity yet.</p>
                      )}
                    </div>
                    <div className="session-badge">
                      <ShieldCheck size={23} />
                      <div>
                        <strong>Identity verified</strong>
                        <span>
                          {data.sessions} active session
                          {data.sessions !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </aside>
                </div>
              </>
            )}
          </div>
        </main>
      )}
      <footer className="footer">
        <span>
          NEXORA <i>/</i> ENGINEERED FOR POSSIBILITY
        </span>
        <span className="fan-note">
          Independent Avengers-inspired fan project. Not affiliated with Marvel.
        </span>
        <button className="motion-button" onClick={() => setPaused(!paused)}>
          {paused ? <Play size={13} /> : <Pause size={13} />}{" "}
          {paused ? "RESUME MOTION" : "PAUSE MOTION"}
        </button>
      </footer>
      {authMode && (
        <Dialog
          title={
            authMode === "register"
              ? "Establish your identity"
              : "Welcome back, operator"
          }
          onClose={() => setAuthMode(null)}
        >
          <AuthForm
            mode={authMode}
            setMode={setAuthMode}
            onSuccess={signedIn}
          />
        </Dialog>
      )}
      {modal && (
        <Dialog title="Initialize a mission" onClose={() => setModal(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                await api("/missions", {
                  method: "POST",
                  body: { title: f.get("title"), priority: f.get("priority") },
                });
                setModal(false);
                await refresh();
                notify("New mission initialized.");
              } catch (e) {
                notify(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <p className="form-intro">
              Give your next objective a name and a priority.
            </p>
            <label>
              MISSION DESIGNATION
              <input
                name="title"
                minLength={3}
                maxLength={120}
                required
                autoFocus
                placeholder="e.g. Launch the next big idea"
              />
            </label>
            <label>
              PRIORITY LEVEL
              <select name="priority">
                <option value="normal">Normal — standard operation</option>
                <option value="high">High — requires attention</option>
                <option value="critical">Critical — immediate action</option>
              </select>
            </label>
            <button className="metal-button full" disabled={busy}>
              <Plus size={17} />
              {busy ? "INITIALIZING…" : "CREATE MISSION"}
              <ArrowUpRight size={18} />
            </button>
          </form>
        </Dialog>
      )}
      {deleteTarget && (
        <Dialog
          title="Delete this mission?"
          onClose={() => setDeleteTarget(null)}
        >
          <p className="form-intro">
            “{deleteTarget.title}” will be permanently removed from your
            workspace.
          </p>
          <div className="dialog-actions">
            <button
              className="outline-button"
              onClick={() => setDeleteTarget(null)}
            >
              Keep mission
            </button>
            <button className="metal-button" onClick={remove}>
              <Trash2 size={16} />
              DELETE MISSION
            </button>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
function Dialog({ title, onClose, children }) {
  const ref = React.useRef(null);
  useEffect(() => {
    const old = document.activeElement;
    ref.current.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      old?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog-top">
        <span className="eyebrow">NEXORA / SECURE CHANNEL</span>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      <div className="dialog-emblem">△</div>
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
function Password({
  label = "PASSWORD",
  name = "password",
  minLength = 8,
  newPassword = false,
  onChange,
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label>
      {label}
      <span className="password-field">
        <input
          name={name}
          type={visible ? "text" : "password"}
          minLength={minLength}
          maxLength={128}
          required
          autoComplete={newPassword ? "new-password" : "current-password"}
          onChange={onChange}
          placeholder={
            newPassword
              ? "8+ characters, letters and numbers"
              : "Enter your password"
          }
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}
function AuthForm({ mode, setMode, onSuccess }) {
  const register = mode === "register";
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState("");
  return (
    <>
      <p className="form-intro">
        {register
          ? "Your command center is one step away."
          : "Enter your credentials to bring your systems online."}
      </p>
      <div className="auth-switch">
        <button
          onClick={() => {
            setMode("login");
            setError("");
          }}
          className={!register ? "selected" : ""}
        >
          SIGN IN <span>01</span>
        </button>
        <button
          onClick={() => {
            setMode("register");
            setError("");
          }}
          className={register ? "selected" : ""}
        >
          CREATE ACCOUNT <span>02</span>
        </button>
      </div>
      <form
        key={mode}
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            const d = await api("/auth/" + (register ? "register" : "login"), {
              method: "POST",
              body: {
                name: f.get("name"),
                email: f.get("email"),
                password: f.get("password"),
              },
            });
            onSuccess(d);
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {register && (
          <label>
            OPERATOR NAME
            <input
              name="name"
              required
              minLength={2}
              maxLength={50}
              autoComplete="name"
              placeholder="Your full name"
            />
          </label>
        )}
        <label>
          EMAIL ADDRESS
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            placeholder="you@example.com"
            autoFocus
          />
        </label>
        <Password
          minLength={register ? 8 : 1}
          newPassword={register}
          onChange={(e) => setPassword(e.target.value)}
        />
        {register && (
          <div className="password-strength">
            <div>
              <i
                style={{
                  width: `${Math.min(100, (password.length >= 8 ? 40 : password.length * 4) + (/\d/.test(password) ? 30 : 0) + (/[^a-zA-Z0-9]/.test(password) ? 30 : 0))}%`,
                }}
              />
            </div>
            <small>At least 8 characters with letters and numbers.</small>
          </div>
        )}
        <button className="metal-button full" disabled={busy}>
          <LockKeyhole size={16} />
          <span>
            {busy
              ? "AUTHENTICATING…"
              : register
                ? "INITIALIZE ACCESS"
                : "ENTER COMMAND CENTER"}
          </span>
          {busy ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <ArrowUpRight size={18} />
          )}
        </button>
      </form>
      <div className="auth-foot">
        <ShieldCheck size={14} /> SECURE SESSION · PRIVATE WORKSPACE
      </div>
    </>
  );
}
function Account({ user, setUser, notify, sessions, refresh }) {
  const [busy, setBusy] = useState("");
  async function submit(e, type) {
    e.preventDefault();
    setBusy(type);
    const f = new FormData(e.currentTarget);
    try {
      const d = await api(
        "/account" + (type === "password" ? "/password" : ""),
        { method: "PATCH", body: Object.fromEntries(f) },
      );
      if (d.token) accessToken = d.token;
      setUser(d.user);
      notify(
        type === "password"
          ? "Password updated. All other sessions have been signed out."
          : "Operator profile updated.",
      );
      if (type === "password") e.target.reset();
      await refresh();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="account-grid">
      <section className="account-card">
        <div className="eyebrow">IDENTITY FILE</div>
        <div className="operator-id">
          <div>{user.name.slice(0, 1).toUpperCase()}</div>
          <span>
            VERIFIED OPERATOR
            <small>
              Member since{" "}
              {new Date(user.createdAt).toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </small>
          </span>
          <ShieldCheck />
        </div>
        <form onSubmit={(e) => submit(e, "profile")}>
          <label>
            OPERATOR NAME
            <input
              name="name"
              defaultValue={user.name}
              required
              minLength={2}
              maxLength={50}
              autoComplete="name"
            />
          </label>
          <label>
            EMAIL ADDRESS
            <input value={user.email} readOnly />
            <small>
              Your account email is your permanent sign-in identifier.
            </small>
          </label>
          <button className="metal-button" disabled={busy === "profile"}>
            <Check size={16} />
            {busy === "profile" ? "SAVING…" : "SAVE IDENTITY"}
          </button>
        </form>
      </section>
      <section className="account-card">
        <div className="eyebrow">SECURITY PROTOCOL</div>
        <h2>Upgrade your armor.</h2>
        <p className="form-intro">
          Changing your password signs out all other sessions.
        </p>
        <form onSubmit={(e) => submit(e, "password")}>
          <Password
            name="currentPassword"
            label="CURRENT PASSWORD"
            minLength={1}
          />
          <Password label="NEW PASSWORD" newPassword />
          <button className="metal-button" disabled={busy === "password"}>
            <KeyRound size={16} />
            {busy === "password" ? "UPDATING…" : "UPDATE PASSWORD"}
          </button>
        </form>
      </section>
      <section className="account-card sessions-card">
        <div>
          <div className="eyebrow">SESSION MANAGEMENT</div>
          <h2>
            {sessions} active session{sessions !== 1 ? "s" : ""}
          </h2>
          <p className="form-intro">
            Keep this device connected and revoke access on all other devices.
          </p>
        </div>
        <button
          className="outline-button"
          onClick={async () => {
            try {
              const d = await api("/account/revoke", { method: "POST" });
              notify(d.message);
              await refresh();
            } catch (e) {
              notify(e.message);
            }
          }}
        >
          Sign out other devices <LogOut size={16} />
        </button>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
