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
      .then((r) => setLogs(Array.isArray(r.data) ? r.data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const list = Array.isArray(logs) ? logs : [];

  return (
    <Layout
      title="Kotak Masuk / Notifikasi"
      subtitle="Undangan project dan notifikasi penugasan tim."
    >
      <Card className="bg-card border-border" data-testid="inbox-card">
        <CardHeader>
          <CardTitle className="text-base">Pesan & Undangan Tim</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Memuat notifikasi...</div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <div className="text-sm font-medium">Belum ada pesan atau undangan masuk.</div>
              <div className="text-xs text-muted-foreground mt-1">
                Notifikasi penugasan tugas dan undangan kolaborasi akan muncul di sini.
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {list.map((e) => (
                <div key={e.id} className="py-4 space-y-2" data-testid={`inbox-item-${e.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-sm">{e.subject}</div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {e.kind || "INFO"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.sent_at ? new Date(e.sent_at).toLocaleString("id-ID") : "Baru saja"}
                  </div>
                  <div className="text-sm text-foreground/80 whitespace-pre-wrap">{e.body}</div>
                  {e.link && (
                    <div className="pt-2">
                      <a
                        href={e.link}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all"
                      >
                        Buka Project ↗
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
