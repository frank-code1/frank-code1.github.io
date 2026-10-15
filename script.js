// =====================================================
//  JENNIFER · File Organizer
// =====================================================

// ---------- 1. KONEKSYON SA SUPABASE ----------
// Publishable key lang ang ilalagay dito, HINDI ang secret key.
const SUPABASE_URL = "https://hcthaljffidexwkxscos.supabase.co";
const SUPABASE_KEY = "sb_publishable_LhVIzaXVL10gVCGQmXQzYg_8C1s60Zp";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- 2. STATE (kasalukuyang kalagayan ng app) ----------
const viewUsername = new URLSearchParams(location.search).get("u"); // ?u=username
let user = null;        // ang naka-login
let me = null;          // profile ng naka-login
let owner = null;       // profile na tinitingnan
let mode = null;        // "mine" = sariling files, "public" = profile ng iba
let FILES = [];
let URLS = {};          // path → link para mabuksan ang file
let filter = "all";
let selected = null;

const $ = id => document.getElementById(id);

function esc(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.classList.add("show");
  clearTimeout(t.timer);
  t.timer = setTimeout(() => t.classList.remove("show"), 2600);
}

function show(view) {
  $("view-auth").hidden = view !== "auth";
  $("view-app").hidden = view !== "app";
}

document.querySelectorAll(".year").forEach(el => (el.textContent = new Date().getFullYear()));

// ---------- 3. ICONS ----------
const ICON = {
  all:     '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  public:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  private: '<svg viewBox="0 0 24 24"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  camera:  '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  link:    '<svg viewBox="0 0 24 24"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  logout:  '<svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
  home:    '<svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/></svg>',
  login:   '<svg viewBox="0 0 24 24"><path d="M9 4H5v16h4M14 8l4 4-4 4M18 12H8"/></svg>',
  files:   '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>',
  folder:  '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'
};

// ---------- 4. URI NG FILE AT KULAY NG CATEGORY ----------
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

// ---------- 5. AVATAR ----------
function avatarHTML(profile, size = "") {
  const initials = (profile?.display_name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const img = profile?.avatar_path
    ? `<img src="${db.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl}" alt="" onerror="this.remove()">`
    : "";
  return `<span class="avatar ${size}">${esc(initials)}${img}</span>`;
}

// =====================================================
//  6. ROUTING: alin ang ipapakita?
// =====================================================
async function route() {
  if (viewUsername) return openPublicProfile(viewUsername);
  if (user) return openMyLibrary();
  show("auth");
}

// Tumatakbo pagbukas ng page at tuwing mag-sign in o sign out
db.auth.onAuthStateChange((event, session) => {
  user = session?.user ?? null;
  if (["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT"].includes(event)) {
    setTimeout(route, 0);
  }
});

// =====================================================
//  7. SIGN IN AT CREATE ACCOUNT
// =====================================================
document.querySelectorAll(".tab").forEach(tab => {
  tab.onclick = () => {
    const isSignup = tab.dataset.tab === "signup";
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === tab));
    document.querySelector(".tabs").classList.toggle("second", isSignup);
    $("signin-form").hidden = isSignup;
    $("signup-form").hidden = !isSignup;
    const shown = isSignup ? $("signup-form") : $("signin-form");
    shown.classList.remove("switching");
    void shown.offsetWidth;
    shown.classList.add("switching");
  };
});

$("signin-form").onsubmit = async e => {
  e.preventDefault();
  const msg = $("si-msg");
  const btn = e.submitter;
  msg.className = "msg";
  msg.textContent = "";
  btn.disabled = true;

  const { error } = await db.auth.signInWithPassword({
    email: $("si-email").value.trim(),
    password: $("si-password").value
  });

  btn.disabled = false;
  if (error) { msg.textContent = error.message; return; }
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

  btn.disabled = true;
  msg.textContent = "";

  // Tingnan kung may gumagamit na ng username
  const { data: taken } = await db.from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) {
    msg.textContent = "That username is already taken.";
    btn.disabled = false;
    return;
  }

  const { data, error } = await db.auth.signUp({
    email: $("su-email").value.trim(),
    password: $("su-password").value,
    options: { data: { username, display_name: $("su-name").value.trim() } }
  });

  btn.disabled = false;
  if (error) {
    msg.textContent = error.message.includes("Database error")
      ? "That username is already taken."
      : error.message;
    return;
  }

  $("signup-form").reset();
  if (!data.session) {
    msg.className = "msg ok";
    msg.textContent = "Account created! Check your email to confirm, then sign in.";
  }
};

