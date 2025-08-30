"use client";
import { useEffect, useMemo, useState } from "react";
import { useCurrency } from "../../currency/CurrencyContext";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useToast } from "../../ui/ToastContext";
import { postJSON } from "../../lib/api";

// No-Stripe version (used when payments are disabled)
function InnerBookingFormNoStripe({ venueId, basePrice, capacity = 100, bookedDates = [] }: { venueId: string; basePrice: number; capacity?: number; bookedDates?: string[] }) {
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState<number>(50);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const { format } = useCurrency();
  const { show } = useToast();

  async function ensureAuth() {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Please login first");
    return token;
  }

  function validate(): string | null {
    if (!date) return "Please pick a date.";
    const chosen = new Date(date);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (chosen < today) return "Date must be today or later.";
    const iso = date;
    if (bookedDates.includes(iso)) return "Selected date is already booked.";
    if (!Number.isFinite(guests) || guests < 1) return "Guests must be at least 1.";
    if (guests > capacity) return `Guests must be <= venue capacity (${capacity}).`;
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    const v = validate();
    if (v) { setError(v); show(v, "error"); return; }
    setError("");
    try {
      setLoading(true);
      await ensureAuth();
      // 1) Create booking (only once)
      let bId = bookingId;
      if (!bId) {
        const booking = await postJSON(`${"/api/bookings"}`, { venueId, date, guests });
        bId = booking.id;
        setBookingId(bId);
      }
      // Directly confirm booking (no Stripe path)
      const confirmed = await postJSON(`${"/api/payments/confirm"}`, { bookingId: bId });
      setStatus(`Booking confirmed! #${confirmed.id} • Total ${format(confirmed.totalPriceGBP)}`);
      show(`Booking confirmed! #${confirmed.id}`, "success");
    } catch (err: any) {
      setStatus(err.message || "Something went wrong");
      show(err.message || "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{marginTop:24}}>
      <h3>Book this venue</h3>
      <p>Base price: {format(basePrice)}</p>
      <form onSubmit={onSubmit} style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
        <input
          type="date"
          value={date}
          onChange={(e)=>setDate(e.target.value)}
          min={new Date().toISOString().slice(0,10)}
          required
        />
        <input
          type="number"
          min={1}
          max={capacity}
          value={guests}
          onChange={(e)=>setGuests(Number(e.target.value))}
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Processing..." : "Book & Pay"}</button>
      </form>
      {error && <p style={{color:"crimson", marginTop:6}}>{error}</p>}
      {status && <p style={{marginTop:8}}>{status}</p>}
    </div>
  );
}

// Stripe-enabled version (used when payments are enabled)
function InnerBookingFormStripe({ venueId, basePrice, capacity = 100, bookedDates = [] }: { venueId: string; basePrice: number; capacity?: number; bookedDates?: string[] }) {
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState<number>(50);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { format } = useCurrency();
  const stripe = useStripe();
  const elements = useElements();
  const { show } = useToast();

  async function ensureAuth() {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Please login first");
    return token;
  }

  function validate(): string | null {
    if (!date) return "Please pick a date.";
    const chosen = new Date(date);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (chosen < today) return "Date must be today or later.";
    const iso = date;
    if (bookedDates.includes(iso)) return "Selected date is already booked.";
    if (!Number.isFinite(guests) || guests < 1) return "Guests must be at least 1.";
    if (guests > capacity) return `Guests must be <= venue capacity (${capacity}).`;
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("");
    const v = validate();
    if (v) { setError(v); show(v, "error"); return; }
    setError("");
    try {
      setLoading(true);
      await ensureAuth();
      // 1) Create booking (only once)
      let bId = bookingId;
      if (!bId) {
        const booking = await postJSON(`${"/api/bookings"}`, { venueId, date, guests });
        bId = booking.id;
        setBookingId(bId);
      }

      // 2) Create PaymentIntent to get clientSecret (only once)
      let cs = clientSecret;
      if (!cs) {
        const pi = await postJSON(`${"/api/payments/intent"}`, { bookingId: bId });
        cs = pi.clientSecret;
        setClientSecret(cs);
      }

      if (!stripe || !elements) throw new Error("Stripe not ready");
      const card = elements.getElement(CardElement);
      if (!card) throw new Error("Card element not found");

      // 3) Confirm payment with card details
      const { error: payErr, paymentIntent } = await stripe.confirmCardPayment(cs!, {
        payment_method: { card }
      });
      if (payErr) throw new Error(payErr.message || "Payment failed");
      if (paymentIntent?.status !== "succeeded") throw new Error("Payment not completed");

      // 4) Mark booking as confirmed in backend
      const confirmed = await postJSON(`${"/api/payments/confirm"}`, { bookingId: bId, clientSecret: cs });
      setStatus(`Booking confirmed! #${confirmed.id} • Total ${format(confirmed.totalPriceGBP)}`);
      show(`Booking confirmed! #${confirmed.id}`, "success");
    } catch (err: any) {
      setStatus(err.message || "Something went wrong");
      show(err.message || "Something went wrong", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{marginTop:24}}>
      <h3>Book this venue</h3>
      <p>Base price: {format(basePrice)}</p>
      <form onSubmit={onSubmit} style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap"}}>
        <input
          type="date"
          value={date}
          onChange={(e)=>setDate(e.target.value)}
          min={new Date().toISOString().slice(0,10)}
          required
        />
        <input
          type="number"
          min={1}
          max={capacity}
          value={guests}
          onChange={(e)=>setGuests(Number(e.target.value))}
        />
        <div style={{minWidth:300, flex: '1 1 300px'}}>
          <CardElement options={{ hidePostalCode: true }} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? "Processing..." : "Book & Pay"}</button>
      </form>
      {error && <p style={{color:"crimson", marginTop:6}}>{error}</p>}
      {status && <p style={{marginTop:8}}>{status}</p>}
      <p style={{fontSize:12,color:'#666'}}>Use Stripe test card 4242 4242 4242 4242, any future date, any CVC.</p>
    </div>
  );
}

export default function BookingForm(props: { venueId: string; basePrice: number; capacity?: number; bookedDates?: string[] }) {
  const stripePk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const disablePayments = (process.env.NEXT_PUBLIC_DISABLE_PAYMENTS === '1');
  const stripePromise = useMemo(() => (!disablePayments && stripePk) ? loadStripe(stripePk) : null, [stripePk, disablePayments]);
  if (!stripePromise && !disablePayments) {
    return <div style={{marginTop:24}}>Stripe is not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in frontend env.</div>;
  }
  return disablePayments ? (
    <InnerBookingFormNoStripe {...props} />
  ) : (
    <Elements stripe={stripePromise}>
      <InnerBookingFormStripe {...props} />
    </Elements>
  );
}
