// =====================================================
//  JENNIFER · File Organizer
// =====================================================

// ---------- 1. KONEKSYON SA SUPABASE ----------
// Publishable key lang ang ilalagay dito, HINDI ang secret key.
const SUPABASE_URL = "https://hcthaljffidexwkxscos.supabase.co";
const SUPABASE_KEY = "sb_publishable_LhVIzaXVL10gVCGQmXQzYg_8C1s60Zp";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const MAX_FILES = 10;
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

// ---------- 2. STATE ----------
const viewUsername = new URLSearchParams(location.search).get("u"); // ?u=username
let user = null;        // ang naka-login
let me = null;          // profile ng naka-login
let owner = null;       // profile na tinitingnan
let mode = null;        // "mine" o "public"
let FILES = [];
let URLS = {};          // path → link para mabuksan ang file
let filter = "all";
let selected = null;
let newIds = new Set(); // mga bagong upload (para sa glow animation)
let view = store("jennifer-view") || "grid";

const $ = id => document.getElementById(id);

function esc(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// Ligtas na localStorage (puwedeng ma-block sa ibang browser)
function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch (e) { return null; }
}

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(t.timer);
  t.timer = setTimeout(() => t.classList.remove("show"), 2800);
}

// Spinner sa button habang naghihintay
function busy(btn, on) {
  if (!btn) return;
  btn.classList.toggle("loading", on);
  btn.disabled = on;
}

// Loading bar sa pinakaitaas
let loads = 0;
function loading(on) {
  const bar = $("loadbar");
  loads = Math.max(0, loads + (on ? 1 : -1));
  if (loads > 0) {
    bar.classList.remove("done");
    void bar.offsetWidth;
    bar.classList.add("active");
  } else {
    bar.classList.remove("active");
    bar.classList.add("done");
  }
}

function show(name) {
  const auth = name === "auth";
  if ($("view-auth").hidden === !auth && $("view-app").hidden === auth) return;
  $("view-auth").hidden = !auth;
  $("view-app").hidden = auth;
  const el = auth ? $("view-auth") : $("view-app");
  el.classList.remove("view-enter");
  void el.offsetWidth;
  el.classList.add("view-enter");
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

document.querySelectorAll(".year").forEach(el => (el.textContent = new Date().getFullYear()));

// ---------- 3. ICONS ----------
const ICON = {
  all:     '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  public:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  private: '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  user:    '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  link:    '<svg viewBox="0 0 24 24"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  logout:  '<svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
  home:    '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>',
  login:   '<svg viewBox="0 0 24 24"><path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H8"/></svg>',
  files:   '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>',
  folder:  '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  sun:     '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon:    '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  x:       '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check:   '<svg class="check" viewBox="0 0 26 26"><circle cx="13" cy="13" r="10"/><path d="M8.5 13.5l3 3 6-6.5"/></svg>'
};

// ---------- 4. URI NG FILE AT KULAY ----------
const TYPES = {
  image: { label: "IMG",  color: "#8b5cf6" },
  pdf:   { label: "PDF",  color: "#ef4444" },
  doc:   { label: "DOC",  color: "#3b82f6" },
  ppt:   { label: "PPT",  color: "#f97316" },
  sheet: { label: "XLS",  color: "#10b981" },
  link:  { label: "LINK", color: "#0ea5e9" },
  file:  { label: "FILE", color: "#64748b" }
};

function getType(path) {
  if (path.startsWith("http")) return "link";
  const ext = path.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx"].includes(ext)) return "doc";
  if (["ppt", "pptx"].includes(ext)) return "ppt";
  if (["xls", "xlsx", "csv"].includes(ext)) return "sheet";
  return "file";
}

const PALETTE = ["#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6", "#0ea5e9", "#ef4444", "#22c55e"];
function catColor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// ---------- 5. DARK MODE ----------
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
    btn.innerHTML = theme === "dark" ? ICON.sun : ICON.moon;
    btn.title = theme === "dark" ? "Light mode" : "Dark mode";
  });
}

document.querySelectorAll("[data-theme-toggle]").forEach(btn => {
  btn.onclick = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    store("jennifer-theme", next);
    applyTheme(next);
  };
});
applyTheme(document.documentElement.dataset.theme || "light");

