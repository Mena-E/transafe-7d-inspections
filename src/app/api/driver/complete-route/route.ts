import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { driver_id, route_id } = await req.json();
    if (!driver_id || !route_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    const { error } = await supabaseAdmin
      .from("driver_route_completions")
      .upsert(
        { driver_id, route_id, work_date: today },
        { onConflict: "driver_id,route_id,work_date" }
      );

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Complete route error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
