Daxy's World — site statique pour GitHub Pages

Le site public est https://daxyart.github.io/daxys-world/.

INSCRIPTION ET CONNEXION
Les formulaires utilisent Supabase Auth. La configuration publique du projet est dans auth-config.js. Ne jamais ajouter une clé secret/service_role ou un mot de passe dans les fichiers du site.

ESPACE PERSONNEL ET PUBLICATIONS
Mon compte permet de modifier le nom affiché, la présentation et la photo de profil, publier du texte et des images, modifier le texte ou supprimer ses propres publications, changer l'adresse e-mail (confirmation requise), changer le mot de passe et se déconnecter. La page Publications affiche les 50 publications les plus récentes.

CONFIGURATION SUPABASE REQUISE
Avant de publier les nouvelles fonctions, ouvrir Supabase > SQL Editor et exécuter le fichier supabase/account-community.sql dans le projet daxys-world-auth (référence projet zwhuqaecwzwfcjewcilc). Le script crée les tables et règles d'accès, ainsi que le bucket public-content. Les images de profil et de publication ainsi que les textes sont publics. Chaque utilisateur ne peut modifier ou supprimer que ses propres contenus. Images JPG, PNG et WebP, 5 Mo maximum.

Après avoir exécuté le SQL, publier les fichiers du site sur GitHub Pages. Les pages utilisent la clé publishable du projet, jamais une clé privée.

LIMITES
La suppression de compte n'est pas disponible : elle nécessite un traitement côté serveur. Les publications sont publiques et ne disposent pas encore d'outils de signalement ou de modération.
