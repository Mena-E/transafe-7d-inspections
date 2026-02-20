import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const routeId = searchParams.get("route_id");
    if (!routeId) {
      return NextResponse.json({ error: "Missing route_id" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("route_stops")
      .select(
        "id, route_id, sequence, stop_type, student_id, school_id, address, planned_time, notes"
      )
      .eq("route_id", routeId)
      .order("sequence", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ stops: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin
      .from("route_stops")
      .insert(body)
      .select(
        "id, sequence, stop_type, student_id, school_id, address, planned_time, notes"
      )
      .single();
    if (error) throw error;
    return NextResponse.json({ stop: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    // Supports bulk upsert for saving stop order & details
    if (Array.isArray(body)) {
      const { error } = await supabaseAdmin
        .from("route_stops")
        .upsert(body, { onConflict: "id" });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // Single stop update
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing stop id" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("route_stops")
      .update(fields)
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing stop id" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("route_stops")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
