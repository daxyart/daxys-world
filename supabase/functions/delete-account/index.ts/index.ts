import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function collectUserFiles(admin: SupabaseClient, bucket: string, folder: string): Promise<string[]> {
  const files: string[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error("storage_list_failed");
    if (!data?.length) break;
    for (const entry of data) {
      const path = folder + "/" + entry.name;
      if (entry.id === null) files.push(...await collectUserFiles(admin, bucket, path));
      else files.push(path);
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return files;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const payload = await request.json();
    if (payload?.confirmation !== "SUPPRIMER") return new Response(JSON.stringify({ error: "confirmation_required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const admin = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    for (const bucket of ["public-content", "private-posts"]) {
      const files = await collectUserFiles(admin, bucket, user.id);
      for (let index = 0; index < files.length; index += 100) {
        const { error } = await admin.storage.from(bucket).remove(files.slice(index, index + 100));
        if (error) throw new Error("storage_remove_failed");
      }
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw new Error("account_delete_failed");
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("delete-account failed", error);
    return new Response(JSON.stringify({ error: "deletion_failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
