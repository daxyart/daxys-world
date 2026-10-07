Daxy's World — site statique pour GitHub Pages

Le site est publié sur https://daxyart.github.io/daxys-world/.

INSCRIPTION ET CONNEXION
Les formulaires utilisent Supabase Auth pour créer des comptes par e-mail et mot de passe. Le projet Supabase daxys-world-auth est configuré avec le site public et l'URL de confirmation. Les identifiants publics du projet sont dans auth-config.js.

La clé publishable dans auth-config.js est prévue pour être visible dans le site public. Ne jamais utiliser une clé secret/service_role dans un fichier web. Ne jamais publier le mot de passe de la base.

Après publication, un nouvel inscrit devra cliquer sur le lien de confirmation reçu par e-mail, puis se connecter.

LIMITES
Le forum reste une démonstration locale : les messages ne sont ni partagés ni enregistrés. Le formulaire de contact prépare un e-mail dans l'application de messagerie du visiteur ; il ne transmet rien automatiquement.
