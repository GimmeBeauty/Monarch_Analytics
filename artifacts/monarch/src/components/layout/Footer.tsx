import { Link } from "wouter";

export default function Footer({ className = "" }: { className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <p className="text-[11px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 space-x-1">
        <Link href="/privacy-policy">
          <span className="hover:text-[#FFBC80] cursor-pointer transition-colors">Privacy Policy</span>
        </Link>
        <span>·</span>
        <Link href="/terms-of-use">
          <span className="hover:text-[#FFBC80] cursor-pointer transition-colors">Terms of Use</span>
        </Link>
      </p>
      <p className="text-[10px] text-[#3A3A3A]/28 dark:text-[#FFF9F2]/20 mt-1">
        © {new Date().getFullYear()} Durham Brands. All rights reserved.
      </p>
    </div>
  );
}
