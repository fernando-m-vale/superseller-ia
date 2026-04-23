'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getApiBaseUrl } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInvalid, setTokenInvalid] = useState(false);

  useEffect(() => {
    if (!token) setTokenInvalid(true);
  }, [token]);

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 6;
  const canSubmit = token && password.length >= 6 && password === confirm && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const r = await fetch(`${getApiBaseUrl()}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.error === 'token_invalid') {
          setTokenInvalid(true);
          return;
        }
        setError(data.message ?? 'Erro ao redefinir senha. Tente novamente.');
        return;
      }
      // Success — redirect to login with message
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth:reason', 'password_reset_success');
      }
      router.push('/login');
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (tokenInvalid) {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl">⏰</div>
        <p className="font-semibold text-gray-800">Este link expirou ou é inválido</p>
        <p className="text-sm text-gray-500">
          Links de redefinição são válidos por 1 hora e podem ser usados apenas uma vez.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block text-sm text-primary hover:underline font-medium"
        >
          Solicitar novo link →
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">Digite e confirme sua nova senha.</p>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">Nova senha</label>
        <Input
          id="password"
          type="password"
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          required
        />
        {tooShort && (
          <p className="text-xs text-red-600">A senha deve ter pelo menos 6 caracteres.</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm" className="text-sm font-medium">Confirmar nova senha</label>
        <Input
          id="confirm"
          type="password"
          placeholder="Repita a senha"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={loading}
          required
        />
        {mismatch && (
          <p className="text-xs text-red-600">As senhas não coincidem.</p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {loading ? 'Salvando...' : 'Redefinir senha'}
      </Button>

      <div className="text-center text-sm">
        <Link href="/login" className="text-gray-500 hover:text-foreground">
          ← Voltar para o login
        </Link>
      </div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Super Seller IA</CardTitle>
          <CardDescription className="text-center">Redefinição de senha</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <ResetPasswordContent />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
