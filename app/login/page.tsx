"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { LogIn } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push("/");
        } catch (error: any) {
            console.error("Erro ao fazer login:", error);

            // Mensagens de erro em português
            if (error.code === "auth/invalid-credential") {
                setError("Email ou senha incorretos.");
            } else if (error.code === "auth/user-not-found") {
                setError("Usuário não encontrado.");
            } else if (error.code === "auth/wrong-password") {
                setError("Senha incorreta.");
            } else if (error.code === "auth/invalid-email") {
                setError("Email inválido.");
            } else if (error.code === "auth/too-many-requests") {
                setError("Muitas tentativas. Tente novamente mais tarde.");
            } else {
                setError("Erro ao fazer login. Tente novamente.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-purple-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                            <LogIn className="h-8 w-8 text-blue-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">
                            Bem-vindo de volta!
                        </h1>
                        <p className="text-slate-600">
                            Faça login para acessar seu controle financeiro
                        </p>
                    </div>

                    {/* Formulário */}
                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Email */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="seu@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>

                        {/* Senha */}
                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>

                        {/* Mensagem de Erro */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}

                        {/* Botão de Login */}
                        <Button
                            type="submit"
                            className="w-full"
                            size="lg"
                            disabled={loading}
                        >
                            {loading ? "Entrando..." : "Entrar"}
                        </Button>
                    </form>

                    {/* Link para Registro */}
                    <div className="mt-6 text-center">
                        <p className="text-sm text-slate-600">
                            Não tem uma conta?{" "}
                            <Link
                                href="/register"
                                className="text-blue-600 hover:text-blue-700 font-semibold"
                            >
                                Criar conta
                            </Link>
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <p className="text-sm text-slate-500">
                        💰 Controle Financeiro Familiar
                    </p>
                </div>
            </div>
        </main>
    );
}
