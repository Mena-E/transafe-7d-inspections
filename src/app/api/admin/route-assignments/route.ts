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
      .from("driver_route_assignments")
      .select("id, driver_id, vehicle_id, day_of_week, is_active, notes")
      .eq("route_id", routeId);

    if (error) throw error;
    return NextResponse.json({ assignments: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Supports saving all assignments for a route at once
    // body: { route_id, assignments: AssignmentRow[] }
    const { route_id, assignments } = body;
    if (!route_id) {
      return NextResponse.json({ error: "Missing route_id" }, { status: 400 });
    }

    for (const row of assignments) {
      const hasAssignment = !!row.driver_id && !!row.vehicle_id;

      if (!hasAssignment) {
        // Delete existing assignment if it exists
        if (row.id) {
          const { error } = await supabaseAdmin
            .from("driver_route_assignments")
            .delete()
            .eq("id", row.id);
          if (error) throw error;
        }
        continue;
      }

      if (row.id) {
        // Update existing assignment
        const { error } = await supabaseAdmin
          .from("driver_route_assignments")
          .update({
            driver_id: row.driver_id,
            vehicle_id: row.vehicle_id,
            is_active: true,
            notes: row.notes || null,
          })
          .eq("id", row.id);
        if (error) throw error;
      } else {
        // Insert new assignment
        const { error } = await supabaseAdmin
          .from("driver_route_assignments")
          .insert({
            route_id,
            day_of_week: row.day_of_week,
            driver_id: row.driver_id,
            vehicle_id: row.vehicle_id,
            is_active: true,
            notes: row.notes || null,
          });
        if (error) throw error;
      }
    }

    // Return refreshed assignments
    const { data, error } = await supabaseAdmin
      .from("driver_route_assignments")
      .select("id, driver_id, vehicle_id, day_of_week, is_active, notes")
      .eq("route_id", route_id);
    if (error) throw error;

    return NextResponse.json({ assignments: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
