import { getJSONServer } from "../../lib/serverApi";

async function getVenue(id: string) {
  try {
    return await getJSONServer(`/api/venues/${id}`);
  } catch {
    return null;
  }
}

export default async function VenuePage({ params }: { params: { id: string } }) {
  const venue = await getVenue(params.id);
  if (!venue) return <div>Not found</div>;
  return (
    <div>
      <h1>{venue.name}</h1>
      <div>{venue.city}, {venue.country} • Capacity {venue.capacity}</div>
      <p style={{maxWidth:700}}>{venue.description}</p>
      <h3>Availability</h3>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {venue.availability?.map((d: string) => (
          <span key={d} className="badge">{d}</span>
        ))}
      </div>
      {venue.bookedDates?.length ? (
        <div style={{marginTop:12}}>
          <h4>Booked dates</h4>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {venue.bookedDates.map((d: string) => (
              <span key={d} className="badge" style={{background:'#fee2e2', color:'#991b1b'}}>{d}</span>
            ))}
          </div>
        </div>
      ) : null}
      {/* Booking form (client component) */}
      <BookingForm venueId={venue.id} basePrice={venue.basePrice} capacity={venue.capacity} bookedDates={venue.bookedDates || []} />
    </div>
  );
}

// Import placed at bottom to avoid Next.js RSC hoist confusion
import BookingForm from './BookingForm';
