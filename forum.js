import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./auth-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const list = document.querySelector("#messages");
const status = document.querySelector("#forum-status");
const form = document.querySelector("#forum-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const loginLink = document.querySelector("#forum-login-link");
let currentCategory = "design";
let user = null;

function renderMessage(row) {
  const item = document.createElement("li");
  const header = document.createElement("div");
  header.className = "forum-message-header";
  const name = document.createElement("strong");
  name.textContent = row.profiles?.display_name || "Membre";
  const time = document.createElement("time");
  time.dateTime = row.created_at;
  time.textContent = new Date(row.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  header.append(name, time);
  const category = document.createElement("span");
  category.className = "forum-category-tag";
  category.textContent = ({ design: "Design et création", tech: "Innovation technologique", community: "Projets communautaires" })[row.category] || "Discussion";
  const body = document.createElement("p");
  body.textContent = row.body;
  item.append(header, category, body);
  return item;
}

async function loadMessages() {
  status.textContent = "Chargement des échanges…";
  const query = supabase.from("forum_messages").select("id,category,body,created_at,profiles(display_name)").order("created_at", { ascending: false }).limit(60);
  const { data, error } = currentCategory === "all" ? await query : await query.eq("category", currentCategory);
  list.replaceChildren();
  if (error) {
    status.textContent = "Le forum enregistré sera disponible après l’activation de sa configuration Supabase.";
    return;
  }
  status.textContent = data.length ? "Les derniers échanges de la communauté" : "Aucun message dans cette catégorie pour le moment.";
  for (const row of data) list.append(renderMessage(row));
}

const { data: { session } } = await supabase.auth.getSession();
user = session?.user ?? null;
form.hidden = !user;
loginLink.hidden = Boolean(user);
document.querySelectorAll(".category-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".category-button").forEach((item) => item.classList.toggle("selected-category", item === button));
    currentCategory = button.dataset.category;
    loadMessages();
  });
});
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = input.value.trim();
  if (!body || !user) return;
  sendButton.disabled = true;
  status.textContent = "Envoi du message…";
  const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (!existing) {
    const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "Membre";
    const { error: profileError } = await supabase.from("profiles").upsert({ id: user.id, display_name: displayName, bio: "", avatar_url: user.user_metadata?.avatar_url || null }, { onConflict: "id" });
    if (profileError) {
      status.textContent = "Impossible de préparer votre profil pour le forum. Réessayez.";
      sendButton.disabled = false;
      return;
    }
  }
  const { error } = await supabase.from("forum_messages").insert({ sender_id: user.id, category: currentCategory, body });
  sendButton.disabled = false;
  if (error) {
    status.textContent = "Votre message n’a pas été enregistré. Vérifiez la configuration du forum et réessayez.";
    return;
  }
  input.value = "";
  await loadMessages();
});
loadMessages();
