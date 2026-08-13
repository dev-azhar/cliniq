import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stethoscope, User, ShieldAlert, Users, MapPin, ArrowRight, Search } from "lucide-react";
import { api, ApiError } from "../../../lib/api";
import { Card, Tag, Empty } from "../../../components/ui";

interface DoctorQueueProps {
  onSelectPatient: (enc: any) => void;
}

export default function DoctorQueue({ onSelectPatient }: DoctorQueueProps) {
  const qc = useQueryClient();
  
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(() => {
    return localStorage.getItem("selected_doctor_id") || "";
  });
  const [queueTab, setQueueTab] = useState<"first" | "reconsult">("first");
  const [searchQuery, setSearchQuery] = useState("");
  const [doctorSearchQuery, setDoctorSearchQuery] = useState("");
  const [docAvailable, setDocAvailable] = useState<boolean>(true);

  const { data: doctors } = useQuery({
    queryKey: ["doctors"],
    queryFn: api.doctors,
  });

  const { data: queue, error: queueError } = useQuery({
    queryKey: ["doctor-queue", selectedDoctorId],
    queryFn: () => api.doctorEncounters(selectedDoctorId),
    enabled: !!selectedDoctorId,
    refetchInterval: 5000,
    retry: false,
  });

  const activeDoc = doctors?.find((d: any) => d.doctor_id === selectedDoctorId);
  const isUnlocked = Boolean(selectedDoctorId);

  // Initialize doctor availability local state
  useQuery({
    queryKey: ["active-doc-status", selectedDoctorId],
    queryFn: async () => {
      if (!selectedDoctorId) return null;
      const doc = doctors?.find((d: any) => d.doctor_id === selectedDoctorId);
      if (doc) {
        setDocAvailable(doc.available);
      }
      return doc;
    },
    enabled: !!doctors && !!selectedDoctorId,
  });

  const handleToggleAvailability = async () => {
    if (!selectedDoctorId) return;
    const nextVal = !docAvailable;
    setDocAvailable(nextVal);
    try {
      await api.updateDoctorAvailability(selectedDoctorId, nextVal);
      qc.invalidateQueries({ queryKey: ["doctors"] });
    } catch (err) {
      console.error(err);
      setDocAvailable(!nextVal); // Revert on failure
    }
  };

  const handleSelectDoctor = (id: string) => {
    setSelectedDoctorId(id);
    localStorage.setItem("selected_doctor_id", id);
  };

  const handleLogoutDoctor = () => {
    setSelectedDoctorId("");
    localStorage.removeItem("selected_doctor_id");
  };

  const renderQueueRow = (title: string, encounters: any[], emptyMessage: string) => (
    <section className="glass space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-extrabold text-slate-100">{title}</h4>
        <Tag tone={encounters.length ? "blue" : "gray"}>{encounters.length}</Tag>
      </div>

      {encounters.length === 0 ? (
        <Empty>{emptyMessage}</Empty>
      ) : (
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:pb-0 xl:grid-cols-3 2xl:grid-cols-4">
          {encounters.map((enc: any) => {
            const isRedFlag = enc.triage?.red_flag;

            return (
              <Card
                key={enc.encounter_id}
                className={`hover-border relative flex w-[82vw] max-w-[320px] shrink-0 snap-start flex-col justify-between overflow-hidden transition sm:w-auto sm:max-w-none sm:min-w-0 sm:snap-none ${
                  isRedFlag ? "border-red-500/30" : ""
                }`}
                style={{ border: isRedFlag ? "1px solid rgba(239, 68, 68, 0.4)" : "" }}
              >
                {isRedFlag && <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />}

                <div className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--dim)]">
                      Token: <b className="text-white text-base">{enc.token?.number || "—"}</b>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {enc.triage?.acuity ? (
                        <Tag tone={["1", "2"].includes(String(enc.triage.acuity)) ? "red" : ["3"].includes(String(enc.triage.acuity)) ? "amber" : "green"}>
                          ESI-{enc.triage.acuity}
                        </Tag>
                      ) : (
                        <Tag tone="amber">Awaiting Triage</Tag>
                      )}
                      {isRedFlag && <Tag tone="red">RED FLAG</Tag>}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-base font-extrabold text-slate-100">{enc.patient?.name}</h4>
                    <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                      {enc.patient?.age} yrs · {enc.patient?.gender} · {enc.patient?.mobile}
                    </p>
                  </div>

                  <div className="holo p-2 text-[12px] whitespace-pre-line text-slate-300">
                    <b>Chief Complaint:</b><br />
                    {enc.triage?.chief_complaint || "Routine consultation."}
                  </div>

                  {enc.token?.room && (
                    <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--dim)]">
                      <MapPin size={12} className="text-[var(--cyan)]" />
                      <span>{enc.token.room} ({enc.token.floor})</span>
                      {enc.token.eta_minutes != null && <span className="ml-auto">Est: ~{enc.token.eta_minutes}m</span>}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onSelectPatient({ ...enc, _doctorName: activeDoc?.name || null })}
                  className={`btn mt-4 w-full flex items-center justify-center gap-1.5 ${isRedFlag ? "r" : ""}`}
                >
                  Consult Patient <ArrowRight size={14} />
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );

  const renderSessionToolbar = () => {
    if (!activeDoc || !isUnlocked) return null;
    return (
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-3 !py-2.5 !px-4 relative overflow-hidden animate-in fade-in duration-200" style={{ background: "radial-gradient(150px 50px at 0% 0%, rgba(0,120,212,0.04), transparent)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[var(--cyan)]/10 border border-[var(--cyan)]/25 flex items-center justify-center text-[var(--cyan)] font-extrabold text-[12px]">
            {activeDoc.name.split(" ").slice(-1)[0][0]}
          </div>
          <div>
            <span className="text-[13px] font-extrabold text-slate-100">{activeDoc.name}</span>
            <span className="text-[11px] text-[var(--muted)] ml-2">{activeDoc.specialty} · {activeDoc.room} ({activeDoc.floor})</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleAvailability}
            className={`btn text-[11px] !py-1 !px-2.5 font-bold inline-flex items-center gap-1.5 transition ${
              docAvailable
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${docAvailable ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
            {docAvailable ? "ONLINE / ACTIVE" : "OFF DUTY / AWAY"}
          </button>
          <button
            onClick={handleLogoutDoctor}
            className="btn ghost text-[11px] !py-1 !px-2.5 font-bold text-red-400 hover:text-red-300 inline-flex items-center gap-1"
          >
            🔒 Lock Session
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {queueError && (queueError as any).status === 404 ? (
        <Card className="text-center py-10 space-y-4 max-w-md mx-auto">
          <ShieldAlert size={48} className="mx-auto text-amber-500 mb-3" />
          <h3 className="font-bold text-base text-amber-400">Doctor Profile Not Found</h3>
          <p className="text-xs max-w-sm mx-auto mt-1 text-[var(--muted)]">
            Your session has expired or the database was recently re-seeded/reset.
          </p>
          <button
            onClick={() => {
              localStorage.removeItem("selected_doctor_id");
              setSelectedDoctorId("");
            }}
            className="btn mx-auto font-bold"
            style={{ background: "linear-gradient(135deg, var(--cyan), #004578)", color: "white", border: "none" }}
          >
            Reset Session &amp; Login
          </button>
        </Card>
      ) : !isUnlocked ? (
        <div className="space-y-4">
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="grad-text text-xl font-extrabold flex items-center gap-2">
                <Stethoscope size={22} className="text-[var(--cyan)]" /> Doctor Portal Login
              </h2>
              <p className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>
                Search and select your clinical profile to view your active patient queue and consultation schedules.
              </p>
            </div>
            
            <div className="relative">
              <Search size={16} className="absolute left-3 top-3 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Search by name, specialty, room, or floor…"
                value={doctorSearchQuery}
                onChange={(e) => setDoctorSearchQuery(e.target.value)}
                className="input !pl-9 w-full"
                style={{ background: "var(--panel)", borderColor: "var(--glass-border)" }}
              />
            </div>

            {(() => {
              const searchLower = doctorSearchQuery.toLowerCase();
              const filteredDocs = doctors?.filter((doc: any) => {
                const matchName = doc.name?.toLowerCase().includes(searchLower);
                const matchSpecialty = doc.specialty?.toLowerCase().includes(searchLower);
                const matchRoom = doc.room?.toLowerCase().includes(searchLower);
                const matchFloor = doc.floor?.toLowerCase().includes(searchLower);
                return matchName || matchSpecialty || matchRoom || matchFloor;
              }) || [];

              if (doctors && doctors.length > 0 && filteredDocs.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p style={{ color: "var(--muted)" }} className="text-sm">
                      No doctors match "{doctorSearchQuery}"
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 max-h-96 overflow-y-auto">
                  {filteredDocs.map((doc: any) => (
                    <button
                      key={doc.doctor_id}
                      onClick={() => handleSelectDoctor(doc.doctor_id)}
                      className="card hover-border cursor-pointer transition h-full flex flex-col justify-between text-left p-4 rounded-lg"
                      style={{ background: "var(--panel)", border: "1px solid var(--glass-border)" }}
                    >
                      <div className="space-y-2">
                        <h4 className="text-base font-extrabold text-slate-100">{doc.name}</h4>
                        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                          {doc.specialty} · {doc.room} ({doc.floor})
                        </p>
                        {doc.experience_years && (
                          <p className="text-[11px]" style={{ color: "var(--dim)" }}>
                            {doc.experience_years} yrs experience
                          </p>
                        )}
                      </div>
                      <div className="text-[var(--cyan)] text-sm font-bold mt-2">
                        Select →
                      </div>
                    </button>
                  ))}
                </div>
              );
            })()}
          </Card>
        </div>
      ) : (
        renderSessionToolbar()
      )}

      {/* Patient Queue */}
      {selectedDoctorId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="grad-text-page text-lg font-extrabold flex items-center gap-2">
              <Users size={18} /> Active Patient Queue
            </h3>
            <span className="live">LIVE REFRESH</span>
          </div>

          {/* Search & Filter Bar */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-2.5 text-[var(--muted)]" />
                <input
                  type="text"
                  placeholder="Search by patient name, token, or chief complaint…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input !pl-9 w-full"
                  style={{ background: "var(--panel)", borderColor: "var(--glass-border)" }}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setQueueTab("first")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    queueTab === "first" ? "bg-white/10 text-white" : "text-[var(--muted)] hover:text-white border border-transparent hover:border-white/10"
                  }`}
                >
                  First Consult ({queue?.filter((e: any) => !e.is_reconsult).length || 0})
                </button>
                <button
                  onClick={() => setQueueTab("reconsult")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                    queueTab === "reconsult" ? "bg-white/10 text-white" : "text-[var(--muted)] hover:text-white border border-transparent hover:border-white/10"
                  }`}
                >
                  Report Review ({queue?.filter((e: any) => e.is_reconsult).length || 0})
                  {queue?.some((e: any) => e.is_reconsult) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan)] animate-pulse" />
                  )}
                </button>
              </div>
            </div>

            {(() => {
              const tabFiltered = queue?.filter((enc: any) =>
                queueTab === "reconsult" ? enc.is_reconsult : !enc.is_reconsult
              ) || [];
              
              const searchLower = searchQuery.toLowerCase();
              const filteredQueue = tabFiltered.filter((enc: any) => {
                const matchName = enc.patient?.name?.toLowerCase().includes(searchLower);
                const matchToken = enc.token?.number?.toLowerCase().includes(searchLower);
                const matchChief = enc.triage?.chief_complaint?.toLowerCase().includes(searchLower);
                const matchMobile = enc.patient?.mobile?.includes(searchQuery);
                return matchName || matchToken || matchChief || matchMobile;
              });

              if (filteredQueue.length === 0) {
                return (
                  <Empty>
                    {searchQuery 
                      ? `No patients match "${searchQuery}"`
                      : queueTab === "reconsult"
                      ? "No patients waiting for report review."
                      : "No patients waiting in your queue."}
                  </Empty>
                );
              }

              return (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {filteredQueue.map((enc: any) => {
                    const acuity = enc.triage?.acuity || "4";
                    const isRedFlag = enc.triage?.red_flag;

                    return (
                      <Card
                        key={enc.encounter_id}
                        className={`hover-border relative overflow-hidden flex flex-col justify-between h-full transition ${
                          isRedFlag ? "border-red-500/30" : ""
                        }`}
                        style={{ border: isRedFlag ? "1px solid rgba(239, 68, 68, 0.4)" : "" }}
                      >
                        {isRedFlag && <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />}

                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--dim)]">
                              Token: <b className="text-white text-base">{enc.token?.number || "—"}</b>
                            </span>
                            <div className="flex gap-1">
                              {enc.triage?.acuity && (
                                <Tag tone={["1", "2"].includes(String(enc.triage.acuity)) ? "red" : ["3"].includes(String(enc.triage.acuity)) ? "amber" : "green"}>
                                  ESI-{enc.triage.acuity}
                                </Tag>
                              )}
                              {isRedFlag && (
                                <Tag tone="red">RED FLAG</Tag>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-base font-extrabold text-slate-100">{enc.patient?.name}</h4>
                            <p className="text-[12px]" style={{ color: "var(--muted)" }}>
                              {enc.patient?.age} yrs · {enc.patient?.gender} · {enc.patient?.mobile}
                            </p>
                          </div>

                          <div className="holo p-2 text-[12px] whitespace-pre-line text-slate-300">
                            <b>Chief Complaint:</b><br />
                            {enc.triage?.chief_complaint || "Routine consultation."}
                          </div>

                          {enc.token?.room && (
                            <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--dim)]">
                              <MapPin size={12} className="text-[var(--cyan)]" />
                              <span>{enc.token.room} ({enc.token.floor})</span>
                              {enc.token.eta_minutes != null && <span className="ml-auto">Est: ~{enc.token.eta_minutes}m</span>}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => onSelectPatient({ ...enc, _doctorName: activeDoc?.name || null })}
                          className={`btn mt-4 w-full flex items-center justify-center gap-1.5 ${isRedFlag ? "r" : ""}`}
                        >
                          Consult Patient <ArrowRight size={14} />
                        </button>
                      </Card>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
