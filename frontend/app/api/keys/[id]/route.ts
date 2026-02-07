import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

function getSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key || url.includes("<") || url.includes("your-project")) {
        return null;
    }
    
    return createClient(url, key);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const supabase = getSupabaseClient();
    if (!supabase) {
        return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { id } = await params;
    const session = await getSessionFromRequest(req as any);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const userId = session.sub || session.id || await getUserId(supabase, session.email);
        
        if (!userId) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const { error } = await supabase
            .from("api_keys")
            .delete()
            .match({ id, user_id: userId });

        if (error) {
            console.error("Delete key error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("Delete key exception:", err);
        return NextResponse.json({ error: err?.message || "Failed to delete key" }, { status: 500 });
    }
}

async function getUserId(supabase: any, email: string) {
    try {
        if (!email) return null;
        
        const { data: users } = await supabase.auth.admin.listUsers();
        if (users?.users) {
            const user = users.users.find((u: any) => u.email === email);
            if (user) return user.id;
        }

        // Fallback: check profiles table
        const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", email)
            .single();
        
        return profile?.id;
    } catch (err) {
        console.error("getUserId error in component:", err);
        return null;
    }
}
