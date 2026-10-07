import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./auth-config.js";

const host = document.querySelector("#forum-preview-messages");
if (host) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  const { data, error } = await supabase.from("forum_messages").select("id,category,body,created_at,profiles(display_name)").order("created_at", { ascending: false }).limit(3);
  host.replaceChildren();
  if (error || !data?.length) {
    const text = document.createElement("p");
    text.textContent = error ? "Les échanges du forum s’afficheront ici une fois la configuration activée." : "Le forum attend ses premiers échanges.";
    host.append(text);
  } else {
    for (const row of data) {
      const card = document.createElement("article");
      card.className = "forum-preview-card";
      const title = document.createElement("strong");
      title.textContent = row.profiles?.display_name || "Membre";
      const time = document.createElement("time");
      time.dateTime = row.created_at;
      time.textContent = new Date(row.created_at).toLocaleDateString("fr-FR");
      const body = document.createElement("p");
      body.textContent = row.body;
      card.append(title, time, body);
      host.append(card);
    }
  }
}
