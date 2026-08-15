/* =========================================================
   GOOD SHEPHERD MATRIC. HR. SEC. SCHOOL — SCRIPT.JS
   Talks to the Flask/SQLite backend (see /backend) so that any change
   an admin makes — student marks/attendance, homework, announcements,
   gallery, school details — is saved to the server database and shown
   to every visitor of the site, not just stored in one browser.
   ========================================================= */

const API_BASE = ""; // same origin as the page (Flask serves both)

async function apiRequest(path, { method = "GET", body = null, isForm = false } = {}) {
  const opts = { method, credentials: "same-origin", headers: {} };
  if (body !== null) {
    if (isForm) {
      opts.body = body; // FormData — browser sets the correct multipart header
    } else {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
  }
  const res = await fetch(API_BASE + path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) { /* no JSON body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function flashNote(el, message, ok = true, timeout = 3000) {
  if (!el) return;
  el.style.color = ok ? "var(--green)" : "var(--red, #c0392b)";
  el.textContent = message;
  if (timeout) setTimeout(() => { el.textContent = ""; }, timeout);
}

function totalMarksOf(student) {
  return student.marks.reduce((sum, m) => sum + Number(m.score || 0), 0);
}

/* ---------------------------------------------------------
   IN-MEMORY CACHE OF SERVER DATA
   (populated by loadBootstrap(), which every render function reads from)
   --------------------------------------------------------- */
let DB = { students: [], announcements: [], gallery: [], classHomework: [], schoolDetails: {} };

async function loadBootstrap() {
  const data = await apiRequest("/api/bootstrap");
  DB.students = data.students || [];
  DB.announcements = data.announcements || [];
  DB.gallery = data.gallery || [];
  DB.classHomework = data.homework || [];
  DB.schoolDetails = data.schoolDetails || {};
}

/* Clean up expired homework (older than 24 hrs) — filtered client-side from
   whatever the server currently has on record. */
function getActiveHomeworkForClass(className) {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  return (DB.classHomework || []).filter(
    hw => hw.className === className && (now - hw.timestamp < TWENTY_FOUR_HOURS)
  );
}

const facilities = [
  { icon: "📚", title: "Library", desc: "Over 8,000 titles across fiction, reference and exam prep." },
  { icon: "🧪", title: "Science Labs", desc: "Physics, Chemistry and Biology labs equipped for board practicals." },
  { icon: "💻", title: "Computer Lab", desc: "40-seat lab with up-to-date systems for CS classes." },
  { icon: "🏐", title: "Sports Ground", desc: "A full-size ground for athletics, football and Sports Day." },
  { icon: "🚌", title: "Transport", desc: "School bus routes covering Korattur and surrounding areas." },
  { icon: "🍽️", title: "Dining Hall", desc: "Supervised dining space serving nutritious mid-day meals." },
  { icon: "🎭", title: "Auditorium", desc: "Indoor hall for assemblies and cultural celebrations." },
  { icon: "⛪", title: "Prayer Hall", desc: "Quiet space reflecting school values, open for assembly." },
  { icon: "🩺", title: "Medical Room", desc: "First-aid room staffed during school hours." }
];

const GALLERY_GRADIENTS = [
  "linear-gradient(135deg,#0E1A47,#1B2A63)",
  "linear-gradient(135deg,#F0B429,#F4C95D)",
  "linear-gradient(135deg,#2F9E5B,#57BE7E)",
  "linear-gradient(135deg,#1B2A63,#3A4C9C)",
  "linear-gradient(135deg,#B0762A,#F0B429)",
  "linear-gradient(135deg,#081029,#0E1A47)"
];

/* ---------------------------------------------------------
   AUTH & ROUTING
   --------------------------------------------------------- */
let currentUser = null;
let selectedLoginRole = "student";

function showView(viewName) {
  if (viewName === "student-dashboard" && !(currentUser && currentUser.role === "student")) viewName = "login";
  if (viewName === "admin-dashboard" && !(currentUser && currentUser.role === "admin")) viewName = "login";

  document.querySelectorAll(".view").forEach(el => el.classList.add("hidden"));
  const target = document.getElementById("view-" + viewName);
  if (target) target.classList.remove("hidden");

  document.querySelectorAll(".nav-link").forEach(el => {
    el.classList.toggle("active", el.dataset.nav === viewName);
  });

  const mainNav = document.getElementById("mainNav");
  if (mainNav) mainNav.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (e) => {
  const link = e.target.closest("[data-nav]");
  if (!link) return;
  const target = link.dataset.nav;
  if (!target) return;
  e.preventDefault();
  showView(target);
});

// Mobile nav toggle
document.getElementById("navToggle").addEventListener("click", () => {
  document.getElementById("mainNav").classList.toggle("open");
});

/* ---------------------------------------------------------
   PUBLIC RENDERING
   --------------------------------------------------------- */
function renderHomeAnnouncements() {
  const list = document.getElementById("homeAnnouncementsList");
  if (!list) return;
  list.innerHTML = "";
  DB.announcements.slice(0, 3).forEach(a => {
    const li = document.createElement("li");
    li.innerHTML = `<div><span class="ann-title">${a.title}</span>${a.body}</div>`;
    list.appendChild(li);
  });
}

function renderFacilities() {
  const grid = document.getElementById("facilitiesGrid");
  if (!grid) return;
  grid.innerHTML = "";
  facilities.forEach(f => {
    const card = document.createElement("div");
    card.className = "facility-card";
    card.innerHTML = `<span class="facility-icon">${f.icon}</span><h4>${f.title}</h4><p>${f.desc}</p>`;
    grid.appendChild(card);
  });
}

function renderGallery() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;
  grid.innerHTML = "";
  DB.gallery.forEach(g => {
    const tile = document.createElement("div");
    tile.className = "gallery-tile";

    if (g.type === "video" && g.url) {
      tile.innerHTML = `<video src="${g.url}" muted loop playsinline></video><span class="tile-label">▶ ${g.label}</span>`;
    } else if (g.url) {
      tile.style.backgroundImage = `url(${g.url})`;
      tile.innerHTML = `<span class="tile-label">${g.label}</span>`;
    } else {
      tile.style.background = GALLERY_GRADIENTS[g.id % GALLERY_GRADIENTS.length];
      tile.innerHTML = `<span class="tile-label">${g.label}</span>`;
    }

    tile.addEventListener("click", () => openGalleryModal(g));
    grid.appendChild(tile);
  });
}

/* Gallery Modal & Zooming */
let currentZoomLevel = 1;

function openGalleryModal(media) {
  const modal = document.getElementById("galleryModal");
  const modalBody = document.getElementById("modalBody");
  const modalCaption = document.getElementById("modalCaption");

  currentZoomLevel = 1;
  modalBody.innerHTML = "";
  modalCaption.textContent = media.label;

  if (media.type === "video" && media.url) {
    const video = document.createElement("video");
    video.src = media.url;
    video.controls = true;
    video.autoplay = true;
    video.id = "modalZoomTarget";
    modalBody.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.src = media.url || "";
    if (!media.url) {
      // Color tile canvas fallback
      const canvas = document.createElement("canvas");
      canvas.width = 600; canvas.height = 400;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#0E1A47";
      ctx.fillRect(0, 0, 600, 400);
      ctx.fillStyle = "#F0B429";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(media.label, 300, 200);
      img.src = canvas.toDataURL();
    }
    img.id = "modalZoomTarget";
    modalBody.appendChild(img);
  }

  modal.classList.remove("hidden");
}

function updateZoom() {
  const target = document.getElementById("modalZoomTarget");
  if (target) {
    target.style.transform = `scale(${currentZoomLevel})`;
  }
}

document.getElementById("zoomInBtn").addEventListener("click", () => {
  currentZoomLevel = Math.min(3, currentZoomLevel + 0.25);
  updateZoom();
});

document.getElementById("zoomOutBtn").addEventListener("click", () => {
  currentZoomLevel = Math.max(0.5, currentZoomLevel - 0.25);
  updateZoom();
});

document.getElementById("zoomResetBtn").addEventListener("click", () => {
  currentZoomLevel = 1;
  updateZoom();
});

document.getElementById("modalCloseBtn").addEventListener("click", () => {
  document.getElementById("galleryModal").classList.add("hidden");
});

function applySchoolDetails() {
  const d = DB.schoolDetails || {};
  document.getElementById("heroSubText").textContent = d.heroSub || "";
  document.getElementById("aboutStoryText").textContent = d.aboutStory || "";
  document.getElementById("contactAddress").innerHTML = d.address || "";
  document.getElementById("contactPhone").textContent = d.phone || "";
  document.getElementById("contactEmail").textContent = d.email || "";
  document.getElementById("contactHours").textContent = d.officeHours || "";
}

/* ---------------------------------------------------------
   STUDENT DASHBOARD
   --------------------------------------------------------- */
function renderStudentDashboard() {
  const student = DB.students.find(s => s.id === currentUser.studentId);
  if (!student) return;

  document.getElementById("studentDashName").textContent = student.name;

  document.getElementById("studentProfileCard").innerHTML = `
    <h3>Student Details</h3>
    <div class="profile-row"><span>Name</span><span class="bold-student-login">${escapeHtml(student.name)}</span></div>
    <div class="profile-row"><span>Class</span><span>${escapeHtml(student.className)}</span></div>
    <div class="profile-row"><span>Roll No.</span><span>${escapeHtml(student.rollNo)}</span></div>
  `;

  renderStudentRankCards(student);
}

function renderStudentRankCards(student) {
  const grid = document.getElementById("studentRankCardsGrid");
  if (!grid) return;

  const cards = Array.isArray(student.rankCards) ? student.rankCards : [];
  grid.innerHTML = "";

  if (!cards.length) {
    grid.innerHTML = `<article class="panel rankcard-empty">No rank cards have been uploaded yet.</article>`;
    return;
  }

  cards.forEach(card => {
    const article = document.createElement("article");
    article.className = "rankcard-card";
    article.innerHTML = `
      <h3>${escapeHtml(card.examName)}</h3>
      <div class="rankcard-photo-wrap">
        <img class="rankcard-photo" src="${escapeAttr(card.imageUrl)}" alt="${escapeAttr(card.examName)} rank card">
      </div>
    `;
    grid.appendChild(article);
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[ch]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

/* ---------------------------------------------------------
   ADMIN DASHBOARD
   --------------------------------------------------------- */
function renderAdminDashboard() {
  const totalStudents = DB.students.length;
  const avgAttendance = Math.round(
    DB.students.reduce((sum, s) => sum + ((s.attendanceDays / s.totalDays) * 100), 0) / (totalStudents || 1)
  );
  const avgMarks = Math.round(
    DB.students.reduce((sum, s) => sum + totalMarksOf(s) / s.marks.length, 0) / (totalStudents || 1)
  );

  document.getElementById("adminStats").innerHTML = `
    <div class="stat-shield"><span class="stat-number">${totalStudents}</span><span class="stat-label">Students on Record</span></div>
    <div class="stat-shield"><span class="stat-number">${avgAttendance}%</span><span class="stat-label">Average Attendance</span></div>
    <div class="stat-shield"><span class="stat-number">${avgMarks}</span><span class="stat-label">Average Marks</span></div>
    <div class="stat-shield"><span class="stat-number">${DB.announcements.length}</span><span class="stat-label">Active Announcements</span></div>
  `;

  const container = document.getElementById("adminStudentsGrouped");
  container.innerHTML = "";

  const classesMap = {};
  DB.students.forEach(s => {
    if (!classesMap[s.className]) classesMap[s.className] = [];
    classesMap[s.className].push(s);
  });

  Object.keys(classesMap).forEach(className => {
    const groupCard = document.createElement("div");
    groupCard.className = "class-group-card";
    groupCard.innerHTML = `<h4>Class: ${className}</h4>`;

    const table = document.createElement("table");
    table.className = "data-table";
    table.innerHTML = `
      <thead>
        <tr><th>Student Name</th><th>Roll No.</th><th>Attendance</th><th>Total Marks</th><th>Rank</th><th>Action</th></tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");
    classesMap[className].forEach(s => {
      const pct = Math.round((s.attendanceDays / s.totalDays) * 100) || 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${s.name}</strong></td>
        <td>${s.rollNo}</td>
        <td><strong>${s.attendanceDays}/${s.totalDays}</strong> (${pct}%)</td>
        <td>${totalMarksOf(s)}</td>
        <td>${s.rank || "—"}</td>
        <td><button type="button" class="small-btn" data-edit-student="${s.id}">Edit</button></td>
      `;
      tbody.appendChild(tr);
    });

    groupCard.appendChild(table);
    container.appendChild(groupCard);
  });

  const list = document.getElementById("adminAnnouncementsList");
  list.innerHTML = "";
  [...DB.announcements].reverse().forEach(a => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <span class="item-title">${a.title}</span>
        <span class="item-meta">${a.date}</span>
        <p style="margin:0.4em 0 0;">${a.body}</p>
      </div>
      <button type="button" class="btn-danger" data-remove-announcement="${a.id}">Remove</button>
    `;
    list.appendChild(li);
  });

  fillSchoolDetailsForm();
  renderAdminGalleryList();
}

/* Event delegation for student edit and announcement delete */
document.addEventListener("click", async (e) => {
  const editBtn = e.target.closest("[data-edit-student]");
  if (editBtn) {
    openEditStudentPanel(Number(editBtn.dataset.editStudent));
    return;
  }

  const removeAnnBtn = e.target.closest("[data-remove-announcement]");
  if (removeAnnBtn) {
    const id = Number(removeAnnBtn.dataset.removeAnnouncement);
    try {
      await apiRequest(`/api/announcements/${id}`, { method: "DELETE" });
      await loadBootstrap();
      renderAdminDashboard();
      renderHomeAnnouncements();
    } catch (err) {
      alert(err.message);
    }
    return;
  }
});

/* Edit Student Record */
function openEditStudentPanel(studentId) {
  const student = DB.students.find(s => s.id === studentId);
  if (!student) return;

  document.getElementById("editStudentPanel").classList.remove("hidden");
  document.getElementById("editStudentId").value = student.id;
  document.getElementById("editStudentNameTitle").textContent = student.name + " (" + student.className + ")";
  document.getElementById("editStudentPresentDays").value = student.attendanceDays;
  document.getElementById("editStudentTotalDays").value = student.totalDays;
  document.getElementById("editStudentRemarks").value = student.remarks || "";

  const container = document.getElementById("editStudentMarksContainer");
  container.innerHTML = "";
  student.marks.forEach(m => {
    const label = document.createElement("label");
    label.innerHTML = `${m.subject} Score
      <input type="number" min="0" max="100" class="mark-input" data-subject="${m.subject}" value="${m.score}">`;
    container.appendChild(label);
  });

  renderAdminRankCards(student);
  recalculateEditAttendance();
  document.getElementById("editStudentPanel").scrollIntoView({ behavior: "smooth" });
}

function renderAdminRankCards(student) {
  const list = document.getElementById("studentRankCardsAdminList");
  if (!list) return;
  list.innerHTML = "";

  const cards = Array.isArray(student.rankCards) ? student.rankCards : [];
  if (!cards.length) {
    list.innerHTML = `<p class="muted">No rank cards added for this student.</p>`;
    return;
  }

  cards.forEach(card => {
    const row = document.createElement("div");
    row.className = "rankcard-admin-item";
    row.innerHTML = `
      <div class="rankcard-admin-meta">
        <img class="rankcard-admin-thumb" src="${escapeAttr(card.imageUrl)}" alt="">
        <strong>${escapeHtml(card.examName)}</strong>
      </div>
      <button type="button" class="btn-danger" data-remove-rankcard="${card.id}">Remove</button>
    `;
    list.appendChild(row);
  });
}

document.addEventListener("click", async (e) => {
  const removeBtn = e.target.closest("[data-remove-rankcard]");
  if (!removeBtn) return;

  const studentId = Number(document.getElementById("editStudentId").value);
  const rankCardId = Number(removeBtn.dataset.removeRankcard);
  try {
    await apiRequest(`/api/students/${studentId}/rankcards/${rankCardId}`, { method: "DELETE" });
    await loadBootstrap();
    const student = DB.students.find(s => s.id === studentId);
    renderAdminRankCards(student);
    renderStudentRankCards(student);
    flashNote(document.getElementById("rankCardAdminNote"), "Rank card removed.", true);
  } catch (err) {
    flashNote(document.getElementById("rankCardAdminNote"), err.message, false);
  }
});

document.getElementById("addRankCardBtn").addEventListener("click", async () => {
  const studentId = Number(document.getElementById("editStudentId").value);
  const examName = document.getElementById("newRankCardExam").value.trim();
  const fileInput = document.getElementById("newRankCardFile");
  const note = document.getElementById("rankCardAdminNote");

  if (!studentId || !examName || !fileInput.files[0]) {
    flashNote(note, "Enter the exam name and choose a rank-card image.", false);
    return;
  }

  const formData = new FormData();
  formData.append("examName", examName);
  formData.append("file", fileInput.files[0]);

  try {
    await apiRequest(`/api/students/${studentId}/rankcards`, {
      method: "POST",
      body: formData,
      isForm: true
    });
    await loadBootstrap();
    const student = DB.students.find(s => s.id === studentId);
    renderAdminRankCards(student);
    renderStudentRankCards(student);
    document.getElementById("newRankCardExam").value = "";
    fileInput.value = "";
    flashNote(note, "Rank card saved to the server.", true);
  } catch (err) {
    flashNote(note, err.message, false);
  }
});

function recalculateEditAttendance() {
  const present = parseFloat(document.getElementById("editStudentPresentDays").value) || 0;
  const total = parseFloat(document.getElementById("editStudentTotalDays").value) || 1;
  const pct = Math.min(100, Math.max(0, Math.round((present / total) * 100)));
  document.getElementById("editStudentAttendancePctDisplay").textContent = pct + "%";
}

document.getElementById("editStudentPresentDays").addEventListener("input", recalculateEditAttendance);
document.getElementById("editStudentTotalDays").addEventListener("input", recalculateEditAttendance);

document.getElementById("cancelEditStudentBtn").addEventListener("click", () => {
  document.getElementById("editStudentPanel").classList.add("hidden");
});

/* AI-assisted remark suggestion */
document.getElementById("aiSuggestRemarksBtn").addEventListener("click", async () => {
  const id = Number(document.getElementById("editStudentId").value);
  const note = document.getElementById("aiSuggestNote");
  if (!id) return;
  try {
    note.style.color = "var(--ink-soft, #555)";
    note.textContent = "Generating suggestion…";
    const { insight } = await apiRequest(`/api/students/${id}/ai-insight`);
    document.getElementById("editStudentRemarks").value = insight;
    flashNote(note, "Suggestion inserted — feel free to edit before saving.", true);
  } catch (err) {
    flashNote(note, err.message, false);
  }
});

document.getElementById("editStudentForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = Number(document.getElementById("editStudentId").value);

  const marks = Array.from(document.querySelectorAll("#editStudentMarksContainer .mark-input")).map(input => ({
    subject: input.dataset.subject,
    score: Math.min(100, Math.max(0, parseInt(input.value) || 0))
  }));

  const payload = {
    attendanceDays: parseFloat(document.getElementById("editStudentPresentDays").value) || 0,
    totalDays: parseFloat(document.getElementById("editStudentTotalDays").value) || 1,
    remarks: document.getElementById("editStudentRemarks").value.trim(),
    marks
  };

  try {
    await apiRequest(`/api/students/${id}`, { method: "PUT", body: payload });
    await loadBootstrap();
    document.getElementById("editStudentPanel").classList.add("hidden");
    renderAdminDashboard();
  } catch (err) {
    alert(err.message);
  }
});

/* Admin Assign Homework */
document.getElementById("adminHomeworkForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const className = document.getElementById("hwClassSelect").value;
  const subject = document.getElementById("hwSubjectInput").value.trim();
  const task = document.getElementById("hwTaskInput").value.trim();
  const note = document.getElementById("adminHwNote");

  if (!className || !subject || !task) return;

  try {
    await apiRequest("/api/homework", { method: "POST", body: { className, subject, task } });
    await loadBootstrap();
    flashNote(note, `Homework assigned to ${className}! Auto-expires in 24 hours.`, true);
    e.target.reset();
  } catch (err) {
    flashNote(note, err.message, false);
  }
});

/* Admin Post Announcement */
document.getElementById("announcementForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("announcementTitle").value.trim();
  const body = document.getElementById("announcementBody").value.trim();
  if (!title || !body) return;

  try {
    await apiRequest("/api/announcements", { method: "POST", body: { title, body } });
    await loadBootstrap();
    renderAdminDashboard();
    renderHomeAnnouncements();
    e.target.reset();
  } catch (err) {
    alert(err.message);
  }
});

/* School Details Form */
function fillSchoolDetailsForm() {
  const d = DB.schoolDetails || {};
  document.getElementById("detailHeroSub").value = d.heroSub || "";
  document.getElementById("detailAboutStory").value = d.aboutStory || "";
  document.getElementById("detailAddress").value = (d.address || "").replace(/<br>/g, ", ");
  document.getElementById("detailPhone").value = d.phone || "";
  document.getElementById("detailEmail").value = d.email || "";
  document.getElementById("detailHours").value = d.officeHours || "";
}

document.getElementById("schoolDetailsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const note = document.getElementById("schoolDetailsNote");
  const payload = {
    heroSub: document.getElementById("detailHeroSub").value.trim(),
    aboutStory: document.getElementById("detailAboutStory").value.trim(),
    address: document.getElementById("detailAddress").value.trim().replace(/,\s*/g, "<br>"),
    phone: document.getElementById("detailPhone").value.trim(),
    email: document.getElementById("detailEmail").value.trim(),
    officeHours: document.getElementById("detailHours").value.trim()
  };

  try {
    await apiRequest("/api/school-details", { method: "PUT", body: payload });
    await loadBootstrap();
    applySchoolDetails();
    flashNote(note, "School details updated successfully!", true);
  } catch (err) {
    flashNote(note, err.message, false);
  }
});

/* Gallery Management */
function renderAdminGalleryList() {
  const list = document.getElementById("adminGalleryList");
  if (!list) return;
  list.innerHTML = "";
  DB.gallery.forEach(g => {
    const item = document.createElement("div");
    item.className = "admin-gallery-item";
    item.innerHTML = `
      <span>${g.type === "video" ? "📹 [Video]" : "🖼️ [Image]"} ${g.label}</span>
      <button type="button" class="btn-danger" data-remove-gallery="${g.id}">Remove</button>
    `;
    list.appendChild(item);
  });
}

document.addEventListener("click", async (e) => {
  const removeGalBtn = e.target.closest("[data-remove-gallery]");
  if (removeGalBtn) {
    const id = Number(removeGalBtn.dataset.removeGallery);
    try {
      await apiRequest(`/api/gallery/${id}`, { method: "DELETE" });
      await loadBootstrap();
      renderGallery();
      renderAdminGalleryList();
    } catch (err) {
      alert(err.message);
    }
  }
});

document.getElementById("galleryAddForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const label = document.getElementById("galleryLabel").value.trim();
  const type = document.getElementById("galleryMediaType").value;
  const fileInput = document.getElementById("galleryMediaFile");
  const urlInput = document.getElementById("galleryMediaUrl").value.trim();
  const note = document.getElementById("galleryAddNote");

  if (!label) return;

  const formData = new FormData();
  formData.append("label", label);
  formData.append("type", type);
  if (urlInput) formData.append("url", urlInput);
  if (fileInput.files && fileInput.files[0]) formData.append("file", fileInput.files[0]);

  try {
    await apiRequest("/api/gallery", { method: "POST", body: formData, isForm: true });
    await loadBootstrap();
    renderGallery();
    renderAdminGalleryList();
    e.target.reset();
    flashNote(note, "Media added to gallery!", true);
  } catch (err) {
    flashNote(note, err.message, false);
  }
});

/* ---------------------------------------------------------
   LOGIN SYSTEM (Name + Roll No for students, Username + Password for admin)
   --------------------------------------------------------- */
document.querySelectorAll(".role-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".role-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    selectedLoginRole = tab.dataset.role;

    const studentFields = document.getElementById("studentLoginFields");
    const adminFields = document.getElementById("adminLoginFields");
    const submitBtn = document.getElementById("loginSubmitBtn");
    const errNote = document.getElementById("loginErrorNote");
    errNote.textContent = "";

    if (selectedLoginRole === "student") {
      studentFields.classList.remove("hidden");
      adminFields.classList.add("hidden");
      submitBtn.textContent = "Log In to Student Portal";
    } else {
      studentFields.classList.add("hidden");
      adminFields.classList.remove("hidden");
      submitBtn.textContent = "Log In to Admin Portal";
    }
  });
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errNote = document.getElementById("loginErrorNote");
  errNote.textContent = "";

  if (selectedLoginRole === "student") {
    const name = document.getElementById("studentLoginName").value.trim();
    const rollNo = document.getElementById("studentLoginRoll").value.trim();

    if (!name || !rollNo) {
      errNote.textContent = "Please enter both Student Name and Roll Number.";
      return;
    }

    try {
      const { student } = await apiRequest("/api/auth/student/login", { method: "POST", body: { name, rollNo } });
      await loadBootstrap(); // make sure we have the freshest whole-school data
      currentUser = { role: "student", studentId: student.id };
      updateNavForAuth();
      renderStudentDashboard();
      showView("student-dashboard");
      e.target.reset();
    } catch (err) {
      errNote.textContent = err.message;
    }
  } else {
    const username = document.getElementById("adminUser").value.trim();
    const password = document.getElementById("adminPass").value.trim();

    try {
      await apiRequest("/api/auth/admin/login", { method: "POST", body: { username, password } });
      await loadBootstrap();
      currentUser = { role: "admin" };
      updateNavForAuth();
      renderAdminDashboard();
      showView("admin-dashboard");
      e.target.reset();
    } catch (err) {
      errNote.textContent = err.message;
    }
  }
});

function updateNavForAuth() {
  const loginBtn = document.getElementById("loginNavBtn");
  const accountBtn = document.getElementById("accountNavBtn");

  if (currentUser) {
    loginBtn.classList.add("hidden");
    accountBtn.classList.remove("hidden");
    if (currentUser.role === "student") {
      accountBtn.textContent = "My Portal";
      accountBtn.dataset.nav = "student-dashboard";
    } else {
      accountBtn.textContent = "Admin Area";
      accountBtn.dataset.nav = "admin-dashboard";
    }
  } else {
    loginBtn.classList.remove("hidden");
    accountBtn.classList.add("hidden");
  }
}

document.getElementById("studentLogoutBtn").addEventListener("click", () => {
  currentUser = null;
  updateNavForAuth();
  showView("home");
});

document.getElementById("adminLogoutBtn").addEventListener("click", async () => {
  try { await apiRequest("/api/auth/admin/logout", { method: "POST" }); } catch (e) { /* ignore */ }
  currentUser = null;
  updateNavForAuth();
  showView("home");
});

/* Contact & Admission Forms */
document.getElementById("admissionForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const note = document.getElementById("admissionFormNote");
  const submitBtn = e.target.querySelector('button[type="submit"]');

  const payload = {
    studentName: document.getElementById("admissionStudentName").value.trim(),
    applyingClass: document.getElementById("admissionClass").value,
    guardianName: document.getElementById("admissionGuardianName").value.trim(),
    contactNumber: document.getElementById("admissionContact").value.trim(),
    message: document.getElementById("admissionMessage").value.trim()
  };

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";
    await apiRequest("/api/admissions", { method: "POST", body: payload });

    note.textContent = "Thank you! Your admission enquiry has been sent successfully.";
    note.style.color = "";
    e.target.reset();
  } catch (err) {
    note.textContent = "Sorry, the enquiry could not be sent. Please try again.";
    note.style.color = "#b42318";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Enquiry";
    setTimeout(() => { note.textContent = ""; }, 6000);
  }
});

document.getElementById("contactForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const note = document.getElementById("contactFormNote");
  note.textContent = "Thank you! We will get back to you soon.";
  setTimeout(() => { note.textContent = ""; }, 4000);
  e.target.reset();
});

/* ---------------------------------------------------------
   INIT — load everything from the server before first render
   --------------------------------------------------------- */
(async function initApp() {
  try {
    await loadBootstrap();
  } catch (err) {
    console.error("Failed to load school data from the server:", err);
    alert("Could not connect to the school server. Make sure the backend (python app.py) is running, then reload this page.");
  }
  applySchoolDetails();
  renderHomeAnnouncements();
  renderFacilities();
  renderGallery();
})();
