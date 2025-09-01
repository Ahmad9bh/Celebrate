import Link from 'next/link';

export default function Home() {
  return (
    <section>
      <h1>Find the perfect venue for your celebration</h1>
      <p>Search venues by city, date, capacity, amenities, and more.</p>
      <form action="/search">
        <input name="city" placeholder="City (e.g. London, Dubai)" />{' '}
        <select name="eventType" defaultValue="">
          <option value="">Any event</option>
          <option>Wedding</option>
          <option>Birthday</option>
          <option>Graduation</option>
          <option>Corporate</option>
        </select>{' '}
        <button type="submit">Search</button>
      </form>
      <div style={{marginTop:24}}>
        <Link className="badge" href="/search?city=London">Popular: London</Link>{' '}
        <Link className="badge" href="/search?city=Dubai">Dubai</Link>
      </div>
    </section>
  );
}
