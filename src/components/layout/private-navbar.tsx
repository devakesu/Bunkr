"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { handleLogout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/users/user";
import { useProfile } from "@/hooks/users/profile";
import { Switch } from "@/components/ui/switch";
import {
  useInstitutions,
  useDefaultInstitutionUser,
  useUpdateDefaultInstitutionUser,
} from "@/hooks/users/institutions";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Building2,
  Layers2,
  LogOut,
  UserRound,
  Percent,
  SquareAsterisk,
  Calculator,
  Contact,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useUserSettings } from "@/providers/user-settings";
import { AddRecordTrigger } from "@/components/attendance/AddRecordTrigger";
import UserPlaceholder from "@/assets/user.png";
import { Bell } from "lucide-react";
import { useNotifications } from "@/hooks/notifications/useNotifications";
import NProgress from "nprogress";

export const Navbar = () => {
  const router = useRouter();
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const { settings, updateBunkCalc, updateTarget, isLoading: settingsLoading } = useUserSettings();

  const { data: institutions, isLoading: institutionsLoading } = useInstitutions();
  const { data: defaultInstitutionUser } = useDefaultInstitutionUser();
  const updateDefaultInstitutionUser = useUpdateDefaultInstitutionUser();
  const queryClient = useQueryClient();
  
  // Use the server value directly - no local state needed for display
  const selectedInstitution = defaultInstitutionUser?.toString() ?? "";

  const pathname = usePathname();
  const { unreadCount } = useNotifications(true);

  // Handle Bunk Calc Toggle 
  const handleBunkCalcToggle = (checked: boolean) => {
    updateBunkCalc(checked);

    window.dispatchEvent(
      new CustomEvent("bunkCalcToggle", { detail: checked })
    );

    if (checked) {
    toast.success("Bunk Calculator Enabled");
    } else {
      toast.warning("Bunk Calculator Disabled");
    }
  };

  const navigateTo = (path: string) => {
    if (pathname !== path) {
        NProgress.start();
        router.push(path);
    }
  };

  const handleInstitutionChange = (value: string) => {
    updateDefaultInstitutionUser.mutate(Number.parseInt(value), {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["defaultInstitutionUser"] });
        queryClient.invalidateQueries({ queryKey: ["institutions"] });
        toast("Institution updated", {
          description: "Your default institution has been updated.",
        });
      },
      onError: () => {
        toast.error("Failed to update institution");
      },
    });
  };

  // Announce unread count changes to screen readers
  const unreadLabel = unreadCount > 0 
    ? `Notifications: ${unreadCount} unread` 
    : "Notifications: No unread messages";

  const handleAddSuccess = async () => {
    // 1. Invalidate 'attendance-report' so the Dashboard charts update
    await queryClient.invalidateQueries({ queryKey: ["attendance-report"] });
    
    // 2. Invalidate 'track_data' so the Tracking list updates
    await queryClient.invalidateQueries({ queryKey: ["track_data"] });
  };

  const currentTarget = settings?.target_percentage ?? 75;
  const currentBunkCalc = settings?.bunk_calculator_enabled ?? true;

  return (
    <header className="top-0 z-10 flex h-20 items-center justify-between gap-4 border-b-2 bg-background px-4 md:px-6 text-white mr-0.5 border-white/5">
      <div className="flex items-center gap-2">
        <Link href="/" className="group text-3xl sm:text-4xl lg:text-[2.50rem] font-semibold gradient-logo font-klick tracking-wide">
          <div className="relative w-40 sm:w-64 md:w-60 h-20 overflow-hidden">
            <Image 
              src="/logo.png" 
              alt="GhostClass Logo"
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
              placeholder="blur"
              blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAICAYAAAD5nd/tAAAACXBIWXMAAAsTAAALEwEAmpwYAAACJklEQVR4nI2SzW/ScBjHi/NtTJg7bzHGyyKZBzXZ0YMaYzLjYbEHx/CiMjWLo5TaFhg/YbyVStlvvIQCg4VmYVZeu9LxIrAtJmYJB6/+NTXFYDx48JN88jx5Ds+TJ/kiyF88sQL90lp0Fl2LzuIsO6Wqqk4T0UR+q6qI7l9zZCSi+QedDeze2Nr58jyalVez1c7NxCBxRRMq8BIA6jlRRCdEEVwsttkppp4zgEHhMiqKE6Nl4yNjMBSbTPKlR6XGt91qd1jcOzp7tZGrP13Pyst4Wr5Hxru3iLh0x56uPcD36s/shQZq4+WHdqjcxlnFRMZq1wEUjMjohSF/QQiDuVKp8bJ18qPRO/tZy5a/xzaYprAebHfsvm6R8va5D76vSTxwJBIRueeIHPYdW63PhKcfpzwDxvOx9ZoNFBcQECtcDYVSd5P+yAshU+AqjcGB1BuGYaZPEq5mwUErJ7Sz3fS4emWXs1ujnc22yy2dut3yqZvutD3Ucc1LHx/4nR1XFOwvIoCGJv8mtIU2uTxkEvl0Sghm843lqL+6GMQqjwNYdTVIHJoZomWOkK2VsENa+WSvmFlb2cLisoUjehaO6Js5sn0/A4Q5hKUDJj/FvQFk1Aec2+/83p0lxpeaZ5icQeIlvQKhUQHQWGdyhjrDGLQqAGhUoGAUw/x0N8xPa70EeD0A4DySoqiZGMHMg/fsgtW6fe0ttT+DYeIkiqIT43j8r1psfgEIVTv/3/hdewAAAABJRU5ErkJggg=="
              className="object-contain transition-transform group-hover:scale-110"
            />
          </div>
        </Link>
      </div>
      <div className="flex items-center justify-between gap-4 md:gap-6">
        <div className="gap-3 flex items-center">

          {pathname !== "/dashboard" && (
            <div className="max-lg:hidden text-white/85">
              <Button
                variant={"outline"}
                className="custom-button cursor-pointer"
                onClick={() => navigateTo("/dashboard")}
              >
                <Layers2 className="h-4 w-4" />
                Dashboard
              </Button>
            </div>
          )}

          {pathname !== "/tracking" && (
            <div className="max-lg:hidden text-white/85">
              <Button
                variant={"outline"}
                className="custom-button cursor-pointer"
                onClick={() => navigateTo("/tracking")}
              >
                <SquareAsterisk className="h-4 w-4" />
                Tracking
              </Button>
            </div>
          )}

          <div className="gap-3 flex items-center">
            <AddRecordTrigger user={user} onSuccess={handleAddSuccess} /> 
          </div>

          {/* Attendance Target Selector (Desktop Only) */}
          <div className="flex max-sm:hidden">
            <Select
              value={currentTarget.toString()}
              onValueChange={(value) => {
                const val = Number(value);
                updateTarget(val);
                toast("Attendance Target Updated", {
                  description: (
                    <span style={{ color: "#ffffffa6" }}>
                      Your attendance target is now set to {value}%.
                    </span>
                  ),
                  style: {
                    backgroundColor: "rgba(169, 77, 255, 0.76)",
                    color: "#ffffff",
                    border: "1px solid #22c55e33",
                    backdropFilter: "blur(4px)",
                  },
                });
              }}
            >
              <SelectTrigger className="w-[110px] custom-input cursor-pointer" aria-label="Set attendance target percentage">
                <SelectValue>
                  <div className="flex items-center font-medium">
                    <Percent className="mr-2 h-4 w-4" />
                    <span>{currentTarget}%</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="custom-dropdown mt-1">
                {[75, 80, 85, 90, 95].map((percentage) => (
                  <SelectItem key={percentage} value={percentage.toString()}>
                    <div className="flex items-center cursor-pointer">
                      <Percent className="mr-2 h-4 w-4 flex-shrink-0" />
                      <span className="font-medium">{percentage}%</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Institution Selector */}
          {!institutionsLoading && institutions && institutions.length > 0 && (
            <div className="flex max-md:hidden">
              <Select
                value={selectedInstitution}
                onValueChange={handleInstitutionChange}
              >
                <SelectTrigger className="w-[140px] md:w-[290px] custom-input cursor-pointer" aria-label="Select institution">
                  <SelectValue>
                    {selectedInstitution &&
                      institutions?.find(
                        (i) => i.id.toString() === selectedInstitution
                      ) && (
                        <div className="flex items-center font-medium">
                          <Building2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          <span>
                            {(
                              institutions.find(
                                (i) => i.id.toString() === selectedInstitution
                              )?.institution.name || ""
                            )}
                          </span>
                        </div>
                      )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="custom-dropdown mt-1">
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id.toString()}>
                      <div className="flex items-center cursor-pointer">
                        <Building2 className="mr-2 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                        <span className="font-medium">
                          {inst.institution.name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">

          <Link href="/notifications">
            <Button 
              variant="ghost" 
              className="relative h-9 w-9 p-0 rounded-full" 
              aria-label={unreadLabel}
            >
              <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              {unreadCount > 0 && (
                <>
                  <span
                    className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold ring-2 ring-background"
                    aria-hidden="true"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                  <span className="sr-only">
                    {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </Button>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="relative h-9 w-9 rounded-full cursor-pointer"
                aria-label="Open user menu"
              >
                <Avatar className="h-9 w-9 outline-2 relative">
                  {profile?.avatar_url ? (
                    <Image
                      src={profile.avatar_url}
                      alt={`${user?.username || 'User'} profile picture`}
                      fill
                      className="object-cover rounded-full"
                      priority
                      sizes="36px"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-muted">
                      <Image src={UserPlaceholder} alt="Default avatar" width={36} height={36} className="object-contain" priority/>
                    </div>
                  )}
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-56 z-50 mt-1 custom-dropdown pr-1 mr-[-4px]" align="end" role="menu">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium lowercase">{user?.username}</p>
                  <p className="text-xs text-muted-foreground lowercase">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigateTo("/dashboard")} className="cursor-pointer" role="menuitem">
                <Layers2 className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>Dashboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateTo("/tracking")} className="cursor-pointer" role="menuitem">
                <SquareAsterisk className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>Tracking</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateTo("/profile")} className="cursor-pointer" role="menuitem">
                <UserRound className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigateTo("/contact")} className="cursor-pointer" role="menuitem">
                <Contact className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>Contact Us</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              {/* Bunk Calculator Toggle */}
              <div className="px-2 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4" aria-hidden="true" />
                    <label htmlFor="bunk-calc-toggle" className="text-sm cursor-pointer">
                      Bunk Calculator
                    </label>
                  </div>
                  <Switch
                    id="bunk-calc-toggle"
                    checked={currentBunkCalc}
                    onCheckedChange={handleBunkCalcToggle}
                    disabled={settingsLoading}
                    aria-label="Toggle bunk calculator feature"
                  />
                </div>
              </div>

              {/* Target Percentage Selector (Mobile Only) */}
              <div className="px-2 py-2 sm:hidden border-t border-white/10 mt-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4" aria-hidden="true" />
                        <span className="text-sm">Target</span>
                    </div>
                    <Select
                      value={currentTarget.toString()}
                      onValueChange={(value) => {
                        updateTarget(Number(value));
                        toast("Target Updated", { description: `Target set to ${value}%`,
                          style: {
                            backgroundColor: "rgba(169, 77, 255, 0.76)",
                            color: "#ffffff",
                            border: "1px solid #22c55e33",
                            backdropFilter: "blur(4px)",
                          }
                        });
                      }}
                    >
                      <SelectTrigger className="w-[80px] h-8 text-xs bg-background/50 border-white/10">
                        <SelectValue placeholder={`${currentTarget}%`} />
                      </SelectTrigger>
                      <SelectContent className="custom-dropdown z-[60]">
                          {[75, 80, 85, 90, 95].map((p) => (
                            <SelectItem key={p} value={p.toString()}>{p}%</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
              </div>

              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer" variant="destructive">
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};