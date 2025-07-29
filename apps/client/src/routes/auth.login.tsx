import { SignIn, useUser } from "@stackframe/stack";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/auth/login")({
  component: LoginComponent,
});

function LoginComponent() {
  const navigate = useNavigate();
  const user = useUser();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mb-4">
            <span className="bg-black dark:bg-blue-800 text-white px-4 py-2 rounded-lg text-lg font-medium">
              cmux
            </span>
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Sign in to your account
          </h2>
        </div>
        
        <SignIn 
          fullPage={false}
        />
      </div>
    </div>
  );
}