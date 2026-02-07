import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
    try {
        const session = await getSessionFromRequest(req);
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Email normalization bypass
        const normalizedEmail = session.email.toLowerCase().trim();
        const targetEmail = (normalizedEmail === 'virrsanghavi@gmail.com') ? 'virsanghavi@gmail.com' : session.email;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        console.log(`[Mark Seen] Updating retention flag for: ${targetEmail}`);

        const { error } = await supabase
            .from('profiles')
            .update({ has_seen_retention: true })
            .ilike('email', targetEmail);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Mark Seen API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
