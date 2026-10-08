import React, { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { api } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { FolderKanban, ListTodo, Mail, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { Progress } from "../components/ui/progress";

function StatCard({ icon: Icon, label, value, tone = "indigo", testid }) {
  const tones = {
    indigo: "from-indigo-500/20 to-indigo-500/5 text-indigo-300 border-indigo-500/20",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-300 border-emerald-500/20",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-300 border-amber-500/20",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-300 border-rose-500/20",
  };
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-5 ${tones[tone]}`}
      data-testid={testid}
    >
      <Icon className="h-5 w-5 mb-3" />
      <div className="text-3xl font-bold tracking-tight" style={{ fontFamily: "Plus Jakarta Sans" }}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [projects, setProjects] = useState([]);
  useEffect(() => {
    Promise.all([api.get("/dashboard"), api.get("/projects")]).then(([d, p]) => {
      setData(d.data);
      setProjects(p.data);
    });
  }, []);

  const stageCounts = data?.stage_counts || {};
  const totalInStages = Object.values(stageCounts).reduce((a, b) => a + b, 0) || 1;

  return (
    <Layout title="Dashboard" subtitle="Ringkasan project, tugas, dan workflow Anda">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="dashboard-stats">
        <StatCard icon={FolderKanban} label="Total Project" value={data?.total_projects ?? "—"} tone="indigo" testid="stat-projects" />
        <StatCard icon={Target} label="Project yang Saya Miliki" value={data?.owned_projects ?? "—"} tone="emerald" testid="stat-owned" />
        <StatCard icon={ListTodo} label="Total Tugas" value={data?.total_tasks ?? "—"} tone="amber" testid="stat-tasks" />
        <StatCard icon={Mail} label="Tugas Saya" value={data?.my_tasks ?? "—"} tone="rose" testid="stat-my-tasks" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="bg-card border-border lg:col-span-2" data-testid="stage-distribution-card">
          <CardHeader>
            <CardTitle className="text-base">Distribusi Tugas per Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(stageCounts).length === 0 ? (
              <div className="text-sm text-muted-foreground">Belum ada tugas. Buat project untuk mulai.</div>
            ) : (
              <div className="space-y-4">
                {Object.entries(stageCounts).map(([stage, count]) => {
                  const pct = Math.round((count / totalInStages) * 100);
                  return (
                    <div key={stage}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium">{stage}</span>
                        <span className="text-muted-foreground">
                          {count} tugas · {pct}%
                        </span>
                      </div>
                      <Progress value={pct} className="h-2 bg-background" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border" data-testid="recent-emails-card">
          <CardHeader>
            <CardTitle className="text-base">Notifikasi & Aktivitas Email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.recent_emails || []).length === 0 ? (
              <div className="text-sm text-muted-foreground">Belum ada aktivitas email.</div>
            ) : (
              (data?.recent_emails || []).slice(0, 5).map((e) => (
                <div key={e.id} className="text-xs border-l-2 border-indigo-500/40 pl-3">
                  <div className="font-medium text-foreground truncate">{e.subject}</div>
                  <div className="text-muted-foreground truncate">
                    → {e.to} · {e.kind}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border" data-testid="recent-projects-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Project Terkini</CardTitle>
          <Link to="/projects" className="text-xs text-indigo-400 hover:text-indigo-300" data-testid="see-all-projects-link">
            Lihat semua →
          </Link>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <div className="text-sm text-muted-foreground">Belum ada project.</div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {projects.slice(0, 6).map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="p-4 rounded-lg border border-border hover:border-indigo-500/40 bg-background/40 transition-colors"
                  data-testid={`project-card-${p.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold truncate">{p.name}</div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border border-border text-muted-foreground">
                      {p.role}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                    {p.description || "Tidak ada deskripsi"}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-3">
                    {(p.stages || []).map((s, idx) => {
                      const nm = typeof s === "string" ? s : s.name;
                      return (
                        <span key={`${nm}-${idx}`} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {nm}
                        </span>
                      );
                    })}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
