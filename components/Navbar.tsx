"use client";

import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
    Home,
    CreditCard,
    LogOut,
    User,
    Menu,
    X,
} from "lucide-react";
import { useState } from "react";

export function Navbar() {
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/login");
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
        }
    };

    // Não exibir navbar nas páginas de login e registro
    if (pathname === "/login" || pathname === "/register") {
        return null;
    }

    return (
        <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-2">
                        <div className="text-2xl">💰</div>
                        <span className="font-bold text-slate-900 text-lg hidden sm:block">
                            Controle Financeiro
                        </span>
                    </Link>

                    {/* Menu Desktop */}
                    {user && (
                        <div className="hidden md:flex items-center gap-6">
                            <Link
                                href="/"
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${pathname === "/"
                                    ? "bg-blue-50 text-blue-700 font-semibold"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                            >
                                <Home className="h-4 w-4" />
                                Início
                            </Link>

                            <Link
                                href="/dashboard"
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${pathname === "/dashboard"
                                    ? "bg-blue-50 text-blue-700 font-semibold"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                            >
                                <Home className="h-4 w-4" />
                                Dashboard
                            </Link>

                            <Link
                                href="/cards"
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${pathname === "/cards"
                                    ? "bg-blue-50 text-blue-700 font-semibold"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                            >
                                <CreditCard className="h-4 w-4" />
                                Cartões
                            </Link>

                            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate-200">
                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                    <User className="h-4 w-4" />
                                    <span className="hidden lg:block">{user.email}</span>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLogout}
                                    className="gap-2"
                                >
                                    <LogOut className="h-4 w-4" />
                                    Sair
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Botão Menu Mobile */}
                    {user && (
                        <button
                            className="md:hidden p-2 rounded-lg hover:bg-slate-100"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? (
                                <X className="h-6 w-6 text-slate-600" />
                            ) : (
                                <Menu className="h-6 w-6 text-slate-600" />
                            )}
                        </button>
                    )}

                    {/* Botões de Login/Registro (quando não logado) */}
                    {!user && (
                        <div className="flex items-center gap-3">
                            <Link href="/login">
                                <Button variant="ghost" size="sm">
                                    Entrar
                                </Button>
                            </Link>
                            <Link href="/register">
                                <Button size="sm">Criar Conta</Button>
                            </Link>
                        </div>
                    )}
                </div>

                {/* Menu Mobile */}
                {user && mobileMenuOpen && (
                    <div className="md:hidden py-4 border-t border-slate-200">
                        <div className="flex flex-col gap-2">
                            <Link
                                href="/"
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${pathname === "/"
                                        ? "bg-blue-50 text-blue-700 font-semibold"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                            >
                                <Home className="h-4 w-4" />
                                Início
                            </Link>

                            <Link
                                href="/dashboard"
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${pathname === "/dashboard"
                                        ? "bg-blue-50 text-blue-700 font-semibold"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                            >
                                <Home className="h-4 w-4" />
                                Dashboard
                            </Link>

                            <Link
                                href="/cards"
                                onClick={() => setMobileMenuOpen(false)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${pathname === "/cards"
                                        ? "bg-blue-50 text-blue-700 font-semibold"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                                    }`}
                            >
                                <CreditCard className="h-4 w-4" />
                                Cartões
                            </Link>

                            <div className="border-t border-slate-200 mt-2 pt-2">
                                <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600">
                                    <User className="h-4 w-4" />
                                    {user.email}
                                </div>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleLogout}
                                    className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                    <LogOut className="h-4 w-4" />
                                    Sair
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
