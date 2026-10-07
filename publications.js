import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./auth-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const feed = document.querySelector("#public-feed");
const status = document.querySelector("#feed-status");
const { data: { session } } = await supabase.auth.getSession();

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
  const followerCount = document.createElement("span");
  followerCount.className = "follower-count";
  followerCount.dataset.authorId = post.author_id;
  followerCount.textContent = `${followerCounts.get(post.author_id) || 0} abonnés`;
  author.append(followerCount);
  if (session?.user && session.user.id !== post.author_id) {
    const followButton = document.createElement("button");
    followButton.type = "button";
    followButton.className = "follow-button";
    followButton.textContent = followedIds.has(post.author_id) ? "Abonné" : "Suivre";
    followButton.dataset.authorId = post.author_id;
    if (followedIds.has(post.author_id)) followButton.classList.add("is-following");
    followButton.addEventListener("click", async () => {
      followButton.disabled = true;
      const alreadyFollowing = followedIds.has(post.author_id);
      const result = alreadyFollowing
        ? await supabase.from("follows").delete().eq("follower_id", session.user.id).eq("following_id", post.author_id)
        : await supabase.from("follows").insert({ follower_id: session.user.id, following_id: post.author_id });
      if (result.error) {
        followButton.disabled = false;
        status.textContent = "Impossible de modifier l’abonnement. Réessayez.";
        return;
      }
      if (alreadyFollowing) followedIds.delete(post.author_id);
      else followedIds.add(post.author_id);
      const count = Math.max(0, (followerCounts.get(post.author_id) || 0) + (alreadyFollowing ? -1 : 1));
      followerCounts.set(post.author_id, count);
      document.querySelectorAll(`.follower-count[data-author-id="${post.author_id}"]`).forEach((label) => { label.textContent = `${count} abonnés`; });
      document.querySelectorAll(`.follow-button[data-author-id="${post.author_id}"]`).forEach((button) => {
        button.textContent = alreadyFollowing ? "Suivre" : "Abonné";
        button.classList.toggle("is-following", !alreadyFollowing);
        button.disabled = false;
      });
      status.textContent = alreadyFollowing ? "Vous ne suivez plus ce profil." : "Vous suivez maintenant ce profil.";
    });
    author.append(followButton);
  }
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

let followedIds = new Set();
let followerCounts = new Map();
if (session?.user) {
  const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", session.user.id);
  followedIds = new Set((follows || []).map((row) => row.following_id));
}
const { data: posts, error } = await supabase.from("posts").select("id,author_id,body,image_url,visibility,created_at").eq("visibility", "public").order("created_at", { ascending: false }).limit(50);
if (error) {
  status.textContent = "Les publications seront disponibles après l’activation de la configuration Supabase.";
} else if (!posts.length) {
  status.textContent = "Aucune publication pour le moment. Connectez-vous pour être le premier à partager quelque chose.";
} else {
  const authorIds = [...new Set(posts.map((post) => post.author_id))];
  const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id,display_name,bio,avatar_url").in("id", authorIds);
  const { data: followerRows } = await supabase.from("follows").select("following_id").in("following_id", authorIds);
  followerCounts = new Map(authorIds.map((id) => [id, (followerRows || []).filter((row) => row.following_id === id).length]));
  if (profilesError) status.textContent = "Impossible de charger les profils des auteurs.";
  else {
    status.textContent = "";
    const byId = new Map((profiles || []).map((profile) => [profile.id, profile]));
    for (const post of posts) addPost(post, byId.get(post.author_id));
  }
}
