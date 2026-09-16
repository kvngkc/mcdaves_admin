// src/lib/auth/admin-auth.ts
import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase/service';

export const ADMIN_COOKIE_NAME='mcdaves_sb_access_token';
export const ADMIN_CSRF_COOKIE='mcdaves_admin_csrf';
export function generateCsrfToken():string{return crypto.randomBytes(32).toString('hex');}
export function verifyCsrfToken(req:NextRequest):boolean{if(['GET','HEAD','OPTIONS'].includes(req.method))return true;const cookie=req.cookies.get(ADMIN_CSRF_COOKIE)?.value;const header=req.headers.get('x-csrf-token');if(!cookie||!header||cookie.length!==header.length)return false;try{return crypto.timingSafeEqual(Buffer.from(cookie),Buffer.from(header));}catch{return false;}}
export type AdminRole='admin'|'manager'|'staff';
export interface AuthResult{authorized:boolean;role?:AdminRole;error?:string;user?:any;}
export async function requireRole(req:NextRequest,allowedRoles:AdminRole[]):Promise<AuthResult>{
 if(!verifyCsrfToken(req))return{authorized:false,error:'CSRF token missing or invalid'};
 const token=req.cookies.get(ADMIN_COOKIE_NAME)?.value;if(!token)return{authorized:false,error:'Unauthorized: No session token found.'};if(!supabase)return{authorized:false,error:'Internal Server Error: Database client missing'};
 const{data,error}=await supabase.auth.getUser(token);if(error||!data.user)return{authorized:false,error:'Unauthorized: Invalid or expired session.'};
 const userRole=data.user.app_metadata?.role as AdminRole;
 if(!userRole||!allowedRoles.includes(userRole))return{authorized:false,error:'Forbidden: Insufficient permissions.'};
 return{authorized:true,role:userRole,user:data.user};
}
export async function requireAdminSession(req:NextRequest):Promise<AuthResult>{return requireRole(req,['admin']);}
export async function requireManagerOrHigher(req:NextRequest):Promise<AuthResult>{return requireRole(req,['admin','manager']);}
export async function requireStaffOrHigher(req:NextRequest):Promise<AuthResult>{return requireRole(req,['admin','manager','staff']);}
