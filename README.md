# GymTracker

Log your workouts set by set, rest with the built-in timer and compete with your friends to see who trains most and who improves most. Available in English and Spanish.

**Live:** <https://cruzlorite.github.io/gymtracker/>

## Features

- **Set-by-set logging**: big − and + buttons for weight and reps, pre-filled from your last session. Each set is saved with one tap; tap a set to edit or delete it. Deleting a set or a whole exercise takes one tap and offers Undo.
- **Rest timer**: starts automatically when you save a set and alerts you with sound and vibration. Keeps the screen awake while it runs.
- **Exercise library**: about 290 exercises in 12 muscle groups, named as gym-goers say them in each language, with search by aliases (RDL, OHP, Gironda, Scott…) and a recent section. Each group can add its own exercises.
- **Personal records** flagged with a trophy as you log them, plus per-exercise history, bests and a chart (estimated 1RM, max weight, volume or max reps).
- **Group**: attendance, improvement, streak and volume rankings; challenges (attendance, volume, improvement, sets, reps, max weight, records); profiles; a shared calendar; progress charts. The creator can rename or delete the group, see pending invitations and remove members.
- **No lost sets**: every set shows up instantly and syncs to the sheet in the background. If you're offline or your Google session expires, it stays on the device and syncs once you're back.
- **Opens instantly**: the app remembers the session and keeps a copy of the open group on the device, so reopening it (e.g. the installed app) goes straight to your workout. A valid Google token is reused for up to an hour; after that, saving a set renews it in the background (no prompt, since access was already granted).
- **Installable** on your phone's home screen (PWA manifest), with an in-app prompt: one tap on Android, step-by-step on iOS. Light and dark themes.

It's a **frontend-only** app: HTML, CSS and JavaScript with no build step and no server. It's published as a static site on GitHub Pages, and the data lives in **Google Sheets**, in the Drive of whoever creates each group.

## How it works

- **Sign-in**: Google Identity Services (OAuth in the browser). With the user's token, the browser calls the Sheets and Drive APIs directly.
- **Minimal permissions**: it only asks for `drive.file`, so the app can only see sheets it created or that the user picked with Google's file picker. It can't read the rest of their Drive.
- **One group = one spreadsheet** named `GymTracker · <name>`:

  | Tab | Contents |
  |---|---|
  | `_group` | Schema version and app tag (protected: only the group creator can edit it) |
  | `_members` | `email, name, picture, joined` |
  | `_challenges` | `id, title, type, exercise, start, end, created_by`; `type` is `attendance`, `volume`, `improvement`, `sets`, `reps`, `maxWeight` or `prs` |
  | `_exercises` | The group's custom exercises: `name, category, created_by` |
  | `<email>` (one per person) | `id, date, exercise, sets, reps, weight_kg, notes`, one row per set (`sets` = 1). A row with no exercise is an attendance-only day. Protected so only its owner can edit it |

- **Schema version**: new sheets are tagged `schema=2` in their Drive `appProperties`, and the app only lists sheets with that tag.
- **Exercise names**: library exercises are stored under their English name and translated for display. A group can mix people using the app in either language.
- **Invites**: only the group creator can invite. The app shares the sheet from their Drive (*editor* role) and Google emails the `?group=<id>` link. The first time, the invitee picks the sheet in the file picker so the app gets access to it. Other members can't re-share it (`writersCanShare: false`).
- **Demo mode**: the *Try the demo* button uses made-up in-memory data and works with no setup.

## Project structure

```
index.html            single page
privacy.html          privacy policy in both languages (linked from the app and the consent screen)
manifest.webmanifest  home-screen install
icons/                app icon (SVG and PNG)
styles.css            styles (light/dark themes, mobile and desktop)
config.js             public Google Cloud IDs
js/app.js             state, views and actions
js/i18n.js            English and Spanish strings
js/exercises.js       exercise library by muscle group (EN/ES) and custom exercises
js/outbox.js          queue of changes waiting to sync (persisted in the browser)
js/timer.js           rest timer
js/icons.js           SVG icons
js/google.js          sign-in, Drive, Sheets and Picker (SheetStore)
js/demo.js            DemoStore: same interface as SheetStore, in memory
js/stats.js           pure calculations (attendance, volume, 1RM, streaks, records, challenges)
vendor/               Chart.js served from the repo (hash verified in vendor/README.md)
```

## Google setup

