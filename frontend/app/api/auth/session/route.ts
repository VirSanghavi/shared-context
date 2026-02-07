import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";

export async function GET() {
    try {
        const session = await getSessionFromCookies();
        return NextResponse.json({
            authenticated: !!session,
            user: session ? {
                email: session.email,
                id: session.sub || (session as { id?: string }).id || (session as { userId?: string }).userId
            } : null
        });
    } catch {
        return NextResponse.json({ authenticated: false, user: null });
    }
}
