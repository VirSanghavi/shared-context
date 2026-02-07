import { createClient } from "@supabase/supabase-js";

export async function logUsage({
    userId,
    apiKeyId,
    endpoint,
    method,
    statusCode,
    responseTimeMs,
    tokensUsed = 0
}: {
    userId: string;
    apiKeyId?: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseTimeMs?: number;
    tokensUsed?: number;
}) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    try {
        const { error } = await supabase.from("api_usage").insert({
            user_id: userId,
            api_key_id: apiKeyId,
            endpoint,
            method,
            status_code: statusCode,
            response_time_ms: responseTimeMs,
            tokens_used: tokensUsed
        });

        if (error) {
            console.error("Usage logging error:", error);
        }
    } catch (err) {
        console.error("Usage logging exception:", err);
    }
}
