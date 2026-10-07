import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { HardDrive, GitMerge, Mail, Shield, Clock, LayoutDashboard, Sparkles } from "lucide-react";

export default function Landing() {
  const navigate = useNavigate();
  const { demoLogin } = useAuth();
  const [demoLoading, setDemoLoading] = React.useState(false);

  const tryDemo = async () => {
    setDemoLoading(true);
    try {
      await demoLogin();
      toast.success("Masuk sebagai Demo");
      navigate("/dashboard");
    } catch {
      toast.error("Gagal memuat demo");
    } finally {
      setDemoLoading(false);
    }
  };
  const features = [
    { icon: GitMerge, title: "Workflow Dinamis", desc: "Rancang stage custom per project: Drafter → Koordinator → Submit BIG." },
    { icon: Clock, title: "Stage Timer Auto-Reset", desc: "Lama data di tiap stage dihitung otomatis, reset saat lanjut." },
    { icon: Mail, title: "Email Terintegrasi", desc: "Invite personil & notifikasi tugas langsung ke email mereka." },
    { icon: HardDrive, title: "Google Drive Database", desc: "Setiap project terhubung folder Drive bersama untuk deliverable." },
    { icon: Shield, title: "Role-Based Access", desc: "Personil hanya melihat project yang mereka kerjakan." },
    { icon: LayoutDashboard, title: "Dashboard Progress", desc: "Statistik real-time: distribusi stage, bottleneck, deliverable." },
  ];
  return (
    <div className="min-h-screen bg-background accent-glow">
      <header className="px-6 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5" data-testid="landing-brand">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center">
            <HardDrive className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="font-bold tracking-tight" style={{ fontFamily: "Plus Jakarta Sans" }}>WorkflowDrive</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Project OS</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate("/login")} data-testid="landing-login-btn">Masuk</Button>
          <Button
            onClick={() => navigate("/register")}
            className="bg-indigo-500 hover:bg-indigo-600"
            data-testid="landing-register-btn"
          >
            Mulai Gratis
          </Button>
        </div>
      </header>
      <section className="max-w-7xl mx-auto px-6 pt-12 pb-20 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 space-y-6">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Project Management untuk Tim Spasial
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]" style={{ fontFamily: "Plus Jakarta Sans" }}>
            Project. Workflow. <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">Drive.</span>
            <br />Satu tempat untuk semuanya.
          </h1>
          <p className="text-base text-muted-foreground max-w-xl leading-relaxed">
            Kelola project multi-tim dengan workflow stage custom, timer otomatis, deliverable ke Google Drive, dan notifikasi email —
            personil hanya melihat tugas mereka.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              size="lg"
              className="bg-indigo-500 hover:bg-indigo-600 text-base px-6"
              onClick={tryDemo}
              disabled={demoLoading}
              data-testid="landing-demo-btn"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {demoLoading ? "Memuat..." : "Coba Instan (Demo)"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-border text-base px-6"
              onClick={() => navigate("/register")}
              data-testid="landing-cta-btn"
            >
              Buat Akun
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="text-base px-4"
              onClick={() => navigate("/login")}
              data-testid="landing-login-cta-btn"
            >
              Sudah punya akun? Masuk
            </Button>
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-indigo-500/10 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 h-40 w-40 bg-indigo-500/20 rounded-full blur-3xl" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">Peta Topografi #42</div>
                <span className="timer-pill">02j 15m</span>
              </div>
              <div className="font-semibold">Verifikasi kontur zona 7</div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] flex items-center justify-center font-bold">BD</div>
                <div className="text-xs text-muted-foreground">Budi Darmawan · Drafter</div>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                {["Drafter", "Koordinator", "Submit BIG"].map((s, i) => (
                  <div key={s} className={`text-xs text-center py-2 rounded-md border ${i === 0 ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200" : "border-border text-muted-foreground"}`}>
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8" style={{ fontFamily: "Plus Jakarta Sans" }}>
          Dibangun untuk tim yang bergerak cepat
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="group p-6 rounded-xl border border-border bg-card hover:border-indigo-500/40 transition-colors">
                <Icon className="h-6 w-6 text-indigo-400 mb-4" />
                <div className="font-semibold mb-1">{f.title}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">{f.desc}</div>
              </div>
            );
          })}
        </div>
      </section>
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        WorkflowDrive · MVP dengan Google Drive & SendGrid mocked
      </footer>
    </div>
  );
}
