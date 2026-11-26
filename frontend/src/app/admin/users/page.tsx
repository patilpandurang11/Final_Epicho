"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { AdminShell } from "@/components/layout/AdminShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("content_moderator");
  const [msg, setMsg] = useState<string | null>(null);

  const loadUsers = () => {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    apiRequest(`/admin/users${q}`).then(setUsers).catch(() => {});
  };

  useEffect(() => {
    loadUsers();
  }, [search]);

  const toggleStatus = async (userId: string, current: string) => {
    const next = current === "active" ? "suspended" : "active";
    await apiRequest(`/admin/users/${userId}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
    setMsg(`User status updated to ${next}.`);
    loadUsers();
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest("/auth/admin-invite", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, role_name: inviteRole }),
      });
      setMsg(`Invitation created for ${res.email} (${res.role_name}).`);
      setInviteEmail("");
    } catch (err: any) {
      setMsg(err.message);
    }
  };

  return (
    <AdminShell title="User & Staff Management" subtitle="Manage community members, suspend accounts, and invite administrative staff.">
      {msg && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold">{msg}</div>}

      <Card>
        <CardHeader><CardTitle className="text-base">Invite Staff Administrator</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <Input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="staff@epicho.com" />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="h-10 rounded-xl border border-[#E7DFD3] dark:border-[#253D31] bg-white dark:bg-[#0D1511] px-3 text-sm"
            >
              {["super_admin", "infra_admin", "tech_admin", "content_moderator", "verification_admin", "ranking_admin", "finance_admin", "customer_support", "analytics_admin"].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <Button type="submit" variant="emerald">Send Invite</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Registered Accounts ({users.length})</CardTitle>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by email or name..." className="max-w-xs" />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Tier / Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <p className="font-bold text-xs">{u.full_name}</p>
                    <p className="text-[11px] text-[#475569]">{u.email}</p>
                  </TableCell>
                  <TableCell><Badge variant="outline">{u.account_tier} ({u.role_name})</Badge></TableCell>
                  <TableCell><Badge variant={u.status === "active" ? "emerald" : "destructive"}>{u.status}</Badge></TableCell>
                  <TableCell>
                    <Button onClick={() => toggleStatus(u.user_id, u.status)} size="sm" variant="outline">
                      {u.status === "active" ? "Suspend" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