// ---------- 6. GRID / LIST VIEW ----------
function applyView() {
  $("grid").classList.toggle("list", view === "list");
  document.querySelectorAll("#view-toggle button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
}
document.querySelectorAll("#view-toggle button").forEach(btn => {
  btn.onclick = () => {
    view = btn.dataset.view;
    store("jennifer-view", view);
    applyView();
    render();
  };
});
applyView();

// ---------- 7. AVATAR ----------
function avatarHTML(profile, size = "") {
  const initials = (profile?.display_name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const img = profile?.avatar_path
    ? `<img src="${db.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl}" alt="" onerror="this.remove()">`
    : "";
  return `<span class="avatar ${size}">${esc(initials)}${img}</span>`;
}

// =====================================================
//  8. ROUTING: alin ang ipapakita?
// =====================================================
async function route() {
  if (viewUsername) return openPublicProfile(viewUsername);
  if (user) return openMyLibrary();
  show("auth");
}

db.auth.onAuthStateChange((event, session) => {
  user = session?.user ?? null;
  if (event === "PASSWORD_RECOVERY") setTimeout(() => openModal("recovery"), 300);
  if (["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT"].includes(event)) setTimeout(route, 0);
});

// =====================================================
//  9. SIGN IN, CREATE ACCOUNT, FORGOT PASSWORD
// =====================================================
function showAuthForm(name) {
  const forms = { signin: $("signin-form"), signup: $("signup-form"), forgot: $("forgot-form") };
  Object.entries(forms).forEach(([key, form]) => (form.hidden = key !== name));
  $("auth-tabs").hidden = name === "forgot";
  $("auth-tabs").classList.toggle("second", name === "signup");
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === name));
  const shown = forms[name];
  shown.classList.remove("switching");
  void shown.offsetWidth;
  shown.classList.add("switching");
  document.querySelectorAll(".auth .msg").forEach(m => { m.textContent = ""; m.className = "msg"; });
}

document.querySelectorAll(".tab").forEach(tab => (tab.onclick = () => showAuthForm(tab.dataset.tab)));
$("forgot-open").onclick = () => {
  $("fp-email").value = $("si-email").value;
  showAuthForm("forgot");
};
$("forgot-back").onclick = () => showAuthForm("signin");

$("signin-form").onsubmit = async e => {
  e.preventDefault();
  const btn = e.submitter;
  busy(btn, true);
  const { error } = await db.auth.signInWithPassword({
    email: $("si-email").value.trim(),
    password: $("si-password").value
  });
  busy(btn, false);
  if (error) { $("si-msg").textContent = error.message; return; }
  $("signin-form").reset();
};

$("signup-form").onsubmit = async e => {
  e.preventDefault();
  const msg = $("su-msg");
  const btn = e.submitter;
  const username = $("su-username").value.trim().toLowerCase();
  msg.className = "msg";

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    msg.textContent = "Username: 3–20 lowercase letters, numbers, or _";
    return;
  }

  busy(btn, true);
  msg.textContent = "";

  const { data: taken } = await db.from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) {
    busy(btn, false);
    msg.textContent = "That username is already taken.";
    return;
  }

  const { data, error } = await db.auth.signUp({
    email: $("su-email").value.trim(),
    password: $("su-password").value,
    options: { data: { username, display_name: $("su-name").value.trim() } }
  });

  busy(btn, false);
  if (error) {
    msg.textContent = error.message.includes("Database error") ? "That username is already taken." : error.message;
    return;
  }

  $("signup-form").reset();
  if (!data.session) {
    msg.className = "msg ok";
    msg.textContent = "Account created! Check your email to confirm, then sign in.";
  } else {
    toast("Welcome to Jennifer! 🎉");
  }
};

$("forgot-form").onsubmit = async e => {
  e.preventDefault();
  const btn = e.submitter;
  const msg = $("fp-msg");
  busy(btn, true);
  const { error } = await db.auth.resetPasswordForEmail($("fp-email").value.trim(), {
    redirectTo: location.origin + location.pathname
  });
  busy(btn, false);
  if (error) { msg.className = "msg"; msg.textContent = error.message; return; }
  msg.className = "msg ok";
  msg.textContent = "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder.";
};

