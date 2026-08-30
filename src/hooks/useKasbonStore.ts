"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import type {DebtItem,StoreProfile} from "@/types";
import {addAmountToDebt,applyPayment} from "@/lib/debt";
import {parseStoredDebts,parseStoredStore} from "@/lib/storage";
import {newId} from "@/lib/utils";
const DEBTS_KEY="buku-kasbon.debts.v1", STORE_KEY="buku-kasbon.store.v1";
const defaultStore:StoreProfile={storeName:"Warung Makmur",ownerName:"Pemilik Warung",paymentInfo:""};
export function useKasbonStore(){
 const [debts,setDebts]=useState<DebtItem[]>([]); const [store,setStoreState]=useState<StoreProfile>(defaultStore); const [hydrated,setHydrated]=useState(false);
 const skipInitialDebtWrite=useRef(true),skipInitialStoreWrite=useRef(true);
 useEffect(()=>{ const timer=window.setTimeout(()=>{ try { const d=localStorage.getItem(DEBTS_KEY),s=localStorage.getItem(STORE_KEY); const storedDebts=d?parseStoredDebts(d):null,storedStore=s?parseStoredStore(s):null; if(storedDebts)setDebts(storedDebts); if(storedStore)setStoreState(storedStore); } catch{} finally { setHydrated(true); } },0); return ()=>window.clearTimeout(timer); },[]);
 useEffect(()=>{if(!hydrated)return;if(skipInitialDebtWrite.current){skipInitialDebtWrite.current=false;return}try{localStorage.setItem(DEBTS_KEY,JSON.stringify(debts))}catch{}},[debts,hydrated]); useEffect(()=>{if(!hydrated)return;if(skipInitialStoreWrite.current){skipInitialStoreWrite.current=false;return}try{localStorage.setItem(STORE_KEY,JSON.stringify(store))}catch{}},[store,hydrated]);
 const addDebt=useCallback((input:Omit<DebtItem,"id"|"remainingAmount"|"status"|"createdAt"|"paymentHistory">)=>setDebts(v=>[{...input,id:newId(),remainingAmount:input.totalAmount,status:"UNPAID",createdAt:new Date().toISOString(),paymentHistory:[]},...v]),[]);
 const addToDebt=useCallback((id:string,amount:number,description:string)=>setDebts(v=>v.map(d=>d.id===id?addAmountToDebt(d,amount,description):d)),[]);
 const payDebt=useCallback((id:string,amount:number)=>setDebts(v=>v.map(d=>d.id===id?applyPayment(d,amount,newId(),new Date().toISOString()):d)),[]);
 const setStore=useCallback((value:StoreProfile)=>setStoreState(value),[]);
 const active=useMemo(()=>debts.filter(d=>d.status!=="PAID"),[debts]), paid=useMemo(()=>debts.filter(d=>d.status==="PAID"),[debts]);
 const totalReceivable=useMemo(()=>active.reduce((sum,d)=>sum+d.remainingAmount,0),[active]);
 return {debts,active,paid,store,hydrated,totalReceivable,addDebt,addToDebt,payDebt,setStore};
}
