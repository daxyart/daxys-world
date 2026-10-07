import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./auth-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const loadingPanel = document.querySelector("#loading-panel");
const accountPanel = document.querySelector("#account-panel");
const message = document.querySelector("#account-message");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.color = isError ? "#b42318" : "#147a3d";
}

const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (sessionError || !session) {
  window.location.replace("connexion.html");
} else {
  loadingPanel.hidden = true;
  accountPanel.hidden = false;
  const user = session.user;
  document.querySelector("#current-email").textContent = user.email || "";
  document.querySelector("#display-name").value = user.user_metadata?.display_name || "";
  document.querySelector("#new-email").value = user.email || "";

  document.querySelector("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    const displayName = document.querySelector("#display-name").value.trim();
    const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
    button.disabled = false;
    showMessage(error ? "La mise à jour du profil a échoué. Réessayez." : "Votre profil a été mis à jour.", Boolean(error));
  });

  document.querySelector("#email-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    const email = document.querySelector("#new-email").value.trim();
    if (email.toLowerCase() === (user.email || "").toLowerCase()) {
      showMessage("Cette adresse e-mail est déjà associée à votre compte.", true);
      return;
    }
    button.disabled = true;
    const { error } = await supabase.auth.updateUser({ email });
    button.disabled = false;
    showMessage(error ? "La demande de changement d'adresse a échoué. Vérifiez l'adresse et réessayez." : "Un lien de confirmation a été envoyé à la nouvelle adresse e-mail.", Boolean(error));
  });

  document.querySelector("#password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    const password = document.querySelector("#new-password").value;
    const confirmation = document.querySelector("#confirm-password").value;
    if (password !== confirmation) {
      showMessage("Les deux mots de passe ne correspondent pas.", true);
      return;
    }
    button.disabled = true;
    const { error } = await supabase.auth.updateUser({ password });
    button.disabled = false;
    if (error) {
      showMessage("La modification du mot de passe a échoué. Réessayez.", true);
    } else {
      event.currentTarget.reset();
      showMessage("Votre mot de passe a été modifié.");
    }
  });

  document.querySelector("#signout-button").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) {
      event.currentTarget.disabled = false;
      showMessage("La déconnexion a échoué. Réessayez.", true);
    } else {
      window.location.replace("connexion.html");
    }
  });
}