$("recovery-form").onsubmit = async e => {
  e.preventDefault();
  const btn = e.submitter;
  const msg = $("rp-msg");
  if ($("rp-password").value !== $("rp-confirm").value) {
    msg.textContent = "Passwords don't match.";
    return;
  }
  busy(btn, true);
  const { error } = await db.auth.updateUser({ password: $("rp-password").value });
  busy(btn, false);
  if (error) { msg.textContent = error.message; return; }
  $("recovery-form").reset();
  closeModal("recovery");
  history.replaceState(null, "", location.pathname);
  toast("Password updated 🔑");
};

// =====================================================
//  10. BUKSAN ANG SARILING LIBRARY
// =====================================================
async function openMyLibrary() {
  mode = "mine";
  show("app");
  $("profile-head").hidden = true;
  $("upload-open").hidden = false;
  $("stats").hidden = false;
  $("eyebrow").textContent = "My library";
  loading(true);

  const [{ data: profile }, { data, error }] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    db.from("files").select("*").eq("owner_id", user.id).order("created_at", { ascending: false })
  ]);
  me = owner = profile;

  await setFiles(error ? [] : data);
  loading(false);
  if (error) toast("Could not load files: " + error.message);
}

// =====================================================
//  11. PUBLIC PROFILE (?u=username)
// =====================================================
async function openPublicProfile(username) {
  mode = "public";
  show("app");
  $("upload-open").hidden = true;
  $("stats").hidden = true;
  $("eyebrow").textContent = "@" + username;
  loading(true);

  if (user) {
    const { data } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
    me = data;
  }

  const { data: profile } = await db.from("profiles").select("*").eq("username", username.toLowerCase()).maybeSingle();
  owner = profile;

  if (!profile) {
    $("profile-head").hidden = true;
    await setFiles([]);
    loading(false);
    $("page-title").textContent = "User not found";
    $("empty-title").textContent = "This profile doesn't exist";
    $("empty-text").textContent = "Check the link and try again.";
    return;
  }

  const { data } = await db.from("files").select("*")
    .eq("owner_id", profile.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const isMe = user && user.id === profile.id;
  const n = data?.length ?? 0;
  $("profile-head").hidden = false;
  $("profile-head").innerHTML = `
    ${avatarHTML(profile, "xl")}
    <div>
      <h2>${esc(profile.display_name)}</h2>
      <p>@${esc(profile.username)} · ${n} public file${n === 1 ? "" : "s"}</p>
    </div>
    <span class="spacer"></span>
    ${isMe ? `<a class="btn ghost" href="${location.pathname}">Back to my library</a>` : ""}
    <button class="btn primary" id="copy-link">${ICON.link} Copy link</button>`;
  $("copy-link").onclick = copyProfileLink;

  await setFiles(data ?? []);
  loading(false);
}

// =====================================================
//  12. MGA LINK NG FILE (pansamantala, 1 oras)
// =====================================================
async function setFiles(list) {
  FILES = list;
  URLS = {};
  const paths = list.filter(f => !f.path.startsWith("http")).map(f => f.path);
  if (paths.length) {
    const { data } = await db.storage.from("vault").createSignedUrls(paths, 3600);
    (data || []).forEach(item => { if (item.signedUrl) URLS[item.path] = item.signedUrl; });
  }
  list.filter(f => f.path.startsWith("http")).forEach(f => (URLS[f.path] = f.path));

  if (filter.startsWith("cat:") && !categories().includes(filter.slice(4))) filter = "all";
  buildSidebar();
  buildStats();
  render();
}

function categories() {
  return [...new Set(FILES.map(f => f.category))].sort((a, b) => a.localeCompare(b));
}

// =====================================================
//  13. SIDEBAR
// =====================================================
function navItem(key, icon, label, count, color) {
  const dot = color ? `<span class="dot" style="--c:${color}"></span>` : icon;
  return `<button class="nav-item ${filter === key ? "active" : ""}" data-key="${esc(key)}">
            ${dot}<span>${esc(label)}</span><span class="count">${count}</span>
          </button>`;
}

// Buong sidebar: mga category + user card
function buildSidebar() {
  buildNav();
  buildUserCard();
}

// Mga category lang (hindi ginagalaw ang profile picture)
function buildNav() {
  const count = fn => FILES.filter(fn).length;
  let html = `<p class="nav-label">Library</p>`;
  html += navItem("all", ICON.all, "All files", FILES.length);
  if (mode === "mine") {
    html += navItem("public", ICON.public, "Public", count(f => f.is_public));
    html += navItem("private", ICON.private, "Private", count(f => !f.is_public));
  }
  if (categories().length) {
    html += `<p class="nav-label">Categories</p>`;
    categories().forEach(c => (html += navItem("cat:" + c, "", c, count(f => f.category === c), catColor(c))));
  }
  $("nav").innerHTML = html;
  $("nav").querySelectorAll(".nav-item").forEach(btn => {
    btn.onclick = () => { filter = btn.dataset.key; buildNav(); render(); };
  });
}

// User card sa ibaba. Hindi na ito ginagawa ulit kung walang nagbago,
// kaya hindi na kumikislap ang profile picture.
function buildUserCard() {
  const card = $("user-card");
  const key = JSON.stringify([user?.id, me?.display_name, me?.avatar_path, mode]);
  if (card.dataset.key === key) return;
  card.dataset.key = key;

  if (user && me) {
    card.innerHTML = `
      <div class="user-row">
        ${avatarHTML(me)}
        <div><b>${esc(me.display_name)}</b><small>@${esc(me.username)}</small></div>
      </div>
      <div class="user-actions">
        ${mode === "public" ? `<a class="nav-item" href="${location.pathname}">${ICON.home}<span>My library</span></a>` : ""}
        <button class="nav-item" id="act-profile">${ICON.user}<span>Edit profile</span></button>
        <button class="nav-item" id="act-share">${ICON.link}<span>Share profile</span></button>
        <button class="nav-item" id="act-logout">${ICON.logout}<span>Sign out</span></button>
      </div>`;
    $("act-profile").onclick = openProfileEditor;
    $("act-share").onclick = copyProfileLink;
    $("act-logout").onclick = async () => { await db.auth.signOut(); toast("Signed out. See you! 👋"); };
  } else {
    card.innerHTML = `
      <div class="user-actions">
        <a class="btn primary block" href="${location.pathname}">${ICON.login} Sign in or create account</a>
      </div>`;
  }

  const name = mode === "public" && owner ? owner.username : me?.username;
  const link = `${location.origin}${location.pathname}?u=${name}`;
  navigator.clipboard.writeText(link)
    .then(() => toast("Profile link copied! Only public files are shown. 🔗"))
    .catch(() => prompt("Copy your profile link:", link));
}

// =====================================================
//  14. STATS (may counting animation)
// =====================================================
function buildStats() {
  if (mode !== "mine") return;
  const boxes = [
    { label: "Total files", icon: ICON.files, n: FILES.length },
    { label: "Public", icon: ICON.public, n: FILES.filter(f => f.is_public).length },
    { label: "Private", icon: ICON.private, n: FILES.filter(f => !f.is_public).length },
    { label: "Categories", icon: ICON.folder, n: categories().length }
  ];
  $("stats").innerHTML = boxes.map((b, i) => `
    <div class="stat" style="animation-delay:${i * 60}ms">
      <span>${b.icon}${b.label}</span>
      <b data-n="${b.n}">0</b>
    </div>`).join("");

  $("stats").querySelectorAll("b").forEach(el => {
    const target = +el.dataset.n;
    const start = performance.now();
    const step = now => {
      const p = Math.min((now - start) / 700, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// =====================================================
//  15. MGA FILE CARD (grid o list)
// =====================================================
function render() {
  const q = $("search").value.trim().toLowerCase();
  const list = FILES.filter(f => {
    if (filter === "public" && !f.is_public) return false;
    if (filter === "private" && f.is_public) return false;
    if (filter.startsWith("cat:") && f.category !== filter.slice(4)) return false;
    return `${f.title} ${f.note || ""} ${f.category}`.toLowerCase().includes(q);
  });

  const titles = { all: "All files", public: "Public files", private: "Private files" };
  if (owner || mode === "mine") $("page-title").textContent = titles[filter] || filter.slice(4);

  $("empty").hidden = list.length > 0;
  if (!list.length) {
    if (FILES.length) {
      $("empty-title").textContent = "No matching files";
      $("empty-text").textContent = "Try a different search or category.";
    } else if (mode === "mine") {
      $("empty-title").textContent = "No files yet";
      $("empty-text").textContent = "Click Upload to add your first certificate, reviewer, or project.";
    } else if (owner) {
      $("empty-title").textContent = "No public files yet";
      $("empty-text").textContent = "This user hasn't shared any files.";
    }
  }

  $("grid").innerHTML = list.map((f, i) => {
    const t = getType(f.path);
    const T = TYPES[t];
    const url = URLS[f.path];
    const thumb = t === "image" && url
      ? `<img src="${url}" alt="" loading="lazy">`
      : `<div class="file-icon" style="--c:${T.color}"><b>${T.label}</b></div>`;
    const date = new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    const badge = mode === "mine" ? `<span class="badge">${f.is_public ? "🌐 Public" : "🔒 Private"}</span>` : "";

    return `
      <article class="card ${newIds.has(f.id) ? "is-new" : ""}" style="animation-delay:${Math.min(i, 12) * 35}ms" data-id="${f.id}">
        ${view === "grid" ? badge : ""}
        <div class="thumb">${thumb}</div>
        <div class="info">
          <div>
            <h3>${esc(f.title)}</h3>
            ${f.note ? `<p>${esc(f.note)}</p>` : ""}
          </div>
          ${view === "list" ? badge : ""}
          <div class="meta">
            <span class="chip" style="--c:${catColor(f.category)}">${esc(f.category)}</span>
            <time>${date}</time>
          </div>
        </div>
      </article>`;
  }).join("");

  $("grid").querySelectorAll(".card").forEach(card => {
    card.onclick = () => openPreview(FILES.find(f => f.id === card.dataset.id));
  });
}

$("search").oninput = render;

// =====================================================
//  16. POP-UP WINDOWS
// =====================================================
function openModal(id) {
  $(id).hidden = false;
  requestAnimationFrame(() => $(id).classList.add("show"));
}

function closeModal(id) {
  if (id === "upload" && uploading) return; // huwag isara habang nag-a-upload
  $(id).classList.remove("show");
  setTimeout(() => ($(id).hidden = true), 250);
}

document.querySelectorAll(".modal").forEach(m => {
  m.addEventListener("click", e => {
    if (m.id === "recovery") return;
    if (e.target === m || e.target.closest("[data-close]")) closeModal(m.id);
  });
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.querySelectorAll(".modal.show").forEach(m => m.id !== "recovery" && closeModal(m.id));
});

// =====================================================
//  17. PREVIEW
// =====================================================
function openPreview(f) {
  selected = f;
  const t = getType(f.path);
  const url = URLS[f.path] || "#";
  const isOwner = user && user.id === f.owner_id;

  $("p-title").textContent = f.title;
  $("p-meta").textContent = [f.category, f.note, isOwner ? (f.is_public ? "🌐 Public" : "🔒 Private") : ""].filter(Boolean).join(" · ");
  $("p-open").href = url;
  $("p-download").href = url;
  $("p-download").hidden = t === "link";
  $("p-owner").hidden = !isOwner;
  $("p-delete").dataset.confirm = "";
  $("p-delete").textContent = "Delete";

  if (t === "image") $("p-body").innerHTML = `<img src="${url}" alt="">`;
  else if (t === "pdf") $("p-body").innerHTML = `<iframe src="${url}"></iframe>`;
  else if (t === "link") $("p-body").innerHTML = `<div class="no-preview">🔗 ${esc(url)}</div>`;
  else $("p-body").innerHTML = `<div class="no-preview">No preview for this file type.<br>Use Open or Download.</div>`;

  openModal("preview");
}

// Delete: dalawang click para siguradong sinadya
$("p-delete").onclick = async () => {
  const btn = $("p-delete");
  if (btn.dataset.confirm !== "yes") {
    btn.dataset.confirm = "yes";
    btn.textContent = "Click again to delete";
    setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Delete"; }, 3000);
    return;
  }
  busy(btn, true);
  if (!selected.path.startsWith("http")) await db.storage.from("vault").remove([selected.path]);
  const { error } = await db.from("files").delete().eq("id", selected.id);
  busy(btn, false);
  btn.dataset.confirm = "";
  btn.textContent = "Delete";
  if (error) { toast("Delete failed: " + error.message); return; }

  closeModal("preview");
  toast("File deleted 🗑️");
  openMyLibrary();
};

// =====================================================
//  18. EDIT DETAILS NG FILE
// =====================================================
$("p-edit").onclick = () => {
  $("e-title").value = selected.title;
  $("e-category").value = selected.category;
  $("e-note").value = selected.note || "";
  document.querySelector(`input[name="evis"][value="${selected.is_public ? "public" : "private"}"]`).checked = true;
  $("edit-msg").textContent = "";
  fillCategoryList();
  closeModal("preview");
  setTimeout(() => openModal("edit"), 200);
};

$("edit-form").onsubmit = async e => {
  e.preventDefault();
  const btn = e.submitter;
  busy(btn, true);
  const { error } = await db.from("files").update({
    title: $("e-title").value.trim(),
    category: $("e-category").value.trim(),
    note: $("e-note").value.trim() || null,
    is_public: document.querySelector('input[name="evis"]:checked').value === "public"
  }).eq("id", selected.id);
  busy(btn, false);

  if (error) { $("edit-msg").textContent = error.message; return; }
  closeModal("edit");
  toast("Changes saved ✏️");
  newIds = new Set([selected.id]);
  openMyLibrary();
};

// =====================================================
//  19. EDIT PROFILE (pangalan at picture)
// =====================================================
function openProfileEditor() {
  $("pf-avatar").innerHTML = avatarHTML(me, "xl");
  $("pf-name").value = me.display_name;
  $("pf-username").value = me.username;
  $("profile-msg").textContent = "";
  openModal("profile");
}

$("pf-photo").onclick = () => $("avatar-file").click();

$("profile-form").onsubmit = async e => {
  e.preventDefault();
  const btn = e.submitter;
  const name = $("pf-name").value.trim();
  busy(btn, true);
  const { error } = await db.from("profiles").update({ display_name: name }).eq("id", user.id);
  busy(btn, false);
  if (error) { $("profile-msg").textContent = error.message; return; }
  me.display_name = name;
  closeModal("profile");
  toast("Profile updated 👤");
  buildSidebar();
};

$("avatar-file").onchange = async () => {
  const file = $("avatar-file").files[0];
  $("avatar-file").value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) { toast("Please choose an image."); return; }
  if (file.size > 5 * 1024 * 1024) { toast("Photo must be under 5 MB."); return; }

  const avatarEl = $("pf-avatar").querySelector(".avatar");
  avatarEl?.classList.add("busy");
  busy($("pf-photo"), true);

  const ext = file.name.split(".").pop().toLowerCase();
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const { error } = await db.storage.from("avatars").upload(path, file, { contentType: file.type });
  if (error) {
    avatarEl?.classList.remove("busy");
    busy($("pf-photo"), false);
    toast("Photo upload failed: " + error.message);
    return;
  }

  const old = me.avatar_path;
  await db.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (old) db.storage.from("avatars").remove([old]);
  me.avatar_path = path;

  $("pf-avatar").innerHTML = avatarHTML(me, "xl");
  busy($("pf-photo"), false);
  buildSidebar();
  toast("Profile photo updated 📸");
};

// =====================================================
//  20. MULTI-UPLOAD na may progress bar
// =====================================================
let queue = [];        // mga file/link na ia-upload
let uploading = false;
let qid = 0;

function fillCategoryList() {
  $("cat-list").innerHTML = [...new Set(["Certificates", "Reviewers", "Projects", ...categories()])]
    .map(c => `<option value="${esc(c)}">`).join("");
}

$("upload-open").onclick = () => {
  resetUpload();
  fillCategoryList();
  openModal("upload");
};

function resetUpload() {
  queue.forEach(item => item.preview && URL.revokeObjectURL(item.preview));
  queue = [];
  $("upload-form").reset();
  $("queue").innerHTML = "";
  $("upload-msg").textContent = "";
  $("overall").hidden = true;
  const btn = $("upload-submit");
  btn.className = "btn primary";
  updateUploadButton();
}

function addFiles(fileList) {
  for (const file of fileList) {
    if (queue.length >= MAX_FILES) { toast(`You can upload up to ${MAX_FILES} files at once.`); break; }
    const item = {
      id: ++qid,
      kind: "file",
      file,
      title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim(),
      status: file.size > MAX_SIZE ? "error" : "ready",
      error: file.size > MAX_SIZE ? "Larger than 20 MB" : "",
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null
    };
    queue.push(item);
    $("queue").insertAdjacentHTML("beforeend", queueItemHTML(item));
    bindQueueItem(item);
  }
  updateUploadButton();
}

function addLink() {
  const url = $("u-link").value.trim();
  if (!/^https?:\/\/\S+\.\S+/.test(url)) { toast("Enter a valid link that starts with https://"); return; }
  if (queue.length >= MAX_FILES) { toast(`You can upload up to ${MAX_FILES} items at once.`); return; }
  let title = url;
  try { const u = new URL(url); title = (u.hostname + u.pathname).replace(/\/$/, ""); } catch (e) {}
  const item = { id: ++qid, kind: "link", url, title, status: "ready", error: "" };
  queue.push(item);
  $("queue").insertAdjacentHTML("beforeend", queueItemHTML(item));
  bindQueueItem(item);
  $("u-link").value = "";
  updateUploadButton();
}

function queueItemHTML(item) {
  const t = item.kind === "link" ? "link" : getType(item.file.name);
  const T = TYPES[t];
  const thumb = item.preview ? `<img src="${item.preview}" alt="">` : T.label;
  const sub = item.kind === "link" ? item.url : `${item.file.name} · ${formatSize(item.file.size)}`;
  return `
    <li class="q-item ${item.status}" id="q-${item.id}">
      <div class="q-thumb" style="--c:${T.color}">${thumb}</div>
      <div class="q-body">
        <input value="${esc(item.title)}" maxlength="120" aria-label="Title">
        <span class="q-sub">${item.error ? "⚠ " + esc(item.error) : esc(sub)}</span>
        <div class="q-bar"><i></i></div>
      </div>
      <div class="q-side">
        <button type="button" class="q-remove" aria-label="Remove">${ICON.x}</button>
      </div>
    </li>`;
}

function bindQueueItem(item) {
  const el = $("q-" + item.id);
  el.querySelector("input").oninput = e => { item.title = e.target.value; updateUploadButton(); };
  el.querySelector(".q-remove").onclick = () => {
    queue = queue.filter(q => q !== item);
    if (item.preview) URL.revokeObjectURL(item.preview);
    el.classList.add("removing");
    el.addEventListener("animationend", () => el.remove(), { once: true });
    updateUploadButton();
  };
}

function updateUploadButton() {
  const ready = queue.filter(q => q.status === "ready" || q.status === "failed");
  const btn = $("upload-submit");
  if (uploading) return;
  btn.disabled = ready.length === 0;
  btn.textContent = ready.length > 1 ? `Upload ${ready.length} items` : "Upload";
}

// Pagpili ng file at drag-and-drop
$("u-files").onchange = () => { addFiles($("u-files").files); $("u-files").value = ""; };
$("u-link-add").onclick = addLink;
$("u-link").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); addLink(); } };

const drop = $("drop");
drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
drop.ondragleave = () => drop.classList.remove("over");
drop.ondrop = e => {
  e.preventDefault();
  drop.classList.remove("over");
  addFiles(e.dataTransfer.files);
};

// Upload na may totoong porsyento (XMLHttpRequest)
async function uploadWithProgress(path, file, onProgress) {
  const { data: { session } } = await db.auth.getSession();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SUPABASE_URL}/storage/v1/object/vault/${path}`);
    xhr.setRequestHeader("Authorization", "Bearer " + session.access_token);
    xhr.setRequestHeader("apikey", SUPABASE_KEY);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = "Upload failed";
      try { message = JSON.parse(xhr.responseText).message || message; } catch (e) {}
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Network error. Check your connection."));
    xhr.send(file);
  });
}

function setItemState(item, status, text) {
  item.status = status;
  const el = $("q-" + item.id);
  if (!el) return;
  el.className = "q-item " + status;
  const side = el.querySelector(".q-side");
  if (status === "uploading") side.innerHTML = `<span class="q-pct">0%</span>`;
  if (status === "done") side.innerHTML = ICON.check;
  if (status === "failed") side.innerHTML = `<span class="q-err">!</span>`;
  if (text !== undefined) el.querySelector(".q-sub").textContent = text;
  el.querySelector("input").disabled = status === "uploading" || status === "done";
}

function setItemProgress(item, fraction) {
  const el = $("q-" + item.id);
  if (!el) return;
  const pct = Math.round(fraction * 100);
  el.querySelector(".q-bar i").style.width = pct + "%";
  const label = el.querySelector(".q-pct");
  if (label) label.textContent = pct + "%";
}

$("upload-form").onsubmit = async e => {
  e.preventDefault();
  const category = $("u-category").value.trim();
  const note = $("u-note").value.trim() || null;
  const isPublic = document.querySelector('input[name="vis"]:checked').value === "public";
  const todo = queue.filter(q => q.status === "ready" || q.status === "failed");

  if (!category) { $("upload-msg").textContent = "Please enter a category."; $("u-category").focus(); return; }
  if (todo.some(q => !q.title.trim())) { $("upload-msg").textContent = "Every item needs a title."; return; }
  $("upload-msg").textContent = "";

  uploading = true;
  const btn = $("upload-submit");
  busy(btn, true);
  $("overall").hidden = false;

  // Kabuuang laki para sa overall progress bar
  const sizes = todo.map(q => (q.kind === "file" ? q.file.size : 1));
  const total = sizes.reduce((a, b) => a + b, 0) || 1;
  let finishedBytes = 0;
  const added = [];

  for (let i = 0; i < todo.length; i++) {
    const item = todo[i];
    $("overall-text").textContent = `Uploading ${i + 1} of ${todo.length}…`;
    setItemState(item, "uploading");

    try {
      let path = item.url;
      if (item.kind === "file") {
        const safeName = item.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        path = `${user.id}/${Date.now()}-${safeName}`;
        await uploadWithProgress(path, item.file, fraction => {
          setItemProgress(item, fraction);
          $("overall-bar").style.width = ((finishedBytes + fraction * sizes[i]) / total) * 100 + "%";
        });
      }

      const { data, error } = await db.from("files").insert({
        title: item.title.trim(),
        category,
        note,
        path,
        file_type: item.kind === "file" ? item.file.type : "link",
        is_public: isPublic
      }).select("id").single();

      if (error) {
        if (item.kind === "file") await db.storage.from("vault").remove([path]);
        throw error;
      }

      added.push(data.id);
      setItemProgress(item, 1);
      setItemState(item, "done", "Uploaded");
    } catch (err) {
      setItemState(item, "failed", "⚠ " + err.message);
    }

    finishedBytes += sizes[i];
    $("overall-bar").style.width = (finishedBytes / total) * 100 + "%";
  }

  uploading = false;
  busy(btn, false);
  const failed = todo.filter(q => q.status === "failed").length;

  if (added.length) {
    newIds = new Set(added);
    openMyLibrary();
  }

  if (failed === 0) {
    $("overall-text").textContent = `All done! ${added.length} item${added.length === 1 ? "" : "s"} uploaded.`;
    btn.className = "btn success";
    btn.textContent = "✓ Done";
    btn.disabled = true;
    setTimeout(() => {
      closeModal("upload");
      toast(`${added.length} item${added.length === 1 ? "" : "s"} uploaded ✅`);
    }, 900);
  } else {
    $("overall-text").textContent = `${added.length} uploaded, ${failed} failed.`;
    btn.textContent = `Retry ${failed} failed`;
    btn.disabled = false;
  }
};
