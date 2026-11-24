# Money Course Studio

A study site for a 24-week personal-finance and investing course: syllabus, lecture notes and readings, a calendar, quizzes and flashcards, five practice simulators, a dictionary, an AI teacher, and a journal for the real-money lab. Progress checks and a daily "Today" list show what's done and what's due.

Live (after the first deploy): https://myownfinanceclass.web.app

## How it's built

- `public/index.html` is the whole app, one file with no build step. All course content is built into the page.
- `public/firebase-config.js` holds the Firebase web config. It is public by design; `firestore.rules` protects the data.
- **Firestore** stores one small document per student at `users/{uid}`, as `{ s: "<compact JSON>", t: <time> }`. The rules cap each document at about 195 KB. A typical student uses under 20 KB, so the 1 GiB free tier fits tens of thousands of students.
- **Sign-in** uses Google, through Firebase Authentication.
- **Learn tab**: every unit is a guided 5-step lesson (core concepts → go deeper → 3-question quiz → AI coaching on weak spots → homework with journal). Opens after you save your schedule.
- **AI teacher** (optional) is a Cloud Function at `/api/teacher` (`functions/index.js`). It keeps your Anthropic API key on the server and answers signed-in students only. It can call 8 read-only tools (progress, phase-quiz answers, lesson-quiz answers, journal, real-money log, scorecard, paper portfolio, week content). The tools run in the page against your own saved data; the function only relays Claude's requests and stores nothing.

## One-time setup to finish deployment

Already done: the Firebase project `myownfinanceclass`, the web app, the Firestore database with its rules, and Google sign-in.

To turn on automatic deploys, do these steps once:

1. In the Firebase console, go to **Project settings → Service accounts → Generate new private key**. This downloads a JSON file.
2. In GitHub, open this repo and go to **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: paste the whole JSON file.
3. Go to **Actions → Deploy to Firebase → Run workflow**. Every push to `main` deploys again after that.

Delete the downloaded JSON file afterwards. Never commit it.

## Optional: the AI teacher on the hosted site

The teacher needs the Firebase **Blaze** (pay-as-you-go) plan, because Cloud Functions call an outside API. With the Firebase CLI:

```
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase deploy --only functions
```

Without it, everything else still works. The teacher page explains that it's off.

## Run locally

```
cd public && python3 -m http.server 8000
```
