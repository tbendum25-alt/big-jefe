# BIG JEFE — site web d'hôtel

Site d'hôtel (React + Vite + TypeScript + Tailwind + Framer Motion) avec réservation de chambres, restaurant avec panier,
services, contact, factures PDF et espace propriétaire sécurisé. La base de données, la connexion et les photos sont
gérées par **Supabase** ; les opérations sensibles (paiement, e-mails) passent par des **fonctions serveur**.

> Le nom « BIG JEFE » est modifiable à un seul endroit : *Administration > Paramètres*.

## Deux modes de fonctionnement

| Mode | Quand | Pour quoi faire |
| --- | --- | --- |
| **Démonstration** | Aucune variable Supabase renseignée | Essayer le site tout de suite. Les données sont enregistrées **dans le navigateur uniquement**, sans aucune sécurité réelle. Bandeau doré « Mode démonstration » affiché. |
| **Production** | `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` renseignés | Vrai site : données partagées, comptes sécurisés, photos stockées durablement. |

## Essai rapide (mode démonstration)

```bash
npm install
npm run dev
```

Ouvrez l'adresse affichée. Espace propriétaire : `/admin` — identifiants d'essai (non affichés sur la page de connexion)
(`proprietaire@demo.local` / `demo1234`).

## Mise en production avec Supabase

