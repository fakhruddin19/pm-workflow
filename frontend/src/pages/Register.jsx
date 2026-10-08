import React, { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { toast } from "sonner";
import { HardDrive } from "lucide-react";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password minimal 6 karakter");
      return;
    }
    setLoading(true);
    try {
      await register(email, password, name);
      toast.success("Akun berhasil dibuat");
      const dest = location.state?.from?.pathname || "/dashboard";
      navigate(dest, { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Pendaftaran gagal");
    } finally {
      setLoading(false);
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
            <CardTitle className="text-2xl" style={{ fontFamily: "Plus Jakarta Sans" }}>Buat akun baru</CardTitle>
            <CardDescription>Mulai kelola project dalam hitungan detik.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Budi Darmawan"
                data-testid="register-name-input"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                data-testid="register-email-input"
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
                placeholder="min. 6 karakter"
                data-testid="register-password-input"
                className="bg-background"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-500 hover:bg-indigo-600"
              data-testid="register-submit-btn"
            >
              {loading ? "Memproses..." : "Daftar"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Sudah punya akun?{" "}
              <Link to="/login" state={{ from: location.state?.from }} className="text-indigo-400 hover:text-indigo-300 font-medium" data-testid="go-to-login-link">
                Masuk
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
