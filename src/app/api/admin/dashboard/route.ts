import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const [
      driversRes,
      vehiclesRes,
      studentsRes,
      schoolsRes,
      routesRes,
      inspectionsRes,
      recentInspRes,
    ] = await Promise.all([
      supabaseAdmin.from("drivers").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("vehicles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("students").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("schools").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("routes").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("inspections").select("*", { count: "exact", head: true }),
      supabaseAdmin
        .from("inspections")
        .select("*")
        .order("id", { ascending: false })
        .limit(5),
    ]);

    const firstError =
      driversRes.error ||
      vehiclesRes.error ||
      studentsRes.error ||
      schoolsRes.error ||
      routesRes.error ||
      inspectionsRes.error ||
      recentInspRes.error;

    if (firstError) throw firstError;

    return NextResponse.json({
      counts: {
        drivers: driversRes.count ?? 0,
        vehicles: vehiclesRes.count ?? 0,
        students: studentsRes.count ?? 0,
        schools: schoolsRes.count ?? 0,
        routes: routesRes.count ?? 0,
        inspections: inspectionsRes.count ?? 0,
      },
      recentInspections: (recentInspRes.data || []).map((row: any) => ({
        id: row.id,
        driver_name:
          row.driver_name ?? row.driver ?? row.driver_full_name ?? null,
        vehicle_label:
          row.vehicle_label ?? row.vehicle ?? row.vehicle_label_full ?? null,
        inspection_type: row.inspection_type ?? row.type ?? null,
        shift: row.shift ?? row.shift_name ?? null,
        overall_status: row.overall_status ?? row.status ?? null,
        submitted_at:
          row.submitted_at ?? row.inspection_date ?? row.date ?? null,
      })),
    });
  } catch (err: any) {
    console.error("GET /api/admin/dashboard error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to load dashboard data" },
      { status: 500 }
    );
  }
}
