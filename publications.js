import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./auth-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const feed = document.querySelector("#public-feed");
const status = document.querySelector("#feed-status");

function addPost(post, profile) {
  const card = document.createElement("article");
  card.className = "post-card";
  const author = document.createElement("div");
  author.className = "post-author";
  if (profile?.avatar_url) {
    const avatar = document.createElement("img");
    avatar.className = "post-avatar";
    avatar.src = profile.avatar_url;
    avatar.alt = "";
    avatar.loading = "lazy";
    author.append(avatar);
  }
  const name = document.createElement("strong");
  name.textContent = profile?.display_name || "Membre";
  author.append(name);
  const date = document.createElement("time");
  date.dateTime = post.created_at;
  date.textContent = new Date(post.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  author.append(date);
  card.append(author);
  if (profile?.bio) {
    const bio = document.createElement("p");
    bio.className = "hint";
    bio.textContent = profile.bio;
    card.append(bio);
  }
  if (post.body) {
    const body = document.createElement("p");
    body.className = "post-body";
    body.textContent = post.body;
    card.append(body);
  }
  if (post.image_url) {
    const image = document.createElement("img");
    image.className = "post-image";
    image.src = post.image_url;
    image.alt = "Image publiée par " + (profile?.display_name || "un membre");
    image.loading = "lazy";
    card.append(image);
  }
  feed.append(card);
}

const { data: posts, error } = await supabase.from("posts").select("id,author_id,body,image_url,created_at").order("created_at", { ascending: false }).limit(50);
if (error) {
  status.textContent = "Les publications seront disponibles après l’activation de la configuration Supabase.";
} else if (!posts.length) {
  status.textContent = "Aucune publication pour le moment. Connectez-vous pour être le premier à partager quelque chose.";
} else {
  const authorIds = [...new Set(posts.map((post) => post.author_id))];
  const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id,display_name,bio,avatar_url").in("id", authorIds);
  if (profilesError) status.textContent = "Impossible de charger les profils des auteurs.";
  else {
    status.textContent = "";
    const byId = new Map((profiles || []).map((profile) => [profile.id, profile]));
    for (const post of posts) addPost(post, byId.get(post.author_id));
  }
}
