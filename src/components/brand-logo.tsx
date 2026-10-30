import logoAsset from "@/assets/planova_logo.png.asset.json";

export function BrandLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="Planova logo"
      width={size}
      height={size}
      className={`shrink-0 rounded-md ${className}`}
    />
  );
}

export function BrandName({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold tracking-wide uppercase ${className}`}>
      Planova
    </span>
  );
}

export const BRAND_TAGLINE = "Plan Anything. Achieve Everything.";
