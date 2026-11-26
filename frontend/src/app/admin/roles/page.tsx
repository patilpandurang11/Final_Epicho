"use client";

import React, { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { AdminShell } from "@/components/layout/AdminShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<any[]>([]);

  useEffect(() => {
    apiRequest("/admin/roles").then((res) => setRoles(res.roles || [])).catch(() => {});
  }, []);

  return (
    <AdminShell title="Role & Permission Management" subtitle="Backend-enforced RBAC matrix across user, professional, and 9 staff roles.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((r) => (
          <Card key={r.role_id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>{r.role_name}</span>
                <Badge variant="emerald">{r.tier}</Badge>
              </CardTitle>
              <p className="text-xs text-[#475569]">{r.description}</p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {r.permissions?.map((p: string) => (
                <Badge key={p} variant="outline">{p}</Badge>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
