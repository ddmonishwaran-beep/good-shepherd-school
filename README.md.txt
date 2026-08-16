# Good Shepherd — Server-backed Rank Cards

Student login now shows only:
1. Student name
2. Class
3. Roll number
4. Exam name + rank-card photo

Admin can open a student record and add/remove an exam rank-card image.

The important fix is the backend: data is stored in `school.db` on the server and rank-card images are stored under `static/uploads/rankcards/`. The browser is not the permanent database, so updates are shared across devices that access the same deployed server.

## Run
```bash
pip install -r requirements.txt
python app.py
```
Open `http://127.0.0.1:5000`.

Default local admin:
- name: `admin`
- password: `admin123`

For deployment, change these using environment variables:
`ADMIN_NAME`, `ADMIN_PASSWORD`, `SECRET_KEY`.

Put your existing school logo at `static/logo.png`.


## Admission enquiry email

Every submitted Admission Enquiry is saved in the server database and is also emailed to:

`ddmonishwaran@gmail.com`

The website uses Gmail SMTP from the backend. Do NOT put a Gmail password in HTML/JavaScript.

Before running the website, configure these server environment variables:

- `GMAIL_SENDER` = the Gmail account that will send the messages
- `GMAIL_APP_PASSWORD` = the 16-character Google App Password for that sender account

Example on Windows PowerShell:
```powershell
$env:GMAIL_SENDER="your-sending-gmail@gmail.com"
$env:GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
python app.py
```

Example on Linux/macOS:
```bash
export GMAIL_SENDER="your-sending-gmail@gmail.com"
export GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
python app.py
```

For Gmail, use an App Password rather than your normal Gmail password. The App Password is generated from the Google account's security settings after enabling 2-Step Verification.

The recipient is fixed in the backend as `ddmonishwaran@gmail.com`.


### Database note
You do **not** need to open, edit, or manually create `school.db`.
When `python app.py` starts, SQLite automatically creates `school.db` beside `app.py` if it does not already exist, and `init_db()` creates all required tables and initial student/school data.
