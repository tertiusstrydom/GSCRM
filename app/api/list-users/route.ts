import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SUPABASE_URL is not configured" },
        { status: 500 }
      );
    }

    if (!supabaseServiceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is missing");
      return NextResponse.json(
        { 
          error: "SUPABASE_SERVICE_ROLE_KEY is not configured. For local development, add it to .env.local. For production, add it to Vercel environment variables." 
        },
        { status: 500 }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // List all users
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error("Supabase admin error:", error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!data || !data.users) {
      return NextResponse.json({ users: [] });
    }

    // Map users to include role
    const users = data.users.map((user) => ({
      id: user.id,
      email: user.email || "No email",
      role: (user.user_metadata as any)?.role || "viewer",
      created_at: user.created_at
    }));

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("List users error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list users" },
      { status: 500 }
    );
  }
}


