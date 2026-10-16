import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const statuses = ["Todo", "In Progress", "Done"];
const blank = {
  title: "",
  description: "",
  status: "Todo",
  priority: "Medium",
  assignee: "Unassigned",
};
const initials = (name) =>
  name
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const date = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : `Request failed (${response.status}). Please try again.`,
    );
  }
  return response.status === 204 ? null : response.json();
}
function Icon({ name, size = 19 }) {
  const paths = {
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    tasks: "M9 5h12M9 12h12M9 19h12M3 5l1 1 2-2M3 12l1 1 2-2M3 19l1 1 2-2",
    activity: "M3 12h4l3-8 4 16 3-8h4",
    box: "M4 7l8-4 8 4v10l-8 4-8-4z M4 7l8 4 8-4M12 11v10",
    arrow: "M7 17 17 7M7 7h10v10",
    search: "M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
    check: "m5 12 4 4L19 6",
    clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
    edit: "m15 4 5 5-11 11H4v-5zM12 7l5 5",
    trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
    close: "m6 6 12 12M6 18 18 6",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.grid} />
    </svg>
  );
}
function TaskModal({ task, onClose, onSave }) {
  const [form, setForm] = useState(
    task
      ? Object.fromEntries(Object.keys(blank).map((k) => [k, task[k]]))
      : { ...blank },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    return () => previous?.focus();
  }, []);
  const field = (key) => ({
    value: form[key],
    onChange: (e) => setForm({ ...form, [key]: e.target.value }),
  });
  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form, task?.id);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <form onSubmit={submit}>
        <div className="modal-heading">
          <div>
            <span className="eyebrow">MAKE THINGS HAPPEN</span>
            <h2 id="modal-title">{task ? "Edit task" : "Create a task"}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close dialog"
            disabled={saving}
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>
        <label>
          Task title
          <input
            {...field("title")}
            autoFocus
            required
            maxLength={200}
            placeholder="What needs to get done?"
          />
        </label>
        <label>
          Description
          <textarea
            {...field("description")}
            maxLength={5000}
            rows={3}
            placeholder="Add a little context for your team…"
          />
        </label>
        <div className="form-row">
          <label>
            Status
            <select {...field("status")}>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Priority
            <select {...field("priority")}>
              {["Low", "Medium", "High"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Assignee
          <input {...field("assignee")} required maxLength={100} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button
            type="button"
            className="secondary"
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="primary" disabled={saving}>
            {saving ? "Saving…" : task ? "Save changes" : "Create task"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
function App() {
  const [tasks, setTasks] = useState([]),
    [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [filter, setFilter] = useState("All tasks"),
    [search, setSearch] = useState("");
  const [view, setView] = useState("Overview"),
    [modal, setModal] = useState(null),
    [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(null);
  async function load() {
    setError("");
    try {
      const [items, numbers] = await Promise.all([
        api("/api/tasks"),
        api("/api/tasks/stats"),
      ]);
      setTasks(items);
      setStats(numbers);
    } catch (err) {
      setError(`We couldn’t connect to TaskBoard. ${err.message}`);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 4000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  async function save(form, id) {
    await api(id ? `/api/tasks/${id}` : "/api/tasks", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(form),
    });
    setNotice(id ? "Task updated successfully" : "Your new task is ready");
    await load();
  }
  async function remove(task) {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`))
      return;
    setDeleting(task.id);
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      setNotice("Task deleted");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
    }
  }
  const visible = tasks.filter(
    (t) =>
      (filter === "All tasks" || t.status === filter) &&
      `${t.title} ${t.assignee} ${t.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const activity = [...tasks]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 5);
  const progress = stats?.total
    ? Math.round((stats.done / stats.total) * 100)
    : 0;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="TaskBoard home">
          <span className="brand-mark">
            <Icon name="check" size={25} />
          </span>
          TaskBoard<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">S</span>
          <div>
            <strong>Studio workspace</strong>
            <small>DevOps capstone</small>
          </div>
          <span className="workspace-chevron">⌄</span>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Workspace">
          {[
            ["Overview", "grid"],
            ["All tasks", "tasks"],
            ["Activity", "activity"],
          ].map(([label, icon]) => (
            <button
              key={label}
              className={view === label ? "nav-item active" : "nav-item"}
              onClick={() => setView(label)}
            >
              <Icon name={icon} />
              {label}
              {label === "All tasks" && (
                <span className="nav-count">{stats?.total ?? "–"}</span>
              )}
            </button>
          ))}
        </nav>
        <p className="nav-caption project-caption">
          PROJECTS <span>01</span>
        </p>
        <button
          className="project-nav"
          onClick={() => {
            setView("All tasks");
            setFilter("All tasks");
          }}
        >
          <span className="project-square" />
          Platform launch<span className="project-chevron">↗</span>
        </button>
        <div className="sidebar-bottom">
          <div className="delivery-note">
            <span className="tiny-label">BUILT TO SHIP</span>
            <strong>From idea to production.</strong>
            <p>
              One workspace. The whole
              <br />
              delivery journey.
            </p>
            <div className="delivery-dots">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="profile">
            <span className="avatar">TB</span>
            <div>
              <strong>Capstone team</strong>
              <small>Team workspace</small>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{view}</strong>
          </div>
          <div className="topbar-right">
            <span className={`connection ${error ? "offline" : ""}`}>
              <i />
              {loading
                ? "Connecting"
                : error
                  ? "API unavailable"
                  : "API connected"}
            </span>
            <span className="avatar small">TB</span>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                PLATFORM LAUNCH <span> / </span> TEAM WORKSPACE
              </div>
              <h1>
                {view === "Overview"
                  ? "Every task. A step forward."
                  : view === "Activity"
                    ? "The latest from your team."
                    : "Good work starts here."}
              </h1>
              <p>
                A little clarity. A lot of progress. Keep your team moving
                together.
              </p>
            </div>
            <button className="primary new-task" onClick={() => setModal({})}>
              <span>＋</span> Create task
            </button>
          </div>
          {notice && (
            <div className="toast" role="status">
              <Icon name="check" />
              {notice}
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <div>
                <strong>Connection needs attention</strong>
                <p>{error}</p>
              </div>
              <button
                className="secondary"
                onClick={() => {
                  setLoading(true);
                  load();
                }}
              >
                Try again
              </button>
            </div>
          )}
          <section className="kpis" aria-label="Task statistics">
            {[
              [
                "Total tasks",
                stats?.total,
                "box",
                "All work in one place",
                "mint",
              ],
              [
                "In progress",
                stats?.in_progress,
                "clock",
                "Great things in the making",
                "blue",
              ],
              [
                "Completed",
                stats?.done,
                "check",
                `${progress}% of the way there`,
                "purple",
              ],
              [
                "High priority",
                stats?.high_priority,
                "arrow",
                "Give these a little attention",
                "orange",
              ],
            ].map(([label, value, icon, caption, color]) => (
              <article className="kpi" key={label}>
                <div className="kpi-top">
                  <span>{label}</span>
                  <span className={`kpi-icon ${color}`}>
                    <Icon name={icon} />
                  </span>
                </div>
                <strong className="kpi-number">
                  {loading
                    ? "…"
                    : error
                      ? "–"
                      : String(value ?? 0).padStart(2, "0")}
                </strong>
                <small>{caption}</small>
              </article>
            ))}
          </section>
          {view !== "Activity" && (
            <section className="task-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    Your team's work{" "}
                    <span className="count-badge">{tasks.length}</span>
                  </h2>
                  <p>The big picture, down to the details.</p>
                </div>
                <label className="search">
                  <Icon name="search" />
                  <input
                    aria-label="Search tasks"
                    placeholder="Search tasks…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <span>⌕</span>
                </label>
              </div>
              <div className="filter-row" aria-label="Filter by status">
                {["All tasks", ...statuses].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilter(s)}
                    className={filter === s ? "filter active" : "filter"}
                  >
                    {s}
                    <span>
                      {s === "All tasks"
                        ? tasks.length
                        : tasks.filter((t) => t.status === s).length}
                    </span>
                  </button>
                ))}
                <span className="table-caption">Updated with your team</span>
              </div>
              {loading ? (
                <div className="empty" role="status">
                  <span className="spinner" />
                  <h3>Gathering your team's work…</h3>
                  <p>Just a moment while we load your workspace.</p>
                </div>
              ) : error ? (
                <div className="empty">
                  <Icon name="activity" size={32} />
                  <h3>Your tasks will be here</h3>
                  <p>Reconnect to the backend to see your workspace.</p>
                </div>
              ) : visible.length === 0 ? (
                <div className="empty">
                  <span className="empty-icon">
                    <Icon name="tasks" size={30} />
                  </span>
                  <h3>
                    {tasks.length
                      ? "No tasks match your search"
                      : "A fresh start for your team"}
                  </h3>
                  <p>
                    {tasks.length
                      ? "Try a different search or status filter."
                      : "Create your first task and turn a plan into progress."}
                  </p>
                  {!tasks.length && (
                    <button className="primary" onClick={() => setModal({})}>
                      Create your first task
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th className="id-column">ID</th>
                        <th>Task name</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Assignee</th>
                        <th>Created</th>
                        <th>
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((t) => (
                        <tr key={t.id}>
                          <td className="task-id">
                            TB-{String(t.id).padStart(3, "0")}
                          </td>
                          <td className="title-cell">
                            <button onClick={() => setModal(t)}>
                              {t.title}
                            </button>
                            <small>
                              {t.description || "No description added"}
                            </small>
                          </td>
                          <td>
                            <span
                              className={`status status-${t.status.replace(" ", "").toLowerCase()}`}
                            >
                              <i />
                              {t.status}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`priority priority-${t.priority.toLowerCase()}`}
                            >
                              <span>
                                {t.priority === "High"
                                  ? "↑"
                                  : t.priority === "Low"
                                    ? "↓"
                                    : "−"}
                              </span>
                              {t.priority}
                            </span>
                          </td>
                          <td>
                            <div className="assignee">
                              <span className={`person person-${t.id % 4}`}>
                                {initials(t.assignee)}
                              </span>
                              <span>{t.assignee}</span>
                            </div>
                          </td>
                          <td className="date-cell">{date(t.created_at)}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                className="icon-button"
                                aria-label={`Edit ${t.title}`}
                                onClick={() => setModal(t)}
                              >
                                <Icon name="edit" size={16} />
                              </button>
                              <button
                                className="icon-button delete"
                                aria-label={`Delete ${t.title}`}
                                disabled={deleting === t.id}
                                onClick={() => remove(t)}
                              >
                                <Icon name="trash" size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="table-footer">
                <span>
                  {visible.length} of {tasks.length} tasks
                </span>
                <span>
                  <i className="online-dot" /> A shared view. A focused team.
                </span>
              </div>
            </section>
          )}
          <section
            className={`bottom-grid ${view === "Activity" ? "activity-page" : ""}`}
          >
            <article className="activity-panel">
              <div className="section-heading">
                <h2>Recent activity</h2>
                <span>WORKSPACE UPDATES</span>
              </div>
              {activity.length && !error ? (
                activity.map((t) => (
                  <div className="activity-item" key={t.id}>
                    <span
                      className={`activity-symbol ${t.status === "Done" ? "mint" : "blue"}`}
                    >
                      <Icon
                        name={t.status === "Done" ? "check" : "tasks"}
                        size={16}
                      />
                    </span>
                    <div>
                      <p>
                        <strong>{t.title}</strong>
                      </p>
                      <small>
                        {t.assignee} · {t.status}
                      </small>
                    </div>
                    <time dateTime={t.updated_at}>{date(t.updated_at)}</time>
                  </div>
                ))
              ) : (
                <p className="muted">
                  Task updates will appear here as your team gets started.
                </p>
              )}
            </article>
            <article className="delivery-panel">
              <div className="section-heading">
                <h2>
                  <Icon name="activity" /> Built for delivery
                </h2>
                <span className="pipeline-label">DEVOPS CAPSTONE</span>
              </div>
              <p>Good work deserves a clear path to production.</p>
              <div className="pipeline">
                {["Code", "Test", "Build", "Scan", "Deploy"].map((step, i) => (
                  <React.Fragment key={step}>
                    {i > 0 && <span className="pipeline-line" />}
                    <div>
                      <span className="pipeline-step">{i + 1}</span>
                      <small>{step}</small>
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div className="pipeline-note">
                <span className="pipeline-note-dot" />
                Pipeline stages · execution status available in GitHub Actions
              </div>
              <div className="completion">
                <div>
                  <span>Workspace completion</span>
                  <strong>{progress}%</strong>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${progress}%` }} />
                </div>
                <small>Small steps. Meaningful momentum.</small>
              </div>
            </article>
          </section>
          <footer className="page-footer">
            <span>
              TaskBoard <span> / </span> A space for work that matters.
            </span>
            <span>Made for your next milestone ↗</span>
          </footer>
        </div>
      </main>
      {modal && (
        <TaskModal
          task={modal.id ? modal : null}
          onSave={save}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
