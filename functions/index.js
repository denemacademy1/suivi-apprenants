/**
 * Cloud Function : réception des leads Meta Lead Ads → écriture dans Firestore.
 *
 * Endpoint public : POST/GET https://europe-west1-denem-academy-5de41.cloudfunctions.net/metaLeadsWebhook
 *
 * Flow :
 *   1. Meta pousse un webhook 'leadgen' sur cette URL (POST) OU vérifie l'endpoint (GET).
 *   2. On vérifie la signature HMAC SHA-256 avec l'App Secret Meta.
 *   3. On récupère les données complètes du lead via Graph API (POST ne contient que l'ID).
 *   4. On écrit le lead dans la collection `leads` au format attendu par l'espace setter.
 *
 * Secrets nécessaires (à définir avec `firebase functions:secrets:set`) :
 *   - META_VERIFY_TOKEN     : chaîne aléatoire choisie par toi (identique dans Meta App)
 *   - META_APP_SECRET       : App Secret de l'app Meta (Meta Developer → Settings → Basic)
 *   - META_PAGE_ACCESS_TOKEN: Page Access Token permanent (portée pages_manage_ads,leads_retrieval)
 */

const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

initializeApp();
const db = getFirestore();

const META_VERIFY_TOKEN = defineSecret('META_VERIFY_TOKEN');
const META_APP_SECRET = defineSecret('META_APP_SECRET');
const META_PAGE_ACCESS_TOKEN = defineSecret('META_PAGE_ACCESS_TOKEN');

// ─────────────────────────────────────────────────────────────
// Booking DENEM (Google Calendar) — délégué au module booking.js
// ─────────────────────────────────────────────────────────────
const booking = require('./booking');
exports.googleOAuthStart    = booking.googleOAuthStart;
exports.googleOAuthCallback = booking.googleOAuthCallback;
exports.bookingSlots        = booking.bookingSlots;
exports.bookingConfig       = booking.bookingConfig;
exports.bookingCreate       = booking.bookingCreate;

exports.metaLeadsWebhook = onRequest(
  {
    secrets: [META_VERIFY_TOKEN, META_APP_SECRET, META_PAGE_ACCESS_TOKEN],
    region: 'europe-west1',
    cors: false,
    maxInstances: 10
  },
  async (req, res) => {
    // ── 1) Meta vérifie l'endpoint (GET) ──
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      if (mode === 'subscribe' && token === META_VERIFY_TOKEN.value()) {
        console.log('[meta-webhook] verification OK');
        return res.status(200).send(challenge);
      }
      console.warn('[meta-webhook] verification failed', { mode, token: token ? '(fourni)' : '(absent)' });
      return res.status(403).send('Forbidden');
    }

    if (req.method !== 'POST') {
      return res.status(405).send('Method not allowed');
    }

    // ── 2) Vérification signature Meta (HMAC SHA-256 sur le body brut) ──
    const signature = req.get('X-Hub-Signature-256') || '';
    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body);
    const expected = 'sha256=' + crypto
      .createHmac('sha256', META_APP_SECRET.value())
      .update(rawBody)
      .digest('hex');
    if (!signature || signature !== expected) {
      console.warn('[meta-webhook] signature invalide');
      return res.status(401).send('Invalid signature');
    }

    // ── 3) Parcours des notifications reçues ──
    const body = req.body || {};
    if (body.object !== 'page') {
      console.log('[meta-webhook] object non géré :', body.object);
      return res.status(200).send('OK');
    }

    const results = [];
    for (const entry of (body.entry || [])) {
      for (const change of (entry.changes || [])) {
        if (change.field !== 'leadgen') continue;
        const v = change.value || {};
        const leadId = v.leadgen_id;
        try {
          if (!leadId) continue;

          // Déduplication : si le lead a déjà été reçu, on ne le recrée pas
          const dupe = await db.collection('leads')
            .where('meta_lead_id', '==', leadId)
            .limit(1)
            .get();
          if (!dupe.empty) {
            console.log('[meta-webhook] doublon ignoré', leadId);
            results.push({ leadId, status: 'duplicate' });
            continue;
          }

          // 4) Récupération des données complètes via Graph API
          const url = `https://graph.facebook.com/v20.0/${leadId}?access_token=${encodeURIComponent(META_PAGE_ACCESS_TOKEN.value())}`;
          const resp = await fetch(url);
          if (!resp.ok) {
            const errTxt = await resp.text();
            console.error('[meta-webhook] Graph API error', resp.status, errTxt);
            results.push({ leadId, status: 'graph_error', code: resp.status });
            continue;
          }
          const leadData = await resp.json();
          if (!Array.isArray(leadData.field_data)) {
            console.warn('[meta-webhook] pas de field_data', leadData);
            results.push({ leadId, status: 'no_fields' });
            continue;
          }

          // 5) Aplatir field_data → { key: value }
          const answers = {};
          leadData.field_data.forEach(f => {
            const key = (f.name || '').toLowerCase().trim();
            answers[key] = (Array.isArray(f.values) && f.values[0]) || '';
          });

          // 6) Mapping vers le schéma `leads` du setter
          const fullName = (answers.full_name || answers.nom_complet || '').trim();
          const [fnFirst, ...fnRest] = fullName.split(/\s+/);
          const doc = {
            prenom: answers.first_name || answers.prenom || fnFirst || '',
            nom: answers.last_name || answers.nom || fnRest.join(' ') || '',
            email: (answers.email || '').toLowerCase().trim(),
            telephone: answers.phone_number || answers.telephone || answers.tel || '',
            sourceCanal: 'Meta Ads',
            statutSetter: 'Nouveau',
            reponsesQuestionnaire: {
              situationActuelle: answers.situation || answers.situation_actuelle || answers.job_title || '',
              revenus: answers.revenus || answers.revenus_actuels || answers.current_income || '',
              motivation: answers.motivation || answers.pourquoi || '',
              budgetDisponible: answers.budget || answers.budget_disponible || '',
              disponibiliteHebdo: answers.disponibilite || answers.heures_par_semaine || answers.time_available || '',
              delaiLancement: answers.timeline || answers.delai || answers.delai_lancement || '',
              commentaireLibre: answers.commentaire || answers.message || ''
            },
            // Traces Meta pour attribution / debug
            meta_lead_id: leadId,
            meta_form_id: v.form_id || null,
            meta_ad_id: v.ad_id || null,
            meta_adgroup_id: v.adgroup_id || null,
            meta_page_id: v.page_id || null,
            meta_created_time: v.created_time || null,
            meta_raw_answers: answers,
            dateCreation: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: 'meta-webhook'
          };

          const ref = await db.collection('leads').add(doc);
          console.log('[meta-webhook] ✅ lead créé', ref.id, 'meta_lead_id=', leadId);
          results.push({ leadId, status: 'created', docId: ref.id });
        } catch (e) {
          console.error('[meta-webhook] erreur traitement lead', leadId, e);
          results.push({ leadId, status: 'error', message: e.message });
        }
      }
    }

    return res.status(200).json({ ok: true, results });
  }
);
