import type { Metadata } from "next"
import { WhatIsXrayPage } from "@/components/seo-landing"

export const metadata: Metadata = {
  title: "¿Qué es un X-Ray de Cartera y cómo se lee? | Portfolio X-Ray",
  description: "Descubre qué es el Instant X-Ray de Morningstar, qué información incluye y cómo interpretar distribución, sectores, riesgo y rentabilidad.",
}

export default function Page() {
  return <WhatIsXrayPage />
}