// =====================================================
//  8. BUKSAN ANG SARILING LIBRARY
// =====================================================
async function openMyLibrary() {
  mode = "mine";
  show("app");
  $("profile-head").hidden = true;
  $("upload-open").hidden = false;
  $("stats").hidden = false;
  $("eyebrow").textContent = "My library";

  const { data: profile } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
  me = owner = profile;

  const { data, error } = await db.from("files").select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  await setFiles(error ? [] : data);
  if (error) toast("Could not load files: " + error.message);
}

// =====================================================
//  9. BUKSAN ANG PUBLIC PROFILE (?u=username)
// =====================================================
async function openPublicProfile(username) {
  mode = "public";
  show("app");
  $("upload-open").hidden = true;
  $("stats").hidden = true;
  $("eyebrow").textContent = "@" + username;

  if (user) {
    const { data } = await db.from("profiles").select("*").eq("id", user.id).maybeSingle();
    me = data;
  }

  const { data: profile } = await db.from("profiles").select("*").eq("username", username.toLowerCase()).maybeSingle();
  owner = profile;

  if (!profile) {
    $("profile-head").hidden = true;
    await setFiles([]);
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
  $("profile-head").hidden = false;
  $("profile-head").innerHTML = `
    ${avatarHTML(profile, "xl")}
    <div>
      <h2>${esc(profile.display_name)}</h2>
      <p>@${esc(profile.username)} · ${data?.length ?? 0} public file${data?.length === 1 ? "" : "s"}</p>
    </div>
    <span class="spacer"></span>
    ${isMe ? `<a class="btn ghost" href="${location.pathname}">Back to my library</a>` : ""}
    <button class="btn primary" id="copy-link">${ICON.link} Copy link</button>`;
  $("copy-link").onclick = copyProfileLink;

  await setFiles(data ?? []);
}

// =====================================================
//  10. KUNIN ANG MGA LINK NG FILE
//  Private ang storage, kaya gumagawa ng pansamantalang link (1 oras)
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

  if (!categories().includes(filter.replace("cat:", "")) && filter.startsWith("cat:")) filter = "all";
  buildSidebar();
  buildStats();
  render();
}

function categories() {
  return [...new Set(FILES.map(f => f.category))].sort((a, b) => a.localeCompare(b));
}

// =====================================================
//  11. SIDEBAR
// =====================================================
function navItem(key, icon, label, count, color) {
  const dot = color ? `<span class="dot" style="--c:${color}"></span>` : icon;
  return `<button class="nav-item ${filter === key ? "active" : ""}" data-key="${esc(key)}">
            ${dot}<span>${esc(label)}</span><span class="count">${count}</span>
          </button>`;
}

