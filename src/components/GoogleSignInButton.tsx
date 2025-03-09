"use client";

import { signIn } from "next-auth/react";
import { Button } from "~/components/ui/button";
import { FcGoogle } from "react-icons/fc";

interface GoogleSignInButtonProps {
  className?: string;
}

export function GoogleSignInButton({ className }: GoogleSignInButtonProps) {
  return (
    <Button
      variant="outline"
      type="button"
      className={`w-full ${className}`}
      onClick={() => signIn("google", { callbackUrl: "/" })}
    >
      <FcGoogle className="mr-2 h-4 w-4" />
      Continue with Google
    </Button>
  );
} 