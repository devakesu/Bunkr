"use client";

import { useState, useRef, useEffect } from "react";
import { useProfile } from "@/hooks/users/profile";
import { useUser } from "@/hooks/users/user";
import { ProfileForm } from "@/components/profile-form";
import { InstitutionSelector } from "@/components/institution-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import { motion } from "framer-motion";
import { Camera, Loader2 } from "lucide-react"; 
import { toast } from "sonner"; 

import UserPlaceholder from "@/assets/user.png";
import { uploadUserAvatar } from "@/hooks/users/upload-avatar";
import { getToken } from "@/utils/auth";
import { compressImage } from "@/lib/utils";

export default function ProfilePage() {
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useProfile();
  const { data: user, isLoading: userLoading } = useUser();

  const [isUploading, setIsUploading] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoading = profileLoading || userLoading;

  // Sync profile data with local preview state when profile loads
  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarPreview(profile.avatar_url);
    }
  }, [profile]);

  // Function to trigger file input click
  const handleAvatarClick = () => {
    if (!isLoading && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  // Function to handle file selection and upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user?.id) {
      toast.error("User not found. Please reload.");
      return;
    }

    let file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file.");
      return;
    }

    try {
      setIsUploading(true);
      
      const accessToken = getToken(); 
      if (!accessToken) throw new Error("No access token found");

      // 1. Create a temporary local preview immediately
      const objectUrl = URL.createObjectURL(file);
      setAvatarPreview(objectUrl);

      // Limit is 5MB
      if (file.size > 5 * 1024 * 1024) {
        toast.info("Compressing large image...", { duration: 2000 });
        try {
          const compressedFile = await compressImage(file, 0.7);
          if (compressedFile.size > 5 * 1024 * 1024) {
             file = await compressImage(file, 0.5);
          } else {
             file = compressedFile;
          }
        } catch (error) {
          console.error("Compression failed:", error);
          toast.warning("Could not compress image. Uploading original.");
        }
      }
      
      // 2. CALL THE API
      const newAvatarUrl = await uploadUserAvatar(accessToken, file);
      
      // 3. Update state with the REAL url
      setAvatarPreview(newAvatarUrl);
      
      toast.success("Profile picture updated!");
      refetchProfile(); 
    } catch (error: any) {
      toast.error("Failed to update profile picture.");
      console.error("Upload error:", error.message || error);
      if (profile?.avatar_url) setAvatarPreview(profile.avatar_url);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const tabContentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeInOut" },
    },
  };

  const fieldVariants = {
    hidden: { opacity: 0 },
    visible: (custom: number) => ({
      opacity: 1,
      transition: { delay: custom * 0.1, duration: 0.3 },
    }),
  };

  if (isLoading) {
    return (
      <div className="flex h-[90vh] items-center justify-center bg-background text-xl font-medium text-muted-foreground text-center italic mx-12">
        &quot;Waiting on Ezygo to stop ghosting us 👻&quot;
      </div>
    );
  }

  return (
    <div className="min-h-[90vh] bg-background pb-5.5">
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto py-4 md:py-8 px-4 md:px-6"
      >
        <motion.div
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.15 },
            },
          }}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-3 gap-4 md:gap-8"
        >
          {/* Left Column: Profile Card */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 50 },
              show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
            }}
            className="md:col-span-2 sm:col-span-1 lg:col-span-1 space-y-4 md:space-y-6"
          >
            <Card className="relative overflow-hidden border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center md:items-start pt-12">
                
                {/* Banner Background */}
                <div className="h-[120px] md:h-[140px] w-full absolute top-0 left-0 right-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-900/40 via-purple-900/40 to-slate-900/40" />
                    <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
                    <div className="absolute -bottom-10 left-8 w-32 h-32 bg-primary/20 blur-[50px] rounded-full" />
                </div>

                {/* Profile Image Area */}
                <div className="relative w-24 h-24 mb-3 flex items-start mt-0.5 group z-10">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/png, image/jpeg, image/webp"
                  />
                  
                  <div 
                    onClick={handleAvatarClick}
                    className={`relative w-full h-full rounded-full ring-4 ring-background border-2 border-white/10 z-10 cursor-pointer overflow-hidden transition-all duration-300 ${isUploading ? 'opacity-80' : 'group-hover:opacity-90'}`}
                  >
                    <Image
                      src={avatarPreview || UserPlaceholder}
                      alt="Profile"
                      fill
                      className="object-cover"
                      priority
                      unoptimized={!!avatarPreview?.startsWith('blob:')} 
                    />
                    
                    {/* Hover Overlay */}
                    {!isUploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Camera className="w-8 h-8 text-white/80" />
                      </div>
                    )}

                    {/* Loading Spinner */}
                    {isUploading && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                      </div>
                    )}
                  </div>
                </div>

                {/* User Details */}
                <div className="text-center md:text-left w-full flex flex-col gap-0.5 relative z-10">
                  <h3 className="text-lg md:text-xl font-semibold mt-2">
                    {profile?.first_name} {profile?.last_name}
                  </h3>
                  <p className="text-muted-foreground text-sm lowercase font-medium">
                    @{user?.username}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="block">
              <InstitutionSelector />
            </div>
          </motion.div>

          {/* Right Column */}
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 50 },
              show: { opacity: 1, y: 0, transition: { duration: 0.1 } },
            }}
            className="md:col-span-2"
          >
            <Tabs defaultValue="personal" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-md:mt-4 rounded-[12px] bg-[#2B2B2B]">
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="account">EzyGo</TabsTrigger>
              </TabsList>

              {/* Personal Tab Content */}
              <TabsContent value="personal" className="mt-4">
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={tabContentVariants}
                >
                  <Card className="border-border/50 py-0 shadow-sm bg-card/50 backdrop-blur-sm">
                    <CardHeader className="p-6 pb-2 border-b border-border/40 bg-muted/20">
                      <CardTitle className="text-lg">
                        Personal Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6">
                      {profile ? (
                        <ProfileForm profile={profile} />
                      ) : (
                        <div>Failed to load profile</div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Account Tab Content */}
              <TabsContent value="account" className="mt-4">
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={tabContentVariants}
                >
                  <Card className="custom-container">
                    <CardHeader className="p-4 md:p-6 flex flex-col gap-0.5">
                      <CardTitle className="text-lg">
                        Account Settings
                      </CardTitle>
                      <CardDescription className="md:block font-medium">
                        Fetched from Ezygo. Cannot be changed here.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6">
                      <div className="space-y-4 md:space-y-6">
                        <div className="grid grid-cols-1 min-[1300px]:grid-cols-2 gap-5 text-sm">
                          <motion.div
                            className="space-y-2"
                            custom={0}
                            variants={fieldVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <h3 className="text-sm font-normal">Username</h3>
                            <div className="px-2 pl-3 py-2 bg-secondary/50 lowercase font-sm rounded-[12px] text-sm font-medium">
                              {user?.username}
                            </div>
                          </motion.div>
                          <motion.div
                            className="space-y-2"
                            custom={1}
                            variants={fieldVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <h3 className="text-sm font-medium">Email</h3>
                            <div className="px-2 pl-3 py-2 bg-secondary/50 lowercase font-sm rounded-[12px] text-sm font-medium">
                              {user?.email}
                            </div>
                          </motion.div>
                          <motion.div
                            className="space-y-2"
                            custom={2}
                            variants={fieldVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <h3 className="text-sm font-medium">Mobile</h3>
                            <div className="px-2 pl-3 py-2 bg-secondary/50 lowercase font-sm rounded-[12px] text-sm font-medium">
                              +{user?.mobile}
                            </div>
                          </motion.div>
                          <motion.div
                            className="space-y-2"
                            custom={3}
                            variants={fieldVariants}
                            initial="hidden"
                            animate="visible"
                          >
                            <h3 className="text-sm font-medium">
                              Account Created
                            </h3>
                            <div className="px-2 pl-3 py-2 bg-secondary/50 lowercase font-sm rounded-[12px] text-sm font-medium">
                              {user?.created_at
                                ? new Date(
                                    user.created_at
                                  ).toLocaleDateString()
                                : "N/A"}
                            </div>
                          </motion.div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </motion.div>
      </motion.main>
    </div>
  );
}