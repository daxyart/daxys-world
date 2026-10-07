Daxy's World — site statique pour GitHub Pages

Le site public est https://daxyart.github.io/daxys-world/.

INSCRIPTION ET CONNEXION
Les formulaires utilisent Supabase Auth. La configuration publique du projet est dans auth-config.js. Ne jamais ajouter une clé secret/service_role ou un mot de passe dans les fichiers du site.

ESPACE PERSONNEL ET PUBLICATIONS
Mon compte permet de modifier le nom affiché, la présentation et la photo de profil, publier du texte et des images en choisissant entre « Tout le monde » et « Moi uniquement », modifier le texte et la visibilité ou supprimer ses propres publications, suivre ou ne plus suivre des profils, changer l'adresse e-mail (confirmation requise), changer le mot de passe et se déconnecter. Les publications privées et leurs images sont visibles uniquement par leur auteur. La page Publications affiche les 50 publications publiques les plus récentes et permet de suivre les auteurs.

CONFIGURATION SUPABASE REQUISE
La configuration initiale a déjà été exécutée. Pour ajouter le choix de visibilité et le suivi, ouvrir Supabase > SQL Editor et exécuter supabase/account-visibility-follows.sql dans le projet daxys-world-auth (référence projet zwhuqaecwzwfcjewcilc). Cette migration ajoute les règles de lecture privées, la table des abonnements et un stockage privé réservé aux images de publications privées. Images JPG, PNG et WebP, 5 Mo maximum.

Après avoir exécuté le SQL, publier les fichiers du site sur GitHub Pages. Les pages utilisent la clé publishable du projet, jamais une clé privée.

LIMITES
La suppression de compte n'est pas disponible : elle nécessite un traitement côté serveur. Les publications sont publiques et ne disposent pas encore d'outils de signalement ou de modération.
