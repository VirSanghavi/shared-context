import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const session = await getSessionFromRequest(req as any);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Ensure authorized user owns the key (RLS handles this but good to be explicit/or allow RLS to fail)
    // We need user ID for RLS context if we were using `supabase.auth.signIn` but we are using admin client with explicit filters or relying on RLS?
    // WARNING: SUPABASE_SERVICE_ROLE_KEY bypasses RLS. We must verify ownership manually or use a scoped client.
    
    const userId = await getUserId(session.email);
    const { error } = await supabase
        .from("api_keys")
        .delete()
        .match({ id: params.id, user_id: userId });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

async function getUserId(email: string) {
    const { data: users } = await supabase.auth.admin.listUsers();
    const user = users.users.find(u => u.email === email);
    return user?.id;
}
