import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, CreditCard, Lock, ShieldCheck, X } from "lucide-react";

export interface TestPaymentResult {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface TestPaymentModalProps {
  open: boolean;
  orderId: string;
  amountPaise: number;
  currency?: string;
  title: string;
  description: string;
  onSuccess: (payment: TestPaymentResult) => void;
  onCancel: () => void;
}

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/**
 * Self-contained, offline test/sandbox payment modal used whenever the backend
 * signals a mock/test order (no live gateway network dependency at all). Mimics
 * a real hosted-checkout experience (card entry → processing → success) so
 * testing the payment flows always works, independent of external connectivity.
 */
export default function TestPaymentModal({
  open,
  orderId,
  amountPaise,
  currency = "INR",
  title,
  description,
  onSuccess,
  onCancel,
}: TestPaymentModalProps) {
  const [cardNumber, setCardNumber] = useState("4111 1111 1111 1111");
  const [expiry, setExpiry] = useState("12/29");
  const [cvv, setCvv] = useState("123");
  const [name, setName] = useState("Test Cardholder");
  const [phase, setPhase] = useState<"form" | "processing" | "success">("form");
  const [error, setError] = useState("");

  if (!open) return null;

  const amount = (amountPaise / 100).toLocaleString("en-IN", { style: "currency", currency });

  function reset() {
    setPhase("form");
    setError("");
  }

  function handleClose() {
    if (phase === "processing") return;
    reset();
    onCancel();
  }

  function handlePay() {
    setError("");
    const digits = cardNumber.replace(/\s/g, "");
    if (digits.length < 12) {
      setError("Enter a valid test card number.");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      setError("Enter a valid expiry (MM/YY).");
      return;
    }
    if (cvv.length < 3) {
      setError("Enter a valid CVV.");
      return;
    }
    setPhase("processing");
    window.setTimeout(() => {
      setPhase("success");
      window.setTimeout(() => {
        onSuccess({
          razorpay_payment_id: `pay_mock_${Math.random().toString(36).substring(2, 11)}`,
          razorpay_order_id: orderId,
          razorpay_signature: `mock_signature_${Math.random().toString(36).substring(2, 11)}`,
        });
        reset();
      }, 700);
    }, 1100);
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: "rgba(8,15,30,0.55)", backdropFilter: "blur(3px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div
          className="w-full max-w-[380px] overflow-hidden rounded-2xl bg-white shadow-2xl"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center justify-between px-5 py-4"
            style={{ background: "linear-gradient(135deg,var(--cyan),var(--violet))" }}
          >
            <div className="flex items-center gap-2 text-white">
              <ShieldCheck size={18} />
              <span className="text-sm font-bold">ClinIQ Test Checkout</span>
            </div>
            {phase !== "processing" && (
              <button onClick={handleClose} className="text-white/80 hover:text-white" aria-label="Close">
                <X size={18} />
              </button>
            )}
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--dim)]">{title}</div>
                <div className="text-xs text-[var(--muted)]">{description}</div>
              </div>
              <div className="text-lg font-extrabold text-[var(--ink)]">{amount}</div>
            </div>

            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800">
              TEST MODE — no real money is charged. Any card details work.
            </div>

            <AnimatePresence mode="wait">
              {phase === "form" && (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3"
                >
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--dim)]">
                      Card number
                    </span>
                    <div className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 focus-within:border-[var(--cyan)]">
                      <CreditCard size={16} className="text-[var(--cyan)]" />
                      <input
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        placeholder="4111 1111 1111 1111"
                        className="w-full bg-transparent text-sm font-semibold text-[var(--ink)] outline-none"
                        inputMode="numeric"
                      />
                    </div>
                  </label>
                  <div className="flex gap-3">
                    <label className="block flex-1">
                      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--dim)]">
                        Expiry
                      </span>
                      <input
                        value={expiry}
                        onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                        placeholder="MM/YY"
                        className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--cyan)]"
                        inputMode="numeric"
                      />
                    </label>
                    <label className="block flex-1">
                      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--dim)]">
                        CVV
                      </span>
                      <input
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                        placeholder="123"
                        className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--cyan)]"
                        inputMode="numeric"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-[var(--dim)]">
                      Cardholder name
                    </span>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Name on card"
                      className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--cyan)]"
                    />
                  </label>

                  {error && <div className="text-xs font-semibold text-rose-700">{error}</div>}

                  <button
                    onClick={handlePay}
                    className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow"
                    style={{ background: "linear-gradient(135deg,var(--cyan),var(--violet))" }}
                  >
                    <Lock size={14} /> Pay {amount}
                  </button>
                </motion.div>
              )}

              {phase === "processing" && (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-3 py-8"
                >
                  <motion.div
                    className="h-10 w-10 rounded-full border-4 border-[var(--line2)]"
                    style={{ borderTopColor: "var(--cyan)" }}
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  />
                  <div className="text-sm font-semibold text-[var(--muted)]">Processing test payment…</div>
                </motion.div>
              )}

              {phase === "success" && (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-2 py-8"
                >
                  <CheckCircle2 size={44} className="text-emerald-600" />
                  <div className="text-sm font-bold text-[var(--ink)]">Payment successful</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
