import { GoogleSignInButton } from "~/components/GoogleSignInButton";
import { auth } from "~/server/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-6 shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Get started with ThinkHub
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <GoogleSignInButton className="w-full" />
        </div>
      </div>
    </div>
  );
} 