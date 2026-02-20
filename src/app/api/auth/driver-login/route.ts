import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { driverName, pin, vehicleId } = await req.json();

    if (!driverName || !pin) {
      return NextResponse.json({ error: "Name and PIN are required." }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("drivers")
      .select("id, full_name, license_number, is_active, pin, created_at")
      .ilike("full_name", driverName.trim().replace(/\s+/g, " "))
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "No active driver found with that name. Please contact your admin to register you." },
        { status: 404 }
      );
    }

    const driver = data[0];

    if (!driver.pin || driver.pin.trim() === "") {
      return NextResponse.json(
        { error: "This driver does not have a PIN set yet. Please contact your admin." },
        { status: 403 }
      );
    }

    if (driver.pin.trim() !== pin.trim()) {
      return NextResponse.json(
        { error: "Name, vehicle, or PIN is incorrect." },
        { status: 401 }
      );
    }

    // Return driver info without PIN
    return NextResponse.json({
      driver: {
        id: driver.id,
        full_name: driver.full_name,
        license_number: driver.license_number,
        is_active: driver.is_active,
        pin: null, // never expose PIN to client
        created_at: driver.created_at,
      },
    });
  } catch (err: any) {
    console.error("Driver login error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
