// ═══════════════════════════════════════════════════════════════
//  QUIZZ DENEM ACADEMY — Séances 1 à 23 (20 questions/séance)
//  Source : Quiz_DENEM_Academy_Seances_01-23.docx (juin 2026)
// ═══════════════════════════════════════════════════════════════
// Format : window.QUIZ_SEED_1_23[ordre] = [ {texte, options, correct, nb_correct, pourquoi}, … ]
// correct : indices 0-based (A=0, B=1, C=2, D=3). Tableau pour multi-réponses.

(function(){
  const Q = window.QUIZ_SEED_1_23 = {};

  // ─── Helpers de génération (templates récurrents identiques entre séances) ───
  // Beaucoup de questions Q14/Q15/Q16/Q18 sont identiques sur toutes les séances,
  // seuls le titre/source/livrable changent. On les factorise.

  const mk = (texte, options, correct, pourquoi) => ({
    texte, options,
    correct: Array.isArray(correct) ? correct : [correct],
    nb_correct: (Array.isArray(correct) ? correct.length : 1),
    pourquoi
  });

  // Templates communs à TOUTES les séances (Q15, Q16) — quasi identiques
  const Q15_COMMON = mk(
    "Quelle règle d'hygiène doit rester vraie, même quand l'automatisation fonctionne ?",
    [
      "Mettre les identifiants, secrets et données sensibles dans les prompts publics.",
      "Ignorer les logs et les erreurs si le premier essai semble fonctionner.",
      "Garder les accès, sources, fichiers et validations sous contrôle humain.",
      "Donner à l'outil plus de permissions que nécessaire pour éviter les questions."
    ],
    [2],
    "Une automatisation utile reste maîtrisée : accès minimum, sources visibles, erreurs inspectables et validation humaine."
  );
  const Q16_COMMON = mk(
    "À quel moment l'automatisation devient-elle pertinente dans cette séance ?",
    [
      "Dès qu'une idée apparaît, avant même d'avoir compris le processus.",
      "Quand le processus, les entrées, les sorties et les contrôles sont assez clairs pour être répétés.",
      "Quand on veut masquer une base de travail mal rangée.",
      "Quand on veut éviter de définir un livrable."
    ],
    [1],
    "On automatise une logique comprise. Sinon, on accélère surtout les erreurs et le flou."
  );

  // Bloc générique de 20 questions pour une séance
  // Args : { num, objectif, source, livrable, risque, controle, technique, valeur,
  //          contexte, limiteIA, transitionSuite, explication, kpi, outil }
  function build(s){
    return [
      // Q1 — objectif de la séance
      mk(
        `Tu ouvres la séance ${s.num} avec un apprenant. Quel objectif doit-il garder en tête ?`,
        [
          "Tester plusieurs outils au hasard pour voir ce qui sort.",
          s.objectif,
          "Produire le maximum de captures, même si le résultat n'est pas exploitable.",
          "Changer de sujet dès qu'une difficulté technique apparaît."
        ],
        [1],
        `La séance est construite autour de cet objectif : ${s.objectif.toLowerCase()} C'est le fil conducteur qui évite de confondre activité et résultat.`
      ),
      // Q2 — verrouiller la source
      mk(
        "Avant de lancer l'outil ou l'agent, quel point faut-il verrouiller en priorité ?",
        [
          "Le style graphique final, même si la source de travail n'est pas prête.",
          "Le nombre exact de minutes passées sur chaque étape.",
          s.source,
          "Une liste d'idées sans dossier, sans source et sans critère de validation."
        ],
        [2],
        `La bonne base est : ${s.source.toLowerCase()} Sans source claire, l'outil peut produire quelque chose de joli mais impossible à vérifier.`
      ),
      // Q3 — livrable
      mk(
        "Quel livrable prouve le mieux que la séance est comprise ?",
        [
          "Une discussion intéressante mais sans fichier, sans preuve et sans suite.",
          s.livrable,
          "Un résumé générique qui pourrait convenir à n'importe quelle séance.",
          "Une capture isolée sans contexte ni contrôle."
        ],
        [1],
        `Le livrable attendu est concret : ${s.livrable.toLowerCase()} Il doit pouvoir être montré, relu et amélioré.`
      ),
      // Q4 — risque qualité
      mk(
        "Quel comportement risque le plus de faire baisser la qualité du travail ?",
        [
          s.risque,
          "Documenter les choix importants pendant la séance.",
          "Comparer le résultat avec l'objectif annoncé.",
          "Garder une trace des fichiers, sources et décisions."
        ],
        [0],
        `Le piège principal est : ${s.risque.toLowerCase()} La séance doit rester contrôlable, sinon elle devient une démonstration fragile.`
      ),
      // Q5 — contrôles utiles (multi A+C)
      mk(
        "Avant de passer à la séance suivante, quels contrôles sont vraiment utiles ?",
        [
          s.controle,
          "Publier ou envoyer le résultat sans relecture pour gagner du temps.",
          `Vérifier que la source de travail reste claire : ${s.source.toLowerCase().replace(/\.$/,'')}.`,
          "Supprimer les traces de travail pour ne garder qu'une sortie finale."
        ],
        [0, 2],
        `Il y a plusieurs bonnes réponses : il faut valider le rendu et garder la source claire. Ici, le contrôle principal est : ${s.controle.toLowerCase()}`
      ),
      // Q6 — vocabulaire technique
      mk(
        `Pourquoi le point technique suivant est-il central : ${s.technique} ?`,
        [
          "Parce qu'il donne un vocabulaire précis pour piloter l'outil au lieu de subir la sortie.",
          "Parce qu'il permet d'éviter totalement la validation humaine.",
          "Parce qu'il remplace le besoin de comprendre le client ou le contexte.",
          "Parce qu'il rend la séance plus longue, donc forcément plus professionnelle."
        ],
        [0],
        `Le point technique n'est pas décoratif. Il sert à piloter le travail : ${s.technique.toLowerCase()}.`
      ),
      // Q7 — pitch client
      mk(
        "Si tu présentes cette compétence à un client, quelle formulation est la plus stratégique ?",
        [
          "Je peux utiliser un outil IA récent, donc le projet sera automatiquement bon.",
          s.valeur,
          "Je vais produire beaucoup de choses rapidement, même si on ne sait pas encore à quoi elles servent.",
          "Je préfère ne pas définir d'objectif pour rester libre pendant la mission."
        ],
        [1],
        `La valeur client est dans l'effet business : ${s.valeur.toLowerCase()} L'outil n'est qu'un moyen.`
      ),
      // Q8 — bonne demande
      mk(
        `Quelle demande à ${s.outil} est la plus propre pour démarrer ?`,
        [
          "Fais tout, décide tout, et ne me demande pas de vérifier.",
          `Analyse le contexte (${s.contexte}), propose les étapes, puis indique ce que je dois vérifier avant de valider.`,
          "Génère quelque chose de spectaculaire, même si ce n'est pas relié au support.",
          "Ignore les fichiers existants et repars de zéro."
        ],
        [1],
        "Une bonne demande donne le contexte, demande un plan et prévoit une vérification. Elle garde l'apprenant dans la boucle."
      ),
      // Q9 — limite IA (multi A+B)
      mk(
        "Quelles décisions ne doivent pas être abandonnées à l'IA toute seule ?",
        [
          s.limiteIA,
          "La validation finale du résultat par rapport au besoin réel.",
          "La rédaction d'une première proposition ou d'une checklist.",
          "La recherche de pistes techniques sous contrôle humain."
        ],
        [0, 1],
        `L'IA peut aider, mais la limite reste claire : ${s.limiteIA.toLowerCase()} L'humain garde les décisions qui engagent le business, le client ou la qualité.`
      ),
      // Q10 — résultat générique
      mk(
        "Le résultat obtenu est trop générique. Quelle réaction est la plus professionnelle ?",
        [
          "Changer immédiatement d'outil sans relire la consigne.",
          "Ajouter plus de mots vagues dans le prompt.",
          `Revenir à la source (${s.source.toLowerCase().replace(/\.$/,'')}), préciser le contexte (${s.contexte}) et relancer avec des critères de validation.`,
          "Accepter le résultat parce qu'il a l'air propre visuellement."
        ],
        [2],
        "Un résultat générique vient souvent d'un contexte trop faible. On corrige la source, les contraintes et les critères avant d'accuser l'outil."
      ),
      // Q11 — transition vers la suite
      mk(
        "Pourquoi cette séance prépare-t-elle bien la suite du parcours ?",
        [
          s.transitionSuite,
          "Elle remplace toutes les séances suivantes.",
          "Elle sert uniquement à apprendre un mot technique.",
          "Elle permet d'ignorer les livrables précédents."
        ],
        [0],
        `La progression est volontaire : ${s.transitionSuite.toLowerCase()} Chaque séance construit une brique pour la suivante.`
      ),
      // Q12 — explication simple
      mk(
        `Dans le contexte de cette séance, comment expliquer simplement ${s.outil} à un apprenant ?`,
        [
          `Comme un moyen de travailler sur ${s.contexte}, avec une validation concrète à la fin.`,
          "Comme une solution magique qui évite de comprendre le métier.",
          "Comme un outil à utiliser seulement pour produire de longs textes.",
          "Comme une méthode qui supprime le besoin d'organiser ses fichiers."
        ],
        [0],
        `L'explication utile relie l'outil au contexte réel : ${s.contexte}. Cela rend l'apprentissage actionnable.`
      ),
      // Q13 — auditable (multi A+B+D)
      mk(
        "Quels éléments rendent le travail auditable et réutilisable ?",
        [
          `Une source identifiée : ${s.source.toLowerCase().replace(/\.$/,'')}.`,
          `Un livrable observable : ${s.livrable.toLowerCase().replace(/\.$/,'')}.`,
          "Des choix cachés dans une conversation impossible à retrouver.",
          `Un contrôle explicite : ${s.controle.toLowerCase().replace(/\.$/,'')}.`
        ],
        [0, 1, 3],
        "Il y a trois bonnes réponses : source, livrable et contrôle. C'est ce trio qui transforme une séance en méthode réutilisable."
      ),
      // Q14 — sauter la vérif
      mk(
        "Un apprenant dit : « Je veux aller plus vite, je vais sauter la vérification. » Que lui réponds-tu ?",
        [
          "Oui, la vitesse compte plus que la qualité.",
          `Non : ici, la vérification sert à confirmer que ${s.controle.toLowerCase()}`,
          "Oui, tant que le document ou le site paraît joli.",
          "Non, mais uniquement parce que la séance doit durer plus longtemps."
        ],
        [1],
        `La vérification protège le résultat. Dans cette séance, elle consiste notamment à : ${s.controle.toLowerCase()}`
      ),
      // Q15 — règle d'hygiène (commun)
      Q15_COMMON,
      // Q16 — quand automatiser (commun)
      Q16_COMMON,
      // Q17 — travail solide (multi A+C)
      mk(
        "Quels signes montrent que le travail est solide ?",
        [
          `Le résultat répond au KPI pédagogique : ${s.kpi}`,
          "L'apprenant ne sait pas expliquer ce qui a changé, mais le rendu paraît fini.",
          "La source, le livrable et la validation peuvent être retrouvés.",
          "La séance produit une sortie impossible à corriger."
        ],
        [0, 2],
        `Le travail est solide quand il est explicable, retrouvable et mesurable. Ici, le signal principal est : ${s.kpi}`
      ),
      // Q18 — affirmation fausse
      mk(
        "Quelle affirmation est fausse, donc dangereuse à retenir ?",
        [
          `La séance vise à ${s.objectif.toLowerCase()}`,
          `Le livrable attendu est : ${s.livrable.toLowerCase()}`,
          "Une sortie IA correcte visuellement n'a pas besoin de source ni de contrôle.",
          `Un risque réel est de ${s.risque.toLowerCase()}`
        ],
        [2],
        "La phrase entourée est fausse : un résultat joli mais non vérifiable peut faire perdre du temps, de la confiance et de la qualité."
      ),
      // Q19 — indicateur de succès
      mk(
        "Quel indicateur permet de dire que la séance a vraiment servi à quelque chose ?",
        [
          "Le nombre d'outils cités pendant la séance.",
          s.kpi,
          "Le nombre de prompts envoyés, même sans résultat exploitable.",
          "Le fait d'avoir terminé vite, même si personne ne peut expliquer le résultat."
        ],
        [1],
        `Le bon indicateur est orienté résultat : ${s.kpi} Il mesure une compétence, pas seulement une activité.`
      ),
      // Q20 — phrase de débrief
      mk(
        "Quelle phrase de débrief est la plus utile et la plus amicale pour conclure avec l'apprenant ?",
        [
          "Tu as tout compris, donc tu n'as plus besoin de vérifier.",
          `Tu as maintenant une base claire : tu sais d'où part le travail, ce qui est livré, et comment vérifier ${s.controle.toLowerCase()}`,
          "Le plus important était de suivre l'outil, pas de comprendre la logique.",
          "On garde seulement le résultat final, le raisonnement n'a pas d'intérêt."
        ],
        [1],
        "Un bon débrief rassure sans infantiliser : il rappelle la source, le livrable et le contrôle que l'apprenant sait refaire."
      )
    ];
  }

  // ═════════════════════════════════════════════
  //  SÉANCES 1-23 — paramètres spécifiques
  // ═════════════════════════════════════════════

  Q[1] = build({
    num:'01',
    outil:"Claude Code",
    objectif:"Faire comprendre qu'un agent de code travaille dans un vrai dossier et produit des fichiers vérifiables.",
    source:"Le bon dossier ouvert, avec les consignes et les fichiers sous les yeux.",
    livrable:"Une page simple créée dans le dossier demandé, puis vérifiée visuellement.",
    risque:"Laisser l'agent créer ou modifier des fichiers hors du dossier prévu.",
    controle:"Ouvrir le rendu, relire les fichiers modifiés et vérifier que le résultat correspond à la demande.",
    technique:"la relation entre dossier de travail, commandes, fichiers modifiés et validation humaine",
    valeur:"Transformer une intention floue en livrable réel sans perdre le contrôle.",
    contexte:"un dossier local de travail et une première page concrète",
    limiteIA:"Claude Code ne choisit pas la stratégie business finale : il exécute et aide à structurer.",
    transitionSuite:"Passer vers Codex en comprenant déjà la logique d'agent de code.",
    kpi:"l'apprenant sait expliquer où le fichier a été créé, ce qui a changé et pourquoi."
  });

  Q[2] = build({
    num:'02',
    outil:"Codex",
    objectif:"Distinguer l'agent de code d'un simple chatbot et savoir quand l'utiliser.",
    source:"Le repo, le dossier ou la tâche précise à traiter.",
    livrable:"Une modification de code ou de contenu accompagnée d'une vérification claire.",
    risque:"Demander à Codex de décider seul du produit, du positionnement ou des règles métier.",
    controle:"Lire le diff, lancer les contrôles utiles et vérifier le rendu final.",
    technique:"la différence entre app, terminal, contexte de repo, diff et tests",
    valeur:"Livrer plus vite sans déléguer les décisions sensibles à l'outil.",
    contexte:"un projet de code ou un support à inspecter, modifier et vérifier",
    limiteIA:"Codex aide à écrire, revoir et livrer ; l'humain garde le cadrage et la validation.",
    transitionSuite:"Enchaîner avec n8n pour automatiser des processus déjà compris.",
    kpi:"l'apprenant sait justifier pourquoi Codex est utilisé plutôt qu'un chat classique."
  });

  Q[3] = build({
    num:'03',
    outil:"n8n",
    objectif:"Comprendre les bases d'une automatisation visuelle sans perdre la logique métier.",
    source:"Le processus manuel décrit étape par étape avant toute automatisation.",
    livrable:"Un workflow simple avec trigger, nodes connectés, données JSON et test d'exécution.",
    risque:"Brancher des nodes au hasard sans comprendre les entrées, sorties et erreurs possibles.",
    controle:"Tester l'exécution, inspecter les données entre nodes et vérifier les credentials.",
    technique:"workflow, node, trigger, credentials, expressions et structure JSON",
    valeur:"Automatiser une tâche répétable seulement quand son chemin est clair.",
    contexte:"un workflow composé de nodes, d'un trigger et de données qui circulent",
    limiteIA:"N8n exécute une logique ; il ne doit pas inventer le processus à votre place.",
    transitionSuite:"Utiliser Cowork pour organiser les informations et les routines autour du système.",
    kpi:"l'apprenant peut expliquer ce qui déclenche le workflow et quelle donnée sort de chaque node."
  });

  Q[4] = build({
    num:'04',
    outil:"Claude Cowork",
    objectif:"Comprendre Cowork comme QG d'organisation plutôt que comme simple chat.",
    source:"Les informations de travail fiables : docs, comptes-rendus, objectifs et décisions.",
    livrable:"Un QG clair qui permet de retrouver les informations et préparer les actions.",
    risque:"Mettre toutes les discussions dans un chat sans source, propriétaire ni prochaine action.",
    controle:"Retrouver une décision, son contexte, son document source et l'action qui suit.",
    technique:"connecteurs, organisation documentaire, mémoire de travail et suivi des réunions",
    valeur:"Réduire le flou d'équipe et transformer les discussions en actions suivies.",
    contexte:"un espace d'organisation qui relie documents, réunions, tâches et décisions",
    limiteIA:"Cowork organise et assiste ; il ne remplace pas la décision managériale ou commerciale.",
    transitionSuite:"Construire ensuite un vrai QG de travail connecté à Google Drive et au Mac.",
    kpi:"l'apprenant peut dire où se trouve la source, qui agit, et quelle décision est retenue."
  });

  Q[5] = build({
    num:'05',
    outil:"Claude Cowork + Google Drive + Mac",
    objectif:"Mettre en place un QG de travail durable pour ne plus disperser les informations.",
    source:"Google Drive comme source de vérité, avec le Mac comme miroir et Cowork comme cerveau.",
    livrable:"Une structure de dossiers claire, reliée aux documents et exploitable par Cowork.",
    risque:"Confondre stockage, miroir local et espace de raisonnement dans un même endroit flou.",
    controle:"Vérifier le nommage, les chemins, les accès et la présence des dossiers attendus.",
    technique:"architecture Drive/Mac/Cowork, synchronisation, nommage et séparation des rôles",
    valeur:"Créer une base de travail réutilisable pour toutes les séances business ensuite.",
    contexte:"un système de fichiers et d'espaces qui garde la source, le miroir local et le cerveau IA",
    limiteIA:"Le QG ne décide pas de la stratégie ; il rend les informations accessibles et fiables.",
    transitionSuite:"Utiliser ce QG pour l'étude de marché, la marque, le site et la prospection.",
    kpi:"l'apprenant retrouve rapidement un fichier et sait expliquer le rôle de chaque espace."
  });

  Q[6] = build({
    num:'06',
    outil:"Claude Code + recherche marché",
    objectif:"Produire une étude de marché exploitable avant de créer la marque ou le site.",
    source:"Le dossier mon-business, les concurrents, les requêtes, les prix et les signaux terrain.",
    livrable:"Un tableau de concurrents, une cible, des prix, des angles et des trous de marché.",
    risque:"Sauter directement au logo ou au site sans valider concurrence, demande et prix.",
    controle:"Contrôler les sources, les colonnes, les prix, les concurrents et la cohérence de la cible.",
    technique:"benchmark, recherche de demande, concurrence, pricing, ICP et opportunités",
    valeur:"Éviter de vendre une offre sans preuve de marché ni compréhension client.",
    contexte:"une analyse de marché structurée autour d'un cas concret, comme une agence IA restauration",
    limiteIA:"L'IA aide à analyser ; l'humain tranche l'angle commercial et vérifie les sources.",
    transitionSuite:"Passer à l'identité de marque avec un positionnement déjà justifié.",
    kpi:"l'apprenant peut expliquer son marché, sa cible, ses concurrents et son angle."
  });

  Q[7] = build({
    num:'07',
    outil:"IA design + dossier 00-brand",
    objectif:"Créer une base de marque cohérente sans transformer le logo en décoration inutile.",
    source:"Le dossier 00-brand, les éléments existants de mon-business et le positionnement validé.",
    livrable:"Un logo propre, quelques variantes utiles et une organisation claire des fichiers marque.",
    risque:"Générer dix logos sans critère, sans source et sans dossier de référence.",
    controle:"Tester lisibilité, cohérence avec le positionnement et rangement dans le bon dossier.",
    technique:"choix visuel, cohérence, stockage, déclinaisons et contraintes de réutilisation",
    valeur:"Rendre l'offre reconnaissable et crédible avant de construire la vitrine.",
    contexte:"une identité visuelle simple, choisie et rangée dans un dossier source",
    limiteIA:"L'IA peut proposer ; l'humain choisit selon la stratégie et l'usage réel.",
    transitionSuite:"Utiliser la marque dans le site WordPress et les contenus.",
    kpi:"l'apprenant sait montrer son logo, expliquer son choix et retrouver les fichiers."
  });

  Q[8] = build({
    num:'08',
    outil:"WordPress + Claude Code",
    objectif:"Créer un site WordPress vendable, déployable et cohérent avec l'offre.",
    source:"Le positionnement, la marque, les contenus et le dossier 02-site.",
    livrable:"Une page WordPress structurée, lisible, déployée et vérifiable.",
    risque:"Vouloir générer tout le site d'un coup sans contrôler chaque section.",
    controle:"Relire chaque section, vérifier mobile, liens, CTA, cohérence et rendu public.",
    technique:"sections, pages, thème, contenus, REST API, assets et déploiement",
    valeur:"Transformer la stratégie en vitrine claire que l'on peut aussi vendre à un client.",
    contexte:"un site vitrine construit section par section avec des contenus issus du business",
    limiteIA:"Claude Code aide à construire ; le propriétaire valide l'offre, les textes et la preuve.",
    transitionSuite:"Enchaîner avec l'audit SEO/GEO pour attirer du trafic qualifié.",
    kpi:"l'apprenant peut ouvrir le site, montrer les sections et justifier la structure."
  });

  Q[9] = build({
    num:'09',
    outil:"SEO/GEO + recherche automatisée",
    objectif:"Comprendre où le site doit se positionner et quels contenus peuvent capter la demande.",
    source:"Le QG, le site, les requêtes, les concurrents, les pages et les intentions de recherche.",
    livrable:"Une stratégie de mots-clés, pages, contenus et priorités SEO/GEO.",
    risque:"Choisir des mots-clés flatteurs mais sans intention client ni page correspondante.",
    controle:"Vérifier volumes, intentions, SERP, pages existantes et priorité business.",
    technique:"crawl, indexation, intention, requêtes, contenu utile, pages piliers et données structurées",
    valeur:"Attirer des prospects sans dépendre uniquement des publicités.",
    contexte:"un audit de requêtes, pages et contenus pour augmenter la visibilité organique",
    limiteIA:"L'IA propose des pistes ; l'humain valide l'intention commerciale et la faisabilité.",
    transitionSuite:"Créer ensuite un blog qui transforme ces requêtes en contenus utiles.",
    kpi:"l'apprenant sait dire quelle page répond à quelle requête et pourquoi."
  });

  Q[10] = build({
    num:'10',
    outil:"WordPress + Codex",
    objectif:"Installer une base de blog pensée pour attirer des leads, pas juste publier du contenu.",
    source:"Le dossier mon-business, le site 02-site, l'audit SEO/GEO et le fil rouge RestIA.",
    livrable:"Une structure de blog WordPress avec catégories, logique éditoriale et premières pages.",
    risque:"Automatiser les articles avant d'avoir une structure et une ligne éditoriale solides.",
    controle:"Vérifier catégories, URLs, lisibilité, lien avec les services et cohérence SEO.",
    technique:"architecture éditoriale, taxonomie, pages d'articles, maillage et WordPress REST API",
    valeur:"Transformer les requêtes détectées en contenus qui préparent la vente.",
    contexte:"une structure de blog reliée au site et aux besoins de prospects",
    limiteIA:"Codex aide à bâtir la structure ; l'humain garde le ton, l'offre et le message.",
    transitionSuite:"Automatiser ensuite la publication tout en gardant une boucle de contrôle.",
    kpi:"l'apprenant sait expliquer quels sujets attirent quels prospects."
  });

  Q[11] = build({
    num:'11',
    outil:"n8n + WordPress + contrôle éditorial",
    objectif:"Créer une automatisation d'articles qui garde une qualité éditoriale contrôlable.",
    source:"Le blog RestIA déjà structuré, les sujets validés et les règles de qualité.",
    livrable:"Un pipeline d'article avec génération, vérification, publication ou brouillon contrôlé.",
    risque:"Publier automatiquement du contenu générique sans relecture ni critère de qualité.",
    controle:"Relire le brouillon, vérifier source, titre, SEO, CTA, lien interne et statut de publication.",
    technique:"workflow, brouillon, API WordPress, qualité du contenu, boucle courte et logs",
    valeur:"Produire régulièrement sans tomber dans le contenu faible ou invérifiable.",
    contexte:"un système de publication automatique mais vérifiable",
    limiteIA:"L'automatisation accélère ; elle ne remplace pas la responsabilité éditoriale.",
    transitionSuite:"Connecter la présence sociale et les aimants à leads aux contenus utiles.",
    kpi:"l'apprenant peut corriger un article avant publication et expliquer le pipeline."
  });

  Q[12] = build({
    num:'12',
    outil:"LinkedIn",
    objectif:"Rendre LinkedIn crédible avant de poster ou demander des leads.",
    source:"L'offre, la preuve, le positionnement, les services et les statistiques LinkedIn.",
    livrable:"Un profil optimisé avec accroche claire, preuve, page entreprise et lecture en 5 secondes.",
    risque:"Vendre depuis un profil vide ou illisible qui ne montre pas de preuve.",
    controle:"Vérifier le haut du profil, la cohérence offre/preuve, les liens et les statistiques.",
    technique:"headline, bannière, résumé, page entreprise, preuve, CTA et analytics",
    valeur:"Créer de la confiance avant les contenus et la prospection.",
    contexte:"un profil personnel et une page entreprise qui rassurent et convertissent",
    limiteIA:"LinkedIn amplifie une crédibilité ; il ne compense pas une offre floue.",
    transitionSuite:"Créer un lead magnet relié à des posts qui déclenchent l'échange.",
    kpi:"un visiteur comprend l'offre en quelques secondes et sait quoi faire ensuite."
  });

  Q[13] = build({
    num:'13',
    outil:"LinkedIn + livrable lead magnet",
    objectif:"Concevoir un aimant à leads qui sert vraiment le prospect et nourrit la prospection.",
    source:"Les problèmes clients, les posts LinkedIn, l'offre et le format de livrable.",
    livrable:"Un lead magnet clair, actionnable et relié à une mécanique LinkedIn.",
    risque:"Faire un PDF décoratif qui ne résout rien et ne déclenche aucune action.",
    controle:"Tester la promesse, l'utilité, le CTA, la facilité d'accès et le lien avec l'offre.",
    technique:"valeur perçue, friction, commentaire, téléchargement, capture et suivi",
    valeur:"Transformer l'attention LinkedIn en conversation qualifiée.",
    contexte:"un livrable utile qui donne envie de commenter, télécharger ou échanger",
    limiteIA:"L'IA aide à structurer ; l'humain garantit la valeur réelle du livrable.",
    transitionSuite:"Automatiser ensuite des posts LinkedIn qui distribuent ce livrable.",
    kpi:"l'apprenant sait pourquoi un prospect voudrait demander ce lead magnet."
  });

  Q[14] = build({
    num:'14',
    outil:"Codex + LinkedIn",
    objectif:"Produire un stock de posts cohérents sans perdre le ton, l'offre et la valeur.",
    source:"Le dossier local, l'audit, les angles, le lead magnet et les preuves.",
    livrable:"100 posts LinkedIn structurés, relisibles, variés et liés au parcours de vente.",
    risque:"Générer 100 posts interchangeables, sans source, sans audit et sans relecture.",
    controle:"Vérifier variété, utilité, ton, CTA, lien avec l'offre et absence de répétition.",
    technique:"batch de contenu, prompt local, fichiers, angles, hooks, formats et contrôle qualité",
    valeur:"Tenir une présence régulière avec des contenus qui servent la conversion.",
    contexte:"une base de 100 posts organisée localement et alimentée par l'audit",
    limiteIA:"Codex produit une base ; l'humain choisit, adapte et publie au bon moment.",
    transitionSuite:"Utiliser cette présence pour alimenter la machine à leads.",
    kpi:"l'apprenant dispose d'un stock publiable et sait expliquer la logique des angles."
  });

  Q[15] = build({
    num:'15',
    outil:"Serper + recherche Google",
    objectif:"Trouver des leads gratuits sans chercher au hasard.",
    source:"Le dossier 06-prospects, les critères de cible, l'exemple restauration et les fichiers précédents.",
    livrable:"Un fichier de leads avec noms, sites, requêtes, sources et logique de sélection.",
    risque:"Accumuler des contacts sans ciblage, sans source et sans lien avec l'offre.",
    controle:"Contrôler la requête, la pertinence, la source, les doublons et les colonnes.",
    technique:"requêtes Serper, SERP, critères, extraction, colonnes et limites du gratuit",
    valeur:"Créer une matière première de prospection avant enrichissement.",
    contexte:"une première base de prospects obtenue par recherche structurée",
    limiteIA:"L'outil trouve des pistes ; l'humain définit la cible et le niveau de pertinence.",
    transitionSuite:"Enrichir les leads avec une couche officielle data.gouv/Sirene.",
    kpi:"la base contient des leads ciblés et traçables, pas une liste aléatoire."
  });

  Q[16] = build({
    num:'16',
    outil:"data.gouv + Sirene",
    objectif:"Transformer une liste floue en base vérifiable avec SIREN/SIRET et données légales.",
    source:"Le fichier Serper, les colonnes existantes, les noms, sites, adresses et sources officielles.",
    livrable:"Une base enrichie qui conserve les colonnes initiales et ajoute les identifiants utiles.",
    risque:"Écraser les colonnes Serper ou inventer un SIRET quand le matching est incertain.",
    controle:"Vérifier correspondance nom/adresse/site, conservation des colonnes et score de confiance.",
    technique:"matching, SIREN, SIRET, unité légale, établissement, API et contrôle de confiance",
    valeur:"Augmenter la fiabilité avant de chercher des contacts ou de prospecter.",
    contexte:"une base Google enrichie par des informations administratives vérifiables",
    limiteIA:"Data.gouv apporte une couche de vérité ; il ne remplace pas le jugement sur le match.",
    transitionSuite:"Passer à Apify pour trouver des contacts réels sur les sites ciblés.",
    kpi:"chaque ligne importante a une preuve légale ou un statut d'incertitude clair."
  });

  Q[17] = build({
    num:'17',
    outil:"Apify",
    objectif:"Passer de la preuve légale au contact exploitable sans crawler n'importe quoi.",
    source:"Le fichier enrichi data.gouv, les URLs, les volumes, les règles de crawl et les sources.",
    livrable:"Une base avec emails, formulaires, pages contact, sources et niveau de confiance.",
    risque:"Crawler tous les sites sans limite, sans volume estimé et sans logique de source.",
    controle:"Contrôler volume, source URL, pertinence contact, doublons et statut d'extraction.",
    technique:"Actors, input JSON, dataset, scraping ciblé, volume, stockage et source URL",
    valeur:"Obtenir des points de contact utiles en gardant une preuve de provenance.",
    contexte:"une base déjà vérifiée que l'on complète avec des contacts et signaux de site",
    limiteIA:"Apify extrait ; l'humain décide ce qui est utilisable et conforme à la prospection.",
    transitionSuite:"Nettoyer et scorer la base avant tout envoi.",
    kpi:"chaque contact utilisable est relié à une source et à une entreprise vérifiée."
  });

  Q[18] = build({
    num:'18',
    outil:"BDD prospects + scoring",
    objectif:"Nettoyer, dédupliquer, scorer et préparer une BDD avant toute prospection.",
    source:"Les leads enrichis, les champs commerciaux, les preuves et les contacts.",
    livrable:"Une BDD propre avec score, priorité, statut, prochaine action et champs d'outreach.",
    risque:"Envoyer des emails depuis une base riche mais sale, contradictoire ou non priorisée.",
    controle:"Contrôler doublons, champs obligatoires, score, raison du score et prochaine action.",
    technique:"déduplication, scoring, règles, champs CRM, segmentation et qualité des données",
    valeur:"Savoir qui contacter d'abord et pourquoi.",
    contexte:"une base enrichie que l'on rend exploitable pour l'outreach",
    limiteIA:"Le scoring aide à prioriser ; il ne doit pas masquer une donnée douteuse.",
    transitionSuite:"Construire une prospection automatisée limitée et sous contrôle.",
    kpi:"la base dit quoi faire ensuite pour chaque prospect prioritaire."
  });

  Q[19] = build({
    num:'19',
    outil:"n8n + email + base scorée",
    objectif:"Mettre en place une prospection automatique prudente, 10 emails par jour, après audit.",
    source:"Le fichier source propre, les segments, les scores, les messages et les règles d'envoi.",
    livrable:"Un système de prospection avec audit, limite de volume, logs et contrôle avant envoi.",
    risque:"Envoyer massivement avant audit ou sans limite de volume.",
    controle:"Tester sur petit volume, vérifier messages, destinataires, logs, désinscription et résultats.",
    technique:"séquence email, personnalisation, délivrabilité, limites, logs, opt-out et audit",
    valeur:"Apprendre à créer un système commercial reproductible et présentable à un client.",
    contexte:"une machine de prospection limitée, auditable et vendable",
    limiteIA:"L'automatisation envoie seulement ce qui a été cadré et validé.",
    transitionSuite:"Passer au delivery client avec une méthode de vente et d'audit.",
    kpi:"le système peut expliquer qui reçoit quoi, quand, pourquoi et avec quel suivi."
  });

  Q[20] = build({
    num:'20',
    outil:"audit client + retranscription",
    objectif:"Utiliser le R1 pour identifier le vrai problème et vendre la bonne solution.",
    source:"La retranscription du rendez-vous, les douleurs client, les outils et les contraintes.",
    livrable:"Un audit clair qui mène au R2 avec besoin principal, risques et solution proposée.",
    risque:"Proposer un outil IA avant d'avoir compris le besoin principal du client.",
    controle:"Relire la transcription, vérifier les citations utiles, le besoin, les contraintes et le produit proposé.",
    technique:"transcription, analyse de besoin, audit gratuit ou payant, chronologie R1-audit-R2",
    valeur:"Vendre un problème traité plutôt que vendre de l'IA de manière abstraite.",
    contexte:"un premier rendez-vous transformé en audit technique et proposition utile",
    limiteIA:"L'IA aide à synthétiser ; l'humain garde la relation, le diagnostic et l'engagement commercial.",
    transitionSuite:"Organiser le projet client après validation.",
    kpi:"l'audit tient en une phrase de besoin principal et une solution défendable."
  });

  Q[21] = build({
    num:'21',
    outil:"QG projet client",
    objectif:"Organiser le delivery pour que le client voie l'avancement et garde confiance.",
    source:"Le besoin validé, les livrables, les échanges, les décisions et les prochaines étapes.",
    livrable:"Un espace projet avec étapes, V1, suivi, preuves de travail et communication claire.",
    risque:"Travailler en silence jusqu'à la fin en laissant le client sans visibilité.",
    controle:"Vérifier que le client voit l'état, la prochaine action, les livrables et les décisions.",
    technique:"pilotage projet, visibilité, décisions, V1, communication, valeur perçue et boucle de suivi",
    valeur:"Réduire le doute client et valoriser le travail tout au long du delivery.",
    contexte:"un projet client visible, piloté et rassurant",
    limiteIA:"L'organisation ne fait pas le produit ; elle rend le delivery lisible et maîtrisé.",
    transitionSuite:"Construire un RAG sur mesure avec une base documentaire propre.",
    kpi:"le client sait ce qui est fait, ce qui arrive et pourquoi cela avance."
  });

  Q[22] = build({
    num:'22',
    outil:"Supabase + RAG + Codex",
    objectif:"Créer un RAG client sans se perdre dans la technique.",
    source:"Les documents client, le besoin, les chunks, les embeddings et la base Supabase.",
    livrable:"Un RAG capable de retrouver les bons passages et de répondre avec contexte.",
    risque:"Charger des documents sans les découper, indexer ou tester contre des questions réelles.",
    controle:"Tester les réponses avec questions métier, vérifier les sources récupérées et la pertinence.",
    technique:"chunks, embeddings, pgvector, requête sémantique, Supabase, MCP et test de réponses",
    valeur:"Donner au client un assistant qui répond à partir de ses propres documents.",
    contexte:"une base documentaire transformée en système de recherche augmentée",
    limiteIA:"Le RAG récupère du contexte ; il ne doit pas inventer hors des documents.",
    transitionSuite:"Brancher ce RAG dans un chatbot texte et vocal.",
    kpi:"le système répond mieux quand la question est couverte par les documents indexés."
  });

  Q[23] = build({
    num:'23',
    outil:"RAG + chatbot texte/vocal",
    objectif:"Créer un assistant client simple, sécurisé et relié au RAG existant.",
    source:"Le RAG de la séance précédente, le besoin client, les documents et les contraintes de sécurité.",
    livrable:"Un chatbot texte/vocal avec architecture simple, dossier propre, tests et garde-fous.",
    risque:"Privilégier le style ou la démo vocale avant la sécurité, les sources et le dossier projet.",
    controle:"Tester questions texte/voix, latence, sources, erreurs, refus utiles et sécurité.",
    technique:"architecture simple, retrieval, WebRTC/WebSocket, voix, outils, sécurité et logs",
    valeur:"Livrer une interface utile au client final sans surcomplexifier la stack.",
    contexte:"un RAG restaurant transformé en assistant IA utilisable en texte et en voix",
    limiteIA:"Le chatbot répond avec le contexte autorisé ; il ne doit pas exposer de données sensibles.",
    transitionSuite:"Préparer la validation finale sur l'ensemble du parcours.",
    kpi:"un utilisateur peut poser une question utile et recevoir une réponse sourcée et sûre."
  });

})();
