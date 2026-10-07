import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./auth-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const BUCKET = "public-content";
const PRIVATE_BUCKET = "private-posts";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
const loadingPanel = document.querySelector("#loading-panel");
const accountPanel = document.querySelector("#account-panel");
const message = document.querySelector("#account-message");
const avatarPreview = document.querySelector("#avatar-preview");
const defaultAccountTitle = document.querySelector("#account-title-default");
const accountProfileHeader = document.querySelector("#account-profile-header");

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

async function uploadImage(userId, file, prefix, bucket = BUCKET) {
  const path = imagePath(userId, file, prefix);
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return bucket === PRIVATE_BUCKET ? path : supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
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
  const visibility = document.createElement("span");
  visibility.className = "post-visibility";
  visibility.textContent = post.visibility === "private" ? "Visible par vous uniquement" : "Visible par tout le monde";
  card.append(visibility);
  if (post.body) {
    const body = document.createElement("p");
    body.className = "post-body";
    body.textContent = post.body;
    card.append(body);
  }
  if (post.image_url) {
    const image = imageElement("", "Image publiée", "post-image");
    card.append(image);
    if (post.visibility === "private") {
      supabase.storage.from(PRIVATE_BUCKET).createSignedUrl(post.image_url, 300).then(({ data }) => {
        if (data?.signedUrl) image.src = data.signedUrl;
      });
    } else image.src = post.image_url;
  }
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
    const visibilityButton = document.createElement("button");
    visibilityButton.type = "button";
    visibilityButton.className = "edit-post";
    visibilityButton.textContent = post.visibility === "private" ? "Rendre visible par tous" : "Rendre privé";
    visibilityButton.addEventListener("click", async () => {
      visibilityButton.disabled = true;
      const nextVisibility = post.visibility === "private" ? "public" : "private";
      let nextImageUrl = post.image_url;
      let movedFile = null;
      try {
        if (post.image_url) {
          const fromPrivate = post.visibility === "private";
          const fromBucket = fromPrivate ? PRIVATE_BUCKET : BUCKET;
          const toBucket = nextVisibility === "private" ? PRIVATE_BUCKET : BUCKET;
          if (fromPrivate) movedFile = { bucket: fromBucket, path: post.image_url };
          else {
            const marker = "/storage/v1/object/public/public-content/";
            const path = decodeURIComponent(new URL(post.image_url).pathname.split(marker)[1] || "");
            if (!path) throw new Error("image_path_missing");
            movedFile = { bucket: fromBucket, path };
          }
          const { data: fileData, error: downloadError } = await supabase.storage.from(fromBucket).download(movedFile.path);
          if (downloadError) throw downloadError;
          const extension = movedFile.path.split(".").pop() || "bin";
          const nextPath = `${currentUser.id}/post-${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage.from(toBucket).upload(nextPath, fileData, { contentType: fileData.type || "application/octet-stream", upsert: false });
          if (uploadError) throw uploadError;
          nextImageUrl = nextVisibility === "private" ? nextPath : supabase.storage.from(BUCKET).getPublicUrl(nextPath).data.publicUrl;
          movedFile = { ...movedFile, nextBucket: toBucket, nextPath };
        }
        const { error } = await supabase.from("posts").update({ visibility: nextVisibility, image_url: nextImageUrl }).eq("id", post.id);
        if (error) throw error;
        if (movedFile) await supabase.storage.from(movedFile.bucket).remove([movedFile.path]);
        showMessage(nextVisibility === "private" ? "Cette publication est maintenant privée." : "Cette publication est maintenant visible par tous.");
        await loadMyPosts(currentUser.id);
      } catch (error) {
        if (movedFile?.nextPath) await supabase.storage.from(movedFile.nextBucket).remove([movedFile.nextPath]);
        visibilityButton.disabled = false;
        showMessage("Le changement de visibilité a échoué. Vérifiez la configuration Supabase puis réessayez.", true);
      }
    });
    card.append(visibilityButton);
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
let existingAvatar = "";
async function loadMyPosts(userId) {
  const host = document.querySelector("#my-posts");
  host.replaceChildren();
  const { data: posts, error } = await supabase.from("posts").select("id,author_id,body,image_url,visibility,created_at").eq("author_id", userId).order("created_at", { ascending: false }).limit(50);
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

let activeNetworkView = "following";
function showAccountView(view) {
  document.querySelectorAll("[data-account-view]").forEach((section) => {
    section.hidden = section.dataset.accountView !== view;
  });
  document.querySelectorAll("[data-open-view]").forEach((button) => {
    if (button.dataset.openView === view) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  if (view === "security") document.querySelector("#account-security").open = true;
  if (view === "posts" && currentUser) loadMyPosts(currentUser.id);
  if (view === "network" && currentUser) {
    loadMyNetwork(currentUser.id, activeNetworkView);
    document.querySelector("#account-network").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

document.querySelectorAll("[data-open-view]").forEach((button) => {
  button.addEventListener("click", () => showAccountView(button.dataset.openView));
});

async function loadMyNetwork(userId, view = activeNetworkView) {
  activeNetworkView = view;
  const host = document.querySelector("#my-network-list");
  host.replaceChildren();
  const { data: relationships, error } = await supabase.from("follows").select("follower_id,following_id,created_at").eq(view === "following" ? "follower_id" : "following_id", userId).order("created_at", { ascending: false });
  if (error) { host.textContent = "Impossible de charger votre réseau pour le moment."; return; }
  document.querySelectorAll("[data-network-view]").forEach((button) => {
    const selected = button.dataset.networkView === view;
    if (button.getAttribute("role") === "tab") {
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
    }
  });
  const ids = relationships.map((item) => view === "following" ? item.following_id : item.follower_id);
  document.querySelector("#my-network-list").dataset.view = view;
  if (!ids.length) {
    host.textContent = view === "following" ? "Vous ne suivez encore aucun profil. Découvrez les membres dans la communauté." : "Vous n’avez pas encore d’abonné.";
    return;
  }
  const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids);
  if (profilesError) { host.textContent = "Impossible de charger les profils."; return; }
  const { data: ownFollowing } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
  const ownFollowingIds = new Set((ownFollowing || []).map((row) => row.following_id));
  const byId = new Map((profiles || []).map((profile) => [profile.id, profile]));
  for (const id of ids) {
    const profile = byId.get(id);
    if (!profile) continue;
    const item = document.createElement("div");
    item.className = "follow-card";
    if (profile.avatar_url) item.append(imageElement(profile.avatar_url, "", "post-avatar"));
    const name = document.createElement("strong");
    name.textContent = profile.display_name || "Membre";
    item.append(name);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "network-action";
    const alreadyFollowing = view === "following" || ownFollowingIds.has(id);
    button.textContent = alreadyFollowing ? "Abonné" : "Suivre";
    if (alreadyFollowing) button.classList.add("is-following");
    button.addEventListener("click", async () => {
      button.disabled = true;
      const result = alreadyFollowing
        ? await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", id)
        : await supabase.from("follows").insert({ follower_id: userId, following_id: id });
      if (result.error) { button.disabled = false; showMessage("Impossible de modifier cet abonnement.", true); }
      else {
        showMessage(alreadyFollowing ? "Vous ne suivez plus ce profil." : "Vous suivez maintenant ce profil.");
        await loadNetworkStats(userId);
        await loadMyNetwork(userId, view);
      }
    });
    item.append(button);
    host.append(item);
  }
}

async function loadNetworkStats(userId) {
  const [followersResult, followingResult] = await Promise.all([
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  document.querySelector("#followers-count").textContent = String(followersResult.count ?? 0);
  document.querySelector("#following-count").textContent = String(followingResult.count ?? 0);
}

document.querySelectorAll("[data-network-view]").forEach((button) => {
  button.addEventListener("click", () => {
    if (currentUser) {
      if (!button.matches('[role="tab"]')) {
        activeNetworkView = button.dataset.networkView;
        showAccountView("network");
      } else loadMyNetwork(currentUser.id, button.dataset.networkView);
    }
  });
});

function explainPostError(error) {
  const detail = String(error?.message || "");
  const code = String(error?.code || "");
  console.error("Échec de publication", { code, message: detail });
  if (code === "42501" || /row-level security|permission denied|not allowed/i.test(detail)) {
    return "Supabase a refusé l’enregistrement (droits de publication). Vérifiez les règles de la table posts et du stockage des images.";
  }
  if (code === "PGRST204" || /schema cache|column .*visibility|visibility.*column/i.test(detail)) {
    return "La configuration de visibilité des publications manque dans Supabase. Appliquez le fichier supabase/account-visibility-follows.sql.";
  }
  if (/bucket|storage|upload/i.test(detail)) {
    return "L’image n’a pas pu être envoyée au stockage Supabase. Vérifiez les buckets public-content et private-posts ainsi que leurs autorisations.";
  }
  if (code === "23514" || /posts_have_content/i.test(detail)) {
    return "Ajoutez du texte ou une image avant de publier.";
  }
  return detail ? `Publication impossible : ${detail.slice(0, 240)}` : "La publication a échoué. Réessayez.";
}

const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (sessionError || !session) {
  window.location.replace("connexion.html");
} else {
  currentUser = session.user;
  loadingPanel.hidden = true;
  accountPanel.hidden = false;
  defaultAccountTitle.hidden = true;
  accountProfileHeader.hidden = false;
  document.querySelector("#new-email").value = currentUser.email ?? "";

  const { data: profile, error: profileError } = await supabase.from("profiles").select("id,display_name,bio,avatar_url").eq("id", currentUser.id).maybeSingle();
  if (profileError) showMessage("Activez la configuration Supabase des profils et publications pour utiliser ces fonctions.", true);
  document.querySelector("#display-name").value = profile?.display_name ?? currentUser.user_metadata?.display_name ?? "";
  const initialDisplayName = document.querySelector("#display-name").value || "Mon profil";
  document.querySelector("#current-display-name").textContent = initialDisplayName;
  avatarPreview.alt = `Photo de profil de ${initialDisplayName}`;
  document.querySelector("#profile-bio").value = profile?.bio ?? "";
  existingAvatar = profile?.avatar_url ?? currentUser.user_metadata?.avatar_url ?? "";
  if (existingAvatar) avatarPreview.src = existingAvatar;

  const avatarFileInput = document.querySelector("#avatar-file");
  document.querySelector("#change-avatar-button").addEventListener("click", () => avatarFileInput.click());
  avatarFileInput.addEventListener("change", async (event) => {
    const file = event.currentTarget.files[0];
    const validation = validateImage(file);
    if (validation) {
      event.currentTarget.value = "";
      showMessage(validation, true);
      return;
    }
    if (!file) return;
    const button = document.querySelector("#change-avatar-button");
    button.disabled = true;
    try {
      const previewUrl = URL.createObjectURL(file);
      avatarPreview.src = previewUrl;
      const avatarUrl = await uploadImage(currentUser.id, file, "avatar");
      const displayName = document.querySelector("#display-name").value.trim() || "Membre";
      const bio = document.querySelector("#profile-bio").value.trim();
      const { error } = await supabase.from("profiles").upsert({ id: currentUser.id, display_name: displayName, bio, avatar_url: avatarUrl }, { onConflict: "id" });
      if (error) throw error;
      const { error: metadataError } = await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      if (metadataError) throw metadataError;
      existingAvatar = avatarUrl;
      avatarPreview.src = avatarUrl;
      showMessage("Votre photo de profil a été mise à jour.");
    } catch (error) {
      avatarPreview.src = existingAvatar || avatarPreview.src;
      showMessage("La photo n’a pas pu être enregistrée. Vérifiez le stockage Supabase puis réessayez.", true);
    } finally {
      button.disabled = false;
      avatarFileInput.value = "";
    }
  });

  document.querySelector("#profile-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    const displayName = document.querySelector("#display-name").value.trim();
    const bio = document.querySelector("#profile-bio").value.trim();
    button.disabled = true;
    try {
      const { error } = await supabase.from("profiles").upsert({ id: currentUser.id, display_name: displayName, bio, avatar_url: existingAvatar || null }, { onConflict: "id" });
      if (error) throw error;
      const { error: metadataError } = await supabase.auth.updateUser({ data: { display_name: displayName, bio, avatar_url: existingAvatar || null } });
      if (metadataError) throw metadataError;
      document.querySelector("#current-display-name").textContent = displayName || "Mon profil";
      avatarPreview.alt = `Photo de profil de ${displayName || "Mon profil"}`;
      showMessage("Votre profil a été mis à jour.");
      await loadMyPosts(currentUser.id);
    } catch (error) {
      showMessage(error.message?.includes("profiles") ? "La configuration Supabase des profils n’est pas encore activée." : "La mise à jour du profil a échoué. Réessayez.", true);
    } finally { button.disabled = false; }
  });

  const privateProfileForm = document.querySelector("#private-profile-form");
  const privateFields = ["phone", "address_line1", "address_line2", "postal_code", "city", "country"];
  const { data: privateProfile, error: privateProfileError } = await supabase.from("private_profiles").select(privateFields.join(",")).eq("id", currentUser.id).maybeSingle();
  if (privateProfileError) showMessage("Les informations privées nécessitent la migration Supabase prévue pour cette fonction.", true);
  for (const field of privateFields) {
    const input = privateProfileForm.elements.namedItem(field);
    if (input) input.value = privateProfile?.[field] ?? "";
  }
  privateProfileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button[type=submit]");
    const details = Object.fromEntries(privateFields.map((field) => [field, String(privateProfileForm.elements.namedItem(field).value).trim()]));
    button.disabled = true;
    const { error } = await supabase.from("private_profiles").upsert({ id: currentUser.id, ...details }, { onConflict: "id" });
    button.disabled = false;
    showMessage(error ? "L’enregistrement a échoué. Vérifiez que la configuration Supabase des informations privées est activée." : "Vos informations personnelles privées ont été enregistrées.", Boolean(error));
  });

  document.querySelector("#post-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type=submit]");
    const body = document.querySelector("#post-body").value.trim();
    const file = document.querySelector("#post-image").files[0];
    const validation = validateImage(file);
    if (validation) return showMessage(validation, true);
    if (!body && !file) return showMessage("Ajoutez un texte ou une image avant de publier.", true);
    button.disabled = true;
    try {
      const visibility = document.querySelector("#post-visibility").value;
      const imageUrl = file ? await uploadImage(currentUser.id, file, "post", visibility === "private" ? PRIVATE_BUCKET : BUCKET) : null;
      const { error } = await supabase.from("posts").insert({ author_id: currentUser.id, body, image_url: imageUrl, visibility });
      if (error) throw error;
      form.reset();
      showMessage("Votre publication est en ligne.");
      await loadMyPosts(currentUser.id);
    } catch (error) {
      showMessage(explainPostError(error), true);
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

  const deleteDialog = document.querySelector("#delete-account-dialog");
  const deleteConfirmation = document.querySelector("#delete-account-confirmation");
  const deleteSubmit = document.querySelector("#confirm-delete-account");
  document.querySelector("#open-delete-account").addEventListener("click", () => deleteDialog.showModal());
  document.querySelector("#cancel-delete-account").addEventListener("click", () => deleteDialog.close());
  deleteConfirmation.addEventListener("input", () => { deleteSubmit.disabled = deleteConfirmation.value !== "SUPPRIMER"; });
  document.querySelector("#delete-account-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (deleteConfirmation.value !== "SUPPRIMER") return;
    deleteSubmit.disabled = true;
    document.querySelector("#delete-account-error").textContent = "Suppression en cours…";
    const { error } = await supabase.functions.invoke("delete-account", { body: { confirmation: "SUPPRIMER" } });
    if (error) {
      document.querySelector("#delete-account-error").textContent = "La suppression n’est pas disponible pour le moment. Réessayez plus tard ou contactez l’administrateur du site.";
      deleteSubmit.disabled = false;
      return;
    }
    await supabase.auth.signOut();
    window.location.replace("index.html?account=deleted");
  });

  await loadMyPosts(currentUser.id);
  await loadNetworkStats(currentUser.id);
  await loadMyNetwork(currentUser.id, activeNetworkView);
}
