import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Mail } from "lucide-react";

export default function Inbox() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .get("/email-logs")
      .then((r) => setLogs(r.data))
      .finally(() => setLoading(false));
  }, []);
  return (
    <Layout
      title="Inbox (Mock)"
      subtitle="Simulasi email yang Anda terima. Pada produksi, email dikirim via SendGrid."
    >
      <Card className="bg-card border-border" data-testid="inbox-card">
        <CardHeader>
          <CardTitle className="text-base">Pesan untuk Anda</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Memuat...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-3" />
              <div className="text-sm">Belum ada pesan.</div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((e) => (
                <div key={e.id} className="py-4" data-testid={`inbox-item-${e.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold">{e.subject}</div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {e.kind}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {new Date(e.sent_at).toLocaleString()}
                  </div>
                  <div className="text-sm text-foreground/80 whitespace-pre-wrap">{e.body}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
