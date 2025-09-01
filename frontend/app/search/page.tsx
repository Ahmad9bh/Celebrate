import Link from 'next/link';
import Price from '../currency/Price';
import { getJSONServer } from '../lib/serverApi';
import SearchControls from './SearchControls';

async function getVenues(searchParams: Record<string,string>) {
  const qs = new URLSearchParams(searchParams as any).toString();
  return getJSONServer(`/api/venues?${qs}`);
}

export default async function Search({ searchParams }: { searchParams: Record<string,string> }) {
  const data = await getVenues(searchParams);
  return (
    <div>
      <h2>Search results</h2>
      <SearchControls initial={searchParams} />
      <div style={{marginTop:8, fontSize:13, color:'#555'}}>
        {Array.isArray(data.items) ? `${data.items.length} result${data.items.length===1?'':'s'}` : '0 results'}
      </div>
      <div className="container" style={{marginTop:16}}>
        {data.items?.map((v: any) => (
          <div key={v.id} className="card">
            <div style={{fontWeight:600}}>{v.name}</div>
            <div>{v.city}, {v.country}</div>
            <div>Capacity: {v.capacity}</div>
            <div><Price amountGBP={v.basePrice} /></div>
            <Link href={`/venue/${v.id}`}>View</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