1. **Créer un projet** sur <https://supabase.com> (offre gratuite suffisante pour démarrer).
2. **Créer les tables** : dans *SQL Editor*, exécutez dans l'ordre le contenu de
   - `supabase/migrations/001_schema.sql` (tables),
   - `supabase/migrations/002_functions_rls.sql` (fonctions, règles d'accès, stockage des photos),
   - `supabase/migrations/003_demo_seed.sql` (**facultatif** : données de démonstration à modifier ou supprimer).
3. **Équipe et compte propriétaire** : appliquez aussi `supabase/migrations/004_team.sql` (rôles propriétaire/employé).
   Il n'y a volontairement **aucune inscription publique**. Deux façons de créer le compte propriétaire :
   - **Recommandé — page de première configuration** : définissez un code secret (`supabase secrets set SETUP_CODE=un-code-long-et-secret`),
     déployez la fonction `admin-team` (étape 5), puis ouvrez `/admin` : un lien « Première utilisation ? Créer le compte propriétaire »
     apparaît tant qu'aucun propriétaire n'existe. Il se ferme définitivement après la création. Retirez ensuite `SETUP_CODE` si vous le souhaitez.
   - **Manuelle** : *Authentication > Users > Add user*, copiez son `User UID`, puis dans l'éditeur SQL :
     ```sql
     insert into public.admin_users (user_id, role) values ('COLLEZ-ICI-LE-USER-UID', 'owner');
     ```
   Ensuite, le propriétaire ajoute ses employés dans *Administration > Équipe* (e-mail + mot de passe temporaire). Seuls les comptes de
   `admin_users` accèdent à l'administration. Désactivez les inscriptions publiques
   (*Authentication > Providers > Email > désactiver « Allow new users to sign up »*).
4. **Variables du site** : copiez `.env.example` en `.env` et renseignez `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`
   (*Project Settings > API*). Seule la clé **anon** (publique) va dans le site.
5. **Fonctions serveur** (e-mails et paiement) avec la [CLI Supabase](https://supabase.com/docs/guides/cli) :
   ```bash
   supabase login
   supabase link --project-ref VOTRE-REF
   supabase secrets set SITE_URL=https://votre-site.example RESEND_API_KEY=... MAIL_FROM="BIG JEFE <reservations@votre-domaine>" \
     FEDAPAY_SECRET_KEY=... FEDAPAY_ENV=sandbox SETUP_CODE=un-code-long-et-secret
   supabase functions deploy send-email
   supabase functions deploy fedapay-create
   supabase functions deploy fedapay-webhook --no-verify-jwt
   supabase functions deploy admin-team --no-verify-jwt   # gestion de l'équipe + première configuration
   ```
   Les clés secrètes ne sont **jamais** dans le code du site.
6. **Réglages dans l'administration** : *Paramètres* (coordonnées, taxe, modes de paiement, mentions de facture), puis
   *Chambres*, *Restaurant* et *Services* pour saisir les vraies informations et téléverser les vraies photos.

## Déploiement du site

```bash
npm run build      # produit le dossier dist/
```

Déployez `dist/` sur Vercel, Netlify ou Cloudflare Pages en ajoutant les deux variables `VITE_…` dans leurs réglages et une
règle de réécriture « toutes les routes vers `index.html` » (nécessaire pour les pages `/chambres`, `/admin`, etc.).

## Ce qui fonctionne réellement

- **Réservation** : prix relu en base (jamais pris du navigateur), taxe configurable, numéro unique `BJ-AAMMJJ-XXXX`,
  **double réservation impossible** (contrainte d'exclusion PostgreSQL) ; le jour de départ reste libre pour l'arrivée suivante.
- **Restaurant** : menu configurable, panier, commande sur place / en chambre / à emporter, prix recalculés côté serveur.
- **Factures PDF** : copie figée des libellés, prix, taux de taxe et coordonnées au moment de l'émission ; un changement de tarif
  ne modifie jamais une facture déjà émise. Numérotation `FAC-AAAA-0001`. Téléchargeables depuis la confirmation,
  « Ma réservation » (numéro + e-mail) et l'administration.
- **Paiements** : une facture n'est « payée » que si des paiements **confirmés** couvrent le total. Le propriétaire peut
  enregistrer un paiement reçu (espèces, Mobile Money…) **uniquement avec une référence de preuve** ; il ne peut pas modifier
  directement les montants ni l'état de paiement.
- **Administration** : tableau de bord, réservations et commandes (statuts), chambres et photos (aperçu avant publication,
  photo principale, ordre, suppression), menu et photos des plats, services, factures, messages, paramètres.
- **Photos** : validées (JPG/PNG/WebP, 8 Mo), redimensionnées et converties en WebP avant l'envoi, stockées dans Supabase Storage.
- **Animations** : apparitions au défilement, parallaxe légère, transitions de pages, survols, compteurs, galerie plein écran,
  menu mobile animé ; désactivées si l'utilisateur réduit les animations.

## Limites actuelles — à lire avant la mise en ligne

- **Aucune photo réelle n'est fournie.** Je n'ai pas pu récupérer ni vérifier de photographies libres de droits depuis mon
  environnement. Le site affiche des visuels d'attente élégants ; ajoutez vos vraies photos dans l'administration.
- **Paiement en ligne non testé en conditions réelles.** `fedapay-create` et `fedapay-webhook` suivent le fonctionnement de FedaPay
  tel que je le connais, mais **n'ont pas été exécutés** contre FedaPay (pas de compte marchand ici). Validez-les avec la
  documentation FedaPay et un compte test avant d'activer « Proposer le paiement en ligne ». Tant que ce n'est pas activé,
  seul le paiement à l'hôtel est proposé. Kkiapay n'est pas intégré (FedaPay uniquement).
- **E-mails non testés** : `send-email` utilise Resend (compte et domaine d'envoi à créer). S'il est indisponible, le site
  reste utilisable (réservations et messages sont enregistrés en base). Le client n'est pas relancé automatiquement.
- **WhatsApp** : le numéro 0129226464 n'est **pas publié** tant que vous ne l'avez pas saisi au format international dans
  *Paramètres* (ex. `229XXXXXXXXXX`). Le bouton flottant n'apparaît qu'à ce moment-là.
- **Avis clients** : aucun avis n'est affiché (pas de faux témoignages). Une section d'avis réels n'est pas encore développée.
- **Carte** : un lien vers Google Maps est proposé ; aucune carte intégrée tant que l'adresse exacte n'est pas connue.
- **Taxes et mentions légales** : taux de taxe à 0 par défaut ; renseignez-le ainsi que les mentions obligatoires
  (RCCM, IFU…) avec votre comptable. Les données personnelles des clients (nom, e-mail, téléphone) sont accessibles
  uniquement au propriétaire ; prévoyez une politique de confidentialité adaptée à votre activité.
- **Services payants** : listés avec leur prix ; leur ajout à une facture existante n'est pas encore automatisé.
- Les factures PDF sont générées dans le navigateur à partir des données figées en base.

## Tests

```bash
npm test
```

Vérifie les calculs (nuits, chevauchements, taxe), la création de réservations et de commandes, le refus des doubles
réservations, le refus de tout prix venant du navigateur, l'obligation de preuve pour les paiements, l'état « payée »
et l'intangibilité des factures déjà émises (exécutés sur le mode démonstration, qui reproduit la logique des fonctions SQL).
Les règles SQL (RLS, contrainte d'exclusion) sont à valider dans votre projet Supabase après l'installation.

## Structure

```
src/
  components/    Layout, galerie, éléments d'interface, sélecteur de photos
  pages/         pages publiques + pages/admin (administration)
  lib/           api.ts (contrat), supabaseApi.ts, demoApi.ts, pricing.ts, invoice.ts, invoicePdf.ts, image.ts
supabase/
  migrations/    schéma, fonctions + règles d'accès, données de démonstration
  functions/     send-email, fedapay-create, fedapay-webhook
tests/           tests des principales fonctionnalités
```
#   b i g - j e f e  
 