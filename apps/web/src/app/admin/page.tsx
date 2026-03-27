'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiBaseUrl } from '@/lib/api';

type User = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  tenant: {
    id: string;
    name: string;
    plan: string;
    plan_status: string;
    trial_ends_at: string | null;
    trial_used: boolean;
    created_at: string;
  };
};

type WaitlistEntry = {
  id: number;
  email: string;
  store_name: string | null;
  gmv_range: string | null;
  marketplace: string | null;
  approved: boolean;
  approved_at: string | null;
  created_at: string;
  invites: Array<{ token: string; used: boolean; expires_at: string }>;
};

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'users' | 'waitlist'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<number | null>(null);

  const getToken = () => {
    if (typeof window !== 'undefined') return localStorage.getItem('admin_token');
    return null;
  };

  const authHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  });

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/admin/login'); return; }

    const fetchAll = async () => {
      try {
        const [usersRes, waitlistRes] = await Promise.all([
          fetch(`${getApiBaseUrl()}/admin/users`, { headers: authHeaders() }),
          fetch(`${getApiBaseUrl()}/admin/waitlist`, { headers: authHeaders() }),
        ]);
        if (usersRes.status === 401 || waitlistRes.status === 401) {
          router.push('/admin/login');
          return;
        }
        const usersData = await usersRes.json();
        const waitlistData = await waitlistRes.json();
        setUsers(usersData.users ?? []);
        setWaitlist(waitlistData.entries ?? []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const approveWaitlist = async (id: number) => {
    setApproving(id);
    try {
      const res = await fetch(`${getApiBaseUrl()}/admin/waitlist/${id}/approve`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Erro ao aprovar');
      setWaitlist((prev) =>
        prev.map((e) => (e.id === id ? { ...e, approved: true, approved_at: new Date().toISOString() } : e))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro');
    } finally {
      setApproving(null);
    }
  };

  const changePlan = async (tenantId: string, plan: 'free' | 'pro') => {
    try {
      await fetch(`${getApiBaseUrl()}/admin/users/${tenantId}/plan`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ plan }),
      });
      setUsers((prev) =>
        prev.map((u) => (u.tenant.id === tenantId ? { ...u, tenant: { ...u.tenant, plan } } : u))
      );
    } catch {
      alert('Erro ao alterar plano');
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold">Admin · SuperSeller IA</h1>
          <button
            onClick={() => { localStorage.removeItem('admin_token'); router.push('/admin/login'); }}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sair
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          {(['users', 'waitlist'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'users' ? `Usuários (${users.length})` : `Lista de espera (${waitlist.length})`}
            </button>
          ))}
        </div>

        {tab === 'users' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">E-mail</th>
                  <th className="text-left px-4 py-3 font-medium">Loja</th>
                  <th className="text-left px-4 py-3 font-medium">Plano</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Criado</th>
                  <th className="text-left px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3">{u.tenant.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        u.tenant.plan === 'pro' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {u.tenant.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{u.tenant.plan_status}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(u.tenant.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {u.tenant.plan === 'free' ? (
                          <button
                            onClick={() => changePlan(u.tenant.id, 'pro')}
                            className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                          >
                            → Pro
                          </button>
                        ) : (
                          <button
                            onClick={() => changePlan(u.tenant.id, 'free')}
                            className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
                          >
                            → Free
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'waitlist' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">E-mail</th>
                  <th className="text-left px-4 py-3 font-medium">Loja</th>
                  <th className="text-left px-4 py-3 font-medium">GMV</th>
                  <th className="text-left px-4 py-3 font-medium">Marketplace</th>
                  <th className="text-left px-4 py-3 font-medium">Criado</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {waitlist.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{e.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.store_name ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.gmv_range ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.marketplace ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      {e.approved ? (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Aprovado
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!e.approved && (
                        <button
                          onClick={() => approveWaitlist(e.id)}
                          disabled={approving === e.id}
                          className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-60"
                        >
                          {approving === e.id ? '...' : 'Aprovar + Convidar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
