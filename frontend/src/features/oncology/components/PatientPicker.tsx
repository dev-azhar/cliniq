import { Search } from "lucide-react";
import { Card, Tag, Empty } from "../../../components/ui";

export default function PatientPicker({
  patients,
  selectedId,
  onSelect,
  search,
  onSearch,
  loading,
}: {
  patients: any[];
  selectedId: string | null;
  onSelect: (patientId: string) => void;
  search: string;
  onSearch: (value: string) => void;
  loading: boolean;
}) {
  const filtered = patients.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      p.mrn?.toLowerCase().includes(q) ||
      p.cancer_types?.some((c: string) => c.toLowerCase().includes(q))
    );
  });

  return (
    <Card className="!p-3 lg:sticky lg:top-4 lg:self-start">
      <div className="mb-3 flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--panel2)", border: "1px solid var(--glass-border)" }}>
        <Search size={14} style={{ color: "var(--muted)" }} />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search name, MRN, cancer type..."
          className="w-full bg-transparent text-[13px] outline-none"
          style={{ color: "var(--ink)" }}
        />
      </div>

      {loading ? (
        <div className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>Loading patients...</div>
      ) : filtered.length === 0 ? (
        <Empty>No oncology patients match this search.</Empty>
      ) : (
        <div className="space-y-1.5 max-h-[70vh] overflow-auto pr-1">
          {filtered.map((p) => (
            <button
              key={p.patient_id}
              onClick={() => onSelect(p.patient_id)}
              className="w-full rounded-xl px-3 py-2.5 text-left transition"
              style={{
                background: selectedId === p.patient_id ? "linear-gradient(90deg, rgba(0,120,212,.18), rgba(0,69,120,.18))" : "var(--panel)",
                border: `1px solid ${selectedId === p.patient_id ? "var(--line2)" : "var(--glass-border)"}`,
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[13.5px]" style={{ color: "var(--ink)" }}>{p.name}</span>
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>{p.age ? `${p.age}y` : ""} {p.gender?.[0]}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {(p.cancer_types || []).map((c: string) => (
                  <Tag key={c} tone="violet">{c}</Tag>
                ))}
              </div>
              <div className="mt-1 text-[11px]" style={{ color: "var(--dim)" }}>{p.mrn}</div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
