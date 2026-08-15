import os
import sqlite3
import time
from pathlib import Path
from functools import wraps
from flask import Flask, jsonify, request, session, render_template
from werkzeug.utils import secure_filename

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "school.db"
RANKCARD_DIR = BASE_DIR / "static" / "uploads" / "rankcards"
GALLERY_DIR = BASE_DIR / "static" / "uploads" / "gallery"
RANKCARD_DIR.mkdir(parents=True, exist_ok=True)
GALLERY_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__, template_folder="templates", static_folder="static")
app.secret_key = os.environ.get("SECRET_KEY", "change-this-secret-key")
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024

ADMIN_NAME = os.environ.get("ADMIN_NAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")
IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif"}
MEDIA_EXTENSIONS = IMAGE_EXTENSIONS | {"mp4", "webm", "mov"}

def db():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c

def init_db():
    c = db()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      class_name TEXT NOT NULL,
      roll_no TEXT NOT NULL UNIQUE,
      attendance_days REAL DEFAULT 0,
      total_days REAL DEFAULT 0,
      rank TEXT DEFAULT '',
      remarks TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS marks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      score REAL DEFAULT 0,
      grade TEXT DEFAULT '',
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS rank_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      exam_name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      date TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS homework (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_name TEXT NOT NULL,
      subject TEXT NOT NULL,
      task TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      media_type TEXT NOT NULL,
      url TEXT
    );
    CREATE TABLE IF NOT EXISTS school_details (
      id INTEGER PRIMARY KEY CHECK(id=1),
      hero_sub TEXT DEFAULT '',
      about_story TEXT DEFAULT '',
      address TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      office_hours TEXT DEFAULT ''
    );
    """)
    if c.execute("SELECT COUNT(*) n FROM students").fetchone()["n"] == 0:
        c.executemany(
            "INSERT INTO students(name,class_name,roll_no) VALUES(?,?,?)",
            [
                ("R. Abdul Azeem","XI - Vision","1"),
                ("A. Arun Jecab","XI - Vision","2"),
                ("S. Dinesh Kumar","XI - Vision","3"),
                ("B. Karthikeyan","XI - Vision","4"),
                ("D. Monishwaran","XI - Vision","5"),
                ("K. Naveen","XI - Vision","6"),
                ("V. Prasanna Shanmugam","XI - Vision","7"),
            ]
        )
    if c.execute("SELECT COUNT(*) n FROM school_details").fetchone()["n"] == 0:
        c.execute("""INSERT INTO school_details
          (id,hero_sub,about_story,address,phone,email,office_hours)
          VALUES(1,?,?,?,?,?,?)""", (
          "Good Shepherd Matriculation Higher Secondary School has spent nearly four decades shepherding young minds toward curiosity, character and confidence.",
          "Good Shepherd Matriculation Higher Secondary School opened its doors in Korattur in 1986 with a simple aim: guide every child attentively, patiently, and toward good ground.",
          "Good Shepherd Matric. Hr. Sec. School,<br>Korattur, Chennai 600080, Tamil Nadu",
          "+91 44 2679 0000",
          "info@goodshepherdkorattur.edu.in",
          "Mon–Sat, 8:30 AM – 3:30 PM"
        ))
    c.commit()
    c.close()

def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin"):
            return jsonify(error="Admin login required."), 401
        return fn(*args, **kwargs)
    return wrapper

def valid_file(name, allowed):
    return "." in name and name.rsplit(".",1)[1].lower() in allowed

def grade(score):
    s = float(score)
    return "A+" if s >= 90 else "A" if s >= 80 else "B+" if s >= 70 else "B" if s >= 60 else "C" if s >= 50 else "D" if s >= 40 else "E"

def student_json(c, row):
    marks = [dict(r) for r in c.execute(
      "SELECT subject,score,grade FROM marks WHERE student_id=? ORDER BY id", (row["id"],))]
    cards = [dict(r) for r in c.execute(
      "SELECT id,exam_name examName,image_url imageUrl FROM rank_cards WHERE student_id=? ORDER BY id",
      (row["id"],))]
    return {
      "id": row["id"], "name": row["name"], "className": row["class_name"],
      "rollNo": row["roll_no"], "attendanceDays": row["attendance_days"],
      "totalDays": row["total_days"], "rank": row["rank"], "remarks": row["remarks"],
      "marks": marks, "rankCards": cards
    }

@app.get("/")
def home():
    return render_template("index.html")

@app.get("/api/bootstrap")
def bootstrap():
    c = db()
    students = [student_json(c,r) for r in c.execute("SELECT * FROM students ORDER BY id")]
    announcements = [dict(r) for r in c.execute("SELECT id,title,body,date FROM announcements ORDER BY id DESC")]
    gallery = [{"id":r["id"],"label":r["label"],"type":r["media_type"],"url":r["url"]}
               for r in c.execute("SELECT id,label,media_type,url FROM gallery ORDER BY id")]
    homework = [dict(r) for r in c.execute(
      "SELECT id,class_name className,subject,task,timestamp FROM homework ORDER BY id DESC")]
    d = c.execute("SELECT * FROM school_details WHERE id=1").fetchone()
    details = {
      "heroSub": d["hero_sub"] if d else "", "aboutStory": d["about_story"] if d else "",
      "address": d["address"] if d else "", "phone": d["phone"] if d else "",
      "email": d["email"] if d else "", "officeHours": d["office_hours"] if d else ""
    }
    c.close()
    return jsonify(students=students, announcements=announcements, gallery=gallery,
                   homework=homework, schoolDetails=details)

@app.post("/api/auth/student/login")
def student_login():
    d = request.get_json(silent=True) or {}
    name, roll = (d.get("name") or "").strip(), (d.get("rollNo") or "").strip()
    c = db()
    row = c.execute("SELECT * FROM students WHERE lower(name)=lower(?) AND roll_no=?", (name,roll)).fetchone()
    if not row:
        c.close()
        return jsonify(error="Invalid student name or roll number."), 401
    session["student_id"] = row["id"]
    out = student_json(c,row)
    c.close()
    return jsonify(student=out)

@app.post("/api/auth/admin/login")
def admin_login():
    d = request.get_json(silent=True) or {}
    if d.get("username") != ADMIN_NAME or d.get("password") != ADMIN_PASSWORD:
        return jsonify(error="Invalid admin credentials."), 401
    session["admin"] = True
    return jsonify(ok=True)

@app.post("/api/auth/admin/logout")
def admin_logout():
    session.pop("admin",None)
    return jsonify(ok=True)

@app.put("/api/students/<int:sid>")
@admin_required
def update_student(sid):
    d = request.get_json(silent=True) or {}
    c = db()
    row = c.execute("SELECT * FROM students WHERE id=?", (sid,)).fetchone()
    if not row:
        c.close()
        return jsonify(error="Student not found."),404
    c.execute("""UPDATE students SET attendance_days=?,total_days=?,remarks=? WHERE id=?""",
      (float(d.get("attendanceDays",row["attendance_days"])),
       float(d.get("totalDays",row["total_days"])),
       d.get("remarks",row["remarks"]),sid))
    if isinstance(d.get("marks"),list):
        c.execute("DELETE FROM marks WHERE student_id=?",(sid,))
        for m in d["marks"]:
            subject = str(m.get("subject","")).strip()
            if subject:
                score = float(m.get("score",0))
                c.execute("INSERT INTO marks(student_id,subject,score,grade) VALUES(?,?,?,?)",
                          (sid,subject,score,m.get("grade") or grade(score)))
    c.commit(); c.close()
    return jsonify(ok=True)

@app.post("/api/students/<int:sid>/rankcards")
@admin_required
def add_rankcard(sid):
    c = db()
    if not c.execute("SELECT 1 FROM students WHERE id=?",(sid,)).fetchone():
        c.close(); return jsonify(error="Student not found."),404
    exam = (request.form.get("examName") or "").strip()
    f = request.files.get("file")
    if not exam or not f or not f.filename:
        c.close(); return jsonify(error="Exam name and rank-card image are required."),400
    if not valid_file(f.filename,IMAGE_EXTENSIONS):
        c.close(); return jsonify(error="Only image files are allowed."),400
    name = f"student_{sid}_{int(time.time()*1000)}_{secure_filename(f.filename)}"
    f.save(RANKCARD_DIR/name)
    url = f"/static/uploads/rankcards/{name}"
    c.execute("INSERT INTO rank_cards(student_id,exam_name,image_url) VALUES(?,?,?)",(sid,exam,url))
    c.commit(); c.close()
    return jsonify(ok=True,imageUrl=url)

@app.delete("/api/students/<int:sid>/rankcards/<int:cid>")
@admin_required
def delete_rankcard(sid,cid):
    c = db()
    row = c.execute("SELECT image_url FROM rank_cards WHERE id=? AND student_id=?",(cid,sid)).fetchone()
    if not row:
        c.close(); return jsonify(error="Rank card not found."),404
    c.execute("DELETE FROM rank_cards WHERE id=? AND student_id=?",(cid,sid))
    c.commit(); c.close()
    p = BASE_DIR / row["image_url"].lstrip("/")
    if p.exists(): p.unlink()
    return jsonify(ok=True)

@app.get("/api/students/<int:sid>/ai-insight")
@admin_required
def ai_insight(sid):
    return jsonify(insight="Keep encouraging steady effort and consistent preparation.")

@app.post("/api/announcements")
@admin_required
def add_announcement():
    d = request.get_json(silent=True) or {}
    title, body = (d.get("title") or "").strip(), (d.get("body") or "").strip()
    if not title or not body: return jsonify(error="Title and body are required."),400
    import datetime
    c=db(); c.execute("INSERT INTO announcements(title,body,date) VALUES(?,?,?)",(title,body,datetime.date.today().isoformat()))
    c.commit(); c.close(); return jsonify(ok=True)

@app.delete("/api/announcements/<int:aid>")
@admin_required
def delete_announcement(aid):
    c=db(); c.execute("DELETE FROM announcements WHERE id=?",(aid,)); c.commit(); c.close()
    return jsonify(ok=True)

@app.post("/api/homework")
@admin_required
def add_homework():
    d=request.get_json(silent=True) or {}
    vals=((d.get("className") or "").strip(),(d.get("subject") or "").strip(),(d.get("task") or "").strip(),int(time.time()*1000))
    if not all(vals[:3]): return jsonify(error="Class, subject and task are required."),400
    c=db(); c.execute("INSERT INTO homework(class_name,subject,task,timestamp) VALUES(?,?,?,?)",vals); c.commit(); c.close()
    return jsonify(ok=True)

@app.put("/api/school-details")
@admin_required
def school_details():
    d=request.get_json(silent=True) or {}
    c=db(); c.execute("""UPDATE school_details SET hero_sub=?,about_story=?,address=?,phone=?,email=?,office_hours=? WHERE id=1""",
      (d.get("heroSub",""),d.get("aboutStory",""),d.get("address",""),d.get("phone",""),d.get("email",""),d.get("officeHours","")))
    c.commit(); c.close(); return jsonify(ok=True)

@app.post("/api/gallery")
@admin_required
def add_gallery():
    label=(request.form.get("label") or "").strip()
    typ=(request.form.get("type") or "image").strip()
    url=(request.form.get("url") or "").strip()
    f=request.files.get("file")
    if not label: return jsonify(error="Caption is required."),400
    if f and f.filename:
        if not valid_file(f.filename,MEDIA_EXTENSIONS): return jsonify(error="Unsupported media type."),400
        name=f"{int(time.time()*1000)}_{secure_filename(f.filename)}"; f.save(GALLERY_DIR/name)
        url=f"/static/uploads/gallery/{name}"
    if not url: return jsonify(error="Choose a file or provide a media URL."),400
    c=db(); c.execute("INSERT INTO gallery(label,media_type,url) VALUES(?,?,?)",(label,typ,url)); c.commit(); c.close()
    return jsonify(ok=True)

@app.delete("/api/gallery/<int:gid>")
@admin_required
def delete_gallery(gid):
    c=db(); row=c.execute("SELECT url FROM gallery WHERE id=?",(gid,)).fetchone()
    c.execute("DELETE FROM gallery WHERE id=?",(gid,)); c.commit(); c.close()
    if row:
        p=BASE_DIR/row["url"].lstrip("/")
        if p.exists(): p.unlink()
    return jsonify(ok=True)

@app.get("/health")
def health(): return jsonify(ok=True)

init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT","5000")), debug=True)
