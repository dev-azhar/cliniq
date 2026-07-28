import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stethoscope, CheckCircle2, Clock, CreditCard, PackageCheck, AlertCircle } from "lucide-react";
import { Card, Tag } from "../../../components/ui";
import { api } from "../../../lib/api";
import TestPaymentModal, { type TestPaymentResult } from "../../../components/TestPaymentModal";

interface PrescriptionSlipProps {
  encounterId: string;
  prescription?: any;
  title?: string;
  patientId: string;
  refetchEnc?: () => void;
  refetchP360?: () => void;
}

export default function PrescriptionSlip({ 
  encounterId, 
  prescription,
  title,
  patientId,
  refetchEnc,
  refetchP360,
}: PrescriptionSlipProps) {
  const qc = useQueryClient();
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  if (!prescription || !prescription.items || prescription.items.length === 0) {
    return (
      <Card className="space-y-3 animate-in fade-in duration-300" style={{ border: "1px solid var(--line2)" }}>
        <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: "#123a7a" }}>
          <Stethoscope size={16} className="text-[var(--cyan)]" /> {title || "E-Prescription Slip"}
        </h4>
        <div className="text-xs italic text-[var(--dim)]">No active prescriptions recorded for this visit.</div>
      </Card>
    );
  }

  // Calculate pricing breakdown
  const items = prescription.items || [];
  const subtotal = items.reduce((acc: number, item: any) => {
    const qty = item.quantity || 1;
    const price = item.unit_price || 10.0;
    return acc + (qty * price);
  }, 0);
  const gst = subtotal * 0.18;
  const total = subtotal + gst;



  const handlePaymentSuccess = async (payment: TestPaymentResult) => {
    try {
      await api.verifyRazorpayPrescriptionPayment({
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_signature: payment.razorpay_signature,
        rx_id: prescription.rx_id,
      });

      qc.invalidateQueries({ queryKey: ["portal-encounter"] });
      qc.invalidateQueries({ queryKey: ["portal-encounter-parent"] });
      qc.invalidateQueries({ queryKey: ["portal-episode-invoice"] });
      qc.invalidateQueries({ queryKey: ["p360"] });
      if (refetchEnc) refetchEnc();
      if (refetchP360) refetchP360();

      setPaymentDone(true);
      setTimeout(() => {
        setPaymentDone(false);
        setShowPayModal(false);
      }, 1500);
    } catch (err: any) {
      alert(err.message || "Failed to verify payment");
    }
  };

  const getStatusTone = (status: string) => {
    switch (status) {
      case "DISPENSED": return "green";
      case "PREPAID": return "blue";
      case "EXPIRED": return "red";
      default: return "amber";
    }
  };

  const pickupToken = prescription.pickup_token;
  const displayStatus = prescription.status === "DISPENSED" ? "DISPENSED / COLLECTED" : (pickupToken?.status === "READY" ? "READY FOR PICKUP" : prescription.status);

  return (
    <Card className="space-y-4 animate-in fade-in duration-300" style={{ border: "1px solid var(--line2)" }}>
      <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
        <h4 className="font-bold text-sm flex items-center gap-2" style={{ color: "#123a7a" }}>
          <Stethoscope size={16} className="text-[var(--cyan)]" /> {title || "E-Prescription Slip"}
        </h4>
        <Tag tone={pickupToken?.status === "READY" ? "green" : getStatusTone(prescription.status)}>{displayStatus}</Tag>
      </div>

      {pickupToken?.status === "READY" && (
        <div className="space-y-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] p-4">
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-5 text-center">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-300">
              Pharmacy Pickup Token
            </div>
            <div className="mt-1 text-5xl font-black font-mono tracking-[0.16em] text-white drop-shadow-[0_0_16px_rgba(52,211,153,0.65)] sm:text-6xl">
              {pickupToken.number}
            </div>
            <div className="mt-1 text-[10px] font-semibold text-emerald-300">Medicines packed — show this token at pickup</div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl border border-emerald-500/10 bg-slate-950/40 p-3 text-[11px] font-medium">
            <div>
              <span className="block text-[9px] uppercase tracking-wider text-[var(--dim)]">Pickup Counter</span>
              <span className="font-bold text-slate-100">{pickupToken.room || "Pharmacy Counter 3"}</span>
            </div>
            <div>
              <span className="block text-[9px] uppercase tracking-wider text-[var(--dim)]">Floor Location</span>
              <span className="font-bold text-slate-100">{pickupToken.floor || "Ground Floor"}</span>
            </div>
          </div>
        </div>
      )}

      <div 
        className="relative space-y-3 overflow-hidden rounded-xl border p-4"
        style={{ borderColor: "var(--line2)", background: "rgba(37,100,207,0.025)" }}
      >
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-mint/5 rounded-full blur-2xl" />

        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--line)" }}>
          <div>
            <div className="text-[11px] text-[var(--dim)] uppercase font-semibold">PRESCRIPTION ID</div>
            <div className="break-all text-xs font-bold text-[var(--ink)]">{prescription.rx_id}</div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[var(--line)] bg-white/40">
          <table className="min-w-[560px] w-full text-xs text-left">
            <thead>
              <tr style={{ color: "var(--muted)" }} className="border-b border-[var(--line2)] bg-[rgba(37,100,207,0.06)]">
                <th className="border-r border-[var(--line)] px-3 py-2">Medicine Name</th>
                <th className="border-r border-[var(--line)] px-3 py-2">Dosage</th>
                <th className="border-r border-[var(--line)] px-3 py-2">Frequency</th>
                <th className="border-r border-[var(--line)] px-3 py-2">Duration</th>
                <th className="px-3 py-2 text-right">Qty</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item: any, i: number) => {
                return (
                  <tr key={i} className="border-b border-[var(--line)] last:border-0">
                    <td className="border-r border-[var(--line)] px-3 py-2.5 font-bold text-[var(--ink)]">{item.drug_name}</td>
                    <td className="border-r border-[var(--line)] px-3 py-2.5" style={{ color: "var(--ink)" }}>{item.dose || "Not recorded"}</td>
                    <td className="border-r border-[var(--line)] px-3 py-2.5" style={{ color: "var(--muted)" }}>{item.frequency || "Not recorded"}</td>
                    <td className="border-r border-[var(--line)] px-3 py-2.5 font-medium" style={{ color: "var(--ink)" }}>{item.duration_days != null ? `${item.duration_days} days` : "Not recorded"}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-[var(--cyan)]">{item.quantity || 1}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action and Tracking banners */}
      {prescription.status === "APPROVED" && (
        <div className="pt-2 flex justify-end">
          <button
            onClick={() => setShowPayModal(true)}
            className="btn font-bold text-xs px-6 py-2.5 flex items-center gap-1.5"
            style={{ background: "linear-gradient(135deg, var(--cyan), #14213d)", color: "white", border: "none" }}
          >
            <CreditCard size={14} /> ⚡ Pay &amp; Collect Online
          </button>
        </div>
      )}

      {prescription.status === "PREPAID" && pickupToken && pickupToken.status !== "READY" && (
        <div className="mt-3 p-3.5 rounded-xl border space-y-3" style={{
          background: pickupToken.status === "READY" ? "rgba(16,185,129,0.06)" : "rgba(37,100,207,0.06)",
          borderColor: pickupToken.status === "READY" ? "rgba(16,185,129,0.2)" : "rgba(37,100,207,0.2)"
        }}>
          {pickupToken.status === "WAITING" && (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-blue-800">
                <Clock size={16} className="shrink-0 mt-0.5 animate-pulse text-[var(--cyan)]" />
                <div>
                  <strong className="mb-0.5 block text-[var(--ink)]">⏳ Packaging in Progress</strong>
                  The pharmacy is currently packing your medicines. Please wait at the pickup point.
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--line2)] bg-white/60 p-2.5 text-[11px] font-medium">
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-[var(--muted)]">Pickup Counter</span>
                  <span className="font-bold text-[var(--ink)]">{pickupToken.room || "Pharmacy Counter 3"}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-[var(--muted)]">Floor Location</span>
                  <span className="font-bold text-[var(--ink)]">{pickupToken.floor || "Ground Floor"}</span>
                </div>
                <div className="col-span-2 flex items-center justify-between border-t border-[var(--line)] pt-2">
                  <span className="text-[9px] uppercase tracking-wider text-[var(--muted)]">Your Pickup Token</span>
                  <span className="font-mono text-sm font-black tracking-wider text-[var(--cyan)]">{pickupToken.number}</span>
                </div>
              </div>
            </div>
          )}

          {pickupToken.status === "READY" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-4 text-center">
                <div className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-300">
                  Pharmacy Pickup Token
                </div>
                <div className="mt-1 text-5xl font-black font-mono tracking-[0.16em] text-white drop-shadow-[0_0_16px_rgba(52,211,153,0.65)] sm:text-6xl">
                  {pickupToken.number}
                </div>
                <div className="mt-1 text-[10px] font-semibold text-emerald-300">Show this token at the counter</div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-emerald-300">
                <PackageCheck size={18} className="shrink-0 text-emerald-400" />
                <div>
                  <strong className="text-white block mb-0.5">🎉 Medicines Packed &amp; Ready!</strong>
                  Please walk to the pharmacy pickup point to collect your packed bag.
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 bg-slate-950/40 p-2.5 rounded-xl text-[11px] font-medium border border-emerald-500/10">
                <div>
                  <span className="text-[var(--dim)] block text-[9px] uppercase tracking-wider">Pickup Counter</span>
                  <span className="text-slate-100 font-bold">{pickupToken.room || "Pharmacy Counter 3"}</span>
                </div>
                <div>
                  <span className="text-[var(--dim)] block text-[9px] uppercase tracking-wider">Floor Location</span>
                  <span className="text-slate-100 font-bold">{pickupToken.floor || "Ground Floor"}</span>
                </div>
              </div>
            </div>
          )}

          {pickupToken.status === "COMPLETED" && (
            <div className="flex items-center gap-2 text-xs text-[var(--mint)]">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Prescription medicines successfully collected by patient.</span>
            </div>
          )}
        </div>
      )}

      {/* Online Payment Modal */}
      <TestPaymentModal
        open={showPayModal}
        orderId={`rx_${prescription.rx_id}`}
        amountPaise={Math.round(total * 100)}
        title="Medication Payment"
        description={`Prescription: ${prescription.rx_id.slice(0, 8)}...`}
        onSuccess={handlePaymentSuccess}
        onCancel={() => setShowPayModal(false)}
      />
    </Card>
  );
}
