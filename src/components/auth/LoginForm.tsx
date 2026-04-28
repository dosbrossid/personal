'use client'

import { useState } from 'react'
import { ArrowRight, Loader2, Lock, Mail, ShieldCheck, Sparkles, User } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { loginAction, signupAction } from '@/actions/auth.actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type AuthMode = 'login' | 'signup'

interface LoginFormProps {
  initialMode: AuthMode
  redirectTo: string
}

export function LoginForm({ initialMode, redirectTo }: LoginFormProps) {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)

    try {
      if (mode === 'login') {
        const result = await loginAction(formData)

        if (result.error) {
          toast.error(result.error)
          return
        }

        toast.success('Berhasil masuk.')
        router.push(redirectTo)
        router.refresh()
        return
      }

      const result = await signupAction(formData)

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success('Akun berhasil dibuat. Cek email untuk verifikasi.')
      setMode('login')
    } catch {
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden border-r border-border/70 bg-gradient-to-br from-primary/12 via-background to-cyan-500/10 lg:block">
        <div className="absolute inset-0 bg-dot-grid opacity-50" />
        <div className="relative flex h-full flex-col justify-between px-12 py-14">
          <div>
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles className="h-7 w-7" />
            </div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-primary">
              SecondBrain
            </p>
            <h1 className="max-w-xl text-4xl font-bold tracking-tight text-foreground">
              Satu dashboard untuk kerja, ide, jadwal, dan eksekusi harian.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Masuk untuk membuka semua modul personal dashboard Anda. Session dijaga lewat
              Supabase Auth, dan setelah login Anda akan kembali ke halaman internal yang tadi
              ingin dibuka.
            </p>
          </div>

          <div className="space-y-4 rounded-3xl border border-border/70 bg-card/85 p-6 shadow-xl shadow-slate-900/6 backdrop-blur">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Aturan login</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
                  <li>Hanya route dashboard yang butuh autentikasi.</li>
                  <li>Setelah login, redirect hanya boleh ke route internal yang aman.</li>
                  <li>Email yang belum terverifikasi tidak akan bisa lanjut masuk.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-10">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 lg:hidden">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles className="h-7 w-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Masuk ke SecondBrain</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Session Anda aman, dan redirect setelah login hanya diarahkan ke halaman internal.
            </p>
          </div>

          <div className="rounded-3xl border border-border/70 bg-card p-7 shadow-2xl shadow-slate-900/8">
            <div className="mb-6">
              <p className="text-sm font-medium text-primary">
                {mode === 'login' ? 'Autentikasi akun' : 'Registrasi akun baru'}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                {mode === 'login' ? 'Masuk ke dashboard Anda' : 'Buat akun untuk mulai'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {mode === 'login'
                  ? 'Gunakan email yang sudah terdaftar untuk mengakses semua modul.'
                  : 'Isi data berikut. Setelah itu Anda perlu verifikasi email sebelum login.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    <Input
                      type="text"
                      name="full_name"
                      placeholder="Z A Maula"
                      required
                      className="h-11 border-border/70 bg-secondary/50 pl-10 text-foreground placeholder:text-muted-foreground/40"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    type="email"
                    name="email"
                    placeholder="email@universitas.ac.id"
                    required
                    className="h-11 border-border/70 bg-secondary/50 pl-10 text-foreground placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="h-11 border-border/70 bg-secondary/50 pl-10 text-foreground placeholder:text-muted-foreground/40"
                  />
                </div>
                {mode === 'login' ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Jika email belum diverifikasi, login akan ditolak sampai verifikasi selesai.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Minimal 6 karakter. Gunakan password yang unik untuk akun ini.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="h-11 w-full bg-primary font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {mode === 'login' ? 'Masuk' : 'Daftar'}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 border-t border-border/70 pt-5 text-sm text-muted-foreground">
              {mode === 'login' ? (
                <p>
                  Belum punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Daftar sekarang
                  </button>
                </p>
              ) : (
                <p>
                  Sudah punya akun?{' '}
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Masuk
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
