"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock as LockIcon, Mail, Phone, User } from "lucide-react"; 

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import ezygoClient from "@/lib/axios"; 
import axios, { AxiosError } from "axios"; 
import { setToken, getToken } from "@/lib/auth";

import { Loading } from "@/components/loading";
import { PasswordResetForm } from "./password-reset-form";

import { motion, HTMLMotionProps } from "framer-motion";

interface LoginFormProps extends HTMLMotionProps<"div"> {
  className?: string;
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

  useEffect(() => {
    const token = getToken();
    if (token) {
      router.push("/dashboard");
    } else {
      setIsLoadingPage(false);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 1. Login to Ezygo
      const response = await ezygoClient.post("/login", formData);
      const token = response.data.access_token;

      if (!token) throw new Error("Invalid response from server");

      // 2. Securely Save Token
      await axios.post("/api/auth/save-token", { token });

      // 3. Success
      setToken(token);
      router.push("/dashboard");

    } catch (error) {
      const err = error as AxiosError<ErrorResponse>;
      
      if (err.config?.url?.includes("save-token")) {
         setError("Secure session setup failed. Please try again.");
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("An unexpected error occurred");
      }
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
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

  const logoVariants = {
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
      className={cn("flex flex-col gap-6", className)}
      {...props}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <form onSubmit={handleSubmit}>
        <div className="flex flex-col gap-6">
          
          {/* Logo Section */}
          <motion.div
            className="flex flex-col items-center gap-2.5"
            variants={logoVariants}
          >
            <div className="flex justify-center items-center flex-col gap-2.5">
              {/* Responsive Logo Sizing */}
              <div className="relative w-64 h-32 sm:w-80 sm:h-40 overflow-hidden">
                <Image 
                  src="/logo.png" 
                  alt="GhostClass Logo"
                  fill
                  className="object-contain transition-transform group-hover:scale-110"
                  priority
                  sizes="(max-width: 640px) 256px, 320px"
                />
              </div>
            </div>
            <p className="text-center text-sm font-medium max-w-[322px] text-muted-foreground/80">
              {"Drop your ezygo credentials - we're just the aesthetic upgrade you deserved."}
            </p>
          </motion.div>

          <div className="flex flex-col gap-5 pt-2 mt-1">
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
                    >
                      {method === "username" && <User className="h-4 w-4" />}
                      {method === "email" && <Mail className="h-4 w-4" />}
                      {method === "phone" && <Phone className="h-4 w-4" />}
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

            <motion.div className="grid gap-2.5" variants={itemVariants}>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => setShowPasswordResetForm(true)}
                  className="text-[13px] text-muted-foreground hover:text-primary duration-100 font-medium"
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
                  className="custom-input bg-secondary/10 border-white/10 focus:border-purple-500/50 transition-colors"
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent mr-1.5"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 opacity-70" />
                  ) : (
                    <Eye className="h-5 w-5 opacity-70" />
                  )}
                </Button>
              </div>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Button
                type="submit"
                className="w-full font-semibold min-h-[46px] rounded-[12px] mt-4 font-sm shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 transition-all"
                disabled={isLoading}
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
                {"Ezygo: "}{error}
              </motion.div>
            )}
          </div>
        </div>

        {/* Disclaimer Section */}
        <div className="mt-8 flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-3">
            <LockIcon className="h-3 w-3 text-purple-400" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-purple-300/80">
              Ghosts don't snoop 😁
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