function buildSidebar() {
  const count = fn => FILES.filter(fn).length;
  let html = `<p class="nav-label">Library</p>`;
  html += navItem("all", ICON.all, "All files", FILES.length);
  if (mode === "mine") {
    html += navItem("public", ICON.public, "Public", count(f => f.is_public));
    html += navItem("private", ICON.private, "Private", count(f => !f.is_public));
  }
  if (categories().length) {
    html += `<p class="nav-label">Categories</p>`;
    categories().forEach(c => {
      html += navItem("cat:" + c, "", c, count(f => f.category === c), catColor(c));
    });
  }
  $("nav").innerHTML = html;
  $("nav").querySelectorAll(".nav-item").forEach(btn => {
    btn.onclick = () => { filter = btn.dataset.key; buildSidebar(); render(); };
  });

  // User card sa ibaba
  const card = $("user-card");
  if (user && me) {
    card.innerHTML = `
      <div class="user-row">
        ${avatarHTML(me)}
        <div><b>${esc(me.display_name)}</b><small>@${esc(me.username)}</small></div>
      </div>
      <div class="user-actions">
        ${mode === "public" ? `<a class="nav-item" href="${location.pathname}">${ICON.home}<span>My library</span></a>` : ""}
        <button class="nav-item" id="act-photo">${ICON.camera}<span>Change photo</span></button>
        <button class="nav-item" id="act-share">${ICON.link}<span>Share profile</span></button>
        <button class="nav-item" id="act-logout">${ICON.logout}<span>Sign out</span></button>
      </div>`;
    $("act-photo").onclick = () => $("avatar-file").click();
    $("act-share").onclick = copyProfileLink;
    $("act-logout").onclick = async () => { await db.auth.signOut(); toast("Signed out"); };
  } else {
    card.innerHTML = `
      <div class="user-actions">
        <a class="btn primary block" href="${location.pathname}">${ICON.login} Sign in or create account</a>
      </div>`;
  }
}

function copyProfileLink() {
  const name = mode === "public" && owner ? owner.username : me?.username;
  const link = `${location.origin}${location.pathname}?u=${name}`;
  navigator.clipboard.writeText(link)
    .then(() => toast("Profile link copied! Only public files are shown."))
    .catch(() => prompt("Copy your profile link:", link));
}

// =====================================================
//  12. STATS
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

  // Counting animation
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
//  13. MGA FILE CARD
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
      <article class="card" style="animation-delay:${Math.min(i, 12) * 40}ms" data-id="${f.id}">
        ${badge}
        <div class="thumb">${thumb}</div>
        <div class="info">
          <h3>${esc(f.title)}</h3>
          ${f.note ? `<p>${esc(f.note)}</p>` : ""}
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
//  14. POP-UP WINDOWS
// =====================================================
function openModal(id) {
  $(id).hidden = false;
  requestAnimationFrame(() => $(id).classList.add("show"));
}

function closeModal(id) {
  $(id).classList.remove("show");
  setTimeout(() => ($(id).hidden = true), 250);
}

document.querySelectorAll(".modal").forEach(m => {
  m.addEventListener("click", e => {
    if (e.target === m || e.target.closest("[data-close]")) closeModal(m.id);
  });
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") document.querySelectorAll(".modal.show").forEach(m => closeModal(m.id));
});

// =====================================================
//  15. PREVIEW
// =====================================================
function openPreview(f) {
  selected = f;
  const t = getType(f.path);
  const url = URLS[f.path] || "#";
  const isOwner = user && user.id === f.owner_id;

  $("p-title").textContent = f.title;
  $("p-meta").textContent = [f.category, f.note].filter(Boolean).join(" · ");
  $("p-open").href = url;
  $("p-download").href = url;
  $("p-download").hidden = t === "link";
  $("p-owner").hidden = !isOwner;
  $("p-visibility").textContent = f.is_public ? "🔒 Make private" : "🌐 Make public";

  if (t === "image") $("p-body").innerHTML = `<img src="${url}" alt="">`;
  else if (t === "pdf") $("p-body").innerHTML = `<iframe src="${url}"></iframe>`;
  else if (t === "link") $("p-body").innerHTML = `<div class="no-preview">🔗 ${esc(url)}</div>`;
  else $("p-body").innerHTML = `<div class="no-preview">No preview for this file type.<br>Use Open or Download.</div>`;

  openModal("preview");
}

// Palitan ang Public / Private
$("p-visibility").onclick = async () => {
  const next = !selected.is_public;
  const { error } = await db.from("files").update({ is_public: next }).eq("id", selected.id);
  if (error) { toast("Could not update: " + error.message); return; }
  selected.is_public = next;
  $("p-visibility").textContent = next ? "🔒 Make private" : "🌐 Make public";
  toast(next ? "Now public 🌐" : "Now private 🔒");
  buildSidebar();
  buildStats();
  render();
};

