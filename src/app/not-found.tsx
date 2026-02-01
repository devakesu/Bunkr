import { PublicNavbar } from "@/components/layout/public-navbar";
import { Footer } from "@/components/layout/footer";
import { NotFoundContent } from "@/components/not-found-content";

// Force dynamic rendering since we use client components
export const dynamic = 'force-dynamic';

/**
 * Custom 404 Not Found Page
 * Displayed when a user navigates to a non-existent route
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNavbar />
      
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <NotFoundContent />
      </main>

      <Footer />
    </div>
  );
}
