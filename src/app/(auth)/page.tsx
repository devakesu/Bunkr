import { Footer } from "@/components/layout/footer";
import { LoginForm } from "@/components/user/login-form";

export default async function LoginPage() {
  return (
    // 1. Single min-h-screen container
    <div className="flex min-h-screen flex-col bg-background">
      
      {/* 2. Main Content: Takes all available space, centers the form */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>
      </div>

      {/* 3. Footer: Compact styles passed via className */}
      <Footer className="mt-0 py-4 border-t-0 bg-transparent" />
    </div>
  );
}