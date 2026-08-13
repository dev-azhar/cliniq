import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Pill, Search, Clipboard, User, Calendar, CheckCircle2, 
  AlertTriangle, RefreshCw, ShieldAlert, BadgeInfo, Clock, PackageCheck, ShoppingBag 
} from "lucide-react";
import { api } from "../../lib/api";
import { Card, Tag, Empty } from "../../components/ui";

export default function PharmacyWorkspace() {
  const qc = useQueryClient();
  const [searchVal, setSearchVal] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [activeRxId, setActiveRxId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"lookup" | "prepaid">("lookup");
  const [activePrepaidRxId, setActivePrepaidRxId] = useState<string | null>(null);

  // Queries
  const { data: searchResults = [], isLoading: isLookupLoading } = useQuery({
    queryKey: ["pharmacy-lookup", submittedSearch],
    queryFn: () => api.pharmacyLookup(submittedSearch.trim()),
    enabled: !!submittedSearch.trim(),
  });

  const { data: stockItems = [], isLoading: isStockLoading, refetch: refetchStock } = useQuery({
    queryKey: ["pharmacy-stock-list"],
    queryFn: () => api.stock(),
    refetchInterval: 10000, // Auto-refresh stock list every 10 seconds
  });

  const { data: prepaidOrders = [], isLoading: isPrepaidLoading } = useQuery({
    queryKey: ["pharmacy-prepaid-orders"],
    queryFn: () => api.prepaidPrescriptions(),
    refetchInterval: 5000, // Live poll every 5 seconds for new online orders
  });

  // Mutations
  const dispenseMutation = useMutation({
    mutationFn: (rxId: string) => api.dispensePrescription(rxId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pharmacy-lookup"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-stock-list"] });
      qc.invalidateQueries({ queryKey: ["p360"] });
      alert("Prescription marked as DISPENSED successfully. Stock quantities have been updated.");
    },
    onError: (err: any) => {
      console.error(err);
      alert(err?.message || "Failed to dispense prescription.");
    }
  });

  const readyMutation = useMutation({
    mutationFn: (rxId: string) => api.readyPrescription(rxId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pharmacy-prepaid-orders"] });
      alert("Medications marked as PACKED and ready for pickup at Counter 3.");
    },
    onError: (err: any) => {
      console.error(err);
      alert(err?.message || "Failed to mark prescription as ready.");
    }
  });

  const pickupMutation = useMutation({
    mutationFn: (rxId: string) => api.pickupPrescription(rxId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pharmacy-prepaid-orders"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-stock-list"] });
      qc.invalidateQueries({ queryKey: ["p360"] });
      alert("Order marked as PICKED UP. Stock quantities updated and transaction closed.");
    },
    onError: (err: any) => {
      console.error(err);
      alert(err?.message || "Failed to mark prescription as picked up.");
    }
  });

  const releaseMutation = useMutation({
    mutationFn: () => api.releaseExpiredReservations(),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["pharmacy-stock-list"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-lookup"] });
      alert(`Auto-release complete! Released ${data.released_count} expired reservation(s) back to available stock.`);
    },
    onError: (err: any) => {
      console.error(err);
      alert(err?.message || "Failed to trigger release.");
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchVal.trim()) return;
    setSubmittedSearch(searchVal.trim());
    setActiveRxId(null);
  };

  const handleDispense = (rxId: string) => {
    if (confirm("Confirm medication packaging. Mark this prescription as fully DISPENSED?")) {
      dispenseMutation.mutate(rxId);
    }
  };

  const activeRx = searchResults.find((rx: any) => rx.rx_id === activeRxId) || searchResults[0];
  const activePrepaid = prepaidOrders.find((rx: any) => rx.rx_id === activePrepaidRxId) || prepaidOrders[0];

  return (
    <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_clamp(320px,25vw,430px)] 2xl:gap-7 animate-in fade-in duration-300">
      
      {/* Left Column: Patient Search and Prescription view */}
      <div className="space-y-4">
        
        {/* Mode Tabs */}
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab("lookup")}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold transition"
            style={{
              color: activeTab === "lookup" ? "#004578" : "var(--muted)",
              background: activeTab === "lookup" ? "linear-gradient(90deg, rgba(0,120,212,.1), rgba(0,69,120,.1))" : "var(--panel)",
              border: `1px solid ${activeTab === "lookup" ? "var(--line2)" : "var(--glass-border)"}`,
            }}
          >
            <Search size={14} /> Walk-in Lookup
          </button>
          <button 
            onClick={() => setActiveTab("prepaid")}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-semibold transition relative"
            style={{
              color: activeTab === "prepaid" ? "#004578" : "var(--muted)",
              background: activeTab === "prepaid" ? "linear-gradient(90deg, rgba(0,120,212,.1), rgba(0,69,120,.1))" : "var(--panel)",
              border: `1px solid ${activeTab === "prepaid" ? "var(--line2)" : "var(--glass-border)"}`,
            }}
          >
            <ShoppingBag size={14} /> Online Prepaid Orders
            {prepaidOrders.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-rose-500 text-white animate-pulse">
                {prepaidOrders.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === "lookup" ? (
          <>
            {/* Lookup Card */}
            <Card className="space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Search className="text-[var(--cyan)]" size={18} />
                  Patient &amp; Prescription Lookup
                </h3>
                <p className="text-[11px] text-[var(--dim)] mt-0.5">
                  Search by patient mobile number or queue token number to fetch active OPD prescriptions.
                </p>
              </div>

              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter Mobile (e.g. 6281116923) or Token (e.g. A-100)..."
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  className="input flex-1 px-3 py-2 text-xs"
                  style={{ background: "var(--panel)", borderColor: "var(--glass-border)", color: "var(--ink)" }}
                />
                <button
                  type="submit"
                  className="btn font-bold text-xs px-5 py-2 flex items-center gap-1.5"
                  style={{ background: "linear-gradient(135deg, var(--cyan), #004578)", color: "white", border: "none" }}
                >
                  <Search size={14} /> Search
                </button>
              </form>
            </Card>

            {/* Search Results & Prescription details */}
            {submittedSearch && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {isLookupLoading ? (
                  <Card className="text-center py-8 text-xs text-[var(--dim)]">
                    Searching EMR records...
                  </Card>
                ) : searchResults.length === 0 ? (
                  <Card>
                    <Empty>No active prescriptions found for "{submittedSearch}".</Empty>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-[200px_1fr]">
                    {/* List of matches */}
                    <div className="space-y-2">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--dim)] px-1">
                        Matching Visits
                      </div>
                      {searchResults.map((rx: any) => {
                        const isActive = rx.rx_id === (activeRx?.rx_id);
                        return (
                          <button
                            key={rx.rx_id}
                            onClick={() => setActiveRxId(rx.rx_id)}
                            className="w-full text-left p-3 rounded-xl border text-xs transition block hover:bg-white/5"
                            style={{
                              borderColor: isActive ? "var(--line2)" : "var(--glass-border)",
                              background: isActive ? "rgba(0,120,212,0.05)" : "rgba(255,255,255,0.02)"
                            }}
                          >
                            <div className="font-bold text-white mb-0.5">{rx.patient_name}</div>
                            <div className="text-[10px] text-[var(--dim)]">{rx.date} · {rx.department}</div>
                            <div className="mt-2">
                              <Tag tone={rx.status === "DISPENSED" ? "green" : rx.status === "EXPIRED" ? "red" : rx.status === "PREPAID" ? "blue" : "amber"}>
                                {rx.status}
                              </Tag>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selected Prescription details */}
                    {activeRx && (
                      <Card className="space-y-4 animate-in fade-in duration-200">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">Prescribed Details</div>
                            <h4 className="text-base font-extrabold text-white">{activeRx.patient_name}</h4>
                          </div>
                          <Tag tone={activeRx.status === "DISPENSED" ? "green" : activeRx.status === "EXPIRED" ? "red" : activeRx.status === "PREPAID" ? "blue" : "amber"}>
                            {activeRx.status}
                          </Tag>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 text-xs">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1 text-[var(--dim)]"><User size={13} /> Doctor</div>
                            <div className="font-bold text-slate-100">{activeRx.doctor_name} ({activeRx.department})</div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1 text-[var(--dim)]"><Calendar size={13} /> Consultation Date</div>
                            <div className="font-bold text-slate-100">{activeRx.date}</div>
                          </div>
                        </div>

                        <div className="border-t border-white/5 pt-3">
                          <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--dim)] mb-2">Prescribed Items</div>
                          <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.01]">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="border-b border-white/5 bg-white/5 text-[var(--dim)]">
                                  <th className="p-3">Medicine</th>
                                  <th className="p-3">Dosage</th>
                                  <th className="p-3">Frequency</th>
                                  <th className="p-3">Instructions</th>
                                  <th className="p-3 text-right">Qty</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 text-slate-300">
                                {activeRx.items.map((item: any, i: number) => (
                                  <tr key={i} className="hover:bg-white/5 transition-colors">
                                    <td className="p-3 font-bold text-white">{item.drug_name}</td>
                                    <td className="p-3">{item.dose || "—"}</td>
                                    <td className="p-3">{item.frequency || "As directed"}</td>
                                    <td className="p-3">{item.instructions || "—"}</td>
                                    <td className="p-3 text-right font-medium text-[var(--cyan)]">{item.quantity}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {activeRx.status === "APPROVED" && (
                          <div className="flex justify-end pt-2 border-t border-white/5">
                            <button
                              onClick={() => handleDispense(activeRx.rx_id)}
                              disabled={dispenseMutation.isPending}
                              className="btn font-bold text-xs px-6 py-2 flex items-center gap-1.5"
                              style={{ background: "linear-gradient(135deg, var(--mint), #059669)", color: "#011c10", border: "none" }}
                            >
                              <CheckCircle2 size={15} /> Confirm &amp; Dispense Medicines
                            </button>
                          </div>
                        )}
                      </Card>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Online Prepaid Orders Dashboard */
          <div className="space-y-4 animate-in fade-in duration-200">
            {isPrepaidLoading && prepaidOrders.length === 0 ? (
              <Card className="text-center py-12 text-xs text-[var(--dim)]">
                Syncing live online pre-orders...
              </Card>
            ) : prepaidOrders.length === 0 ? (
              <Card>
                <Empty>No active online prepaid orders received.</Empty>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                {/* Prepaid list */}
                <div className="space-y-2">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--dim)] px-1">
                    Prepaid Orders ({prepaidOrders.length})
                  </div>
                  {prepaidOrders.map((rx: any) => {
                    const isActive = rx.rx_id === (activePrepaid?.rx_id);
                    const tokenStatus = rx.pickup_token?.status || "WAITING";
                    return (
                      <button
                        key={rx.rx_id}
                        onClick={() => setActivePrepaidRxId(rx.rx_id)}
                        className="w-full text-left p-3 rounded-xl border text-xs transition block hover:bg-white/5"
                        style={{
                          borderColor: isActive ? "var(--line2)" : "var(--glass-border)",
                          background: isActive ? "rgba(0,120,212,0.05)" : "rgba(255,255,255,0.02)"
                        }}
                      >
                        <div className="flex justify-between items-start mb-0.5">
                          <span className="font-bold text-white truncate max-w-[120px]">{rx.patient_name}</span>
                          <span className="font-mono text-[10px] font-extrabold text-[var(--cyan)] bg-sky-600/10 px-1 rounded">
                            {rx.pickup_token?.number}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--dim)]">{rx.date} · {rx.department}</div>
                        <div className="mt-2">
                          <Tag tone={tokenStatus === "READY" ? "green" : "amber"}>
                            {tokenStatus === "READY" ? "Ready for Pickup" : "Packing"}
                          </Tag>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Prepaid order details */}
                {activePrepaid && (
                  <Card className="space-y-4 animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">Prepaid Order Details</div>
                        <h4 className="text-base font-extrabold text-white">{activePrepaid.patient_name}</h4>
                      </div>
                      <Tag tone={activePrepaid.pickup_token?.status === "READY" ? "green" : "amber"}>
                        {activePrepaid.pickup_token?.status === "READY" ? "READY FOR PICKUP" : "PACKING"}
                      </Tag>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 text-xs">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1 text-[var(--dim)]"><User size={13} /> Doctor</div>
                        <div className="font-bold text-slate-100">{activePrepaid.doctor_name} ({activePrepaid.department})</div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1 text-[var(--dim)]"><Calendar size={13} /> Prepaid Date</div>
                        <div className="font-bold text-slate-100">{activePrepaid.date}</div>
                      </div>
                    </div>

                    <div className="border-t border-white/5 pt-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--dim)] mb-2">Prescribed Items</div>
                      <div className="overflow-x-auto rounded-xl border border-white/5 bg-white/[0.01]">
                        <table className="w-full text-xs text-left">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/5 text-[var(--dim)]">
                              <th className="p-3">Medicine</th>
                              <th className="p-3">Dosage</th>
                              <th className="p-3">Frequency</th>
                              <th className="p-3">Instructions</th>
                              <th className="p-3 text-right">Price</th>
                              <th className="p-3 text-right">Qty</th>
                              <th className="p-3 text-right">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 text-slate-300">
                            {activePrepaid.items.map((item: any, i: number) => {
                              const qty = item.quantity || 1;
                              const price = item.unit_price || 10.0;
                              return (
                                <tr key={i} className="hover:bg-white/5 transition-colors">
                                  <td className="p-3 font-bold text-white">{item.drug_name}</td>
                                  <td className="p-3">{item.dose || "—"}</td>
                                  <td className="p-3">{item.frequency || "As directed"}</td>
                                  <td className="p-3">{item.instructions || "—"}</td>
                                  <td className="p-3 text-right">₹{price.toFixed(2)}</td>
                                  <td className="p-3 text-right font-medium text-[var(--cyan)]">{qty}</td>
                                  <td className="p-3 text-right">₹{(qty * price).toFixed(2)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-white/[0.01] p-3 border border-dashed border-white/5 rounded-xl text-xs">
                      <div>
                        <div className="text-[10px] text-[var(--dim)] uppercase font-semibold">PREPAID PICKUP TOKEN</div>
                        <span className="text-sm font-black text-white font-mono tracking-wider">
                          {activePrepaid.pickup_token?.number}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[var(--dim)] uppercase font-semibold block">Counter Pickup Location</span>
                        <span className="text-slate-200 font-bold">
                          {activePrepaid.pickup_token?.room} ({activePrepaid.pickup_token?.floor})
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                      {activePrepaid.pickup_token?.status === "WAITING" && (
                        <button
                          onClick={() => readyMutation.mutate(activePrepaid.rx_id)}
                          disabled={readyMutation.isPending}
                          className="btn font-bold text-xs px-6 py-2.5 flex items-center gap-1.5"
                          style={{ background: "linear-gradient(135deg, var(--cyan), #004578)", color: "white", border: "none" }}
                        >
                          <PackageCheck size={15} /> Pack &amp; Mark Ready for Pickup
                        </button>
                      )}
                      
                      {activePrepaid.pickup_token?.status === "READY" && (
                        <button
                          onClick={() => pickupMutation.mutate(activePrepaid.rx_id)}
                          disabled={pickupMutation.isPending}
                          className="btn font-bold text-xs px-6 py-2.5 flex items-center gap-1.5"
                          style={{ background: "linear-gradient(135deg, var(--mint), #059669)", color: "#011c10", border: "none" }}
                        >
                          <CheckCircle2 size={15} /> Confirm Picked Up by Patient
                        </button>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Inventory monitor & Administrative tools */}
      <div className="space-y-4">
        
        {/* Stock Monitor */}
        <Card className="space-y-3 flex flex-col max-h-[500px]">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Pill size={14} className="text-[var(--cyan)]" /> Live Stock Monitor
            </h3>
            <button 
              onClick={() => refetchStock()} 
              disabled={isStockLoading}
              className="text-[var(--dim)] hover:text-white transition"
              title="Refresh Stock"
            >
              <RefreshCw size={12} className={isStockLoading ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 pr-1 space-y-2.5">
            {isStockLoading && stockItems.length === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--dim)]">Syncing inventory...</div>
            ) : stockItems.length === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--dim)]">No stock items in catalog.</div>
            ) : (
              stockItems.map((item: any) => {
                const netAvailable = item.available;
                const totalAvailable = item.quantity_available || 0;
                const reserved = item.quantity_reserved || 0;
                const isLow = netAvailable < 10;
                
                return (
                  <div 
                    key={item.drug_name} 
                    className="p-2.5 rounded-xl border border-white/5 bg-white/[0.01] text-xs space-y-1.5 relative overflow-hidden"
                  >
                    {isLow && <div className="absolute top-0 right-0 w-1 h-full bg-amber-500" />}
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-white truncate max-w-[170px]" title={item.drug_name}>
                        {item.drug_name}
                      </span>
                      {isLow && (
                        <span className="text-[9px] bg-amber-500/10 text-amber-400 font-extrabold border border-amber-500/20 px-1.5 rounded-full flex items-center gap-0.5 shrink-0">
                          <AlertTriangle size={8} /> LOW STOCK
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center pt-1 border-t border-white/5">
                      <div className="bg-white/5 p-1 rounded">
                        <span className="text-[var(--dim)] block">Total</span>
                        <b className="text-white text-[11px]">{totalAvailable}</b>
                      </div>
                      <div className="bg-white/5 p-1 rounded">
                        <span className="text-[var(--dim)] block text-red-400">Reserved</span>
                        <b className="text-red-400 text-[11px]">{reserved}</b>
                      </div>
                      <div className="bg-white/5 p-1 rounded">
                        <span className="text-[var(--dim)] block text-[var(--cyan)]">Available</span>
                        <b className="text-[var(--cyan)] text-[11px]">{netAvailable}</b>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Expiry Cleanup Card */}
        <Card className="space-y-3" style={{ background: "radial-gradient(120px 40px at 0% 0%, rgba(239,68,68,0.03), transparent)" }}>
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <ShieldAlert size={14} className="text-rose-400" /> Administrative Actions
            </h3>
            <p className="text-[10px] text-[var(--dim)] mt-0.5">
              Simulate OPD administrative workflows.
            </p>
          </div>

          <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl text-[10.5px] text-[var(--dim)] flex gap-2 items-start">
            <BadgeInfo size={14} className="shrink-0 mt-0.5 text-[var(--cyan)]" />
            <div>
              Prescriptions approved but not collected within **24 hours** lock inventory. This tool releases them back to Available stock.
            </div>
          </div>

          <button
            onClick={() => releaseMutation.mutate()}
            disabled={releaseMutation.isPending}
            className="btn outline w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5"
            style={{ borderColor: "rgba(239,68,68,0.2)", color: "#b91c1c" }}
          >
            <RefreshCw size={13} className={releaseMutation.isPending ? "animate-spin" : ""} />
            Trigger 24h Expiry Release
          </button>
        </Card>
      </div>

    </div>
  );
}
