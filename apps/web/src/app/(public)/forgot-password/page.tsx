'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getApiBaseUrl } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await fetch(`${getApiBaseUrl()}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // ignore — always show success to avoid email enumeration
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Super Seller IA</CardTitle>
          <CardDescription className="text-center">Recuperação de senha</CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📧</div>
              <p className="text-sm text-gray-700">
                Se este email estiver cadastrado, você receberá o link de redefinição em instantes.
              </p>
              <p className="text-xs text-gray-500">Verifique também sua caixa de spam.</p>
              <Link href="/login" className="block text-sm text-primary hover:underline mt-4">
                ← Voltar para o login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-600">
                Digite seu email e enviaremos um link para redefinir sua senha.
              </p>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">Email</label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !email}>
                {loading ? 'Enviando...' : 'Enviar link de redefinição'}
              </Button>
              <div className="text-center text-sm">
                <Link href="/login" className="text-gray-500 hover:text-foreground">
                  ← Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
