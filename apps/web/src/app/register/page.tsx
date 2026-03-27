'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { register as registerUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, Zap, TrendingUp, Shield } from 'lucide-react';

const registerSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  tenantName: z.string().min(1, 'Nome da loja é obrigatório'),
});

type RegisterFormData = z.infer<typeof registerSchema>;

const BENEFITS = [
  { icon: Zap, text: '14 dias grátis do plano Pro — sem cartão de crédito' },
  { icon: TrendingUp, text: 'Diagnóstico de IA para todos os seus anúncios' },
  { icon: CheckCircle, text: 'Recomendações personalizadas para aumentar vendas' },
  { icon: Shield, text: 'Cancele quando quiser, sem complicação' },
];

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite') ?? undefined;
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      await registerUser({
        email: data.email,
        password: data.password,
        tenantName: data.tenantName,
        inviteToken,
      });
      router.push('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left column — value props */}
        <div className="hidden lg:block">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium mb-6 dark:bg-green-950/40 dark:text-green-400">
            <Zap className="w-4 h-4" />
            Trial Pro · 14 dias grátis
          </div>
          <h1 className="text-3xl font-bold leading-tight mb-4">
            Veja o que está travando as suas vendas no Mercado Livre
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            A IA analisa seus anúncios e entrega um diagnóstico com ações concretas para você vender mais — em minutos.
          </p>
          <ul className="space-y-4">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-primary shrink-0" />
                <span className="text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right column — form */}
        <div className="bg-card border rounded-2xl p-8 shadow-sm">
          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-bold mb-1">Criar conta grátis</h2>
            <p className="text-sm text-muted-foreground">
              14 dias grátis do Pro · Sem cartão · Cancele quando quiser
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="tenantName" className="text-sm font-medium">
                Nome da loja
              </label>
              <Input
                id="tenantName"
                type="text"
                placeholder="Ex: Minha Loja Incrível"
                {...register('tenantName')}
                disabled={isLoading}
              />
              {errors.tenantName && (
                <p className="text-sm text-red-600">{errors.tenantName.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium">
                E-mail
              </label>
              <Input
                id="email"
                type="email"
                placeholder="voce@exemplo.com"
                {...register('email')}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium">
                Senha
              </label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                {...register('password')}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm dark:bg-red-950/40 dark:border-red-900 dark:text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
              {isLoading ? 'Criando conta...' : 'Criar conta e começar trial grátis →'}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Ao criar sua conta, você concorda com nossos{' '}
              <Link href="/terms" className="underline hover:text-foreground">Termos de Uso</Link>
              {' '}e{' '}
              <Link href="/privacy" className="underline hover:text-foreground">Política de Privacidade</Link>.
            </p>

            <div className="text-center text-sm text-muted-foreground pt-2">
              Já tem uma conta?{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Entrar
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
