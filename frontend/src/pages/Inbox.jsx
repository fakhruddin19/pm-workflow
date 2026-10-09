import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Mail, Send, Copy, Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function Inbox() {
  const [data, setData] = useState({ inbox: [], sent: [] });
  const [activeTab, setActiveTab] = useState("inbox");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/email-logs")
      .then((r) => {
        if (Array.isArray(r.data)) {
          setData({ inbox: r.data, sent: [] });
        } else if (r.data && typeof r.data === "object") {
          setData({
            inbox: Array.isArray(r.data.inbox) ? r.data.inbox : [],
            sent: Array.isArray(r.data.sent) ? r.data.sent : [],
          });
        } else {
          setData({ inbox: [], sent: [] });
        }
      })
      .catch(() => setData({ inbox: [], sent: [] }))
      .finally(() => setLoading(false));
  }, []);

  const copyProjectLink = (link) => {
    const fullUrl = link.startsWith("http") ? link : `${window.location.origin}${link}`;
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(fullUrl);
      toast.success("Link proyek berhasil disalin!");
    }
  };

  const shareWhatsApp = (item) => {
    const fullUrl = item.link?.startsWith("http") ? item.link : `${window.location.origin}${item.link}`;
    const text = encodeURIComponent(
      `Halo! Anda diundang bergabung ke proyek "${item.project_name || "GeoFlow"}" sebagai ${item.role || "tim"}.\n\nBuka link proyek untuk mulai berkolaborasi:\n${fullUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

  const list = activeTab === "inbox" ? data.inbox : data.sent;

  return (
    <Layout
      title="Kotak Masuk & Notifikasi"
      subtitle="Undangan project, notifikasi tugas, dan riwayat undangan tim."
    >
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant={activeTab === "inbox" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("inbox")}
          className={activeTab === "inbox" ? "bg-indigo-600 hover:bg-indigo-500" : ""}
          data-testid="tab-inbox"
        >
          <Mail className="h-4 w-4 mr-1.5" />
          Kotak Masuk ({data.inbox.length})
        </Button>
        <Button
          variant={activeTab === "sent" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("sent")}
          className={activeTab === "sent" ? "bg-indigo-600 hover:bg-indigo-500" : ""}
          data-testid="tab-sent"
        >
          <Send className="h-4 w-4 mr-1.5" />
          Undangan Terkirim ({data.sent.length})
        </Button>
      </div>

      <Card className="bg-card border-border" data-testid="inbox-card">
        <CardHeader>
          <CardTitle className="text-base">
            {activeTab === "inbox" ? "Pesan & Undangan untuk Anda" : "Daftar Undangan yang Pernah Anda Kirim"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Memuat notifikasi...</div>
          ) : list.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <div className="text-sm font-medium">
                {activeTab === "inbox"
                  ? "Belum ada undangan atau tugas masuk untuk Anda."
                  : "Belum ada undangan tim yang Anda kirimkan."}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {activeTab === "inbox"
                  ? "Ketika pemilik proyek mengundang akun Anda atau memberikan tugas, pesannya akan muncul di sini."
                  : "Undang anggota tim melalui halaman detail proyek untuk melihat daftarnya di sini."}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {list.map((e) => (
                <div key={e.id} className="py-4 space-y-2.5" data-testid={`inbox-item-${e.id}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-semibold text-sm">{e.subject}</div>
                    <span
                      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${
                        e.kind === "UNDANGAN"
                          ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                          : e.kind === "TERKIRIM"
                          ? "bg-blue-500/10 text-blue-300 border-blue-500/20"
                          : "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                      }`}
                    >
                      {e.kind || "INFO"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.sent_at ? new Date(e.sent_at).toLocaleString("id-ID") : "Baru saja"}
                    {e.to && activeTab === "sent" && <span className="ml-2 font-mono text-foreground/80">→ {e.to}</span>}
                  </div>
                  <div className="text-sm text-foreground/80 whitespace-pre-wrap">{e.body}</div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {e.link && (
                      <a
                        href={e.link}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Buka Project ↗
                      </a>
                    )}

                    {e.drive_link && (
                      <a
                        href={e.drive_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all"
                      >
                        Buka Google Drive ↗
                      </a>
                    )}

                    {activeTab === "sent" && e.link && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyProjectLink(e.link)}
                          className="h-7 text-xs border-border"
                        >
                          <Copy className="h-3 w-3 mr-1" /> Salin Link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => shareWhatsApp(e)}
                          className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <Share2 className="h-3 w-3 mr-1" /> Kirim WhatsApp
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
