# Applications System - Setup Guide

## ✅ System Complete!

The full enterprise-level applications system has been built and integrated.

## 🚀 What's Included

### Core Features
- ✅ Public applications homepage at `/applications` with grid view
- ✅ OAuth login required for all access
- ✅ Save progress and resume later functionality
- ✅ Lock applications after submission (prevents duplicates)
- ✅ Status pages showing Pending/Accepted/Denied/Custom

### Form System
- ✅ Interactive form builder at `/applications/admin/builder`
- ✅ Support for 8 question types:
  - Short text
  - Long text
  - Number
  - Dropdown
  - Checkboxes
  - Linear scale (1-5, 1-10, etc.)
  - Ranking (drag-and-drop)
  - File upload (URL-based)

### Admin Dashboard
- ✅ Role-based access (requires management role `1411100904949682236`)
- ✅ View all forms and submission counts
- ✅ Review interface with navigation (arrows, dropdown)
- ✅ Accept/Deny/Custom Status buttons
- ✅ Export submissions (JSON and CSV formats)

### Integrations
- ✅ Roblox account fetching via Bloxlink API
- ✅ Discord notifications to channel `1460375837462237427`
- ✅ Pings management role on new submissions
- ✅ DMs users on review decisions
- ✅ Integrated with `/statistics` command
- ✅ Auto-delete reviewed applications after 30 days

### Security
- ✅ Rate limiting (5 requests/min, 3 submissions/day)
- ✅ Server-side validation and sanitization
- ✅ XSS protection
- ✅ Session-based authentication

## 📁 Files Created

```
database/
  applications.js          - Database schema (5 tables)

utils/
  applicationsManager.js   - Business logic (all CRUD operations)
  rateLimiter.js          - Rate limiting middleware
  validator.js            - Input validation and sanitization

views/
  applicationsHome.js     - Public homepage
  applicationForm.js      - Application form with all question types
  applicationStatus.js    - Status page
  adminDashboard.js       - Admin dashboard
  reviewPage.js           - Review interface
  formBuilder.js          - Form builder UI

public/css/
  applications.css        - Full styling matching ban appeals theme

applicationsServer.js     - All route handlers
```

## 🔧 Environment Variables

Make sure these are set:
```env
CLIENT_ID=1385634318419886162
CLIENT_SECRET=(your Discord OAuth secret)
APPEAL_BASE_URL=https://kcutils.onrender.com
APPEAL_SERVER_PORT=3000
SESSION_SECRET=(optional, auto-generated)
```

## 🎯 Usage

### Creating an Application Form

1. Go to `/applications/admin/builder`
2. Enter form name and description
3. Click question type buttons to add questions
4. Configure each question (text, options, required, etc.)
5. Drag questions to reorder
6. Click "Create Form"

### Reviewing Submissions

1. Go to `/applications/admin`
2. Click "Review (X)" on any form
3. Use arrows or dropdown to navigate between submissions
4. View all applicant info and responses
5. Click Accept/Deny/Custom Status

### Exporting Data

From admin dashboard, click:
- "Export JSON" for full data
- "Export CSV" for spreadsheet format

## 📊 Statistics Integration

The `/statistics` command now includes:
- Applications Submitted
- Applications Accepted
- Applications Denied
- Applications Pending

## 🎨 Styling

All pages use the same royal blue (#2E7EFE) theme as the ban appeals system with:
- Modern card-based layouts
- Smooth animations
- Hover effects
- Responsive design
- Dark theme

## 🔒 Security Features

1. **Rate Limiting**: 5 requests per minute, 3 submissions per day
2. **Input Validation**: All inputs validated on server-side
3. **XSS Protection**: Text sanitized to remove script tags
4. **Auth Required**: All routes require Discord OAuth
5. **Role Checks**: Admin routes require management role
6. **Session Management**: File-based sessions (persistent)

## 🧪 Testing

1. **Create a form**: Visit `/applications/admin/builder`
2. **Apply as user**: Visit `/applications`, login, apply
3. **Review**: Visit `/applications/admin`, review submission
4. **Check Discord**: Verify notifications in channel `1460375837462237427`
5. **Export data**: Download JSON/CSV exports

## 📝 Notes

- Applications auto-delete 30 days after review (accepted/denied)
- Users can only have one active submission per form
- Draft submissions can be edited until submitted
- Submissions are locked after submission
- All review actions are logged to Discord

## 🎉 Ready to Use!

The system is fully integrated and ready to deploy. Just restart the bot and visit:
- Public: `https://kcutils.onrender.com/applications`
- Admin: `https://kcutils.onrender.com/applications/admin`
- Builder: `https://kcutils.onrender.com/applications/admin/builder`
