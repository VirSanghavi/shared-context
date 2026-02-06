import { Hono } from "hono";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { bearerAuth } from "hono/bearer-auth";
import { z } from "zod";
import { cors } from 'hono/cors';

// Environment variables type definition
type Bindings = {
  OPENAI_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SHARED_CONTEXT_API_SECRET: string;
  PROJECT_NAME?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS
app.use("/*", cors());

// Middleware: Check for API Secret if configured
app.use("/*", async (c, next) => {
  const secret = c.env.SHARED_CONTEXT_API_SECRET || process.env.SHARED_CONTEXT_API_SECRET;
  if (!secret) {
      // If no secret is set in env, we allow access (dev mode warning)
      // In production, this should be strictly enforced.
      console.warn("WARNING: SHARED_CONTEXT_API_SECRET is not set. API is unsecured.");
      return next();
  }
  
  const authMiddleware = bearerAuth({ token: secret });
  return authMiddleware(c, next);
});

// Initialize Clients
const getOpenAI = (c: any) => new OpenAI({ apiKey: c.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY });
const getSupabase = (c: any) => createClient(
  c.env.SUPABASE_URL || process.env.SUPABASE_URL,
  c.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Route: Health Check
app.get("/", (c) => c.text("Shared Context API is running"));

// Route: Embed and Store Context
// Expects: { items: { content: string, metadata: object }[] }
app.post("/embed", async (c) => {
  const openai = getOpenAI(c);
  const supabase = getSupabase(c);
  
  // 1. Validate Input
  const schema = z.object({
    items: z.array(z.object({
      content: z.string(),
      metadata: z.record(z.any()).optional()
    }))
  });

  let body;
  try {
    body = await c.req.json();
    schema.parse(body);
  } catch (e) {
    return c.json({ error: "Invalid request body", details: e }, 400);
  }
  
  const { items } = body as z.infer<typeof schema>;
  const projectName = c.env.PROJECT_NAME || process.env.PROJECT_NAME || "default";

  // 2. Get/Create Project ID
  // In a real multi-tenant app, this would come from the auth token
  const { data: project, error: projError } = await supabase
    .from('projects')
    .select('id')
    .eq('name', projectName)
    .single();

  let projectId = project?.id;

  if (!projectId) {
      const { data: newProj, error: createError } = await supabase
          .from('projects')
          .insert({ name: projectName })
          .select('id')
          .single();
      
      if (createError) {
          return c.json({ error: "Failed to create project", details: createError }, 500);
      }
      projectId = newProj.id;
  }

  // 3. Process Items
  const processed = [];
  
  // Clear existing embeddings for these files if valid metadata 'filename' exists
  // This is a naive 'sync' strategy: overwrite by filename.
  const filenames = new Set(items.map(i => i.metadata?.filename).filter(Boolean));
  if (filenames.size > 0) {
      // We need to implement a way to filter embeddings by metadata columns.
      // Since `metadata` is jsonb, we can query it.
      for (const fname of filenames) {
        await supabase
            .from('embeddings')
            .delete()
            .eq('project_id', projectId)
            .contains('metadata', { filename: fname });
      }
  }

  // 4. Generate Embeddings & Insert
  for (const item of items) {
      try {
          const response = await openai.embeddings.create({
              model: "text-embedding-3-small",
              input: item.content,
          });
          const embedding = response.data[0].embedding;

          const { error } = await supabase.from('embeddings').insert({
              project_id: projectId,
              content: item.content,
              // search_content: item.content, // Should match schema if column exists? schema says 'content'
              embedding: embedding,
              metadata: item.metadata
          });
          
          if (error) throw error;
          processed.push({ success: true, metadata: item.metadata });
      } catch (err) {
          console.error("Embedding error:", err);
          processed.push({ success: false, error: String(err) });
      }
  }

  return c.json({ message: "Processing complete", processed });
});

// Route: Search Context
app.post("/search", async (c) => {
    const openai = getOpenAI(c);
    const supabase = getSupabase(c);

    const schema = z.object({
        query: z.string(),
        limit: z.number().optional().default(5),
        threshold: z.number().optional().default(0.5)
    });

    let body;
    try {
        body = await c.req.json();
        schema.parse(body);
    } catch (e) {
        return c.json({ error: "Invalid request body", details: e }, 400);
    }

    const { query, limit, threshold } = body as z.infer<typeof schema>;
    const projectName = c.env.PROJECT_NAME || process.env.PROJECT_NAME || "default";

    // Get Project ID
    const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('name', projectName)
        .single();
    
    if (!project) {
        return c.json({ results: [] });
    }

    try {
        // Embed Query
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: query,
        });
        const queryEmbedding = response.data[0].embedding;

        // Call RPC
        const { data: documents, error } = await supabase.rpc('match_embeddings', {
            query_embedding: queryEmbedding,
            match_threshold: threshold,
            match_count: limit,
            p_id: project.id
        });

        if (error) {
            console.error("RPC Error:", error);
            return c.json({ error: "Wait! Database search failed.", details: error }, 500);
        }

        return c.json({ results: documents });

    } catch (err) {
        return c.json({ error: "Search failed", details: String(err) }, 500);
    }
});
