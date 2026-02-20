import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("schools")
        .select("id, name, address, phone, start_time, end_time, notes")
        .eq("id", id)
        .single();
      if (error) throw error;
      return NextResponse.json({ school: data });
    }

    const { data, error } = await supabaseAdmin
      .from("schools")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ schools: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin
      .from("schools")
      .insert(body)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ school: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing school id" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("schools")
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
    if (!id) return NextResponse.json({ error: "Missing school id" }, { status: 400 });

    // Clean up route_stops referencing this school first (if no ON DELETE CASCADE)
    await supabaseAdmin
      .from("route_stops")
      .delete()
      .eq("school_id", id);

    // Delete the school
    const { error } = await supabaseAdmin
      .from("schools")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
