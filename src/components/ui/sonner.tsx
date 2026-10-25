"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// design-system §7.4: bottom-right on desktop, top on mobile, 4 s, light only.
const Toaster = ({ ...props }: ToasterProps) => {
  const [isDesktop, setIsDesktop] = useState(true)

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)")
    const update = () => setIsDesktop(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return (
    <Sonner
      theme="light"
      position={isDesktop ? "bottom-right" : "top-center"}
      duration={4000}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-rimba-600" />,
        info: <InfoIcon className="size-4 text-danau-700" />,
        warning: <TriangleAlertIcon className="size-4 text-senja-700" />,
        error: <OctagonXIcon className="size-4 text-merah-700" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{ classNames: { toast: "cn-toast shadow-overlay" } }}
      {...props}
    />
  )
}

export { Toaster }
