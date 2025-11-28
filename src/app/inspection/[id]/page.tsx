"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type InspectionRecord = {
  id: string;
  driver_name: string;
  vehicle_label: string | null;
  vehicle_id: string | null;
  inspection_type: "pre" | "post";
  shift: string | null;
  inspection_date: string;
  submitted_at: string;
  overall_status: string | null;
  answers: Record<string, string> | null;
  notes: string | null;
  signature_name: string;
  driver_license_number: string | null;
  odometer_reading: string | null;
};

type Vehicle = {
  id: string;
  label: string;
  year: number | null;
  make: string | null;
  model: string | null;
  plate: string | null;
  vin: string | null;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function InspectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const handleBack = () => {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");

    if (from === "admin-inspections") {
      // Admin came from the Inspections tab
      router.push("/admin#inspections");
      return;
    }

    if (from === "driver") {
      // Driver came from the Driver Portal history list
      router.push("/driver");
      return;
    }
  }

  // Fallback: just go back one step in history
  router.back();
};
  
  const id = (params as { id?: string }).id; 
  const [record, setRecord] = useState<InspectionRecord | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get inspection record
        const { data, error: err } = await supabase
          .from("inspections")
          .select("*")
          .eq("id", id)
          .single();

        if (err) throw err;
        const rec = data as InspectionRecord;
        setRecord(rec);

        // Get vehicle details, if we have a vehicle_id
        if (rec.vehicle_id) {
          const { data: vData, error: vErr } = await supabase
            .from("vehicles")
            .select("id,label,year,make,model,plate,vin")
            .eq("id", rec.vehicle_id)
            .single();

          if (!vErr && vData) {
            setVehicle(vData as Vehicle);
          }
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message ?? "Could not load inspection.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  if (!id) {
    return (
      <div className="space-y-4">
        <section className="card">
          <p className="text-sm text-slate-200">
            Missing inspection ID in the URL.
          </p>
        </section>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <section className="card">
          <p className="text-sm text-slate-200">Loading inspection…</p>
        </section>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="space-y-4">
        <section className="card space-y-2">
          <p className="text-sm text-red-300">
            {error ?? "Inspection not found."}
          </p>
          <button
            type="button"
            onClick={handleBack}
            className="btn-ghost no-print w-fit text-xs"
            >
            ← Go back
          </button>

        </section>
      </div>
    );
  }

  const answers = record.answers ?? {};
  const submitted = formatDateTime(
    record.submitted_at || record.inspection_date,
  );

  const vehicleLine = vehicle
    ? [
        vehicle.year ?? "",
        vehicle.make ?? "",
        vehicle.model ?? "",
      ]
        .map((p) => (p == null ? "" : String(p)))
        .join(" ")
        .trim() || vehicle.label
    : record.vehicle_label ?? "N/A";

  const vehicleLabel = vehicle?.label ?? record.vehicle_label ?? "N/A";
  const vehiclePlate = vehicle?.plate ?? "N/A";

  return (
    <div className="space-y-4">
      {/* Top controls for screen only */}
      <section className="card no-print flex items-center justify-between">
        <button
            type="button"
            onClick={handleBack}
            className="btn-ghost text-xs"
        >
            ← Back
        </button>
        <button
            type="button"
            onClick={() => window.print()}
            className="btn-primary text-xs"
        >
            Print / Save as PDF
        </button>
        </section>


      {/* Printable inspection form */}
      <section className="mx-auto max-w-3xl rounded-2xl bg-white p-4 text-slate-900 shadow-md print:rounded-none print:shadow-none">
        <header className="border-b border-slate-300 pb-2">
          <h1 className="text-lg font-semibold text-slate-900">
            Transafe Transportation – Daily 7D Inspection Record
          </h1>
          <p className="text-xs text-slate-700">
            Completed{" "}
            {record.inspection_type === "pre" ? "pre-trip" : "post-trip"}{" "}
            inspection.
          </p>
        </header>

        {/* Top meta info */}
        <div className="mt-3 grid gap-2 text-xs text-slate-900 sm:grid-cols-2">
          <div>
            <p>
              <span className="font-semibold">Driver name:</span>{" "}
              {record.driver_name}
            </p>
            <p>
              <span className="font-semibold">Driver license #:</span>{" "}
              {record.driver_license_number ?? "N/A"}
            </p>
            <p>
              <span className="font-semibold">Vehicle (year/make/model):</span>{" "}
              {vehicleLine}
            </p>
            <p>
              <span className="font-semibold">Vehicle label:</span>{" "}
              {vehicleLabel}
            </p>
            <p>
              <span className="font-semibold">Plate:</span> {vehiclePlate}
            </p>
          </div>
          <div>
            <p>
              <span className="font-semibold">Inspection type:</span>{" "}
              {record.inspection_type === "pre" ? "Pre-trip" : "Post-trip"}
            </p>
            <p>
              <span className="font-semibold">Odometer at inspection:</span>{" "}
              {record.odometer_reading ?? "N/A"}
            </p>
            <p>
              <span className="font-semibold">Shift:</span>{" "}
              {record.shift ?? "N/A"}
            </p>
            <p>
              <span className="font-semibold">Submitted at:</span> {submitted}
            </p>
            <p>
              <span className="font-semibold">Overall status:</span>{" "}
              {record.overall_status
                ? record.overall_status.toUpperCase()
                : "N/A"}
            </p>
          </div>
        </div>

        {/* Answers table */}
        <section className="mt-4 space-y-1">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-800">
            Checklist responses
          </h2>
          <table className="w-full border-collapse text-[11px] text-slate-900">
            <thead>
              <tr>
                <th className="border border-slate-400 bg-slate-100 px-2 py-1 text-left">
                  Item
                </th>
                <th className="border border-slate-400 bg-slate-100 px-2 py-1 text-left">
                  Response (Pass / Fail / N/A)
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(answers).map(([question, answer]) => (
                <tr key={question}>
                  <td className="border border-slate-400 px-2 py-1 align-top">
                    {question}
                  </td>
                  <td className="border border-slate-400 px-2 py-1 align-top font-semibold">
                    {(answer || "—").toUpperCase()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Notes & signature */}
        <section className="mt-4 grid gap-4 text-xs text-slate-900 sm:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-800">
              Notes / defects
            </h3>
            <div className="min-h-[60px] rounded border border-slate-400 px-2 py-1">
              {record.notes && record.notes.trim().length > 0
                ? record.notes
                : "None reported."}
            </div>
          </div>
          <div className="flex flex-col justify-end">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-800">
              Driver certification
            </h3>
            <p className="mb-4 text-[11px]">
              I certify that I have completed this inspection and reported all
              known defects accurately.
            </p>
            <div className="space-y-3">
              <div className="border-b border-slate-700 pb-1">
                <span className="text-[11px] font-semibold">
                  Signature (typed name): {record.signature_name}
                </span>
              </div>
              <div className="text-[11px]">
                Date / time submitted: {submitted}
              </div>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
