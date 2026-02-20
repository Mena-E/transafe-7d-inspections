import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("routes")
        .select(
          "id, name, direction, school_id, effective_start_date, effective_end_date, rate_per_mile, estimated_round_trip_mileage, effective_daily_rate, is_active"
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return NextResponse.json({ route: data });
    }

    const { data, error } = await supabaseAdmin
      .from("routes")
      .select(
        `id, name, direction, school_id, effective_start_date, effective_end_date,
         rate_per_mile, estimated_round_trip_mileage, effective_daily_rate,
         is_active, description`
      )
      .order("name", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ routes: data || [] });
  } catch (err: any) {
    console.error("GET /api/admin/routes error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load routes" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data, error } = await supabaseAdmin
      .from("routes")
      .insert(body)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ route: data });
  } catch (err: any) {
    console.error("POST /api/admin/routes error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create route" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing route id" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("routes")
      .update(fields)
      .eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("PATCH /api/admin/routes error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to update route" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const ids: string[] = body.ids;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Missing or empty 'ids' array" },
        { status: 400 }
      );
    }

    // 1) Delete driver assignments for these routes
    const { error: assignmentsErr } = await supabaseAdmin
      .from("driver_route_assignments")
      .delete()
      .in("route_id", ids);

    if (assignmentsErr) throw assignmentsErr;

    // 2) Delete route stops
    const { error: stopsErr } = await supabaseAdmin
      .from("route_stops")
      .delete()
      .in("route_id", ids);

    if (stopsErr) throw stopsErr;

    // 3) Delete the routes themselves
    const { error: routesErr } = await supabaseAdmin
      .from("routes")
      .delete()
      .in("id", ids);

    if (routesErr) throw routesErr;

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (err: any) {
    console.error("DELETE /api/admin/routes error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to delete routes" },
      { status: 500 }
    );
  }
}
