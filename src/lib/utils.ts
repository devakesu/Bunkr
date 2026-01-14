// Utility functions
// src/lib/utils.ts

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 1. Normalize to Database Format (i, ii, iii)
export function toRoman(input: string | number): string {
  const clean = String(input).toLowerCase().trim().replace(/session|hour/g, "").trim();
  
  const romans = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
  if (romans.includes(clean)) return clean;

  const map: Record<string, string> = {
    "1st": "i", "2nd": "ii", "3rd": "iii", "4th": "iv", "5th": "v", 
    "6th": "vi", "7th": "vii", "8th": "viii"
  };
  if (map[clean]) return map[clean];

  const num = parseInt(clean.match(/\d+/)?.[0] || "0", 10);
  if (num > 0 && num <= 10) return romans[num - 1];

  return clean;
}

// 2. Format for Display (1st Hour, 2nd Hour)
export function formatSessionName(sessionName: string): string {
  if (!sessionName) return "";
  const clean = sessionName.toString().replace(/Session|Hour/gi, "").trim();
  
  // Handle Roman numerals (case-insensitive)
  const lower = clean.toLowerCase();
  const romanMap: Record<string, string> = {
    "i": "1st Hour", "ii": "2nd Hour", "iii": "3rd Hour", "iv": "4th Hour",
    "v": "5th Hour", "vi": "6th Hour", "vii": "7th Hour", "viii": "8th Hour"
  };
  if (romanMap[lower]) return romanMap[lower];

  // Handle numbers
  const num = parseInt(clean, 10);
  if (!isNaN(num) && num > 0) {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return `${num}st Hour`;
    if (j === 2 && k !== 12) return `${num}nd Hour`;
    if (j === 3 && k !== 13) return `${num}rd Hour`;
    return `${num}th Hour`;
  }

  // Fallback
  return sessionName.toLowerCase().includes("session") ? sessionName : `Session ${sessionName}`;
}

// 3. Get Sortable Number (1, 2, 3)
export function getSessionNumber(name: string): number {
  if (!name) return 999;
  const clean = name.toString().toLowerCase().replace(/session|hour/g, "").replace(/hour/g, "").trim();
  
  const romanMap: Record<string, number> = { 
    "i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8 
  };
  if (romanMap[clean]) return romanMap[clean];
  
  const match = clean.match(/\d+/);
  return match ? parseInt(match[0], 10) : 999;
}

// Helper function to compress image
export const compressImage = (file: File, quality = 0.7): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        
        // Scale down if image is massive
        const maxWidth = 1920; 
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Fill background with white before drawing
        // This prevents transparent PNGs from turning black when converted to JPEG
        ctx.fillStyle = "#FFFFFF"; 
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with specified quality
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Canvas is empty"));
              return;
            }

            const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            
            const compressedFile = new File([blob], newName, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const formatCourseCode = (code: string): string => {
  if (code.includes("-")) {
    const subcode = code.split("-")[0].trim();
    return subcode.replace(/[\s\u00A0]/g, "");
  }

  return code.replace(/[\s\u00A0]/g, "");
};

