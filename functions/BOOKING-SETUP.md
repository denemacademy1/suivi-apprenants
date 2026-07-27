# Booking DENEM — Setup Google Cloud

Guide **une fois pour toutes** pour connecter la page de réservation à ton Google Agenda.

---

## 1) Console Google Cloud (~5 min)

Va sur https://console.cloud.google.com — connecté avec le compte Google dont tu veux gérer l'agenda.

Sélectionne le projet **denem-academy-5de41** (celui de Firebase) en haut à gauche.

### a. Activer l'API Google Calendar

1. Menu ☰ → **APIs & Services** → **Library**
2. Recherche `Google Calendar API` → clique → **Enable**

### b. Configurer l'écran de consentement OAuth

1. **APIs & Services** → **OAuth consent screen**
2. Type : **External** (car ton propre compte Google) → **Create**
3. Remplis :
   - App name : `DENEM Academy Booking`
   - User support email : ton email
   - Developer contact : ton email
4. **Save and Continue**
5. Sur "Scopes" → **Add or Remove Scopes** → coche :
   - `.../auth/calendar` (voir/créer/modifier tous les agendas)
   - `.../auth/userinfo.email`
   - **Update** → **Save and Continue**
6. "Test users" → **Add users** → ajoute ton email Google (celui de l'agenda) → **Save and Continue**

> Tant que l'app est en "Testing", seuls les emails ajoutés en test users peuvent se connecter. C'est parfait pour toi.

### c. Créer un OAuth Client

1. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
2. Application type : **Web application**
3. Name : `DENEM Booking Web`
4. **Authorized redirect URIs** → **Add URI** :
   ```
   https://europe-west1-denem-academy-5de41.cloudfunctions.net/googleOAuthCallback
   ```
5. **Create**
6. Une popup s'ouvre avec ton **Client ID** et **Client Secret** — copie-les.

---

## 2) Configurer les secrets Firebase (~2 min)

Ouvre un terminal dans `/Users/axelriandiere/suivi-apprenants` :

```bash
firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_ID
# Colle le Client ID → Enter

firebase functions:secrets:set GOOGLE_OAUTH_CLIENT_SECRET
# Colle le Client Secret → Enter
```

---

## 3) Déployer les Cloud Functions

```bash
firebase deploy --only functions
```

Attends la fin (~2-3 min). Tu verras 5 nouvelles fonctions déployées :
- `googleOAuthStart`
- `googleOAuthCallback`
- `bookingSlots`
- `bookingConfig`
- `bookingCreate`

---

## 4) Connecter ton Google Agenda

1. Va sur **https://denem-academy-5de41.web.app/admin/booking.html** (ou l'URL équivalente)
2. Connecte-toi avec ton compte admin Firebase
3. Clique **🔗 Connecter mon Google Agenda**
4. Autorise l'app dans la popup Google (accepte l'avertissement "app non vérifiée" — c'est ta propre app)
5. Tu reviens sur la page → statut **✅ Connecté**

---

## 5) Régler tes préférences

Sur la même page admin, tu peux ajuster :
- Durée d'un RDV (45 min par défaut)
- Plage horaire (9h-18h Europe/Paris)
- Jours ouvrés (Lun-Ven)
- Buffer entre RDV (15 min)
- Préavis minimum (4h)
- Jours d'avance affichés (14)

**Enregistrer** → effet immédiat sur la page publique.

---

## 6) Intégrer sur tes landing pages

Remplace les widgets iClosed par un lien ou une iframe :

**Lien :**
```html
<a href="https://denemacademy.com/rdv.html" target="_blank">Réserver mon bilan →</a>
```

**Iframe embarquée :**
```html
<iframe src="https://denemacademy.com/rdv.html"
  style="width:100%;height:820px;border:none;border-radius:14px"
  loading="lazy"></iframe>
```

Snippets copiables directement depuis la page admin.

---

## Debug

```bash
firebase functions:log --only bookingSlots -n 20
firebase functions:log --only bookingCreate -n 20
firebase functions:log --only googleOAuthCallback -n 20
```

## Ce qui se passe à chaque réservation

1. Le prospect choisit un créneau et remplit le form
2. `bookingCreate` recheck la dispo (anti double-booking)
3. Crée un event Google Calendar dans **ton agenda primary**
4. Ajoute automatiquement un **lien Google Meet**
5. Envoie une **invite email** au prospect (sendUpdates=all)
6. Crée un **lead Firestore** avec `sourceCanal='Booking'`, `statutSetter='Qualifié'`, `statutCloser='RDV planifié'`, date + heure du RDV, message stocké dans `reponsesQuestionnaire.commentaireLibre`
7. Auto-assigne un **closer** via round-robin (même logique que le setter)

Le lead apparaît instantanément dans l'espace closer / setter comme un RDV pris.
