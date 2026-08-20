import Login from './login';

// Mirrors the real sign-in card in src/components/forms/login.jsx — same
// full-screen slate backdrop, same card-ui shell, same max-w-sm width — so the
// route-loading state doesn't flash a differently shaped card before hydration.
export default function LoginSkeleton() {
  return (
    <div className="admin-root flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="card-ui w-full max-w-sm space-y-4 p-6">
        <div className="flex flex-col items-center gap-1 pb-2">
          <div className="h-12 w-12 rounded-md bg-slate-200 animate-pulse" />
          <div className="h-6 w-40 bg-slate-200 rounded-md animate-pulse" />
          <div className="h-4 w-52 bg-slate-200 rounded-md animate-pulse" />
        </div>
        <Login />
      </div>
    </div>
  );
}
