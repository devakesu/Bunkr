"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { submitContactForm } from "@/app/actions/contact";
import Turnstile, { useTurnstile } from "react-turnstile";
import { Loader2, Send, AlertCircle } from "lucide-react";

interface ContactFormProps {
  userDetails?: {
    name?: string;
    email?: string;
  };
}

export function ContactForm({ userDetails }: ContactFormProps) {
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string>("");
  const [captchaError, setCaptchaError] = useState(false);
  
  const formRef = useRef<HTMLFormElement>(null);
  const turnstile = useTurnstile();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); 
    
    if (!token) {
        toast.error("Please complete the security check.");
        return;
    }

    setLoading(true);

    try {
        const formData = new FormData(e.currentTarget);
        formData.set("cf-turnstile-response", token);

        const result = await submitContactForm(formData);

        if (result.error) {
            toast.error(result.error);
            turnstile.reset();
            setToken(""); 
        } else {
            toast.success("Message sent successfully!");
            formRef.current?.reset();
            turnstile.reset();
            setToken(""); 
        }
    } catch (error) {
        console.error("Form Error:", error);
        toast.error("Something went wrong. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <form 
      ref={formRef} 
      onSubmit={handleSubmit}
      className="space-y-4 max-w-md mx-auto p-6 bg-card border rounded-xl shadow-sm"
    >
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={userDetails?.name || ""} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={userDetails?.email || ""} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" placeholder="How can we help?" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" name="message" className="min-h-[120px]" required />
      </div>

      <div className="flex flex-col items-center justify-center py-2 min-h-[65px]">
        {captchaError ? (
          <p className="text-xs text-red-500 flex items-center gap-2 bg-red-500/10 p-2 rounded">
            <AlertCircle className="w-4 h-4" />
            Security check failed to load.
          </p>
        ) : (
          <Turnstile
            sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
            onVerify={(t) => {
              setToken(t);
              setCaptchaError(false);
            }}
            onError={(err) => {
              console.error("Turnstile Error:", err);
              setCaptchaError(true);
              toast.error("Security check failed. Please refresh.");
            }}
            onExpire={() => setToken("")}
            theme="auto"
          />
        )}
      </div>

      <Button 
        type="submit" 
        disabled={loading || !token} 
        variant={captchaError ? "destructive" : "default"}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {captchaError 
              ? "Security Check Failed" 
              : (!token ? "Waiting for Verification..." : "Send Message")
            }
          </>
        )}
      </Button>
    </form>
  );
}