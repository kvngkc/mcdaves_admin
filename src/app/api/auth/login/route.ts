// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/service';
import { ADMIN_COOKIE_NAME, ADMIN_CSRF_COOKIE, generateCsrfToken } from '@/lib/auth/admin-auth';
import { verifyTurnstileToken } from '@/lib/security/turnstile';

export const dynamic = 'force-dynamic';

export async function POST(req:NextRequest):Promise<NextResponse>{
 try{
  const body=await req.json();const{email,password,turnstileToken}=body;
  if(!email||!password)return NextResponse.json({success:false,error:'Email and password required.'},{status:400});
  const isValidToken=await verifyTurnstileToken(turnstileToken);
  if(!isValidToken)return NextResponse.json({success:false,error:'Security check failed. Please refresh.'},{status:400});
  if(!supabase)return NextResponse.json({success:false,error:'Database client missing.'},{status:500});
  const{data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error||!data.session)return NextResponse.json({success:false,error:'Incorrect credentials. Access denied.'},{status:401});
  // Keep existing admin authorization behavior for compatibility with the current app.
  if(data.user.user_metadata?.role!=='admin'){await supabase.auth.signOut();return NextResponse.json({success:false,error:'Forbidden: Admin role required.'},{status:403});}
  const isProduction=process.env.NODE_ENV==='production';const csrfToken=generateCsrfToken();const res=NextResponse.json({success:true,message:'Administrator session authenticated',csrfToken});
  res.cookies.set({name:ADMIN_COOKIE_NAME,value:data.session.access_token,httpOnly:true,secure:isProduction,sameSite:'lax',path:'/',maxAge:data.session.expires_in});
  res.cookies.set({name:ADMIN_CSRF_COOKIE,value:csrfToken,httpOnly:false,secure:isProduction,sameSite:'lax',path:'/',maxAge:data.session.expires_in});
  return res;
 }catch{return NextResponse.json({success:false,error:'Authentication server error'},{status:500})}
}
