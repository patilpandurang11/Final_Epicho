"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    apiRequest("/admin/audit-logs").then(setLogs).catch(() => {});
  }, []);

  return (
    <AdminShell title="Administrative Audit Logs" subtitle="Immutable compliance log of administrative logins, moderation, verifications, and config changes.">
      <Card>
        <CardHeader><CardTitle className="text-base">Audit Trail ({logs.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.audit_id}>
                  <TableCell className="text-xs">{l.actor_email}</TableCell>
                  <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                  <TableCell className="text-xs">{l.target_table}</TableCell>
                  <TableCell className="text-xs text-[#475569]">{new Date(l.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminShell>
  );
}
