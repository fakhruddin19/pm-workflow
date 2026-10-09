import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { cn, initials } from "../lib/utils";
import {
  LayoutDashboard,
  FolderKanban,
  Inbox as InboxIcon,
  LogOut,
  HardDrive,
  Compass,
} from "lucide-react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Avatar, AvatarFallback } from "./ui/avatar";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, test: "nav-dashboard" },
  { to: "/projects", label: "Daftar Project", icon: FolderKanban, test: "nav-projects" },
  { to: "/inbox", label: "Inbox", icon: InboxIcon, test: "nav-inbox" },
];

export default function Layout({ children, title, subtitle, actions }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header
        className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/40 px-4 md:px-6 py-3 flex items-center justify-between"
        data-testid="app-header"
      >
        <Link to="/dashboard" className="flex items-center gap-2.5 group" data-testid="brand-link">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 via-sky-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
            <Compass className="h-4 w-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <div className="font-extrabold tracking-tight text-base leading-none bg-gradient-to-r from-white via-indigo-100 to-cyan-200 bg-clip-text text-transparent" style={{ fontFamily: "Plus Jakarta Sans" }}>
              GeoFlow
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
              Geospatial Project OS
            </div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                data-testid={item.test}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
                  active
                    ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-card"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-2 hover:bg-card rounded-md px-2 py-1 transition-colors"
                data-testid="user-profile-menu"
              >
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarFallback className="bg-indigo-500/20 text-indigo-200 text-xs">
                    {initials(user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium leading-tight">{user?.name}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">
                    {user?.email}
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border">
              <DropdownMenuLabel>Akun Saya</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} data-testid="logout-menu-item" className="text-rose-300 focus:text-rose-200">
                <LogOut className="h-4 w-4 mr-2" /> Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Mobile nav */}
      <nav className="md:hidden flex gap-1 px-4 py-2 border-b border-border/40 bg-card/40 overflow-x-auto">
        {navItems.map((item) => {
          const active = location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
                active ? "bg-indigo-500/10 text-indigo-300" : "text-muted-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8">
        {(title || actions) && (
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              {title && (
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="page-title">
                  {title}
                </h1>
              )}
              {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
            </div>
            {actions}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
