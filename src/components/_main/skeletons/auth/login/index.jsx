import Login from './login';

export default function LoginSkeleton() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="bg-white rounded-md p-6 w-full max-w-md mx-4 shadow-sm">
        <div className="mb-6 space-y-2">
          <div className="h-7 w-40 bg-gray-200 rounded-md animate-pulse mx-auto" />
          <div className="h-4 w-56 bg-gray-200 rounded-md animate-pulse mx-auto" />
        </div>
        <Login />
      </div>
    </div>
  );
}
