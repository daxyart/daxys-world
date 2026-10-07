import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./auth-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const BUCKET = "public-content";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const loadingPanel = document.querySelector("#loading-panel");
const accountPanel = document.querySelector("#account-panel");
const message = document.querySelector("#account-message");
const avatarPreview = document.querySelector("#avatar-preview");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
  message.classList.toggle("success", !isError);
}

function validateImage(file) {
  if (!file) return "";
  if (!allowedTypes.includes(file.type)) return "Choisissez une image JPG, PNG ou WebP.";
  if (file.size > MAX_IMAGE_SIZE) return "L’image ne doit pas dépasser 5 Mo.";
  return "";
}

function imagePath(userId, file, prefix) {
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  return `${userId}/${prefix}-${crypto.randomUUID()}.${extension}`;
}

async function uploadImage(userId, file, prefix) {
  const path = imagePath(userId, file, prefix);
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function imageElement(url, alt, className) {
  const image = document.createElement("img");
  image.src = url;
  image.alt = alt;
  image.className = className;
  image.loading = "lazy";
  return image;
}

function renderPost(post, profile, canDelete = false) {
  const card = document.createElement("article");
  card.className = "post-card";
  const author = document.createElement("div");
  author.className = "post-author";
  if (profile?.avatar_url) author.append(imageElement(profile.avatar_url, "", "post-avatar"));
  const authorName = document.createElement("strong");
  authorName.textContent = profile?.display_name || "Membre";
  author.append(authorName);
  const date = document.createElement("time");
  date.dateTime = post.created_at;
  date.textContent = new Date(post.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  author.append(date);
  card.append(author);
  if (post.body) {
    const body = document.createElement("p");
    body.className = "post-body";
    body.textContent = post.body;
    card.append(body);
  }
  if (post.image_url) card.append(imageElement(post.image_url, "Image publiée", "post-image"));
  if (canDelete) {
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "edit-post";
    editButton.textContent = "Modifier le texte";
    editButton.addEventListener("click", async () => {
      const updatedBody = window.prompt("Modifiez le texte de votre publication (1 000 caractères maximum).", post.body || "");
      if (updatedBody === null) return;
      const body = updatedBody.trim();
      if (body.length > 1000) return showMessage("Le texte ne peut pas dépasser 1 000 caractères.", true);
      if (!body && !post.image_url) return showMessage("Ajoutez un texte ou conservez une image pour garder cette publication.", true);
      editButton.disabled = true;
      const { error } = await supabase.from("posts").update({ body }).eq("id", post.id);
      if (error) {
        editButton.disabled = false;
        showMessage("La modification a échoué. Réessayez.", true);
      } else {
        showMessage("Publication modifiée.");
        await loadMyPosts(currentUser.id);
      }
    });
    card.append(editButton);
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "delete-post";
    removeButton.textContent = "Supprimer ma publication";
    removeButton.addEventListener("click", async () => {
      if (!window.confirm("Supprimer définitivement cette publication ?")) return;
      removeButton.disabled = true;
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) {
        removeButton.disabled = false;
        showMessage("La suppression a échoué. Réessayez.", true);
      } else {
        showMessage("Publication supprimée.");
        await loadMyPosts(currentUser.id);
      }
    });
    card.append(removeButton);
  }
  return card;
}

let currentUser;
async function loadMyPosts(userId) {
  const host = document.querySelector("#my-posts");
  host.replaceChildren();
  const { data: posts, error } = await supabase.from("posts").select("id,author_id,body,image_url,created_at").eq("author_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) {
    host.textContent = "Impossible de charger vos publications. Appliquez d’abord la configuration Supabase.";
    return;
  }
  if (!posts.length) {
    host.textContent = "Vous n’avez pas encore publié.";
    return;
  }
  const { data: profile } = await supabase.from("profiles").select("id,display_name,avatar_url").eq("id", userId).maybeSingle();
  for (const post of posts) host.append(renderPost(post, profile, true));
}

const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (sessionError || !session) {
  window.location.replace("connexion.html");
} else {
  currentUser = session.user;
  loadingPanel.hidden = true;
  accountPanel.hidden = false;
  document.querySelector("#current-email").textContent = currentUser.email ?? "";
  document.querySelector("#new-email").value = currentUser.email ?? "";

  const { data: profile, error: profileError } = await supabase.from("profiles").select("id,display_name,bio,avatar_url").eq("id", currentUser.id).maybeSingle();
  if (profileError) showMessage("Activez la configuration Supabase des profils et publications pour utiliser ces fonctions.", true);
  document.querySelector("#display-name").value = profile?.display_name ?? currentUser.user_metadata?.display_name ?? "";
  document.querySelector("#profile-bio").value = profile?.bio ?? "";
  const existingAvatar = profile?.avatar_url ?? currentUser.user_metadata?.avatar_url ?? "";
  if (existingAvatar) avatarPreview.src = existingAvatar;

  document.querySelector("#avatar-file").addEventListener("change", (event) => {
    const file = event.currentTarget.files[0];
    const validation = validateImage(file);
    if (validation) {
      event.currentTarget.value = "";
      showMessage(validation, true);
    } else if (file) avatarPreview.src = URL.createObjectURL(file);
  });

  document.querySelector("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    const displayName = document.querySelector("#display-name").value.trim();
    const bio = document.querySelector("#profile-bio").value.trim();
    const avatarFile = document.querySelector("#avatar-file").files[0];
    const validation = validateImage(avatarFile);
    if (validation) return showMessage(validation, true);
    button.disabled = true;
    try {
      const avatarUrl = avatarFile ? await uploadImage(currentUser.id, avatarFile, "avatar") : existingAvatar;
      const { error } = await supabase.from("profiles").upsert({ id: currentUser.id, display_name: displayName, bio, avatar_url: avatarUrl }, { onConflict: "id" });
      if (error) throw error;
      const { error: metadataError } = await supabase.auth.updateUser({ data: { display_name: displayName, bio, avatar_url: avatarUrl } });
      if (metadataError) throw metadataError;
      showMessage("Votre profil a été mis à jour.");
      if (avatarUrl) avatarPreview.src = avatarUrl;
      document.querySelector("#avatar-file").value = "";
      await loadMyPosts(currentUser.id);
    } catch (error) {
      showMessage(error.message?.includes("profiles") ? "La configuration Supabase des profils n’est pas encore activée." : "La mise à jour du profil a échoué. Réessayez.", true);
    } finally { button.disabled = false; }
  });

  document.querySelector("#post-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    const body = document.querySelector("#post-body").value.trim();
    const file = document.querySelector("#post-image").files[0];
    const validation = validateImage(file);
    if (validation) return showMessage(validation, true);
    if (!body && !file) return showMessage("Ajoutez un texte ou une image avant de publier.", true);
    button.disabled = true;
    try {
      const imageUrl = file ? await uploadImage(currentUser.id, file, "post") : null;
      const { error } = await supabase.from("posts").insert({ author_id: currentUser.id, body, image_url: imageUrl });
      if (error) throw error;
      event.currentTarget.reset();
      showMessage("Votre publication est en ligne.");
      await loadMyPosts(currentUser.id);
    } catch (error) {
      showMessage(error.message?.includes("posts") || error.message?.includes("Bucket") ? "La configuration Supabase des publications n’est pas encore activée." : "La publication a échoué. Réessayez.", true);
    } finally { button.disabled = false; }
  });

  document.querySelector("#email-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    const email = document.querySelector("#new-email").value.trim();
    if (email.toLowerCase() === currentUser.email?.toLowerCase()) return showMessage("Cette adresse e-mail est déjà associée à votre compte.", true);
    button.disabled = true;
    const { error } = await supabase.auth.updateUser({ email });
    button.disabled = false;
    showMessage(error ? "La demande de changement d'adresse a échoué. Vérifiez l'adresse et réessayez." : "Un lien de confirmation a été envoyé à la nouvelle adresse e-mail.", Boolean(error));
  });

  document.querySelector("#password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.querySelector("#new-password").value;
    if (password !== document.querySelector("#confirm-password").value) return showMessage("Les deux mots de passe ne correspondent pas.", true);
    const button = event.currentTarget.querySelector("button[type=submit]");
    button.disabled = true;
    const { error } = await supabase.auth.updateUser({ password });
    button.disabled = false;
    if (error) showMessage("La modification du mot de passe a échoué. Réessayez.", true);
    else { event.currentTarget.reset(); showMessage("Votre mot de passe a été modifié."); }
  });

  document.querySelector("#signout-button").addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    const { error } = await supabase.auth.signOut();
    if (error) { event.currentTarget.disabled = false; showMessage("La déconnexion a échoué. Réessayez.", true); }
    else window.location.replace("connexion.html");
  });

  await loadMyPosts(currentUser.id);
}
