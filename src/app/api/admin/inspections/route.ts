import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("inspections")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return NextResponse.json({ inspection: data });
    }

    const { data, error } = await supabaseAdmin
      .from("inspections")
      .select("*")
      .order("submitted_at", { ascending: false });

    if (error) throw error;

    // Map fields to handle different column name possibilities
    // The client-side already does extensive fallback mapping, but we normalize here too
    const inspections = (data || []).map((row: any) => ({
      id: row.id,
      inspection_type: row.inspection_type ?? row.type ?? "pre",
      shift: row.shift ?? row.shift_name ?? null,
      submitted_at: row.submitted_at ?? row.created_at ?? null,
      inspection_date: row.inspection_date ?? row.date ?? null,
      overall_status: row.overall_status ?? row.status ?? null,
      driver_name:
        row.driver_name ??
        row.driver ??
        row.driver_full_name ??
        (row.driver_id ? `Driver ${row.driver_id}` : "Unknown driver"),
      vehicle_label:
        row.vehicle_label ??
        row.vehicle ??
        row.vehicle_label_full ??
        (row.vehicle_id ? `Vehicle ${row.vehicle_id}` : null),
      driver_id: row.driver_id ?? null,
      vehicle_id: row.vehicle_id ?? null,
    }));

    return NextResponse.json({ inspections });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
