"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock as LockIcon, Mail, Phone, User } from "lucide-react"; 

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import axios, { AxiosError } from "axios"; 
import { ensureCsrfToken } from "@/lib/axios"; 

import { Loading } from "@/components/loading";
import { PasswordResetForm } from "./password-reset-form";
import NProgress from "nprogress";
import { motion, HTMLMotionProps, Variants } from "framer-motion";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/client";
import { CSRF_HEADER } from "@/lib/security/csrf-constants";
import { logger } from "@/lib/logger";

interface LoginFormProps extends HTMLMotionProps<"div"> {
  className?: string;
  // csrfToken prop removed - token is read directly from cookie via ensureCsrfToken()
}

interface ErrorResponse {
  message: string;
}

const loginMethodProps = {
  username: {
    label: "Username",
    type: "text",
    placeholder: "academic_weapon_fr",
  },
  email: {
    label: "Email",
    type: "email",
    placeholder: "cooked@attendance.edu",
  },
  phone: {
    label: "Phone",
    type: "tel",
    placeholder: "919234567890",
  },
};

const PASSWORD_VALIDATION = {
  MIN_LENGTH: 6,  // Conservative (most systems use 6-8)
  MAX_LENGTH: 128, // Prevent DOS attacks
} as const;

const validatePassword = (password: string): string | null => {
  // 1. Check empty
  if (!password || password.trim().length === 0) {
    return "Password is required";
  }
  
  // 2. Check minimum length
  if (password.length < PASSWORD_VALIDATION.MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_VALIDATION.MIN_LENGTH} characters`;
  }
  
  // 3. Check maximum length (prevent DOS)
  if (password.length > PASSWORD_VALIDATION.MAX_LENGTH) {
    return `Password must be less than ${PASSWORD_VALIDATION.MAX_LENGTH} characters`;
  }
  
  return null; // Valid
};

export function LoginForm({ className, ...props }: LoginFormProps) {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordResetForm, setShowPasswordResetForm] = useState(false);
  const [loginMethod, setLoginMethod] = useState<
    "username" | "email" | "phone"
  >("username");
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    stay_logged_in: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    
    // Update form data
    setFormData({ ...formData, password });
    
    // Real-time validation
    if (password.length > 0 && password.length < PASSWORD_VALIDATION.MIN_LENGTH) {
      setPasswordError(`At least ${PASSWORD_VALIDATION.MIN_LENGTH} characters required`);
    } else if (password.length > PASSWORD_VALIDATION.MAX_LENGTH) {
      setPasswordError(`No more than ${PASSWORD_VALIDATION.MAX_LENGTH} characters allowed`);
    } else {
      setPasswordError(null);
    }
  };

  // Fetch CSRF token on component mount
  useEffect(() => {
    const initCsrf = async () => {
      try {
        // Call the /api/csrf/init endpoint to initialize the CSRF token cookie
        // This is necessary because Next.js 15 forbids cookie mutations in Server Components
        await fetch("/api/csrf/init");
        // Token is now set in cookie and can be read by ensureCsrfToken()
      } catch (error) {
        // Log error but don't block the form - the token will be checked on submission
        logger.error("Failed to initialize CSRF token:", error);
      }
    };
    initCsrf();
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const checkUser = async () => {
      const supabase = createClient();
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (user && isMounted) {
          router.push("/dashboard");
          return;
        }
      } finally {
        if (isMounted) {
          setIsLoadingPage(false);
        }
      }
    };
    checkUser();
    
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    NProgress.start();

    try {
      const passwordError = validatePassword(formData.password);
      if (passwordError) {
        setError(passwordError);
        setIsLoading(false);
        NProgress.done();
        return;
      }

      // 1. Login to Ezygo (public endpoint - exempt from CSRF, listed in PUBLIC_PATHS)
      const response = await axios.post("/api/backend/login", formData);
      const token = response.data.access_token;

      if (!token) throw new Error("Invalid response from server");

      // 2. Securely Save Token (Bridge to GhostClass) - requires CSRF token
      // Use centralized CSRF token helper to avoid duplicate logic
      const csrfToken = ensureCsrfToken();
      
      await axios.post("/api/auth/save-token", 
        { token }, 
        { 
          headers: csrfToken ? { [CSRF_HEADER]: csrfToken } : {}
        }
      );

      // 3. Success
      router.push("/dashboard");

    } catch (error) {
      const err = error as AxiosError<ErrorResponse>;
      NProgress.done();
      setIsLoading(false);
      
      let errorMsg = "An unexpected error occurred";

      if (err.config?.url?.includes("save-token")) {
         // This is a critical failure in OUR backend bridge
         errorMsg = "Secure session setup failed. Please try again.";
         Sentry.captureException(error, { tags: { type: "auth_bridge_client_error", location: "LoginForm/handleSubmit" } });
      } else if (err.response?.status === 401) {
         // User error (wrong password) - No Sentry needed
         errorMsg = "Invalid credentials. Please check your password.";
      } else if (err.response?.data?.message) {
         errorMsg = err.response.data.message;
      } else if (err.code === "ERR_NETWORK") {
         errorMsg = "Network error. Please check your connection.";
      }

      setError(errorMsg);
      // Announce error to screen readers
      if (typeof window !== 'undefined') {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'alert');
        announcement.setAttribute('aria-live', 'assertive');
        announcement.className = 'sr-only';
        announcement.textContent = errorMsg;
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 5000);
      }
      logger.error("Login failed:", err);
    }
  };

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { when: "beforeChildren", staggerChildren: 0.1, duration: 0.3 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.3 } },
  };

  const logoVariants : Variants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: {
      scale: 1,
      opacity: 1,
      transition: { type: "spring", stiffness: 400, damping: 10, duration: 0.6 },
    },
  };

  if (isLoadingPage) return <Loading />;

  if (showPasswordResetForm) {
    return (
      <PasswordResetForm
        className={className}
        onCancel={() => setShowPasswordResetForm(false)}
      />
    );
  }

  return (
    <motion.div
      className={cn("flex flex-col gap-3", className)}
      {...props}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          
          {/* Logo Section */}
          <motion.div
            className="flex flex-col items-center gap-1.5 -mt-8 sm:-mt-10" 
            variants={logoVariants}
          >
            <div className="flex justify-center items-center flex-col">
              <div className="relative w-[340px] h-[120px] sm:w-[520px] sm:h-[180px] overflow-hidden"> 
                <Image 
                  src="/logo.png" 
                  alt="GhostClass Logo"
                  fill
                  className="object-contain object-bottom transition-transform group-hover:scale-105" 
                  priority
                  placeholder="blur"
                  blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAACXBIWXMAAAsTAAALEwEAmpwYAAAC4klEQVR4nO2T3U9SYRzHj5lNXV3IhVFic+vCaTdNL1ytorZmta66OK3sguUFqa14OxxejvCggBw4HOAIIgd8wUilo6IiCgoJCALlarrZvO8foR0Tx5xrXbW1+dk+F8/z3Z7fnu37g6Azzvj/4PPB+dbWvovNzd2X2tuFVVARqigWixUQKwSxlnOYFU/PTqXi0SvDFYFo9H6vyv9AbWAaAADnWCFWiH2o5MkBJz1loIDPr1Zphu+S3iWCDibJ6UjmoSUyyQULXh5gXFyaBrXsMIZhKhmGrCEZkqNm/A1gIcADPh+HpumqIlSs+G3ZAPbACvoQrs8zK1yM5bPx/MFWOLOrVM5EXr71r4hEvvAbhA53qp3RNqUr0oG6Q0/QiZBAMrUsFvuXJDJ66YXCFb6jtkXb1PbITWBfbAJ0uPbwmwwMV+ZIuMZvs91g5mNYonDwNffj5+e5xHdSQcXGRGRqR2xJ51FTmsGM26PKoeyYHE+GFGQio6TW9xS29T2FObmhNub9/frCKDBkHXo8LTDZo02QAExWS/UTjXYTcS9gt3YzHxnncvzL6lpun5oMbr3T6qJOlWZzR6VJ7Wq0qW2dNpPSaTJprD9Z0GjjuwO62L5Ou76vxZLfBrFCVo/lt4a0uTVCl1bZByMtEDDPXDUSgecW44hz2GCb9TrcwfHxT57x6fBrl32ug1AsPDXLl0Q4EkbM8hUZodiQmeUxGY6EpWbZvMwmXUBISUhuka6iFmkCtSKbqB2Nv3dh8ccuEOFClJ6+Tg15xfiAO2jQUAETcOA2wtNjxenbBHDX+wDJoQDFG8GsjV6A80ak1kYvSvG8KM6jUIpnlY40OhSOa6z0kWzuk5AcAMAF6IOMqKcxWyehdAoQifOZCPHc6senWlTGmcsATFazFSxV9VjoyJP3ZflxTWmhsMrdpawjekB9b5eyDobJGhgGF2CYqSwtUKnrx5aqePK+LP/T4v31Vp5xxr/hF2eVnXJoHTJgAAAAAElFTkSuQmCC"
                  sizes="(max-width: 640px) 340px, 520px"
                />
              </div>
            </div>
            
            <p className="text-center text-sm font-medium max-w-[322px] text-muted-foreground/80 -mt-2"> 
              {"Drop your ezygo credentials - we're just the aesthetic upgrade you deserved."}
            </p>
          </motion.div>

          {/* Input Section */}
          <div className="flex flex-col gap-4 mt-2"> 
            <motion.div className="grid gap-2" variants={itemVariants}>
              <div className="flex items-center justify-between">
                <Label htmlFor="login">
                  {loginMethodProps[loginMethod].label}
                </Label>
                <div className="flex gap-1">
                  {(["username", "email", "phone"] as const).map((method) => (
                    <Button
                      key={method}
                      type="button"
                      size="icon"
                      variant={loginMethod === method ? "secondary" : "ghost"}
                      className="h-6 w-6 p-3"
                      onClick={() => setLoginMethod(method)}
                      aria-label={method === "username" ? "Login with username" : method === "email" ? "Login with email" : "Login with phone"}
                    >
                      {method === "username" && <User className="h-4 w-4" aria-hidden="true" />}
                      {method === "email" && <Mail className="h-4 w-4" aria-hidden="true" />}
                      {method === "phone" && <Phone className="h-4 w-4" aria-hidden="true" />}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <Input
                  id="login"
                  type={loginMethodProps[loginMethod].type}
                  value={formData.username}
                  className="custom-input bg-secondary/10 border-white/10 focus:border-purple-500/50 transition-colors"
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder={loginMethodProps[loginMethod].placeholder}
                  name={loginMethodProps[loginMethod].label.toLowerCase()}
                  required
                />
              </div>
            </motion.div>

            <motion.div className="grid gap-2" variants={itemVariants}>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowPasswordResetForm(true)}
                  className="text-[13px] text-muted-foreground hover:text-primary duration-100 font-medium"
                  aria-label="Forgot password"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  value={formData.password}
                  className={cn(
                    "custom-input bg-secondary/10 border-white/10 focus:border-purple-500/50 transition-colors",
                    passwordError && "border-red-500/50 focus:border-red-500"
                  )}
                  onChange={handlePasswordChange}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? "password-error" : undefined}
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent mr-1.5"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 opacity-70" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5 opacity-70" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </motion.div>

            {passwordError && (
                  <p id="password-error" className="text-xs text-red-400 mt-1">
                    {passwordError}
                  </p>
            )}

            <motion.div variants={itemVariants}>
              <Button
                type="submit"
                className="w-full font-semibold min-h-[46px] rounded-[12px] mt-2 font-sm shadow-sm hover:shadow-md transition-all"
                disabled={isLoading || !!passwordError}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </motion.div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center text-sm text-red-400 border rounded-lg bg-red-500/10 border-red-500/20 p-2"
              >
                {error}
              </motion.div>
            )}
          </div>
        </div>

        {/* Disclaimer Section */}
        <div className="mt-6 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-3">
            <LockIcon className="h-3 w-3 text-purple-400" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-purple-300/80">
              Ghosts don&apos;t snoop 😁
            </span>
          </div>
          
          <p className="text-xs text-muted-foreground/80 max-w-[320px] leading-relaxed text-center italic">
            Your <span className="text-foreground font-medium">EzyGo</span> password is safe. 
            We strictly <span className="text-foreground font-medium">do not read, store, or share</span> your login password. 
            GhostClass is just here to help you skip. 👻
          </p>
        </div>
      </form>
    </motion.div>
  );
}