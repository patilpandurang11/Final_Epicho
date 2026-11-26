"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Users, 
  ChefHat, 
  Building2, 
  UtensilsCrossed, 
  Film, 
  AlertTriangle, 
  DollarSign, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  FileText,
  Clock
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function AdminDashboardPage() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "moderation" | "verifications" | "audit">("overview");

  const fetchAdminData = async () => {
    try {
      const s = await apiRequest("/admin/stats");
      setStats(s);
      const m = await apiRequest("/admin/moderation");
      setReports(m);
      const v = await apiRequest("/admin/verifications");
      setVerifications(v);
      const a = await apiRequest("/admin/audit-logs");
      setAuditLogs(a);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleModerationAction = async (reportId: string, action: string) => {
    try {
      await apiRequest(`/admin/moderation/${reportId}/action`, {
        method: "POST",
        body: JSON.stringify({ action })
      });
      alert(`Moderation action '${action}' applied.`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || "Failed to execute moderation action.");
    }
  };

  const handleVerificationReview = async (businessId: string, status: string) => {
    try {
      await apiRequest(`/admin/verifications/${businessId}/review`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
      alert(`Verification status updated to ${status}.`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || "Failed to update verification.");
    }
  };

  if (!isAdmin && !loading) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <ShieldCheck className="w-12 h-12 text-red-600 mx-auto" />
        <h2 className="text-xl font-bold text-stone-900">Administrative Access Required</h2>
        <p className="text-xs text-stone-500">
          This portal is strictly restricted to platform moderators and super admins.
        </p>
        <a href="/login" className="inline-block px-4 py-2 bg-[#9A3412] text-white rounded-lg text-xs font-bold">
          Sign In as Admin
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#F2E6E2]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-900 border border-red-200 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-red-700" />
            EpiCho Command & Moderation Suite
          </div>
          <h1 className="text-3xl font-black text-[#0F172A] tracking-tight">
            Super Admin Dashboard
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Platform telemetry, content moderation, KYC verification, and tamper-evident audit logs.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-stone-100 p-1.5 rounded-2xl text-xs font-bold">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "overview" ? "bg-white text-[#9A3412] shadow-sm" : "text-stone-600"
            }`}
          >
            📊 Telemetry
          </button>
          <button
            onClick={() => setActiveTab("moderation")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "moderation" ? "bg-white text-[#9A3412] shadow-sm" : "text-stone-600"
            }`}
          >
            🛡️ Moderation ({reports.length})
          </button>
          <button
            onClick={() => setActiveTab("verifications")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "verifications" ? "bg-white text-[#9A3412] shadow-sm" : "text-stone-600"
            }`}
          >
            📋 KYC Verification ({verifications.length})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-xl transition-all ${
              activeTab === "audit" ? "bg-white text-[#9A3412] shadow-sm" : "text-stone-600"
            }`}
          >
            📜 Audit Logs
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-stone-400 font-medium">Loading platform telemetry...</div>
      ) : (
        <div className="space-y-8">
          {/* OVERVIEW TAB */}
          {activeTab === "overview" && stats && (
            <div className="space-y-8">
              {/* Stat Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-3xl border border-[#F2E6E2] shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-stone-400">
                    <Users className="w-5 h-5 text-blue-600" />
                    <span className="text-[10px] font-bold uppercase">Users</span>
                  </div>
                  <span className="text-3xl font-black text-[#0F172A]">{stats.total_users}</span>
                  <span className="text-xs text-stone-500 block">{stats.active_creators} Creators</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-[#F2E6E2] shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-stone-400">
                    <UtensilsCrossed className="w-5 h-5 text-[#9A3412]" />
                    <span className="text-[10px] font-bold uppercase">Recipes</span>
                  </div>
                  <span className="text-3xl font-black text-[#0F172A]">{stats.total_recipes}</span>
                  <span className="text-xs text-stone-500 block">Structured Catalog</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-[#F2E6E2] shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-stone-400">
                    <Film className="w-5 h-5 text-[#C2410C]" />
                    <span className="text-[10px] font-bold uppercase">Reels</span>
                  </div>
                  <span className="text-3xl font-black text-[#0F172A]">{stats.total_reels}</span>
                  <span className="text-xs text-stone-500 block">9:16 Short Videos</span>
                </div>

                <div className="bg-white p-5 rounded-3xl border border-[#F2E6E2] shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-stone-400">
                    <DollarSign className="w-5 h-5 text-[#059669]" />
                    <span className="text-[10px] font-bold uppercase">Revenue</span>
                  </div>
                  <span className="text-3xl font-black text-[#059669]">₹{stats.total_revenue_inr.toLocaleString()}</span>
                  <span className="text-xs text-stone-500 block">Verified Subscriptions</span>
                </div>
              </div>

              {/* System Health Status Card */}
              <div className="bg-white rounded-3xl border border-[#F2E6E2] p-6 shadow-sm space-y-4">
                <h3 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#059669]" />
                  Infrastructure & AI Provider Health
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-stone-500 block">FastAPI Server</span>
                    <span className="font-extrabold text-emerald-900">{stats.system_health.api_status}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <span className="text-stone-500 block">PostgreSQL</span>
                    <span className="font-extrabold text-emerald-900">{stats.system_health.database_status}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200">
                    <span className="text-stone-500 block">AI Culinary Engine</span>
                    <span className="font-extrabold text-amber-900">{stats.system_health.ai_engine}</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200">
                    <span className="text-stone-500 block">Media CDN Storage</span>
                    <span className="font-extrabold text-purple-900">{stats.system_health.storage_quota}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MODERATION TAB */}
          {activeTab === "moderation" && (
            <div className="bg-white rounded-3xl border border-[#F2E6E2] p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-base text-[#0F172A]">Community Content Moderation Queue</h3>
              {reports.length === 0 ? (
                <p className="text-xs text-stone-400 py-8 text-center">No open moderation reports! Community safety in good standing.</p>
              ) : (
                <div className="space-y-3">
                  {reports.map((rep) => (
                    <div key={rep.report_id} className="p-4 rounded-2xl border border-stone-200 flex items-center justify-between text-xs">
                      <div className="space-y-1">
                        <span className="font-bold text-red-800 bg-red-50 px-2 py-0.5 rounded-full uppercase text-[10px]">
                          Target: {rep.target_type}
                        </span>
                        <p className="font-semibold text-stone-900">{rep.reason}</p>
                        <span className="text-stone-400 block">Reported by {rep.reporter_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleModerationAction(rep.report_id, "dismiss")}
                          className="px-3 py-1.5 rounded-xl border border-stone-300 font-bold hover:bg-stone-100"
                        >
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleModerationAction(rep.report_id, "remove_content")}
                          className="px-3 py-1.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700"
                        >
                          Remove Content
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VERIFICATIONS TAB */}
          {activeTab === "verifications" && (
            <div className="bg-white rounded-3xl border border-[#F2E6E2] p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-base text-[#0F172A]">Business & Creator KYC Verification Queue</h3>
              {verifications.length === 0 ? (
                <p className="text-xs text-stone-400 py-8 text-center">No pending verifications.</p>
              ) : (
                <div className="space-y-3">
                  {verifications.map((v) => (
                    <div key={v.id} className="p-4 rounded-2xl border border-stone-200 flex items-center justify-between text-xs">
                      <div className="space-y-1">
                        <h4 className="font-bold text-stone-900 text-sm">{v.name}</h4>
                        <span className="text-stone-500 block">Owner: {v.owner} • FSSAI: {v.fssai_license_no || "Pending upload"}</span>
                        <span className="text-stone-400 block">{v.address}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleVerificationReview(v.id, "rejected")}
                          className="px-3 py-1.5 rounded-xl border border-red-300 text-red-700 font-bold hover:bg-red-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleVerificationReview(v.id, "verified")}
                          className="px-3 py-1.5 rounded-xl bg-[#059669] text-white font-bold hover:bg-emerald-800"
                        >
                          Approve & Badge
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AUDIT LOGS TAB */}
          {activeTab === "audit" && (
            <div className="bg-white rounded-3xl border border-[#F2E6E2] p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 className="font-bold text-base text-[#0F172A]">Tamper-Evident Immutable Audit Trail</h3>
                <span className="text-[10px] font-bold text-[#059669] bg-emerald-50 px-2 py-0.5 rounded-full">
                  PostgreSQL Row-Protected
                </span>
              </div>
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div key={log.audit_id} className="p-3 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-stone-900 mr-2">{log.actor_name}</span>
                      <span className="text-stone-400">({log.actor_role})</span>
                      <p className="text-stone-700 font-mono mt-0.5">{log.action} on {log.target_table}</p>
                    </div>
                    <span className="text-stone-400 font-medium">{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