In the [Google Cloud Console](https://console.cloud.google.com/):

1. **Create a project**, or reuse one. Note its **project number** (on the dashboard; digits only).
2. **Enable the APIs** (*APIs & Services → Library*): **Google Sheets API**, **Google Drive API** and **Google Picker API**.
3. **OAuth consent screen** (*Google Auth Platform*):
   - User type: *External*.
   - Scopes: `openid`, `email`, `profile` and `.../auth/drive.file`. None of them are sensitive, so no Google verification is needed.
   - Under *Branding*, set the privacy policy link to `https://<your-user>.github.io/<repo>/privacy.html`.
   - While in *Testing* mode, only users you add as *test users* can sign in. To open it to anyone, click *Publish app* (see [Security and privacy](#security-and-privacy)).
   - **Don't link a billing account to the project.** It isn't needed, and that way nobody can run up charges.
4. **Create an OAuth client ID** (*Credentials → Create credentials → OAuth client ID*):
   - Type: *Web application*.
   - Authorized JavaScript origins:
     - `https://<your-user>.github.io`
     - `http://localhost:8000` (for local development)
   - No redirect URIs are needed.
5. **Create an API key** (*Credentials → Create credentials → API key*). Only the file picker uses it. Restrict it:
   - Application restriction: *Websites*, with `https://<your-user>.github.io/*` and `http://localhost:8000/*`.
   - API restriction: *Google Picker API* only.
6. **Fill in [config.js](config.js)**:

   ```js
   export const CONFIG = {
     CLIENT_ID: '1234567890-abc123.apps.googleusercontent.com',
     API_KEY: 'AIza...',
     APP_ID: '1234567890',   // project number
     APP_TAG: 'gymtracker',
   };
   ```

   These values are public by design: the browser needs them, and they give no access to any data without the user's sign-in. The authorized origins and the key restrictions are what protect them. There are no secrets in the repo.

## Local development

ES modules don't work when opening the file via `file://`, so you need a static server:

```sh
python3 -m http.server 8000
```

Open <http://localhost:8000>. The port must match the origin authorized in step 4.

## Deploying to GitHub Pages

1. Push the repo to GitHub on the `main` branch.
2. Under *Settings → Pages → Build and deployment*, choose **Source: GitHub Actions**.
3. Every push to `main` deploys via [.github/workflows/pages.yml](.github/workflows/pages.yml). The site is served at `https://<your-user>.github.io/<repo>/`.

All paths are relative, so it works the same under a subdirectory (`/<repo>/`) or on a custom domain. If you use a custom domain, add it to the authorized origins and the API key restrictions too.

## Security and privacy

### Recommended setup

- **OAuth app in *Testing* mode**, with members added as test users (100 max). The site is public, but only those people can sign in.
- **Google Cloud project without billing.**
- **2FA on GitHub and protection on `main`**: anyone who can publish to this repo can ship code that sees every user's Google token.
- **No CDN dependencies**: Chart.js is served from [vendor/](vendor/). The only external scripts are Google's (sign-in and Picker), which don't support SRI because Google updates them.

### What the app protects

- **Minimal permissions.** It only asks for `drive.file`: a stolen token only reaches that person's GymTracker sheets.
- **No XSS from sheet data.** Everything read from the sheet is escaped before rendering.
- **Profile pictures.** Only pictures from `*.googleusercontent.com` are loaded, so nobody can put their own URL in the sheet and see the IP of everyone opening the app.
- **Personal tabs.** Each tab is protected in its owner's name. If someone creates a tab named after another person's email, the app ignores and flags it in two cases: when the tab isn't protected, and when viewed by the sheet owner or by the impersonated person, the only ones who can see the protection's editors. The impersonated person also can't join until that tab is deleted.
- **Membership.** A row in `_members` without a valid tab doesn't count as a member.
- **Malformed data.** Invalid dates and challenges (e.g. edited by hand) are ignored instead of breaking the view.
- **Duplicate rows.** If a network retry duplicates a row, the app shows it once, and editing or deleting the set affects every copy.

### What it can't protect (accepted risks)

- Every group member can see and download the whole sheet (everyone's emails and workouts).
- The group creator owns the sheet and can edit or delete any data.
- Any member can edit `_members`, `_challenges` and `_exercises`, e.g. change someone's display name or delete challenges. Sheets keeps a version history to recover changes.
- Everyone logs whatever they want in their own tab: cheating is trivial.
- The Google access token is kept in the browser's local storage for up to one hour, and a copy of the open group's data stays on the device until sign-out. Anyone with access to that browser profile could read them; a stolen token only reaches the user's GymTracker sheets and expires within the hour.
- The Cloud project's name and support email appear on the sign-in screen.
- If the Cloud project is deleted or Google changes its APIs, sign-in stops working. The data stays in the sheets.

## License

[MIT](LICENSE).
