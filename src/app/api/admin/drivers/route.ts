import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("drivers")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ driver: data });
    }

    const { data, error } = await supabaseAdmin
      .from("drivers")
      .select("*")
      .order("full_name", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ drivers: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin
      .from("drivers")
      .insert(body)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ driver: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing driver id" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("drivers")
      .update(fields)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ driver: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing driver id" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("drivers")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