// Delete: dalawang click para siguradong sinadya
$("p-delete").onclick = async () => {
  const btn = $("p-delete");
  if (btn.dataset.confirm !== "yes") {
    btn.dataset.confirm = "yes";
    btn.textContent = "Click again to delete";
    setTimeout(() => { btn.dataset.confirm = ""; btn.textContent = "Delete"; }, 3000);
    return;
  }
  btn.dataset.confirm = "";
  btn.textContent = "Delete";

  if (!selected.path.startsWith("http")) await db.storage.from("vault").remove([selected.path]);
  const { error } = await db.from("files").delete().eq("id", selected.id);
  if (error) { toast("Delete failed: " + error.message); return; }

  closeModal("preview");
  toast("File deleted");
  openMyLibrary();
};

// =====================================================
//  16. UPLOAD
// =====================================================
$("upload-open").onclick = () => {
  $("cat-list").innerHTML = [...new Set(["Certificates", "Reviewers", "Projects", ...categories()])]
    .map(c => `<option value="${esc(c)}">`).join("");
  openModal("upload");
};

function pickFile(file) {
  if (!file) return;
  $("drop-text").textContent = file.name;
  if (!$("u-title").value) $("u-title").value = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}
$("u-file").onchange = () => pickFile($("u-file").files[0]);

const drop = $("drop");
drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
drop.ondragleave = () => drop.classList.remove("over");
drop.ondrop = e => {
  e.preventDefault();
  drop.classList.remove("over");
  $("u-file").files = e.dataTransfer.files;
  pickFile(e.dataTransfer.files[0]);
};

$("upload-form").onsubmit = async e => {
  e.preventDefault();
  const file = $("u-file").files[0];
  const link = $("u-link").value.trim();
  const msg = $("upload-msg");
  msg.className = "msg";

  if (!file && !link) { msg.textContent = "Choose a file or add a link."; return; }
  if (file && file.size > 20 * 1024 * 1024) { msg.textContent = "File is larger than 20 MB."; return; }

  $("upload-submit").disabled = true;
  $("upload-submit").textContent = "Uploading…";
  msg.textContent = "";

  let path = link;

  // a) I-upload ang file sa sariling folder ng user
  if (file) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    path = `${user.id}/${Date.now()}-${safeName}`;
    const { error } = await db.storage.from("vault").upload(path, file, { contentType: file.type });
    if (error) return uploadDone("Upload failed: " + error.message);
  }

  // b) Isulat ang detalye sa database
  const { error } = await db.from("files").insert({
    title: $("u-title").value.trim(),
    category: $("u-category").value.trim(),
    note: $("u-note").value.trim() || null,
    path,
    file_type: file ? file.type : "link",
    is_public: document.querySelector('input[name="vis"]:checked').value === "public"
  });

  if (error) {
    if (file) await db.storage.from("vault").remove([path]);
    return uploadDone("Saving failed: " + error.message);
  }

  $("upload-form").reset();
  $("drop-text").textContent = "Click to choose or drag a file here";
  uploadDone("");
  closeModal("upload");
  toast("Uploaded successfully ✅");
  openMyLibrary();
};

function uploadDone(errorText) {
  $("upload-msg").textContent = errorText;
  $("upload-submit").disabled = false;
  $("upload-submit").textContent = "Upload";
}

// =====================================================
//  17. PROFILE PHOTO
// =====================================================
$("avatar-file").onchange = async () => {
  const file = $("avatar-file").files[0];
  $("avatar-file").value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) { toast("Please choose an image."); return; }
  if (file.size > 5 * 1024 * 1024) { toast("Photo must be under 5 MB."); return; }

  toast("Uploading photo…");
  const ext = file.name.split(".").pop().toLowerCase();
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;
  const { error } = await db.storage.from("avatars").upload(path, file, { contentType: file.type });
  if (error) { toast("Photo upload failed: " + error.message); return; }

  const old = me.avatar_path;
  const { error: saveError } = await db.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (saveError) { toast("Could not save photo: " + saveError.message); return; }
  if (old) db.storage.from("avatars").remove([old]);

  me.avatar_path = path;
  if (owner?.id === me.id) owner.avatar_path = path;
  toast("Profile photo updated 📸");
  route();
};