import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("vehicles")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return NextResponse.json({ vehicle: data });
    }

    const { data, error } = await supabaseAdmin
      .from("vehicles")
      .select("*")
      .order("label", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ vehicles: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin
      .from("vehicles")
      .insert(body)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ vehicle: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing vehicle id" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("vehicles")
      .update(fields)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ vehicle: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing vehicle id" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("vehicles")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
