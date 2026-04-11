/**
 * DEL-MIGOS — Frontend API Client
 * Set window.API_URL before loading this script.
 * Default: http://localhost:3001
 */
const DelMigosAPI = (() => {
  const BASE = window.API_URL || 'http://localhost:3001';
  let adminToken = null;

  async function req(method, path, body=null, auth=false) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && adminToken) headers['Authorization'] = 'Bearer ' + adminToken;
    const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : null });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API error');
    return data;
  }

  return {
    async createBooking(p)           { return req('POST','/api/bookings',p); },
    async getBooking(ref)            { return req('GET',`/api/bookings/${ref}`); },
    async checkAvailability(ci,co)   { return req('GET',`/api/availability?checkin=${ci}&checkout=${co}`); },
    async submitEnquiry(p)           { return req('POST','/api/enquiries',p); },
    async subscribeNewsletter(email) { return req('POST','/api/newsletter',{email}); },
    async login(user, pass) {
      const d = await req('POST','/api/auth/admin',{username:user,password:pass});
      adminToken = d.token;
      sessionStorage.setItem('dm_token', adminToken);
      return d;
    },
    loadToken()                      { adminToken=sessionStorage.getItem('dm_token'); return !!adminToken; },
    logout()                         { adminToken=null; sessionStorage.removeItem('dm_token'); },
    async getAllBookings(p={})        { return req('GET','/api/bookings?'+new URLSearchParams(p),null,true); },
    async updateStatus(ref,status,tx){ return req('PATCH',`/api/bookings/${ref}/status`,{status,tx_id:tx},true); },
    async cancelBooking(ref)         { return req('DELETE',`/api/bookings/${ref}`,null,true); },
    async getStats()                 { return req('GET','/api/stats',null,true); },
    async getEnquiries()             { return req('GET','/api/enquiries',null,true); },
    isLoggedIn()                     { return !!adminToken; }
  };
})();
DelMigosAPI.loadToken();
