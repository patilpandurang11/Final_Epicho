"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { 
  Stethoscope, Calendar, Clock, Video, UserCheck, ShieldCheck, 
  FileText, CheckCircle2, ChevronRight, AlertCircle, Sparkles
} from "lucide-react";

export default function NutritionistDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"appointments" | "clients" | "plans" | "credentials">("appointments");

  const appointments = [
    {
      id: "1",
      clientName: "Priya Sundaram",
      age: 32,
      goal: "PCOS Dietary Management & Anti-Inflammatory Plan",
      date: "Today",
      time: "4:00 PM – 4:45 PM",
      status: "Upcoming",
      teleconsultUrl: "https://meet.epicho.com/nutri-7201-meet",
      consentGranted: true,
    },
    {
      id: "2",
      clientName: "Rohan Varma",
      age: 28,
      goal: "Clean Lean Bulk & Plant-based Protein Optimization",
      date: "Tomorrow",
      time: "11:00 AM – 11:45 AM",
      status: "Confirmed",
      teleconsultUrl: "https://meet.epicho.com/nutri-8402-meet",
      consentGranted: true,
    },
    {
      id: "3",
      clientName: "Sunita Rao",
      age: 54,
      goal: "Pre-Diabetes Glycemic Index Diet Control",
      date: "Nov 29, 2026",
      time: "3:30 PM – 4:15 PM",
      status: "Completed",
      teleconsultUrl: "",
      consentGranted: true,
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-border mb-8 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-stone-900 tracking-tight font-serif">Clinical Nutritionist Suite</h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> IDA & FSSAI Certified
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            Clinical Practice: <span className="font-semibold text-stone-800">Dr. Anita Roy, M.Sc. Clinical Nutrition, RD</span> • Reg: #IDA-84920
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/consultations"
            className="inline-flex items-center gap-2 border border-border bg-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-stone-50 transition shadow-sm"
          >
            Public Booking Page
          </Link>
          <span className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm">
            <Calendar className="w-4 h-4" /> 2 Consultations Today
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Clients</span>
            <UserCheck className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-stone-900">42</div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">94% plan adherence</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Completed Sessions</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-stone-900">188</div>
          <div className="text-xs text-muted-foreground mt-1">Over past 6 months</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Client Rating</span>
            <span className="text-amber-500 font-bold text-xs">★★★★★</span>
          </div>
          <div className="text-2xl font-black text-stone-900">4.95 / 5.0</div>
          <div className="text-xs text-muted-foreground mt-1">From 56 clinical reviews</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Diet Plans Formulated</span>
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-stone-900">76</div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">Integrated with AI Kitchen</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {[
          { id: "appointments", label: "Upcoming Consultations", icon: Calendar },
          { id: "clients", label: "Client Health Records", icon: UserCheck },
          { id: "plans", label: "Prescribed Meal Protocols", icon: FileText },
          { id: "credentials", label: "Credentials & Verification", icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 text-sm font-semibold transition ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-stone-800"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "appointments" && (
        <div className="space-y-4">
          {appointments.map((appt) => (
            <div key={appt.id} className="bg-white p-6 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-stone-900 text-base">{appt.clientName}</h3>
                  <span className="text-xs text-muted-foreground">Age: {appt.age}</span>
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    appt.status === "Upcoming" ? "bg-amber-100 text-amber-800" :
                    appt.status === "Confirmed" ? "bg-blue-100 text-blue-800" : "bg-stone-100 text-stone-600"
                  }`}>
                    {appt.status}
                  </span>
                </div>
                <p className="text-sm text-stone-600">{appt.goal}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1 font-semibold text-stone-800">
                    <Calendar className="w-3.5 h-3.5 text-primary" /> {appt.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" /> {appt.time}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> HIPAA/DPDP Consent Verified
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {appt.teleconsultUrl && (
                  <a
                    href={appt.teleconsultUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm"
                  >
                    <Video className="w-4 h-4" /> Join Teleconsult
                  </a>
                )}
                <button
                  onClick={() => alert(`Opening medical notes for ${appt.clientName}`)}
                  className="px-4 py-2 border border-border rounded-xl text-sm font-semibold text-stone-700 hover:bg-stone-50 transition"
                >
                  Clinical Notes
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab !== "appointments" && (
        <div className="bg-white p-12 text-center rounded-2xl border border-border shadow-sm">
          <Stethoscope className="w-10 h-10 text-primary mx-auto mb-3" />
          <h3 className="text-lg font-bold text-stone-900 capitalize mb-1">{activeTab} Manager</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Manage your patient consent workflows, digital diet chart issuance, and FSSAI/IDA certification renewals.
          </p>
        </div>
      )}
    </div>
  );
}
