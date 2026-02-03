import { Footer } from "@/components/layout/footer";
import { LoginForm } from "@/components/user/login-form";

export default async function LoginPage() {
  return (
    <>
      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-sm">
          <LoginForm />
        </div>
      </div>

      {/* Footer */}
      <Footer className="mt-0 py-4 border-t-0 bg-transparent" />
    </>
  );
}