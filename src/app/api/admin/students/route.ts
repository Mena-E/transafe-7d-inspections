import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const { data, error } = await supabaseAdmin
        .from("students")
        .select(
          "id, full_name, student_id, pickup_address, pickup_city, pickup_state, pickup_zip, school_id, is_active, created_at, primary_guardian_name, primary_guardian_phone, primary_guardian_relationship"
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ student: data });
    }

    // Fetch students
    const { data: studentData, error: studentErr } = await supabaseAdmin
      .from("students")
      .select(
        "id, full_name, student_id, pickup_address, is_active, school_id, primary_guardian_name, primary_guardian_phone"
      )
      .order("full_name", { ascending: true });

    if (studentErr) throw studentErr;

    // Fetch schools for mapping school_id to name
    const { data: schoolsData, error: schoolErr } = await supabaseAdmin
      .from("schools")
      .select("id, name");

    if (schoolErr) throw schoolErr;

    const schoolMap = new Map<string, string>();
    (schoolsData || []).forEach((s: any) => {
      if (s.id && s.name) schoolMap.set(s.id, s.name);
    });

    // Map students with school names
    const students = (studentData || []).map((row: any) => ({
      id: row.id,
      full_name: row.full_name,
      student_id: row.student_id,
      pickup_address: row.pickup_address,
      is_active: row.is_active,
      primary_guardian_name: row.primary_guardian_name ?? null,
      primary_guardian_phone: row.primary_guardian_phone ?? null,
      school_id: row.school_id ?? null,
      school_name: row.school_id ? schoolMap.get(row.school_id) ?? null : null,
    }));

    return NextResponse.json({ students });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { guardian, ...studentPayload } = body;

    // 1) Create the student
    const { data: studentRow, error: sErr } = await supabaseAdmin
      .from("students")
      .insert(studentPayload)
      .select("id")
      .single();
    if (sErr) throw sErr;

    const newStudentId = studentRow.id;

    // 2) Optionally create guardian + link
    if (guardian && guardian.full_name && guardian.phone) {
      const { data: guardianRow, error: gErr } = await supabaseAdmin
        .from("guardians")
        .insert({
          full_name: guardian.full_name,
          phone: guardian.phone,
          email: guardian.email || null,
          preferred_contact_method: guardian.preferred_contact_method || "call",
        })
        .select("id")
        .single();
      if (gErr) throw gErr;

      const { error: linkErr } = await supabaseAdmin
        .from("student_guardians")
        .insert({
          student_id: newStudentId,
          guardian_id: guardianRow.id,
          relationship: guardian.relationship || "Primary",
        });
      if (linkErr) throw linkErr;
    }

    return NextResponse.json({ success: true, id: newStudentId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: "Missing student id" }, { status: 400 });

    const { error } = await supabaseAdmin
      .from("students")
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
    if (!id) return NextResponse.json({ error: "Missing student id" }, { status: 400 });

    // 1) Remove student_guardians joins (if no ON DELETE CASCADE)
    await supabaseAdmin
      .from("student_guardians")
      .delete()
      .eq("student_id", id);

    // 2) Remove route_stops referencing this student
    await supabaseAdmin
      .from("route_stops")
      .delete()
      .eq("student_id", id);

    // 3) Delete the student
    const { error } = await supabaseAdmin
      .from("students")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
