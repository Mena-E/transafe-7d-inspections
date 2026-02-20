import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  try {
    // Fetch all households
    const { data: householdData, error: householdErr } = await supabaseAdmin
      .from("households")
      .select("*")
      .order("address", { ascending: true });

    if (householdErr) throw householdErr;

    // Fetch all students with their household_id to build the students array per household
    const { data: studentData, error: studentErr } = await supabaseAdmin
      .from("students")
      .select("id, full_name, household_id")
      .order("full_name", { ascending: true });

    if (studentErr) throw studentErr;

    // Group students by household_id
    const studentsByHousehold = new Map<string, { id: string; full_name: string }[]>();
    (studentData || []).forEach((s: any) => {
      if (!s.household_id) return;
      if (!studentsByHousehold.has(s.household_id)) {
        studentsByHousehold.set(s.household_id, []);
      }
      studentsByHousehold.get(s.household_id)!.push({
        id: s.id,
        full_name: s.full_name,
      });
    });

    // Build response with student counts and student arrays
    const households = (householdData || []).map((h: any) => {
      const students = studentsByHousehold.get(h.id) || [];
      return {
        ...h,
        student_count: students.length,
        students,
      };
    });

    return NextResponse.json({ households });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
