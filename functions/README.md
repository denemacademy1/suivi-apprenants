# Cloud Function — Meta Lead Ads → Firestore

Reçoit les webhooks Meta Lead Ads et écrit les leads dans la collection `leads` (visible instantanément dans l'espace setter).

## Endpoint

`https://europe-west1-denem-academy-5de41.cloudfunctions.net/metaLeadsWebhook`

## Setup — une seule fois

### 1. Passer sur Blaze
Console Firebase → ⚙️ → Usage and billing → Details & settings → **Modify plan → Blaze (pay as you go)**.
Ajoute une CB. Reste à 0€/mois tant que tu ne dépasses pas 2M d'invocations.

**Sécurité — mets un budget alert à 1€** :
Google Cloud Console → Billing → Budgets & alerts → Create budget → 1€ mensuel.

### 2. Installer Firebase CLI (si pas déjà)
```bash
npm install -g firebase-tools
firebase login
```

### 3. Installer les dépendances
```bash
cd functions
npm install
```

### 4. Créer les 3 secrets
```bash
firebase functions:secrets:set META_VERIFY_TOKEN
# Colle une chaîne aléatoire (ex: openssl rand -hex 24) — tu la remettras côté Meta

firebase functions:secrets:set META_APP_SECRET
# Colle l'App Secret Meta (Meta Developers → ton app → Settings → Basic → App Secret)

firebase functions:secrets:set META_PAGE_ACCESS_TOKEN
# Colle le Page Access Token (voir instructions Meta plus bas)
```

### 5. Déployer
```bash
firebase deploy --only functions
```

Note l'URL affichée à la fin.

## Côté Meta — configuration

### 1. Créer une App
Meta for Developers → My Apps → **Create App** → Business → nomme-la « DENEM Leads Sync ».

### 2. Ajouter le produit Webhooks
Dans l'app → **+ Add Product** → Webhooks → Set up.

### 3. Configurer le webhook Page
- Object : **Page**
- Callback URL : `https://europe-west1-denem-academy-5de41.cloudfunctions.net/metaLeadsWebhook`
- Verify Token : **la même valeur que META_VERIFY_TOKEN**
- Clique **Verify and Save**

### 4. S'abonner au champ `leadgen`
Sous Page → **Subscribe** → coche `leadgen`.

### 5. Générer le Page Access Token permanent
Le plus simple : Meta Business Suite → Paramètres → **System Users** → Generate Token → Page + permissions `pages_manage_ads`, `pages_read_engagement`, `leads_retrieval`, `pages_show_list`, `pages_manage_metadata`.
Copie ce token dans `META_PAGE_ACCESS_TOKEN`.

### 6. Souscrire ta Page à ton App
```bash
curl -X POST \
  "https://graph.facebook.com/v20.0/PAGE_ID/subscribed_apps?subscribed_fields=leadgen&access_token=PAGE_ACCESS_TOKEN"
```

Remplace `PAGE_ID` et `PAGE_ACCESS_TOKEN`. Réponse attendue : `{"success":true}`.

### 7. Test
Meta Publisher → Preview le formulaire Lead Ad → soumets un lead test.
Vérifie qu'il apparaît dans l'espace setter en `Nouveau`.

## Debug

```bash
firebase functions:log --only metaLeadsWebhook
```

Chaque webhook loggue :
- `[meta-webhook] verification OK` (à la connexion initiale)
- `[meta-webhook] ✅ lead créé <docId> meta_lead_id=<id>` (chaque nouveau lead)
- `[meta-webhook] doublon ignoré <id>` (webhook renvoyé par Meta)
- `[meta-webhook] signature invalide` (mauvais App Secret)

## Mapping des champs

La fonction reconnaît automatiquement ces noms de champs Meta (case-insensitive) :

| Champ Meta | Champ Firestore |
|---|---|
| `first_name` / `prenom` | `prenom` |
| `last_name` / `nom` | `nom` |
| `full_name` / `nom_complet` | split → prenom + nom |
| `email` | `email` |
| `phone_number` / `telephone` / `tel` | `telephone` |
| `situation` / `situation_actuelle` / `job_title` | `reponsesQuestionnaire.situationActuelle` |
| `revenus` / `revenus_actuels` / `current_income` | `reponsesQuestionnaire.revenus` |
| `motivation` / `pourquoi` | `reponsesQuestionnaire.motivation` |
| `budget` / `budget_disponible` | `reponsesQuestionnaire.budgetDisponible` |
| `disponibilite` / `heures_par_semaine` / `time_available` | `reponsesQuestionnaire.disponibiliteHebdo` |
| `timeline` / `delai` / `delai_lancement` | `reponsesQuestionnaire.delaiLancement` |
| `commentaire` / `message` | `reponsesQuestionnaire.commentaireLibre` |

**Tout ce qui n'est pas mappé est conservé dans `meta_raw_answers`** pour debug / ajout ultérieur.
