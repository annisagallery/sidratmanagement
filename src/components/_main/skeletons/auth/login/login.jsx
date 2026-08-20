// Two labelled fields (phone-or-email, password) and the submit button — the
// remember-me row and footer link the old skeleton drew no longer exist.
export default function Login() {
  return (
    <>
      <div className="space-y-1">
        <div className="h-3 w-24 bg-slate-200 rounded animate-pulse" />
        <div className="h-10 bg-slate-200 rounded-md animate-pulse" />
      </div>
      <div className="space-y-1">
        <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
        <div className="h-10 bg-slate-200 rounded-md animate-pulse" />
      </div>
      <div className="h-10 bg-slate-200 rounded-md animate-pulse" />
    </>
  );
}
