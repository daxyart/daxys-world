import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./auth-config.js";

const message = document.querySelector("#auth-message");
const clientConfigured = !SUPABASE_URL.includes("YOUR-PROJECT") &&
  !SUPABASE_PUBLISHABLE_KEY.includes("YOUR-PUBLISHABLE");

function showMessage(text, isError = false) {
  if (!message) return;
  message.textContent = text;
  message.style.color = isError ? "#b42318" : "#147a3d";
}

if (!clientConfigured) {
  showMessage("La création de compte n'est pas encore configurée. Réessayez plus tard.", true);
} else {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const signupForm = document.querySelector("#signup-form");
  const loginForm = document.querySelector("#login-form");
  const logoutButton = document.querySelector("#logout-button");
  const accountStatus = document.querySelector("#account-status");

  signupForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(signupForm);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));
    const confirmation = String(form.get("password-confirm"));
    if (password !== confirmation) {
      showMessage("Les deux mots de passe ne correspondent pas.", true);
      return;
    }
    const button = signupForm.querySelector("button[type=submit]");
    button.disabled = true;
    showMessage("Création du compte en cours…");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + "/daxys-world/connexion.html", data: { display_name: String(form.get("display_name")).trim() } }
    });
    button.disabled = false;
    if (error) {
      showMessage(error.message, true);
    } else if (data.session) {
      showMessage("Compte créé et connecté. Tu peux maintenant explorer le site.");
    } else {
      showMessage("Compte créé. Consulte ta boîte e-mail et clique sur le lien de confirmation pour terminer l'inscription.");
    }
  });

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);
    const button = loginForm.querySelector("button[type=submit]");
    button.disabled = true;
    showMessage("Connexion en cours…");
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email")).trim(),
      password: String(form.get("password"))
    });
    button.disabled = false;
    if (error) {
      showMessage("Connexion impossible. Vérifie ton e-mail, ton mot de passe et la confirmation de ton adresse.", true);
    } else {
      window.location.href = "mon-compte.html";
    }
  });

  logoutButton?.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    showMessage(error ? "La déconnexion a échoué." : "Tu es déconnecté.", Boolean(error));
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    if (accountStatus) accountStatus.textContent = session?.user?.email ? "Connecté en tant que " + session.user.email : "";
    if (logoutButton) logoutButton.hidden = !session;
    const accountLink = document.querySelector("#account-link");
    if (accountLink) accountLink.hidden = !session;
  });
}
