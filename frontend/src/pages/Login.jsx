import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { HardDrive, Sparkles } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, demoLogin } = useAuth();

  const searchParams = new URLSearchParams(location.search || location.state?.from?.search || "");
  const inviteEmail = searchParams.get("invite") || searchParams.get("email") || "";

  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Berhasil masuk");
      const dest = (location.state?.from?.pathname || "/dashboard") + (location.state?.from?.search || "");
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  const onDemo = async () => {
    setDemoLoading(true);
    try {
      await demoLogin();
      toast.success("Masuk sebagai Demo. Project contoh sudah tersedia.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal masuk sebagai demo");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background accent-glow">
      <Card className="w-full max-w-md bg-card border-border">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center">
              <HardDrive className="h-4 w-4 text-white" />
            </div>
            <div className="font-bold" style={{ fontFamily: "Plus Jakarta Sans" }}>WorkflowDrive</div>
          </div>
          <div>
            <CardTitle className="text-2xl" style={{ fontFamily: "Plus Jakarta Sans" }}>Masuk ke akun Anda</CardTitle>
            <CardDescription>Kelola project, workflow, dan deliverable tim.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                data-testid="email-input"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                data-testid="password-input"
                className="bg-background"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-500 hover:bg-indigo-600"
              data-testid="login-submit-btn"
            >
              {loading ? "Memproses..." : "Masuk"}
            </Button>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  atau
                </span>
              </div>
            </div>
            <Button
              type="button"
              onClick={onDemo}
              disabled={demoLoading}
              variant="outline"
              className="w-full border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 hover:text-emerald-100"
              data-testid="demo-login-btn"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {demoLoading ? "Memuat demo..." : "Masuk Sebagai Demo (tanpa daftar)"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Belum punya akun?{" "}
              <Link to="/register" state={{ from: location.state?.from }} className="text-indigo-400 hover:text-indigo-300 font-medium" data-testid="go-to-register-link">
                Daftar
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
