"use client";
import { useEffect, useState } from "react";
import { useToast } from "../ui/ToastContext";
import { getJSON } from "../lib/api";

type Booking = {
  id: string;
  venueId: string;
  date: string;
  guests: number;
  status: string;
  totalPriceGBP: number;
};

export default function Dashboard() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { show } = useToast();

  useEffect(() => {
    async function run() {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Please login to view your bookings.");
          show("Please login to view your bookings.", "error");
          return;
        }
        const data = await getJSON(`/api/bookings/me`);
        setBookings(data.items || []);
      } catch (e: any) {
        const msg = e?.message || "Failed to fetch";
        if (msg === "Unauthorized") {
          // api helper already redirected; show a subtle toast
          show("Session expired. Please sign in again.", "error");
          setError("Unauthorized");
        } else {
          setError(msg);
          show(msg, "error");
        }
      }
    }
    run();
  }, []);

  return (
    <div>
      <h2>My bookings</h2>
      {!bookings && !error && <p>Loading...</p>}
      {error && <p style={{color:"crimson"}}>{error}</p>}
      {bookings && (
        bookings.length ? (
          <div className="container" style={{marginTop:12}}>
            {bookings.map(b => (
              <div key={b.id} className="card">
                <div style={{fontWeight:600}}>Booking #{b.id}</div>
                <div>Date: {b.date}</div>
                <div>Guests: {b.guests}</div>
                <div>Status: {b.status}</div>
                <div>Total: £{b.totalPriceGBP.toLocaleString()}</div>
              </div>
            ))}
          </div>
        ) : (
          <p>No bookings yet.</p>
        )
      )}
    </div>
  );
}
