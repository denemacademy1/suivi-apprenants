/**
 * Booking DENEM Academy — Google Calendar + Firestore
 *
 * 4 endpoints publics :
 *   GET  /googleOAuthStart        → redirige vers Google pour autoriser l'accès
 *   GET  /googleOAuthCallback     → reçoit le code, stocke le refresh token dans Firestore
 *   GET  /bookingSlots?date=Y-M-D → renvoie les créneaux libres du jour (JSON)
 *   POST /bookingCreate           → crée l'event Google + le lead Firestore + envoie l'invite
 *
 * Firestore :
 *   config/booking   → refresh_token Google + réglages (durée, plage horaire, buffer…)
 *   config/assignment→ round-robin closer (partagé avec le setter)
 *   leads/{id}       → lead créé avec sourceCanal='Booking'
 *   bookings/{id}    → log de chaque réservation
 *
 * Secrets :
 *   GOOGLE_OAUTH_CLIENT_ID
 *   GOOGLE_OAUTH_CLIENT_SECRET
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');

const GOOGLE_OAUTH_CLIENT_ID     = defineSecret('GOOGLE_OAUTH_CLIENT_ID');
const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');
const SMTP_USER                  = defineSecret('SMTP_USER'); // ex: contact@denemacademy.com
const SMTP_PASS                  = defineSecret('SMTP_PASS'); // Gmail App Password (16 caractères)

const REGION       = 'europe-west1';
const PROJECT_ID   = 'denem-academy-5de41';
const CALLBACK_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/googleOAuthCallback`;

// Réglages par défaut — surchargeables via Firestore doc `config/booking`
const DEFAULT_CONFIG = {
  event_duration_min: 45,
  work_hours_start:   9,          // 9h Europe/Paris
  work_hours_end:     18,         // 18h Europe/Paris (dernier créneau termine à 18h)
  work_days:          [1,2,3,4,5],// 1=Lundi … 7=Dimanche (ISO)
  buffer_min:         15,
  min_notice_hours:   4,
  max_days_ahead:     14,
  slot_interval_min:  30,
  timezone:           'Europe/Paris',
  event_title:        'RDV Bilan — DENEM Academy',
  calendar_id:        'primary',
  event_description_intro:
`Une poignée de Français, sans background technique, sont en ce moment même en train de faire leur place dans le secteur de l'IA grâce à ce métier d'Expert IA pour les entreprises, grâce à notre méthode DENEM.

Pourquoi pas toi ?

Dans ce RDV d'onboarding orienté IA, on fait le point sur :

-> Ta situation actuelle (Freelance, Salarié, Reconversion...). On te challenge et on t'aide à avoir une vision claire pour te lancer sur cette opportunité.

-> Ta motivation pour te lancer

-> Si tu es le bon profil pour ce métier, afin que tu réussisses à 100%, que tu décroches tes premiers clients rapidement, même sans background technique

Fais comme Baptiste, Ugo, Othmane, Joseph, Grégoire, Enzo, Julie, Alexis... et des dizaines d'autres qui génèrent déjà entre 5 000€ et +50 000€ par mois.

🧑‍💻 Pas de panique, ce n'est pas un appel de vente. C'est un moment d'échange qui t'est dédié pour voir où tu en es et si tu es prêt à te lancer, si toutes les étoiles sont alignées.

⚠️ On ne valide que 10 RDV par semaine sur sélection des candidats, alors complète-le avec sérieux et je te dis à très vite.

🏝️ C'est le moment pour toi de te lancer sur une opportunité concrète et révolutionnaire, pour obtenir liberté et épanouissement au quotidien.`
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function db() { return getFirestore(); }

async function getConfig() {
  const doc = await db().collection('config').doc('booking').get();
  return { ...DEFAULT_CONFIG, ...(doc.exists ? doc.data() : {}) };
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    GOOGLE_OAUTH_CLIENT_ID.value(),
    GOOGLE_OAUTH_CLIENT_SECRET.value(),
    CALLBACK_URL
  );
}

async function getAuthedClient() {
  const doc = await db().collection('config').doc('booking').get();
  const refresh_token = doc.exists ? doc.data().google_refresh_token : null;
  if (!refresh_token) throw new Error('Google Agenda non connecté — va sur la page admin.');
  const client = getOAuthClient();
  client.setCredentials({ refresh_token });
  return client;
}

// Retourne l'offset UTC en minutes pour Europe/Paris à une date donnée (gère DST).
function getParisOffsetMinutes(date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris',
    year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit',
    hour12: false
  });
  const parts = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  // parts.hour peut être "24" pour minuit → normaliser
  const H = parts.hour === '24' ? 0 : parseInt(parts.hour,10);
  const asUTC = Date.UTC(+parts.year, +parts.month-1, +parts.day, H, +parts.minute, +parts.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Convertit une heure locale Paris (y,m,d,h,min) en Date UTC réelle.
function parisToUtc(y, m, d, h, min) {
  // Première approximation : on part de "cette heure en UTC"
  const guess = new Date(Date.UTC(y, m-1, d, h, min));
  const offset = getParisOffsetMinutes(guess);
  return new Date(guess.getTime() - offset * 60000);
}

// 1=Lundi … 7=Dimanche pour un jour Paris (arbitrairement pris à midi UTC-safe)
function isoDayOfWeek(y, m, d) {
  const dt = new Date(Date.UTC(y, m-1, d, 12));
  const jsDay = dt.getUTCDay(); // 0=Dim … 6=Sam
  return jsDay === 0 ? 7 : jsDay;
}

function parseDate(s) {
  const [y,m,d] = s.split('-').map(n => parseInt(n,10));
  return { y, m, d };
}

function pad(n) { return String(n).padStart(2,'0'); }
function fmtTime(h, min) { return `${pad(h)}:${pad(min)}`; }

function corsHeaders(res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  res.set('Access-Control-Max-Age', '3600');
}

// ─────────────────────────────────────────────────────────────
// Email de notification à chaque nouvelle réservation
// (best effort — jamais bloquant pour la création du lead)
// ─────────────────────────────────────────────────────────────
async function sendBookingNotificationEmail({
  toEmail, prenom, nom, email, telephone, message, source_hint, answers, date, time, endTime, meetLink, eventId
}) {
  if (!toEmail) { console.warn('[booking] pas d\'adresse notif → skip email'); return; }
  const smtpUser = SMTP_USER.value();
  const smtpPass = SMTP_PASS.value();
  if (!smtpUser || !smtpPass) {
    console.warn('[booking] SMTP_USER / SMTP_PASS non configurés → skip email');
    return;
  }

  const [y, m, d] = date.split('-').map(n => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m-1, d, 12));
  const dateLabel = dt.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone: 'UTC' });

  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;background:#0D0C14;color:#fff;padding:32px 28px;border-radius:16px">
    <div style="text-align:center;margin-bottom:20px">
      <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(107,91,255,.15);border:1px solid rgba(107,91,255,.3);padding:6px 14px;border-radius:99px;font-size:12px;color:#A5B4FC;font-weight:600;text-transform:uppercase;letter-spacing:.5px">📅 Nouveau RDV réservé</div>
    </div>
    <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;text-align:center">${escapeHtml(prenom)} ${escapeHtml(nom)}</h1>
    <p style="text-align:center;color:rgba(255,255,255,.6);font-size:14px;margin:0 0 24px">a réservé un bilan sur denemacademy.com</p>

    <div style="background:rgba(107,91,255,.08);border:1px solid rgba(107,91,255,.2);border-radius:12px;padding:18px 20px;margin-bottom:16px">
      <div style="display:flex;gap:12px;margin:6px 0;font-size:14px"><span style="color:rgba(255,255,255,.5);min-width:88px">📅 Date</span><span style="color:#fff;font-weight:600">${dateLabel}</span></div>
      <div style="display:flex;gap:12px;margin:6px 0;font-size:14px"><span style="color:rgba(255,255,255,.5);min-width:88px">🕐 Heure</span><span style="color:#fff;font-weight:600">${time} – ${endTime} (Paris)</span></div>
      <div style="display:flex;gap:12px;margin:6px 0;font-size:14px"><span style="color:rgba(255,255,255,.5);min-width:88px">💬 Format</span><span style="color:#fff;font-weight:600">Google Meet</span></div>
    </div>

    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px 20px;margin-bottom:16px">
      <div style="font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;font-weight:600">Coordonnées prospect</div>
      <div style="display:flex;gap:12px;margin:6px 0;font-size:14px"><span style="color:rgba(255,255,255,.5);min-width:88px">📧 Email</span><a href="mailto:${escapeAttr(email)}" style="color:#A5B4FC;text-decoration:none">${escapeHtml(email)}</a></div>
      ${telephone ? `<div style="display:flex;gap:12px;margin:6px 0;font-size:14px"><span style="color:rgba(255,255,255,.5);min-width:88px">📞 Tél</span><a href="tel:${escapeAttr(telephone)}" style="color:#A5B4FC;text-decoration:none">${escapeHtml(telephone)}</a></div>` : ''}
      ${source_hint ? `<div style="display:flex;gap:12px;margin:6px 0;font-size:14px"><span style="color:rgba(255,255,255,.5);min-width:88px">🎯 Source</span><span style="color:#fff;font-weight:600">${escapeHtml(source_hint)}</span></div>` : ''}
    </div>

    ${message ? `
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px 20px;margin-bottom:16px">
      <div style="font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;font-weight:600">Message du prospect</div>
      <div style="font-size:14px;color:rgba(255,255,255,.85);line-height:1.55;white-space:pre-wrap">${escapeHtml(message)}</div>
    </div>` : ''}

    ${Array.isArray(answers) && answers.length ? `
    <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:18px 20px;margin-bottom:16px">
      <div style="font-size:11px;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;font-weight:600">📋 Réponses au questionnaire</div>
      ${answers.map((a,i) => `
        <div style="margin-bottom:14px;padding-bottom:14px;${i < answers.length-1 ? 'border-bottom:1px solid rgba(255,255,255,.06);' : ''}">
          <div style="font-size:12px;color:rgba(255,255,255,.55);margin-bottom:6px;line-height:1.4">${escapeHtml(a.question)}</div>
          <div style="font-size:14px;color:#fff;font-weight:500;line-height:1.5;white-space:pre-wrap">${escapeHtml(a.answer || '—')}</div>
        </div>`).join('')}
    </div>` : ''}

    <div style="text-align:center;margin-top:22px">
      ${meetLink ? `<a href="${escapeAttr(meetLink)}" style="display:inline-block;background:linear-gradient(135deg,#6B5BFF,#EC4899);color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">🎥 Rejoindre le Meet</a>` : ''}
    </div>

    <p style="text-align:center;color:rgba(255,255,255,.3);font-size:11px;margin-top:24px">
      Le lead est déjà créé dans <a href="https://denem.academy/setting" style="color:rgba(255,255,255,.5)">denem.academy/setting</a> avec sourceCanal=Booking.
    </p>
  </div>`;

  const answersText = Array.isArray(answers) && answers.length
    ? '\n\n📋 QUESTIONNAIRE\n' + answers.map((a,i) => `\n${i+1}. ${a.question}\n→ ${a.answer || '(pas de réponse)'}`).join('\n')
    : '';

  const text = `
Nouveau RDV réservé sur denemacademy.com

Prospect : ${prenom} ${nom}
Email    : ${email}
${telephone ? `Téléphone: ${telephone}\n` : ''}${source_hint ? `Source   : ${source_hint}\n` : ''}Date     : ${dateLabel}
Heure    : ${time} - ${endTime} (Europe/Paris)
${meetLink ? `Meet     : ${meetLink}\n` : ''}${message ? `\nMessage:\n${message}\n` : ''}${answersText}
Lead visible dans denem.academy/setting (sourceCanal=Booking)`;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: smtpUser, pass: smtpPass }
  });

  await transporter.sendMail({
    from: `"DENEM Booking" <${smtpUser}>`,
    to: toEmail,
    subject: `📅 Nouveau RDV: ${prenom} ${nom} — ${date} ${time}`,
    text,
    html,
    replyTo: email // répondre = répondre au prospect
  });
}

function escapeHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escapeAttr(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ─────────────────────────────────────────────────────────────
// 1) OAuth start
// ─────────────────────────────────────────────────────────────
exports.googleOAuthStart = onRequest(
  { region: REGION, secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET], maxInstances: 5 },
  async (req, res) => {
    try {
      const client = getOAuthClient();
      const url = client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // force le refresh_token même si l'app était déjà autorisée
        scope: [
          // Scopes SENSITIVE (pas RESTRICTED) — évitent le blocage Google pour app non vérifiée
          'https://www.googleapis.com/auth/calendar.events',   // créer / modifier des events
          'https://www.googleapis.com/auth/calendar.readonly', // lire freebusy
          'https://www.googleapis.com/auth/userinfo.email'
        ]
      });
      res.redirect(url);
    } catch (e) {
      console.error('[googleOAuthStart]', e);
      res.status(500).send('Erreur OAuth : ' + (e.message || 'inconnue'));
    }
  }
);

// ─────────────────────────────────────────────────────────────
// 2) OAuth callback
// ─────────────────────────────────────────────────────────────
exports.googleOAuthCallback = onRequest(
  { region: REGION, secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET], maxInstances: 5 },
  async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('Paramètre "code" manquant.');
    try {
      const client = getOAuthClient();
      const { tokens } = await client.getToken(code);
      if (!tokens.refresh_token) {
        return res.status(400).send(
          `<div style="font-family:system-ui;padding:40px;max-width:640px;margin:auto">
            <h2>⚠️ Refresh token manquant</h2>
            <p>Google n'a pas renvoyé de refresh_token. Cela arrive quand l'app était déjà autorisée.</p>
            <p><strong>Solution :</strong> va sur <a href="https://myaccount.google.com/permissions">https://myaccount.google.com/permissions</a>, révoque "DENEM Academy Booking", puis reclique sur "Connecter Google Agenda".</p>
          </div>`
        );
      }
      client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const info = await oauth2.userinfo.get();
      const email = info.data?.email || '';

      await db().collection('config').doc('booking').set({
        google_refresh_token: tokens.refresh_token,
        google_email: email,
        connected_at: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      res.send(`<!doctype html><meta charset="utf-8"><title>Connecté</title>
        <div style="font-family:system-ui;padding:60px 20px;max-width:520px;margin:auto;text-align:center;color:#0F172A">
          <div style="font-size:56px;margin-bottom:12px">✅</div>
          <h1 style="font-size:24px;margin-bottom:8px">Google Agenda connecté</h1>
          <p style="color:#64748B">Compte : <strong>${email}</strong></p>
          <p style="margin-top:20px;color:#64748B">Tu peux fermer cet onglet.</p>
          <a href="/admin/booking.html" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">← Retour au panneau admin</a>
        </div>`);
    } catch (e) {
      console.error('[googleOAuthCallback]', e);
      res.status(500).send('Erreur callback : ' + (e.message || 'inconnue'));
    }
  }
);

// ─────────────────────────────────────────────────────────────
// 3) Slots libres pour un jour
// ─────────────────────────────────────────────────────────────
exports.bookingSlots = onRequest(
  { region: REGION, secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET], maxInstances: 20 },
  async (req, res) => {
    corsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
      const date = req.query.date;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Paramètre "date" invalide (attendu YYYY-MM-DD)' });
      }

      const cfg = await getConfig();
      const { y, m, d } = parseDate(date);

      // Jour ouvré ?
      const dow = isoDayOfWeek(y, m, d);
      if (!cfg.work_days.includes(dow)) {
        return res.json({ date, slots: [] });
      }

      // Génère les créneaux candidats (heures locales Paris)
      const candidates = [];
      const startMin = cfg.work_hours_start * 60;
      const endMin   = cfg.work_hours_end   * 60;
      const dur      = cfg.event_duration_min;
      const step     = cfg.slot_interval_min;
      for (let mins = startMin; mins + dur <= endMin; mins += step) {
        const h  = Math.floor(mins / 60);
        const mn = mins % 60;
        const startUtc = parisToUtc(y, m, d, h, mn);
        const endUtc   = new Date(startUtc.getTime() + dur * 60000);
        candidates.push({ h, mn, startUtc, endUtc });
      }

      // Filtre : préavis minimum
      const nowMs = Date.now();
      const minStart = nowMs + cfg.min_notice_hours * 3600 * 1000;
      let filtered = candidates.filter(c => c.startUtc.getTime() >= minStart);
      if (!filtered.length) return res.json({ date, slots: [] });

      // Free/busy Google
      const auth   = await getAuthedClient();
      const cal    = google.calendar({ version: 'v3', auth });
      const bufMs  = cfg.buffer_min * 60 * 1000;
      const winStart = new Date(filtered[0].startUtc.getTime() - bufMs);
      const winEnd   = new Date(filtered[filtered.length-1].endUtc.getTime() + bufMs);
      const fb = await cal.freebusy.query({
        requestBody: {
          timeMin: winStart.toISOString(),
          timeMax: winEnd.toISOString(),
          timeZone: cfg.timezone,
          items: [{ id: cfg.calendar_id }]
        }
      });
      const busy = (fb.data.calendars?.[cfg.calendar_id]?.busy || []).map(b => ({
        start: new Date(b.start).getTime(),
        end:   new Date(b.end).getTime()
      }));

      const overlaps = (s, e) => busy.some(b => s < b.end && e > b.start);
      const free = filtered.filter(c => {
        const s = c.startUtc.getTime() - bufMs;
        const e = c.endUtc.getTime()   + bufMs;
        return !overlaps(s, e);
      });

      res.json({
        date,
        timezone: cfg.timezone,
        duration_min: dur,
        slots: free.map(s => ({
          time: fmtTime(s.h, s.mn),
          start_utc: s.startUtc.toISOString(),
          end_utc:   s.endUtc.toISOString()
        }))
      });
    } catch (e) {
      console.error('[bookingSlots]', e);
      res.status(500).json({ error: e.message || 'erreur' });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// 3bis) Config publique (utilisée par la page de booking pour bâtir la grille)
// ─────────────────────────────────────────────────────────────
exports.bookingConfig = onRequest(
  { region: REGION, maxInstances: 20 },
  async (req, res) => {
    corsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    try {
      const cfg = await getConfig();
      res.json({
        max_days_ahead:     cfg.max_days_ahead,
        work_days:          cfg.work_days,
        event_duration_min: cfg.event_duration_min,
        timezone:           cfg.timezone,
        connected:          !!(await db().collection('config').doc('booking').get()).data()?.google_refresh_token
      });
    } catch (e) {
      console.error('[bookingConfig]', e);
      res.status(500).json({ error: e.message || 'erreur' });
    }
  }
);

// ─────────────────────────────────────────────────────────────
// 4) Créer la réservation
// ─────────────────────────────────────────────────────────────
exports.bookingCreate = onRequest(
  { region: REGION, secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, SMTP_USER, SMTP_PASS], maxInstances: 20 },
  async (req, res) => {
    corsHeaders(res);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

    try {
      const { prenom, nom, email, telephone, message, source_hint, date, time, answers } = req.body || {};
      if (!prenom || !nom || !email || !date || !time) {
        return res.status(400).json({ error: 'Champs requis : prenom, nom, email, date, time' });
      }
      // Normalise les answers : soit array [{id,question,answer}], soit undefined
      const answersArr = Array.isArray(answers)
        ? answers.filter(a => a && a.question).map(a => ({
            id: String(a.id||''),
            question: String(a.question||'').trim(),
            answer: String(a.answer||'').trim()
          }))
        : [];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Email invalide' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
        return res.status(400).json({ error: 'Format date/time invalide' });
      }

      const cfg = await getConfig();
      const { y, m, d } = parseDate(date);
      const [h, mn] = time.split(':').map(n => parseInt(n, 10));
      const startUtc = parisToUtc(y, m, d, h, mn);
      const endUtc   = new Date(startUtc.getTime() + cfg.event_duration_min * 60000);

      // Anti double-booking : re-check freebusy
      const auth  = await getAuthedClient();
      const cal   = google.calendar({ version: 'v3', auth });
      const bufMs = cfg.buffer_min * 60 * 1000;
      const fb = await cal.freebusy.query({
        requestBody: {
          timeMin: new Date(startUtc.getTime() - bufMs).toISOString(),
          timeMax: new Date(endUtc.getTime()   + bufMs).toISOString(),
          timeZone: cfg.timezone,
          items: [{ id: cfg.calendar_id }]
        }
      });
      if ((fb.data.calendars?.[cfg.calendar_id]?.busy || []).length) {
        return res.status(409).json({ error: "Ce créneau vient d'être pris. Choisis-en un autre." });
      }

      // Heure de fin en local Paris (pour la construction Google Calendar)
      const endMin = h * 60 + mn + cfg.event_duration_min;
      const endTime = fmtTime(Math.floor(endMin / 60), endMin % 60);

      const summary = `${cfg.event_title} — ${prenom} ${nom}`;
      const answersBlock = answersArr.length
        ? '\n———————————————\n📋 QUESTIONNAIRE\n' + answersArr.map((a,i) =>
            `\n${i+1}. ${a.question}\n→ ${a.answer || '(pas de réponse)'}`
          ).join('\n')
        : '';
      const sourceStr = String(source_hint||'').trim();
      const description = [
        cfg.event_description_intro ? cfg.event_description_intro : null,
        cfg.event_description_intro ? '\n———————————————\n' : null,
        `Prospect : ${prenom} ${nom}`,
        `Email : ${email}`,
        telephone ? `Téléphone : ${telephone}` : null,
        sourceStr ? `Provenance : ${sourceStr}` : null,
        message ? `\nMessage :\n${message}` : null,
        answersBlock || null,
        `\n— Réservé via denemacademy.com`
      ].filter(Boolean).join('\n');

      const requestId = `denem-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

      const evt = await cal.events.insert({
        calendarId: cfg.calendar_id,
        conferenceDataVersion: 1,
        sendUpdates: 'all', // envoie l'invite email au prospect
        requestBody: {
          summary,
          description,
          start: { dateTime: `${date}T${time}:00`, timeZone: cfg.timezone },
          end:   { dateTime: `${date}T${endTime}:00`, timeZone: cfg.timezone },
          attendees: [{ email, displayName: `${prenom} ${nom}` }],
          conferenceData: {
            createRequest: {
              requestId,
              conferenceSolutionKey: { type: 'hangoutsMeet' }
            }
          },
          reminders: { useDefault: true }
        }
      });

      const meetLink = evt.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri
                    || evt.data.hangoutLink || '';

      // Round-robin closer (même logique que setter/saveRdvPris)
      let closerData = null;
      try {
        const [closerSnap, assignDoc] = await Promise.all([
          db().collection('users').where('role','==','closer').get(),
          db().collection('config').doc('assignment').get()
        ]);
        const closers = closerSnap.docs
          .map(doc => ({
            uid: doc.id,
            name: `${doc.data().prenom||''} ${doc.data().nom||''}`.trim()
          }))
          .filter(c => c.name);
        if (closers.length) {
          const lastUid = assignDoc.exists ? assignDoc.data().lastCloserUid : null;
          const idx = lastUid ? closers.findIndex(c => c.uid === lastUid) : -1;
          closerData = closers[(idx + 1) % closers.length];
          await db().collection('config').doc('assignment').set({
            lastCloserUid: closerData.uid,
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
        }
      } catch (e) {
        console.warn('[booking] round-robin closer failed', e);
      }

      // Crée le lead
      const leadDoc = {
        prenom: String(prenom).trim(),
        nom: String(nom).trim(),
        email: String(email).toLowerCase().trim(),
        telephone: String(telephone || '').trim(),
        sourceCanal: 'Booking',
        statutSetter: 'Qualifié',
        statutCloser: 'RDV planifié',
        dateRDV: date,
        heureRDV: time,
        scoreQualification: 7,
        closerAssigne: closerData?.name || null,
        closerUid: closerData?.uid || null,
        setterAssigne: 'Système (Booking)',
        setterUid: null,
        reponsesQuestionnaire: {
          commentaireLibre: String(message || '').trim(),
          ...answersArr.reduce((acc, a) => { if (a.id) acc[a.id] = a.answer; return acc; }, {}),
          _answers_full: answersArr // liste complète pour le setter
        },
        booking_google_event_id: evt.data.id,
        booking_meet_link: meetLink,
        booking_start_utc: startUtc.toISOString(),
        booking_end_utc:   endUtc.toISOString(),
        booking_original_source: sourceStr || null,
        dateCreation: FieldValue.serverTimestamp(),
        dateLastContactSetter: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'booking'
      };
      const leadRef = await db().collection('leads').add(leadDoc);

      // Notification email à l'organisateur — best effort, jamais bloquant
      try {
        const cfgDoc = await db().collection('config').doc('booking').get();
        const notifyList = (cfgDoc.data()?.notification_emails || [cfgDoc.data()?.google_email])
          .filter(Boolean);
        const toEmail = notifyList.join(',');
        if (toEmail) {
          await sendBookingNotificationEmail({
            toEmail,
            prenom: leadDoc.prenom,
            nom: leadDoc.nom,
            email: leadDoc.email,
            telephone: leadDoc.telephone,
            message: leadDoc.reponsesQuestionnaire.commentaireLibre,
            source_hint: sourceStr,
            answers: answersArr,
            date, time, endTime,
            meetLink,
            eventId: evt.data.id
          });
          console.log('[booking] email notif envoyé à', toEmail);
        }
      } catch (mailErr) {
        console.error('[booking] envoi email notif échoué (booking OK malgré tout)', mailErr);
      }

      // Log de la réservation
      await db().collection('bookings').add({
        lead_id: leadRef.id,
        google_event_id: evt.data.id,
        meet_link: meetLink,
        prenom: leadDoc.prenom,
        nom: leadDoc.nom,
        email: leadDoc.email,
        telephone: leadDoc.telephone,
        date, time,
        end_time: endTime,
        timezone: cfg.timezone,
        start_utc: startUtc.toISOString(),
        end_utc:   endUtc.toISOString(),
        createdAt: FieldValue.serverTimestamp()
      });

      res.json({
        ok: true,
        eventId: evt.data.id,
        meetLink,
        date,
        time,
        end_time: endTime,
        timezone: cfg.timezone
      });
    } catch (e) {
      console.error('[bookingCreate]', e);
      res.status(500).json({ error: e.message || 'erreur' });
    }
  }
);
