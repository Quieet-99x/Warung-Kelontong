export const formatIDR=(amount:number):string=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(amount);
export const sanitizePhoneNumber=(phone:string):string=>{ let cleaned=phone.replace(/[^0-9]/g,""); if(cleaned.startsWith("0")) cleaned="62"+cleaned.slice(1); return cleaned; };
export const isValidWhatsAppNumber=(phone:string):boolean=>/^628[0-9]{8,11}$/.test(sanitizePhoneNumber(phone));
export const parseIDRInput=(value:string):number=>{ const trimmed=value.trim(); const nativeNumber=Number(trimmed); if(trimmed&&Number.isFinite(nativeNumber))return nativeNumber; return Number(value.replace(/[^0-9]/g,""))||0; };
export const formatDate=(value:string):string=>new Intl.DateTimeFormat("id-ID",{day:"numeric",month:"short",year:"numeric"}).format(new Date(value));
export const newId=()=>crypto.randomUUID();
