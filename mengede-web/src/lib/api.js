import{getDeviceId}from'./device.js';const API_BASE=import.meta.env.VITE_API_BASE_URL||'';async function call(path,{method='GET',body}={}){try{const res=await fetch(API_BASE+path,{method,headers:{'Content-Type':'application/json','X-Device-Id':getDeviceId()},body:body?JSON.stringify(body):undefined});return res.json().catch(()=>({ok:false,error:'Unexpected response from the server.'}));}catch(e){return{ok:false,error:e.message||'Network error'}}}
export const verifyReceipt=(mentorId,slot,reference)=>call('/api/verify-receipt',{method:'POST',body:{mentorId,slot,reference}});
export const createBooking=(mentorId,slot)=>call('/api/bookings',{method:'POST',body:{mentorId,slot}});
export const listBookings=()=>call('/api/bookings');export const clearBookings=()=>call('/api/bookings',{method:'DELETE'});
export const getMentorPayment=id=>call('/api/mentors/'+id+'/payment');export const getMentorTakenSlots=id=>call('/api/mentors/'+id+'/slots');
export const askMengede=(text,conversationId)=>call('/api/assistant',{method:'POST',body:{text,conversationId}});
export const getRecommendations=()=>call('/api/recommendations');
export const getUniversities=()=>call('/api/universities');export const getUniversity=slug=>call('/api/universities/'+encodeURIComponent(slug));
export const getPathways=()=>call('/api/pathways');export const getPathway=slug=>call('/api/pathways/'+encodeURIComponent(slug));
export const getResources=params=>{const q=new URLSearchParams(Object.entries(params||{}).filter(([,v])=>v));return call('/api/resources'+(q.toString()?'?'+q:''));};
export const recordInteraction=(type,entityType,entityId,metadata={})=>call('/api/interactions',{method:'POST',body:{type,entityType,entityId,metadata}});
export const getUserIntelligence=()=>call('/api/interactions/intelligence');
